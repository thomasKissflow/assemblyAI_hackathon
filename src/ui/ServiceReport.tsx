import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { fmtTime } from '../kitchen/planner';
import type { KitchenState } from '../kitchen/store';
import './ServiceReport.css';

export function ServiceReport({ state, onCookAgain }: { state: KitchenState; onCookAgain: () => void }) {
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus(), []);
  const plan = state.plan;
  if (!plan) return null;
  const calls = state.log.filter(e => e.kind === 'call').length;
  const questions = state.log.filter(e => e.kind === 'cook').length;
  const stats: [string, string][] = [
    ['Served at', fmtTime(plan.serveAt)],
    ['Re-plans', String(state.replans)],
    ['Calls made', String(calls)],
    ['Questions answered', String(questions)],
    ['Hands washed to touch a screen', '0'],
  ];

  return (
    <div className="service" data-testid="service-report" role="dialog" aria-modal="true" aria-labelledby="service-title">
      <div className="service-card">
        <div className="service-plates" aria-hidden="true">
          {plan.dishes.map((d, i) => (
            <img key={d.id} src={d.photo} alt="" width={120} height={120} style={{ animationDelay: `${120 + i * 90}ms` }} />
          ))}
        </div>
        <h2 id="service-title" className="service-title">Service.</h2>
        <p className="service-sub">Everything’s ready. Plate up.</p>
        <dl className="service-stats">
          {stats.map(([k, v]) => (
            <div key={k} className="service-stat">
              <dt>{k}</dt>
              <dd className="num">{v}</dd>
            </div>
          ))}
        </dl>
        <button ref={again} type="button" className="btn btn-fire" onClick={onCookAgain} data-testid="cook-again">
          <RotateCcw size={18} aria-hidden="true" /> Cook again
        </button>
      </div>
    </div>
  );
}
