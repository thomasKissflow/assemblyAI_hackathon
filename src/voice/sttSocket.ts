import { AgentError } from './agentSocket';
import type { SttWord } from './wake';

export const STT_WS_URL = 'wss://streaming.assemblyai.com/v3/ws';

export interface SttTurn {
  words: SttWord[];
  transcript: string;
  endOfTurn: boolean;
  /** From `turn_is_formatted`: punctuation and casing are applied. */
  formatted: boolean;
  /** From `turn_order`: which turn this message belongs to (the same for its partials and its end). */
  order?: number;
}

export interface SttConnectOptions {
  /** Ask for punctuated, cased turns (dictation). Off for the wake-word listener. */
  formatTurns?: boolean;
}

interface RawWord {
  text?: unknown;
  start?: unknown;
  end?: unknown;
}

export class SttSocket {
  private ws: WebSocket | null = null;
  private readonly turnListeners = new Set<(t: SttTurn) => void>();
  private readonly closeListeners = new Set<() => void>();

  onTurn(fn: (t: SttTurn) => void) {
    this.turnListeners.add(fn);
    return () => { this.turnListeners.delete(fn); };
  }

  onClosed(fn: () => void) {
    this.closeListeners.add(fn);
    return () => { this.closeListeners.delete(fn); };
  }

  connect(apiKey: string, keyterms: string[], opts: SttConnectOptions = {}): Promise<void> {
    const params = new URLSearchParams({
      sample_rate: '24000',
      encoding: 'pcm_s16le',
      format_turns: opts.formatTurns ? 'true' : 'false',
      speech_model: 'universal-streaming-english',
      keyterms_prompt: JSON.stringify(keyterms),
      token: apiKey,
    });
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${STT_WS_URL}?${params}`);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      let begun = false;
      let unauthorized = false;
      ws.onmessage = m => {
        const d = JSON.parse(String(m.data)) as {
          type?: string; words?: RawWord[]; transcript?: unknown; end_of_turn?: unknown; turn_is_formatted?: unknown; turn_order?: unknown;
          error?: unknown; error_code?: unknown;
        };
        if (d.type === 'Begin') {
          begun = true;
          resolve();
          return;
        }
        // Measured: a bad key gets {"type":"Error","error_code":1008,"error":"Unauthorized Connection: ..."}, then close 1008.
        if (d.type === 'Error' && (d.error_code === 1008 || /unauthori[sz]ed/i.test(String(d.error ?? '')))) unauthorized = true;
        if (d.type !== 'Turn') return;
        const words = (d.words ?? []).map(w => ({ text: String(w.text ?? ''), start: Number(w.start ?? 0), end: Number(w.end ?? 0) }));
        const turn: SttTurn = { words, transcript: String(d.transcript ?? ''), endOfTurn: Boolean(d.end_of_turn), formatted: Boolean(d.turn_is_formatted) };
        if (typeof d.turn_order === 'number') turn.order = d.turn_order;
        this.turnListeners.forEach(fn => fn(turn));
      };
      ws.onclose = ev => {
        if (!begun) {
          reject(unauthorized || ev.code === 1008
            ? new AgentError('unauthorized', 'AssemblyAI rejected the API key')
            : new AgentError('closed', `Listener closed (${ev.code})`));
        }
        if (this.ws === ws) this.closeListeners.forEach(fn => fn());
      };
    });
  }

  sendPcm(chunk: Int16Array): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    // Mic chunks are always ArrayBuffer-backed; the cast only satisfies TS >= 5.7's generic typed arrays.
    this.ws.send(chunk as Int16Array<ArrayBuffer>);
    return true;
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'Terminate' }));
    setTimeout(() => ws?.close(), 300);
  }
}
