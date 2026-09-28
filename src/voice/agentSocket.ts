import { AGENT_WS_URL, type SessionConfig } from './agentConfig';

export type ServerEvent = { type: string } & Record<string, unknown>;

export class AgentError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AgentError';
  }
}

export class AgentSocket {
  private ws: WebSocket | null = null;
  private readonly listeners = new Set<(e: ServerEvent) => void>();

  onEvent(fn: (e: ServerEvent) => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  connect(apiKey: string, session: SessionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${AGENT_WS_URL}?token=${encodeURIComponent(apiKey)}`);
      this.ws = ws;
      let ready = false;
      ws.onopen = () => this.send({ type: 'session.update', session });
      ws.onmessage = m => {
        const e = JSON.parse(String(m.data)) as ServerEvent;
        if (e.type === 'session.ready' && !ready) {
          ready = true;
          resolve();
        }
        if (e.type === 'session.error' && !ready) reject(new AgentError(String(e.code ?? 'error'), String(e.message ?? 'Session error')));
        this.listeners.forEach(fn => fn(e));
      };
      ws.onclose = ev => {
        if (!ready) reject(new AgentError('closed', `Connection closed (${ev.code})`));
        if (this.ws === ws) this.listeners.forEach(fn => fn({ type: 'socket.closed', code: ev.code }));
      };
    });
  }

  send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendAudio(b64: string) {
    this.send({ type: 'input.audio', audio: b64 });
  }

  sendToolResult(callId: string, result: unknown) {
    this.send({ type: 'tool.result', call_id: callId, result: JSON.stringify(result) });
  }

  replyCreate(instructions: string) {
    this.send({ type: 'reply.create', instructions });
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'session.end' }));
    setTimeout(() => ws?.close(), 300);
  }
}
