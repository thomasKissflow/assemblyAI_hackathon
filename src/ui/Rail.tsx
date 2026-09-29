import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MIN, fmtTime, upcoming, type Plan, type UpcomingCall } from '../kitchen/planner';
import { DishPhoto } from './DishPhoto';
import './Rail.css';

const SERVE_W = 76;
const AXIS_H = 22;
const TICK_MS = 5 * MIN;
const GLIDE_MS = 500;
/** Pill chrome around the label: photo, time, gaps and padding. */
const PILL_CHROME = 80;
const PILL_TIME_ONLY = 70;
const LABEL_MIN = 44;
const LABEL_MAX = 240;
/** Room for a typical label; with less than this on the right, a pill may grow left instead. */
const LABEL_ROOM = 130;
const clock = (t: number) => fmtTime(t).replace(/\s?[AP]M$/, '');

/** Screens with height to spare (90% zoom and up) get taller lanes and bigger markers. */
const ROOMY = '(min-height: 850px) and (min-width: 1200px)';

export const laneHeight = (lanes: number, roomy = false) => (lanes >= 5 ? 26 : 30) + (roomy ? 6 : 0);
/** The rail keeps room for four lanes (six once tickets go compact), so adding or dropping a dish
    never resizes it: the lanes just glide to stay centred. */
export const laneSlots = (lanes: number) => (lanes <= 4 ? 4 : 6);

function useMedia(query: string): boolean {
  const get = () => typeof matchMedia === 'function' && matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  // Measured before the first paint.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** True for a short while after the plan's timings change, so markers glide instead of drifting. */
function useGlide(plan: Plan) {
  const signature = `${plan.serveAt}|${plan.dishes.map(d => `${d.id}:${d.steps.map(s => s.start).join(',')}`).join('|')}`;
  const last = useRef(signature);
  const [gliding, setGliding] = useState(false);
  if (last.current !== signature) {
    last.current = signature;
    if (!gliding) setGliding(true);
  }
  useEffect(() => {
    if (!gliding) return;
    const t = window.setTimeout(() => setGliding(false), GLIDE_MS);
    return () => window.clearTimeout(t);
  }, [gliding, signature]);
  return gliding;
}

export interface LeadLayout {
  /** Pill grows to the left of its marker (it would hit the next marker or the serve line). */
  flip: boolean;
  /** Max label width in px; 0 hides the label and leaves just the time. */
  label: number;
}

/**
 * Where each dish's next call can put its label without covering its own later markers.
 * `xs` are the lane's marker positions in time order; the first is the lead.
 */
export function layoutLead(xs: number[], end: number): LeadLayout {
  const cx = xs[0];
  const right = (xs.length > 1 ? xs[1] - 10 : end) - cx;
  const left = cx;
  const flip = right < PILL_CHROME + LABEL_ROOM && left > right;
  const room = (flip ? left : right) - PILL_CHROME;
  return { flip, label: room >= LABEL_MIN ? Math.min(LABEL_MAX, Math.floor(room)) : 0 };
}

export function Rail({ plan, now }: { plan: Plan; now: number }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const gliding = useGlide(plan);
  const roomy = useMedia(ROOMY);
  const pillH = roomy ? 28 : 24;
  const end = Math.max(plan.serveAt, now + 10 * MIN);
  const usable = Math.max(0, width - SERVE_W);
  // Markers wait for the track's width, so they don't slide in from its left edge.
  const measured = width > 0;
  const x = (t: number) => Math.max(0, Math.min(1, (t - now) / (end - now))) * usable;
  const calls = upcoming(plan, now, 24);
  const lanes = plan.dishes.map(d => d.id);
  const laneH = laneHeight(lanes.length, roomy);
  const top = ((laneSlots(lanes.length) - lanes.length) * laneH) / 2;
  const byLane = new Map<string, UpcomingCall[]>();
  for (const c of calls) byLane.set(c.dishId, [...(byLane.get(c.dishId) ?? []), c]);
  const ticks: number[] = [];
  for (let t = Math.ceil(now / TICK_MS) * TICK_MS; measured && t < end; t += TICK_MS) ticks.push(t);

  return (
    <section className={`rail${gliding ? ' is-gliding' : ''}${roomy ? ' is-roomy' : ''}`} data-testid="rail" data-lanes={lanes.length} aria-label="Upcoming calls, from now to service">
      <div className="rail-track" ref={ref} style={{ height: laneSlots(lanes.length) * laneH + AXIS_H }}>
        {lanes.map((id, i) => (
          <span key={id} className="rail-lane" style={{ transform: `translateY(${top + i * laneH + laneH / 2}px)` }} aria-hidden="true" />
        ))}
        {ticks.map(t => {
          const tx = x(t);
          const major = new Date(t).getMinutes() % 15 === 0;
          const labelled = major && tx > 40 && tx < usable - 36;
          return (
            <span key={t} className={major ? 'rail-tick is-major' : 'rail-tick'} style={{ transform: `translateX(${tx}px)` }} aria-hidden="true">
              {labelled && <span className="rail-tick-label num">{clock(t)}</span>}
            </span>
          );
        })}
        <span className="rail-now" aria-hidden="true">
          <span>Now</span>
        </span>
        {measured && lanes.map((id, lane) => {
          const laneCalls = byLane.get(id);
          if (!laneCalls) return null;
          const dish = plan.dishes[lane];
          const xs = laneCalls.map(c => x(c.at));
          const lead = layoutLead(xs, usable);
          const y = top + lane * laneH + (laneH - pillH) / 2;
          return laneCalls.map((c, i) => {
            const title = `${c.dish}: ${c.label} at ${fmtTime(c.at)}`;
            if (i > 0) {
              return (
                <div
                  key={`${c.dishId}:${c.label}`}
                  className="rail-marker is-pip"
                  data-testid="rail-marker"
                  title={title}
                  style={{ transform: `translate(${xs[i]}px, ${y}px)` }}
                >
                  <span className="rail-pip" aria-hidden="true" />
                </div>
              );
            }
            const fits = lead.label > 0 || (lead.flip ? xs[0] : (xs[1] ?? usable) - xs[0]) >= PILL_TIME_ONLY;
            return (
              <div
                key={`${c.dishId}:${c.label}`}
                className={`rail-marker is-lead${lead.flip ? ' is-flipped' : ''}${fits ? '' : ' is-tight'}`}
                data-testid="rail-marker"
                title={title}
                style={{ transform: `translate(${xs[0]}px, ${y}px)` }}
              >
                <DishPhoto src={dish.photo} size={pillH - 4} />
                <span className="rail-marker-text">
                  <span className="num rail-marker-time">{clock(c.at)}</span>
                  {lead.label > 0 && (
                    <span className="rail-marker-label" style={{ maxWidth: lead.label }}>
                      {c.label}
                    </span>
                  )}
                </span>
              </div>
            );
          });
        })}
        {measured && (
          <div className="rail-serve" style={{ transform: `translateX(${usable}px)` }} data-testid="rail-serve">
            <span className="rail-serve-label">Serve</span>
            <span className="num">{clock(plan.serveAt)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
