import { useEffect, useRef, useState } from 'react';
import { ChefHat, Maximize2, Pause, Play, SkipForward, X } from 'lucide-react';
import { fmtTime } from '../kitchen/planner';
import { SPEEDS, type KitchenState } from '../kitchen/store';
import { SplitFlap } from './SplitFlap';
import './TopBar.css';

export interface TopBarProps {
  state: KitchenState;
  onSpeed: (speed: number) => void;
  onPause: () => void;
  onSkip: () => void;
  onGlance: () => void;
  onEnd: () => void;
}

function useServeShift(shift: KitchenState['lastServeShift']) {
  const [shown, setShown] = useState<{ id: number; minutes: number } | null>(null);
  const seen = useRef(shift?.id);
  useEffect(() => {
    if (!shift || shift.id === seen.current) return;
    seen.current = shift.id;
    setShown(shift);
    const t = window.setTimeout(() => setShown(null), 2600);
    return () => window.clearTimeout(t);
  }, [shift]);
  return shown;
}

export function TopBar({ state, onSpeed, onPause, onSkip, onGlance, onEnd }: TopBarProps) {
  const shift = useServeShift(state.lastServeShift);
  const plan = state.plan;
  const paused = state.clock.paused;

  return (
    <header className="topbar">
      <h1 className="brand">
        <span className="brand-mark" aria-hidden="true">
          <ChefHat size={22} strokeWidth={2.25} />
        </span>
        <span className="brand-name">Heard, Chef</span>
      </h1>

      <div className="clocks">
        <div className={paused ? 'clock-block is-paused' : 'clock-block'}>
          <span className="clock-label">{paused ? 'Paused' : 'Kitchen time'}</span>
          <SplitFlap value={fmtTime(state.now)} label="Kitchen time" testId="kitchen-clock" />
        </div>
        {plan && (
          <div className="clock-block clock-serve">
            <span className="clock-label">Serving at</span>
            <SplitFlap value={fmtTime(plan.serveAt)} label="Serving at" tone="saffron" testId="serve-time" />
            {shift && (
              <span className="serve-delta num" key={shift.id} data-testid="serve-delta">
                {shift.minutes > 0 ? '+' : '−'}
                {Math.abs(shift.minutes)} min
              </span>
            )}
          </div>
        )}
      </div>

      <div className="controls">
        <div className="speed" role="group" aria-label="Kitchen clock speed (S)">
          {SPEEDS.map(s => (
            <button
              key={s}
              type="button"
              className="speed-btn num"
              aria-pressed={state.clock.speed === s}
              onClick={() => onSpeed(s)}
              title={s === 1 ? 'Real time' : `${s}× demo speed`}
            >
              {s}×
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" onClick={onPause} aria-label={paused ? 'Resume (P)' : 'Pause (P)'} title={paused ? 'Resume (P)' : 'Pause (P)'}>
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <button type="button" className="icon-btn" onClick={onSkip} aria-label="Skip to next call (N)" title="Skip to next call (N)">
          <SkipForward size={18} />
        </button>
        <button type="button" className="btn btn-ghost glance-btn" onClick={onGlance} title="Glance mode (G)">
          <Maximize2 size={16} aria-hidden="true" /> Glance
        </button>
        <button type="button" className="icon-btn" onClick={onEnd} aria-label="End dinner" title="End dinner">
          <X size={18} />
        </button>
      </div>
    </header>
  );
}
