import { describe, it, expect, vi, afterEach } from 'vitest';
import { AgentError, type AgentSocket, type ServerEvent } from './agentSocket';
import type { SessionConfig } from './agentConfig';
import { FORMAT_TIMEOUT_MS, SUGGEST_TIMEOUT_MS, Scribe, ScribeError, leadWithShort, scribeSession } from './scribe';
import type { RecipeDraft } from '../kitchen/draft';

class FakeSocket {
  private readonly listeners = new Set<(e: ServerEvent) => void>();
  key = '';
  session: SessionConfig | null = null;
  replies: string[] = [];
  sent: object[] = [];
  closed = false;
  connectWith: () => Promise<void> = () => Promise.resolve();
  sendToolResult = vi.fn();
  sendAudio = vi.fn();
  onEvent(fn: (e: ServerEvent) => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  connect(key: string, session: SessionConfig) {
    this.key = key;
    this.session = session;
    return this.connectWith();
  }
  replyCreate(instructions: string) { this.replies.push(instructions); }
  send(msg: object) { this.sent.push(msg); }
  close() { this.closed = true; }
  emit(e: ServerEvent) { this.listeners.forEach(fn => fn(e)); }
  /** A whole scribe reply: the tool call, some speech the scribe ignores, then reply.done. */
  answer(name: string, args: unknown) {
    this.emit({ type: 'reply.started' });
    this.emit({ type: 'tool.call', call_id: `c${this.replies.length}`, name, arguments: args });
    this.emit({ type: 'reply.audio', data: 'AAAA' });
    this.emit({ type: 'transcript.agent', text: 'Done.' });
    this.emit({ type: 'reply.done', status: 'completed' });
  }
}

function setup(prepare: (s: FakeSocket, i: number) => void = () => {}) {
  const sockets: FakeSocket[] = [];
  const scribe = new Scribe('test-key', () => {
    const s = new FakeSocket();
    prepare(s, sockets.length);
    sockets.push(s);
    return s as unknown as AgentSocket;
  });
  return { scribe, sockets };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

const DAL_ARGS = {
  name: 'Dal tadka',
  short: 'dal',
  kind: 'curry',
  steps: [
    { label: 'Rinse the dal', minutes: 3, call: 'Rinse it till the water runs clear.' },
    { label: 'Pressure cook the dal', minutes: 15, call: 'Dal into the cooker.' },
    { label: 'Make the tadka', minutes: 8, call: 'Ghee on. Cumin and garlic.' },
  ],
  ingredients: ['1 cup toor dal', 'ghee'],
  suggestions: [
    { text: 'Add a pinch of hing to the tadka.', action: 'add_ingredient', ingredient: 'pinch of hing' },
    { text: 'Ghee is already there.', action: 'add_ingredient', ingredient: '2 tbsp ghee' },
    { text: 'Taste for salt.', action: 'tip' },
  ],
};

const CARD: RecipeDraft = {
  name: "Mom's dal",
  short: 'dal',
  kind: 'curry',
  steps: [{ label: 'Rinse the dal', minutes: 3, call: 'Dal. Rinse it.' }, { label: 'Cook the dal', minutes: 15, call: 'Dal into the cooker.' }],
  ingredients: ['toor dal'],
};

afterEach(() => vi.useRealTimers());

describe('scribeSession', () => {
  it('declares save_recipe and suggest with the flattened suggestion schema', () => {
    const s = scribeSession();
    expect(s.tools.map(t => t.name)).toEqual(['save_recipe', 'suggest']);
    const save = s.tools[0].parameters as { properties: Record<string, { enum?: string[]; items?: { properties: Record<string, { enum?: string[] }> } }> };
    expect(save.properties.kind.enum).toContain('curry');
    expect(Object.keys(save.properties.suggestions.items!.properties)).toEqual(['text', 'action', 'step_label', 'after_label', 'minutes', 'call', 'ingredient']);
    expect(save.properties.suggestions.items!.properties.action.enum).toEqual(['add_step', 'set_minutes', 'add_ingredient', 'tip']);
    expect(s.system_prompt).toMatch(/FORMAT/);
    expect(s.system_prompt).toMatch(/SUGGEST/);
  });
});

describe('Scribe', () => {
  it('connects lazily, once, with the scribe session', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    expect(sockets).toHaveLength(0);
    await Promise.all([scribe.connect(), scribe.connect()]);
    await scribe.connect();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].key).toBe('test-key');
    expect(sockets[0].session?.tools.map(t => t.name)).toEqual(['save_recipe', 'suggest']);
  });

