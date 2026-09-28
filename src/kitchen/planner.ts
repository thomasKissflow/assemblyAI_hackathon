import { RECIPES, type DishId, type RecipeStep } from './recipes';

export const MIN = 60_000;

export type StepStatus = 'pending' | 'active' | 'done';
export interface PlannedStep extends RecipeStep {
  start: number;
  end: number;
  status: StepStatus;
}
export interface PlannedDish {
  id: DishId;
  name: string;
  short: string;
  photo: string;
  steps: PlannedStep[];
}
export interface Plan {
  serveAt: number;
  served: boolean;
  dishes: PlannedDish[];
}
export type KitchenEvent =
  | { type: 'step-started'; dishId: DishId; step: PlannedStep }
  | { type: 'step-done'; dishId: DishId; step: PlannedStep }
  | { type: 'serve' };

const ceilToMinute = (t: number) => Math.ceil(t / MIN) * MIN;

export function earliestFinish(d: PlannedDish, now: number): number {
  let t = now;
  for (const st of d.steps) {
    if (st.status === 'done') continue;
    if (st.status === 'active') {
      t = Math.max(t, st.end);
      continue;
    }
    t += st.minutes * MIN;
  }
  return t;
}

export function align(plan: Plan, now: number): Plan {
  const serveAt = ceilToMinute(Math.max(plan.serveAt, ...plan.dishes.map(d => earliestFinish(d, now))));
  const dishes = plan.dishes.map(d => {
    const steps = [...d.steps];
    let t = serveAt;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status !== 'pending') break;
      steps[i] = { ...steps[i], end: t, start: t - steps[i].minutes * MIN };
      t = steps[i].start;
    }
    return { ...d, steps };
  });
  return { ...plan, serveAt, dishes };
}

export function createPlan(ids: DishId[], serveAt: number, now: number): Plan {
  const dishes: PlannedDish[] = ids.map(id => {
    const r = RECIPES[id];
    return {
      id, name: r.name, short: r.short, photo: r.photo,
      steps: r.steps.map(st => ({ ...st, start: 0, end: 0, status: 'pending' as const })),
    };
  });
  return align({ serveAt, served: false, dishes }, now);
}

export function advance(plan: Plan, now: number): { plan: Plan; events: KitchenEvent[] } {
  const events: KitchenEvent[] = [];
  const dishes = plan.dishes.map(d => {
    const steps = d.steps.map(st => ({ ...st }));
    for (const st of steps) {
      if (st.status === 'pending' && st.start <= now) {
        st.status = 'active';
        events.push({ type: 'step-started', dishId: d.id, step: st });
      }
      if (st.status === 'active' && st.end <= now) {
        st.status = 'done';
        events.push({ type: 'step-done', dishId: d.id, step: st });
      }
    }
    return { ...d, steps };
  });
  let served = plan.served;
  if (!served && now >= plan.serveAt && dishes.every(d => d.steps.every(st => st.status === 'done'))) {
    served = true;
    events.push({ type: 'serve' });
  }
  if (events.length === 0) return { plan, events };
  return { plan: { ...plan, served, dishes }, events };
}

function mapDish(plan: Plan, id: DishId, fn: (d: PlannedDish) => PlannedDish): Plan {
  return { ...plan, dishes: plan.dishes.map(d => (d.id === id ? fn(d) : d)) };
}

export function reportDelay(plan: Plan, id: DishId, minutes: number, now: number): Plan {
  const add = minutes * MIN;
  return align(mapDish(plan, id, d => {
    const a = d.steps.findIndex(st => st.status === 'active');
    if (a >= 0) return { ...d, steps: d.steps.map((st, i) => (i === a ? { ...st, end: Math.max(st.end, now) + add } : st)) };
    const p = d.steps.findIndex(st => st.status === 'pending');
    if (p >= 0) return { ...d, steps: d.steps.map((st, i) => (i === p ? { ...st, minutes: st.minutes + minutes } : st)) };
    return d;
  }), now);
}

export function restartStep(plan: Plan, id: DishId, now: number): Plan {
  return align(mapDish(plan, id, d => {
    let i = d.steps.findIndex(st => st.status === 'active');
    if (i < 0) {
      for (let j = d.steps.length - 1; j >= 0; j--) {
        if (d.steps[j].status === 'done') {
          i = j;
          break;
        }
      }
    }
    if (i < 0) return d;
    return {
      ...d,
      steps: d.steps.map((st, k) => (k === i ? { ...st, status: 'active' as const, start: now, end: now + st.minutes * MIN } : st)),
    };
  }), now);
}

export function markDone(plan: Plan, id: DishId, now: number): Plan {
  return align(mapDish(plan, id, d => ({
    ...d,
    steps: d.steps.map(st => (st.status === 'active' ? { ...st, status: 'done' as const, end: now } : st)),
  })), now);
}

export function shiftServe(plan: Plan, minutes: number, now: number): Plan {
  return align({ ...plan, serveAt: plan.serveAt + minutes * MIN }, now);
}

export interface UpcomingCall {
  dishId: DishId;
  dish: string;
  label: string;
  call: string;
  at: number;
}

export function upcoming(plan: Plan, now: number, limit = 3): UpcomingCall[] {
  return plan.dishes
    .flatMap(d => d.steps
      .filter(st => st.status === 'pending' && st.start >= now)
      .map(st => ({ dishId: d.id, dish: d.name, label: st.label, call: st.call, at: st.start })))
    .sort((a, b) => a.at - b.at)
    .slice(0, limit);
}

export const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/ /g, ' ');

export function describeChange(before: Plan, after: Plan): string {
  const parts: string[] = [];
  if (after.serveAt !== before.serveAt) parts.push(`Serving now ${fmtTime(after.serveAt)} (was ${fmtTime(before.serveAt)}).`);
  for (const d of after.dishes) {
    const prev = before.dishes.find(x => x.id === d.id);
    const next = d.steps.find(st => st.status === 'pending');
    const prevNext = prev?.steps.find(st => st.id === next?.id);
    if (next && prevNext && next.start !== prevNext.start) parts.push(`${d.name}: ${next.label.toLowerCase()} at ${fmtTime(next.start)}.`);
  }
  return parts.length ? parts.join(' ') : 'No change to the plan.';
}
