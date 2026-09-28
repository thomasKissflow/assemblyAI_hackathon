// Voice Agent API feasibility probe: streams synthetic speech (macOS `say`) and logs event timing.
import { readFileSync } from 'node:fs';
const K = process.env.AAI_KEY;
const DIR = new URL('./audio/', import.meta.url).pathname;
const RATE = 24000, CHUNK_MS = 50, CHUNK_BYTES = RATE * 2 * CHUNK_MS / 1000;

function pcm(name) {
  const b = readFileSync(DIR + name + '.wav');
  let off = 12;
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'data') return b.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
}
const silence = (ms) => Buffer.alloc(Math.round(RATE * ms / 1000) * 2);
const scale = (buf, g) => { const o = Buffer.alloc(buf.length); for (let i = 0; i < buf.length; i += 2) o.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf.readInt16LE(i) * g))), i); return o; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run(label, { session, audio = [], tail = 6000, onReady, toolResults = {} }) {
  const log = [];
  const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${K}`);
  let t0 = null; const now = () => t0 === null ? -1 : Date.now() - t0;
  const pending = []; let ready;
  const readyP = new Promise(r => (ready = r));
  ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session }));
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.type === 'reply.audio') { if (!log.some(l => l.e === 'first reply.audio' && l.after === log.filter(x=>x.e==='reply.started').length)) log.push({ t: now(), e: 'first reply.audio', after: log.filter(x=>x.e==='reply.started').length }); return; }
    const entry = { t: now(), e: d.type };
    for (const k of ['delta', 'text', 'name', 'arguments', 'status', 'code', 'message', 'interrupted', 'execution_mode']) if (d[k] !== undefined) entry[k] = d[k];
    log.push(entry);
    if (d.type === 'session.ready') ready();
    if (d.type === 'tool.call') pending.push({ call_id: d.call_id, name: d.name });
    if (d.type === 'reply.done' && pending.length) {
      for (const p of pending.splice(0)) ws.send(JSON.stringify({ type: 'tool.result', call_id: p.call_id, result: JSON.stringify(toolResults[p.name] ?? { ok: true }) }));
      log.push({ t: now(), e: '>> sent tool.result(s)' });
    }
  };
  ws.onclose = (e) => log.push({ t: now(), e: `close ${e.code} ${e.reason}` });
  await Promise.race([readyP, sleep(8000)]);
  t0 = Date.now();
  if (onReady) await onReady(ws, log, now);
  const stream = Buffer.concat([...audio, silence(tail)]);
  for (let i = 0; i < stream.length; i += CHUNK_BYTES) {
    if (ws.readyState !== 1) break;
    ws.send(JSON.stringify({ type: 'input.audio', audio: stream.subarray(i, i + CHUNK_BYTES).toString('base64') }));
    await sleep(CHUNK_MS);
  }
  try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {}
  await sleep(800); try { ws.close(); } catch {}
  console.log(`\n===== ${label} =====`);
  for (const l of log) console.log(String(l.t).padStart(6), l.e, JSON.stringify(Object.fromEntries(Object.entries(l).filter(([k]) => !['t', 'e'].includes(k)))));
}

const which = process.argv[2] || 'all';
const hushTools = [
  { type: 'function', name: 'start_feed', description: 'Start a breastfeed or bottle feed.', parameters: { type: 'object', properties: { side: { type: 'string', enum: ['left', 'right', 'bottle'] } }, required: ['side'] } },
  { type: 'function', name: 'end_feed', description: 'End the current feed.', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'log_diaper', description: 'Log a diaper change.', parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['wet', 'dirty', 'both'] } }, required: ['kind'] } },
];
const hushPrompt = 'You are Hush, a baby log used at 3am. Call tools for every event the parent reports. After a tool result, reply in at most four words. Never say filler like "let me check".';

if (which === 'all' || which === 'buzz') await run('BUZZ: partial transcript cadence (cheese starts at ~3549ms, ends ~4000ms)', {
  session: { system_prompt: 'You are the guesser in a word-guessing party game. The user describes a secret word. Guess it in one or two words only.' },
  audio: [pcm('clueA'), pcm('clueB')], tail: 5000,
});
if (which === 'all' || which === 'multi') await run('MULTI: two events in one utterance (audio 0-2146ms)', {
  session: { system_prompt: hushPrompt, tools: hushTools, input: { keyterms: ['left side', 'right side', 'wet diaper', 'dirty diaper'] } },
  audio: [pcm('multi')], tail: 9000,
});
if (which === 'all' || which === 'whisper') await run('WHISPER voice at full gain (audio 0-1705ms)', {
  session: { system_prompt: hushPrompt, tools: hushTools },
  audio: [pcm('whisper')], tail: 6000,
});
if (which === 'all' || which === 'quiet') await run('QUIET: normal voice at 0.08 gain (~-22dB) (audio 0-1860ms)', {
  session: { system_prompt: hushPrompt, tools: hushTools },
  audio: [scale(pcm('soft'), 0.08)], tail: 6000,
});
if (which === 'all' || which === 'proactive') await run('PROACTIVE: reply.create with no user audio + keyterms session.update mid-session', {
  session: { system_prompt: 'You are a kitchen expediter. Keep replies under eight words.', greeting: '' },
  onReady: async (ws, log, now) => {
    ws.send(JSON.stringify({ type: 'reply.create', instructions: 'Say exactly: "Fire the beans now."' }));
    log.push({ t: now(), e: '>> sent reply.create' });
    await sleep(3500);
    ws.send(JSON.stringify({ type: 'session.update', session: { input: { keyterms: ['pepperoni', 'mozzarella'] } } }));
    log.push({ t: now(), e: '>> sent session.update keyterms' });
    ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You are a referee. Reply in two words.', input: { turn_detection: { min_silence: 400, vad_threshold: 0.3 } } } }));
    log.push({ t: now(), e: '>> sent session.update prompt+turn_detection' });
  },
  audio: [], tail: 4000,
});
if (which === 'collide') await run('COLLIDE: reply.create sent at 2000ms while user is mid-sentence (speech 0-5254ms)', {
  session: { system_prompt: 'You are a kitchen expediter. Keep replies under eight words.', greeting: '' },
  onReady: async (ws, log, now) => { setTimeout(() => { ws.send(JSON.stringify({ type: 'reply.create', instructions: 'Say exactly: "Fire the beans now."' })); log.push({ t: now(), e: '>> sent reply.create' }); }, 2000); },
  audio: [pcm('clueA'), pcm('clueB')], tail: 6000,
});
