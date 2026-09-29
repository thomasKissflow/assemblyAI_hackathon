import { test as base, expect, type Page } from '@playwright/test';

/**
 * Menus, Tonight and the recipe studio, by hand (no voice, no live AI). Every test starts with an empty recipe book
 * and fails on any console error.
 */
const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', e => errors.push(String(e)));
      // Once per tab, so a reload keeps whatever the test saved.
      await page.addInitScript(() => {
        try {
          if (!sessionStorage.getItem('e2e-cleared')) {
            localStorage.clear();
            sessionStorage.setItem('e2e-cleared', '1');
          }
        } catch {
          // No storage: the library runs in memory.
        }
      });
      // Chef's scribe finds no connection here, so the studio works by hand only (the live flow is studio-live.spec).
      await page.routeWebSocket(/assemblyai\.com/, ws => ws.close());
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

const BUILTIN_MENUS: Record<string, string[]> = {
  indian: ['chicken_curry', 'jeera_rice', 'garlic_naan'],
  western: ['salmon', 'roast_potatoes', 'green_beans'],
  pasta: ['tomato_pasta', 'garlic_bread', 'green_salad'],
  veg: ['dal_tadka', 'aloo_gobi', 'roti'],
};

const VIEWPORTS = [
  { width: 1600, height: 878 },
  { width: 1440, height: 790 },
];

async function open(page: Page) {
  await page.goto('/?debug');
  await expect(page.getByTestId('menu-indian')).toBeVisible();
}

async function openStudio(page: Page, how: 'new' | { customise: string }) {
  await page.getByTestId(how === 'new' ? 'new-recipe' : `customise-${how.customise}`).click();
  const studio = page.getByTestId('recipe-studio');
  await expect(studio).toBeVisible();
  return studio;
}

/** Adds a step by hand: Add step, then its name and minutes. */
async function addStep(page: Page, n: number, label: string, minutes: number) {
  const studio = page.getByTestId('recipe-studio');
  await studio.getByTestId('studio-add-step').click();
  const name = studio.getByLabel(`Step ${n}`, { exact: true });
  await expect(name).toBeFocused();
  await name.fill(label);
  await studio.getByLabel(`Step ${n} minutes`).fill(String(minutes));
}

async function tonightIds(page: Page) {
  return page.locator('[data-testid^="tonight-"]:not([data-testid="tonight-empty"])').evaluateAll(els =>
    els.map(el => el.getAttribute('data-testid')!.replace('tonight-', '')),
  );
}

async function pageFit(page: Page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight - innerHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}

test('a recipe written by hand goes on tonight and cooks with plate art', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0]);
  await open(page);
  const studio = await openStudio(page, 'new');
  await expect(studio.getByRole('heading', { name: 'New recipe' })).toBeVisible();

  await studio.getByTestId('studio-name').fill('Weeknight chilli');
  await studio.getByTestId('studio-short').fill('chilli');
  await studio.getByTestId('studio-kind').click();
  await studio.getByTestId('kind-soup').click();
  await expect(studio.getByTestId('studio-kind')).toHaveAccessibleName(/Soup/);
  await addStep(page, 1, 'Soften the onions', 8);
  await addStep(page, 2, 'Simmer the chilli', 25);
  await expect(studio.getByTestId('studio-step')).toHaveCount(2);
  await expect(studio.getByTestId('studio-total')).toContainText('33 min');
  await expect(studio.getByTestId('studio-total')).toContainText('2 steps');

  await studio.getByTestId('studio-save-add').click();
  await expect(studio).toBeHidden();
  const row = page.getByTestId('tonight-my_weeknight_chilli');
  await expect(row).toContainText('Weeknight chilli');
  await expect(row).toContainText('33 min · 2 steps');
  await expect(row).toContainText('your recipe');
  await expect(row.locator('img')).toHaveAttribute('src', '/dishes/kinds/soup.svg');
  await expect.poll(() => tonightIds(page)).toEqual([...BUILTIN_MENUS.indian, 'my_weeknight_chilli']);
  // Tonight differs from the Indian menu now, and the preview plans with the new dish.
  await expect(page.getByTestId('save-menu')).toBeVisible();
  await expect(page.getByTestId('plan-preview')).toBeVisible();

  await page.getByTestId('start-cook-without-voice').click();
  const ticket = page.getByTestId('ticket-my_weeknight_chilli');
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText('Weeknight chilli');
  await expect(ticket.locator('img.dish-photo')).toHaveAttribute('src', /\/dishes\/kinds\/soup\.svg$/);
  // The art loaded (a broken image would fall back to the plain plate).
  expect(await ticket.locator('img.dish-photo').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const id of BUILTIN_MENUS.indian) await expect(page.getByTestId(`ticket-${id}`)).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/menus-own-recipe-kitchen.png' });

  // Back at the start, tonight is still tonight.
  await page.getByRole('button', { name: 'End dinner' }).click();
  await expect(page.getByTestId('plan-preview')).toBeVisible();
  await expect.poll(() => tonightIds(page)).toEqual([...BUILTIN_MENUS.indian, 'my_weeknight_chilli']);
});

