// @vitest-environment jsdom
// Drives useDictation with a fake mic and listener, so no key, mic or network is needed.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SttTurn } from './sttSocket';

const h = vi.hoisted(() => {
  vi.stubEnv('VITE_ASSEMBLYAI_API_KEY', 'test-key');
  return {
    engines: [] as { onChunk: ((c: Int16Array) => void) | null; close: ReturnType<typeof vi.fn> }[],
    stts: [] as { turn: (t: SttTurn) => void; closed: () => void; connect: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; sendPcm: ReturnType<typeof vi.fn> }[],
    startMic: null as null | (() => Promise<void>),
    connect: null as null | ((self: { closed: () => void }) => Promise<void>),
  };
});

vi.mock('./audio', () => ({
  SAMPLE_RATE: 24000,
  AudioEngine: class {
    onChunk: ((c: Int16Array) => void) | null = null;
    close = vi.fn(async () => {});
    levels = () => ({ mic: 0.25, out: 0 });
    startMic = vi.fn(async (onChunk: (c: Int16Array) => void) => {
      this.onChunk = onChunk;
      if (h.startMic) await h.startMic();
    });
    constructor() { h.engines.push(this); }
  },
}));
vi.mock('./sttSocket', () => ({
  STT_WS_URL: 'x',
  SttSocket: class {
    private turnFns: ((t: SttTurn) => void)[] = [];
    private closeFns: (() => void)[] = [];
    onTurn(fn: (t: SttTurn) => void) { this.turnFns.push(fn); return () => {}; }
    onClosed(fn: () => void) { this.closeFns.push(fn); return () => {}; }
    connect = vi.fn(() => (h.connect ? h.connect(this) : Promise.resolve()));
    sendPcm = vi.fn(() => true);
    close = vi.fn();
    turn(t: SttTurn) { this.turnFns.forEach(f => f(t)); }
    closed() { this.closeFns.forEach(f => f()); }
    constructor() { h.stts.push(this); }
  },
}));

import { AgentError } from './agentSocket';
import { DictationBuffer, useDictation } from './dictation';

const turn = (transcript: string, endOfTurn = false, formatted = endOfTurn, words = transcript.split(' ').filter(Boolean)): SttTurn => ({
  transcript,
  endOfTurn,
  formatted,
  words: words.map((text, i) => ({ text, start: i * 100, end: i * 100 + 90 })),
});

beforeEach(() => {
  h.engines.length = 0;
  h.stts.length = 0;
  h.startMic = null;
  h.connect = null;
});

