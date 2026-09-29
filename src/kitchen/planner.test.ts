import { describe, it, expect } from 'vitest';
import { RECIPES, menuRecipes, type Recipe } from './recipes';
import {
  MIN, createPlan, advance, reportDelay, shiftServe, restartStep, markDone, upcoming, describeChange, fmtTime, addDish, removeDish,
} from './planner';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const SERVE = T0 + 45 * MIN;
const dish = (p: ReturnType<typeof createPlan>, id: string) => p.dishes.find(d => d.id === id)!;

describe('planner', () => {
  it('ends every dish exactly at serve time', () => {
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    expect(p.serveAt).toBe(SERVE);
    for (const d of p.dishes) expect(d.steps.at(-1)!.end).toBe(SERVE);
    expect(dish(p, 'garlic_naan').steps[0].start).toBe(SERVE - 38 * MIN);
  });

  it('pushes serve time when there is not enough time', () => {
    const p = createPlan(menuRecipes('indian'), T0 + 20 * MIN, T0);
    expect(p.serveAt).toBe(T0 + 38 * MIN);
    expect(dish(p, 'garlic_naan').steps[0].start).toBe(T0);
  });

  it('advance starts steps and emits each event once', () => {
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    const r1 = advance(p, T0 + 7 * MIN);
    expect(r1.events.map(e => e.type)).toEqual(['step-started']);
    const r2 = advance(r1.plan, T0 + 7 * MIN + 1000);
    expect(r2.events).toHaveLength(0);
    expect(r2.plan).toBe(r1.plan);
  });

  it('reportDelay on the bottleneck pushes serve and slides other dishes', () => {
    const curryStart = SERVE - 35 * MIN;
    const p = advance(createPlan(menuRecipes('indian'), SERVE, T0), curryStart).plan;
    const riceBefore = dish(p, 'jeera_rice').steps[0].start;
    const after = reportDelay(p, 'chicken_curry', 10, curryStart + MIN);
    expect(after.serveAt).toBe(SERVE + 10 * MIN);
    expect(dish(after, 'jeera_rice').steps[0].start).toBe(riceBefore + 10 * MIN);
    expect(dish(after, 'chicken_curry').steps.at(-1)!.end).toBe(after.serveAt);
    expect(describeChange(p, after)).toMatch(/^Serving now 8:10 PM \(was 8:00 PM\)\. /);
  });

  it('shiftServe later slides pending steps; earlier is clamped to what is possible', () => {
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    expect(shiftServe(p, 20, T0).serveAt).toBe(SERVE + 20 * MIN);
    expect(shiftServe(p, -30, T0).serveAt).toBe(T0 + 38 * MIN);
  });

  it('restartStep restarts the active step for its full duration', () => {
    const curryStart = SERVE - 35 * MIN;
    const p = advance(createPlan(menuRecipes('indian'), SERVE, T0), curryStart + 5 * MIN).plan;
    const r = restartStep(p, 'chicken_curry', curryStart + 5 * MIN);
    const base = dish(r, 'chicken_curry').steps[0];
    expect(base.status).toBe('active');
    expect(base.end).toBe(curryStart + 13 * MIN);
    expect(r.serveAt).toBe(SERVE + 5 * MIN);
  });

  it('markDone ends the active step now without moving serve', () => {
    const p = advance(createPlan(menuRecipes('indian'), SERVE, T0), T0 + 7 * MIN).plan;
    const r = markDone(p, 'garlic_naan', T0 + 10 * MIN);
    expect(dish(r, 'garlic_naan').steps[0].status).toBe('done');
    expect(r.serveAt).toBe(SERVE);
  });

  it('fires the serve event exactly once when everything is done', () => {
    let p = createPlan(menuRecipes('indian'), SERVE, T0);
    const types: string[] = [];
    for (let t = T0; t <= SERVE + MIN; t += 30_000) {
      const r = advance(p, t);
      p = r.plan;
      types.push(...r.events.map(e => e.type));
    }
    expect(types.filter(t => t === 'serve')).toHaveLength(1);
    expect(types.filter(t => t === 'step-started')).toHaveLength(11);
  });

  it('lists upcoming calls in time order', () => {
    const u = upcoming(createPlan(menuRecipes('indian'), SERVE, T0), T0, 3);
    expect(u.map(c => c.dishId)).toEqual(['garlic_naan', 'chicken_curry', 'jeera_rice']);
    expect(fmtTime(u[0].at)).toBe('7:22 PM');
  });

  it('says so when nothing changed', () => {
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    expect(describeChange(p, p)).toBe('No change to the plan.');
  });
});