test('the studio refuses to save a recipe without a name or steps', async ({ page }) => {
  await open(page);
  const studio = await openStudio(page, 'new');
  await studio.getByTestId('studio-save-add').click();
  await expect(studio.getByTestId('studio-errors')).toContainText('Give the recipe a name.');
  await expect(studio.getByTestId('studio-errors')).toContainText('Add at least one step.');
  await expect(studio.getByTestId('studio-name')).toBeFocused();

  // Something to lose: Esc asks first, and Keep editing keeps it.
  await studio.getByTestId('studio-name').fill('Half a thought');
  await page.keyboard.press('Escape');
  await expect(studio.getByTestId('studio-discard')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(studio.getByTestId('studio-discard')).toBeHidden();
  await expect(studio.getByTestId('studio-name')).toHaveValue('Half a thought');
  await studio.getByTestId('studio-cancel').click();
  await studio.getByTestId('studio-discard').click();
  await expect(studio).toBeHidden();
  await expect.poll(() => tonightIds(page)).toEqual(BUILTIN_MENUS.indian);
});

test('customising a built-in step time moves tonight’s plan', async ({ page }) => {
  await open(page);
  await page.getByTestId('serve-in-45').click();
  const preview = page.getByTestId('plan-preview');
  await expect(preview).toContainText(/serving at 8:00\sPM/);
  await expect(preview.getByRole('listitem').first()).toContainText(/7:22\sPM.*naan mix/i);
  await expect(preview).toContainText(/7:25\sPM.*curry fry onions/i);

  const studio = await openStudio(page, { customise: 'chicken_curry' });
  await expect(studio.getByRole('heading', { name: 'Customise Chicken curry' })).toBeVisible();
  await expect(studio.getByTestId('studio-step')).toHaveCount(3);
  await expect(studio.getByLabel('Step 1', { exact: true })).toHaveValue('Fry onions, ginger & garlic');
  await expect(studio.getByLabel('Step 1 minutes')).toHaveValue('8');
  await studio.getByLabel('Step 1 minutes').fill('18');
  await expect(studio.getByTestId('studio-total')).toContainText('45 min');
  await studio.getByTestId('studio-save').click();
  await expect(studio).toBeHidden();

  // The cook's copy takes the built-in's place on tonight; Chef's original stays in the book.
  await expect.poll(() => tonightIds(page)).toEqual(['my_chicken_curry', 'jeera_rice', 'garlic_naan']);
  const row = page.getByTestId('tonight-my_chicken_curry');
  await expect(row).toContainText('45 min · 3 steps');
  await expect(row).toContainText('your version');
  await expect(preview).toContainText(/serving at 8:00\sPM/);
  await expect(preview.getByRole('listitem').first()).toContainText(/7:15\sPM.*curry fry onions/i);

  // Longer than the serve-in time: dinner moves later, and the preview says why.
  await page.getByTestId('serve-in-30').click();
  await expect(preview).toContainText(/serving at 8:00\sPM/);
  await expect(preview).toContainText('Chicken curry takes 45 min, so dinner’s a little later.');

  // Chef's original is still there to add back.
  await page.getByTestId('add-dish').click();
  const picker = page.getByTestId('dish-picker');
  await expect(picker.getByTestId('picker-chicken_curry')).toBeVisible();
  await expect(picker.getByTestId('picker-chicken_curry')).toContainText('instead of your version');
  await picker.getByRole('button', { name: 'Done' }).click();

  await page.getByTestId('start-cook-without-voice').click();
  await expect(page.getByTestId('ticket-my_chicken_curry')).toBeVisible();
});

test('a saved menu survives a reload and can be picked again', async ({ page }) => {
  await open(page);
  await page.getByTestId('remove-garlic_naan').click();
  await page.getByTestId('add-dish').click();
  const picker = page.getByTestId('dish-picker');
  await picker.getByTestId('picker-dal_tadka').click();
  await picker.getByRole('button', { name: 'Done' }).click();
  await expect(picker).toBeHidden();
  await expect.poll(() => tonightIds(page)).toEqual(['chicken_curry', 'jeera_rice', 'dal_tadka']);

  await page.getByTestId('save-menu').click();
  await page.getByTestId('save-menu-name').fill('Curry and dal');
  await page.getByTestId('save-menu-confirm').click();
  const tile = page.getByTestId('menu-menu_curry_and_dal');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect(tile).toContainText('Curry and dal');
  await expect(tile).toContainText('3 dishes');
  await expect(page.getByTestId('save-menu')).toBeHidden();

  await page.reload();
  await expect(tile).toBeVisible();
  await expect(page.getByTestId('menu-indian')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => tonightIds(page)).toEqual(BUILTIN_MENUS.indian);
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => tonightIds(page)).toEqual(['chicken_curry', 'jeera_rice', 'dal_tadka']);

  await page.getByTestId('start-cook-without-voice').click();
  for (const id of ['chicken_curry', 'jeera_rice', 'dal_tadka']) await expect(page.getByTestId(`ticket-${id}`)).toBeVisible();
  await expect(page.getByTestId('ticket-garlic_naan')).toHaveCount(0);
});

