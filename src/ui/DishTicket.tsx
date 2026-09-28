import { useEffect, useRef, useState } from 'react';
import { Check, Flame } from 'lucide-react';
import { MIN, fmtTime, type PlannedDish } from '../kitchen/planner';
import { ticketView, type TicketState } from '../kitchen/views';
import { shortDuration } from './format';
import './DishTicket.css';

const RING_R = 58;
const RING_C = 2 * Math.PI * RING_R;

interface Replan {
  minutes: number;
  moved: Set<string>;
  n: number;
}

function useReplan(dish: PlannedDish): Replan | null {
  const seen = useRef<Map<string, number>>(new Map());
  const [replan, setReplan] = useState<Replan | null>(null);

  useEffect(() => {
    const pending = dish.steps.filter(s => s.status === 'pending');
    const moved = new Set<string>();
    let minutes = 0;
    for (const s of pending) {
      const before = seen.current.get(s.id);
      if (before !== undefined && before !== s.start) {
        moved.add(s.id);
        if (minutes === 0) minutes = Math.round((s.start - before) / MIN);
      }
    }
    seen.current = new Map(pending.map(s => [s.id, s.start]));
    if (moved.size && minutes !== 0) setReplan(r => ({ minutes, moved, n: (r?.n ?? 0) + 1 }));
  }, [dish]);

  useEffect(() => {
    if (!replan) return;
    const t = window.setTimeout(() => setReplan(null), 2800);
    return () => window.clearTimeout(t);
  }, [replan]);

  return replan;
}

function bandText(state: TicketState, remaining: number, nextAt: number | null): string {
  switch (state) {
    case 'fire':
      return 'Fire · now';
    case 'cooking':
      return `Cooking · ${shortDuration(remaining)} left`;
    case 'holding':
      return nextAt ? `Hold · next ${fmtTime(nextAt)}` : 'Hold';
    case 'waiting':
      return nextAt ? `Starts ${fmtTime(nextAt)}` : 'Waiting';
    case 'ready':
      return 'Ready · keep warm';
  }
}

const clock = (t: number) => fmtTime(t).replace(/\s?[AP]M$/, '');

export function DishTicket({ dish, now }: { dish: PlannedDish; now: number }) {
  const view = ticketView(dish, now);
  const replan = useReplan(dish);
  const fillFraction = view.state === 'ready' ? 1 : view.step ? 1 - view.progress : 0;
  const detail = view.step ?? view.next;

  return (
    <article
      className={`ticket-wrap is-${view.state}`}
      data-testid={`ticket-${dish.id}`}
      data-state={view.state}
      aria-label={`${dish.name}: ${bandText(view.state, view.remainingMs, view.next?.start ?? null)}`}
    >
      <div className="ticket">
        <header className="ticket-band">
          {view.state === 'fire' && <Flame size={16} strokeWidth={2.5} aria-hidden="true" />}
          {view.state === 'ready' && <Check size={16} strokeWidth={3} aria-hidden="true" />}
          <span className="ticket-band-text num">{bandText(view.state, view.remainingMs, view.next?.start ?? null)}</span>
          {replan && (
            <span className="ticket-delta num" key={replan.n} data-testid={`ticket-delta-${dish.id}`}>
              {replan.minutes > 0 ? '+' : '−'}
              {Math.abs(replan.minutes)} min
            </span>
          )}
          {view.state === 'fire' && <span className="ticket-heat" aria-hidden="true" />}
        </header>

        <div className="ticket-hero">
          <div className="ticket-ring">
            <svg viewBox="0 0 132 132" aria-hidden="true">
              <circle className="ring-track" cx="66" cy="66" r={RING_R} />
              <circle
                className="ring-fill"
                cx="66"
                cy="66"
                r={RING_R}
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - fillFraction)}
              />
            </svg>
            <img src={dish.photo} alt="" width={104} height={104} loading="lazy" />
          </div>
          <div className="ticket-head">
            <h3 className="ticket-name">{dish.name}</h3>
            <p className="ticket-step">{detail ? detail.label : 'Plated and waiting'}</p>
            <p className="ticket-time num">
              {view.step
                ? `${shortDuration(view.remainingMs)} left`
                : view.next
                  ? `at ${fmtTime(view.next.start)}`
                  : 'Ready'}
            </p>
          </div>
        </div>

        <ol className="ticket-steps" aria-label={`${dish.name} steps`}>
          {dish.steps.map(s => (
            <li
              key={s.id}
              className={`ticket-row is-${s.status}${replan?.moved.has(s.id) ? ' is-moved' : ''}`}
              aria-current={s.status === 'active' ? 'step' : undefined}
            >
              <span className="row-mark" aria-hidden="true">
                {s.status === 'done' ? <Check size={13} strokeWidth={3} /> : s.status === 'active' ? <Flame size={13} strokeWidth={2.5} /> : null}
              </span>
              <span className="row-time num">{clock(s.start)}</span>
              <span className="row-label">{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
