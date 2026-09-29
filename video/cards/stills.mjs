// Still-frame check for the video cards: opens each card at the recording viewport
// (1600×900 CSS, deviceScaleFactor 1.2 = 1920×1080), seeks with ?t= and screenshots each time,
// then loads the card normally and times window.__cardDone.
// Usage: node video/cards/stills.mjs [outDir] [intro|outro ...] [--times=0,800,...] [--no-done]
// Needs the Vite dev server (npm run dev) on :5173, or CARDS_BASE pointing at the cards folder.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.CARDS_BASE ?? 'http://localhost:5173/video/cards';
const args = process.argv.slice(2);
const outDir = args.find(a => !a.startsWith('--') && !['intro', 'outro'].includes(a)) ?? join(tmpdir(), 'heard-chef-cards');
const only = args.filter(a => ['intro', 'outro'].includes(a));
const timesArg = args.find(a => a.startsWith('--times='));
const custom = timesArg ? timesArg.slice(8).split(',').map(Number) : null;
const noDone = args.includes('--no-done');

// Default still times: each card's beats (see the timeline comment at the top of each card).
const CARDS = {
  intro: [0, 150, 500, 1000, 1600, 2100, 2500, 3000, 3700, 4500, 4900, 5300, 5800, 7000],
  outro: [0, 300, 800, 1500, 2100, 2700, 3500, 4700, 5900, 6500, 7000, 7800, 8500, 9300, 9600, 10000, 10500, 11900],
};

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
const page = await context.newPage();
const problems = [];
page.on('console', m => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));

for (const [name, defaults] of Object.entries(CARDS)) {
  if (only.length && !only.includes(name)) continue;
  for (const t of custom ?? defaults) {
    await page.goto(`${BASE}/${name}.html?t=${t}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__cardDone !== undefined);
    await page.evaluate(() => window.__cardDone);
    const scroll = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
    }));
    if (scroll.w > 1600 || scroll.h > 900) problems.push(`${name}@${t}: scroll size ${scroll.w}×${scroll.h}`);
    const file = join(outDir, `${name}-${String(t).padStart(5, '0')}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  if (noDone) continue;
  // Live playback: a frame before the timeline starts (must be blank, never unstyled text),
  // one mid-card, one after __cardDone (must match the final ?t= still).
  await page.goto(`${BASE}/${name}.html`, { waitUntil: 'commit' });
  await page.waitForSelector('main.card', { state: 'attached' });
  await page.screenshot({ path: join(outDir, `${name}-live-before.png`) });
  await page.waitForFunction(() => window.__cardStarted !== undefined);
  // __cardStarted resolves with the page clock (performance.now()) of the frame the timeline started.
  const startedAt = await page.evaluate(() => window.__cardStarted.then(t => Math.round(t)));
  await page.waitForTimeout(Math.round(defaults.at(-1) * 0.45));
  await page.screenshot({ path: join(outDir, `${name}-live-mid.png`) });
  const timing = await page.evaluate(async startedAt => {
    await window.__cardDone;
    return { duration: window.__cardDuration, elapsed: Math.round(performance.now() - startedAt) };
  }, startedAt);
  await page.screenshot({ path: join(outDir, `${name}-live-end.png`) });
  console.log(
    `${name}: timeline started ${startedAt} ms after navigation; __cardDuration ${timing.duration} ms; ` +
      `__cardDone resolved ${timing.elapsed} ms after start`,
  );
}

await browser.close();
if (problems.length) console.log('Problems:\n' + problems.join('\n'));
