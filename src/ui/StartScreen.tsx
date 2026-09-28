import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BellRing, Check, ChefHat, Headphones, Mic, RefreshCw, Timer } from 'lucide-react';
import { MENUS, RECIPES, type MenuId } from '../kitchen/recipes';
import { MIN, createPlan, fmtTime, upcoming } from '../kitchen/planner';
import { demoStart, type KitchenState } from '../kitchen/store';
import type { ChefSession } from '../voice/useChefSession';
import { SplitFlap } from './SplitFlap';
import { Waveform } from './Waveform';
import './StartScreen.css';

export interface StartScreenProps {
  state: KitchenState;
  session: ChefSession;
  hasKey: boolean;
  onPrepare: (menu: MenuId, serveIn: number, withVoice: boolean) => void;
  onBegin: () => void;
  onBack: () => void;
  onWithoutVoice?: () => void;
}

const SERVE_OPTIONS = [30, 45, 60];
const MENU_IDS: MenuId[] = ['indian', 'western'];

function Teaser() {
  const [serve, setServe] = useState('8:00 PM');
  useEffect(() => {
    const t = window.setTimeout(() => setServe('8:10 PM'), 1600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <figure className="teaser" aria-label="Example: say Hey Chef, the curry needs ten more minutes, and Chef moves dinner to 8:10">
      <p className="teaser-line teaser-you">“Hey Chef, the curry needs ten more minutes.”</p>
      <p className="teaser-line teaser-chef">
        <ChefHat size={16} aria-hidden="true" /> “Heard. Serving at eight ten now.”
      </p>
      <div className="teaser-flap">
        <span className="label">Serving at</span>
        <SplitFlap value={serve} label="Serving at" tone="saffron" />
      </div>
    </figure>
  );
}

function SoundCheck({ session, onBegin, onBack, onWithoutVoice }: Pick<StartScreenProps, 'session' | 'onBegin' | 'onBack' | 'onWithoutVoice'>) {
  const heard = session.wakeCount > 0;
  const live = session.phase === 'live';
  const status =
    session.phase === 'error'
      ? session.error
      : session.phase === 'connecting' || session.phase === 'idle'
        ? 'Connecting to Chef…'
        : heard
          ? 'Chef is ready when you are.'
          : 'Chef is listening. Try it now.';

  return (
    <main className="start start--check">
      <section className="check-card" aria-labelledby="check-title">
        <button type="button" className="btn btn-quiet check-back" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" /> Back
        </button>
        <h1 id="check-title" className="check-title">
          Sound check
        </h1>
        <div className={heard ? 'check-ring is-heard' : live ? 'check-ring is-live' : 'check-ring'}>
          {heard ? <Check size={44} strokeWidth={3} aria-hidden="true" /> : <Mic size={40} aria-hidden="true" />}
        </div>
        <p className="check-prompt" data-testid="soundcheck-heard" data-heard={heard}>
          {heard ? 'Heard you.' : 'Say “Hey Chef”'}
        </p>
        <Waveform level={() => session.levels().mic} className="check-wave" gain={8} />
        <p className={session.phase === 'error' ? 'check-status is-error' : 'check-status'} role="status">
          {status}
        </p>
        <div className="check-actions">
          <button type="button" className="btn btn-fire" disabled={!live} onClick={onBegin} data-testid="soundcheck-start">
            <BellRing size={18} aria-hidden="true" /> Start cooking
          </button>
          {session.phase === 'error' ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => void session.start()}>
                Try again
              </button>
              {onWithoutVoice && (
                <button type="button" className="btn btn-quiet" onClick={onWithoutVoice}>
                  Cook without voice
                </button>
              )}
            </>
          ) : (
            !heard && (
              <button type="button" className="btn btn-quiet" disabled={!live} onClick={onBegin} data-testid="soundcheck-skip">
                Skip the test
              </button>
            )
          )}
        </div>
        <p className="check-tip">
          <Headphones size={16} aria-hidden="true" /> Headphones keep Chef from hearing itself.
        </p>
      </section>
    </main>
  );
}

