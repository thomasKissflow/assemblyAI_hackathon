// Probe: scribe session behavior. (a) no audio sent at all, idle 25 s, then a request;
// (b) two requests back to back without tool.result; (c) reply.create while the follow-up reply is in progress.
const K = process.env.AAI_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mode = process.argv[2] || 'idle';
const tools = [{ type: 'function', name: 'save_note', description: 'Save the note.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }];
const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${K}`);
let t0 = Date.now(); const now = () => Date.now() - t0;
let readyR; const ready = new Promise(r => (readyR = r));
ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You save notes. For every request call save_note once, then say only "Done."', tools } }));
ws.onmessage = m => {
  const d = JSON.parse(m.data);
  if (d.type === 'reply.audio' || d.type === 'transcript.agent.delta') return;
  const extra = Object.fromEntries(Object.entries(d).filter(([k]) => ['text', 'name', 'arguments', 'status', 'code', 'message'].includes(k)));
  console.log(String(now()).padStart(6), d.type, JSON.stringify(extra));
  if (d.type === 'session.ready') readyR();
  if (d.type === 'tool.call' && mode === 'withresult') setTimeout(() => ws.send(JSON.stringify({ type: 'tool.result', call_id: d.call_id, result: '{"ok":true}' })), 400);
};
ws.onclose = e => console.log(now(), 'close', e.code, e.reason);
await ready; t0 = Date.now();
const ask = (s) => { console.log(String(now()).padStart(6), '>> reply.create', s); ws.send(JSON.stringify({ type: 'reply.create', instructions: `Save this note: ${s}` })); };
if (mode === 'idle') { await sleep(25000); ask('idle test'); await sleep(6000); }
if (mode === 'noresult') { ask('first'); await sleep(3500); ask('second'); await sleep(3500); ask('third'); await sleep(5000); }
if (mode === 'withresult') { ask('first'); await sleep(2600); ask('second (during follow-up)'); await sleep(6000); ask('third'); await sleep(6000); }
try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {}
await sleep(500); ws.close();
