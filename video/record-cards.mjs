// Records the intro and outro cards (video/cards/*.html) as 1080p clips with the same recorder as the take.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, Recorder, sleep } from './recorder.mjs';

const OUT = 'video/out/cards';
mkdirSync(OUT, { recursive: true });
const meta = {};
for (const name of ['intro', 'outro']) {
  const { browser, page } = await launch({ harness: false });
  await page.goto(`http://localhost:5173/video/cards/${name}.html`, { waitUntil: 'domcontentloaded' });
  const rec = new Recorder(page, `${OUT}/${name}-raw`);
  await rec.start();
  await page.waitForFunction(() => window.__cardDone && window.__cardStarted, null, { timeout: 15000 });
  const started = await page.evaluate(async () => performance.timeOrigin + (await window.__cardStarted));
  await page.evaluate(() => window.__cardDone);
  await sleep(1200);
  await rec.stop();
  await browser.close();
  const seconds = +(rec.frames / 30).toFixed(3);
  const { renameSync } = await import('node:fs');
  renameSync(`${OUT}/${name}-raw/video.mp4`, `${OUT}/${name}.mp4`);
  meta[name] = { seconds, head: +Math.max(0, (started - rec.t0) / 1000).toFixed(3), narrationAt: name === 'intro' ? 0.25 : 0.3 };
  console.log(name, seconds + 's');
}
writeFileSync(`${OUT}/cards.json`, JSON.stringify(meta, null, 2));
