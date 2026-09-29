// Cuts a take into the final demo: trims dead air (the wait between a cook's line and Chef's reply), drops the
// skip-to-service call barrage, lays the narration over the marked quiet moments, and joins intro, take and outro.
// Usage: node video/assemble.mjs <takeDir> <out.mp4> [--target=194.3]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const [takeDir, outPath, ...flags] = process.argv.slice(2);
const opt = Object.fromEntries(flags.map(f => f.replace(/^--/, '').split('=')));
const VOICE = 'video/out/voice';
const CARDS = 'video/out/cards';
const voice = JSON.parse(readFileSync(`${VOICE}/manifest.json`, 'utf8'));
const M = JSON.parse(readFileSync(`${takeDir}/markers.json`, 'utf8'));
const loudRaw = JSON.parse(readFileSync(`${takeDir}/loud.json`, 'utf8'));
const events = JSON.parse(readFileSync(`${takeDir}/agent-events.json`, 'utf8'));
const cardsMeta = JSON.parse(readFileSync(`${CARDS}/cards.json`, 'utf8'));

const T0 = M.t0;
const v = epoch => (epoch - T0) / 1000;
const marks = M.markers.map(m => ({ ...m, v: v(m.t) }));
const mark = name => marks.find(m => m.name === name);
const marksOf = prefix => marks.filter(m => m.name.startsWith(prefix));
const audioOffset = v(mark('audio-start').at);
const loud = loudRaw.map(([a, b]) => [v(a), v(b) + 0.12]);
const nextLoud = t => loud.find(([a]) => a > t);
const lastLoudEnd = t => loud.filter(([a]) => a <= t).at(-1)?.[1];
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------------------------------------- cuts
const cuts = [];
const cut = (a, b, why) => { if (b - a > 0.25) cuts.push([a, b, why]); };

// Dead air: keep ~1.2 s of the natural pause between the cook's line and Chef's voice.
const KEEP_GAP = Number(opt.gap ?? 1.0);
const cooks = marksOf('cook:');
for (const [i, c] of cooks.entries()) {
  if (c.name === 'cook:C1') continue;
  const end = v(c.end);
  const nl = nextLoud(end + 0.15);
  if (!nl) continue;
  // Only Chef's answer to this line counts: never reach past the cook's next line (e.g. a retry).
  const nextCook = cooks[i + 1];
  if (nextCook && nl[0] > v(nextCook.start)) continue;
  const gap = nl[0] - end;
  if (gap > KEEP_GAP + 1.0) cut(end + KEEP_GAP, nl[0] - 0.45, `wait after ${c.name} (${gap.toFixed(1)}s)`);
}
// Waiting for the ears to fall asleep before a question.
for (const m of marksOf('ears-asleep')) {
  const from = v(m.from);
  if (m.v - from > 1.4) cut(from + 0.5, m.v - 0.3, 'ears asleep wait');
}
// The sound check: if Chef's reply to the bare "Hey Chef" went off-script, drop it (the green ring is the point).
{
  const c2 = marksOf('cook:C2').at(-1);
  const idle = mark('soundcheck-idle');
  if (c2 && idle) {
    const said = events.filter(e => e.kind === 'chef' && e.type === 'transcript.agent' && e.t > c2.end && e.t < idle.t).map(e => e.text).join(' ');
    const heardAt = mark('heard')?.v ?? v(c2.end);
    if (!/ready|heard|here/i.test(said) || /station|dinner\./i.test(said)) cut(Math.max(v(c2.end) + 0.9, heardAt + 1.4), idle.v - 0.1, `off-script sound-check reply: "${said.slice(0, 50)}"`);
  }
}
// Narration lines left out of this cut (--drop=N10,N9): their pause goes too.
const dropped = new Set(String(opt.drop ?? '').split(',').filter(Boolean));
for (const id of dropped) {
  const m = mark(`narr:${id}`);
  if (m) cut(m.v + 0.15, m.v + voice[id].seconds + 0.25, `dropped narration ${id}`);
}
// A retried line: drop the unanswered first try.
for (const r of marksOf('retry:')) {
  const id = r.name.split(':')[1];
  const first = marks.find(m => m.name === `cook:${id}` && m.v < r.v);
  if (first) cut(v(first.start) - 0.3, r.v, `unanswered ${id}`);
}
// An extra "Format with Chef" round trip.
if (mark('reformat') && mark('reformat-done')) cut(mark('reformat').v + 0.9, mark('reformat-done').v - 1.2, 'reformat wait');
// Waiting for Chef's suggestions after the card fills.
{
  const n4 = mark('narr:N4');
  const ready = mark('apply-visible');
  if (n4 && ready) {
    const n4End = n4.v + voice.N4.seconds;
    if (ready.v - n4End > 1.6) cut(n4End + 0.7, ready.v - 0.4, 'waiting for suggestions');
  }
}
// The wait between the greeting and the first call (the clock runs at 30x there).
{
  const fc = mark('first-call');
  const before = lastLoudEnd(fc.v - 0.3);
  const callStart = nextLoud(fc.v - 0.2)?.[0];
  if (before && callStart && callStart - before > 2.6) cut(before + 1.4, callStart - 0.9, 'greeting to first call');
}
// Skip to service: jump straight to the report, just before Chef's final "Service." line. The take's transcript
// (video/transcribe.mjs) gives the word's exact time; the protocol events are the fallback.
const transcriptWords = existsSync(`${takeDir}/transcript.json`) ? JSON.parse(readFileSync(`${takeDir}/transcript.json`, 'utf8')).words : null;
const serviceReply = (() => {
  const skipV = mark('skip-to-service')?.v;
  if (transcriptWords && skipV !== undefined) {
    const svc = transcriptWords.filter(w => /^service\b/i.test(w.text) && w.start / 1000 + audioOffset > skipV).at(-1);
    if (svc) {
      const start = svc.start / 1000 + audioOffset;
      const seg = loud.find(([a, b]) => a <= start + 0.3 && b >= start);
      const tail = transcriptWords.filter(w => w.start / 1000 + audioOffset >= start).slice(0, 8);
      return { start, end: Math.max(seg ? seg[1] : 0, tail.at(-1).end / 1000 + audioOffset + 0.15) };
    }
  }
  const said = events.filter(e => e.kind === 'chef' && e.type === 'transcript.agent' && /^Service\b/.test(e.text ?? ''));
  const last = said.at(-1);
  if (!last) return null;
  const started = events.filter(e => e.kind === 'chef' && e.type === 'reply.started' && e.t <= last.t).at(-1);
  const s = nextLoud(v(started.t) - 0.05);
  return s ? { start: s[0], end: s[1] } : null;
})();
const skip = mark('skip-to-service');
if (skip && serviceReply) cut(skip.v + 0.3, serviceReply.start - 0.12, 'skip-to-service barrage');

