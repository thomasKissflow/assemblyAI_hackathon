import { useEffect, useRef } from 'react';
import { ChefHat, Flame, Info, RefreshCw, User } from 'lucide-react';
import { fmtTime } from '../kitchen/planner';
import type { LogEntry, LogKind } from '../kitchen/store';
import './HeardLog.css';

const clock = (t: number) => fmtTime(t).replace(/\s?[AP]M$/, '');

function Icon({ kind }: { kind: LogKind }) {
  if (kind === 'call') return <Flame size={14} strokeWidth={2.5} aria-hidden="true" />;
  if (kind === 'chef') return <ChefHat size={14} aria-hidden="true" />;
  if (kind === 'change') return <RefreshCw size={14} strokeWidth={2.25} aria-hidden="true" />;
  if (kind === 'system') return <Info size={14} aria-hidden="true" />;
  return <User size={14} aria-hidden="true" />;
}

const WHO: Record<LogKind, string> = { call: 'Call', chef: 'Chef', cook: 'You', change: 'Re-plan', system: 'Note' };

/** "Serving now 8:10 PM (was 8:00 PM). Rice: …" → headline "Serving 8:00 → 8:10 PM" + the rest. */
function splitChange(text: string): { head: string | null; rest: string } {
  const m = text.match(/^Serving now (.+?) \(was (.+?)\)\.\s*(.*)$/);
  if (!m) return { head: null, rest: text };
  return { head: `Serving ${m[2].replace(/\s?[AP]M$/, '')} → ${m[1]}`, rest: m[3] };
}

export function HeardLog({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  // Pinned to the newest entry unless the cook scrolled up to read. The list also shrinks while
  // captions grow above it, so re-pin on every resize, not only when an entry arrives.
  const pinned = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    if (typeof ResizeObserver === 'undefined') return () => el.removeEventListener('scroll', onScroll);
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <section className="heard" aria-labelledby="heard-title">
      <h2 id="heard-title" className="heard-title">
        Heard
      </h2>
      <ol className="heard-list" ref={ref} data-testid="heard-log">
        {log.length === 0 && <li className="heard-empty">Calls, questions and re-plans land here as the night goes.</li>}
        {log.map(e => {
          const change = e.kind === 'change' ? splitChange(e.text) : null;
          return (
            <li key={e.id} className={`heard-entry is-${e.kind}`} data-kind={e.kind}>
              <span className="heard-time num">{clock(e.at)}</span>
              <span className="heard-icon" title={WHO[e.kind]}>
                <Icon kind={e.kind} />
              </span>
              <span className="heard-text">
                <span className="visually-hidden">{WHO[e.kind]}: </span>
                {change ? (
                  <>
                    {change.head && <strong className="heard-head num">{change.head}</strong>}
                    {change.rest && <span className="heard-detail">{change.rest}</span>}
                  </>
                ) : e.kind === 'cook' ? (
                  `“${e.text}”`
                ) : (
                  e.text
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
