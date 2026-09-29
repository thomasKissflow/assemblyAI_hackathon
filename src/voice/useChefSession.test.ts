// @vitest-environment jsdom
import { menuRecipes } from '../kitchen/recipes';
// Drives useChefSession with fake sockets and audio, so no key or network is needed.
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const h = vi.hoisted(() => {
  vi.stubEnv('VITE_ASSEMBLYAI_API_KEY', 'test-key');
  return {
    agent: null as null | { emit: (e: Record<string, unknown>) => void; replyCreate: ReturnType<typeof vi.fn>; sendToolResult: ReturnType<typeof vi.fn> },
    stt: null as null | { turn: (t: unknown) => void },
    engine: null as null | { play: ReturnType<typeof vi.fn>; flush: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> },
    agentConnect: null as null | (() => Promise<void>),
    usedTestKey: false,
    session: null as null | { tools: { name: string; parameters: { properties: { dish?: { enum: string[] } } } }[] },
  };
});

vi.mock('./audio', () => ({
  SAMPLE_RATE: 24000,
  AudioEngine: class {
    speaking = false;
    currentTime = 0;
    play = vi.fn(() => { this.speaking = true; return 0; });
    flush = vi.fn(() => { this.speaking = false; });
    close = vi.fn(async () => {});
    levels = () => ({ mic: 0, out: 0 });
    startMic = vi.fn(async () => {});
    constructor() { h.engine = this; }
  },
}));
vi.mock('./agentSocket', async orig => ({
  ...(await orig<typeof import('./agentSocket')>()),
  AgentSocket: class {
    private fns: ((e: Record<string, unknown>) => void)[] = [];
    replyCreate = vi.fn();
    sendToolResult = vi.fn();
    sendAudio = vi.fn();
    close = vi.fn();
    onEvent(fn: (e: Record<string, unknown>) => void) { this.fns.push(fn); return () => {}; }
    connect(key: string, session: NonNullable<typeof h.session>) {
      h.usedTestKey = key === 'test-key';
      h.session = session;
      return h.agentConnect ? h.agentConnect() : Promise.resolve();
    }
    emit(e: Record<string, unknown>) { this.fns.forEach(f => f(e)); }
    constructor() { h.agent = this; }
  },
}));
vi.mock('./sttSocket', () => ({
  STT_WS_URL: 'x',
  SttSocket: class {
    private fns: ((t: unknown) => void)[] = [];
    onTurn(fn: (t: unknown) => void) { this.fns.push(fn); return () => {}; }
    onClosed() { return () => {}; }
    connect() { return Promise.resolve(); }
    sendPcm() { return true; }
    close = vi.fn();
    turn(t: unknown) { this.fns.forEach(f => f(t)); }
    constructor() { h.stt = this; }
  },
}));

import { useChefSession } from './useChefSession';
import { createKitchenStore } from '../kitchen/store';
import { libraryStore } from '../kitchen/library';