  it('formats: one reply.create, resolves on save_recipe, ignores everything else, never sends tool.result', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.format('  Dal. Rinse it, pressure cook it, then tadka.  ');
    await settle();
    const s = sockets[0];
    expect(s.replies).toHaveLength(1);
    expect(s.replies[0]).toMatch(/^FORMAT request/);
    expect(s.replies[0]).toContain('Dal. Rinse it, pressure cook it, then tadka.');
    expect(s.replies[0]).toContain('typed');
    expect(s.replies[0]).not.toMatch(/Dismissed/);

    let done = false;
    void p.then(() => { done = true; });
    s.emit({ type: 'reply.started' });
    s.emit({ type: 'reply.audio', data: 'AAAA' });
    s.emit({ type: 'transcript.agent.delta', delta: 'Done' });
    s.emit({ type: 'tool.call', call_id: 'x', name: 'suggest', arguments: { suggestions: [] } });
    await settle();
    expect(done).toBe(false);

    s.emit({ type: 'tool.call', call_id: 'c1', name: 'save_recipe', arguments: JSON.stringify(DAL_ARGS) });
    const { draft, suggestions } = await p;
    expect(draft.name).toBe('Dal tadka');
    expect(draft.steps.map(st => st.minutes)).toEqual([3, 15, 8]);
    expect(draft.steps[0].call).toBe('Dal. Rinse it till the water runs clear.');
    expect(draft.steps[1].call).toBe('Dal into the cooker.');
    expect(suggestions.map(x => x.text)).toEqual(['Add a pinch of hing to the tadka.', 'Taste for salt.']);
    s.emit({ type: 'reply.done', status: 'completed' });
    expect(s.sendToolResult).not.toHaveBeenCalled();
    expect(s.sent.some(m => (m as { type?: string }).type === 'tool.result')).toBe(false);
  });

  it('asks for a merge with the current card, and keeps the card when the text has no steps', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.format('um then garnish with fried onions', CARD, 'said');
    await settle();
    const ask = sockets[0].replies[0];
    expect(ask).toContain('speech-to-text');
    expect(ask).toContain('"Rinse the dal"');
    expect(ask).toMatch(/card wins/);
    sockets[0].answer('save_recipe', { name: 'Fried onion dal', short: 'onion', kind: 'other', steps: [], ingredients: [], suggestions: [{ text: 'Tell me the steps.', action: 'tip' }] });
    const { draft, suggestions } = await p;
    expect(draft).toMatchObject({ name: "Mom's dal", short: 'dal', kind: 'curry', ingredients: ['toor dal'] });
    expect(draft.steps).toEqual(CARD.steps);
    // The "tell me the steps" tip is stale: the card it merged into already has steps.
    expect(suggestions).toEqual([]);
  });

  it('a merge keeps the name the cook gave the card', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.format('Then garnish with fried onions.', CARD);
    await settle();
    sockets[0].answer('save_recipe', { ...DAL_ARGS, name: 'Dal with onions', steps: [...CARD.steps, { label: 'Garnish with fried onions', minutes: 1, call: 'Fried onions on top.' }] });
    const { draft } = await p;
    expect(draft.name).toBe("Mom's dal");
    expect(draft.steps.map(st => st.label)).toEqual(['Rinse the dal', 'Cook the dal', 'Garnish with fried onions']);
  });

  it('a merge keeps every ingredient on the card and the first call the cook wrote', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const card: RecipeDraft = { ...CARD, steps: [{ ...CARD.steps[0], call: 'Rinse the dal well.' }, CARD.steps[1]], ingredients: ['1 cup toor dal', 'hing'] };
    const p = scribe.format('Then garnish with fried onions.', card);
    await settle();
    sockets[0].answer('save_recipe', {
      ...DAL_ARGS,
      steps: [...card.steps, { label: 'Garnish with fried onions', minutes: 1, call: 'Fried onions on top.' }],
      ingredients: ['toor dal', 'fried onions'],
    });
    const { draft } = await p;
    expect(draft.ingredients).toEqual(['1 cup toor dal', 'hing', 'fried onions']);
    expect(draft.steps[0].call).toBe('Rinse the dal well.');
  });

  it('keeps suggestions the cook dismissed out of a format, and tells the scribe about them', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.format('Dal. Rinse, cook, tadka.', undefined, 'typed', ['Taste for salt.']);
    await settle();
    expect(sockets[0].replies[0]).toMatch(/Dismissed suggestions[^]*- Taste for salt\./);
    sockets[0].answer('save_recipe', DAL_ARGS);
    const { suggestions } = await p;
    expect(suggestions.map(x => x.text)).toEqual(['Add a pinch of hing to the tadka.']);
  });

  it('serializes requests: the next reply.create waits for the previous reply', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const first = scribe.format('Dal. Rinse, cook, tadka.');
    const second = scribe.suggest(CARD, ['Taste for salt.']);
    await settle();
    const s = sockets[0];
    expect(s.replies).toHaveLength(1);

    s.emit({ type: 'reply.started' });
    s.emit({ type: 'tool.call', call_id: 'c1', name: 'save_recipe', arguments: DAL_ARGS });
    await expect(first).resolves.toMatchObject({ draft: { short: 'dal' } });
    await settle();
    expect(s.replies).toHaveLength(1);
    s.emit({ type: 'reply.done', status: 'completed' });
    await settle();
    expect(s.replies).toHaveLength(2);
    expect(s.replies[1]).toMatch(/^SUGGEST request/);
    expect(s.replies[1]).toContain('- Taste for salt.');

    s.answer('suggest', {
      suggestions: [
        { text: 'Taste for salt.', action: 'tip' },
        { text: 'Soak the dal for 30 minutes first.', action: 'add_step', step_label: 'Soak the dal', after_label: 'START', minutes: 30 },
        { text: 'Cook it for 12 minutes.', action: 'set_minutes', step_label: 'Cook the dal', minutes: 12 },
      ],
    });
    const out = await second;
    expect(out.map(x => x.patch?.type)).toEqual(['add_step', 'set_minutes']);
    expect(sockets).toHaveLength(1);
  });

  it('frees the queue even if reply.done never comes, on a fresh session so the replies cannot overlap', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const first = scribe.suggest(CARD, []);
    const second = scribe.suggest(CARD, []);
    await settle();
    sockets[0].emit({ type: 'reply.started' });
    sockets[0].emit({ type: 'tool.call', call_id: 'c1', name: 'suggest', arguments: { suggestions: [] } });
    await expect(first).resolves.toEqual([]);
    await vi.advanceTimersByTimeAsync(2999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets[0].closed).toBe(true);
    expect(sockets[0].replies).toHaveLength(1);
    expect(sockets[1].replies).toHaveLength(1);
    // The old reply's late second tool call can't answer the new request.
    sockets[0].emit({ type: 'tool.call', call_id: 'c2', name: 'suggest', arguments: { suggestions: [{ text: 'Stale.', action: 'tip' }] } });
    sockets[1].answer('suggest', { suggestions: [{ text: 'Fresh.', action: 'tip' }] });
    await expect(second).resolves.toMatchObject([{ text: 'Fresh.' }]);
  });

  it('only the reply it started ends a request (a cut-short earlier reply\'s reply.done is ignored)', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.suggest(CARD, []);
    await settle();
    const s = sockets[0];
    s.emit({ type: 'reply.started', reply_id: 'resp_b' });
    s.emit({ type: 'reply.done', reply_id: 'resp_a', status: 'completed' });
    s.emit({ type: 'tool.call', call_id: 'c1', name: 'suggest', arguments: { suggestions: [{ text: 'Rest it.', action: 'tip' }] } });
    await expect(p).resolves.toMatchObject([{ text: 'Rest it.' }]);
    const next = scribe.suggest(CARD, []);
    await settle();
    expect(s.replies).toHaveLength(1);
    s.emit({ type: 'reply.done', reply_id: 'resp_b', status: 'completed' });
    await settle();
    expect(s.replies).toHaveLength(2);
    s.answer('suggest', { suggestions: [] });
    await expect(next).resolves.toEqual([]);
  });

  it('fails a tool call whose arguments are not an object, without overlapping the rest of that reply', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.format('Dal. Rinse, cook, tadka.');
    await settle();
    sockets[0].emit({ type: 'reply.started' });
    sockets[0].emit({ type: 'tool.call', call_id: 'c1', name: 'save_recipe', arguments: '{"name": "Dal", "steps": [' });
    await expect(p).rejects.toMatchObject({ code: 'failed' });
    expect(sockets[0].closed).toBe(true);
    const next = scribe.suggest(CARD, []);
    await settle();
    expect(sockets).toHaveLength(2);
    sockets[1].answer('suggest', { suggestions: [] });
    await expect(next).resolves.toEqual([]);
  });

  it('times out (format 15 s, suggest 10 s), drops the session and reconnects for the next request', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const format = scribe.format('Dal.');
    const failed = expect(format).rejects.toMatchObject({ name: 'ScribeError', code: 'timeout' });
    await vi.advanceTimersByTimeAsync(FORMAT_TIMEOUT_MS - 1);
    expect(sockets[0].closed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await failed;
    expect(sockets[0].closed).toBe(true);

    const suggest = scribe.suggest(CARD, []);
    const late = expect(suggest).rejects.toMatchObject({ code: 'timeout' });
    await settle();
    expect(sockets).toHaveLength(2);
    // A late answer on the dropped session can't land on this request.
    sockets[0].answer('suggest', { suggestions: [{ text: 'Stale.', action: 'tip' }] });
    await vi.advanceTimersByTimeAsync(SUGGEST_TIMEOUT_MS);
    await late;
  });

  it('rejects when a reply ends without the tool call', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.format('Dal.');
    await settle();
    sockets[0].emit({ type: 'reply.started' });
    sockets[0].emit({ type: 'transcript.agent', text: 'Sure!' });
    sockets[0].emit({ type: 'reply.done', status: 'completed' });
    await expect(p).rejects.toMatchObject({ code: 'failed', message: "Chef couldn't read that one. Try again." });
  });

  it('maps connection errors to friendly messages and retries the connection next time', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup((s, i) => {
      if (i === 0) s.connectWith = () => Promise.reject(new AgentError('unauthorized', 'Authentication failed'));
      if (i === 1) s.connectWith = () => Promise.reject(new AgentError('closed', 'Connection closed (1006)'));
    });
    await expect(scribe.format('Dal.')).rejects.toMatchObject({ code: 'auth', message: expect.stringMatching(/rejected the API key/) });
    await expect(scribe.suggest(CARD, [])).rejects.toMatchObject({ code: 'connect', message: "Chef's scribe couldn't connect. Check your connection." });
    const p = scribe.suggest(CARD, []);
    await settle();
    expect(sockets).toHaveLength(3);
    sockets[2].answer('suggest', { suggestions: [] });
    await expect(p).resolves.toEqual([]);
  });

  it('gives up on a connection that never gets ready', async () => {
    vi.useFakeTimers();
    const { scribe } = setup(s => { s.connectWith = () => new Promise(() => {}); });
    const p = scribe.connect();
    const failed = expect(p).rejects.toMatchObject({ code: 'connect' });
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
  });

  it('a dropped socket rejects the request in flight, and the next one reconnects', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.format('Dal.');
    await settle();
    sockets[0].emit({ type: 'socket.closed', code: 1006 });
    await expect(p).rejects.toMatchObject({ code: 'closed' });
    const next = scribe.suggest(CARD, []);
    await settle();
    expect(sockets).toHaveLength(2);
    sockets[1].answer('suggest', { suggestions: [] });
    await expect(next).resolves.toEqual([]);
  });

  it('a socket that closes the moment it gets ready fails the request instead of hanging it', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup((s, i) => {
      if (i === 0) s.connectWith = () => Promise.resolve().then(() => s.emit({ type: 'socket.closed', code: 1006 }));
    });
    const p = scribe.suggest(CARD, []);
    const failed = expect(p).rejects.toMatchObject({ code: 'closed' });
    await settle();
    await failed;
    expect(sockets[0].replies).toHaveLength(0);
    const next = scribe.suggest(CARD, []);
    await settle();
    sockets[1].answer('suggest', { suggestions: [] });
    await expect(next).resolves.toEqual([]);
  });

  it('a session error mid-request fails it', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const p = scribe.format('Dal.');
    await settle();
    sockets[0].emit({ type: 'session.error', code: 'server_error', message: 'boom' });
    await expect(p).rejects.toBeInstanceOf(ScribeError);
    expect(sockets[0].closed).toBe(true);
  });

  it('close() after an answer does not hold up the next request', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const first = scribe.suggest(CARD, []);
    await settle();
    sockets[0].emit({ type: 'reply.started' });
    sockets[0].emit({ type: 'tool.call', call_id: 'c1', name: 'suggest', arguments: { suggestions: [] } });
    await expect(first).resolves.toEqual([]);
    scribe.close();
    const next = scribe.suggest(CARD, []);
    await settle();
    expect(sockets).toHaveLength(2);
    expect(sockets[1].replies).toHaveLength(1);
    sockets[1].answer('suggest', { suggestions: [] });
    await expect(next).resolves.toEqual([]);
  });

  it('a socket that cannot even be made fails that request and not the queue', async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const scribe = new Scribe('k', () => {
      if (sockets.push(new FakeSocket()) === 1) throw new Error('no WebSocket');
      return sockets[sockets.length - 1] as unknown as AgentSocket;
    });
    await expect(scribe.suggest(CARD, [])).rejects.toMatchObject({ code: 'connect' });
    await vi.advanceTimersByTimeAsync(SUGGEST_TIMEOUT_MS / 2);
    const next = scribe.suggest(CARD, []);
    await settle();
    // The failed request's timeout must not fire later and drop this session.
    await vi.advanceTimersByTimeAsync(SUGGEST_TIMEOUT_MS / 2 + 1);
    expect(sockets[1].closed).toBe(false);
    sockets[1].answer('suggest', { suggestions: [] });
    await expect(next).resolves.toEqual([]);
  });

  it('close() rejects the request in flight and the queued ones', async () => {
    vi.useFakeTimers();
    const { scribe, sockets } = setup();
    const a = scribe.format('Dal.');
    const b = scribe.suggest(CARD, []);
    const both = Promise.allSettled([a, b]);
    await settle();
    scribe.close();
    const [ra, rb] = await both;
    expect(ra).toMatchObject({ status: 'rejected', reason: { code: 'closed' } });
    expect(rb).toMatchObject({ status: 'rejected', reason: { code: 'closed' } });
    expect(sockets[0].closed).toBe(true);
    expect(sockets[0].replies).toHaveLength(1);
  });

  it('turns empty text away without asking', async () => {
    const { scribe, sockets } = setup();
    await expect(scribe.format('   ')).rejects.toMatchObject({ code: 'empty', message: 'Write or say the recipe first.' });
    expect(sockets).toHaveLength(0);
  });
});

describe('leadWithShort', () => {
  it('starts the first call with the short name, once', () => {
    const d = leadWithShort({ ...CARD, steps: [{ label: 'Rinse the dal', minutes: 3, call: 'rinse it.' }, CARD.steps[1]] });
    expect(d.steps[0].call).toBe('Dal. Rinse it.');
    expect(leadWithShort(d)).toBe(d);
    expect(leadWithShort({ ...CARD, short: '' }).steps[0].call).toBe('Dal. Rinse it.');
    expect(leadWithShort({ ...CARD, steps: [{ label: 'Roast the dalia', minutes: 5, call: 'Dalia into a dry pan.' }] }).steps[0].call).toBe('Dal. Dalia into a dry pan.');
  });
});
