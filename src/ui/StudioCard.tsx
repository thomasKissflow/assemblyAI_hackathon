import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Timer, Trash2, Volume2, X } from 'lucide-react';
import { DISH_KINDS, kindPhoto, type DishKind } from '../kitchen/recipes';
import { clampMinutes, defaultCall, defaultShort, MAX_INGREDIENTS, MAX_STEPS, type DraftStep } from '../kitchen/draft';
import { capitalize } from '../kitchen/text';
import { DishPhoto } from './DishPhoto';
import './StudioCard.css';

/** A step on the card, with a key that survives edits, moves and re-formats. `enter` staggers a step Chef just wrote. */
export interface CardStep extends DraftStep {
  key: string;
  enter?: number;
}

export interface Card {
  name: string;
  short: string;
  kind: DishKind;
  steps: CardStep[];
  ingredients: string[];
}

export interface StudioCardProps {
  card: Card;
  onEdit: (fn: (c: Card) => Card) => void;
  newStep: () => CardStep;
  /** Chef is writing the card. */
  writing: boolean;
  aiEnabled: boolean;
  /** Mark empty required fields (after a save attempt). */
  showErrors: boolean;
  total: number;
}

type Focus = { key: string; part: 'label' | 'up' | 'down' | 'add' };

const kindLabel = (k: DishKind) => capitalize(k);

const KIND_COLUMNS = 4;
const KIND_MOVES: Record<string, (i: number) => number> = {
  ArrowRight: i => i + 1,
  ArrowDown: i => i + KIND_COLUMNS,
  ArrowLeft: i => i - 1,
  ArrowUp: i => i - KIND_COLUMNS,
  Home: () => 0,
  End: () => DISH_KINDS.length - 1,
};

