import { describe, it, expect } from 'vitest';
import { MENUS } from './recipes';
import { MIN, createPlan } from './planner';
import { callText, greetingText, SERVICE_CALL } from './calls';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();

describe('calls', () => {
  const plan = createPlan(MENUS.indian.dishes, T0 + 45 * MIN, T0);
  it('greets with the menu, serve time and first call, without saying the wake phrase', () => {
    const g = greetingText(plan, T0);
    expect(g).toBe('Evening. Chicken curry, jeera rice and garlic naan, serving at 8:00 PM. First up, the garlic naan at 7:22 PM.');
    expect(g.toLowerCase()).not.toContain('chef');
  });
  it('turns kitchen events into calls', () => {
    const step = plan.dishes[2].steps[0];
    expect(callText({ type: 'step-started', dishId: 'garlic_naan', step })).toBe('Naan. Mix and knead the dough.');
    expect(callText({ type: 'serve' })).toBe(SERVICE_CALL);
    expect(callText({ type: 'step-done', dishId: 'garlic_naan', step })).toBeNull();
  });
});
