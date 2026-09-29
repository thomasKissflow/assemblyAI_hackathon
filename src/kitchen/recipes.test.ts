import { describe, it, expect } from 'vitest';
import { BUILTIN_MENUS, BUILTIN_RECIPES, DISH_KINDS, MENUS, RECIPES, menuRecipes } from './recipes';

describe('built-in recipes', () => {
  it('has twelve dishes with unique ids, photos and kinds', () => {
    expect(BUILTIN_RECIPES).toHaveLength(12);
    expect(new Set(BUILTIN_RECIPES.map(r => r.id)).size).toBe(12);
    for (const r of BUILTIN_RECIPES) {
      expect(r.photo).toBe(`/dishes/${r.id}.jpg`);
      expect(DISH_KINDS).toContain(r.kind);
      expect(r.custom).toBeUndefined();
    }
  });

  it('gives every dish 5 to 9 ingredients for Chef to answer from', () => {
    for (const r of BUILTIN_RECIPES) {
      expect(r.ingredients?.length, r.id).toBeGreaterThanOrEqual(5);
      expect(r.ingredients?.length, r.id).toBeLessThanOrEqual(9);
    }
  });

  it('keeps step ids unique within a dish and minutes positive', () => {
    for (const r of BUILTIN_RECIPES) {
      expect(new Set(r.steps.map(s => s.id)).size, r.id).toBe(r.steps.length);
      for (const s of r.steps) expect(s.minutes).toBeGreaterThan(0);
    }
  });

  it('lists the menus in order, each pointing at real dishes', () => {
    expect(BUILTIN_MENUS.map(m => [m.id, m.label])).toEqual([
      ['indian', 'Indian dinner'], ['western', 'Western dinner'], ['pasta', 'Weeknight pasta'], ['veg', 'Dal & roti night'],
    ]);
    for (const m of BUILTIN_MENUS) for (const d of m.dishes) expect(RECIPES[d], d).toBeDefined();
    expect(menuRecipes('veg').map(r => r.short)).toEqual(['dal', 'gobi', 'roti']);
    expect(menuRecipes('pasta').map(r => r.name)).toEqual(['Spaghetti pomodoro', 'Garlic bread', 'Green salad']);
    expect(MENUS.pasta.dishes).toEqual(['tomato_pasta', 'garlic_bread', 'green_salad']);
  });

  it('keeps the new dishes timed as written', () => {
    const total = (id: string) => RECIPES[id].steps.reduce((a, s) => a + s.minutes, 0);
    expect([total('tomato_pasta'), total('garlic_bread'), total('green_salad')]).toEqual([30, 19, 10]);
    expect([total('dal_tadka'), total('aloo_gobi'), total('roti')]).toEqual([28, 30, 30]);
  });
});
