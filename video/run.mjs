// One continuous, fully live take of the Heard Chef demo (see video/SCRIPT.md). Every "Hey Chef" is
// heard by the real app through a virtual mic; Chef's replies are the real Voice Agent API.
// Usage: node video/run.mjs <takeDir>
import { readFileSync, writeFileSync } from 'node:fs';
import {
  launch, Recorder, startAudio, stopAudio, click, moveCursor, hideCursor, showLabel, hideLabel, cookSay, until, chefIdle, agentEvents, camera, sleep,
} from './recorder.mjs';

const OUT = process.argv[2] || 'video/out/take';
const BASE = process.env.BASE || 'http://localhost:4173/';
const VOICE = 'video/out/voice';
const manifest = JSON.parse(readFileSync(`${VOICE}/manifest.json`, 'utf8'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const { browser, page } = await launch();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByTestId('start-continue').waitFor();
await page.evaluate(() => document.fonts.ready);
await sleep(600);

const rec = new Recorder(page, OUT);
await rec.start();
rec.mark('audio-start', { at: await startAudio(page) });
const shot = name => page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});

async function narrate(id, gapAfter = 300) {
  rec.mark(`narr:${id}`, { dur: manifest[id].seconds });
  await sleep(manifest[id].seconds * 1000 + gapAfter);
}
async function cook(id) {
  const r = await cookSay(page, `${VOICE}/${id}.wav`);
  rec.mark(`cook:${id}`, r);
  log('cook', id);
  return r;
}
const scene = name => { rec.mark(`scene:${name}`); log('scene', name); };
const serve = () => page.getByTestId('serve-time').getAttribute('data-value');
const ticketState = id => page.getByTestId(`ticket-${id}`).getAttribute('data-state').catch(() => null);
const heardCalls = () => page.locator('[data-testid="heard-log"] > li.is-call').count();
/** Waits for Chef's ears to fall asleep, so a "Hey Chef" goes through the wake + pre-roll path. */
async function earsAsleep() {
  const w = rec.mark('wait-ears');
  await until(page, () => document.querySelector('[data-testid="voice-bar"]')?.dataset.ears === 'asleep', null, { timeout: 15000 }).catch(() => {});
  rec.mark('ears-asleep', { from: w.t });
}
/** A cook line to Chef; waits until Chef has completely finished. Retried once if Chef never answers. */
async function ask(id, { retry = true, wait = true } = {}) {
  if (wait) await earsAsleep();
  const r = await cook(id);
  const d = await chefIdle(page, { expect: true, since: r.start, startTimeout: 15000 });
  if (!d.replied && retry) {
    log('no reply, retrying', id);
    rec.mark(`retry:${id}`);
    return ask(id, { retry: false });
  }
  rec.mark(`chef:${id}`, { cookEnd: r.end, end: d.end });
  return d;
}

