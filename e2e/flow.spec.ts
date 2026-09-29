import { test, expect, type Page } from '@playwright/test';

type Kitchen = { reportDelay(d: string, m: number): string };
const reportCurryDelay = (page: Page) =>
  page.evaluate(() => (window as unknown as { __kitchen: Kitchen }).__kitchen.reportDelay('chicken_curry', 10));

async function startVoiceOff(page: Page) {
  await page.goto('/?debug');
  await page.getByTestId('menu-indian').click();
  await page.getByTestId('serve-in-45').click();
  await expect(page.getByTestId('plan-preview')).toContainText('7:22');
  await page.getByTestId('start-cook-without-voice').click();
  await expect(page.getByTestId('ticket-garlic_naan')).toBeVisible();
  await page.keyboard.press('p');
}

test('a full dinner: fire, re-plan, glance, service', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await startVoiceOff(page);

  await page.keyboard.press('n');
  await expect(page.getByTestId('ticket-garlic_naan')).toHaveAttribute('data-state', 'fire');
  await expect(page.getByTestId('heard-log')).toContainText('Mix and knead the dough');
  await expect(page.getByTestId('next-up')).toHaveAttribute('data-state', 'now');

  await page.keyboard.press('n');
  await reportCurryDelay(page);
  await expect(page.getByTestId('serve-time')).toHaveAttribute('data-value', /8:10\sPM/);
  await expect(page.getByTestId('serve-delta')).toContainText('10');
  await expect(page.getByTestId('ticket-delta-jeera_rice')).toContainText('+10 min');
  await expect(page.getByTestId('heard-log')).toContainText(/Serving 8:00 → 8:10\sPM/);
  await expect(page.getByTestId('rail-marker').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/1440-replan.png' });

  await page.keyboard.press('g');
  await expect(page.getByTestId('glance-mode')).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/1440-glance.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('glance-mode')).toBeHidden();

  await page.keyboard.press('s');
  await expect(page.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true');

  for (let i = 0; i < 25 && !(await page.getByTestId('service-report').isVisible()); i++) await page.keyboard.press('n');
  await expect(page.getByTestId('service-report')).toContainText(/re-?plans?/i);
  await page.screenshot({ path: 'test-results/screens/1440-service.png' });
  await page.getByTestId('cook-again').click();
  await expect(page.getByTestId('plan-preview')).toBeVisible();

  expect(errors).toEqual([]);
});

test('the Western menu runs too', async ({ page }) => {
  await page.goto('/?debug');
  await page.getByTestId('menu-western').click();
  await page.getByTestId('start-cook-without-voice').click();
  await expect(page.getByTestId('ticket-roast_potatoes')).toBeVisible();
  await page.keyboard.press('n');
  await expect(page.getByTestId('ticket-roast_potatoes')).toHaveAttribute('data-state', 'fire');
});

for (const vp of [{ w: 1024, h: 768 }, { w: 390, h: 844 }]) {
  test(`composes at ${vp.w}×${vp.h}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto('/?debug');
    await page.screenshot({ path: `test-results/screens/${vp.w}-start.png`, fullPage: true });
    await startVoiceOff(page);
    await page.keyboard.press('n');
    await page.screenshot({ path: `test-results/screens/${vp.w}-kitchen.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

// The demo is recorded at 90% zoom (1600×878); 1440×790 is the same laptop at 100%.
for (const vp of [{ w: 1600, h: 878 }, { w: 1440, h: 790 }]) {
  test(`the kitchen fits ${vp.w}×${vp.h} with no scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await startVoiceOff(page);
    await page.keyboard.press('n');
    await reportCurryDelay(page);
    const fit = () =>
      page.evaluate(() => {
        const d = document.documentElement;
        const pass = document.querySelector('.pass')!;
        const rail = document.querySelector('[data-testid="rail"]')!.getBoundingClientRect();
        return {
          scroll: d.scrollHeight - innerHeight,
          overflow: d.scrollWidth - d.clientWidth,
          pass: pass.scrollHeight - pass.clientHeight,
          railBelow: Math.round(rail.bottom - innerHeight),
        };
      });
    expect(await fit()).toEqual({ scroll: 0, overflow: 0, pass: 0, railBelow: expect.any(Number) });
    expect((await fit()).railBelow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/screens/${vp.w}x${vp.h}-kitchen.png` });

    // A fourth dish joins mid-cook and everything still fits.
    await page.evaluate(async () => {
      const { BUILTIN_RECIPES } = await import('/src/kitchen/recipes.ts');
      const salmon = BUILTIN_RECIPES.find(r => r.id === 'salmon')!;
      (window as unknown as { __kitchen: { addDish(r: unknown): string } }).__kitchen.addDish(salmon);
    });
    await expect(page.getByTestId('ticket-salmon')).toBeVisible();
    await expect(page.getByTestId('rail')).toHaveAttribute('data-lanes', '4');
    await page.waitForTimeout(500);
    const four = await fit();
    expect(four.scroll).toBeLessThanOrEqual(0);
    expect(four.overflow).toBeLessThanOrEqual(0);
    expect(four.pass).toBeLessThanOrEqual(0);
    expect(four.railBelow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/screens/${vp.w}x${vp.h}-kitchen-4.png` });

    // A cook's own twelve-step recipe lists a window of its steps, so the rail stays on screen.
    await page.evaluate(async () => {
      const { kindPhoto } = await import('/src/kitchen/recipes.ts');
      const kitchen = (window as unknown as { __kitchen: { addDish(r: unknown): string; removeDish(id: string): string } }).__kitchen;
      kitchen.removeDish('salmon');
      kitchen.addDish({
        id: 'my_biryani', name: 'Hyderabadi chicken biryani', short: 'biryani', photo: kindPhoto('rice'), kind: 'rice', custom: true,
        steps: Array.from({ length: 12 }, (_, i) => ({ id: `s${i + 1}`, label: `Biryani step number ${i + 1}`, call: 'Biryani.', minutes: 4 })),
      });
    });
    await expect(page.getByTestId('ticket-my_biryani')).toBeVisible();
    await expect(page.getByTestId('ticket-my_biryani').getByRole('listitem')).toHaveCount(5);
    await page.waitForTimeout(500);
    const long = await fit();
    expect(long.scroll).toBeLessThanOrEqual(0);
    expect(long.pass).toBeLessThanOrEqual(0);
    expect(long.railBelow).toBeLessThanOrEqual(0);
  });
}
