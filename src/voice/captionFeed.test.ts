import { it, expect } from 'vitest';
import { CaptionFeed } from './captionFeed';

it('tracks Chef words for one reply and the cook live text', () => {
  const f = new CaptionFeed();
  let n = 0;
  f.subscribe(() => { n++; });
  f.chefBegin();
  f.chefStartAt(12.5);
  f.chefStartAt(99);
  f.chefWord({ text: 'Heard. ', startMs: 0, endMs: 300 });
  expect(f.getSnapshot()).toMatchObject({ chefStart: 12.5, chefLive: true });
  expect(f.getSnapshot().chefWords).toHaveLength(1);
  f.chefEnd();
  f.you('how long for the rice', true);
  expect(f.getSnapshot()).toMatchObject({ chefLive: false, you: 'how long for the rice', youLive: true });
  expect(n).toBeGreaterThan(0);
});