describe('DictationBuffer', () => {
  it('shows the turn in progress and commits it when its formatted version ends it', () => {
    const b = new DictationBuffer(true);
    expect(b.push(turn('Rinse one cup of', false, true, ['Rinse', 'one', 'cup', 'of', 'tor']))).toBeNull();
    expect(b.text).toEqual({ committed: '', partial: 'Rinse one cup of tor' });
    expect(b.push(turn('rinse one cup of toor dal', true, false))).toBeNull();
    expect(b.partial).toBe('rinse one cup of toor dal');
    expect(b.push(turn('Rinse one cup of toor dal.', true, true))).toBe('Rinse one cup of toor dal.');
    expect(b.text).toEqual({ committed: 'Rinse one cup of toor dal.', partial: '' });
    b.push(turn('Pressure', false, true));
    b.push(turn('Pressure cook it.', true, true));
    expect(b.text).toEqual({ committed: 'Rinse one cup of toor dal. Pressure cook it.', partial: '' });
  });

  it('commits on the end of turn when turns are not formatted', () => {
    const b = new DictationBuffer(false);
    expect(b.push(turn('rinse the dal', true, false))).toBe('rinse the dal');
    expect(b.committed).toBe('rinse the dal');
  });

  it('commits a turn once when its unformatted and formatted ends both arrive', () => {
    const b = new DictationBuffer(true);
    const t = (x: SttTurn, order: number): SttTurn => ({ ...x, order });
    b.push(t(turn('soak the rice', false, false), 0));
    expect(b.push(t(turn('soak the rice for twenty minutes', true, false), 0))).toBeNull();
    expect(b.push(t(turn('Soak the rice for 20 minutes.', true, true), 0))).toBe('Soak the rice for 20 minutes.');
    expect(b.push(t(turn('Soak the rice for 20 minutes.', true, true), 0))).toBeNull();
    expect(b.text).toEqual({ committed: 'Soak the rice for 20 minutes.', partial: '' });
  });

  it('keeps an ended turn as heard if the next one starts before its formatted version, and drops the late copy', () => {
    const b = new DictationBuffer(true);
    const t = (x: SttTurn, order: number): SttTurn => ({ ...x, order });
    b.push(t(turn('heat the ghee', true, false), 3));
    expect(b.push(t(turn('add the', false, false), 4))).toBe('heat the ghee');
    expect(b.text).toEqual({ committed: 'heat the ghee', partial: 'add the' });
    expect(b.push(t(turn('Heat the ghee.', true, true), 3))).toBeNull();
    expect(b.text).toEqual({ committed: 'heat the ghee', partial: 'add the' });
    expect(b.push(t(turn('Add the jeera.', true, true), 4))).toBe('Add the jeera.');
    expect(b.committed).toBe('heat the ghee Add the jeera.');
  });

  it('handles the stream as measured: every message formatted, one end per turn, then an empty end', () => {
    const b = new DictationBuffer(true);
    const t = (x: SttTurn, order: number): SttTurn => ({ ...x, order });
    b.push(t(turn('', false, true, ['Jee']), 0));
    b.push(t(turn('Jeera', false, true, ['Jeera', 'rice']), 0));
    expect(b.partial).toBe('Jeera rice');
    expect(b.push(t(turn('Jeera rice.', true, true), 0))).toBe('Jeera rice.');
    b.push(t(turn('Wash the', false, true, ['Wash', 'the', 'basmati']), 1));
    expect(b.push(t(turn('Wash the basmati.', true, true), 1))).toBe('Wash the basmati.');
    expect(b.push(t(turn('', true, true), 2))).toBeNull();
    expect(b.text).toEqual({ committed: 'Jeera rice. Wash the basmati.', partial: '' });
  });

  it('ignores empty turns and can keep a half-said sentence', () => {
    const b = new DictationBuffer();
    expect(b.push(turn('', true, true))).toBeNull();
    b.push(turn('', false, true, ['Then', 'heat', 'gh']));
    expect(b.flush()).toBe('Then heat gh');
    expect(b.flush()).toBeNull();
    expect(b.text).toEqual({ committed: 'Then heat gh', partial: '' });
  });
});

async function listening(opts?: Parameters<typeof useDictation>[0]) {
  const hook = renderHook(() => useDictation(opts));
  await act(async () => { await hook.result.current.start(['Mom\'s dal']); });
  expect(hook.result.current.status).toBe('listening');
  return { hook, engine: h.engines[0], stt: h.stts[0] };
}

