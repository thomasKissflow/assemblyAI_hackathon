// Probe: use the Voice Agent API as a text-in "recipe scribe" via reply.create + a structured tool call.
// Usage: AAI_KEY=... node spikes/scribe-probe.mjs [format|suggest]
const K = process.env.AAI_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RATE = 24000, CHUNK_MS = 50, CHUNK = Buffer.alloc(RATE * 2 * CHUNK_MS / 1000);

const step = { type: 'object', properties: {
  label: { type: 'string', description: 'Short step name for a ticket, 2-6 words, e.g. "Simmer the dal".' },
  minutes: { type: 'integer', description: 'Realistic minutes for this step.' },
  call: { type: 'string', description: 'What Chef says out loud when this step starts. One short spoken line.' },
  hands_on: { type: 'boolean', description: 'true if the cook is busy during this step, false if it cooks by itself.' },
}, required: ['label', 'minutes', 'call'] };

const tools = [
  { type: 'function', name: 'save_recipe', description: 'Save the structured recipe.', parameters: { type: 'object', properties: {
    name: { type: 'string' }, short: { type: 'string', description: 'One word the cook would say, e.g. "dal".' },
    kind: { type: 'string', enum: ['curry', 'rice', 'bread', 'roast', 'fish', 'veg', 'pasta', 'soup', 'dessert', 'other'] },
    steps: { type: 'array', items: step },
    suggestions: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short tips to improve the recipe or its timing.' },
  }, required: ['name', 'short', 'kind', 'steps'] } },
];

const system_prompt = `You are Chef's recipe scribe. The app sends you a home cook's recipe as text. Turn it into a timed recipe by calling save_recipe exactly once. Fill in realistic minutes when the cook didn't give them. Keep the cook's own steps and order. Then say only "Done."`;

const RECIPE = `My mom's dal. Wash one cup of toor dal and pressure cook it with turmeric and salt, about 3 whistles. Meanwhile chop onion, tomato, garlic and green chillies. Heat ghee, add cumin and mustard seeds, then garlic, onion till golden, then tomato till soft. Mix in the cooked dal and simmer. Finish with coriander and a squeeze of lemon.`;

const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${K}`);
let t0 = Date.now(); const now = () => Date.now() - t0;
const pending = [];
let readyR; const ready = new Promise(r => (readyR = r));
ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt, tools, output: { voice: 'michael' } } }));
ws.onmessage = m => {
  const d = JSON.parse(m.data);
  if (d.type === 'reply.audio') return;
  const extra = Object.fromEntries(Object.entries(d).filter(([k]) => ['text', 'delta', 'name', 'arguments', 'status', 'code', 'message'].includes(k)));
  if (d.type !== 'transcript.agent.delta') console.log(String(now()).padStart(6), d.type, JSON.stringify(extra, null, d.type === 'tool.call' ? 1 : 0));
  if (d.type === 'session.ready') readyR();
  if (d.type === 'tool.call') pending.push(d.call_id);
  if (d.type === 'reply.done' && pending.length) for (const id of pending.splice(0)) ws.send(JSON.stringify({ type: 'tool.result', call_id: id, result: JSON.stringify({ ok: true }) }));
};
ws.onclose = e => console.log(now(), 'close', e.code, e.reason);
await ready;
t0 = Date.now();
ws.send(JSON.stringify({ type: 'reply.create', instructions: `The cook typed this recipe. Structure it with save_recipe:\n\n${RECIPE}` }));
for (let i = 0; i < 20000 / CHUNK_MS && ws.readyState === 1; i++) {
  ws.send(JSON.stringify({ type: 'input.audio', audio: CHUNK.toString('base64') }));
  await sleep(CHUNK_MS);
}
try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {}
await sleep(500); ws.close();
