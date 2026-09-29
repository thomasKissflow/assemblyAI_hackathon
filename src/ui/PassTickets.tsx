import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { PlannedDish } from '../kitchen/planner';
import type { DishId } from '../kitchen/recipes';
import { DishTicket } from './DishTicket';
import './PassTickets.css';

export const LEAVE_MS = 260;
const GLIDE_MS = 360;
/** Five or more dishes switch the tickets to compact mode, three to a row. */
export const COMPACT_FROM = 5;

export type SlotPhase = 'enter' | 'stay' | 'leave';
export interface Slot {
  dish: PlannedDish;
  phase: SlotPhase;
}
interface Ghost {
  dish: PlannedDish;
  index: number;
}

/**
 * The tickets on the pass, plus any dish dropped a moment ago (kept in place while it fades out).
 * Dishes added after the kitchen opened are marked 'enter' so they animate in; the first dishes don't.
 */
export function useTicketSlots(dishes: PlannedDish[]): Slot[] {
  // Derived from the previous render's dishes (React's "adjust state while rendering" pattern), so the
  // very first render without a dropped dish already holds its ghost: no frame where the rest jump.
  const [track, setTrack] = useState(() => ({ dishes, ghosts: [] as Ghost[], entered: new Set<DishId>() as ReadonlySet<DishId> }));
  let { ghosts, entered } = track;
  if (track.dishes !== dishes) {
    const ids = new Set(dishes.map(d => d.id));
    const had = new Set(track.dishes.map(d => d.id));
    const removed = track.dishes.flatMap((dish, index) => (ids.has(dish.id) ? [] : [{ dish, index }]));
    const added = dishes.filter(d => !had.has(d.id)).map(d => d.id);
    if (removed.length) ghosts = [...ghosts.filter(g => !ids.has(g.dish.id) && !removed.some(r => r.dish.id === g.dish.id)), ...removed];
    else if (ghosts.some(g => ids.has(g.dish.id))) ghosts = ghosts.filter(g => !ids.has(g.dish.id));
    if (added.length) entered = new Set([...entered, ...added]);
    setTrack({ dishes, ghosts, entered });
  }

  useEffect(() => {
    if (!ghosts.length) return;
    const t = window.setTimeout(() => setTrack(tr => ({ ...tr, ghosts: [] })), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [ghosts]);

  const slots: Slot[] = dishes.map(d => ({ dish: d, phase: entered.has(d.id) ? 'enter' : 'stay' }));
  for (const g of [...ghosts].sort((a, b) => a.index - b.index)) {
    slots.splice(Math.min(g.index, slots.length), 0, { dish: g.dish, phase: 'leave' });
  }
  return slots;
}

/** When the set of tickets changes, the ones that stay glide from where they were (FLIP). */
function useGlide(container: RefObject<HTMLElement | null>, signature: string) {
  const rects = useRef(new Map<string, DOMRect>());
  const last = useRef(signature);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>('[data-slot]')];
    const changed = last.current !== signature;
    last.current = signature;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, DOMRect>();
    for (const item of items) {
      const id = item.dataset.slot!;
      const r = item.getBoundingClientRect();
      next.set(id, r);
      const was = rects.current.get(id);
      if (!changed || !was || still || typeof item.animate !== 'function') continue;
      const dx = was.left - r.left;
      const dy = was.top - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: GLIDE_MS,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      });
    }
    rects.current = next;
  });

  // A resize moves everything; forget old positions so the next change doesn't glide from stale ones.
  useEffect(() => {
    const forget = () => rects.current.clear();
    window.addEventListener('resize', forget);
    return () => window.removeEventListener('resize', forget);
  }, []);
}

export interface PassTicketsProps {
  dishes: PlannedDish[];
  now: number;
  paused?: boolean;
  onDelay?: (dish: DishId, minutes: number) => void;
  onDone?: (dish: DishId) => void;
}

export function PassTickets({ dishes, now, paused = false, onDelay, onDone }: PassTicketsProps) {
  const slots = useTicketSlots(dishes);
  const grid = useRef<HTMLDivElement>(null);
  useGlide(grid, slots.map(s => s.dish.id).join('|'));
  const compact = slots.length >= COMPACT_FROM;
  const cols = compact ? 3 : Math.max(3, slots.length);

  return (
    <div
      ref={grid}
      className={`pass-tickets${paused ? ' is-paused' : ''}${compact ? ' is-compact' : ''}`}
      style={{ '--cols': cols } as CSSProperties}
      data-count={dishes.length}
    >
      {slots.map(({ dish, phase }) => {
        const leaving = phase === 'leave';
        return (
          <div key={dish.id} className={`pass-slot is-${phase}`} data-slot={dish.id} inert={leaving} aria-hidden={leaving || undefined}>
            <DishTicket dish={dish} now={now} compact={compact} onDelay={onDelay} onDone={onDone} />
          </div>
        );
      })}
    </div>
  );
}