/** The plate on the card; it opens a radio group of plates. Arrows move the choice, Enter or a click closes it. */
function KindPicker({ kind, onKind }: { kind: DishKind; onKind: (k: DishKind) => void }) {
  const id = useId();
  const pop = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const kindRef = useRef(kind);
  useEffect(() => {
    kindRef.current = kind;
  });

  // Opening moves focus to the plate that's chosen now.
  useEffect(() => {
    const el = pop.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') el.querySelector<HTMLElement>(`[data-kind="${kindRef.current}"]`)?.focus();
    };
    el.addEventListener('toggle', onToggle);
    return () => el.removeEventListener('toggle', onToggle);
  }, []);

  const choose = (k: DishKind) => {
    onKind(k);
    pop.current?.hidePopover?.();
    trigger.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const move = KIND_MOVES[e.key];
    const at = DISH_KINDS.indexOf(kind);
    if (!move || at < 0) return;
    e.preventDefault();
    const next = DISH_KINDS[Math.min(DISH_KINDS.length - 1, Math.max(0, move(at)))];
    if (next === kind) return;
    onKind(next);
    pop.current?.querySelector<HTMLElement>(`[data-kind="${next}"]`)?.focus();
  };

  return (
    <div className="rc-kind">
      <button
        ref={trigger}
        type="button"
        className="rc-kind-btn"
        popoverTarget={`${id}-kinds`}
        aria-label={`Kind of dish: ${kindLabel(kind)}. Change`}
        data-testid="studio-kind"
      >
        <DishPhoto key={kind} src={kindPhoto(kind)} size={76} className="rc-plate" />
        <span className="rc-kind-name" aria-hidden="true">
          {kindLabel(kind)} <ChevronDown size={14} strokeWidth={2.5} />
        </span>
      </button>
      <div
        ref={pop}
        id={`${id}-kinds`}
        popover="auto"
        className="kind-pop"
        onBlur={e => {
          // Tabbing out of the plates closes them, like a menu.
          const to = e.relatedTarget;
          if (to instanceof Node && !pop.current?.contains(to) && to !== trigger.current) pop.current?.hidePopover?.();
        }}
      >
        <p className="kind-pop-title" id={`${id}-kinds-title`}>
          What kind of dish?
        </p>
        <div className="kind-grid" role="radiogroup" aria-labelledby={`${id}-kinds-title`} onKeyDown={onKey}>
          {DISH_KINDS.map(k => (
            <button
              key={k}
              type="button"
              role="radio"
              className="kind-opt"
              aria-checked={k === kind}
              tabIndex={k === kind ? 0 : -1}
              onClick={() => choose(k)}
              data-kind={k}
              data-testid={`kind-${k}`}
            >
              <DishPhoto src={kindPhoto(k)} size={48} />
              <span>{kindLabel(k)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Keys a number field would take that no step time needs (exponents, signs, decimals). */
const NOT_MINUTES = new Set(['e', 'E', '+', '-', '.', ',']);

/** Minutes as typed, committed only when it's a whole number from 1 up; blur shows the value in use. */
function MinutesField({ value, label, onChange, pillRef }: { value: number; label: string; onChange: (m: number) => void; pillRef?: (el: HTMLElement | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="rc-min" ref={pillRef}>
      <span className="visually-hidden">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={240}
        step={1}
        className="num"
        value={draft ?? String(value)}
        onKeyDown={e => NOT_MINUTES.has(e.key) && e.preventDefault()}
        onChange={e => {
          setDraft(e.target.value);
          if (!/^\d+$/.test(e.target.value)) return;
          const n = parseInt(e.target.value, 10);
          if (n >= 1) onChange(clampMinutes(n));
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="rc-min-unit" aria-hidden="true">
        min
      </span>
    </label>
  );
}

/** Keys that follow each chip's text, so removing one doesn't remount (and re-animate) the chips after it. */
function chipKeys(items: string[]): string[] {
  const seen = new Map<string, number>();
  return items.map(x => {
    const n = (seen.get(x) ?? 0) + 1;
    seen.set(x, n);
    return n > 1 ? `${x}#${n}` : x;
  });
}

function Ingredients({ items, onChange }: { items: string[]; onChange: (next: string[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState('');
  /** Where focus goes once the chips re-render: a chip (by key), or the add field (''). */
  const [refocus, setRefocus] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const full = items.length >= MAX_INGREDIENTS;
  const keys = chipKeys(items);

  useEffect(() => {
    if (refocus === null) return;
    (chipRefs.current.get(refocus) ?? addRef.current)?.focus();
    setRefocus(null);
  }, [refocus]);

  const add = () => {
    const parts = adding.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    const next = [...items];
    for (const p of parts) if (next.length < MAX_INGREDIENTS && !next.some(x => x.toLowerCase() === p.toLowerCase())) next.push(p);
    if (next.length !== items.length) onChange(next);
    setAdding('');
  };

  /** Saves a chip's new text (empty removes it); from the keyboard, focus stays on that chip. */
  const commit = (i: number, value: string, keepFocus = false) => {
    const v = value.trim();
    const next = v ? items.map((x, j) => (j === i ? v : x)) : items.filter((_, j) => j !== i);
    setEditing(null);
    if (next.some((x, j) => x !== items[j]) || next.length !== items.length) onChange(next);
    if (keepFocus) setRefocus(v ? chipKeys(next)[i] : '');
  };

  const editKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(i, e.currentTarget.value, true);
    } else if (e.key === 'Escape') {
      // Esc cancels the edit, not the whole studio.
      e.preventDefault();
      e.stopPropagation();
      setEditing(null);
      setRefocus(keys[i]);
    }
  };

  return (
    <div className="rc-ingredients">
      {items.length > 0 && (
        <ul className="rc-chips">
          {items.map((ing, i) => (
            <li key={keys[i]} className="rc-chip">
              {editing === i ? (
                <input
                  className="rc-chip-input"
                  defaultValue={ing}
                  aria-label={`Ingredient ${i + 1}`}
                  autoFocus
                  size={Math.max(6, ing.length)}
                  onBlur={e => commit(i, e.currentTarget.value)}
                  onKeyDown={editKey(i)}
                />
              ) : (
                <button
                  ref={el => {
                    if (el) chipRefs.current.set(keys[i], el);
                    else chipRefs.current.delete(keys[i]);
                  }}
                  type="button"
                  className="rc-chip-text"
                  onClick={() => setEditing(i)}
                  aria-label={`Edit ${ing}`}
                >
                  {ing}
                </button>
              )}
              <button
                type="button"
                className="rc-chip-x"
                aria-label={`Remove ${ing}`}
                onClick={() => {
                  onChange(items.filter((_, j) => j !== i));
                  setRefocus('');
                }}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="rc-add-ing">
        <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
        <span className="visually-hidden">Add an ingredient</span>
        <input
          ref={addRef}
          value={adding}
          disabled={full}
          placeholder={full ? 'That’s the most a card holds' : items.length ? 'Add another' : 'Add an ingredient, like 1 cup toor dal'}
          onChange={e => setAdding(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || (e.key === ',' && adding.trim())) {
              e.preventDefault();
              add();
            }
          }}
          onBlur={() => adding.trim() && add()}
          data-testid="studio-add-ingredient"
        />
      </label>
    </div>
  );
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A re-timed step's minutes flash saffron, like a ticket's time when a re-plan moves it. */
function flashTime(el: HTMLElement) {
  if (reducedMotion() || typeof el.animate !== 'function') return;
  const saffron = getComputedStyle(el).getPropertyValue('--saffron').trim() || 'gold';
  el.animate(
    [{ backgroundColor: saffron, borderColor: saffron }, { backgroundColor: saffron, borderColor: saffron, offset: 0.4 }, { backgroundColor: 'transparent' }],
    { duration: 2400, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
  );
}

export function StudioCard({ card, onEdit, newStep, writing, aiEnabled, showErrors, total }: StudioCardProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [focus, setFocus] = useState<Focus | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const addRef = useRef<HTMLButtonElement>(null);
  const ingredientsRef = useRef<HTMLDivElement>(null);
  const before = useRef(card);
  const short = card.short.trim() || defaultShort(card.name);

  // Show what Chef changed (a new step, new minutes, a new ingredient) when it lands out of view.
  // Changes the cook is typing themselves are left alone.
  useEffect(() => {
    const prev = before.current;
    before.current = card;
    if (prev === card) return;
    const active = document.activeElement;
    let target: Element | null | undefined = null;
    const added = card.steps.find(s => s.enter !== undefined && !prev.steps.some(p => p.key === s.key));
    if (added) target = refs.current.get(`${added.key}:row`);
    for (const s of card.steps) {
      const old = prev.steps.find(p => p.key === s.key);
      const pill = refs.current.get(`${s.key}:min`);
      if (!old || old.minutes === s.minutes || !pill || pill.contains(active)) continue;
      flashTime(pill);
      target ??= pill;
    }
    const box = ingredientsRef.current;
    if (!target && box && card.ingredients.length > prev.ingredients.length && !box.contains(active)) {
      target = box.querySelector('.rc-chip:last-child');
    }
    target?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [card]);

  useEffect(() => {
    if (!focus) return;
    const el = focus.part === 'add' ? addRef.current : refs.current.get(`${focus.key}:${focus.part}`);
    el?.focus();
    setFocus(null);
  }, [focus]);

  const ref = (key: string, part: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(`${key}:${part}`, el);
    else refs.current.delete(`${key}:${part}`);
  };

  const setStep = (key: string, patch: Partial<DraftStep>) =>
    onEdit(c => ({ ...c, steps: c.steps.map(s => (s.key === key ? { ...s, ...patch, enter: undefined } : s)) }));

  // Moves and deletes go by the step's key, so a card Chef rewrote a moment ago can't shift which step it hits.
  const move = (key: string, by: -1 | 1) => {
    const i = card.steps.findIndex(s => s.key === key);
    const j = i + by;
    if (i < 0 || j < 0 || j >= card.steps.length) return;
    onEdit(c => {
      const from = c.steps.findIndex(s => s.key === key);
      const to = from + by;
      if (from < 0 || to < 0 || to >= c.steps.length) return c;
      const steps = [...c.steps];
      [steps[from], steps[to]] = [steps[to], steps[from]];
      return { ...c, steps };
    });
    const edge = j === 0 ? 'down' : j === card.steps.length - 1 ? 'up' : by === -1 ? 'up' : 'down';
    setFocus({ key, part: edge });
  };

  const remove = (key: string) => {
    const i = card.steps.findIndex(s => s.key === key);
    const next = card.steps[i + 1] ?? card.steps[i - 1];
    onEdit(c => ({ ...c, steps: c.steps.filter(s => s.key !== key) }));
    setFocus(next ? { key: next.key, part: 'label' } : { key: '', part: 'add' });
  };

  const add = () => {
    const s = newStep();
    onEdit(c => ({ ...c, steps: [...c.steps, s] }));
    setFocus({ key: s.key, part: 'label' });
  };

  const toggleCall = (key: string) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const nameMissing = showErrors && !card.name.trim();
  const empty = card.steps.length === 0;

  return (
    <section className="rc-pane" aria-labelledby="rc-title">
      <header className="rc-pane-head">
        <h3 id="rc-title" className="studio-pane-title">
          Recipe card
        </h3>
        {card.steps.length > 0 && (
          <p className="rc-total" data-testid="studio-total">
            <Timer size={16} aria-hidden="true" />
            <span className="num">{total} min</span>
            <span className="rc-total-steps">
              · {card.steps.length} {card.steps.length === 1 ? 'step' : 'steps'}
            </span>
          </p>
        )}
      </header>

      <div className="rc-scroll">
        <article className={writing ? 'rc-ticket is-writing' : 'rc-ticket'} aria-busy={writing} aria-labelledby="rc-title">
          <div className="rc-head">
            <KindPicker kind={card.kind} onKind={kind => onEdit(c => ({ ...c, kind }))} />
            <div className="rc-names">
              <label className="rc-field">
                <span className="rc-label">Name</span>
                <input
                  id="studio-name"
                  className="rc-name"
                  value={card.name}
                  placeholder="Name this dish"
                  autoComplete="off"
                  aria-invalid={nameMissing || undefined}
                  onChange={e => onEdit(c => ({ ...c, name: e.target.value }))}
                  data-testid="studio-name"
                />
              </label>
              <div className="rc-field rc-field-short">
                <label className="rc-label" htmlFor="studio-short">
                  What you call it
                </label>
                <input
                  id="studio-short"
                  className="rc-short"
                  value={card.short}
                  placeholder={defaultShort(card.name) || 'one word'}
                  autoComplete="off"
                  size={Math.max(5, (card.short || defaultShort(card.name) || 'one word').length + 1)}
                  aria-describedby="rc-short-hint"
                  onChange={e => onEdit(c => ({ ...c, short: e.target.value }))}
                  data-testid="studio-short"
                />
                <span id="rc-short-hint" className="rc-hint">
                  The word Chef calls out, like “{capitalize(short || 'dal')} on.”
                </span>
              </div>
            </div>
          </div>

          <div className="rc-section">
            <h4 className="rc-section-title">Steps</h4>
            {empty && !writing && (
              <p className="rc-empty">{aiEnabled ? 'No steps yet. Tell Chef on the left, or add them here by hand.' : 'No steps yet. Add the first one below.'}</p>
            )}
            {card.steps.length > 0 && (
              <ol className="rc-steps" data-testid="studio-steps">
                {card.steps.map((s, i) => {
                  const n = i + 1;
                  const callOpen = open.has(s.key);
                  const labelMissing = showErrors && !s.label.trim();
                  return (
                    <li
                      key={s.key}
                      ref={ref(s.key, 'row')}
                      className={s.enter !== undefined ? 'rc-step is-new' : 'rc-step'}
                      style={s.enter !== undefined ? ({ '--i': s.enter } as CSSProperties) : undefined}
                      data-testid="studio-step"
                    >
                      <span className="rc-step-n num" aria-hidden="true">
                        {n}
                      </span>
                      <input
                        ref={ref(s.key, 'label')}
                        className="rc-step-label"
                        value={s.label}
                        placeholder="What to do, like “Fry the onions”"
                        aria-label={`Step ${n}`}
                        aria-invalid={labelMissing || undefined}
                        onChange={e => setStep(s.key, { label: e.target.value })}
                      />
                      <MinutesField
                        value={s.minutes}
                        label={`Step ${n} minutes`}
                        onChange={minutes => setStep(s.key, { minutes })}
                        pillRef={ref(s.key, 'min')}
                      />
                      <div className="rc-step-tools">
                        <button
                          type="button"
                          className="rc-tool"
                          aria-expanded={callOpen}
                          aria-controls={`call-${s.key}`}
                          aria-label={`What Chef says for step ${n}`}
                          title="What Chef says"
                          onClick={() => toggleCall(s.key)}
                        >
                          <Volume2 size={16} />
                        </button>
                        <button
                          ref={ref(s.key, 'up')}
                          type="button"
                          className="rc-tool"
                          aria-label={`Move step ${n} up`}
                          disabled={i === 0}
                          onClick={() => move(s.key, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          ref={ref(s.key, 'down')}
                          type="button"
                          className="rc-tool"
                          aria-label={`Move step ${n} down`}
                          disabled={i === card.steps.length - 1}
                          onClick={() => move(s.key, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button type="button" className="rc-tool rc-tool-del" aria-label={`Delete step ${n}`} onClick={() => remove(s.key)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {callOpen && (
                        <div className="rc-call" id={`call-${s.key}`}>
                          <label className="rc-call-label" htmlFor={`call-input-${s.key}`}>
                            Chef says
                          </label>
                          <textarea
                            id={`call-input-${s.key}`}
                            rows={1}
                            value={s.call}
                            placeholder={defaultCall(short, s.label || 'Next step')}
                            onChange={e => setStep(s.key, { call: e.target.value.replace(/\s*\n+\s*/g, ' ') })}
                            onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {writing && (
              <div className="rc-skeleton" aria-hidden="true">
                <span />
                <span />
                {empty && <span />}
              </div>
            )}
            <button
              ref={addRef}
              type="button"
              className="rc-add-step"
              onClick={add}
              disabled={card.steps.length >= MAX_STEPS}
              data-testid="studio-add-step"
            >
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              {card.steps.length >= MAX_STEPS ? `A card holds ${MAX_STEPS} steps` : 'Add step'}
            </button>
          </div>

          <div className="rc-section">
            <h4 className="rc-section-title">Ingredients</h4>
            <div ref={ingredientsRef}>
              <Ingredients items={card.ingredients} onChange={ingredients => onEdit(c => ({ ...c, ingredients }))} />
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