cuts.sort((a, b) => a[0] - b[0]);
// Merge overlaps.
const merged = [];
for (const c of cuts) {
  const last = merged.at(-1);
  if (last && c[0] <= last[1]) { last[1] = Math.max(last[1], c[1]); last[2] += ` + ${c[2]}`; } else merged.push([...c]);
}

// ---------------------------------------------------------------------------------------------- keep segments
const takeStart = mark('scene:start').v - 0.1;
const n12 = serviceReply ? serviceReply.end + 0.45 : mark('narr:N12').v;
const takeEnd = n12 + voice.N12.seconds + 1.3;
const keep = [];
let cursor = takeStart;
for (const [a, b] of merged) {
  if (b <= takeStart || a >= takeEnd) continue;
  if (a > cursor) keep.push([cursor, a]);
  cursor = Math.max(cursor, b);
}
if (cursor < takeEnd) keep.push([cursor, takeEnd]);
const takeLen = keep.reduce((s, [a, b]) => s + b - a, 0);
const map = t => {
  let acc = 0;
  for (const [a, b] of keep) {
    if (t < a) return acc;
    if (t <= b) return acc + (t - a);
    acc += b - a;
  }
  return acc;
};
const inCut = t => merged.some(([a, b]) => t > a && t < b);

// ---------------------------------------------------------------------------------------------- final timeline
const XF = 0.6;
const introLen = Number(opt.intro ?? cardsMeta.intro.seconds - (cardsMeta.intro.head ?? 0));
let outroLen = cardsMeta.outro.seconds - (cardsMeta.outro.head ?? 0);
const takeAt = introLen - XF;
const outroAt = takeAt + takeLen - XF;
let total = outroAt + outroLen;
if (opt.target) {
  // Land on an exact, deliberately odd length by holding (or shortening) the outro's final frame.
  outroLen += Number(opt.target) - total;
  total = Number(opt.target);
}