try {
  // ---------------------------------------------------------------- 1. Start screen
  scene('start');
  await page.evaluate(() => window.__cursor.place(1480, 860));
  await sleep(400);
  const sweep = (async () => {
    for (const id of ['menu-indian', 'menu-western', 'menu-pasta', 'menu-veg']) {
      const b = await page.getByTestId(id).boundingBox();
      await moveCursor(page, b.x + b.width * 0.5, b.y + b.height * 0.62, 900);
      await sleep(900);
    }
    await click(page, page.getByTestId('menu-indian'), { ms: 900 });
    await click(page, page.getByTestId('serve-in-45'), { ms: 800 });
  })();
  await Promise.all([narrate('N2', 200), sweep]);
  await shot('01-start');

  // ---------------------------------------------------------------- 2. Recipe studio
  scene('studio');
  await click(page, page.getByRole('button', { name: 'New recipe', exact: true }).first(), { ms: 800 });
  await page.locator('dialog.studio[open]').waitFor();
  await sleep(500);
  await narrate('N3', 200);
  await click(page, page.getByRole('button', { name: 'Talk it through' }), { ms: 700 });
  const park = moveCursor(page, 1250, 820, 900);
  await page.getByRole('button', { name: 'Stop listening' }).waitFor({ timeout: 10000 });
  await until(page, () => /Listening/.test(document.querySelector('dialog.studio')?.textContent ?? ''), null, { timeout: 10000 });
  await park;
  await sleep(250);
  await cook('C1');
  const filled = (async () => {
    await until(page, () => document.querySelectorAll('dialog.studio .rc-step-label').length >= 2, null, { timeout: 30000 });
    rec.mark('card-filled');
  })();
  await sleep(700);
  await click(page, page.getByRole('button', { name: 'Stop listening' }), { ms: 700 });
  await Promise.all([narrate('N4', 400), filled]);
  await shot('02-card');
  // Prefer a suggestion that adds a step (it animates into the card); ask Chef again only if none can be applied.
  const addStep = page.locator('li.sg-row:has(.sg-icon path[d="M5 12h14"]) .sg-apply').first();
  const anyApply = page.getByRole('button', { name: /^Apply:/ }).first();
  const hasApply = await anyApply.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
  rec.mark('suggestions-wait-done', { hasApply });
  if (hasApply) {
    const apply = (await addStep.isVisible().catch(() => false)) ? addStep : anyApply;
    rec.mark('apply-visible');
    const n5 = narrate('N5', 300);
    await sleep(1500);
    await click(page, apply, { ms: 800 });
    await n5;
  } else {
    // Only tips this time: point at them instead of clicking.
    rec.mark('apply-visible');
    const tip = page.getByTestId('studio-suggestion').first();
    const n5 = narrate('N5b', 300);
    const b = await tip.boundingBox().catch(() => null);
    if (b) await moveCursor(page, b.x + b.width * 0.35, b.y + b.height * 0.55, 900);
    await n5;
  }
  await sleep(900);
  await shot('03-applied');
  await click(page, page.getByRole('button', { name: /Save & add to tonight/ }), { ms: 900 });
  await page.locator('dialog.studio[open]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await sleep(1300);
  await shot('04-tonight');

  // ---------------------------------------------------------------- 3. Sound check
  scene('soundcheck');
  await click(page, page.getByTestId('start-continue'), { ms: 900 });
  const n6 = narrate('N6', 300);
  await until(page, () => document.querySelector('[data-testid="soundcheck-start"]') && !document.querySelector('[data-testid="soundcheck-start"]').disabled, null, { timeout: 30000 });
  await n6;
  await sleep(300);
  let heard = false;
  for (let i = 0; i < 2 && !heard; i++) {
    await cook('C2');
    heard = await until(page, () => document.querySelector('[data-testid="soundcheck-heard"]')?.dataset.heard === 'true', null, { timeout: 6000 }).then(() => true).catch(() => false);
  }
  rec.mark('heard', { heard });
  await chefIdle(page, { expect: true, since: Date.now() - 4000, startTimeout: 7000 });
  rec.mark('soundcheck-idle');
  await sleep(700);
  await shot('05-heard');
  await click(page, page.getByTestId('soundcheck-start'), { ms: 800 });
  await hideCursor(page);

  // ---------------------------------------------------------------- 4. Chef speaks first
  scene('kitchen');
  const greetT = Date.now();
  const calls0 = await heardCalls();
  // Drop to 1x the moment the first call fires, so nothing else fires unasked.
  await until(page, n => document.querySelectorAll('[data-testid="heard-log"] > li.is-call').length > n, calls0, { timeout: 60000 });
  rec.mark('first-call');
  await page.keyboard.press('s');
  await camera(page, ['[data-testid="next-up"]', '.captions']);
  await sleep(200);
  await chefIdle(page, { quietMs: 1000 });
  rec.mark('first-call-done');
  await shot('06-first-call');
  await narrate('N7', 500);


  // ---------------------------------------------------------------- 6. The re-plan
  scene('replan');
  await camera(page, []);
  await sleep(400);
  for (let i = 0; i < 5; i++) {
    const s = await ticketState('chicken_curry');
    if (s === 'fire' || s === 'cooking') break;
    const t = Date.now();
    await page.keyboard.press('n');
    rec.mark('skip');
    await chefIdle(page, { expect: true, since: t, startTimeout: 6000 });
    rec.mark('skip-done');
  }
  await sleep(500);
  await earsAsleep();
  await camera(page, ['[data-testid="serve-time"]', '.pass-tickets'], { max: 1.45 });
  await sleep(500);
  await ask('C4', { wait: false });
  await until(page, () => /8:10/.test(document.querySelector('[data-testid="serve-time"]')?.dataset.value ?? ''), null, { timeout: 15000 }).catch(() => log('serve did not flip to 8:10:', 'check'));
  await sleep(600);
  await shot('07-replan');
  await camera(page, [], { ms: 1400 });
  await narrate('N8', 500);

  // ---------------------------------------------------------------- 7. Interrupting Chef
  scene('interrupt');
  await showLabel(page, 'Edge case · <b>Interrupting Chef</b> mid-sentence');
  await earsAsleep();
  await camera(page, ['.captions', '.heard', '[data-testid="voice-bar"]']);
  await sleep(400);
  const a = await cook('C5a');
  // Interrupt the spoken status (the reply after the tool result), about a second into it.
  await until(page, t => window.__agent.events(t).some(e => e.type === '>tool.result'), a.start, { timeout: 20000 });
  const tr = Date.now();
  await until(page, t => window.__agent.events(t).some(e => e.kind === 'chef' && e.type === 'reply.started'), tr - 50, { timeout: 10000 });
  await until(page, t => window.__rec.lastLoud() > t, tr, { timeout: 10000 });
  rec.mark('chef-answering');
  await sleep(2300);
  const before = await serve();
  await ask('C5', { retry: false, wait: false });
  await until(page, b => document.querySelector('[data-testid="serve-time"]')?.dataset.value !== b, before, { timeout: 15000 }).catch(() => log('serve did not move after the interruption'));
  await shot('08-interrupt');
  await hideLabel(page);
  await narrate('N9', 400);

  // ---------------------------------------------------------------- 8. Burnt garlic
  scene('burnt');
  await showLabel(page, 'Edge case · <b>Burnt it?</b> Start the step again');
  await ask('C6');
  await shot('09-burnt');
  await hideLabel(page);
  await sleep(300);

  // ---------------------------------------------------------------- 9. Off-topic
  scene('offtopic');
  await showLabel(page, 'Edge case · <b>Off-topic</b> questions');
  await ask('C7');
  await narrate('N10', 300);
  await hideLabel(page);
  await shot('10-offtopic');
  await camera(page, [], { ms: 1300 });
  await sleep(700);

  // ---------------------------------------------------------------- 10. Change the menu mid-cook
  scene('drop');
  await showLabel(page, '<b>Change the menu</b> mid-cook');
  await ask('C8');
  await until(page, () => !document.querySelector('[data-testid="ticket-garlic_naan"]'), null, { timeout: 8000 }).catch(() => log('naan still on the pass'));
  await sleep(600);
  await shot('11-dropped');
  await hideLabel(page);

  // ---------------------------------------------------------------- 11. Without voice, glance mode
  scene('tap');
  const n11 = narrate('N11', 300);
  await sleep(300);
  await click(page, page.getByRole('button', { name: 'Jeera rice needs 5 more minutes' }), { ms: 900 });
  await sleep(1900);
  await hideCursor(page);
  await page.keyboard.press('g');
  await n11;
  await sleep(1800);
  await shot('12-glance');
  await page.keyboard.press('Escape');
  await sleep(700);

  // ---------------------------------------------------------------- 12. Service
  scene('service');
  rec.mark('skip-to-service');
  for (let i = 0; i < 40 && !(await page.getByTestId('service-report').isVisible().catch(() => false)); i++) {
    await page.keyboard.press('n');
    await sleep(220);
  }
  rec.mark('service-report');
  // Chef reads out every call the skip fired (cut in the edit), ending on "Service." Wait for that line.
  await until(page, t => window.__agent.events(t).some(e => e.kind === 'chef' && e.type === 'transcript.agent' && /\bService\b/.test(e.text ?? '')), rec.markers.find(m => m.name === 'skip-to-service').t, { timeout: 150000, every: 250 }).catch(() => log('no Service line'));
  await chefIdle(page, { quietMs: 1200 });
  rec.mark('service-quiet');
  await shot('13-service');
  await narrate('N12', 1200);
} catch (e) {
  log('TAKE FAILED:', e.message);
  rec.mark('failed', { error: e.message });
  await shot('failed');
} finally {
  writeFileSync(`${OUT}/agent-events.json`, JSON.stringify(await agentEvents(page, 0).catch(() => []), null, 1));
  writeFileSync(`${OUT}/loud.json`, JSON.stringify(await page.evaluate(() => window.__rec.loudSegs()).catch(() => []), null, 0));
  await stopAudio(page, OUT).catch(e => log('audio stop failed', e.message));
  await rec.stop();
  writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
  await browser.close();
  log('take done', OUT, 'frames', rec.frames, 'errors', errors.length);
}