export function StartScreen({ state, session, hasKey, onPrepare, onBegin, onBack, onWithoutVoice }: StartScreenProps) {
  const [menu, setMenu] = useState<MenuId>('indian');
  const [serveIn, setServeIn] = useState(45);

  const preview = useMemo(() => {
    const start = demoStart();
    const plan = createPlan(MENUS[menu].dishes, start + serveIn * MIN, start);
    return { plan, calls: upcoming(plan, start, 4) };
  }, [menu, serveIn]);

  if (state.phase === 'ready') return <SoundCheck session={session} onBegin={onBegin} onBack={onBack} onWithoutVoice={onWithoutVoice} />;

  return (
    <main className="start">
      <section className="start-hero" aria-labelledby="start-title">
        <div className="start-brand">
          <span className="start-mark" aria-hidden="true">
            <ChefHat size={30} strokeWidth={2.25} />
          </span>
          <h1 id="start-title" className="start-title">
            Heard, Chef
          </h1>
        </div>
        <p className="start-tagline">The dinner timer you can talk back to.</p>
        <ul className="start-points">
          <li>
            <BellRing size={20} aria-hidden="true" />
            <span>Calls every step out loud, right when it’s due.</span>
          </li>
          <li>
            <Mic size={20} aria-hidden="true" />
            <span>
              Say <strong>“Hey Chef”</strong> any time to ask a question, hands in the dough.
            </span>
          </li>
          <li>
            <RefreshCw size={20} aria-hidden="true" />
            <span>Re-plans every dish the moment something slips.</span>
          </li>
        </ul>
        <Teaser />
      </section>

      <section className="start-panel" aria-labelledby="setup-title">
        <h2 id="setup-title" className="panel-title">
          What’s cooking tonight?
        </h2>
        <div className="menus" role="group" aria-label="Menu">
          {MENU_IDS.map(id => (
            <button
              key={id}
              type="button"
              className="menu-tile"
              aria-pressed={menu === id}
              onClick={() => setMenu(id)}
              data-testid={`menu-${id}`}
            >
              <span className="menu-plates" aria-hidden="true">
                {MENUS[id].dishes.map(d => (
                  <img key={d} src={RECIPES[d].photo} alt="" width={56} height={56} />
                ))}
              </span>
              <span className="menu-name">{MENUS[id].label}</span>
              <span className="menu-dishes">{MENUS[id].dishes.map(d => RECIPES[d].name).join(' · ')}</span>
              <span className="menu-check" aria-hidden="true">
                <Check size={16} strokeWidth={3} />
              </span>
            </button>
          ))}
        </div>

        <div className="serve-in">
          <span className="label" id="serve-in-label">
            <Timer size={16} aria-hidden="true" /> Serve in
          </span>
          <div className="segmented" role="group" aria-labelledby="serve-in-label">
            {SERVE_OPTIONS.map(m => (
              <button key={m} type="button" aria-pressed={serveIn === m} onClick={() => setServeIn(m)} data-testid={`serve-in-${m}`}>
                {m} min
              </button>
            ))}
          </div>
        </div>

        <div className="preview" data-testid="plan-preview">
          <p className="preview-title">
            Tonight’s first calls <span className="num">· serving at {fmtTime(preview.plan.serveAt)}</span>
          </p>
          <ol className="preview-list">
            {preview.calls.map((c, i) => (
              <li key={`${c.dishId}-${c.label}`} className={i === 0 ? 'is-first' : undefined}>
                <span className="preview-time num">{fmtTime(c.at)}</span>
                <img src={RECIPES[c.dishId].photo} alt="" width={28} height={28} />
                <span className="preview-label">
                  <strong>{RECIPES[c.dishId].short}</strong> {c.label.toLowerCase()}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {!hasKey && (
          <p className="key-note" role="note">
            Voice needs an AssemblyAI key. Add your AssemblyAI key to <code>.env.local</code> as <code>VITE_ASSEMBLYAI_API_KEY</code>, then restart the dev
            server.
          </p>
        )}

        <div className="start-actions">
          <button
            type="button"
            className="btn btn-fire start-go"
            disabled={!hasKey}
            onClick={() => onPrepare(menu, serveIn, true)}
            data-testid="start-continue"
          >
            <Mic size={18} aria-hidden="true" /> Continue with voice
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onPrepare(menu, serveIn, false)} data-testid="start-cook-without-voice">
            Cook without voice
          </button>
        </div>
        <p className="start-notes">
          <Headphones size={16} aria-hidden="true" /> Chef listens for “Hey Chef”. Headphones give the cleanest audio. Demo speed: 1 kitchen minute = 2
          seconds.
        </p>
      </section>
    </main>
  );
}
