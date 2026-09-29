import { useSyncExternalStore } from 'react';
import type { DishId, Recipe } from './recipes';
import {
  MIN, advance, createPlan, describeChange, markDone, reportDelay, restartStep, shiftServe, upcoming,
  type KitchenEvent, type Plan, type UpcomingCall,
} from './planner';
import { createClock, jumpTo, kitchenNow, withPaused, withSpeed, type ClockState } from './clock';

export type LogKind = 'call' | 'chef' | 'cook' | 'change' | 'system';
export interface LogEntry {
  id: number;
  kind: LogKind;
  text: string;
  at: number;
}
export interface KitchenState {
  phase: 'setup' | 'ready' | 'cooking' | 'served';
  menuLabel: string;
  plan: Plan | null;
  clock: ClockState;
  now: number;
  log: LogEntry[];
  replans: number;
  lastServeShift: { id: number; minutes: number } | null;
}

export const DEFAULT_SPEED = 30;
export const SPEEDS = [1, 10, 30] as const;

export function demoStart(): number {
  const d = new Date();
  d.setHours(19, 15, 0, 0);
  return d.getTime();
}

export function createKitchenStore(realNow: () => number = () => performance.now()) {
  const start0 = demoStart();
  let state: KitchenState = {
    phase: 'setup', menuLabel: '', plan: null, clock: createClock(start0, realNow(), DEFAULT_SPEED),
    now: start0, log: [], replans: 0, lastServeShift: null,
  };
  const subs = new Set<() => void>();
  const eventSubs = new Set<(events: KitchenEvent[]) => void>();
  let logId = 0;
  let shiftId = 0;

  const set = (patch: Partial<KitchenState>) => {
    state = { ...state, ...patch };
    subs.forEach(fn => fn());
  };
  const entry = (kind: LogKind, text: string, at: number): LogEntry => ({ id: ++logId, kind, text, at });
  const currentNow = () => kitchenNow(state.clock, realNow());

  function change(mutate: (p: Plan, now: number) => Plan): string {
    if (!state.plan) return 'No dinner is running yet.';
    const now = currentNow();
    const before = state.plan;
    const after = mutate(before, now);
    const summary = describeChange(before, after);
    const deltaMin = Math.round((after.serveAt - before.serveAt) / MIN);
    set({
      plan: after, now,
      log: [...state.log, entry('change', summary, now)],
      replans: state.replans + 1,
      lastServeShift: deltaMin !== 0 ? { id: ++shiftId, minutes: deltaMin } : state.lastServeShift,
    });
    return summary;
  }

  function tick() {
    if (!state.plan || state.phase === 'setup' || state.phase === 'ready') return;
    const now = currentNow();
    const { plan, events } = advance(state.plan, now);
    if (now === state.now && events.length === 0) return;
    const served = events.some(e => e.type === 'serve');
    set({ plan, now, phase: served ? 'served' : state.phase });
    if (events.length) eventSubs.forEach(fn => fn(events));
  }

  function nextCalls(limit = 3): UpcomingCall[] {
    return state.plan ? upcoming(state.plan, currentNow(), limit) : [];
  }

  function prepare(dishes: Recipe[], serveInMinutes: number, menuLabel = 'Tonight') {
    const start = demoStart();
    set({
      phase: 'ready', menuLabel,
      plan: createPlan(dishes, start + serveInMinutes * MIN, start),
      clock: withPaused(createClock(start, realNow(), state.clock.speed), true, realNow()),
      now: start, log: [], replans: 0, lastServeShift: null,
    });
  }

  function begin() {
    if (state.phase !== 'ready') return;
    set({ phase: 'cooking', clock: withPaused(state.clock, false, realNow()) });
  }

  return {
    getState: () => state,
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
    onKitchenEvents(fn: (events: KitchenEvent[]) => void) {
      eventSubs.add(fn);
      return () => { eventSubs.delete(fn); };
    },
    prepare,
    begin,
    start(dishes: Recipe[], serveInMinutes: number, menuLabel?: string) {
      prepare(dishes, serveInMinutes, menuLabel);
      begin();
    },
    tick,
    kitchenNow: currentNow,
    reportDelay: (dish: DishId, minutes: number) => change((p, now) => reportDelay(p, dish, minutes, now)),
    shiftServe: (minutes: number) => change((p, now) => shiftServe(p, minutes, now)),
    restartStep: (dish: DishId) => change((p, now) => restartStep(p, dish, now)),
    markDone: (dish: DishId) => change((p, now) => markDone(p, dish, now)),
    upcoming: nextCalls,
    log(kind: LogKind, text: string) {
      set({ log: [...state.log, entry(kind, text, currentNow())] });
    },
    setSpeed(speed: number) {
      set({ clock: withSpeed(state.clock, speed, realNow()) });
    },
    togglePause() {
      set({ clock: withPaused(state.clock, !state.clock.paused, realNow()) });
    },
    skipToNextCall() {
      if (!state.plan || state.phase !== 'cooking') return;
      const next = nextCalls(1)[0];
      const target = next ? next.at : state.plan.serveAt;
      if (target <= currentNow() && !next) {
        tick();
        return;
      }
      set({ clock: jumpTo(state.clock, target, realNow()) });
      tick();
    },
    reset() {
      set({ phase: 'setup', plan: null, log: [], replans: 0, lastServeShift: null });
    },
  };
}

export type KitchenStore = ReturnType<typeof createKitchenStore>;

export function useKitchen(store: KitchenStore): KitchenState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
