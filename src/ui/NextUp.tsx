import { Flame, UtensilsCrossed } from 'lucide-react';
import { fmtTime, upcoming, type Plan, type PlannedDish, type PlannedStep } from '../kitchen/planner';
import { FIRE_WINDOW_MS } from '../kitchen/views';
import { DishPhoto } from './DishPhoto';
import { shortDuration } from './format';
import './NextUp.css';

export interface Firing {
  dish: PlannedDish;
  step: PlannedStep;
}

/** Steps that started within the fire window, newest first. */
export function currentFires(plan: Plan, now: number): Firing[] {
  const fires: Firing[] = [];
  for (const dish of plan.dishes) {
    for (const step of dish.steps) {
      if (step.status === 'active' && now - step.start < FIRE_WINDOW_MS) fires.push({ dish, step });
    }
  }
  return fires.sort((a, b) => b.step.start - a.step.start);
}

export function currentFire(plan: Plan, now: number): Firing | null {
  return currentFires(plan, now)[0] ?? null;
}

/** One short sentence for screen readers; changes only when the call itself changes. */
export function callAnnouncement(plan: Plan, now: number): string {
  const fire = currentFire(plan, now);
  if (fire) return `Now: ${fire.dish.name}, ${fire.step.label}.`;
  const next = upcoming(plan, now, 1)[0];
  if (next) return `Next: ${next.dish}, ${next.label}, at ${fmtTime(next.at)}.`;
  return plan.served ? 'Service. Everything is ready.' : `Every dish is on. Serving at ${fmtTime(plan.serveAt)}.`;
}

export function NextUp({ plan, now, size = 'panel' }: { plan: Plan; now: number; size?: 'panel' | 'glance' }) {
  const [fire, ...alsoFiring] = currentFires(plan, now);
  const [next, then] = upcoming(plan, now, 2);
  const nextDish = next ? plan.dishes.find(d => d.id === next.dishId) : undefined;
  const state = fire ? 'now' : next ? 'next' : 'done';
  const Heading = size === 'panel' ? 'h2' : 'p';

  return (
    <section className={`next-up next-up--${size} is-${state}`} data-testid={size === 'panel' ? 'next-up' : undefined} data-state={state}>
      {fire ? (
        <>
          <div className="next-up-head">
            <span className="next-up-pill">
              <Flame size={16} strokeWidth={2.5} aria-hidden="true" /> Now
            </span>
            <DishPhoto src={fire.dish.photo} size={36} />
            <span className="next-up-dish">{fire.dish.name}</span>
          </div>
          <Heading className="next-up-call">{fire.step.label}</Heading>
          <p className="next-up-meta">{fire.step.call}</p>
          {alsoFiring.map(f => (
            <p key={`${f.dish.id}-${f.step.id}`} className="next-up-also">
              Also now: <strong>{f.dish.name}</strong>, {f.step.label.toLowerCase()}
            </p>
          ))}
        </>
      ) : next && nextDish ? (
        <>
          <div className="next-up-head">
            <span className="next-up-kicker">Next up</span>
            <DishPhoto src={nextDish.photo} size={36} />
            <span className="next-up-dish">{next.dish}</span>
          </div>
          <Heading className="next-up-call">{next.label}</Heading>
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
          <Heading className="next-up-call">{plan.served ? 'Plate up.' : `Serving at ${fmtTime(plan.serveAt)}`}</Heading>
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
