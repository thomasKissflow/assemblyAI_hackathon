import { Flame, UtensilsCrossed } from 'lucide-react';
import { fmtTime, upcoming, type Plan, type PlannedDish, type PlannedStep } from '../kitchen/planner';
import { FIRE_WINDOW_MS } from '../kitchen/views';
import { shortDuration } from './format';
import './NextUp.css';

export interface Firing {
  dish: PlannedDish;
  step: PlannedStep;
}

export function currentFire(plan: Plan, now: number): Firing | null {
  let best: Firing | null = null;
  for (const dish of plan.dishes) {
    for (const step of dish.steps) {
      if (step.status === 'active' && now - step.start < FIRE_WINDOW_MS && (!best || step.start > best.step.start)) best = { dish, step };
    }
  }
  return best;
}

export function NextUp({ plan, now, size = 'panel' }: { plan: Plan; now: number; size?: 'panel' | 'glance' }) {
  const fire = currentFire(plan, now);
  const [next, then] = upcoming(plan, now, 2);
  const nextDish = next ? plan.dishes.find(d => d.id === next.dishId) : undefined;
  const state = fire ? 'now' : next ? 'next' : 'done';

  return (
    <section className={`next-up next-up--${size} is-${state}`} data-testid={size === 'panel' ? 'next-up' : undefined} data-state={state} aria-live="polite">
      {fire ? (
        <>
          <div className="next-up-head">
            <span className="next-up-pill">
              <Flame size={16} strokeWidth={2.5} aria-hidden="true" /> Now
            </span>
            <img src={fire.dish.photo} alt="" width={36} height={36} />
            <span className="next-up-dish">{fire.dish.name}</span>
          </div>
          <p className="next-up-call">{fire.step.label}</p>
          <p className="next-up-meta num">{fire.step.call}</p>
        </>
      ) : next && nextDish ? (
        <>
          <div className="next-up-head">
            <span className="next-up-kicker">Next up</span>
            <img src={nextDish.photo} alt="" width={36} height={36} />
            <span className="next-up-dish">{next.dish}</span>
          </div>
          <p className="next-up-call">{next.label}</p>
          <p className="next-up-meta num">
            <span className="next-up-in">in {shortDuration(next.at - now)}</span>
            <span className="next-up-at">at {fmtTime(next.at)}</span>
          </p>
        </>
      ) : (
        <>
          <div className="next-up-head">
            <span className="next-up-kicker">
              <UtensilsCrossed size={16} aria-hidden="true" /> {plan.served ? 'Service' : 'All on'}
            </span>
          </div>
          <p className="next-up-call">{plan.served ? 'Plate up.' : `Serving at ${fmtTime(plan.serveAt)}`}</p>
          <p className="next-up-meta">{plan.served ? 'Everything is ready.' : 'Every dish is cooking. Nothing left to start.'}</p>
        </>
      )}
      {then && !fire && size === 'panel' && (
        <p className="next-up-then num">
          Then {then.dish.toLowerCase()}, {then.label.toLowerCase()} at {fmtTime(then.at)}
        </p>
      )}
    </section>
  );
}
