import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, X } from 'lucide-react';
import type { DishId, Recipe } from '../kitchen/recipes';
import { newRecipeId, useLibrary } from '../kitchen/library';
import { draftToRecipe, emptyDraft, recipeToDraft, totalMinutes, validateDraft, type DraftStep, type RecipeDraft } from '../kitchen/draft';
import { useDictation, type DictationOptions } from '../voice/dictation';
import { defaultScribeFactory, useScribe, type ScribeFactory } from './useScribe';
import { StudioCard, type Card, type CardStep } from './StudioCard';
import { StudioTell } from './StudioTell';
import './RecipeStudio.css';

export interface RecipeStudioProps {
  open: boolean;
  /** Recipe to edit; a built-in here means "customise a copy". Omit for a new recipe. */
  initial?: Recipe;
  /** Set when customising a built-in: the saved copy records it. */
  basedOn?: DishId;
  /** Show "Save & add to tonight" as the primary action. */
  addToTonight?: boolean;
  onClose: () => void;
  /** The parent stores the recipe (libraryStore.saveRecipe) and closes the studio. */
  onSave: (recipe: Recipe, opts: { addToTonight: boolean }) => void;
  /** Chef's scribe; null works by hand only. Defaults to the live scribe when there's an AssemblyAI key. */
  scribe?: ScribeFactory | null;
  /** The dictation hook (tests pass a fake). Must not change while the studio is open. */
  listen?: (opts: DictationOptions) => Pick<ReturnType<typeof useDictation>, 'status' | 'partial' | 'error' | 'start' | 'stop' | 'level'>;
}

let keySeq = 0;

/** Appends a dictated turn. A turn that arrived unformatted has no full stop, so the next sentence would run on. */
export function appendSaid(text: string, said: string): string {
  if (!text.trim()) return said;
  const body = text.trimEnd();
  const stop = /[.!?,;:]$/.test(body) || !/^[A-Z]/.test(said.trimStart()) ? '' : '.';
  return `${body}${stop} ${said.trimStart()}`;
}
const stepKey = () => `st${++keySeq}`;

const toCard = (d: RecipeDraft): Card => ({ ...d, steps: d.steps.map(s => ({ ...s, key: stepKey() })) });
const toDraft = (c: Card): RecipeDraft => ({
  name: c.name,
  short: c.short,
  kind: c.kind,
  steps: c.steps.map(({ label, minutes, call }) => ({ label, minutes, call })),
  ingredients: c.ingredients,
});

/** Steps from Chef, keeping the keys of steps the card already had (matched by name) so only new ones animate in. */
function rekey(prev: CardStep[], next: DraftStep[]): CardStep[] {
  const pool = new Map<string, CardStep[]>();
  for (const p of prev) {
    const k = p.label.trim().toLowerCase();
    pool.set(k, [...(pool.get(k) ?? []), p]);
  }
  let fresh = 0;
  return next.map(s => {
    const hit = pool.get(s.label.trim().toLowerCase())?.shift();
    return hit ? { ...s, key: hit.key } : { ...s, key: stepKey(), enter: fresh++ };
  });
}

const sameDraft = (a: RecipeDraft, b: RecipeDraft) => JSON.stringify(a) === JSON.stringify(b);

function popoverOpen(root: HTMLElement | null): boolean {
  try {
    return !!root?.querySelector(':popover-open');
  } catch {
    return false; // No popover support, so none is open.
  }
}

