import { it, expect } from 'vitest';
import { mmss, shortDuration } from './format';

it('formats kitchen milliseconds as m:ss', () => {
  expect(mmss(125_000)).toBe('2:05');
  expect(mmss(0)).toBe('0:00');
  expect(mmss(-5)).toBe('0:00');
});

it('reads minutes at a glance and seconds only in the last minute', () => {
  expect(shortDuration(7 * 60_000)).toBe('7 min');
  expect(shortDuration(6 * 60_000 + 1)).toBe('7 min');
  expect(shortDuration(45_000)).toBe('0:45');
});
