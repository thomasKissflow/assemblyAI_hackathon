import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pause, Play } from 'lucide-react';
import { SPEEDS, type KitchenState, type KitchenStore } from '../kitchen/store';
import type { ChefSession } from '../voice/useChefSession';
import { Captions } from './Captions';
import { DishTicket } from './DishTicket';
import { ErrorBanner } from './ErrorBanner';
import { GlanceMode } from './GlanceMode';
import { HeardLog } from './HeardLog';
import { NextUp, callAnnouncement } from './NextUp';
import { Rail } from './Rail';
import { ServiceReport } from './ServiceReport';
import { TopBar } from './TopBar';
import { VoiceBar } from './VoiceBar';
import { useShortcuts, type ShortcutMap } from './useShortcuts';
import './KitchenScreen.css';

export interface KitchenScreenProps {
  store: KitchenStore;
  state: KitchenState;
  session: ChefSession | null;
  onCookAgain: () => void;
}

export function KitchenScreen({ store, state, session, onCookAgain }: KitchenScreenProps) {
  const [glance, setGlance] = useState(false);
  const latest = useRef({ session, state });
  latest.current = { session, state };
  const served = state.phase === 'served';
  const overlay = glance || served;

  // Give focus back to wherever it was before an overlay opened.
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (overlay) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      return;
    }
    returnFocus.current?.focus?.();
    returnFocus.current = null;
  }, [overlay]);

  const shortcuts = useMemo<ShortcutMap>(() => {
    const cooking = () => latest.current.state.phase === 'cooking';
    const cycleSpeed = () => {
      const i = SPEEDS.indexOf(latest.current.state.clock.speed as (typeof SPEEDS)[number]);
      store.setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
    };
    return {
      down: {
        n: () => cooking() && store.skipToNextCall(),
        p: () => cooking() && store.togglePause(),
        s: () => cooking() && cycleSpeed(),
        g: () => cooking() && setGlance(g => !g),
        escape: () => setGlance(false),
        m: () => latest.current.session?.toggleMute(),
        space: () => cooking() && latest.current.session?.setPushToTalk(true),
      },
      up: { space: () => latest.current.session?.setPushToTalk(false) },
    };
  }, [store]);
  useShortcuts(shortcuts);

  const plan = state.plan;
  if (!plan) return null;
  const paused = state.clock.paused;

  return (
    <div className="kitchen">
      <div className="kitchen-shell" inert={overlay}>
        <TopBar
          state={state}
          onSpeed={s => store.setSpeed(s)}
          onPause={() => store.togglePause()}
          onSkip={() => store.skipToNextCall()}
          onGlance={() => setGlance(true)}
          onEnd={onCookAgain}
        />
        <main className="kitchen-main">
          {session?.phase === 'error' && session.error && (
            <div className="kitchen-banner">
              <ErrorBanner message={session.error} onRetry={() => void session.start()} />
            </div>
          )}
          <section className="pass" aria-labelledby="pass-title">
            <h2 id="pass-title" className="visually-hidden">
              The pass
            </h2>
            {paused && !served && (
              <div className="paused-band" role="status">
                <Pause size={20} aria-hidden="true" />
                <p>
                  <strong>Paused.</strong> Calls are on hold until you resume.
                </p>
                <button type="button" className="btn btn-dark" onClick={() => store.togglePause()}>
                  <Play size={16} aria-hidden="true" /> Resume <kbd>P</kbd>
                </button>
              </div>
            )}
            <div className={paused ? 'pass-tickets is-paused' : 'pass-tickets'}>
              {plan.dishes.map(d => (
                <DishTicket key={d.id} dish={d} now={state.now} onDelay={(id, m) => store.reportDelay(id, m)} onDone={id => store.markDone(id)} />
              ))}
            </div>
            <Rail plan={plan} now={state.now} />
          </section>
          <aside className="side" aria-label="Chef">
            <NextUp plan={plan} now={state.now} />
            {session && <Captions feed={session.captions} audioTime={session.audioTime} />}
            <HeardLog log={state.log} />
            {session ? (
              <VoiceBar
                voice={session.voice}
                phase={session.phase}
                levels={session.levels}
                onToggleMute={session.toggleMute}
                onPushToTalk={session.setPushToTalk}
                active={!overlay}
              />
            ) : (
              <p className="keys-hint">
                <Keyboard size={18} aria-hidden="true" />
                <span>
                  Voice off. Use <strong>+5 min</strong> and <strong>Done</strong> on a ticket to re-plan. <kbd>N</kbd> next call · <kbd>P</kbd> pause ·{' '}
                  <kbd>G</kbd> glance
                </span>
              </p>
            )}
          </aside>
        </main>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {callAnnouncement(plan, state.now)}
      </p>
      {glance && <GlanceMode plan={plan} now={state.now} onClose={() => setGlance(false)} />}
      {served && <ServiceReport state={state} onCookAgain={onCookAgain} />}
    </div>
  );
}