function Studio({ initial, basedOn, addToTonight = false, onClose, onSave, scribe = defaultScribeFactory, listen = useDictation }: RecipeStudioProps) {
  const library = useLibrary();
  const dialog = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const [start] = useState(() => (initial ? recipeToDraft(initial) : emptyDraft()));
  const [card, setCard] = useState<Card>(() => toCard(start));
  const [text, setText] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const draft = useMemo(() => toDraft(card), [card]);
  const errors = useMemo(() => validateDraft(draft), [draft]);
  const dirty = text.trim() !== '' || !sameDraft(draft, start);

  const onDraft = useCallback((next: RecipeDraft) => {
    setCard(c => ({ ...next, steps: rekey(c.steps, next.steps) }));
  }, []);
  const ai = useScribe({ factory: scribe, text, draft, onDraft });

  const dictation = listen({
    onCommit: said => {
      setText(t => appendSaid(t, said));
      ai.formatSoon('said');
    },
  });
  // A mic problem takes the status line until the next thing Chef has to say (not for good).
  const { note } = ai;
  useEffect(() => {
    if (dictation.status === 'error' && dictation.error) note({ tone: 'error', text: dictation.error });
  }, [dictation.status, dictation.error, note]);
  const micBusy = dictation.status === 'listening' || dictation.status === 'starting';
  const toggleMic = () => {
    if (micBusy) void dictation.stop();
    else void dictation.start([draft.name, draft.short, ...draft.ingredients].filter(Boolean));
  };

  // A hand edit settles every step Chef just wrote, so a moved row doesn't replay its entrance.
  const edit = (fn: (c: Card) => Card) => {
    setCard(c => {
      const next = fn(c);
      return next.steps.some(s => s.enter !== undefined) ? { ...next, steps: next.steps.map(({ enter: _, ...s }) => s) } : next;
    });
    ai.edited();
  };

  // Open as a modal (focus trap, Esc, top layer). The element leaving the page closes it,
  // so focus goes back to whatever opened the studio by hand.
  const opener = useRef(typeof document === 'undefined' ? null : document.activeElement);
  useEffect(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
    textRef.current?.focus();
  }, []);
  useEffect(() => () => {
    const back = opener.current;
    if (back instanceof HTMLElement && back.isConnected) requestAnimationFrame(() => back.focus());
  }, []);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  const requestClose = () => {
    if (dirty) setConfirming(true);
    else onClose();
  };

  const keepEditing = () => {
    setConfirming(false);
    requestAnimationFrame(() => cancelRef.current?.focus());
  };

  const onEscape = () => {
    if (confirming) keepEditing();
    else requestClose();
  };

  /** The field to fix first: the name, then Add step, then the first nameless step, then the first step's minutes (too long). */
  const firstProblem = (): HTMLElement | null | undefined => {
    const d = dialog.current;
    if (!draft.name.trim()) return document.getElementById('studio-name');
    if (!draft.steps.length) return d?.querySelector<HTMLElement>('[data-testid="studio-add-step"]');
    const blank = draft.steps.findIndex(s => !s.label.trim());
    if (blank >= 0) return d?.querySelectorAll<HTMLElement>('.rc-step-label')[blank];
    return d?.querySelector<HTMLElement>('.rc-min input');
  };

  const save = (addNow: boolean) => {
    if (errors.length) {
      setAttempted(true);
      firstProblem()?.focus();
      return;
    }
    const id = initial?.custom ? initial.id : newRecipeId(draft.name, library);
    const origin = basedOn ?? (initial && !initial.custom ? initial.id : initial?.basedOn);
    onSave(draftToRecipe(draft, id, origin ? { basedOn: origin } : {}), { addToTonight: addNow });
  };

  const title = !initial ? 'New recipe' : initial.custom ? `Edit ${initial.name}` : `Customise ${initial.name}`;
  const subtitle = initial && !initial.custom ? 'Saved as your own copy. Chef’s original stays as it is.' : null;
  const showErrors = attempted && errors.length > 0;

  return (
    <dialog
      ref={dialog}
      className="studio"
      aria-labelledby="studio-title"
      onKeyDown={e => {
        // Esc is handled here rather than in `cancel`: Chrome closes a modal anyway when a second Esc's cancel
        // is prevented, which would throw the recipe away. An open plate picker takes its own Esc first.
        if (e.key !== 'Escape' || e.defaultPrevented || e.nativeEvent.isComposing || popoverOpen(dialog.current)) return;
        e.preventDefault();
        onEscape();
      }}
      onCancel={e => {
        // Other close requests (like Android's back gesture): ask first when there's something to lose.
        e.preventDefault();
        onEscape();
      }}
      onClose={onClose}
      data-testid="recipe-studio"
    >
      <header className="studio-head">
        <div className="studio-heading">
          <h2 id="studio-title" className="studio-title">
            {title}
          </h2>
          {subtitle && <p className="studio-sub">{subtitle}</p>}
        </div>
        <button type="button" className="icon-btn studio-close" aria-label="Close" onClick={requestClose}>
          <X size={20} />
        </button>
      </header>

      <div className="studio-body">
        <StudioTell
          text={text}
          onText={setText}
          ai={ai}
          textRef={textRef}
          mic={{ status: dictation.status, partial: dictation.partial, level: dictation.level, toggle: toggleMic }}
        />
        <StudioCard
          card={card}
          onEdit={edit}
          newStep={() => ({ key: stepKey(), label: '', minutes: 5, call: '' })}
          writing={ai.busy === 'format'}
          aiEnabled={ai.enabled}
          showErrors={showErrors}
          total={totalMinutes(draft)}
        />
      </div>

      <footer className={confirming ? 'studio-foot is-confirming' : 'studio-foot'}>
        {confirming ? (
          <>
            <p className="studio-foot-msg is-ask" id="studio-discard">
              {initial ? 'Discard your changes?' : 'Discard this recipe?'}
            </p>
            <div className="studio-actions">
              <button ref={keepRef} type="button" className="btn btn-ghost" onClick={keepEditing}>
                Keep editing
              </button>
              <button type="button" className="btn btn-discard" onClick={onClose} aria-describedby="studio-discard" data-testid="studio-discard">
                Discard
              </button>
            </div>
          </>
        ) : (
          <>
            {showErrors ? (
              <p className="studio-foot-msg is-error" role="alert" data-testid="studio-errors">
                <CircleAlert size={16} aria-hidden="true" />
                {errors.join(' ')}
              </p>
            ) : (
              <p className="studio-foot-msg">Saved in this browser, ready for next time.</p>
            )}
            <div className="studio-actions">
              <button ref={cancelRef} type="button" className="btn btn-quiet" onClick={requestClose} data-testid="studio-cancel">
                Cancel
              </button>
              <button
                type="button"
                className={addToTonight ? 'btn btn-ghost' : 'btn btn-fire'}
                onClick={() => save(false)}
                data-testid="studio-save"
              >
                Save recipe
              </button>
              <button
                type="button"
                className={addToTonight ? 'btn btn-fire' : 'btn btn-ghost'}
                onClick={() => save(true)}
                data-testid="studio-save-add"
              >
                Save &amp; add to tonight
              </button>
            </div>
          </>
        )}
      </footer>
    </dialog>
  );
}

/** The recipe studio: tell Chef a recipe (typed or said), then shape the card by hand. Mounted only while open. */
export function RecipeStudio(props: RecipeStudioProps) {
  if (!props.open) return null;
  return <Studio {...props} />;
}
