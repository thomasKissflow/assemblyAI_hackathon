// Records a Playwright page as 1920x1080 H.264 in real time (CDP screencast frames re-timed onto a
// steady 30 fps grid by wall clock), plus the page's own audio through video/inpage.js.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import ffmpegPath from 'ffmpeg-static';

export const FPS = 30;
export const VIEW = { width: 1600, height: 900 };
export const DPR = 1.2;
const INPAGE = readFileSync(new URL('./inpage.js', import.meta.url), 'utf8');
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ harness = true } = {}) {
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--hide-scrollbars'],
  });
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR, permissions: ['microphone'] });
  if (harness) await context.addInitScript(INPAGE);
  const page = await context.newPage();
  return { browser, context, page };
}

export class Recorder {
  constructor(page, outDir) {
    this.page = page;
    this.outDir = outDir;
    mkdirSync(outDir, { recursive: true });
    this.markers = [];
    this.latest = null;
    this.frames = 0;
    this.sizes = new Set();
  }

  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', async f => {
      this.latest = Buffer.from(f.data, 'base64');
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closing */ }
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    while (!this.latest) await sleep(20);
    this.ff = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-r', String(FPS),
      `${this.outDir}/video.mp4`,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    this.ff.stdin.on('error', () => {});
    this.t0 = Date.now();
    this.mark('video-start');
    this.timer = setInterval(() => this.pump(), 1000 / FPS / 2);
  }

  pump() {
    const due = Math.floor(((Date.now() - this.t0) / 1000) * FPS) + 1;
    while (this.frames < due) {
      this.ff.stdin.write(this.latest);
      this.frames++;
    }
  }

  mark(name, extra = {}) {
    const m = { name, t: Date.now(), ...extra };
    this.markers.push(m);
    return m;
  }

  async stop() {
    clearInterval(this.timer);
    this.pump();
    this.mark('video-end');
    try { await this.cdp.send('Page.stopScreencast'); } catch { /* page gone */ }
    await new Promise(r => { this.ff.on('close', r); this.ff.stdin.end(); });
    writeFileSync(`${this.outDir}/markers.json`, JSON.stringify({ t0: this.t0, fps: FPS, frames: this.frames, markers: this.markers }, null, 2));
  }
}

/** Page audio: start after the page has loaded; returns the epoch the MediaRecorder started. */
export const startAudio = page => page.evaluate(() => window.__rec.start());
export async function stopAudio(page, outDir) {
  const b64 = await page.evaluate(() => window.__rec.stop());
  writeFileSync(`${outDir}/audio.webm`, Buffer.from(b64, 'base64'));
}

/** Moves the visible cursor to an element's centre, then clicks it for real. */
export async function click(page, locator, { ms = 650, settle = 250, offset = { x: 0, y: 0 } } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no box for ${locator}`);
  const x = box.x + box.width / 2 + offset.x;
  const y = box.y + box.height / 2 + offset.y;
  await page.evaluate(([x, y, ms]) => window.__cursor.moveTo(x, y, ms), [x, y, ms]);
  await page.evaluate(() => window.__cursor.pulse());
  await page.mouse.click(x, y);
  await sleep(settle);
}

export const moveCursor = (page, x, y, ms = 700) => page.evaluate(([x, y, ms]) => window.__cursor.moveTo(x, y, ms), [x, y, ms]);
export const hideCursor = page => page.evaluate(() => window.__cursor.hide());
/** Camera push-in on elements (CSS selectors), or pull back out with no selectors. */
export const camera = (page, selectors = [], opts = {}) => page.evaluate(([s, o]) => window.__camera.to(s, o), [selectors, opts]);
export const showLabel = (page, html) => page.evaluate(h => window.__label.show(h), html);
export const hideLabel = page => page.evaluate(() => window.__label.hide());

/** Plays a cook line (WAV file) into the virtual mic; resolves with its start/end epochs. */
export function cookSay(page, wavPath) {
  const b64 = readFileSync(wavPath).toString('base64');
  return page.evaluate(b => window.__cook.play(b), b64);
}

/**
 * Waits for Chef (any app audio) to start, if `started` isn't given, then until the app has been quiet
 * for `quietMs`. Returns { start, end } epochs of the audible stretch.
 */
export async function chefDone(page, { quietMs = 1600, startTimeout = 20000, maxMs = 45000, since = Date.now() } = {}) {
  const t = Date.now();
  let start = null;
  for (;;) {
    const last = await page.evaluate(() => window.__rec.lastLoud());
    if (start === null && last >= since) start = last;
    if (start !== null && Date.now() - last >= quietMs) return { start, end: last };
    if (start === null && Date.now() - t > startTimeout) return { start: null, end: null };
    if (Date.now() - t > maxMs) return { start, end: last };
    await sleep(80);
  }
}

/**
 * Waits until Chef has fully finished: no reply running, no tool follow-up pending, and no app audio
 * for `quietMs` (playback trails the protocol). If `expect` is set, first waits for a reply to start.
 */
export async function chefIdle(page, { quietMs = 900, expect = false, since = Date.now(), startTimeout = 20000, maxMs = 60000 } = {}) {
  const t = Date.now();
  if (expect) {
    const ok = await until(page, s => window.__agent.events(s).some(e => e.kind === 'chef' && e.type === 'reply.started'), since, { timeout: startTimeout }).then(() => true).catch(() => false);
    if (!ok) return { replied: false };
  }
  for (;;) {
    const st = await page.evaluate(() => ({ busy: window.__agent.busy(), quiet: window.__rec.quietFor() }));
    if (!st.busy && st.quiet >= quietMs) return { replied: true, end: Date.now() - st.quiet };
    if (Date.now() - t > maxMs) return { replied: true, end: Date.now(), timedOut: true };
    await sleep(80);
  }
}

export const agentEvents = (page, since) => page.evaluate(s => window.__agent.events(s), since);

/** Resolves once `fn` (evaluated in the page) is truthy, polling. */
export async function until(page, fn, arg, { timeout = 30000, every = 100 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(fn, arg)) return true;
    if (Date.now() > end) throw new Error(`timeout waiting for ${fn}`);
    await sleep(every);
  }
}
