// Transcribes a take's audio with AssemblyAI (speaker labels + word timings) to audit overlaps.
// Usage: AAI_KEY=... node video/transcribe.mjs <audio file> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
const [file, out] = process.argv.slice(2);
const H = { authorization: process.env.AAI_KEY };
const up = await (await fetch('https://api.assemblyai.com/v2/upload', { method: 'POST', headers: H, body: readFileSync(file) })).json();
const job = await (await fetch('https://api.assemblyai.com/v2/transcript', {
  method: 'POST', headers: { ...H, 'content-type': 'application/json' },
  body: JSON.stringify({ audio_url: up.upload_url, speaker_labels: true, speech_models: ['universal-3-pro', 'universal-2'] }),
})).json();
if (!job.id) { console.error(job); process.exit(1); }
let t;
for (;;) {
  t = await (await fetch(`https://api.assemblyai.com/v2/transcript/${job.id}`, { headers: H })).json();
  if (t.status === 'completed' || t.status === 'error') break;
  await new Promise(r => setTimeout(r, 2500));
}
if (t.status === 'error') { console.error(t.error); process.exit(1); }
writeFileSync(out, JSON.stringify({ utterances: t.utterances, words: t.words }, null, 1));
for (const u of t.utterances) console.log(`${(u.start / 1000).toFixed(1).padStart(6)}-${(u.end / 1000).toFixed(1).padStart(6)} ${u.speaker}: ${u.text}`);
