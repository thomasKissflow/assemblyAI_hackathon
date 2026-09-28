import { it, expect } from 'vitest';
import { splitCaption } from './captions';

it('splits caption words into spoken and upcoming by elapsed audio time', () => {
  const words = [
    { text: 'Heard. ', startMs: 0, endMs: 300 },
    { text: 'Serving ', startMs: 400, endMs: 700 },
    { text: 'eight ten.', startMs: 800, endMs: 1200 },
  ];
  expect(splitCaption(words, 500)).toEqual({ spoken: 'Heard. Serving', upcoming: 'eight ten.' });
  expect(splitCaption(words, -1)).toEqual({ spoken: '', upcoming: 'Heard. Serving eight ten.' });
});

it('spaces words the agent sends without trailing spaces', () => {
  const words = ['at ', '8:00', 'PM.', 'First', 'up,'].map((text, i) => ({ text, startMs: i * 100, endMs: i * 100 + 90 }));
  expect(splitCaption(words, 1000).spoken).toBe('at 8:00 PM. First up,');
});
