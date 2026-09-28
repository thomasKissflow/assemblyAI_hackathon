import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const RATE = 48000;

function pcmOf(file: string): Buffer {
  const b = readFileSync(file);
  let off = 12;
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'data') return b.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
}

export function makeCookWav(dir: string, line: string, leadMs: number, tailMs: number): string {
  mkdirSync(dir, { recursive: true });
  const raw = `${dir}/line.wav`;
  execFileSync('say', ['-o', raw, `--data-format=LEI16@${RATE}`, line]);
  const silence = (ms: number) => Buffer.alloc(Math.round((RATE * ms) / 1000) * 2);
  const pcm = Buffer.concat([silence(leadMs), pcmOf(raw), silence(tailMs)]);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  const out = `${dir}/cook.wav`;
  writeFileSync(out, Buffer.concat([header, pcm]));
  return out;
}