describe('adding and dropping dishes', () => {
  const at = (p: ReturnType<typeof createPlan>, t: number) => advance(p, t).plan;

  it('adds a dish timed to finish with the rest, without moving serve', () => {
    const p = at(createPlan(menuRecipes('indian'), SERVE, T0), T0 + 10 * MIN);
    const r = addDish(p, RECIPES.dal_tadka, T0 + 10 * MIN);
    expect(r.serveAt).toBe(SERVE);
    expect(r.dishes.map(d => d.id)).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan', 'dal_tadka']);
    const d = dish(r, 'dal_tadka');
    expect(d.steps.every(st => st.status === 'pending')).toBe(true);
    expect(d.steps.at(-1)!.end).toBe(SERVE);
    expect(d.steps[0].start).toBe(SERVE - 28 * MIN);
    expect(dish(r, 'garlic_naan')).toEqual(dish(p, 'garlic_naan'));
    expect(describeChange(p, r)).toBe('Added Dal tadka: rinse the dal at 7:32 PM.');
  });

  it('pushes serve later when the new dish needs more time than is left', () => {
    const now = T0 + 20 * MIN;
    const p = at(createPlan(menuRecipes('indian'), SERVE, T0), now);
    const r = addDish(p, RECIPES.aloo_gobi, now);
    expect(r.serveAt).toBe(now + 30 * MIN);
    expect(dish(r, 'aloo_gobi').steps[0].start).toBe(now);
    for (const d of r.dishes) expect(d.steps.at(-1)!.end).toBe(r.serveAt);
    expect(describeChange(p, r)).toMatch(/^Added Aloo gobi: chop potato & cauliflower at 7:35 PM\. Serving now 8:05 PM \(was 8:00 PM\)\. /);
  });

  it('does nothing when the dish is already on the plan', () => {
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    expect(addDish(p, RECIPES.jeera_rice, T0)).toBe(p);
  });

  it('carries ingredients and the custom flag onto the plan', () => {
    const mine = { ...RECIPES.roti, id: 'my_roti', name: 'My roti', custom: true };
    const r = addDish(createPlan(menuRecipes('indian'), SERVE, T0), mine, T0);
    expect(dish(r, 'my_roti')).toMatchObject({ custom: true, ingredients: RECIPES.roti.ingredients });
  });

  it('drops a dish without pulling serve earlier', () => {
    const p = createPlan(menuRecipes('indian'), T0 + 20 * MIN, T0);
    expect(p.serveAt).toBe(T0 + 38 * MIN);
    const r = removeDish(p, 'garlic_naan', T0);
    expect(r.dishes.map(d => d.id)).toEqual(['chicken_curry', 'jeera_rice']);
    expect(r.serveAt).toBe(p.serveAt);
    expect(describeChange(p, r)).toBe('Dropped Garlic naan.');
  });

  it('can drop a dish that is already cooking', () => {
    const p = at(createPlan(menuRecipes('indian'), SERVE, T0), T0 + 10 * MIN);
    expect(dish(p, 'garlic_naan').steps[0].status).toBe('active');
    expect(removeDish(p, 'garlic_naan', T0 + 10 * MIN).dishes.map(d => d.id)).toEqual(['chicken_curry', 'jeera_rice']);
  });

  it("refuses to drop the last dish or one that isn't on the plan", () => {
    const one = createPlan([RECIPES.salmon], SERVE, T0);
    expect(removeDish(one, 'salmon', T0)).toBe(one);
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    expect(removeDish(p, 'salmon', T0)).toBe(p);
  });

  it('describes a swap: added first, then dropped', () => {
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    const r = removeDish(addDish(p, RECIPES.roti, T0), 'garlic_naan', T0);
    expect(describeChange(p, r)).toBe('Added Roti: knead the dough at 7:30 PM. Dropped Garlic naan.');
  });

  it('ignores a recipe with no steps', () => {
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    const empty: Recipe = { ...RECIPES.roti, id: 'my_empty', name: 'Empty', steps: [] };
    expect(addDish(p, empty, T0)).toBe(p);
  });

  it('never changes the recipe it cooks from', () => {
    const before = structuredClone(RECIPES.dal_tadka);
    let p = addDish(createPlan(menuRecipes('indian'), SERVE, T0), RECIPES.dal_tadka, T0);
    expect(dish(p, 'dal_tadka').ingredients).not.toBe(RECIPES.dal_tadka.ingredients);
    p = advance(p, T0 + 20 * MIN).plan;
    p = reportDelay(p, 'dal_tadka', 10, T0 + 20 * MIN);
    p = markDone(restartStep(p, 'dal_tadka', T0 + 21 * MIN), 'dal_tadka', T0 + 22 * MIN);
    dish(p, 'dal_tadka').ingredients!.push('extra chilli');
    expect(RECIPES.dal_tadka).toEqual(before);
  });

  it('re-adds a dish that was dropped earlier', () => {
    const p = createPlan(menuRecipes('indian'), SERVE, T0);
    const r = addDish(removeDish(p, 'garlic_naan', T0), RECIPES.garlic_naan, T0);
    expect(r.dishes.map(d => d.id)).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
    expect(dish(r, 'garlic_naan')).toEqual(dish(p, 'garlic_naan'));
  });

  it('describes an add that pushes serving and moves the other dishes, in order', () => {
    const now = T0 + 20 * MIN;
    const p = advance(createPlan(menuRecipes('indian'), SERVE, T0), now).plan;
    const r = removeDish(addDish(p, RECIPES.aloo_gobi, now), 'garlic_naan', now);
    expect(describeChange(p, r)).toBe(
      'Added Aloo gobi: chop potato & cauliflower at 7:35 PM. Dropped Garlic naan. Serving now 8:05 PM (was 8:00 PM). '
      + 'Chicken curry: simmer with tomatoes at 7:45 PM. Jeera rice: cumin in ghee, add rice & water at 7:42 PM.',
    );
  });
});
