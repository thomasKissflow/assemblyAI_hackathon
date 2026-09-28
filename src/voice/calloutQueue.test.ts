import { describe, it, expect } from 'vitest';
import { CALL_TIMEOUT_MS, CalloutQueue } from './calloutQueue';

const idle = { userSpeaking: false, replyInProgress: false, pendingToolResults: 0 };
function setup() {
  const sent: string[] = [];
  return { sent, q: new CalloutQueue(i => sent.push(i)) };
}

describe('CalloutQueue', () => {
  it('waits while the cook is speaking, then merges queued calls', () => {
    const { sent, q } = setup();
    q.push('Rice on.');
    q.push('Naan dough out.');
    q.pump({ ...idle, userSpeaking: true }, 0);
    expect(sent).toHaveLength(0);
    q.pump(idle, 10);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('"Rice on. Naan dough out."');
    expect(q.busy).toBe(true);
  });
  it('never sends during a reply or with tool results pending', () => {
    const { sent, q } = setup();
    q.push('Rice on.');
    q.pump({ ...idle, replyInProgress: true }, 0);
    q.pump({ ...idle, pendingToolResults: 1 }, 0);
    expect(sent).toHaveLength(0);
  });
  it('retries once when the reply had no audio, then gives up', () => {
    const { sent, q } = setup();
    q.push('Rice on.');
    q.pump(idle, 0);
    q.onReplyDone();
    q.pump(idle, 100);
    expect(sent).toHaveLength(2);
    q.onReplyDone();
    q.pump(idle, 200);
    expect(sent).toHaveLength(2);
    expect(q.pending).toBe(0);
  });
  it('clears once audio was heard', () => {
    const { q } = setup();
    q.push('Rice on.');
    q.pump(idle, 0);
    q.onReplyAudio();
    q.onReplyDone();
    expect(q.pending).toBe(0);
    expect(q.busy).toBe(false);
  });
  it('retries once when a call never started', () => {
    const { sent, q } = setup();
    q.push('Rice on.');
    q.pump(idle, 0);
    q.pump(idle, CALL_TIMEOUT_MS + 1);
    expect(sent).toHaveLength(2);
    q.pump(idle, 2 * CALL_TIMEOUT_MS + 2);
    expect(sent).toHaveLength(2);
    expect(q.pending).toBe(0);
  });
});
