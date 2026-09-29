// Renders every narration and cook line to video/out/voice/<id>.wav and writes durations to manifest.json.
// Usage: AAI_KEY=... node video/render-voices.mjs [ids...]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { Speaker, wav, trimSilence } from './tts.mjs';
import { COOK_SYSTEM } from './cook.mjs';
import { NARRATION, COOK, VOICES } from './lines.mjs';

const dir = 'video/out/voice';
mkdirSync(dir, { recursive: true });
const only = new Set(process.argv.slice(2));
const manifestPath = `${dir}/manifest.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

async function renderAll(lines, voice, system, pad) {
  const s = new Speaker(process.env.AAI_KEY, voice, system);
  for (const [id, text] of Object.entries(lines)) {
    if (only.size && !only.has(id)) continue;
    let r, pcm;
    if (text.includes('|')) {
      const parts = [];
      let said = [], exact = true;
      for (const part of text.split('|')) {
        const p = await s.say(part.trim(), 5);
        parts.push(trimSilence(p.pcm, pad), Buffer.alloc(Math.round(24000 * 0.75) * 2));
        said.push(p.said);
        exact &&= p.exact;
      }
      pcm = Buffer.concat(parts.slice(0, -1));
      r = { said: said.join(' '), exact };
    } else {
      r = await s.say(text, 5);
      pcm = trimSilence(r.pcm, pad);
    }
    writeFileSync(`${dir}/${id}.wav`, wav(pcm));
    manifest[id] = { text, voice, exact: r.exact, said: r.said, seconds: +(pcm.length / 48000).toFixed(3) };
    console.log(id, voice, r.exact ? 'exact' : `NOT EXACT: ${r.said}`, manifest[id].seconds + 's');
  }
  s.close();
}
await Promise.all([renderAll(NARRATION, VOICES.narrator, undefined, 80), renderAll(COOK, VOICES.cook, COOK_SYSTEM, 150)]);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
