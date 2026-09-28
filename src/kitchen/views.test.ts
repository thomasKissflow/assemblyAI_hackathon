import { describe, it, expect } from 'vitest';
import { MENUS } from './recipes';
import { MIN, advance, createPlan, markDone } from './planner';
import { ticketView, kitchenStatus, FIRE_WINDOW_MS } from './views';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const SERVE = T0 + 45 * MIN;
const naan = (p: ReturnType<typeof createPlan>) => p.dishes.find(d => d.id === 'garlic_naan')!;

describe('ticketView', () => {
  it('is waiting before the first step, counting down to it', () => {
    const v = ticketView(naan(createPlan(MENUS.indian.dishes, SERVE, T0)), T0);
    expect(v.state).toBe('waiting');
    expect(v.remainingMs).toBe(7 * MIN);
    expect(v.stepIndex).toBe(0);
  });
  it('is fire right after a step starts, then cooking', () => {
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), T0 + 7 * MIN).plan;
    expect(ticketView(naan(p), T0 + 7 * MIN).state).toBe('fire');
    const later = ticketView(naan(p), T0 + 7 * MIN + FIRE_WINDOW_MS + 1);
    expect(later.state).toBe('cooking');
    expect(later.progress).toBeGreaterThan(0);
  });
  it('is holding between steps when a step finished early', () => {
    const p = markDone(advance(createPlan(MENUS.indian.dishes, SERVE, T0), T0 + 7 * MIN).plan, 'garlic_naan', T0 + 9 * MIN);
    const v = ticketView(naan(p), T0 + 9 * MIN);
    expect(v.state).toBe('holding');
    expect(v.next?.id).toBe('rest');
  });
  it('is ready when every step is done', () => {
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), SERVE).plan;
    expect(ticketView(naan(p), SERVE).state).toBe('ready');
  });
});

describe('kitchenStatus', () => {
  it('describes a dinner that has not started', () => {
    expect(kitchenStatus(createPlan(MENUS.indian.dishes, SERVE, T0), T0)).toBe(
      'Serving at 8:00 PM. Chicken curry: fry onions, ginger & garlic at 7:25 PM. Jeera rice: rinse & soak rice at 7:27 PM. ' +
      'Garlic naan: mix & knead dough at 7:22 PM. Next call: garlic naan, mix & knead dough at 7:22 PM.',
    );
  });
  it('gives minutes left for cooking dishes', () => {
    const now = T0 + 10 * MIN;
    const s = kitchenStatus(advance(createPlan(MENUS.indian.dishes, SERVE, T0), now).plan, now);
    expect(s).toContain('Chicken curry: fry onions, ginger & garlic, 8 min left.');
    expect(s).toContain('Garlic naan: mix & knead dough, 3 min left.');
  });
});
