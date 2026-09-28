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
