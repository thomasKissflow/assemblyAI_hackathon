import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentError } from './agentSocket';
import { SttSocket, type SttTurn } from './sttSocket';

class FakeWS {
  static readonly OPEN = 1;
  static last: FakeWS;
  readonly url: string;
  readyState = 1;
  binaryType = '';
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeWS.last = this;
  }
  send() {}
  close() {}
  msg(d: object) { this.onmessage?.({ data: JSON.stringify(d) }); }
  closeWith(code: number) { this.onclose?.({ code }); }
}

beforeEach(() => vi.stubGlobal('WebSocket', FakeWS));
afterEach(() => vi.unstubAllGlobals());

const param = (name: string) => new URL(FakeWS.last.url).searchParams.get(name);

describe('SttSocket', () => {
  it('keeps raw turns for the wake word by default, and asks for formatted turns for dictation', async () => {
    const wake = new SttSocket();
    const p = wake.connect('k', ['Hey Chef']);
    expect(param('format_turns')).toBe('false');
    expect(param('keyterms_prompt')).toBe('["Hey Chef"]');
    FakeWS.last.msg({ type: 'Begin' });
    await p;

    const dictation = new SttSocket();
    const q = dictation.connect('k', ['jeera'], { formatTurns: true });
    expect(param('format_turns')).toBe('true');
    FakeWS.last.msg({ type: 'Begin' });
    await q;
  });

  it('reports each turn with its formatted flag', async () => {
    const s = new SttSocket();
    const turns: SttTurn[] = [];
    s.onTurn(t => turns.push(t));
    const p = s.connect('k', [], { formatTurns: true });
    FakeWS.last.msg({ type: 'Begin' });
    await p;
    FakeWS.last.msg({ type: 'Turn', transcript: 'rinse the', end_of_turn: false, turn_is_formatted: false, words: [{ text: 'rinse', start: 0, end: 200 }, { text: 'the', start: 200, end: 300 }] });
    FakeWS.last.msg({ type: 'Turn', transcript: 'Rinse the dal.', end_of_turn: true, turn_is_formatted: true, words: [] });
    expect(turns.map(t => [t.transcript, t.endOfTurn, t.formatted])).toEqual([['rinse the', false, false], ['Rinse the dal.', true, true]]);
    expect(turns[0].words[1]).toEqual({ text: 'the', start: 200, end: 300 });
  });

  it('carries the turn order when the service sends one', async () => {
    const s = new SttSocket();
    const turns: SttTurn[] = [];
    s.onTurn(t => turns.push(t));
    const p = s.connect('k', [], { formatTurns: true });
    FakeWS.last.msg({ type: 'Begin' });
    await p;
    FakeWS.last.msg({ type: 'Turn', turn_order: 2, transcript: 'Add the jeera.', end_of_turn: true, turn_is_formatted: true, words: [] });
    FakeWS.last.msg({ type: 'Turn', transcript: 'x', end_of_turn: false, words: [] });
    expect(turns[0].order).toBe(2);
    expect('order' in turns[1]).toBe(false);
  });

  it('turns a rejected key into an unauthorized error', async () => {
    const s = new SttSocket();
    const p = s.connect('bad', []);
    FakeWS.last.msg({ type: 'Error', error_code: 1008, error: 'Unauthorized Connection: Invalid API key' });
    FakeWS.last.closeWith(1008);
    await expect(p).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(p).rejects.toBeInstanceOf(AgentError);
  });

  it('any other early close is a plain connection error', async () => {
    const s = new SttSocket();
    const p = s.connect('k', []);
    FakeWS.last.closeWith(1006);
    await expect(p).rejects.toMatchObject({ code: 'closed' });
  });
});
