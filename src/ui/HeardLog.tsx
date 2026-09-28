import { useEffect, useRef } from 'react';
import { ChefHat, Flame, Info, RefreshCw } from 'lucide-react';
import { fmtTime } from '../kitchen/planner';
import type { LogEntry, LogKind } from '../kitchen/store';
import './HeardLog.css';

const clock = (t: number) => fmtTime(t).replace(/\s?[AP]M$/, '');

function Icon({ kind }: { kind: LogKind }) {
  if (kind === 'call') return <Flame size={14} strokeWidth={2.5} aria-hidden="true" />;
  if (kind === 'chef') return <ChefHat size={14} aria-hidden="true" />;
  if (kind === 'change') return <RefreshCw size={14} strokeWidth={2.25} aria-hidden="true" />;
  if (kind === 'system') return <Info size={14} aria-hidden="true" />;
  return <span className="log-you">You</span>;
}

const WHO: Record<LogKind, string> = { call: 'Call', chef: 'Chef', cook: 'You', change: 'Re-plan', system: 'Note' };

export function HeardLog({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [log.length]);

  return (
    <section className="heard" aria-label="Heard log">
      <h2 className="heard-title">Heard</h2>
      <ol className="heard-list" ref={ref} data-testid="heard-log" aria-live="polite">
        {log.length === 0 && <li className="heard-empty">Calls, questions and re-plans land here as the night goes.</li>}
        {log.map(e => (
          <li key={e.id} className={`heard-entry is-${e.kind}`} data-kind={e.kind}>
            <span className="heard-time num">{clock(e.at)}</span>
            <span className="heard-icon" title={WHO[e.kind]}>
              <Icon kind={e.kind} />
            </span>
            <span className="heard-text">
              <span className="visually-hidden">{WHO[e.kind]}: </span>
              {e.kind === 'cook' ? `“${e.text}”` : e.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
