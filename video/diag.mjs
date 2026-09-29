import { launch, click, cookSay, until, chefIdle, agentEvents, sleep } from './recorder.mjs';
const V = 'video/out/voice';
const { browser, page } = await launch();
await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByTestId('start-continue').click();
await until(page, () => !document.querySelector('[data-testid="soundcheck-start"]')?.disabled, null, { timeout: 30000 });
await sleep(500);
let t = Date.now();
await cookSay(page, `${V}/C2.wav`);
const heard = await until(page, () => document.querySelector('[data-testid="soundcheck-heard"]')?.dataset.heard === 'true', null, { timeout: 6000 }).then(() => true).catch(() => false);
console.log('heard', heard);
console.log('after soundcheck:', JSON.stringify(await chefIdle(page, { expect: true, since: t, startTimeout: 6000 })));
await page.getByTestId('soundcheck-start').click();
t = Date.now();
await chefIdle(page, { expect: true, since: t });
await page.keyboard.press('s');
await sleep(1500);
const show = async (label, since, end) => {
  const evs = await agentEvents(page, since);
  console.log(`--- ${label} (ms after the cook line ended)`);
  for (const e of evs) if (e.type !== 'turn' || e.eot) console.log(String(e.t - end).padStart(6), e.kind.padEnd(6), e.type, e.text ?? e.name ?? e.status ?? '');
};
for (const id of ['C3', 'C4']) {
  if (id === 'C4') { await page.keyboard.press('n'); await chefIdle(page, { expect: true, since: Date.now(), startTimeout: 5000 }); }
  const s = Date.now();
  const r = await cookSay(page, `${V}/${id}.wav`);
  const idle = await chefIdle(page, { expect: true, since: s });
  await show(id, s, r.end);
  console.log('idle', JSON.stringify(idle), 'audio quiet end rel', idle.end - r.end);
}
await browser.close();
