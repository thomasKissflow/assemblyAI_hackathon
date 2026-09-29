// Text-to-speech through the AssemblyAI Voice Agent API: a session per voice, reply.create with
// "read this exactly", reply.audio (PCM16 24 kHz) collected into a WAV. The agent's own transcript
// is compared with the script; a paraphrase is retried.
// Usage: AAI_KEY=... node video/tts.mjs <voice> <out.wav> "<text>"
import { writeFileSync } from 'node:fs';

const RATE = 24000;
const SYSTEM = `You are a professional voice-over artist recording a product demo narration. When a request arrives, read the given line out loud exactly as written, word for word, in a warm, confident, natural and unhurried voice, like a friendly documentary narrator. Never add, drop, reorder or change words. Never say anything before or after the line. Numbers and times are read the way they're written in the line.`;

export const norm = s => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export class Speaker {
  constructor(key, voice, system = SYSTEM) {
    this.key = key; this.voice = voice; this.system = system; this.ws = null;
  }
  async open() {
    if (this.ws && this.ws.readyState === 1) return;
    this.ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${this.key}`);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('connect timeout')), 15000);
      this.ws.onopen = () => this.ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: this.system, output: { voice: this.voice } } }));
      this.ws.onmessage = m => { const d = JSON.parse(m.data); if (d.type === 'session.ready') { clearTimeout(t); res(); } if (d.type === 'session.error') rej(new Error(d.message)); };
      this.ws.onclose = e => rej(new Error('closed ' + e.code));
    });
  }
  /** One take: resolves { pcm, said } once reply.done arrives. */
  take(text) {
    return new Promise((res, rej) => {
      const chunks = []; let said = '';
      const t = setTimeout(() => rej(new Error('reply timeout')), 60000);
      this.ws.onmessage = m => {
        const d = JSON.parse(m.data);
        if (d.type === 'reply.audio') chunks.push(Buffer.from(d.data, 'base64'));
        if (d.type === 'transcript.agent') said = d.text;
        if (d.type === 'reply.done') { clearTimeout(t); res({ pcm: Buffer.concat(chunks), said, status: d.status }); }
      };
      this.ws.send(JSON.stringify({ type: 'reply.create', instructions: `Read this line exactly, word for word, and nothing else:\n${text}` }));
    });
  }
  async say(text, tries = 4) {
    let best = null;
    for (let i = 0; i < tries; i++) {
      await this.open();
      const r = await this.take(text);
      const ok = norm(r.said) === norm(text);
      if (ok) return { ...r, exact: true, tries: i + 1 };
      if (!best) best = r;
      // A fresh session so an earlier paraphrase doesn't colour the retry.
      try { this.ws.send(JSON.stringify({ type: 'session.end' })); this.ws.close(); } catch {}
      this.ws = null;
    }
    return { ...best, exact: false, tries };
  }
  close() { try { this.ws?.send(JSON.stringify({ type: 'session.end' })); this.ws?.close(); } catch {} }
}

/** Trim leading/trailing near-silence (PCM16 mono) leaving `padMs` either side. */
export function trimSilence(pcm, padMs = 60, thresh = 350) {
  const n = pcm.length / 2; let a = 0, b = n - 1;
  while (a < n && Math.abs(pcm.readInt16LE(a * 2)) < thresh) a++;
  while (b > a && Math.abs(pcm.readInt16LE(b * 2)) < thresh) b--;
  const pad = Math.round(RATE * padMs / 1000);
  return pcm.subarray(Math.max(0, a - pad) * 2, Math.min(n, b + pad) * 2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [voice, out, text] = process.argv.slice(2);
  const s = new Speaker(process.env.AAI_KEY, voice);
  const r = await s.say(text);
  s.close();
  writeFileSync(out, wav(trimSilence(r.pcm)));
  console.log(JSON.stringify({ voice, exact: r.exact, tries: r.tries, said: r.said, seconds: +(r.pcm.length / 2 / RATE).toFixed(2) }));
}
