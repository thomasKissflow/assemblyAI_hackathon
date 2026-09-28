export interface VoiceGate {
  userSpeaking: boolean;
  replyInProgress: boolean;
  pendingToolResults: number;
}
interface Queued {
  text: string;
  isRetry: boolean;
}
interface InFlight extends Queued {
  sentAt: number;
  heardAudio: boolean;
}

export const CALL_TIMEOUT_MS = 4000;
export const callInstructions = (text: string) => `Say exactly this kitchen call and nothing else: "${text}"`;

export class CalloutQueue {
  private queue: Queued[] = [];
  private inFlight: InFlight | null = null;
  private readonly send: (instructions: string) => void;

  constructor(send: (instructions: string) => void) {
    this.send = send;
  }

  push(text: string) {
    this.queue.push({ text, isRetry: false });
  }

  get pending() {
    return this.queue.length + (this.inFlight ? 1 : 0);
  }

  get busy() {
    return this.inFlight !== null;
  }

  pump(gate: VoiceGate, now: number) {
    if (this.inFlight && !gate.replyInProgress && now - this.inFlight.sentAt > CALL_TIMEOUT_MS) this.dropInFlight();
    if (this.inFlight || this.queue.length === 0) return;
    if (gate.userSpeaking || gate.replyInProgress || gate.pendingToolResults > 0) return;
    const batch = this.queue.splice(0);
    const text = batch.map(q => q.text).join(' ');
    this.inFlight = { text, isRetry: batch.every(q => q.isRetry), sentAt: now, heardAudio: false };
    this.send(callInstructions(text));
  }

  onReplyAudio() {
    if (this.inFlight) this.inFlight.heardAudio = true;
  }

  onReplyDone() {
    if (!this.inFlight) return;
    if (this.inFlight.heardAudio) this.inFlight = null;
    else this.dropInFlight();
  }

  private dropInFlight() {
    const f = this.inFlight;
    this.inFlight = null;
    if (f && !f.isRetry) this.queue.unshift({ text: f.text, isRetry: true });
  }
}
