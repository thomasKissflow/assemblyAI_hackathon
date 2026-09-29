import type { DishId, Recipe } from '../kitchen/recipes';

export interface RecipeStudioProps {
  open: boolean;
  /** Recipe to edit; a built-in here means "customise a copy". Omit for a new recipe. */
  initial?: Recipe;
  /** Set when customising a built-in: the saved copy records it. */
  basedOn?: DishId;
  /** Show "Save & add to tonight" as the primary action. */
  addToTonight?: boolean;
  onClose: () => void;
  onSave: (recipe: Recipe, opts: { addToTonight: boolean }) => void;
}

// Placeholder with the final interface; the recipe studio replaces it.
export function RecipeStudio({ open, onClose }: RecipeStudioProps) {
  if (!open) return null;
  return (
    <div role="dialog" aria-label="Recipe studio">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
