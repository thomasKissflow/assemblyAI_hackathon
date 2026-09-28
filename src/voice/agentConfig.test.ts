import { describe, it, expect } from 'vitest';
import { MENUS } from '../kitchen/recipes';
import { MIN, createPlan } from '../kitchen/planner';
import { buildSession, sttKeyterms } from './agentConfig';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const plan = createPlan(MENUS.indian.dishes, T0 + 45 * MIN, T0);

describe('buildSession', () => {
  const s = buildSession(plan);
  it("states tonight's plan and leaves the greeting to the app", () => {
    expect(s.greeting).toBeUndefined();
    expect(s.system_prompt).toContain('Tonight: chicken curry, jeera rice and garlic naan. Serving at 8:00 PM.');
  });
  it('carries the conversation rules and guardrails', () => {
    expect(s.system_prompt).toContain('Not my station');
    expect(s.system_prompt).toMatch(/never say "hey chef" yourself/i);
    expect(s.system_prompt).toContain('drop what you were saying');
  });
  it("exposes the five kitchen tools with tonight's dishes as an enum", () => {
    expect(s.tools.map(t => t.name)).toEqual(['report_delay', 'shift_serve_time', 'restart_step', 'mark_done', 'kitchen_status']);
    const params = s.tools[0].parameters as { properties: { dish: { enum: string[] } } };
    expect(params.properties.dish.enum).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
  });
  it('biases recognition and uses snappy turn detection', () => {
    expect(s.input?.keyterms).toEqual(expect.arrayContaining(['Hey Chef', 'Heard', 'naan', 'Jeera rice']));
    expect(s.input?.turn_detection?.min_silence).toBe(500);
  });
});

it('gives the STT the wake phrase and dish names as keyterms', () => {
  expect(sttKeyterms(plan)).toEqual(expect.arrayContaining(['Hey Chef', 'Chef', 'Garlic naan']));
});
