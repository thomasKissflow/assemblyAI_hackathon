import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { menuDishes, type Library } from '../kitchen/library';
import type { Menu } from '../kitchen/recipes';
import { DishPhoto } from './DishPhoto';
import { dishCount } from './TonightList';
import { ConfirmDialog } from './MenuDialog';
import './MenuTiles.css';

export interface MenuTilesProps {
  library: Library;
  selected: string | null;
  /** Tonight started from the selected menu but has changed since. */
  changed?: boolean;
  labelledBy: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Chef's menus and the cook's saved ones, one compact tile each. Picking one loads its dishes into Tonight. */
export function MenuTiles({ library, selected, changed = false, labelledBy, onSelect, onDelete }: MenuTilesProps) {
  const [confirm, setConfirm] = useState<Menu | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  // Fade whichever edge has more menus past it (set on the element, so scrolling never re-renders).
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const mark = () => {
      el.toggleAttribute('data-more-start', el.scrollLeft > 2);
      el.toggleAttribute('data-more-end', el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    mark();
    el.addEventListener('scroll', mark, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(mark) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', mark);
      ro?.disconnect();
    };
  }, [library.menus.length]);

  return (
    <>
      <div ref={strip} className="menu-strip" role="group" aria-labelledby={labelledBy}>
        {library.menus.map(m => {
          const dishes = menuDishes(library, m);
          return (
            <div key={m.id} className={m.custom ? 'menu-cell is-custom' : 'menu-cell'}>
              <button
                type="button"
                className="menu-tile"
                aria-pressed={selected === m.id}
                data-changed={(selected === m.id && changed) || undefined}
                onClick={() => onSelect(m.id)}
                // Chrome's focus() leaves a half-hidden tile where it is: bring all of it into the strip.
                onFocus={e => e.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })}
                data-testid={`menu-${m.id}`}
              >
                <span className="menu-plates" aria-hidden="true">
                  {dishes.slice(0, 3).map(d => (
                    <DishPhoto key={d.id} src={d.photo} size={34} />
                  ))}
                </span>
                <span className="menu-text">
                  <span className="menu-name">{m.label}</span>
                  <span className="menu-count num">
                    {dishCount(dishes.length)}
                    {selected === m.id && changed && <span className="menu-changed"> · changed</span>}
                  </span>
                  <span className="visually-hidden">: {dishes.map(d => d.name).join(', ')}</span>
                </span>
              </button>
              {m.custom && (
                <button
                  type="button"
                  className="menu-delete"
                  aria-label={`Delete the menu ${m.label}`}
                  onClick={() => setConfirm(m)}
                  data-testid={`menu-delete-${m.id}`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? `Delete “${confirm.label}”?` : 'Delete menu?'}
        body="The menu goes. Its recipes stay in your recipe book."
        confirmLabel="Delete menu"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) onDelete(confirm.id);
          setConfirm(null);
        }}
      />
    </>
  );
}
