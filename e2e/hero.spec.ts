import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { makeCookWav } from './wav';

const enabled = !!process.env.HERO_SHOT;
const wav = enabled ? makeCookWav(resolve('e2e/.tmp/hero'), 'Hey Chef, the curry needs ten more minutes.', 12_000, 30_000) : '';

test.skip(!enabled, 'set HERO_SHOT=1 to regenerate docs/screenshot.png (real API)');
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`],
  },
});

test('README hero screenshot', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-continue').click();
  await expect(page.getByTestId('soundcheck-start')).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId('soundcheck-start').click();
  await page.keyboard.press('n');
  await page.keyboard.press('n');
  await page.getByRole('button', { name: '10×' }).click();
  await expect(page.getByTestId('serve-time')).toHaveAttribute('data-value', /8:10\sPM/, { timeout: 60_000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'docs/screenshot.png' });
});