let now = 0;
beforeEach(() => {
  now = 0;
  h.agentConnect = null;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function live() {
  const store = createKitchenStore(() => now);
  store.start(menuRecipes('indian'), 45);
  const hook = renderHook(() => useChefSession(store));
  await act(async () => { await hook.result.current.start(); });
  expect(hook.result.current.phase).toBe('live');
  expect(h.usedTestKey).toBe(true);
  return { store, hook, agent: h.agent!, engine: h.engine! };
}

it('holds a callout until Chef has spoken the tool result', async () => {
  const { store, hook, agent } = await live();
  act(() => {
    agent.emit({ type: 'reply.started' });
    agent.emit({ type: 'tool.call', call_id: 'c1', name: 'kitchen_status', arguments: {} });
    hook.result.current.announce('Rice on.');
    agent.emit({ type: 'reply.done', status: 'completed' });
  });
  expect(agent.sendToolResult).toHaveBeenCalledTimes(1);
  expect(agent.replyCreate).not.toHaveBeenCalled();
  act(() => {
    agent.emit({ type: 'reply.started' });
    agent.emit({ type: 'reply.audio', data: 'AAAA' });
    agent.emit({ type: 'transcript.agent', text: 'Serving at eight.' });
  });
  expect(agent.replyCreate).not.toHaveBeenCalled();
  expect(store.getState().log.some(l => l.kind === 'chef' && l.text === 'Serving at eight.')).toBe(true);
  act(() => { agent.emit({ type: 'reply.done', status: 'completed' }); });
  expect(agent.replyCreate).toHaveBeenCalledTimes(1);
  expect(agent.replyCreate.mock.calls[0][0]).toContain('Rice on.');
  await act(async () => { await hook.result.current.stop(); });
});

it("adds dishes from the cook's recipe book, including their own", async () => {
  const mine = libraryStore.saveRecipe({
    id: 'my_rasam', name: 'Rasam', short: 'rasam', photo: '', kind: 'soup',
    steps: [{ id: 's1', label: 'Boil the rasam', call: 'Rasam on.', minutes: 12 }],
  });
  try {
    const { store, hook, agent } = await live();
    const add = h.session!.tools.find(t => t.name === 'add_dish')!;
    expect(add.parameters.properties.dish!.enum).toEqual(expect.arrayContaining(['dal_tadka', mine.id]));
    act(() => {
      agent.emit({ type: 'reply.started' });
      agent.emit({ type: 'tool.call', call_id: 'c1', name: 'add_dish', arguments: { dish: mine.id } });
      agent.emit({ type: 'reply.done', status: 'completed' });
    });
    expect(store.getState().plan!.dishes.map(d => d.id)).toContain(mine.id);
    expect(agent.sendToolResult).toHaveBeenCalledWith('c1', { ok: true, summary: expect.stringMatching(/^Added Rasam: boil the rasam at /) });
    await act(async () => { await hook.result.current.stop(); });
  } finally {
    libraryStore.clear();
  }
});

it('lets the callout go if no follow-up reply starts', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  const { hook, agent } = await live();
  act(() => {
    agent.emit({ type: 'reply.started' });
    agent.emit({ type: 'tool.call', call_id: 'c1', name: 'kitchen_status', arguments: {} });
    hook.result.current.announce('Rice on.');
    agent.emit({ type: 'reply.done', status: 'completed' });
  });
  now = 2000;
  act(() => { vi.advanceTimersByTime(200); });
  expect(agent.replyCreate).not.toHaveBeenCalled();
  now = 3500;
  act(() => { vi.advanceTimersByTime(200); });
  expect(agent.replyCreate).toHaveBeenCalledTimes(1);
  await act(async () => { await hook.result.current.stop(); });
});

it('push-to-talk silences the rest of the reply until the next one', async () => {
  const { hook, agent, engine } = await live();
  act(() => {
    agent.emit({ type: 'reply.started' });
    agent.emit({ type: 'reply.audio', data: 'AAAA' });
  });
  expect(engine.play).toHaveBeenCalledTimes(1);
  act(() => { hook.result.current.setPushToTalk(true); });
  expect(engine.flush).toHaveBeenCalled();
  act(() => {
    agent.emit({ type: 'reply.audio', data: 'AAAA' });
    agent.emit({ type: 'transcript.agent.delta', delta: 'more ', start_ms: 0, end_ms: 100 });
  });
  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(hook.result.current.captions.getSnapshot().chefWords).toHaveLength(0);
  act(() => {
    agent.emit({ type: 'reply.done', status: 'interrupted' });
    agent.emit({ type: 'reply.started' });
    agent.emit({ type: 'reply.audio', data: 'AAAA' });
  });
  expect(engine.play).toHaveBeenCalledTimes(2);
  await act(async () => { await hook.result.current.stop(); });
});

it('"Hey Chef" with the ears asleep cuts off a callout in progress', async () => {
  const { hook, agent, engine } = await live();
  act(() => {
    hook.result.current.announce('Rice on.');
    agent.emit({ type: 'reply.started' });
    agent.emit({ type: 'reply.audio', data: 'AAAA' });
  });
  expect(engine.play).toHaveBeenCalledTimes(1);
  act(() => {
    h.stt!.turn({ words: [{ text: 'hey', start: 100, end: 300 }, { text: 'chef', start: 300, end: 500 }], transcript: 'hey chef', endOfTurn: false });
  });
  expect(hook.result.current.wakeCount).toBe(1);
  act(() => { agent.emit({ type: 'reply.audio', data: 'AAAA' }); });
  expect(engine.play).toHaveBeenCalledTimes(1);
  await act(async () => { await hook.result.current.stop(); });
});

it('stop while connecting leaves no live runtime and no error', async () => {
  let release!: () => void;
  h.agentConnect = () => new Promise<void>(r => { release = r; });
  const store = createKitchenStore(() => now);
  store.start(menuRecipes('indian'), 45);
  const hook = renderHook(() => useChefSession(store));
  let starting!: Promise<void>;
  act(() => { starting = hook.result.current.start(); });
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await hook.result.current.stop(); });
  await act(async () => { release(); await starting; });
  expect(hook.result.current.phase).toBe('idle');
  expect(hook.result.current.error).toBeNull();
  expect(h.engine!.close).toHaveBeenCalledTimes(2);
});
