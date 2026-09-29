import { launch, cookSay, until, chefIdle, agentEvents, sleep } from './recorder.mjs';
const V = 'video/out/voice';
const { browser, page } = await launch({ harness: process.env.NOHARNESS ? false : true });
await page.goto('http://localhost:5173/');
await page.getByTestId('start-cook-without-voice').waitFor();
await page.getByTestId('start-continue').click();
await until(page, () => !document.querySelector('[data-testid="soundcheck-start"]')?.disabled, null, { timeout: 30000 });
const t0 = Date.now();
await page.getByTestId('soundcheck-start').click();
await sleep(3000);
await page.keyboard.press('s');
for (let i = 0; i < 12; i++) {
  await sleep(12000);
  const banner = await page.getByText('Lost the connection').isVisible().catch(() => false);
  console.log(Math.round((Date.now() - t0) / 1000) + 's', banner ? 'LOST' : 'ok');
  if (banner) break;
}
const evs = await agentEvents(page, 0).catch(() => []);
for (const e of evs) if (/socket|session\.(error|end)/.test(e.type)) console.log(Math.round((e.t - t0) / 1000) + 's', e.kind, e.type, e.text ?? '');
await browser.close();
