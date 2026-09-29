import { useEffect, useRef, useState } from 'react';
import { Check, Flame, Plus } from 'lucide-react';
import { MIN, fmtTime, type PlannedDish } from '../kitchen/planner';
import type { DishId } from '../kitchen/recipes';
import { ticketSteps, ticketView, type TicketState } from '../kitchen/views';
import { DishPhoto } from './DishPhoto';
import { shortDuration } from './format';
import './DishTicket.css';

const RING_R = 27;
const RING_C = 2 * Math.PI * RING_R;
const REPLAN_SHOW_MS = 2800;

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
    const t = window.setTimeout(() => setReplan(null), REPLAN_SHOW_MS);
    return () => window.clearTimeout(t);
  }, [replan]);

  return replan;
}

const STATE_LABEL: Record<TicketState, string> = {
  waiting: 'Waiting',
  fire: 'Fire · start now',
  cooking: 'Cooking',
  holding: 'Holding',
  ready: 'Ready · keep warm',
};

function bigTime(state: TicketState, remaining: number): string {
  if (state === 'ready') return 'Ready';
  if (state === 'waiting') return `in ${shortDuration(remaining)}`;
  if (state === 'holding') return `next in ${shortDuration(remaining)}`;
  return `${shortDuration(remaining)} left`;
}

function StateMark({ state }: { state: TicketState }) {
  if (state === 'fire') return <Flame className="ticket-mark" size={15} strokeWidth={2.5} aria-hidden="true" />;
  if (state === 'ready') return <Check className="ticket-mark" size={15} strokeWidth={3} aria-hidden="true" />;
  return <span className="ticket-mark ticket-dot" aria-hidden="true" />;
}

const clock = (t: number) => fmtTime(t).replace(/\s?[AP]M$/, '');

export interface DishTicketProps {
  dish: PlannedDish;
  now: number;
  /** Five or more dishes: only the step that matters is listed. */
  compact?: boolean;
  onDelay?: (dish: DishId, minutes: number) => void;
  onDone?: (dish: DishId) => void;
}

export function DishTicket({ dish, now, compact = false, onDelay, onDone }: DishTicketProps) {
  const view = ticketView(dish, now);
  const replan = useReplan(dish);
  const fill = view.state === 'ready' ? 1 : view.step ? 1 - view.progress : 0;
  const time = bigTime(view.state, view.remainingMs);
  const current = view.step ?? view.next;
  const list = compact
    ? { steps: dish.steps.filter(s => s.id === current?.id), doneBefore: 0, moreAfter: 0 }
    : ticketSteps(dish.steps, current?.id ?? null);
  const steps = list.steps;

  return (
    <article
      className={`ticket-wrap is-${view.state}${compact ? ' is-compact' : ''}`}
      data-testid={`ticket-${dish.id}`}
      data-state={view.state}
      aria-label={`${dish.name}: ${STATE_LABEL[view.state]}, ${time}${current ? `, ${current.label}` : ''}`}
    >
      <div className="ticket">
        <header className="ticket-status">
          <StateMark state={view.state} />
          <span className="ticket-status-text">{STATE_LABEL[view.state]}</span>
          {replan && (
            <span className="ticket-delta num" key={replan.n} data-testid={`ticket-delta-${dish.id}`}>
              {replan.minutes > 0 ? '+' : '−'}
              {Math.abs(replan.minutes)} min
            </span>
          )}
          {view.state === 'fire' && <span className="ticket-heat" aria-hidden="true" />}
        </header>

        <div className="ticket-head">
          <div className="ticket-dish">
            <div className="ticket-ring">
              <svg viewBox="0 0 60 60" aria-hidden="true">
                <circle className="ring-track" cx="30" cy="30" r={RING_R} />
                <circle className="ring-fill" cx="30" cy="30" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - fill)} />
              </svg>
              <DishPhoto src={dish.photo} size={compact ? 38 : 48} />
            </div>
            <h3 className="ticket-name">{dish.name}</h3>
            <p className="ticket-big num">{time}</p>
          </div>
        </div>

        {steps.length > 0 && (
          <ol className="ticket-steps" aria-label={`${dish.name} steps`}>
            {list.doneBefore > 0 && (
              <li className="ticket-row is-summary is-done">
                <span className="row-mark" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="row-label">{list.doneBefore} steps done</span>
              </li>
            )}
            {steps.map(s => {
              const isCurrent = current?.id === s.id && s.status !== 'done';
              return (
                <li
                  key={s.id}
                  className={`ticket-row is-${s.status}${isCurrent ? ' is-current' : ''}${replan?.moved.has(s.id) ? ' is-moved' : ''}`}
                  aria-current={s.status === 'active' ? 'step' : undefined}
                >
                  <span className="row-mark" aria-hidden="true">
                    {s.status === 'done' ? (
                      <Check size={12} strokeWidth={3} />
                    ) : s.status === 'active' && view.state === 'fire' ? (
                      <Flame size={13} strokeWidth={2.5} />
                    ) : null}
                  </span>
                  <span className="row-time num">{clock(s.start)}</span>
                  <span className="row-label">{s.label}</span>
                </li>
              );
            })}
            {list.moreAfter > 0 && (
              <li className="ticket-row is-summary">
                <span className="row-label">{list.moreAfter} more steps</span>
              </li>
            )}
          </ol>
        )}

        {view.state !== 'ready' && (onDelay || onDone) && (
          <div className="ticket-actions">
            {onDelay && (
              <button type="button" className="ticket-btn" onClick={() => onDelay(dish.id, 5)} aria-label={`${dish.name} needs 5 more minutes`}>
                <Plus size={14} strokeWidth={2.5} aria-hidden="true" /> 5 min
              </button>
            )}
            {onDone && view.step && (
              <button type="button" className="ticket-btn" onClick={() => onDone(dish.id)} aria-label={`${dish.name}: ${view.step.label} is done`}>
                <Check size={14} strokeWidth={2.5} aria-hidden="true" /> Done
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
