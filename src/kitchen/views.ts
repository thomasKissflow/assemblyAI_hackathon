import { MIN, fmtTime, upcoming, type Plan, type PlannedDish, type PlannedStep } from './planner';

export const FIRE_WINDOW_MS = 2 * MIN;
export type TicketState = 'waiting' | 'fire' | 'cooking' | 'holding' | 'ready';

export interface TicketView {
  state: TicketState;
  step: PlannedStep | null;
  next: PlannedStep | null;
  progress: number;
  remainingMs: number;
  stepIndex: number;
  stepCount: number;
}

export function ticketView(d: PlannedDish, now: number): TicketView {
  const stepCount = d.steps.length;
  const activeIndex = d.steps.findIndex(s => s.status === 'active');
  const nextIndex = d.steps.findIndex(s => s.status === 'pending');
  const next = nextIndex >= 0 ? d.steps[nextIndex] : null;
  if (activeIndex >= 0) {
    const step = d.steps[activeIndex];
    const span = Math.max(1, step.end - step.start);
    return {
      state: now - step.start < FIRE_WINDOW_MS ? 'fire' : 'cooking',
      step, next,
      progress: Math.min(1, Math.max(0, (now - step.start) / span)),
      remainingMs: Math.max(0, step.end - now),
      stepIndex: activeIndex, stepCount,
    };
  }
  if (!next) return { state: 'ready', step: null, next: null, progress: 1, remainingMs: 0, stepIndex: stepCount - 1, stepCount };
  const started = d.steps.some(s => s.status === 'done');
  return {
    state: started ? 'holding' : 'waiting',
    step: null, next, progress: 0,
    remainingMs: Math.max(0, next.start - now),
    stepIndex: nextIndex, stepCount,
  };
}

/** A ticket lists at most this many rows, so a long recipe of the cook's own never pushes the rail off screen. */
export const TICKET_ROWS = 5;

export interface TicketSteps {
  steps: PlannedStep[];
  /** Finished steps above the window, shown as one "N done" row. */
  doneBefore: number;
  /** Steps below the window, shown as one "N more" row. */
  moreAfter: number;
}

/**
 * The steps a ticket lists: all of them when they fit, otherwise a window that runs from the step
 * just finished through what comes next, with the rest summarised. `focus` is the current step's id
 * (null once every step is done).
 */
export function ticketSteps(steps: PlannedStep[], focus: string | null, max = TICKET_ROWS): TicketSteps {
  const n = steps.length;
  if (n <= max) return { steps, doneBefore: 0, moreAfter: 0 };
  const at = steps.findIndex(s => s.id === focus);
  const lead = Math.max(0, (at >= 0 ? at : n - 1) - 1);
  if (lead + max - 1 >= n) return { steps: steps.slice(n - max + 1), doneBefore: n - max + 1, moreAfter: 0 };
  if (lead <= 1) return { steps: steps.slice(0, max - 1), doneBefore: 0, moreAfter: n - max + 1 };
  return { steps: steps.slice(lead, lead + max - 2), doneBefore: lead, moreAfter: n - lead - max + 2 };
}

export function kitchenStatus(plan: Plan, now: number): string {
  const lines = plan.dishes.map(d => {
    const v = ticketView(d, now);
    if (v.state === 'ready') return `${d.name}: ready.`;
    if (v.step) return `${d.name}: ${v.step.label.toLowerCase()}, ${Math.max(1, Math.ceil(v.remainingMs / MIN))} min left.`;
    return `${d.name}: ${v.next!.label.toLowerCase()} at ${fmtTime(v.next!.start)}.`;
  });
  const next = upcoming(plan, now, 1)[0];
  const nextLine = next ? ` Next call: ${next.dish.toLowerCase()}, ${next.label.toLowerCase()} at ${fmtTime(next.at)}.` : '';
  return `Serving at ${fmtTime(plan.serveAt)}. ${lines.join(' ')}${nextLine}`;
}
