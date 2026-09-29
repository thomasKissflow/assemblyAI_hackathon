import { useSyncExternalStore } from 'react';
import { BUILTIN_MENUS, BUILTIN_RECIPES, DISH_KINDS, kindPhoto, type DishId, type DishKind, type Menu, type Recipe, type RecipeStep } from './recipes';

/** The cook's recipe book: built-ins first, then their own. */
export interface Library {
  recipes: Recipe[];
  menus: Menu[];
}

export const LIBRARY_KEY = 'heard-chef.library.v1';
/** Same bound as the recipe studio's drafts. */
const MAX_STEP_MINUTES = 240;

interface Saved {
  version: 1;
  recipes: Recipe[];
  menus: Menu[];
}

const BUILTIN_RECIPE_IDS = new Set(BUILTIN_RECIPES.map(r => r.id));
const BUILTIN_MENU_IDS = new Set(BUILTIN_MENUS.map(m => m.id));

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function slug(s: string): string {
  const out = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 24).replace(/_+$/, '');
  return out || 'untitled';
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

/** `my_<slug>`, with `_2`, `_3`… when the id is taken. */
export function newRecipeId(name: string, lib: Library): DishId {
  return uniqueId(`my_${slug(name)}`, new Set(lib.recipes.map(r => r.id)));
}

/** `menu_<slug>`, with `_2`, `_3`… when the id is taken. */
export function newMenuId(label: string, lib: Library): string {
  return uniqueId(`menu_${slug(label)}`, new Set(lib.menus.map(m => m.id)));
}

function readStep(raw: unknown): RecipeStep | null {
  if (!isRecord(raw)) return null;
  const label = text(raw.label);
  const minutes = Math.round(Number(raw.minutes));
  if (!label || !Number.isFinite(minutes) || minutes < 1) return null;
  return { id: text(raw.id), label, call: text(raw.call) || `${label}.`, minutes: Math.min(minutes, MAX_STEP_MINUTES) };
}

/** The steps that can be cooked, each with an id unique in the recipe (the planner matches steps by id). */
function readSteps(raw: unknown): RecipeStep[] {
  const steps: RecipeStep[] = [];
  const taken = new Set<string>();
  for (const st of (Array.isArray(raw) ? raw : []).map(readStep)) {
    if (!st) continue;
    const id = uniqueId(st.id || `s${steps.length + 1}`, taken);
    taken.add(id);
    steps.push({ ...st, id });
  }
  return steps;
}

/** A saved recipe as the cook's own: custom, with its kind's plate art. Null when it can't be cooked. */
function readRecipe(raw: unknown): Recipe | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id);
  const name = text(raw.name);
  const steps = readSteps(raw.steps);
  if (!id || !name || steps.length === 0) return null;
  const kind: DishKind = DISH_KINDS.includes(raw.kind as DishKind) ? (raw.kind as DishKind) : 'other';
  const ingredients = Array.isArray(raw.ingredients) ? raw.ingredients.map(text).filter(Boolean) : [];
  const basedOn = text(raw.basedOn);
  const updatedAt = Number(raw.updatedAt);
  return {
    id, name, short: text(raw.short) || name.split(/\s+/).at(-1)!.toLowerCase(), photo: kindPhoto(kind), kind, steps,
    ...(ingredients.length ? { ingredients } : {}),
    custom: true,
    ...(basedOn ? { basedOn } : {}),
    ...(Number.isFinite(updatedAt) && updatedAt > 0 ? { updatedAt } : {}),
  };
}

function readMenu(raw: unknown, known: Set<string>): Menu | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id);
  const label = text(raw.label);
  const dishes = Array.isArray(raw.dishes) ? [...new Set(raw.dishes.map(text).filter(d => known.has(d)))] : [];
  if (!id || !label || dishes.length === 0) return null;
  return { id, label, dishes, custom: true };
}

/** Only the cook's own entries, cleaned. Anything unreadable is dropped. */
function parse(json: string | null): { recipes: Recipe[]; menus: Menu[] } {
  const empty = { recipes: [], menus: [] };
  if (!json) return empty;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return empty;
  }
  if (!isRecord(data) || data.version !== 1) return empty;
  const recipes: Recipe[] = [];
  const ids = new Set(BUILTIN_RECIPE_IDS);
  for (const raw of Array.isArray(data.recipes) ? data.recipes : []) {
    const r = readRecipe(raw);
    if (r && !ids.has(r.id)) {
      ids.add(r.id);
      recipes.push(r);
    }
  }
  const menus: Menu[] = [];
  const menuIds = new Set(BUILTIN_MENU_IDS);
  for (const raw of Array.isArray(data.menus) ? data.menus : []) {
    const m = readMenu(raw, ids);
    if (m && !menuIds.has(m.id)) {
      menuIds.add(m.id);
      menus.push(m);
    }
  }
  return { recipes, menus };
}

