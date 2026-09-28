import { describe, it, expect } from 'vitest';
import { MENUS } from './recipes';
import { MIN, createPlan, advance, reportDelay, shiftServe, restartStep, markDone, upcoming, describeChange, fmtTime } from './planner';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const SERVE = T0 + 45 * MIN;
const dish = (p: ReturnType<typeof createPlan>, id: string) => p.dishes.find(d => d.id === id)!;

describe('planner', () => {
  it('ends every dish exactly at serve time', () => {
    const p = createPlan(MENUS.indian.dishes, SERVE, T0);
    expect(p.serveAt).toBe(SERVE);
    for (const d of p.dishes) expect(d.steps.at(-1)!.end).toBe(SERVE);
    expect(dish(p, 'garlic_naan').steps[0].start).toBe(SERVE - 38 * MIN);
  });

  it('pushes serve time when there is not enough time', () => {
    const p = createPlan(MENUS.indian.dishes, T0 + 20 * MIN, T0);
    expect(p.serveAt).toBe(T0 + 38 * MIN);
    expect(dish(p, 'garlic_naan').steps[0].start).toBe(T0);
  });

  it('advance starts steps and emits each event once', () => {
    const p = createPlan(MENUS.indian.dishes, SERVE, T0);
    const r1 = advance(p, T0 + 7 * MIN);
    expect(r1.events.map(e => e.type)).toEqual(['step-started']);
    const r2 = advance(r1.plan, T0 + 7 * MIN + 1000);
    expect(r2.events).toHaveLength(0);
    expect(r2.plan).toBe(r1.plan);
  });

  it('reportDelay on the bottleneck pushes serve and slides other dishes', () => {
    const curryStart = SERVE - 35 * MIN;
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), curryStart).plan;
    const riceBefore = dish(p, 'jeera_rice').steps[0].start;
    const after = reportDelay(p, 'chicken_curry', 10, curryStart + MIN);
    expect(after.serveAt).toBe(SERVE + 10 * MIN);
    expect(dish(after, 'jeera_rice').steps[0].start).toBe(riceBefore + 10 * MIN);
    expect(dish(after, 'chicken_curry').steps.at(-1)!.end).toBe(after.serveAt);
    expect(describeChange(p, after)).toMatch(/^Serving now 8:10 PM \(was 8:00 PM\)\. /);
  });

  it('shiftServe later slides pending steps; earlier is clamped to what is possible', () => {
    const p = createPlan(MENUS.indian.dishes, SERVE, T0);
    expect(shiftServe(p, 20, T0).serveAt).toBe(SERVE + 20 * MIN);
    expect(shiftServe(p, -30, T0).serveAt).toBe(T0 + 38 * MIN);
  });

  it('restartStep restarts the active step for its full duration', () => {
    const curryStart = SERVE - 35 * MIN;
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), curryStart + 5 * MIN).plan;
    const r = restartStep(p, 'chicken_curry', curryStart + 5 * MIN);
    const base = dish(r, 'chicken_curry').steps[0];
    expect(base.status).toBe('active');
    expect(base.end).toBe(curryStart + 13 * MIN);
    expect(r.serveAt).toBe(SERVE + 5 * MIN);
  });

  it('markDone ends the active step now without moving serve', () => {
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), T0 + 7 * MIN).plan;
    const r = markDone(p, 'garlic_naan', T0 + 10 * MIN);
    expect(dish(r, 'garlic_naan').steps[0].status).toBe('done');
    expect(r.serveAt).toBe(SERVE);
  });

  it('fires the serve event exactly once when everything is done', () => {
    let p = createPlan(MENUS.indian.dishes, SERVE, T0);
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
    const u = upcoming(createPlan(MENUS.indian.dishes, SERVE, T0), T0, 3);
    expect(u.map(c => c.dishId)).toEqual(['garlic_naan', 'chicken_curry', 'jeera_rice']);
    expect(fmtTime(u[0].at)).toBe('7:22 PM');
  });

  it('says so when nothing changed', () => {
    const p = createPlan(MENUS.indian.dishes, SERVE, T0);
    expect(describeChange(p, p)).toBe('No change to the plan.');
  });
});
