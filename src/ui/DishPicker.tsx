import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeftRight, PenLine, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { MAX_DISHES } from '../kitchen/planner';
import type { Recipe } from '../kitchen/recipes';
import { DishPhoto } from './DishPhoto';
import { ConfirmDialog, useModalDialog } from './MenuDialog';
import { dishCount, ownership, recipeMeta } from './TonightList';
import './DishPicker.css';

export interface DishPickerProps {
  open: boolean;
  /** The recipe book minus tonight's dishes. */
  recipes: Recipe[];
  tonightCount: number;
  /** Tonight's other version of the same dish, which adding this recipe swaps out. */
  swapFor?: (r: Recipe) => Recipe | undefined;
  onAdd: (r: Recipe) => void;
  onEdit: (r: Recipe) => void;
  onDelete: (r: Recipe) => void;
  onNew: () => void;
  onClose: () => void;
}

const matches = (r: Recipe, q: string) => !q || `${r.name} ${r.short} ${r.kind}`.toLowerCase().includes(q);

/** The recipe book as a modal list: the cook's own recipes first, then Chef's. Stays open so several dishes can go on. */
export function DishPicker({ open, recipes, tonightCount, swapFor = () => undefined, onAdd, onEdit, onDelete, onNew, onClose }: DishPickerProps) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<Recipe | null>(null);
  const refocus = useRef<number | null>(null);
  // A click only closes from the backdrop when it also started there (not a drag out of the search box).
  const pressedBackdrop = useRef(false);
  useModalDialog(ref, open);

  useEffect(() => {
    if (open) return;
    setQuery('');
    setNote('');
    setConfirm(null);
  }, [open]);

  const q = query.trim().toLowerCase();
  const mine = recipes.filter(r => r.custom && matches(r, q));
  const chefs = recipes.filter(r => !r.custom && matches(r, q));
  const visible = [...mine, ...chefs];
  const full = tonightCount >= MAX_DISHES;

  // An added or deleted row leaves the list: keep focus on the row that took its place.
  useEffect(() => {
    const i = refocus.current;
    if (i === null) return;
    refocus.current = null;
    const next = visible[Math.min(i, visible.length - 1)];
    const row = next && ref.current?.querySelector<HTMLButtonElement>(`[data-testid="picker-${next.id}"]`);
    (row && !row.disabled ? row : ref.current?.querySelector<HTMLElement>('[data-picker-done]'))?.focus();
  });

  const add = (r: Recipe) => {
    const twin = swapFor(r);
    refocus.current = visible.indexOf(r);
    setNote(twin ? `${r.name} is on instead of ${ownership(twin) ?? 'Chef’s'}. ` : `Added ${r.name}. `);
    onAdd(r);
  };

  const status = `${note}${full ? 'Tonight is full: six dishes is the most Chef can run at once.' : `Tonight: ${dishCount(tonightCount)}.`}`;

  const row = (r: Recipe) => {
    const whose = ownership(r);
    // Another version of this dish is on tonight: adding this one swaps it, even when tonight is full.
    const twin = swapFor(r);
    return (
      <li key={r.id} className={r.custom ? 'picker-row is-mine' : 'picker-row'}>
        <button type="button" className="picker-add" onClick={() => add(r)} disabled={full && !twin} data-testid={`picker-${r.id}`}>
          <DishPhoto src={r.photo} size={40} />
          <span className="picker-text">
            <span className="picker-name">
              <span className="visually-hidden">{twin ? 'Swap in ' : 'Add '}</span>
              {r.name}
            </span>
            <span className="picker-meta num">
              {recipeMeta(r)}
              {whose && r.basedOn ? ` · ${whose}` : ''}
              {twin && <span className="picker-swap"> · instead of {ownership(twin) ?? 'Chef’s'}</span>}
            </span>
          </span>
          {twin ? <ArrowLeftRight className="picker-plus" size={18} aria-hidden="true" /> : <Plus className="picker-plus" size={18} aria-hidden="true" />}
        </button>
        {r.custom && (
          <>
            <button type="button" className="row-icon picker-edit" aria-label={`Edit ${r.name}`} onClick={() => onEdit(r)} data-testid={`picker-edit-${r.id}`}>
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="row-icon row-icon--danger picker-delete"
              aria-label={`Delete ${r.name}`}
              onClick={() => setConfirm(r)}
              data-testid={`picker-delete-${r.id}`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </li>
    );
  };

  return (
    <dialog
      ref={ref}
      className="picker"
      aria-labelledby={`${id}-title`}
      onCancel={e => {
        // React bubbles a nested confirm dialog's cancel up to here: only Esc on the picker itself closes it.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onPointerDown={e => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={e => {
        if (e.target === e.currentTarget && pressedBackdrop.current) onClose();
        pressedBackdrop.current = false;
      }}
      data-testid="dish-picker"
    >
      <div className="picker-inner">
        <header className="picker-head">
          <h2 id={`${id}-title`} className="picker-title">
            Add a dish
          </h2>
          <button type="button" className="row-icon" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="picker-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Find a dish"
            placeholder="Find a dish"
            value={query}
            autoComplete="off"
            onChange={e => setQuery(e.target.value)}
            data-autofocus
          />
        </div>

        <div className="picker-body">
          {mine.length > 0 && (
            <section aria-labelledby={`${id}-mine`}>
              <h3 id={`${id}-mine`} className="picker-group">
                Your recipes
              </h3>
              <ul className="picker-list">{mine.map(row)}</ul>
            </section>
          )}
          {chefs.length > 0 && (
            <section aria-labelledby={`${id}-chef`}>
              <h3 id={`${id}-chef`} className="picker-group">
                Chef’s recipes
              </h3>
              <ul className="picker-list">{chefs.map(row)}</ul>
            </section>
          )}
          {visible.length === 0 && (
            <div className="picker-empty">
              <p>{q ? `No dish left to add matches “${query.trim()}”.` : 'Every dish in your recipe book is already on tonight.'}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onNew}>
                <PenLine size={16} aria-hidden="true" /> Write a new recipe
              </button>
            </div>
          )}
        </div>

        <footer className="picker-foot">
          <p className="picker-status" aria-live="polite">
            {status}
          </p>
          <button type="button" className="btn btn-quiet btn-sm" onClick={onNew} data-testid="picker-new">
            <PenLine size={16} aria-hidden="true" /> New recipe
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} data-picker-done>
            Done
          </button>
        </footer>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? `Delete ${confirm.name}?` : 'Delete recipe?'}
        body="It leaves your recipe book, and any of your menus that use it."
        confirmLabel="Delete recipe"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) {
            refocus.current = visible.indexOf(confirm);
            setNote(`Deleted ${confirm.name}. `);
            onDelete(confirm);
          }
          setConfirm(null);
        }}
      />
    </dialog>
  );
}
