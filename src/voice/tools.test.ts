import { BUILTIN_RECIPES, RECIPES, menuRecipes, type Recipe } from '../kitchen/recipes';
import { describe, it, expect } from 'vitest';
import { createKitchenStore, DEFAULT_SPEED } from '../kitchen/store';
import { MIN } from '../kitchen/planner';
import { MAX_DISHES, executeTool } from './tools';

function cooking(minutesIn: number) {
  let real = 0;
  const store = createKitchenStore(() => real);
  store.start(menuRecipes('indian'), 45);
  real += (minutesIn * MIN) / DEFAULT_SPEED;
  store.tick();
  return store;
}
const summary = (r: ReturnType<typeof executeTool>) => {
  if (!r.ok) throw new Error(r.error);
  return r.summary;
};

describe('executeTool', () => {
  it('report_delay re-plans and returns the summary', () => {
    expect(summary(executeTool(cooking(10), 'report_delay', { dish: 'chicken_curry', minutes: 10 }))).toMatch(/^Serving now 8:10 PM/);
  });
  it('accepts JSON-string arguments and defaults minutes to 5', () => {
    expect(summary(executeTool(cooking(10), 'report_delay', '{"dish":"chicken_curry"}'))).toMatch(/^Serving now 8:05 PM/);
  });
  it("rejects dishes that are not on tonight's menu", () => {
    const r = executeTool(cooking(10), 'report_delay', { dish: 'biryani', minutes: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("isn't on tonight's menu");
  });
  it('shift_serve_time moves dinner', () => {
    expect(summary(executeTool(cooking(0), 'shift_serve_time', { minutes: 20 }))).toMatch(/^Serving now 8:20 PM/);
  });
  it('kitchen_status reads the live kitchen', () => {
    expect(summary(executeTool(cooking(0), 'kitchen_status', {}))).toMatch(/^Serving at 8:00 PM\. Chicken curry: fry onions, ginger & garlic at 7:25 PM\./);
  });
  it('reports unknown tools', () => {
    expect(executeTool(cooking(0), 'launch_rocket', {}).ok).toBe(false);
  });
});

describe('add_dish and remove_dish', () => {
  const error = (r: ReturnType<typeof executeTool>) => {
    if (r.ok) throw new Error(`expected an error, got: ${r.summary}`);
    return r.error;
  };

  it('adds a dish from the recipe book and re-plans', () => {
    const store = cooking(10);
    expect(summary(executeTool(store, 'add_dish', { dish: 'dal_tadka' }))).toBe('Added Dal tadka: rinse the dal at 7:32 PM.');
    expect(store.getState().plan!.dishes.map(d => d.id)).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan', 'dal_tadka']);
    expect(store.getState().replans).toBe(1);
  });

  it("resolves the cook's own recipes through the library passed in", () => {
    const mine: Recipe = { ...RECIPES.roti, id: 'my_roti', name: "Nani's roti", custom: true };
    const store = cooking(0);
    expect(error(executeTool(store, 'add_dish', { dish: 'my_roti' }))).toContain('not in your recipe book');
    expect(summary(executeTool(store, 'add_dish', { dish: 'my_roti' }, [...BUILTIN_RECIPES, mine]))).toMatch(/^Added Nani's roti: /);
  });

  it("treats a recipe and the cook's version of it as one dish", () => {
    const mine: Recipe = { ...RECIPES.jeera_rice, id: 'my_jeera_rice', custom: true, basedOn: 'jeera_rice' };
    const book = [...BUILTIN_RECIPES, mine];
    const withMine = createKitchenStore();
    withMine.start([RECIPES.chicken_curry, mine], 45);
    expect(error(executeTool(withMine, 'add_dish', { dish: 'jeera_rice' }, book))).toBe("Jeera rice is already on tonight's menu (your version).");
    expect(error(executeTool(cooking(0), 'add_dish', { dish: 'my_jeera_rice' }, book))).toBe("Jeera rice is already on tonight's menu (Chef's version).");
  });

  it('accepts the dish name when the model sends it instead of the id', () => {
    expect(summary(executeTool(cooking(0), 'add_dish', { dish: 'Aloo Gobi' }))).toMatch(/^Added Aloo gobi: /);
  });

  it('refuses dishes outside the book, and dishes already on tonight', () => {
    const store = cooking(0);
    expect(error(executeTool(store, 'add_dish', { dish: 'biryani' }))).toContain('not in your recipe book');
    expect(error(executeTool(store, 'add_dish', {}))).toContain('not in your recipe book');
    expect(error(executeTool(store, 'add_dish', { dish: 'jeera_rice' }))).toBe("Jeera rice is already on tonight's menu.");
    expect(store.getState().replans).toBe(0);
  });

  it(`stops at ${MAX_DISHES} dishes`, () => {
    const store = cooking(0);
    for (const id of ['dal_tadka', 'roti', 'aloo_gobi']) summary(executeTool(store, 'add_dish', { dish: id }));
    expect(error(executeTool(store, 'add_dish', { dish: 'salmon' }))).toMatch(/pass is full/);
    expect(store.getState().plan!.dishes).toHaveLength(MAX_DISHES);
  });

  it("drops one of tonight's dishes, but never the last", () => {
    const store = cooking(0);
    expect(summary(executeTool(store, 'remove_dish', { dish: 'garlic_naan' }))).toBe('Dropped Garlic naan.');
    expect(summary(executeTool(store, 'remove_dish', '{"dish":"jeera_rice"}'))).toBe('Dropped Jeera rice.');
    expect(error(executeTool(store, 'remove_dish', { dish: 'chicken_curry' }))).toContain("can't drop the last dish");
    expect(store.getState().plan!.dishes.map(d => d.id)).toEqual(['chicken_curry']);
  });

  it("refuses to drop a dish that isn't on tonight", () => {
    expect(error(executeTool(cooking(0), 'remove_dish', { dish: 'salmon' }))).toContain("isn't on tonight's menu");
  });

  it('lets the other tools use a dish added tonight', () => {
    const store = cooking(10);
    summary(executeTool(store, 'add_dish', { dish: 'dal_tadka' }));
    expect(summary(executeTool(store, 'report_delay', { dish: 'dal_tadka', minutes: 10 }))).toMatch(/^Serving now 8:03 PM .*Dal tadka: rinse the dal at 7:25 PM\.$/);
  });

  it('shrugs off odd arguments from the model instead of throwing', () => {
    const store = cooking(10);
    expect(error(executeTool(store, 'add_dish', 'null'))).toContain('not in your recipe book');
    expect(error(executeTool(store, 'add_dish', { dish: 42 }))).toContain('not in your recipe book');
    expect(error(executeTool(store, 'add_dish', '["dal_tadka"]'))).toContain('not in your recipe book');
    expect(error(executeTool(store, 'report_delay', 'null'))).toContain("isn't on tonight's menu");
    expect(error(executeTool(store, 'remove_dish', 7))).toContain("isn't on tonight's menu");
    expect(store.getState().replans).toBe(0);
  });

  it('trims the dish, and finds a book dish by the word the cook uses when only one dish goes by it', () => {
    const store = cooking(10);
    expect(summary(executeTool(store, 'add_dish', { dish: ' dal_tadka ' }))).toMatch(/^Added Dal tadka: /);
    expect(summary(executeTool(store, 'report_delay', { dish: ' chicken_curry ', minutes: 5 }))).toMatch(/^Serving now/);
    expect(summary(executeTool(store, 'add_dish', { dish: 'Gobi' }))).toMatch(/^Added Aloo gobi: /);
    const twoDals: Recipe[] = [...BUILTIN_RECIPES, { ...RECIPES.roti, id: 'my_moong', name: 'Moong dal', short: 'dal', custom: true }];
    expect(error(executeTool(cooking(0), 'add_dish', { dish: 'dal' }, twoDals))).toContain('not in your recipe book');
  });

  it('adds back a dish dropped earlier tonight', () => {
    const store = cooking(0);
    summary(executeTool(store, 'remove_dish', { dish: 'garlic_naan' }));
    expect(summary(executeTool(store, 'add_dish', { dish: 'garlic_naan' }))).toMatch(/^Added Garlic naan: mix & knead dough at /);
    expect(store.getState().plan!.dishes.map(d => d.id)).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
  });
});
