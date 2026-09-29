import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BellRing, Check, ChefHat, Headphones, Mic, RefreshCw, Timer } from 'lucide-react';
import { findRecipe, libraryStore, useLibrary, type Library } from '../kitchen/library';
import type { DishId, Menu, Recipe } from '../kitchen/recipes';
import { MAX_DISHES, MIN, createPlan, fmtTime, upcoming } from '../kitchen/planner';
import { demoStart, type KitchenState } from '../kitchen/store';
import type { ChefSession } from '../voice/useChefSession';
import { DishPhoto } from './DishPhoto';
import { DishPicker } from './DishPicker';
import { MenuTiles } from './MenuTiles';
import { RecipeStudio } from './RecipeStudio';
import { SplitFlap } from './SplitFlap';
import { TonightList, ownership } from './TonightList';
import { Waveform } from './Waveform';
import './StartScreen.css';

export interface StartScreenProps {
  state: KitchenState;
  session: ChefSession;
  hasKey: boolean;
  onPrepare: (dishes: Recipe[], menuLabel: string, serveIn: number, withVoice: boolean) => void;
  onBegin: () => void;
  onBack: () => void;
  onWithoutVoice?: () => void;
  /** The last dinner prepared, so coming back to the start screen keeps it. */
  lastDinner?: LastDinner;
}

export interface LastDinner {
  dishIds: DishId[];
  serveIn: number;
}

const SERVE_OPTIONS = [30, 45, 60];
const DEFAULT_MENU = 'indian';

/** Same dishes, in any order. */
const sameDishes = (a: DishId[], b: DishId[]) => a.length === b.length && a.every(id => b.includes(id));

/** A menu's dishes that are in the book, at most as many as Chef can run. */
const menuIds = (lib: Library, m: Menu) => m.dishes.filter(d => findRecipe(lib, d)).slice(0, MAX_DISHES);

/** The dish a recipe is a version of: Chef's original for the cook's own version, otherwise itself. */
const family = (r: Recipe) => (r.custom && r.basedOn) || r.id;

function firstSelection(lib: Library, last?: LastDinner): { menuId: string | null; dishIds: DishId[] } {
  const ids = [...new Set(last?.dishIds ?? [])].filter(id => findRecipe(lib, id)).slice(0, MAX_DISHES);
  if (ids.length === 0) {
    const menu = lib.menus.find(m => m.id === DEFAULT_MENU) ?? lib.menus[0];
    return { menuId: menu?.id ?? null, dishIds: menu ? menuIds(lib, menu) : [] };
  }
  return { menuId: lib.menus.find(m => sameDishes(m.dishes, ids))?.id ?? null, dishIds: ids };
}

/** What the recipe studio was opened for. */
interface StudioRequest {
  initial?: Recipe;
  basedOn?: DishId;
  addToTonight: boolean;
  /** Tonight's dish the saved recipe takes the place of (customising from a row). */
  replace?: DishId;
}

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
          : 'Chef is listening. Say it once to check, or just start cooking.';

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
          ) : null}
        </div>
        <p className="check-tip">
          <Headphones size={16} aria-hidden="true" /> Headphones keep Chef from hearing itself.
        </p>
      </section>
    </main>
  );
}

