import { it, expect } from 'vitest';
import { PreRoll } from './preroll';

it('keeps a sliding window and returns chunks from a stream time', () => {
  const p = new PreRoll(1000);
  for (let t = 0; t <= 3000; t += 50) p.push(t, String(t));
  expect(p.since(0)[0]).toBe('2000');
  expect(p.since(2900)).toEqual(['2900', '2950', '3000']);
  p.clear();
  expect(p.since(0)).toEqual([]);
});
