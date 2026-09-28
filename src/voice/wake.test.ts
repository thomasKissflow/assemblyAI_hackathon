import { describe, it, expect } from 'vitest';
import { findWake, stripWake } from './wake';

const W = (s: string) => s.split(' ').map((text, i) => ({ text, start: 1000 + i * 300, end: 1250 + i * 300 }));

describe('findWake', () => {
  it('finds "hey chef" mid-stream and returns the start of "hey" plus the question', () => {
    expect(findWake(W('so the onions are fine hey chef how long for the rice'))).toEqual({ at: 1000 + 5 * 300, question: 'how long for the rice' });
  });
  it('accepts a bare "chef" only as the first word', () => {
    expect(findWake(W('chef how long'))?.at).toBe(1000);
    expect(findWake(W('the chef said so'))).toBeNull();
  });
  it('needs a greeting for sound-alikes', () => {
    expect(findWake(W('hey jeff what next'))?.question).toBe('what next');
    expect(findWake(W('jeff pass the salt'))).toBeNull();
  });
  it('ignores punctuation and case', () => {
    expect(findWake([{ text: 'Hey,', start: 0, end: 100 }, { text: 'Chef.', start: 120, end: 300 }])).not.toBeNull();
  });
});

describe('stripWake', () => {
  it('removes a leading wake phrase', () => {
    expect(stripWake('Hey Chef, how long for the rice?')).toBe('how long for the rice?');
    expect(stripWake('hey chef how long')).toBe('how long');
    expect(stripWake('Chef, stop.')).toBe('stop.');
  });
  it('removes every sound-alike wake phrase that findWake accepts', () => {
    for (const phrase of ['Hey Chevy,', 'hey sheff', 'Hey chefs,', "Okay chef's,"]) {
      const line = `${phrase} how long for the rice?`;
      expect(findWake(W(line))).not.toBeNull();
      expect(stripWake(line)).toBe('how long for the rice?');
    }
  });
  it('leaves other text alone', () => {
    expect(stripWake('the curry needs ten more minutes')).toBe('the curry needs ten more minutes');
  });
});
