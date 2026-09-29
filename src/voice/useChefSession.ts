import { useCallback, useEffect, useRef, useState } from 'react';
import type { KitchenStore } from '../kitchen/store';
import { libraryStore } from '../kitchen/library';
import { callText } from '../kitchen/calls';
import { AgentError, AgentSocket, type ServerEvent } from './agentSocket';
import { SttSocket, type SttTurn } from './sttSocket';
import { AudioEngine } from './audio';
import { CalloutQueue, type VoiceGate } from './calloutQueue';
import { buildSession, sttKeyterms } from './agentConfig';
import { executeTool, type ToolResult } from './tools';
import { findWake, stripWake } from './wake';
import { Ears, type EarState } from './ears';
import { PreRoll } from './preroll';
import { CaptionFeed } from './captionFeed';
import { int16ToBase64 } from './pcm';

export type SessionPhase = 'idle' | 'connecting' | 'live' | 'error';
export interface VoiceStatus {
  ears: EarState;
  pushToTalk: boolean;
  userSpeaking: boolean;
  chefSpeaking: boolean;
  muted: boolean;
}

const API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY;
export const hasApiKey = Boolean(API_KEY);

const CHUNK_MS = 50;
const SILENCE = int16ToBase64(new Int16Array(1200));
const WAKE_PAD_MS = 150;
const WAKE_DEDUPE_MS = 1500;
const WAKE_STALE_MS = 6000;
const FOLLOW_UP_WAIT_MS = 3000;
const QUIET: VoiceStatus = { ears: 'asleep', pushToTalk: false, userSpeaking: false, chefSpeaking: false, muted: false };
const LOST = 'Lost the connection to Chef. Check your internet, then reconnect.';

interface Runtime {
  socket: AgentSocket;
  stt: SttSocket;
  engine: AudioEngine;
  queue: CalloutQueue;
  ears: Ears;
  preroll: PreRoll;
  gate: VoiceGate;
  results: { callId: string; result: ToolResult }[];
  replyIsCall: boolean;
  hushed: boolean;
  followUpBy: number;
  streamMs: number;
  lastWakeAt: number;
  muted: boolean;
  timer: number;
  unsubscribe: () => void;
}

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'NotAllowedError') return 'Microphone is blocked. Allow it from the icon in the address bar, then try again.';
  if (err instanceof DOMException && err.name === 'NotFoundError') return 'No microphone found. Plug one in and try again.';
  if (err instanceof AgentError && err.code === 'unauthorized') return 'AssemblyAI rejected the API key. Check VITE_ASSEMBLYAI_API_KEY in .env.local.';
  if (err instanceof AgentError) return "Couldn't reach Chef. Check your internet connection and try again.";
  return `Something went wrong starting Chef: ${err instanceof Error ? err.message : String(err)}`;
}

async function teardown(r: Runtime) {
  window.clearInterval(r.timer);
  r.unsubscribe();
  r.socket.close();
  r.stt.close();
  await r.engine.close();
}

const sameVoice = (a: VoiceStatus, b: VoiceStatus) =>
  a.ears === b.ears && a.pushToTalk === b.pushToTalk && a.userSpeaking === b.userSpeaking && a.chefSpeaking === b.chefSpeaking && a.muted === b.muted;

