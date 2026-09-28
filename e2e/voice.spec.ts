import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { makeCookWav } from './wav';

const enabled = !!process.env.VOICE_E2E;
const wav = enabled ? makeCookWav(resolve('e2e/.tmp'), 'Hey Chef, the curry needs ten more minutes.', 12_000, 30_000) : '';

test.skip(!enabled, 'set VOICE_E2E=1 (needs .env.local with a real key, macOS say)');
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`],
  },
});

test('"Hey Chef" re-plans dinner by voice through the real APIs', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('menu-indian').click();
  await page.getByTestId('serve-in-45').click();
  await page.getByTestId('start-continue').click();
  await expect(page.getByTestId('soundcheck-start')).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId('soundcheck-start').click();
  await page.keyboard.press('n');
  await page.keyboard.press('n');
  await page.keyboard.press('p');
  await expect(page.getByTestId('serve-time')).toHaveAttribute('data-value', /8:10\sPM/, { timeout: 60_000 });
  await expect(page.getByTestId('heard-log')).toContainText(/curry/i);
  await page.screenshot({ path: 'test-results/screens/voice-replan.png' });
});
