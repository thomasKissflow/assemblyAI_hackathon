import { describe, it, expect } from 'vitest';
import { menuRecipes } from './recipes';
import { MIN, advance, createPlan, markDone } from './planner';
import { ticketView, ticketSteps, kitchenStatus, FIRE_WINDOW_MS, TICKET_ROWS } from './views';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const SERVE = T0 + 45 * MIN;
const naan = (p: ReturnType<typeof createPlan>) => p.dishes.find(d => d.id === 'garlic_naan')!;

describe('ticketView', () => {
  it('is waiting before the first step, counting down to it', () => {
    const v = ticketView(naan(createPlan(menuRecipes('indian'), SERVE, T0)), T0);
    expect(v.state).toBe('waiting');
    expect(v.remainingMs).toBe(7 * MIN);
    expect(v.stepIndex).toBe(0);
  });
  it('is fire right after a step starts, then cooking', () => {
    const p = advance(createPlan(menuRecipes('indian'), SERVE, T0), T0 + 7 * MIN).plan;
    expect(ticketView(naan(p), T0 + 7 * MIN).state).toBe('fire');
    const later = ticketView(naan(p), T0 + 7 * MIN + FIRE_WINDOW_MS + 1);
    expect(later.state).toBe('cooking');
    expect(later.progress).toBeGreaterThan(0);
  });
  it('is holding between steps when a step finished early', () => {
    const p = markDone(advance(createPlan(menuRecipes('indian'), SERVE, T0), T0 + 7 * MIN).plan, 'garlic_naan', T0 + 9 * MIN);
    const v = ticketView(naan(p), T0 + 9 * MIN);
    expect(v.state).toBe('holding');
    expect(v.next?.id).toBe('rest');
  });
  it('is ready when every step is done', () => {
    const p = advance(createPlan(menuRecipes('indian'), SERVE, T0), SERVE).plan;
    expect(ticketView(naan(p), SERVE).state).toBe('ready');
  });
});

describe('ticketSteps', () => {
  const long = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, label: `Step ${i + 1}`, call: '', minutes: 5, start: i, end: i + 1, status: 'pending' as const }));
  const ids = (w: ReturnType<typeof ticketSteps>) => w.steps.map(s => s.id);

  it('lists every step of a short recipe', () => {
    const w = ticketSteps(long(4), 's2');
    expect(ids(w)).toEqual(['s1', 's2', 's3', 's4']);
    expect(w).toMatchObject({ doneBefore: 0, moreAfter: 0 });
  });
  it('starts a long recipe at the top and summarises the rest', () => {
    const w = ticketSteps(long(12), 's1');
    expect(ids(w)).toEqual(['s1', 's2', 's3', 's4']);
    expect(w).toMatchObject({ doneBefore: 0, moreAfter: 8 });
  });
  it('keeps the step just finished, the current one and the next in view mid-recipe', () => {
    const w = ticketSteps(long(12), 's6');
    expect(ids(w)).toEqual(['s5', 's6', 's7']);
    expect(w).toMatchObject({ doneBefore: 4, moreAfter: 5 });
  });
  it('ends on the last steps, and never lists more than five rows', () => {
    for (const focus of ['s10', 's12', null]) {
      const w = ticketSteps(long(12), focus);
      expect(ids(w)).toEqual(['s9', 's10', 's11', 's12']);
      expect(w.doneBefore).toBe(8);
    }
    for (let i = 1; i <= 12; i++) {
      const w = ticketSteps(long(12), `s${i}`);
      expect(w.steps.length + (w.doneBefore ? 1 : 0) + (w.moreAfter ? 1 : 0)).toBeLessThanOrEqual(TICKET_ROWS);
      expect(ids(w)).toContain(`s${i}`);
    }
  });
});

describe('kitchenStatus', () => {
  it('describes a dinner that has not started', () => {
    expect(kitchenStatus(createPlan(menuRecipes('indian'), SERVE, T0), T0)).toBe(
      'Serving at 8:00 PM. Chicken curry: fry onions, ginger & garlic at 7:25 PM. Jeera rice: rinse & soak rice at 7:27 PM. ' +
      'Garlic naan: mix & knead dough at 7:22 PM. Next call: garlic naan, mix & knead dough at 7:22 PM.',
    );
  });
  it('gives minutes left for cooking dishes', () => {
    const now = T0 + 10 * MIN;
    const s = kitchenStatus(advance(createPlan(menuRecipes('indian'), SERVE, T0), now).plan, now);
    expect(s).toContain('Chicken curry: fry onions, ginger & garlic, 8 min left.');
    expect(s).toContain('Garlic naan: mix & knead dough, 3 min left.');
  });
});