describe('useDictation', () => {
  it('listens with formatted turns and cooking keyterms, and fills committed and partial', async () => {
    const onCommit = vi.fn();
    const { hook, stt } = await listening({ onCommit });
    const [key, keyterms, opts] = stt.connect.mock.calls[0] as unknown as [string, string[], { formatTurns?: boolean }];
    expect(key).toBe('test-key');
    expect(opts).toEqual({ formatTurns: true });
    expect(keyterms).toEqual(expect.arrayContaining(['jeera', 'ghee', 'toor dal', 'tadka', 'knead', "Mom's dal"]));
    expect(keyterms.length).toBeLessThanOrEqual(100);

    act(() => { stt.turn(turn('Rinse the', false, true)); });
    expect(hook.result.current).toMatchObject({ committed: '', partial: 'Rinse the' });
    act(() => { stt.turn(turn('Rinse the dal.', true, true)); });
    act(() => { stt.turn(turn('Then cook', false, true)); });
    expect(hook.result.current).toMatchObject({ committed: 'Rinse the dal.', partial: 'Then cook' });
    expect(onCommit).toHaveBeenCalledWith('Rinse the dal.');
    expect(hook.result.current.level()).toBe(0.25);
    await act(async () => { await hook.result.current.stop(); });
  });

  it('holds what the mic hears while the listener connects, then sends it', async () => {
    let connected!: () => void;
    h.connect = () => new Promise<void>(r => { connected = r; });
    const hook = renderHook(() => useDictation());
    let starting!: Promise<void>;
    act(() => { starting = hook.result.current.start(); });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.status).toBe('starting');
    const chunk = new Int16Array(1200);
    h.engines[0].onChunk!(chunk);
    expect(h.stts[0].sendPcm).not.toHaveBeenCalled();
    await act(async () => { connected(); await starting; });
    expect(h.stts[0].sendPcm).toHaveBeenCalledWith(chunk);
    expect(hook.result.current.status).toBe('listening');
    await act(async () => { await hook.result.current.stop(); });
  });

  it('stop() keeps the sentence in progress, releases the mic and socket, and ignores late turns', async () => {
    const onCommit = vi.fn();
    const { hook, engine, stt } = await listening({ onCommit });
    act(() => { stt.turn(turn('Garnish with', false, true)); });
    await act(async () => { await hook.result.current.stop(); });
    expect(hook.result.current).toMatchObject({ status: 'idle', committed: 'Garnish with', partial: '', error: null });
    expect(onCommit).toHaveBeenCalledWith('Garnish with');
    expect(stt.close).toHaveBeenCalled();
    expect(engine.close).toHaveBeenCalled();
    act(() => { stt.turn(turn('Garnish with coriander.', true, true)); });
    expect(hook.result.current.committed).toBe('Garnish with');
    expect(hook.result.current.level()).toBe(0);
  });

  it('a new start() begins a fresh dictation', async () => {
    const { hook, stt } = await listening();
    act(() => { stt.turn(turn('First bit.', true, true)); });
    await act(async () => { await hook.result.current.stop(); });
    await act(async () => { await hook.result.current.start(); });
    expect(hook.result.current).toMatchObject({ status: 'listening', committed: '', partial: '' });
    expect(h.stts).toHaveLength(2);
    await act(async () => { await hook.result.current.stop(); });
  });

  it('start() while already listening does nothing', async () => {
    const { hook } = await listening();
    await act(async () => { await hook.result.current.start(); });
    expect(h.engines).toHaveLength(1);
    await act(async () => { await hook.result.current.stop(); });
  });

  it('stop() while the mic permission prompt is up leaves nothing open and no error', async () => {
    let allow!: () => void;
    h.startMic = () => new Promise<void>(r => { allow = r; });
    const hook = renderHook(() => useDictation());
    let starting!: Promise<void>;
    act(() => { starting = hook.result.current.start(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await hook.result.current.stop(); });
    await act(async () => { allow(); await starting; });
    expect(hook.result.current).toMatchObject({ status: 'idle', error: null });
    expect(h.stts[0].connect).not.toHaveBeenCalled();
    // Torn down on stop, and again once the late mic opened.
    expect(h.engines[0].close).toHaveBeenCalledTimes(2);
  });

  it('stop() while connecting leaves no live listener', async () => {
    let connected!: () => void;
    h.connect = () => new Promise<void>(r => { connected = r; });
    const hook = renderHook(() => useDictation());
    let starting!: Promise<void>;
    act(() => { starting = hook.result.current.start(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await hook.result.current.stop(); });
    await act(async () => { connected(); await starting; });
    expect(hook.result.current).toMatchObject({ status: 'idle', error: null });
    expect(h.engines[0].close).toHaveBeenCalledTimes(2);
  });

  it('releases the mic and socket on unmount', async () => {
    const { hook, engine, stt } = await listening();
    hook.unmount();
    expect(stt.close).toHaveBeenCalled();
    expect(engine.close).toHaveBeenCalled();
  });

  it('unmounting while the mic permission prompt is up releases the mic once it opens, and never connects', async () => {
    let allow!: () => void;
    h.startMic = () => new Promise<void>(r => { allow = r; });
    const hook = renderHook(() => useDictation());
    let starting!: Promise<void>;
    act(() => { starting = hook.result.current.start(); });
    await act(async () => { await Promise.resolve(); });
    hook.unmount();
    expect(h.engines[0].close).toHaveBeenCalledTimes(1);
    allow();
    await starting;
    expect(h.stts[0].connect).not.toHaveBeenCalled();
    expect(h.engines[0].close).toHaveBeenCalledTimes(2);
  });

  it('unmounting while connecting closes the listener once it is up', async () => {
    let connected!: () => void;
    h.connect = () => new Promise<void>(r => { connected = r; });
    const hook = renderHook(() => useDictation());
    let starting!: Promise<void>;
    act(() => { starting = hook.result.current.start(); });
    await act(async () => { await Promise.resolve(); });
    hook.unmount();
    connected();
    await starting;
    expect(h.stts[0].close).toHaveBeenCalledTimes(2);
    expect(h.stts[0].sendPcm).not.toHaveBeenCalled();
  });

  it('leaves out extra keyterms the listener would refuse', async () => {
    const hook = renderHook(() => useDictation());
    await act(async () => { await hook.result.current.start(['  Paneer butter masala ', '', 'x'.repeat(51)]); });
    const keyterms = h.stts[0].connect.mock.calls[0][1] as unknown as string[];
    expect(keyterms).toContain('Paneer butter masala');
    expect(keyterms.every(k => k.length > 0 && k.length <= 50)).toBe(true);
    await act(async () => { await hook.result.current.stop(); });
  });

  it.each([
    [new DOMException('denied', 'NotAllowedError'), /Microphone is blocked/],
    [new DOMException('none', 'NotFoundError'), /No microphone found/],
    [new DOMException('busy', 'NotReadableError'), /busy in another app/],
  ])('explains a mic failure (%s)', async (err, message) => {
    h.startMic = () => Promise.reject(err);
    const hook = renderHook(() => useDictation());
    await act(async () => { await hook.result.current.start(); });
    expect(hook.result.current.status).toBe('error');
    expect(hook.result.current.error).toMatch(message);
    expect(h.engines[0].close).toHaveBeenCalled();
    expect(h.stts[0].close).toHaveBeenCalled();
  });

  it('explains a rejected key, even though the socket also reports closing', async () => {
    h.connect = self => {
      self.closed();
      return Promise.reject(new AgentError('unauthorized', 'AssemblyAI rejected the API key'));
    };
    const hook = renderHook(() => useDictation());
    await act(async () => { await hook.result.current.start(); });
    expect(hook.result.current).toMatchObject({ status: 'error', error: expect.stringMatching(/rejected the API key/) });
  });

  it('reports a dropped connection and keeps what was said', async () => {
    const { hook, stt, engine } = await listening();
    act(() => { stt.turn(turn('Then simmer', false, true)); });
    await act(async () => { stt.closed(); await Promise.resolve(); });
    expect(hook.result.current).toMatchObject({ status: 'error', committed: 'Then simmer', partial: '' });
    expect(hook.result.current.error).toMatch(/Lost the connection/);
    expect(engine.close).toHaveBeenCalled();
    await act(async () => { await hook.result.current.start(); });
    expect(hook.result.current).toMatchObject({ status: 'listening', error: null });
  });

  it('without a key it says so instead of opening the mic', async () => {
    vi.stubEnv('VITE_ASSEMBLYAI_API_KEY', '');
    vi.resetModules();
    const { useDictation: fresh } = await import('./dictation');
    const hook = renderHook(() => fresh());
    await act(async () => { await hook.result.current.start(); });
    expect(hook.result.current).toMatchObject({ status: 'error', error: expect.stringMatching(/AssemblyAI key/) });
    expect(h.engines).toHaveLength(0);
    vi.stubEnv('VITE_ASSEMBLYAI_API_KEY', 'test-key');
  });
});
