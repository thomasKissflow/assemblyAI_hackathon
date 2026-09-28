import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { fmtTime, type Plan } from '../kitchen/planner';
import { NextUp, currentFire } from './NextUp';
import { SplitFlap } from './SplitFlap';
import './GlanceMode.css';

export function GlanceMode({ plan, now, onClose }: { plan: Plan; now: number; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  const firing = currentFire(plan, now) !== null;

  return (
    <div className={firing ? 'glance is-fire' : 'glance'} data-testid="glance-mode" role="dialog" aria-modal="true" aria-label="Glance mode">
      <div className="glance-top">
        <div className="glance-clock">
          <span className="glance-label">Now</span>
          <SplitFlap value={fmtTime(now)} label="Kitchen time" size="lg" tone={firing ? 'fire' : 'ink'} />
        </div>
        <div className="glance-clock">
          <span className="glance-label">Serving at</span>
          <SplitFlap value={fmtTime(plan.serveAt)} label="Serving at" size="lg" tone="saffron" />
        </div>
        <button ref={close} type="button" className="icon-btn glance-close" onClick={onClose} aria-label="Close glance mode (Esc)" title="Close (Esc)">
          <X size={20} />
        </button>
      </div>
      <div className="glance-main">
        <NextUp plan={plan} now={now} size="glance" />
      </div>
      <p className="glance-hint">
        <kbd>G</kbd> or <kbd>Esc</kbd> to go back
      </p>
    </div>
  );
}
