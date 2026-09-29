// Injected into the app page before any script runs (page.addInitScript). Recording harness only:
// a virtual microphone the cook's pre-rendered lines play into, a tap that records every sound the
// page makes (Chef's voice, bells, the cook), a visible cursor and a caption label for the video.
(() => {
  const W = window;
  const nativeConnect = AudioNode.prototype.connect;

  // ---- Recording mixer: every AudioContext's output is teed into one MediaRecorder.
  const mixCtx = new AudioContext({ sampleRate: 48000 });
  const mixDest = mixCtx.createMediaStreamDestination();
  const taps = new WeakMap();
  const meters = [];
  let micCtx = null;
  function tapFor(ctx) {
    if (ctx === mixCtx) return null;
    let tap = taps.get(ctx);
    if (!tap) {
      tap = ctx.createMediaStreamDestination();
      taps.set(ctx, tap);
      const src = mixCtx.createMediaStreamSource(tap.stream);
      nativeConnect.call(src, mixDest);
      if (ctx !== micCtx) {
        // Output meter for everything the app plays (Chef, bells), not the cook.
        const an = mixCtx.createAnalyser();
        an.fftSize = 2048;
        nativeConnect.call(src, an);
        meters.push(an);
      }
    }
    return tap;
  }
  const scratch = new Float32Array(2048);
  function outLevel() {
    let peak = 0;
    for (const an of meters) {
      an.getFloatTimeDomainData(scratch);
      let sum = 0;
      for (let i = 0; i < scratch.length; i++) sum += scratch[i] * scratch[i];
      peak = Math.max(peak, Math.sqrt(sum / scratch.length));
    }
    return peak;
  }
  // Epoch of the last moment app output was audible, sampled every 50 ms.
  let lastLoud = 0;
  const loudSegs = [];
  setInterval(() => {
    const now = Date.now();
    if (outLevel() > 0.004) {
      const seg = loudSegs[loudSegs.length - 1];
      if (seg && now - seg[1] <= 300) seg[1] = now;
      else loudSegs.push([now, now]);
      lastLoud = now;
    }
  }, 50);
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = nativeConnect.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode) {
      const tap = tapFor(this.context);
      if (tap) nativeConnect.call(this, tap, ...(rest.length ? [rest[0]] : []));
    }
    return out;
  };

  let recorder = null;
  const chunks = [];
  W.__rec = {
    level: outLevel,
    quietFor: () => Date.now() - lastLoud,
    lastLoud: () => lastLoud,
    loudSegs: () => loudSegs,
    start() {
      return new Promise(res => {
        void mixCtx.resume();
        recorder = new MediaRecorder(mixDest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
        recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
        recorder.onstart = () => res(Date.now());
        recorder.start(1000);
      });
    },
    stop() {
      return new Promise(res => {
        recorder.onstop = async () => {
          const buf = new Uint8Array(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer());
          let s = '';
          for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          res(btoa(s));
        };
        recorder.stop();
      });
    },
  };

  // ---- Virtual microphone: silence until the cook speaks.
  micCtx = new AudioContext({ sampleRate: 48000 });
  // Every getUserMedia gets its own destination (its own track) off one bus: the app stops the tracks
  // it's given when a mic closes, which must not silence the next one.
  const micBus = micCtx.createGain();
  const micTap = tapFor(micCtx);
  const md = navigator.mediaDevices;
  if (md) {
    md.getUserMedia = async constraints => {
      if (constraints && constraints.audio) {
        await micCtx.resume();
        const d = micCtx.createMediaStreamDestination();
        nativeConnect.call(micBus, d);
        return d.stream;
      }
      throw new DOMException('No camera', 'NotFoundError');
    };
    md.enumerateDevices = async () => [{ kind: 'audioinput', deviceId: 'virtual', label: 'Virtual mic', groupId: 'v' }];
  }
  W.__cook = {
    /** Plays a WAV (base64) into the virtual mic; resolves { start, end } epochs when it has finished. */
    async play(b64) {
      await micCtx.resume();
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const buf = await micCtx.decodeAudioData(bytes.buffer);
      const src = micCtx.createBufferSource();
      src.buffer = buf;
      nativeConnect.call(src, micBus);
      nativeConnect.call(src, micTap);
      const start = Date.now();
      src.start();
      await new Promise(r => (src.onended = r));
      return { start, end: Date.now() };
    },
  };

  // ---- Agent protocol tap: which replies are running, for exact "Chef is done" waits and edit points.
  const NativeWS = W.WebSocket;
  const agent = { events: [], chef: new Set(), replyOpen: 0, pendingFollowups: 0, lastActivity: 0 };
  function ev(kind, type, extra) {
    const e = { t: Date.now(), kind, type, ...extra };
    agent.events.push(e);
    if (agent.events.length > 4000) agent.events.shift();
    agent.lastActivity = e.t;
  }
  W.WebSocket = function (url, protocols) {
    const ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
    const u = String(url);
    if (!u.includes('agents.assemblyai.com') && !u.includes('streaming.assemblyai.com')) return ws;
    const stt = u.includes('streaming.assemblyai.com');
    let role = stt ? 'ears' : 'agent';
    const send = ws.send.bind(ws);
    ws.send = data => {
      if (typeof data === 'string') {
        try {
          const m = JSON.parse(data);
          if (m.type === 'session.update') role = /recipe scribe/i.test(m.session?.system_prompt ?? '') ? 'scribe' : 'chef';
          if (m.type !== 'input.audio') ev(role, `>${m.type}`, m.type === 'reply.create' ? { text: String(m.instructions).slice(0, 80) } : {});
          if (role === 'chef' && m.type === 'tool.result') {
            agent.pendingFollowups++;
            agent.lastToolResult = Date.now();
          }
        } catch { /* binary-ish */ }
      }
      return send(data);
    };
    ws.addEventListener('close', e => ev(role, 'socket.close', { text: `${e.code} ${e.reason || ''}`.trim() }));
    ws.addEventListener('error', () => ev(role, 'socket.error'));
    ws.addEventListener('message', m => {
      if (typeof m.data !== 'string') return;
      let d;
      try { d = JSON.parse(m.data); } catch { return; }
      if (stt) {
        if (d.type === 'Turn' && d.transcript) ev('ears', 'turn', { text: d.transcript.slice(-60), eot: !!d.end_of_turn });
        return;
      }
      if (d.type === 'reply.audio' || d.type === 'transcript.agent.delta' || d.type === 'transcript.user.delta') return;
      const extra = {};
      if (d.type === 'transcript.agent' || d.type === 'transcript.user') extra.text = String(d.text).slice(0, 800);
      if (d.type === 'tool.call') extra.name = d.name;
      if (d.type === 'reply.done') extra.status = d.status;
      ev(role, d.type, extra);
      if (role !== 'chef') return;
      if (d.type === 'reply.started') {
        agent.replyOpen = 1;
        agent.callsInReply = 0;
        agent.answersPending = agent.pendingFollowups > 0;
      }
      if (d.type === 'tool.call') agent.callsInReply++;
      if (d.type === 'reply.done') {
        agent.replyOpen = 0;
        if (agent.answersPending && agent.callsInReply === 0) agent.pendingFollowups = 0;
      }
    });
    return ws;
  };
  W.WebSocket.prototype = NativeWS.prototype;
  Object.assign(W.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  W.__agent = {
    /** Chef has nothing running: no reply open, no tool result waiting for its spoken follow-up. */
    busy: () => {
      // A tool result the agent never answers out loud stops counting after 8 s.
      if (agent.pendingFollowups > 0 && !agent.replyOpen && Date.now() - agent.lastToolResult > 8000) agent.pendingFollowups = 0;
      return agent.replyOpen > 0 || agent.pendingFollowups > 0;
    },
    events: since => agent.events.filter(e => e.t >= (since ?? 0)),
    lastActivity: () => agent.lastActivity,
  };

  // ---- Cursor and caption label, kept in the top layer so they sit above <dialog>s.
  const css = `
    #__cursor{position:fixed;inset:0 auto auto 0;margin:0;padding:0;border:0;background:transparent;overflow:visible;
      width:28px;height:28px;pointer-events:none;transform:translate(-100px,-100px);transition:transform 0ms;z-index:2147483647}
    #__cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))}
    #__cursor .ring{position:absolute;left:-18px;top:-18px;width:36px;height:36px;border-radius:50%;border:3px solid #ffcf3f;opacity:0;transform:scale(.4)}
    #__cursor .ring.go{animation:__ring 520ms cubic-bezier(.22,1,.36,1)}
    @keyframes __ring{0%{opacity:.95;transform:scale(.4)}100%{opacity:0;transform:scale(1.5)}}
    #__label{position:fixed;inset:auto auto 26px 26px;margin:0;border:0;padding:10px 18px 11px 14px;border-radius:999px;
      background:rgba(14,13,12,.92);color:#f4efe6;font:650 19px/1.2 Archivo,system-ui,sans-serif;letter-spacing:.005em;
      box-shadow:0 0 0 1px rgba(255,207,63,.45),0 10px 30px rgba(0,0,0,.45);pointer-events:none;overflow:visible;
      display:none;align-items:center;gap:10px;opacity:0;transform:translateY(8px);transition:opacity 260ms ease-out,transform 360ms cubic-bezier(.22,1,.36,1)}
    #__label.show{opacity:1;transform:none}
    #__label b{color:#ffcf3f;font-weight:800}
    #__label i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#ffcf3f;box-shadow:0 0 0 4px rgba(255,207,63,.18)}
  `;
  function mount() {
    if (document.getElementById('__cursor')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const c = document.createElement('div');
    c.id = '__cursor';
    c.setAttribute('popover', 'manual');
    c.innerHTML = `<div class="ring"></div><svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2.5 L4 22 L9.2 17.2 L12.6 25 L16.2 23.4 L12.9 15.8 L20 15.6 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(c);
    const l = document.createElement('div');
    l.id = '__label';
    l.setAttribute('popover', 'manual');
    document.body.appendChild(l);
  }
  const front = el => {
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      el.showPopover();
    } catch { /* no popover support */ }
  };
  let pos = { x: -100, y: -100 };
  W.__cursor = {
    async moveTo(x, y, ms = 650) {
      mount();
      const c = document.getElementById('__cursor');
      front(c);
      if (c.style.opacity === '0') {
        // Reappear where it was, then glide.
        c.style.transition = 'opacity 200ms ease-out';
        c.style.opacity = '1';
        await new Promise(r => setTimeout(r, 120));
      }
      c.style.transition = `transform ${ms}ms cubic-bezier(.45,.05,.25,1)`;
      c.getBoundingClientRect();
      c.style.transform = `translate(${x}px, ${y}px)`;
      pos = { x, y };
      await new Promise(r => setTimeout(r, ms + 30));
    },
    place(x, y) {
      mount();
      const c = document.getElementById('__cursor');
      front(c);
      c.style.transition = 'transform 0ms';
      c.style.transform = `translate(${x}px, ${y}px)`;
      pos = { x, y };
    },
    pulse() {
      const r = document.querySelector('#__cursor .ring');
      if (!r) return;
      r.classList.remove('go');
      r.getBoundingClientRect();
      r.classList.add('go');
    },
    hide() {
      const c = document.getElementById('__cursor');
      if (!c) return;
      c.style.transition = 'opacity 300ms ease-out';
      c.style.opacity = '0';
    },
    get pos() { return pos; },
  };
  W.__label = {
    show(html) {
      mount();
      const l = document.getElementById('__label');
      l.innerHTML = `<i></i><span>${html}</span>`;
      l.style.display = 'inline-flex';
      front(l);
      front(document.getElementById('__cursor'));
      requestAnimationFrame(() => requestAnimationFrame(() => l.classList.add('show')));
    },
    hide() {
      const l = document.getElementById('__label');
      if (!l) return;
      l.classList.remove('show');
      setTimeout(() => { if (!l.classList.contains('show')) l.style.display = 'none'; }, 380);
    },
  };
  // ---- Camera: a smooth push-in on part of the app (a CSS transform on #root, so text stays sharp).
  let camTimer = 0;
  W.__camera = {
    /** Frames the union of the elements' boxes (plus `pad`), capped at `max` zoom. null/[] pulls back out. */
    to(selectors, { pad = 24, max = 1.6, ms = 1100, box } = {}) {
      const root = document.getElementById('root');
      if (!root) return;
      clearTimeout(camTimer);
      const vw = innerWidth, vh = innerHeight;
      let r = box;
      if (!r && selectors && selectors.length) {
        const rects = selectors.flatMap(s => [...document.querySelectorAll(s)]).map(e => e.getBoundingClientRect()).filter(b => b.width && b.height);
        if (rects.length) {
          const x0 = Math.min(...rects.map(b => b.left)) - pad, y0 = Math.min(...rects.map(b => b.top)) - pad;
          const x1 = Math.max(...rects.map(b => b.right)) + pad, y1 = Math.max(...rects.map(b => b.bottom)) + pad;
          r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
      }
      root.style.transformOrigin = '0 0';
      root.style.transition = `transform ${ms}ms cubic-bezier(.65,0,.35,1)`;
      if (!r) {
        root.style.transform = 'translate(0px, 0px) scale(1)';
        camTimer = setTimeout(() => { root.style.transform = ''; root.style.transition = ''; }, ms + 50);
        return;
      }
      const s = Math.max(1, Math.min(max, vw / r.w, vh / r.h));
      let tx = vw / 2 - s * (r.x + r.w / 2), ty = vh / 2 - s * (r.y + r.h / 2);
      tx = Math.min(0, Math.max(vw - s * vw, tx));
      ty = Math.min(0, Math.max(vh - s * vh, ty));
      if (!root.style.transform) { root.style.transform = 'translate(0px, 0px) scale(1)'; root.getBoundingClientRect(); }
      root.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    },
  };
  document.addEventListener('DOMContentLoaded', mount);
})();