export function useChefSession(store: KitchenStore) {
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceStatus>(QUIET);
  const [wakeCount, setWakeCount] = useState(0);
  const [captions] = useState(() => new CaptionFeed());
  const rt = useRef<Runtime | null>(null);

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase('error');
  }, []);

  const stop = useCallback(async () => {
    const r = rt.current;
    rt.current = null;
    if (r) await teardown(r);
    setVoice(QUIET);
    setPhase('idle');
  }, []);

  const start = useCallback(async () => {
    if (!API_KEY) {
      fail('Add your AssemblyAI key to .env.local as VITE_ASSEMBLYAI_API_KEY, then restart the dev server.');
      return;
    }
    const plan = store.getState().plan;
    if (!plan) return;
    if (rt.current) {
      const old = rt.current;
      rt.current = null;
      await teardown(old);
    }
    setPhase('connecting');
    setError(null);

    const engine = new AudioEngine();
    const socket = new AgentSocket();
    const stt = new SttSocket();
    const ears = new Ears();
    const preroll = new PreRoll(4000);
    const gate: VoiceGate = { userSpeaking: false, replyInProgress: false, pendingToolResults: 0 };
    const queue = new CalloutQueue(instructions => socket.replyCreate(instructions));
    const r: Runtime = {
      socket, stt, engine, queue, ears, preroll, gate, results: [], replyIsCall: false, hushed: false, followUpBy: 0,
      streamMs: 0, lastWakeAt: Number.NEGATIVE_INFINITY, muted: false, timer: 0, unsubscribe: () => {},
    };
    rt.current = r;

    // reply.audio arrives at about real time, so a flush alone only drops the ~150 ms already buffered and Chef talks on.
    // `hush` also drops the rest of the reply in progress, until the next reply starts.
    const interruptChef = (hush = false) => {
      if (hush && (gate.replyInProgress || engine.speaking)) r.hushed = true;
      if (engine.speaking) engine.flush();
      captions.chefEnd();
    };

    stt.onTurn((turn: SttTurn) => {
      const now = performance.now();
      const hit = findWake(turn.words);
      if (hit && Math.abs(hit.at - r.lastWakeAt) > WAKE_DEDUPE_MS && hit.at > r.streamMs - WAKE_STALE_MS) {
        const wasOpen = ears.open;
        r.lastWakeAt = hit.at;
        ears.wake(now);
        // With the ears asleep, whatever Chef is saying can't be the answer to this question: cut it off.
        interruptChef(!wasOpen);
        if (!wasOpen) for (const chunk of preroll.since(hit.at - WAKE_PAD_MS)) socket.sendAudio(chunk);
        setWakeCount(c => c + 1);
      }
      if (ears.open && Number.isFinite(r.lastWakeAt)) {
        const heard = turn.words.filter(w => w.start >= r.lastWakeAt).map(w => w.text).join(' ');
        captions.you(stripWake(heard), !turn.endOfTurn);
      }
    });
    stt.onClosed(() => { if (rt.current === r) fail(LOST); });

    socket.onEvent((e: ServerEvent) => {
      const now = performance.now();
      switch (e.type) {
        case 'input.speech.started':
          gate.userSpeaking = true;
          ears.userSpeaking(now);
          break;
        case 'input.speech.stopped':
          gate.userSpeaking = false;
          break;
        case 'transcript.user': {
          const text = stripWake(String(e.text ?? '')).trim();
          if (text) store.log('cook', text);
          break;
        }
        case 'reply.started':
          gate.replyInProgress = true;
          gate.pendingToolResults = 0;
          r.hushed = false;
          r.replyIsCall = queue.busy;
          if (!r.replyIsCall) ears.chefReplyStarted();
          captions.chefBegin();
          break;
        case 'reply.audio':
          if (r.hushed) break;
          captions.chefStartAt(engine.play(String(e.data ?? '')));
          queue.onReplyAudio();
          break;
        case 'transcript.agent.delta':
          if (!r.hushed) captions.chefWord({ text: String(e.delta ?? ''), startMs: Number(e.start_ms ?? 0), endMs: Number(e.end_ms ?? 0) });
          break;
        case 'transcript.agent':
          if (!r.replyIsCall && e.text) store.log('chef', String(e.text));
          if (e.interrupted) interruptChef();
          break;
        case 'tool.call':
          r.results.push({ callId: String(e.call_id), result: executeTool(store, String(e.name), e.arguments, libraryStore.getState().recipes) });
          gate.pendingToolResults = r.results.length;
          break;
        case 'reply.done': {
          gate.replyInProgress = false;
          if (e.status === 'interrupted') interruptChef();
          const answered = r.results.splice(0);
          for (const x of answered) socket.sendToolResult(x.callId, x.result);
          // Chef speaks the results in a follow-up reply. Hold callouts until it starts: a reply.create sent now
          // collides with it (measured: the follow-up ends at once with no audio and the call is said twice).
          gate.pendingToolResults = answered.length;
          r.followUpBy = now + FOLLOW_UP_WAIT_MS;
          queue.onReplyDone();
          if (!r.replyIsCall) ears.chefReplyDone(now);
          captions.chefEnd();
          break;
        }
        case 'session.error':
          store.log('system', `Voice error: ${String(e.message ?? e.code ?? 'unknown')}`);
          break;
        case 'socket.closed':
          if (rt.current === r) fail(LOST);
          break;
      }
      queue.pump(gate, now);
    });

    r.unsubscribe = store.onKitchenEvents(events => {
      for (const ev of events) {
        const text = callText(ev);
        if (text) queue.push(text);
      }
      queue.pump(gate, performance.now());
    });

    try {
      await engine.startMic(chunk => {
        const b64 = int16ToBase64(chunk);
        if (!r.muted && stt.sendPcm(chunk)) {
          preroll.push(r.streamMs, b64);
          r.streamMs += CHUNK_MS;
        }
        socket.sendAudio(ears.open && !r.muted ? b64 : SILENCE);
      });
      const library = libraryStore.getState().recipes;
      await Promise.all([stt.connect(API_KEY, sttKeyterms(plan, library)), socket.connect(API_KEY, buildSession(plan, library))]);
    } catch (err) {
      const current = rt.current === r;
      if (current) rt.current = null;
      await teardown(r);
      if (current) fail(describeError(err));
      return;
    }
    if (rt.current !== r) {
      // Stopped or restarted while connecting: teardown already ran, but the mic may have opened since.
      await teardown(r);
      return;
    }

    r.timer = window.setInterval(() => {
      const now = performance.now();
      ears.tick(now);
      if (!ears.open && captions.getSnapshot().you) captions.you('', false);
      if (gate.pendingToolResults > 0 && !gate.replyInProgress && now > r.followUpBy) gate.pendingToolResults = 0;
      queue.pump(gate, now);
      const next: VoiceStatus = { ears: ears.state, pushToTalk: ears.pushToTalk, userSpeaking: gate.userSpeaking, chefSpeaking: engine.speaking, muted: r.muted };
      setVoice(v => (sameVoice(v, next) ? v : next));
    }, 100);
    setPhase('live');
  }, [store, captions, fail]);

  const announce = useCallback((text: string) => {
    const r = rt.current;
    if (!r) return;
    r.queue.push(text);
    r.queue.pump(r.gate, performance.now());
  }, []);

  const setPushToTalk = useCallback((down: boolean) => {
    const r = rt.current;
    if (!r) return;
    r.ears.setPushToTalk(down, performance.now());
    if (down && (r.engine.speaking || r.gate.replyInProgress)) {
      r.hushed = true;
      r.engine.flush();
      captions.chefEnd();
    }
  }, [captions]);

  const toggleMute = useCallback(() => {
    const r = rt.current;
    if (!r) return;
    r.muted = !r.muted;
    setVoice(v => ({ ...v, muted: r.muted }));
  }, []);

  const levels = useCallback(() => rt.current?.engine.levels() ?? { mic: 0, out: 0 }, []);
  const audioTime = useCallback(() => rt.current?.engine.currentTime ?? 0, []);

  useEffect(() => () => {
    const r = rt.current;
    rt.current = null;
    if (r) void teardown(r);
  }, []);

  return { phase, error, voice, wakeCount, captions, start, stop, announce, setPushToTalk, toggleMute, levels, audioTime };
}

export type ChefSession = ReturnType<typeof useChefSession>;
