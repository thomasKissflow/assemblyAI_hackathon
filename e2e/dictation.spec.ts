import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { makeCookWav } from './wav';

const enabled = !!process.env.VOICE_E2E;
const LINE = 'Tomato soup. Roast the tomatoes for twenty minutes, then blend them with stock, then simmer for ten minutes.';
// A few seconds of quiet while the mic and the streaming socket open, then the recipe, then quiet to end the turn.
const wav = enabled ? makeCookWav(resolve('e2e/.tmp/dictation'), LINE, 4_000, 30_000) : '';

test.skip(!enabled, 'set VOICE_E2E=1 (needs .env.local with a real key, macOS say)');
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`],
  },
});

test('a recipe said out loud fills the card through Chef’s scribe', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewportSize({ width: 1600, height: 878 });
  await page.goto('/?debug');
  await page.getByTestId('new-recipe').click();
  const studio = page.getByTestId('recipe-studio');
  await expect(studio).toBeVisible();

  const mic = studio.getByTestId('studio-mic');
  await expect(mic).toBeEnabled();
  await mic.click();
  await expect(mic).toHaveAttribute('aria-pressed', 'true');
  await expect(mic).toHaveAccessibleName('Stop listening');

  // Finished sentences land in the box; the pause after them formats the card on its own (no Format click).
  const text = studio.getByTestId('studio-text');
  await expect(text).toHaveValue(/tomato/i, { timeout: 45_000 });
  await expect(text).toHaveValue(/simmer/i, { timeout: 45_000 });
  await page.screenshot({ path: 'test-results/screens/dictation-heard.png' });
  await expect(studio.getByTestId('studio-status')).toContainText(/Formatted: \d+ steps, \d+ min/, { timeout: 45_000 });
  await expect.poll(() => studio.getByTestId('studio-step').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await expect(studio.getByTestId('studio-name')).toHaveValue(/tomato/i);
  await expect(studio.getByTestId('studio-short')).toHaveValue(/soup|tomato/i);
  await page.screenshot({ path: 'test-results/screens/dictation-formatted.png' });

  await mic.click();
  await expect(mic).toHaveAttribute('aria-pressed', 'false');
  await studio.getByTestId('studio-save-add').click();
  await expect(studio).toBeHidden();
  const row = page.locator('[data-testid^="tonight-my_"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(/tomato/i);
  expect(errors).toEqual([]);
});
