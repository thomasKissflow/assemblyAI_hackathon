import { useRef } from 'react';
import { Hand, Mic, MicOff } from 'lucide-react';
import type { SessionPhase, VoiceStatus } from '../voice/useChefSession';
import { Waveform } from './Waveform';
import './VoiceBar.css';

export interface VoiceBarProps {
  voice: VoiceStatus;
  phase: SessionPhase;
  levels: () => { mic: number; out: number };
  onToggleMute: () => void;
  onPushToTalk: (down: boolean) => void;
}

function describe(voice: VoiceStatus, phase: SessionPhase): { label: string; mode: string } {
  if (phase === 'connecting') return { label: 'Connecting to Chef…', mode: 'connecting' };
  if (phase === 'error') return { label: 'Chef can’t hear you right now', mode: 'error' };
  if (voice.muted) return { label: 'Muted', mode: 'muted' };
  if (voice.pushToTalk) return { label: 'Talking to Chef…', mode: 'listening' };
  if (voice.userSpeaking && voice.ears !== 'asleep') return { label: 'Heard you…', mode: 'listening' };
  if (voice.chefSpeaking) return { label: 'Chef is talking', mode: 'chef' };
  if (voice.ears === 'awake') return { label: 'Listening…', mode: 'listening' };
  if (voice.ears === 'followup') return { label: 'Go on…', mode: 'followup' };
  return { label: 'Say “Hey Chef”', mode: 'asleep' };
}

export function VoiceBar({ voice, phase, levels, onToggleMute, onPushToTalk }: VoiceBarProps) {
  const { label, mode } = describe(voice, phase);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const level = () => {
    const { mic, out } = levels();
    const m = modeRef.current;
    return m === 'chef' ? out : m === 'muted' || m === 'error' ? 0 : mic;
  };
  const release = () => onPushToTalk(false);

  return (
    <section className={`voice-bar is-${mode}`} data-testid="voice-bar" data-ears={voice.ears} aria-label="Chef's ears">
      <div className="voice-state">
        <span className="voice-dot" aria-hidden="true">
          {voice.ears === 'followup' && !voice.chefSpeaking && (
            <svg viewBox="0 0 36 36" className="voice-arc">
              <circle cx="18" cy="18" r="16" />
            </svg>
          )}
          {voice.muted ? <MicOff size={18} /> : <Mic size={18} />}
        </span>
        <span className="voice-label" aria-live="polite">
          {label}
        </span>
      </div>
      <Waveform level={level} className="voice-wave" />
      <div className="voice-actions">
        <button
          type="button"
          className="icon-btn"
          aria-pressed={voice.muted}
          aria-label={voice.muted ? 'Unmute mic (M)' : 'Mute mic (M)'}
          title={voice.muted ? 'Unmute mic (M)' : 'Mute mic (M)'}
          onClick={onToggleMute}
        >
          {voice.muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          type="button"
          className="btn btn-ghost voice-ptt"
          aria-pressed={voice.pushToTalk}
          onPointerDown={() => onPushToTalk(true)}
          onPointerUp={release}
          onPointerLeave={() => voice.pushToTalk && release()}
          onPointerCancel={release}
          title="Hold to talk to Chef (hold Space)"
        >
          <Hand size={16} aria-hidden="true" /> Hold to talk <kbd>Space</kbd>
        </button>
      </div>
    </section>
  );
}