const narr = [];
narr.push({ id: 'N1', at: cardsMeta.intro.narrationAt ?? 0.25 });
for (const m of marksOf('narr:')) {
  const id = m.name.split(':')[1];
  if (id === 'N12' || id === 'N1' || id === 'N13' || dropped.has(id)) continue;
  if (inCut(m.v)) log(`WARNING: ${id} falls inside a cut`);
  narr.push({ id, at: takeAt + map(m.v) });
}
narr.push({ id: 'N12', at: takeAt + map(n12) });
narr.push({ id: 'N13', at: outroAt + (cardsMeta.outro.narrationAt ?? 0.3) });

log('cuts:');
for (const [a, b, why] of merged) log(`  ${a.toFixed(2)}–${b.toFixed(2)} (${(b - a).toFixed(1)}s) ${why}`);
log(`take kept ${takeLen.toFixed(1)}s of ${(takeEnd - takeStart).toFixed(1)}s; intro ${introLen}s, outro ${outroLen.toFixed(2)}s; total ${total.toFixed(2)}s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')})`);
for (const n of narr) log(`  ${n.id} at ${n.at.toFixed(2)}s (${voice[n.id].seconds}s)`);

// ---------------------------------------------------------------------------------------------- render
const inputs = ['-i', `${CARDS}/intro.mp4`, '-i', `${takeDir}/video.mp4`, '-i', `${CARDS}/outro.mp4`, '-i', `${takeDir}/audio.webm`];
narr.forEach(n => inputs.push('-i', `${VOICE}/${n.id}.wav`));
const f = [];
// Take video segments.
keep.forEach(([a, b], i) => f.push(`[1:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[tv${i}]`));
f.push(`${keep.map((_, i) => `[tv${i}]`).join('')}concat=n=${keep.length}:v=1:a=0,fps=30,format=yuv420p[take]`);
f.push(`[0:v]fps=30,format=yuv420p,trim=start=${cardsMeta.intro.head ?? 0}:duration=${introLen},setpts=PTS-STARTPTS[intro]`);
f.push(`[2:v]fps=30,format=yuv420p,trim=start=${cardsMeta.outro.head ?? 0},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=30,trim=duration=${outroLen.toFixed(3)},setpts=PTS-STARTPTS[outro]`);
f.push(`[intro][take]xfade=transition=fade:duration=${XF}:offset=${(introLen - XF).toFixed(3)}[it]`);
f.push(`[it][outro]xfade=transition=fade:duration=${XF}:offset=${outroAt.toFixed(3)},format=yuv420p[vout]`);
// App audio (Chef, bells, cook): same segments, shifted onto the video clock.
keep.forEach(([a, b], i) => {
  const as = Math.max(0, a - audioOffset), ae = Math.max(0, b - audioOffset);
  f.push(`[3:a]aresample=48000,atrim=start=${as.toFixed(3)}:end=${ae.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=${Math.max(0, ae - as - 0.03).toFixed(3)}:d=0.03[ta${i}]`);
});
f.push(`${keep.map((_, i) => `[ta${i}]`).join('')}concat=n=${keep.length}:v=0:a=1,pan=stereo|c0=c0|c1=c0,acompressor=threshold=-24dB:ratio=2.5:attack=5:release=150:makeup=1.5,adelay=${Math.round(takeAt * 1000)}|${Math.round(takeAt * 1000)}[app]`);
narr.forEach((n, i) => {
  const ms = Math.round(n.at * 1000);
  f.push(`[${4 + i}:a]aresample=48000,pan=stereo|c0=c0|c1=c0,volume=1.05,adelay=${ms}|${ms}[n${i}]`);
});
f.push(`[app]${narr.map((_, i) => `[n${i}]`).join('')}amix=inputs=${narr.length + 1}:normalize=0:duration=longest,apad=whole_dur=${total.toFixed(3)},atrim=duration=${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[aout]`);
writeFileSync(`${takeDir}/filter.txt`, f.join(';\n'));
const args = ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex_script', `${takeDir}/filter.txt`,
  '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', total.toFixed(3), outPath];
execFileSync(ffmpeg, args, { stdio: 'inherit' });
writeFileSync(`${takeDir}/edit.json`, JSON.stringify({ keep, cuts: merged, narr, total, takeAt, outroAt }, null, 1));
log('wrote', outPath);
