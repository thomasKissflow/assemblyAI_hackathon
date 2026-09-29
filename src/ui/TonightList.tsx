import { useEffect, useId, useRef, useState } from 'react';
import { BookmarkPlus, PenLine, Plus, SlidersHorizontal, X } from 'lucide-react';
import { MAX_DISHES } from '../kitchen/planner';
import type { DishId, Recipe } from '../kitchen/recipes';
import { DishPhoto } from './DishPhoto';
import './TonightList.css';

export const dishCount = (n: number) => `${n} ${n === 1 ? 'dish' : 'dishes'}`;

/** "35 min · 3 steps": the whole cook, start to finish. */
export function recipeMeta(r: Recipe): string {
  const minutes = r.steps.reduce((sum, s) => sum + s.minutes, 0);
  return `${minutes} min · ${r.steps.length} ${r.steps.length === 1 ? 'step' : 'steps'}`;
}

/** Who a recipe belongs to, when it isn't one of Chef's. */
export const ownership = (r: Recipe) => (!r.custom ? null : r.basedOn ? 'your version' : 'your recipe');

export interface TonightListProps {
  dishes: Recipe[];
  /** A quiet line under the heading, e.g. the menu it came from. */
  status: string;
  /** Tonight differs from the selected menu, so it can be saved as one. */
  canSave: boolean;
  onRemove: (id: DishId) => void;
  onCustomise: (r: Recipe) => void;
  onAdd: () => void;
  onNew: () => void;
  /** Saves Tonight as a menu; false when it couldn't be saved. */
  onSaveMenu: (label: string) => boolean;
}

/** Tonight's dishes, editable: customise or remove each one, add from the recipe book, or write a new recipe. */
export function TonightList({ dishes, status, canSave, onRemove, onCustomise, onAdd, onNew, onSaveMenu }: TonightListProps) {
  const id = useId();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const backToSave = useRef(false);
  const full = dishes.length >= MAX_DISHES;

  useEffect(() => {
    if (!canSave) setNaming(false);
  }, [canSave]);
  useEffect(() => {
    if (naming) input.current?.focus();
    else if (backToSave.current) saveButton.current?.focus();
    backToSave.current = false;
  }, [naming]);

  const cancel = () => {
    setNaming(false);
    setName('');
  };

  return (
    <section className="tonight" aria-labelledby={`${id}-title`}>
      <div className="tonight-head">
        <h3 id={`${id}-title`} className="section-title">
          Tonight
        </h3>
        {naming ? (
          <form
            className="save-menu"
            onSubmit={e => {
              e.preventDefault();
              if (name.trim() && onSaveMenu(name.trim())) cancel();
            }}
          >
            <label className="visually-hidden" htmlFor={`${id}-name`}>
              Menu name
            </label>
            <input
              ref={input}
              id={`${id}-name`}
              className="save-menu-input"
              value={name}
              maxLength={40}
              placeholder="Name this menu"
              autoComplete="off"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  backToSave.current = true;
                  cancel();
                }
              }}
              data-testid="save-menu-name"
            />
            <button type="submit" className="btn btn-ghost btn-sm" disabled={!name.trim()} data-testid="save-menu-confirm">
              Save menu
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => {
                backToSave.current = true;
                cancel();
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className="tonight-status">{status}</span>
            {canSave && (
              <button ref={saveButton} type="button" className="text-btn tonight-save" onClick={() => setNaming(true)} data-testid="save-menu">
                <BookmarkPlus size={16} aria-hidden="true" /> Save as menu
              </button>
            )}
          </>
        )}
      </div>

      {dishes.length === 0 ? (
        <div className="tonight-empty" data-testid="tonight-empty">
          <p>
            <strong>Nothing on tonight yet.</strong> Pick a menu above, or add dishes one at a time.
          </p>
        </div>
      ) : (
        <ul className="tonight-list" aria-labelledby={`${id}-title`}>
          {dishes.map(r => {
            const whose = ownership(r);
            return (
              <li key={r.id} className="tonight-row" data-testid={`tonight-${r.id}`}>
                <DishPhoto src={r.photo} size={44} />
                <span className="tonight-text">
                  <span className="tonight-name">{r.name}</span>
                  <span className="tonight-meta num">
                    <span className="tonight-fact">{recipeMeta(r)}</span>
                    {whose && (
                      <>
                        <span className="tonight-dot"> · </span>
                        <span className="tonight-whose">{whose}</span>
                      </>
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onCustomise(r)}
                  aria-label={`${r.custom ? 'Edit' : 'Customise'} ${r.name}`}
                  data-testid={`customise-${r.id}`}
                >
                  <SlidersHorizontal size={15} aria-hidden="true" />
                  <span className="text-btn-label">{r.custom ? 'Edit' : 'Customise'}</span>
                </button>
                <button type="button" className="row-icon" onClick={() => onRemove(r.id)} aria-label={`Remove ${r.name}`} data-testid={`remove-${r.id}`}>
                  <X size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="tonight-add">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd} disabled={full} aria-describedby={full ? `${id}-full` : undefined} data-testid="add-dish">
          <Plus size={17} aria-hidden="true" /> Add a dish
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onNew} data-testid="new-recipe">
          <PenLine size={16} aria-hidden="true" /> New recipe
        </button>
        {full && (
          <p id={`${id}-full`} className="tonight-hint">
            Six dishes is the most Chef can run at once.
          </p>
        )}
      </div>
    </section>
  );
}
