import { useMemo, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { SPEEDS, type KitchenState, type KitchenStore } from '../kitchen/store';
import type { ChefSession } from '../voice/useChefSession';
import { Captions } from './Captions';
import { DishTicket } from './DishTicket';
import { ErrorBanner } from './ErrorBanner';
import { GlanceMode } from './GlanceMode';
import { HeardLog } from './HeardLog';
import { NextUp } from './NextUp';
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

  const shortcuts = useMemo<ShortcutMap>(() => {
    const cycleSpeed = () => {
      const i = SPEEDS.indexOf(latest.current.state.clock.speed as (typeof SPEEDS)[number]);
      store.setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
    };
    return {
      down: {
        n: () => store.skipToNextCall(),
        p: () => store.togglePause(),
        s: cycleSpeed,
        g: () => setGlance(g => !g),
        escape: () => setGlance(false),
        m: () => latest.current.session?.toggleMute(),
        space: () => latest.current.session?.setPushToTalk(true),
      },
      up: { space: () => latest.current.session?.setPushToTalk(false) },
    };
  }, [store]);
  useShortcuts(shortcuts);

  const plan = state.plan;
  if (!plan) return null;

  return (
    <div className="kitchen">
      <TopBar
        state={state}
        onSpeed={s => store.setSpeed(s)}
        onPause={() => store.togglePause()}
        onSkip={() => store.skipToNextCall()}
        onGlance={() => setGlance(true)}
      />
      <main className="kitchen-main">
        {session?.phase === 'error' && session.error && (
          <div className="kitchen-banner">
            <ErrorBanner message={session.error} onRetry={() => void session.start()} />
          </div>
        )}
        <section className="pass" aria-label="The pass">
          <div className="pass-tickets">
            {plan.dishes.map(d => (
              <DishTicket key={d.id} dish={d} now={state.now} />
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
            />
          ) : (
            <p className="keys-hint">
              <Keyboard size={18} aria-hidden="true" />
              <span>
                Voice off. <kbd>N</kbd> next call · <kbd>P</kbd> pause · <kbd>S</kbd> speed · <kbd>G</kbd> glance
              </span>
            </p>
          )}
        </aside>
      </main>
      {glance && <GlanceMode plan={plan} now={state.now} onClose={() => setGlance(false)} />}
      {state.phase === 'served' && <ServiceReport state={state} onCookAgain={onCookAgain} />}
    </div>
  );
}
