import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentError } from './agentSocket';
import { AudioEngine } from './audio';
import { SttSocket, type SttTurn } from './sttSocket';

const API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY;

/** Words Universal-Streaming should expect when a cook talks a recipe through. */
export const DICTATION_KEYTERMS = [
  'jeera', 'ghee', 'hing', 'haldi', 'ajwain', 'methi', 'kasuri methi', 'curry leaves', 'mustard seeds', 'garam masala',
  'toor dal', 'moong dal', 'masoor dal', 'chana dal', 'urad dal', 'dal', 'besan', 'atta', 'paneer', 'tamarind', 'jaggery',
  'tadka', 'tawa', 'kadai', 'pressure cooker', 'whistles', 'roti', 'chapati', 'paratha', 'naan', 'biryani', 'pulao',
  'sambar', 'rasam', 'basmati', 'cardamom', 'coriander', 'cumin', 'turmeric', 'green chillies',
  'simmer', 'sauté', 'parboil', 'blanch', 'knead', 'marinate', 'temper', 'deglaze', 'al dente', 'julienne',
];

export interface DictationText {
  /** Every finished turn so far, joined with spaces. */
  committed: string;
  /** The turn being spoken right now. */
  partial: string;
}

const joinText = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ') || null;

/**
 * Collects streaming turns into text. A turn is committed when it ends (and, with formatted turns,
 * once its formatted version arrives); until then its text is the live partial. If the next turn
 * starts before a formatted version comes, the turn is kept as heard, and a late copy is ignored.
 */
export class DictationBuffer {
  private readonly formatTurns: boolean;
  private readonly turns: string[] = [];
  private readonly kept = new Set<number>();
  private live = '';
  private liveOrder: number | undefined;
  /** The live text is an ended turn still waiting for its formatted version. */
  private ended = false;

  constructor(formatTurns = true) {
    this.formatTurns = formatTurns;
  }

  get committed(): string {
    return this.turns.join(' ');
  }

  get partial(): string {
    return this.live;
  }

  get text(): DictationText {
    return { committed: this.committed, partial: this.live };
  }

  /** Returns the text this committed, or null if it only moved the partial. */
  push(turn: SttTurn): string | null {
    const { order } = turn;
    if (order !== undefined && this.kept.has(order)) return null;
    const carried = this.ended && order !== this.liveOrder ? this.flush() : null;
    const text = turn.transcript.trim();
    if (turn.endOfTurn && (turn.formatted || !this.formatTurns)) return joinText(carried, this.keep(text, order));
    // Words include the one still being spoken; the transcript only has the finished ones.
    this.live = turn.words.map(w => w.text).join(' ').trim() || text;
    this.liveOrder = order;
    this.ended = turn.endOfTurn;
    return carried;
  }

  /** Keeps whatever was mid-sentence (used when the cook stops talking to the mic). */
  flush(): string | null {
    return this.keep(this.live.trim(), this.liveOrder);
  }

  private keep(text: string, order: number | undefined): string | null {
    this.live = '';
    this.liveOrder = undefined;
    this.ended = false;
    if (order !== undefined) this.kept.add(order);
    if (!text) return null;
    this.turns.push(text);
    return text;
  }
}

export type DictationStatus = 'idle' | 'starting' | 'listening' | 'error';

export interface DictationOptions {
  /** Called with each committed turn's text (including a partial kept on stop). */
  onCommit?: (text: string) => void;
}

const BACKLOG_CHUNKS = 100; // 5 s of 50 ms chunks, held while the listener connects
/** Universal-Streaming's keyterms_prompt limits. */
const MAX_KEYTERMS = 100;
const MAX_KEYTERM_CHARS = 50;
const LOST = 'Lost the connection while listening. Press the mic to try again.';