export function StartScreen({ state, session, hasKey, onPrepare, onBegin, onBack, onWithoutVoice, lastDinner }: StartScreenProps) {
  const lib = useLibrary();
  const [first] = useState(() => firstSelection(lib, lastDinner));
  const [menuId, setMenuId] = useState(first.menuId);
  const [dishIds, setDishIds] = useState(first.dishIds);
  const [serveIn, setServeIn] = useState(lastDinner?.serveIn ?? 45);
  const [picking, setPicking] = useState(false);
  const [studio, setStudio] = useState<StudioRequest>({ addToTonight: true });
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioKey, setStudioKey] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  // Focus to move once the next render lands (a removed row's neighbour, a newly saved menu): an element or a selector.
  const focusNext = useRef<string | HTMLElement | null>(null);
  const studioOpener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    // After the next frame: any dialog's own focus hand-back has happened by then (the studio's lands in a frame), so this
    // wins, and new tiles are laid out, so focusing one scrolls it into view.
    const move = () => (typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target)?.focus();
    requestAnimationFrame(() => window.setTimeout(move, 0));
  });

  const menu = menuId ? (lib.menus.find(m => m.id === menuId) ?? null) : null;
  const tonight = useMemo(() => dishIds.map(id => findRecipe(lib, id)).filter((r): r is Recipe => r !== undefined), [dishIds, lib]);
  const ids = tonight.map(r => r.id);
  // The menu Tonight is exactly: the one picked, or any other with the same dishes (so it's never saved twice).
  const matched = menu && sameDishes(menu.dishes, ids) ? menu : (lib.menus.find(m => sameDishes(m.dishes, ids)) ?? null);
  const customised = !matched;
  const label = matched?.label ?? 'Tonight';
  const status = matched ? matched.label : menu ? `Changed from ${menu.label}` : tonight.length ? 'Your own line-up' : '';
  const room = MAX_DISHES - tonight.length;
  /** Tonight's other version of the same dish, which this recipe would take the place of. */
  const twinOf = (r: Recipe) => tonight.find(t => t.id !== r.id && family(t) === family(r));

  const preview = useMemo(() => {
    const start = demoStart();
    const plan = createPlan(tonight, start + serveIn * MIN, start);
    const pushed = plan.serveAt > start + serveIn * MIN;
    const longest = tonight.reduce<{ name: string; minutes: number } | null>((best, r) => {
      const minutes = r.steps.reduce((sum, s) => sum + s.minutes, 0);
      return !best || minutes > best.minutes ? { name: r.name, minutes } : best;
    }, null);
    return { plan, calls: upcoming(plan, start, 4), pushed, longest };
  }, [tonight, serveIn]);

  if (state.phase === 'ready') return <SoundCheck session={session} onBegin={onBegin} onBack={onBack} onWithoutVoice={onWithoutVoice} />;

  const selectMenu = (id: string) => {
    const m = lib.menus.find(x => x.id === id);
    if (!m) return;
    setMenuId(id);
    setDishIds(menuIds(lib, m));
  };

  const deleteMenu = (id: string) => {
    const i = lib.menus.findIndex(m => m.id === id);
    if (i < 0) return;
    const gone = lib.menus[i];
    const neighbour = lib.menus[i - 1] ?? lib.menus[i + 1];
    libraryStore.deleteMenu(id);
    if (menuId === id) setMenuId(null);
    setAnnouncement(`Deleted the menu ${gone.label}.`);
    focusNext.current = neighbour ? `[data-testid="menu-${neighbour.id}"]` : null;
  };

  const saveMenu = (name: string) => {
    const saved = libraryStore.saveMenu({ id: '', label: name, dishes: ids });
    if (!saved) return false;
    setMenuId(saved.id);
    setAnnouncement(`Saved ${saved.label} to your menus.`);
    focusNext.current = `[data-testid="menu-${saved.id}"]`;
    return true;
  };

  /** Puts a recipe on tonight: in place of another version of the same dish, or at the end. False when there's no room. */
  const putOn = (r: Recipe): boolean => {
    if (ids.includes(r.id)) return true;
    const twin = twinOf(r);
    if (twin) setDishIds(ids.map(id => (id === twin.id ? r.id : id)));
    else if (room > 0) setDishIds([...ids, r.id]);
    else return false;
    return true;
  };

  const addDish = (r: Recipe) => void putOn(r); // The picker says so itself.

  const removeDish = (id: DishId) => {
    const i = ids.indexOf(id);
    const next = ids.filter(d => d !== id);
    setDishIds(next);
    setAnnouncement(`Removed ${findRecipe(lib, id)?.name ?? 'the dish'} from tonight.`);
    const neighbour = next[Math.min(i, next.length - 1)];
    focusNext.current = neighbour ? `[data-testid="remove-${neighbour}"]` : '[data-testid="add-dish"]';
  };

  const openStudio = (req: StudioRequest) => {
    // Focus comes back here when the studio closes; from inside the picker, to "Add a dish".
    const active = document.activeElement;
    studioOpener.current =
      active instanceof HTMLElement && active !== document.body && !active.closest('dialog')
        ? active
        : document.querySelector<HTMLElement>('[data-testid="add-dish"]');
    setPicking(false);
    setStudio(req);
    setStudioKey(k => k + 1);
    setStudioOpen(true);
  };

  const customise = (r: Recipe) =>
    openStudio({ initial: r, basedOn: r.custom ? r.basedOn : r.id, addToTonight: false, replace: r.id });

  const saveRecipe = (recipe: Recipe, opts: { addToTonight: boolean }) => {
    let saved: Recipe;
    try {
      saved = libraryStore.saveRecipe(recipe);
    } catch {
      setAnnouncement('That recipe needs a name and at least one step before it can be saved.');
      return;
    }
    const replace = studio.replace && ids.includes(studio.replace) ? studio.replace : null;
    if (replace) {
      setDishIds([...new Set(ids.map(id => (id === replace ? saved.id : id)))]);
      setAnnouncement(replace === saved.id ? `Saved ${saved.name}.` : `Saved your version of ${saved.name}. It’s on tonight instead of Chef’s.`);
      focusNext.current = `[data-testid="customise-${saved.id}"]`;
    } else if (opts.addToTonight && !ids.includes(saved.id)) {
      const twin = twinOf(saved);
      if (putOn(saved)) {
        setAnnouncement(
          twin ? `Saved ${saved.name}. It’s on tonight instead of ${ownership(twin) ?? 'Chef’s'}.` : `Saved ${saved.name} and added it to tonight.`,
        );
        focusNext.current = `[data-testid="customise-${saved.id}"]`;
      } else {
        setAnnouncement(`Saved ${saved.name} to your recipe book. Tonight already has ${MAX_DISHES} dishes, the most Chef can run.`);
        focusNext.current = studioOpener.current;
      }
    } else {
      setAnnouncement(`Saved ${saved.name} to your recipe book.`);
      focusNext.current = studioOpener.current;
    }
    setStudioOpen(false);
  };

  const closeStudio = () => {
    setStudioOpen(false);
    focusNext.current = studioOpener.current;
  };

  const prepare = (withVoice: boolean) => onPrepare(tonight, label, serveIn, withVoice);
  const empty = tonight.length === 0;
  const hintId = empty ? 'start-hint' : undefined;

  return (
    <main className="start">
      <section className="start-hero" aria-labelledby="start-title">
        <div className="start-brand">
          <span className="start-mark" aria-hidden="true">
            <ChefHat size={26} strokeWidth={2.25} />
          </span>
          <h1 id="start-title" className="start-title">
            Heard, Chef
          </h1>
        </div>
        <p className="start-tagline">The dinner timer you can talk back to.</p>
        <ul className="start-points">
          <li>
            <BellRing size={18} aria-hidden="true" />
            <span>Calls every step out loud, right when it’s due.</span>
          </li>
          <li>
            <Mic size={18} aria-hidden="true" />
            <span>
              Say <strong>“Hey Chef”</strong> any time to ask a question, hands in the dough.
            </span>
          </li>
          <li>
            <RefreshCw size={18} aria-hidden="true" />
            <span>Re-plans every dish the moment something slips.</span>
          </li>
        </ul>
        <Teaser />
      </section>

      <section className="start-panel" aria-labelledby="setup-title">
        <h2 id="setup-title" className="panel-title">
          What’s cooking tonight?
        </h2>

        <div className="start-menus">
          <h3 id="menus-title" className="section-title">
            Start from a menu
          </h3>
          <MenuTiles
            library={lib}
            selected={matched?.id ?? menuId}
            changed={!matched && menuId !== null}
            labelledBy="menus-title"
            onSelect={selectMenu}
            onDelete={deleteMenu}
          />
        </div>

        <div className="start-build">
          <TonightList
            dishes={tonight}
            status={status}
            canSave={customised && !empty}
            onRemove={removeDish}
            onCustomise={customise}
            onAdd={() => setPicking(true)}
            onNew={() => openStudio({ addToTonight: room > 0 })}
            onSaveMenu={saveMenu}
          />

          <div className="start-plan">
            <div className="serve-in">
              <span className="section-title serve-in-title" id="serve-in-label">
                <Timer size={17} aria-hidden="true" /> Serve in
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
                Tonight’s first calls{!empty && <span className="num"> · serving at {fmtTime(preview.plan.serveAt)}</span>}
              </p>
              {empty ? (
                <p className="preview-empty">Chef’s first calls show up here once there’s a dish on tonight.</p>
              ) : (
                <ol className="preview-list">
                  {preview.calls.map((c, i) => {
                    const dish = preview.plan.dishes.find(d => d.id === c.dishId);
                    return (
                      <li key={`${c.dishId}-${c.label}-${c.at}`} className={i === 0 ? 'is-first' : undefined}>
                        <span className="preview-time num">{fmtTime(c.at)}</span>
                        {dish && <DishPhoto src={dish.photo} size={28} />}
                        <span className="preview-label">
                          <strong>{dish?.short ?? c.dish}</strong> {c.label.toLowerCase()}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              {!empty && preview.pushed && preview.longest && (
                <p className="preview-note">
                  {preview.longest.name} takes {preview.longest.minutes} min, so dinner’s a little later.
                </p>
              )}
            </div>

            {!hasKey && (
              <p className="key-note" role="note">
                Voice needs an AssemblyAI key. Add your AssemblyAI key to <code>.env.local</code> as <code>VITE_ASSEMBLYAI_API_KEY</code>, then restart the
                dev server.
              </p>
            )}
          </div>
        </div>

        <div className="start-foot">
          {empty ? (
            <p id="start-hint" className="start-hint">
              Add at least one dish to start cooking.
            </p>
          ) : (
            <p className="start-notes">
              <Headphones size={16} aria-hidden="true" />
              <span>
                <span>Chef listens for “Hey Chef”. Headphones help. </span>
                <span>Demo speed: 1 kitchen minute = 2 seconds.</span>
              </span>
            </p>
          )}
          <div className="start-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={empty}
              aria-describedby={hintId}
              onClick={() => prepare(false)}
              data-testid="start-cook-without-voice"
            >
              Cook without voice
            </button>
            <button
              type="button"
              className="btn btn-fire start-go"
              disabled={!hasKey || empty}
              aria-describedby={hintId}
              onClick={() => prepare(true)}
              data-testid="start-continue"
            >
              <Mic size={18} aria-hidden="true" /> Continue with voice
            </button>
          </div>
        </div>
      </section>

      <DishPicker
        open={picking}
        recipes={lib.recipes.filter(r => !ids.includes(r.id))}
        tonightCount={tonight.length}
        swapFor={twinOf}
        onAdd={addDish}
        onEdit={r => openStudio({ initial: r, basedOn: r.basedOn, addToTonight: room > 0 })}
        onDelete={r => libraryStore.deleteRecipe(r.id)}
        onNew={() => openStudio({ addToTonight: room > 0 })}
        onClose={() => setPicking(false)}
      />
      <RecipeStudio
        key={studioKey}
        open={studioOpen}
        initial={studio.initial}
        basedOn={studio.basedOn}
        addToTonight={studio.addToTonight}
        onClose={closeStudio}
        onSave={saveRecipe}
      />
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </main>
  );
}
