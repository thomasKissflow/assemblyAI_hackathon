// Timeline runner for the Heard, Chef video cards.
//
// Every animation on a card is a CSS animation whose delay places it on one shared timeline that
// starts at 0 ms. They are all created paused (cards.css), so nothing moves until the fonts and
// photos are in. Then:
//   - normal load: they all start on the same frame; window.__cardDone resolves when the last one
//     (the card's own hold, --total long) finishes, i.e. the full card length including the hold;
//   - ?t=<ms>: every animation is paused at that time, for still-frame checks.
// window.__cardStarted resolves on the frame the timeline starts (page clock, performance.now());
// window.__cardStartedEpoch is that same moment in Date.now() terms, for a recorder to line its own
// clock up with (the lead-in before the timeline starts depends on how fast the web font arrives:
// 0.6 to 1.6 s after DOMContentLoaded on a cold cache). window.__cardDuration is the card length in ms. window.__cardNarration says which narration line the card was timed to and
// where on the card's timeline it should start (from data-narration / data-narration-at on .card).

const root = document.documentElement;
const total = parseFloat(getComputedStyle(root).getPropertyValue('--total')) || 0;
const params = new URLSearchParams(location.search);
const seek = params.has('t') ? Math.max(0, Number(params.get('t')) || 0) : null;
const card = document.querySelector('.card');

let resolveDone;
let resolveStarted;
window.__cardDuration = total;
window.__cardNarration = card?.dataset.narration
  ? { line: card.dataset.narration, atMs: Number(card.dataset.narrationAt || 0) }
  : null;
window.__cardDone = new Promise(r => (resolveDone = r));
window.__cardStarted = new Promise(r => (resolveStarted = r));

buildSplitFlaps();

const frame = () => new Promise(r => requestAnimationFrame(() => r()));

async function assetsReady() {
  const fonts = (async () => {
    try {
      await Promise.all([
        document.fonts.load('860 100px Archivo'),
        document.fonts.load('600 40px Archivo'),
      ]);
    } catch {}
    await document.fonts.ready;
  })();
  const images = Promise.all([...document.images].map(img => img.decode().catch(() => {})));
  const timeout = new Promise(r => setTimeout(r, 6000));
  await Promise.race([Promise.all([fonts, images]), timeout]);
}

await assetsReady();
// Two frames so layout with the real font is on screen before anything moves.
await frame();
await frame();

const animations = document.getAnimations();
if (seek !== null) {
  for (const a of animations) {
    a.pause();
    a.currentTime = seek;
  }
  root.classList.add('is-seek');
  resolveStarted(0);
  resolveDone();
} else {
  root.classList.add('is-live');
  const startedAt = performance.now();
  window.__cardStartedEpoch = Math.round(performance.timeOrigin + startedAt);
  resolveStarted(startedAt);
  await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
  resolveDone();
}

/* A split-flap is scripted, not reactive: data-seq lists, per digit, the characters it flips through
   (first = what it starts on, last = where it lands). Flips are pure CSS animations with delays:
   folding top halves stack oldest-on-top, unfolding bottom halves stack newest-on-top. */
function buildSplitFlaps() {
  for (const el of document.querySelectorAll('[data-flap]')) {
    const digits = JSON.parse(el.dataset.flap);
    const start = Number(el.dataset.start || 0);
    const step = Number(el.dataset.step || 170);
    const stagger = Number(el.dataset.stagger || 60);
    let d = 0;
    for (const part of digits) {
      if (part === ':') {
        const colon = document.createElement('span');
        colon.className = 'flap-colon';
        colon.textContent = ':';
        el.append(colon);
        continue;
      }
      if (part === 'PM' || part === 'AM') {
        const suffix = document.createElement('span');
        suffix.className = 'flap-suffix';
        suffix.textContent = part;
        el.append(suffix);
        continue;
      }
      const seq = [...part];
      const flap = document.createElement('span');
      flap.className = 'flap';
      const half = (pos, ch, extra = '', z = 1, at = null) => {
        const h = document.createElement('span');
        h.className = `flap-half flap-${pos} ${extra}`.trim();
        h.style.zIndex = String(z);
        if (at !== null) h.style.setProperty('--at', `${at}ms`);
        const g = document.createElement('span');
        g.className = 'flap-glyph';
        g.textContent = ch === ' ' ? ' ' : ch;
        h.append(g);
        return h;
      };
      const n = seq.length - 1;
      flap.append(half('top', seq[n]), half('bottom', seq[0]));
      for (let k = 0; k < n; k++) {
        const at = start + d * stagger + k * step;
        flap.append(half('top', seq[k], 'flap-fold', 10 + (n - k), at));
        flap.append(half('bottom', seq[k + 1], 'flap-unfold', 10 + k, at));
      }
      el.append(flap);
      d++;
    }
  }
}
