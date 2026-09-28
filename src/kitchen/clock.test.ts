import { describe, it, expect } from 'vitest';
import { createClock, kitchenNow, withSpeed, withPaused, jumpTo } from './clock';

describe('kitchen clock', () => {
  it('runs at its speed', () => {
    expect(kitchenNow(createClock(1000, 0, 30), 100)).toBe(1000 + 3000);
  });
  it('pausing freezes time and resuming continues from there', () => {
    const paused = withPaused(createClock(0, 0, 30), true, 100);
    expect(kitchenNow(paused, 5000)).toBe(3000);
    const resumed = withPaused(paused, false, 5000);
    expect(kitchenNow(resumed, 5100)).toBe(6000);
  });
  it('changing speed keeps time continuous', () => {
    const c = withSpeed(createClock(0, 0, 30), 1, 100);
    expect(kitchenNow(c, 100)).toBe(3000);
    expect(kitchenNow(c, 200)).toBe(3100);
  });
  it('jumpTo sets kitchen time, even while paused', () => {
    expect(kitchenNow(jumpTo(createClock(0, 0, 30), 50_000, 10), 10)).toBe(50_000);
    const paused = withPaused(createClock(0, 0, 30), true, 0);
    expect(kitchenNow(jumpTo(paused, 90_000, 5), 9999)).toBe(90_000);
  });
});
