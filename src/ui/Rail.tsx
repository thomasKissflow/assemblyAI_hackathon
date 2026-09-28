import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MIN, fmtTime, upcoming, type Plan } from '../kitchen/planner';
import './Rail.css';

const SERVE_W = 92;
const LANE_H = 38;
const TICK_MS = 5 * MIN;
const LABEL_ROOM = 190;
const clock = (t: number) => fmtTime(t).replace(/\s?[AP]M$/, '');

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
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

export function Rail({ plan, now }: { plan: Plan; now: number }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  const end = Math.max(plan.serveAt, now + 10 * MIN);
  const usable = Math.max(0, width - SERVE_W);
  const x = (t: number) => Math.max(0, Math.min(1, (t - now) / (end - now))) * usable;
  const calls = upcoming(plan, now, 20);
  const lanes = plan.dishes.map(d => d.id);
  const ticks: number[] = [];
  for (let t = Math.ceil(now / TICK_MS) * TICK_MS; t < end; t += TICK_MS) ticks.push(t);
  const glide = reduce ? { duration: 0 } : { duration: 0.45, ease: [0.25, 1, 0.5, 1] as const };
  const leads = new Set<string>();

  return (
    <section className="rail" data-testid="rail" aria-label="Upcoming calls, from now to service">
      <div className="rail-track" ref={ref} style={{ height: lanes.length * LANE_H + 34 }}>
        {lanes.map((id, i) => (
          <span key={id} className="rail-lane" style={{ top: i * LANE_H + LANE_H / 2 }} aria-hidden="true" />
        ))}
        {ticks.map(t => {
          const major = new Date(t).getMinutes() % 15 === 0;
          return (
            <span key={t} className={major ? 'rail-tick is-major' : 'rail-tick'} style={{ transform: `translateX(${x(t)}px)` }} aria-hidden="true">
              {major && <span className="rail-tick-label num">{clock(t)}</span>}
            </span>
          );
        })}
        <span className="rail-now" aria-hidden="true">
          <span>Now</span>
        </span>
        <AnimatePresence initial={false}>
          {calls.map(c => {
            const lane = lanes.indexOf(c.dishId);
            const dish = plan.dishes[lane];
            const lead = !leads.has(c.dishId);
            leads.add(c.dishId);
            const cx = x(c.at);
            const flip = lead && cx > usable - LABEL_ROOM;
            const cls = lead ? `rail-marker is-lead${flip ? ' is-flipped' : ''}` : 'rail-marker is-pip';
            return (
              <motion.div
                key={`${c.dishId}:${c.label}`}
                className={cls}
                data-testid="rail-marker"
                title={`${c.dish}: ${c.label} at ${fmtTime(c.at)}`}
                initial={{ opacity: 0, x: cx, y: lane * LANE_H }}
                animate={{ opacity: 1, x: cx, y: lane * LANE_H }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: reduce ? 0 : 0.25 } }}
                transition={glide}
              >
                {lead ? (
                  <>
                    <img src={dish.photo} alt="" width={26} height={26} />
                    <span className="rail-marker-text">
                      <span className="num rail-marker-time">{clock(c.at)}</span>
                      <span className="rail-marker-label">{c.label}</span>
                    </span>
                  </>
                ) : (
                  <span className="rail-pip" aria-hidden="true" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <motion.div className="rail-serve" initial={false} animate={{ x: usable }} transition={glide} data-testid="rail-serve">
          <span className="rail-serve-label">Serve</span>
          <span className="num">{clock(plan.serveAt)}</span>
        </motion.div>
      </div>
    </section>
  );
}
