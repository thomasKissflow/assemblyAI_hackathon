import { test, expect, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';

const enabled = !!process.env.SCRIBE_E2E;
test.skip(!enabled, 'set SCRIBE_E2E=1 (Chef’s scribe on the real Voice Agent API, needs .env.local with a real key)');
test.skip(enabled && !existsSync('.env.local'), 'needs .env.local with VITE_ASSEMBLYAI_API_KEY');

const DAL = `My mom's dal. Wash one cup of toor dal and pressure cook it with turmeric and salt, about 3 whistles. Meanwhile chop onion, tomato, garlic and green chillies. Heat ghee, add cumin and mustard seeds, then garlic, onion till golden, then tomato till soft. Mix in the cooked dal and simmer. Finish with coriander and a squeeze of lemon.`;

/** What's on the card: step names and minutes, and the ingredients. */
async function cardOf(studio: Locator) {
  const steps = await studio.getByTestId('studio-step').evaluateAll(rows =>
    rows.map(r => `${r.querySelector<HTMLInputElement>('.rc-step-label')?.value} ${r.querySelector<HTMLInputElement>('.rc-min input')?.value}`),
  );
  const ingredients = await studio.locator('.rc-chip').allTextContents();
  return { steps, ingredients };
}

test('Chef formats a typed recipe into a card that cooks', async ({ page }) => {
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

  await studio.getByTestId('studio-text').fill(DAL);
  await expect(studio.getByTestId('studio-format')).toBeEnabled();
  await studio.getByTestId('studio-format').click();
  const status = studio.getByTestId('studio-status');
  await expect(status).toContainText(/Chef is (reading|adding)/);
  await expect(status).toContainText(/Formatted: \d+ steps, \d+ min/, { timeout: 30_000 });

  expect(await studio.getByTestId('studio-step').count()).toBeGreaterThanOrEqual(3);
  await expect(studio.getByTestId('studio-short')).toHaveValue('dal');
  await expect(studio.getByTestId('studio-name')).toHaveValue(/dal/i);
  await expect(studio.getByTestId('studio-kind')).toHaveAccessibleName(/Curry/);
  expect((await cardOf(studio)).ingredients.join(' ')).toMatch(/toor dal/i);
  await page.screenshot({ path: 'test-results/screens/studio-live-formatted.png' });

  // A suggestion Chef can apply changes the card and leaves the list.
  const apply = studio.getByRole('button', { name: /^Apply:/ });
  if ((await apply.count()) > 0) {
    const label = (await apply.first().getAttribute('aria-label'))!;
    const before = await cardOf(studio);
    await apply.first().click();
    await expect(studio.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    expect(await cardOf(studio), `applying “${label}” changes the card`).not.toEqual(before);
  } else {
    test.info().annotations.push({ type: 'note', description: 'Chef offered no suggestion it could apply this time.' });
  }

  const name = await studio.getByTestId('studio-name').inputValue();
  await studio.getByTestId('studio-save-add').click();
  await expect(studio).toBeHidden();
  const row = page.locator('[data-testid^="tonight-my_"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(name);
  const id = (await row.getAttribute('data-testid'))!.replace('tonight-', '');

  await page.getByTestId('start-cook-without-voice').click();
  const ticket = page.getByTestId(`ticket-${id}`);
  await expect(ticket).toBeVisible();
  await expect(ticket.locator('img.dish-photo')).toHaveAttribute('src', /\/dishes\/kinds\/curry\.svg$/);
  await page.screenshot({ path: 'test-results/screens/studio-live-kitchen.png' });
  expect(errors).toEqual([]);
});
