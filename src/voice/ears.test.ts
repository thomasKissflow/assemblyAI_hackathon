import { describe, it, expect } from 'vitest';
import { Ears, FOLLOWUP_MS, WAKE_IDLE_MS } from './ears';

describe('Ears', () => {
  it('starts asleep; wake opens; idle closes', () => {
    const e = new Ears();
    expect(e.open).toBe(false);
    e.wake(0);
    expect(e.open).toBe(true);
    e.tick(WAKE_IDLE_MS + 1);
    expect(e.open).toBe(false);
  });
  it('speech extends; a Chef reply holds open; then a follow-up window', () => {
    const e = new Ears();
    e.wake(0);
    e.userSpeaking(5000);
    e.tick(10_000);
    expect(e.open).toBe(true);
    e.chefReplyStarted();
    e.tick(60_000);
    expect(e.open).toBe(true);
    e.chefReplyDone(60_000);
    expect(e.state).toBe('followup');
    e.tick(60_000 + FOLLOWUP_MS - 1);
    expect(e.open).toBe(true);
    e.tick(60_000 + FOLLOWUP_MS + 1);
    expect(e.open).toBe(false);
  });
  it('callouts while asleep do not open the ears', () => {
    const e = new Ears();
    e.chefReplyStarted();
    e.chefReplyDone(0);
    expect(e.open).toBe(false);
  });
  it('push-to-talk opens while held, then idles', () => {
    const e = new Ears();
    e.setPushToTalk(true, 0);
    e.tick(99_999);
    expect(e.open).toBe(true);
    e.setPushToTalk(false, 100_000);
    e.tick(100_000 + WAKE_IDLE_MS + 1);
    expect(e.open).toBe(false);
  });
});