/** window.localStorage, or null where it's missing or blocked. */
export function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * The recipe book. Keeps the cook's recipes and menus in `storage` (localStorage in the app) so they're there next
 * time; without storage it works in memory only. Built-ins can't be changed or deleted.
 */
export function createLibraryStore(storage: Storage | null = null) {
  let saved = { recipes: [] as Recipe[], menus: [] as Menu[] };
  try {
    saved = parse(storage?.getItem(LIBRARY_KEY) ?? null);
  } catch {
    // Unreadable storage: start empty.
  }
  const build = (): Library => ({ recipes: [...BUILTIN_RECIPES, ...saved.recipes], menus: [...BUILTIN_MENUS, ...saved.menus] });
  let state = build();
  const subs = new Set<() => void>();

  function commit(next: { recipes: Recipe[]; menus: Menu[] }) {
    saved = next;
    state = build();
    try {
      const data: Saved = { version: 1, recipes: saved.recipes, menus: saved.menus };
      storage?.setItem(LIBRARY_KEY, JSON.stringify(data));
    } catch {
      // Full or blocked storage: keep the change for this session.
    }
    subs.forEach(fn => fn());
  }

  return {
    getState: () => state,
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
    /**
     * Saves one of the cook's recipes (new, or replacing theirs with the same id) and returns what was stored.
     * An id that's missing or belongs to a built-in gets a fresh `my_` id instead. Throws without a name or a step.
     */
    saveRecipe(r: Recipe): Recipe {
      const given = text(r.id);
      const id = given && !BUILTIN_RECIPE_IDS.has(given) ? given : newRecipeId(text(r.name), state);
      const recipe = readRecipe({ ...r, id, updatedAt: Date.now() });
      if (!recipe) throw new Error('A recipe needs a name and at least one step.');
      const exists = saved.recipes.some(x => x.id === id);
      commit({
        recipes: exists ? saved.recipes.map(x => (x.id === id ? recipe : x)) : [...saved.recipes, recipe],
        menus: saved.menus,
      });
      return recipe;
    },
    /** Deletes one of the cook's recipes, removes it from their menus, and deletes any menu left empty. */
    deleteRecipe(id: DishId) {
      if (!saved.recipes.some(r => r.id === id)) return;
      commit({
        recipes: saved.recipes.filter(r => r.id !== id),
        menus: saved.menus.map(m => ({ ...m, dishes: m.dishes.filter(d => d !== id) })).filter(m => m.dishes.length > 0),
      });
    },
    /**
     * Saves one of the cook's menus and returns what was stored, keeping only dishes in the book.
     * An id that's missing or belongs to a built-in gets a fresh `menu_` id. Null without a label or a known dish.
     */
    saveMenu(m: Menu): Menu | null {
      const given = text(m.id);
      const id = given && !BUILTIN_MENU_IDS.has(given) ? given : newMenuId(text(m.label), state);
      const menu = readMenu({ ...m, id }, new Set(state.recipes.map(r => r.id)));
      if (!menu) return null;
      const exists = saved.menus.some(x => x.id === id);
      commit({ recipes: saved.recipes, menus: exists ? saved.menus.map(x => (x.id === id ? menu : x)) : [...saved.menus, menu] });
      return menu;
    },
    deleteMenu(id: string) {
      if (!saved.menus.some(m => m.id === id)) return;
      commit({ recipes: saved.recipes, menus: saved.menus.filter(m => m.id !== id) });
    },
    /** Forgets every recipe and menu the cook saved. */
    clear() {
      commit({ recipes: [], menus: [] });
    },
  };
}

export type LibraryStore = ReturnType<typeof createLibraryStore>;

export const libraryStore = createLibraryStore(browserStorage());

export function useLibrary(store: LibraryStore = libraryStore): Library {
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** A recipe in the book by id. */
export const findRecipe = (lib: Library, id: DishId): Recipe | undefined => lib.recipes.find(r => r.id === id);

/** A menu's recipes in order, skipping any that are gone. */
export function menuDishes(lib: Library, menu: Menu): Recipe[] {
  return menu.dishes.map(id => findRecipe(lib, id)).filter((r): r is Recipe => r !== undefined);
}