test('the picker, studio and menus work from the keyboard, with focus handed back', async ({ page }) => {
  await open(page);
  const focused = (testId: string) => expect(page.getByTestId(testId)).toBeFocused();

  // Add a dish: search, add, Esc; focus comes back to "Add a dish".
  await page.getByTestId('add-dish').focus();
  await page.keyboard.press('Enter');
  const picker = page.getByTestId('dish-picker');
  await expect(picker.getByRole('searchbox', { name: 'Find a dish' })).toBeFocused();
  await page.keyboard.type('dal');
  await expect(picker.getByRole('button', { name: /^Add / })).toHaveCount(1);
  await page.keyboard.press('Tab');
  await focused('picker-dal_tadka');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tonight-dal_tadka')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await focused('add-dish');

  // The studio: a clean one closes on Esc; one with changes asks first.
  await page.getByTestId('new-recipe').focus();
  await page.keyboard.press('Enter');
  const studio = page.getByTestId('recipe-studio');
  await focused('studio-text');
  await page.keyboard.press('Escape');
  await expect(studio).toBeHidden();
  await focused('new-recipe');
  await page.getByTestId('customise-jeera_rice').focus();
  await page.keyboard.press('Enter');
  await studio.getByLabel('Step 2 minutes').fill('9');
  await page.keyboard.press('Escape');
  await expect(studio.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Tab');
  await focused('studio-discard');
  await page.keyboard.press('Enter');
  await expect(studio).toBeHidden();
  await focused('customise-jeera_rice');
  await expect(page.getByTestId('tonight-jeera_rice')).toContainText('33 min');

  // Save tonight as a menu, then delete it (Esc keeps it, the button deletes it); it stays gone after a reload.
  await page.getByTestId('save-menu').focus();
  await page.keyboard.press('Enter');
  await focused('save-menu-name');
  await page.keyboard.type('Rice night');
  await page.keyboard.press('Enter');
  await focused('menu-menu_rice_night');
  await expect(page.getByTestId('menu-menu_rice_night')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('menu-delete-menu_rice_night').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await page.keyboard.press('Escape');
  await focused('menu-delete-menu_rice_night');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Delete menu' }).click();
  await expect(page.getByTestId('menu-menu_rice_night')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('menu-indian')).toBeVisible();
  await expect(page.getByTestId('menu-menu_rice_night')).toHaveCount(0);
});

for (const [menu, dishes] of Object.entries(BUILTIN_MENUS)) {
  test(`the ${menu} menu cooks`, async ({ page }) => {
    await open(page);
    await page.getByTestId(`menu-${menu}`).click();
    await expect(page.getByTestId(`menu-${menu}`)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => tonightIds(page)).toEqual(dishes);
    // Every dish shows its own photo, never the fallback plate.
    const photos = page.locator('.tonight-row img.dish-photo');
    await expect(photos).toHaveCount(dishes.length);
    for (const img of await photos.all()) {
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    await page.getByTestId('start-cook-without-voice').click();
    for (const id of dishes) await expect(page.getByTestId(`ticket-${id}`)).toBeVisible();
    await page.keyboard.press('n');
    await expect(page.locator('[data-testid^="ticket-"][data-state="fire"]').first()).toBeVisible();
  });
}

for (const vp of VIEWPORTS) {
  test(`start, studio and kitchen fit ${vp.width}×${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await open(page);
    expect(await pageFit(page)).toEqual({ scroll: 0, overflow: 0 });
    await page.screenshot({ path: `test-results/screens/${vp.width}x${vp.height}-start-3.png` });

    // A fourth dish.
    await page.getByTestId('add-dish').click();
    await page.getByTestId('dish-picker').getByTestId('picker-dal_tadka').click();
    await page.getByTestId('dish-picker').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('dish-picker')).toBeHidden();
    await expect(page.getByTestId('tonight-dal_tadka')).toBeVisible();
    expect(await pageFit(page)).toEqual({ scroll: 0, overflow: 0 });
    await page.screenshot({ path: `test-results/screens/${vp.width}x${vp.height}-start-4.png` });

    // The studio sits inside the viewport; its card scrolls on its own.
    const studioFits = async () => {
      const studio = page.getByTestId('recipe-studio');
      await expect(studio).toBeVisible();
      await page.waitForTimeout(400); // Past the opening animation.
      const box = await studio.evaluate(d => {
        const r = d.getBoundingClientRect();
        const card = d.querySelector('.rc-scroll')!;
        return {
          top: r.top,
          left: r.left,
          bottom: innerHeight - r.bottom,
          right: innerWidth - r.right,
          shifted: d.scrollTop,
          cardScrolls: card.scrollHeight > card.clientHeight,
        };
      });
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeGreaterThanOrEqual(0);
      expect(box.shifted).toBe(0);
      await expect(studio.getByRole('heading', { level: 2 })).toBeInViewport({ ratio: 1 });
      for (const id of ['studio-text', 'studio-save-add', 'studio-save', 'studio-cancel']) await expect(studio.getByTestId(id)).toBeInViewport({ ratio: 1 });
      expect(await pageFit(page)).toEqual({ scroll: 0, overflow: 0 });
      return box;
    };
    const studio = await openStudio(page, 'new');
    await studioFits();
    await page.screenshot({ path: `test-results/screens/${vp.width}x${vp.height}-studio-new.png` });
    await studio.getByTestId('studio-cancel').click();
    await expect(studio).toBeHidden();

    await openStudio(page, { customise: 'garlic_naan' });
    for (let i = 0; i < 6; i++) await studio.getByTestId('studio-add-step').click();
    await expect(studio.getByTestId('studio-step')).toHaveCount(10);
    expect((await studioFits()).cardScrolls).toBe(true);
    await expect(studio.getByTestId('studio-add-step')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/screens/${vp.width}x${vp.height}-studio-long.png` });
    await studio.getByTestId('studio-cancel').click();
    await studio.getByTestId('studio-discard').click();
    await expect(studio).toBeHidden();

    await page.getByTestId('start-cook-without-voice').click();
    await expect(page.getByTestId('ticket-dal_tadka')).toBeVisible();
    await expect(page.getByTestId('rail')).toHaveAttribute('data-lanes', '4');
    await page.keyboard.press('n');
    await page.waitForTimeout(500);
    const kitchen = await page.evaluate(() => {
      const d = document.documentElement;
      const pass = document.querySelector('.pass')!;
      const rail = document.querySelector('[data-testid="rail"]')!.getBoundingClientRect();
      return {
        scroll: d.scrollHeight - innerHeight,
        overflow: d.scrollWidth - d.clientWidth,
        pass: pass.scrollHeight - pass.clientHeight,
        railBelow: Math.max(0, Math.round(rail.bottom - innerHeight)),
      };
    });
    expect(kitchen).toEqual({ scroll: 0, overflow: 0, pass: 0, railBelow: 0 });
    await page.screenshot({ path: `test-results/screens/${vp.width}x${vp.height}-kitchen-4-start.png` });
  });
}
