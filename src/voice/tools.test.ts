import { describe, it, expect } from 'vitest';
import { createKitchenStore, DEFAULT_SPEED } from '../kitchen/store';
import { MIN } from '../kitchen/planner';
import { executeTool } from './tools';

function cooking(minutesIn: number) {
  let real = 0;
  const store = createKitchenStore(() => real);
  store.start('indian', 45);
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
