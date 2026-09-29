// Renders the cook's lines (a home cook talking to Chef) with an AssemblyAI voice.
// Usage: AAI_KEY=... node video/cook.mjs <voice> <out.wav> "<text>"
import { writeFileSync } from 'node:fs';
import { Speaker, wav, trimSilence } from './tts.mjs';

export const COOK_SYSTEM = `You are voicing a home cook who is busy at the stove and talking to their kitchen assistant. When a request arrives, say the given line out loud exactly as written, word for word, casually and naturally, at a normal conversational pace, like a real person mid-cook. Never add, drop or change words, and never say anything else.`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [voice, out, text] = process.argv.slice(2);
  const s = new Speaker(process.env.AAI_KEY, voice, COOK_SYSTEM);
  const r = await s.say(text);
  s.close();
  writeFileSync(out, wav(trimSilence(r.pcm, 40)));
  console.log(JSON.stringify({ voice, exact: r.exact, said: r.said, seconds: +(r.pcm.length / 48000).toFixed(2) }));
}