function describeError(err: unknown): string {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String(err.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone is blocked. Allow it from the icon in the address bar, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found. Plug one in and try again.';
  if (name === 'NotReadableError') return 'The microphone is busy in another app. Close it there and try again.';
  if (err instanceof AgentError && err.code === 'unauthorized') return 'AssemblyAI rejected the API key. Check VITE_ASSEMBLYAI_API_KEY in .env.local.';
  if (err instanceof AgentError) return "Couldn't reach AssemblyAI to listen. Check your connection and try again.";
  if (typeof navigator !== 'undefined' && !navigator.mediaDevices) return "This browser can't use the microphone here. Open the app on localhost or https.";
  return `Couldn't start listening: ${err instanceof Error ? err.message : String(err)}`;
}

interface Runtime {
  engine: AudioEngine;
  stt: SttSocket;
  buffer: DictationBuffer;
  connected: boolean;
  backlog: Int16Array[];
}

async function teardown(r: Runtime) {
  r.backlog.length = 0;
  r.stt.close();
  await r.engine.close();
}

/**
 * Talk-to-type for the recipe studio: mic -> Universal-Streaming (formatted turns) -> text.
 * `committed` holds what was said since the last start(); `partial` is the sentence in progress.
 * The mic and socket are released on stop() and on unmount.
 */
export function useDictation(opts: DictationOptions = {}) {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState('');
  const [partial, setPartial] = useState('');
  const rt = useRef<Runtime | null>(null);
  const onCommit = useRef(opts.onCommit);
  useEffect(() => {
    onCommit.current = opts.onCommit;
  });

  const show = useCallback((r: Runtime, turnText: string | null) => {
    setCommitted(r.buffer.committed);
    setPartial(r.buffer.partial);
    if (turnText) onCommit.current?.(turnText);
  }, []);

  const fail = useCallback((message: string) => {
    setError(message);
    setPartial('');
    setStatus('error');
  }, []);

  const stop = useCallback(async () => {
    const r = rt.current;
    rt.current = null;
    if (!r) return;
    show(r, r.buffer.flush());
    setStatus('idle');
    await teardown(r);
  }, [show]);

  const start = useCallback(async (extraKeyterms: string[] = []) => {
    if (rt.current) return;
    if (!API_KEY) {
      fail('Add an AssemblyAI key to talk a recipe through.');
      return;
    }
    const r: Runtime = { engine: new AudioEngine(), stt: new SttSocket(), buffer: new DictationBuffer(true), connected: false, backlog: [] };
    rt.current = r;
    setStatus('starting');
    setError(null);
    setCommitted('');
    setPartial('');

    r.stt.onTurn(turn => {
      if (rt.current === r) show(r, r.buffer.push(turn));
    });
    r.stt.onClosed(() => {
      // Before the listener is up, connect() rejects with the specific reason instead.
      if (rt.current !== r || !r.connected) return;
      rt.current = null;
      show(r, r.buffer.flush());
      void teardown(r);
      fail(LOST);
    });

    try {
      // The mic opens first (it may wait on the permission prompt); words said while the listener connects are held.
      await r.engine.startMic(chunk => {
        if (r.connected) r.stt.sendPcm(chunk);
        else if (r.backlog.push(chunk) > BACKLOG_CHUNKS) r.backlog.shift();
      });
      if (rt.current !== r) throw new Error('stopped');
      const extra = extraKeyterms.map(k => k.trim()).filter(k => k && k.length <= MAX_KEYTERM_CHARS);
      const keyterms = [...new Set([...DICTATION_KEYTERMS, ...extra])].slice(0, MAX_KEYTERMS);
      await r.stt.connect(API_KEY, keyterms, { formatTurns: true });
    } catch (err) {
      const current = rt.current === r;
      if (current) rt.current = null;
      await teardown(r);
      if (current) fail(describeError(err));
      return;
    }
    if (rt.current !== r) {
      // Stopped while connecting.
      await teardown(r);
      return;
    }
    r.connected = true;
    for (const chunk of r.backlog.splice(0)) r.stt.sendPcm(chunk);
    setStatus('listening');
  }, [fail, show]);

  /** Mic loudness (RMS, 0..1) for a level meter; 0 when not listening. */
  const level = useCallback(() => rt.current?.engine.levels().mic ?? 0, []);

  useEffect(() => () => {
    const r = rt.current;
    rt.current = null;
    if (r) void teardown(r);
  }, []);

  return { status, committed, partial, error, start, stop, level };
}

export type Dictation = ReturnType<typeof useDictation>;
