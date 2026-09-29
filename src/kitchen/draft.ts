import { DISH_KINDS, kindPhoto, type DishId, type DishKind, type Recipe } from './recipes';
import { capitalize } from './text';

export interface DraftStep {
  label: string;
  minutes: number;
  call: string;
}

export interface RecipeDraft {
  name: string;
  short: string;
  kind: DishKind;
  steps: DraftStep[];
  ingredients: string[];
}

export type SuggestionPatch =
  /** `after` is the label of the step the new one follows; null puts it first. */
  | { type: 'add_step'; after: string | null; step: DraftStep }
  | { type: 'set_minutes'; step: string; minutes: number }
  | { type: 'add_ingredient'; ingredient: string };

/** A suggestion without a patch is a tip: the cook can only dismiss it. */
export interface Suggestion {
  id: string;
  text: string;
  patch?: SuggestionPatch;
}

export const MAX_STEPS = 12;
export const MAX_INGREDIENTS = 20;
export const MAX_SUGGESTIONS = 3;
const DEFAULT_MINUTES = 5;
const MAX_TOTAL_MINUTES = 6 * 60;
/** `after_label` value the scribe uses for "put this step first". */
const START = /^\s*(start|first|beginning|none)\s*$/i;

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown) => (typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : '');
const lower = (s: string) => s.trim().toLowerCase();

export function emptyDraft(): RecipeDraft {
  return { name: '', short: '', kind: 'other', steps: [], ingredients: [] };
}

export function clampMinutes(x: unknown): number {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? parseFloat(x) : NaN;
  if (Number.isNaN(n)) return DEFAULT_MINUTES;
  return Math.min(240, Math.max(1, Math.round(n)));
}

/** Lowercase, single-spaced, with no punctuation at either end: " Dal. " -> "dal". */
const cleanShort = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase();

/** The one word the cook would say for a dish: the name's last word, lowercased. */
export function defaultShort(name: string): string {
  const words = name.trim().split(/\s+/);
  return cleanShort(words[words.length - 1] ?? '');
}

export function defaultCall(short: string, label: string): string {
  const line = label.trim().replace(/[.!?]+$/, '');
  return short.trim() ? `${capitalize(short.trim())}. ${line}.` : `${line}.`;
}

function normalizeStep(raw: unknown, short: string): DraftStep | null {
  const s: Obj = typeof raw === 'string' ? { label: raw } : isObj(raw) ? raw : {};
  const label = str(s.label);
  if (!label) return null;
  return { label, minutes: clampMinutes(s.minutes), call: str(s.call) || defaultCall(short, label) };
}

function uniqueStrings(raw: unknown, max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // A list sent as one string ("ghee, cumin, salt") is split on commas, semicolons and new lines.
  const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,;\n]/) : [];
  for (const x of items) {
    const s = str(x);
    if (!s || seen.has(lower(s))) continue;
    seen.add(lower(s));
    out.push(s);
    if (out.length === max) break;
  }
  return out;
}

export function normalizeDraft(raw: unknown): RecipeDraft {
  const r = isObj(raw) ? raw : {};
  const name = str(r.name);
  const short = cleanShort(str(r.short)) || defaultShort(name);
  const kind = DISH_KINDS.find(k => k === lower(str(r.kind))) ?? 'other';
  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .map(s => normalizeStep(s, short))
    .filter((s): s is DraftStep => s !== null)
    .slice(0, MAX_STEPS);
  return { name, short, kind, steps, ingredients: uniqueStrings(r.ingredients, MAX_INGREDIENTS) };
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function toPatch(s: Obj): SuggestionPatch | undefined {
  switch (s.action) {
    case 'add_step': {
      const label = str(s.step_label);
      if (!label) return undefined;
      const after = str(s.after_label);
      return { type: 'add_step', after: START.test(after) ? null : after, step: { label, minutes: clampMinutes(s.minutes), call: str(s.call) } };
    }
    case 'set_minutes': {
      const step = str(s.step_label);
      const minutes = parseFloat(String(s.minutes));
      return step && Number.isFinite(minutes) ? { type: 'set_minutes', step, minutes: clampMinutes(minutes) } : undefined;
    }
    case 'add_ingredient': {
      const ingredient = str(s.ingredient);
      return ingredient ? { type: 'add_ingredient', ingredient } : undefined;
    }
    default:
      return undefined;
  }
}

/** Maps the scribe's flattened suggestion objects to Suggestions (at most `max`, 3 by default; no repeats). */
export function normalizeSuggestions(raw: unknown, max = MAX_SUGGESTIONS): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(raw) ? raw : []) {
    const s: Obj = typeof x === 'string' ? { text: x, action: 'tip' } : isObj(x) ? x : {};
    const text = str(s.text);
    if (!text || seen.has(lower(text))) continue;
    seen.add(lower(text));
    const patch = toPatch(s);
    out.push(patch ? { id: `sg_${hash(`${text}|${patch.type}`)}`, text, patch } : { id: `sg_${hash(text)}`, text });
    if (out.length >= max) break;
  }
  return out;
}

const MEASURE = new Set([
  'a', 'an', 'of', 'some', 'few', 'little', 'bit', 'small', 'medium', 'large', 'big', 'fresh', 'chopped', 'to', 'taste',
  'cup', 'cups', 'tsp', 'tbsp', 'teaspoon', 'teaspoons', 'tablespoon', 'tablespoons', 'g', 'gram', 'grams', 'kg', 'ml', 'l', 'litre', 'liter',
  'oz', 'lb', 'pinch', 'handful', 'bunch', 'clove', 'cloves', 'piece', 'pieces', 'inch', 'can', 'tin', 'sprig', 'sprigs', 'squeeze', 'dash',
]);

function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}i`;
  if (w.length > 4 && w.endsWith('oes')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** An ingredient's core words, without quantities, units or plurals: "2 cups chopped onions" -> ["onion"]. */
function ingredientWords(s: string): string[] {
  return lower(s).replace(/[^\p{L}\s]+/gu, ' ').split(/\s+/).filter(w => w && !MEASURE.has(w)).map(singular);
}

/** True when both name the same ingredient, e.g. "turmeric" and "1 tsp turmeric", or "onion" and "2 onions". */
export function sameIngredient(a: string, b: string): boolean {
  const [x, y] = [ingredientWords(a), ingredientWords(b)];
  if (!x.length || !y.length) return lower(a) === lower(b);
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every(w => long.includes(w));
}

/** Index of the step with this label: exact (ignoring case), then a substring match. -1 if none. */
export function findStep(steps: DraftStep[], label: string): number {
  const want = lower(label);
  if (!want) return -1;
  const exact = steps.findIndex(s => lower(s.label) === want);
  if (exact >= 0) return exact;
  const inside = steps.findIndex(s => lower(s.label).includes(want));
  return inside >= 0 ? inside : steps.findIndex(s => lower(s.label) && want.includes(lower(s.label)));
}

/** Applies a suggestion's patch. Returns the same draft when there's nothing to change. */
export function applySuggestion(d: RecipeDraft, s: Suggestion): RecipeDraft {
  const p = s.patch;
  if (!p) return d;
  switch (p.type) {
    case 'add_step': {
      const label = p.step.label.trim();
      if (!label || d.steps.length >= MAX_STEPS) return d;
      const step = { label, minutes: clampMinutes(p.step.minutes), call: p.step.call.trim() || defaultCall(d.short || defaultShort(d.name), label) };
      const at = p.after === null ? 0 : findStep(d.steps, p.after);
      const index = p.after === null ? 0 : at >= 0 ? at + 1 : d.steps.length;
      return { ...d, steps: [...d.steps.slice(0, index), step, ...d.steps.slice(index)] };
    }
    case 'set_minutes': {
      const i = findStep(d.steps, p.step);
      const minutes = clampMinutes(p.minutes);
      if (i < 0 || d.steps[i].minutes === minutes) return d;
      return { ...d, steps: d.steps.map((st, j) => (j === i ? { ...st, minutes } : st)) };
    }
    case 'add_ingredient': {
      const ingredient = p.ingredient.trim();
      if (!ingredient || d.ingredients.length >= MAX_INGREDIENTS || d.ingredients.some(x => sameIngredient(x, ingredient))) return d;
      return { ...d, ingredients: [...d.ingredients, ingredient] };
    }
  }
}

const FILLER = new Set([
  'the', 'and', 'or', 'in', 'on', 'at', 'by', 'for', 'with', 'into', 'from', 'it', 'its', 'your', 'you', 'so', 'is', 'be', 'this', 'that',
  'then', 'after', 'before', 'until', 'till', 'more', 'add', 'use', 'try', 'let', 'first', 'better', 'extra', 'minute', 'minutes', 'min',
  'cook', 'cooking', 'cooked', 'dish', 'recipe',
]);

/** Content words, cut to a 5-letter stem so "fluff" and "fluffier" meet. The dish's own words don't count. */
function ideaWords(s: string, skip: Set<string>): string[] {
  return ingredientWords(s).filter(w => !FILLER.has(w) && !skip.has(w)).map(w => w.slice(0, 5));
}

/** True when a suggestion repeats a dismissed idea in other words ("Add salt to the water" after "Add salt to season it"). */
function echoes(s: Suggestion, dismissed: string[][], skip: Set<string>): boolean {
  const p = s.patch;
  const key = p?.type === 'add_ingredient' ? ideaWords(p.ingredient, skip) : p?.type === 'add_step' ? ideaWords(p.step.label, skip) : [];
  const text = ideaWords(s.text, skip);
  return dismissed.some(d => {
    if (key.length && key.every(w => d.includes(w))) return true;
    const shared = text.filter(w => d.includes(w)).length;
    return shared > 0 && shared >= 0.5 * Math.min(text.length, d.length);
  });
}

/**
 * Drops suggestions the cook has already dismissed (or that repeat one in other words), and ones
 * whose patch would change nothing (an ingredient already listed, a step already there, the same minutes).
 */
export function freshSuggestions(d: RecipeDraft, suggestions: Suggestion[], dismissed: string[] = []): Suggestion[] {
  const gone = new Set(dismissed.map(lower));
  const skip = new Set(ingredientWords(`${d.name} ${d.short}`));
  const ideas = dismissed.map(t => ideaWords(t, skip)).filter(w => w.length > 0);
  return suggestions.filter(s => {
    if (gone.has(lower(s.text)) || echoes(s, ideas, skip)) return false;
    const p = s.patch;
    // "Tell me the steps and I'll time them" is for an empty card; once there are steps it's stale.
    if (!p && d.steps.length > 0 && /\b(tell|give|share)\b.*\bsteps?\b/i.test(s.text)) return false;
    if (!p) return true;
    if (p.type === 'add_step' && d.steps.some(st => lower(st.label) === lower(p.step.label))) return false;
    return applySuggestion(d, s) !== d;
  });
}

/** A merge's ingredients: every one on the card (as the cook wrote it), then the new ones it doesn't have. */
export function mergeIngredients(card: string[], next: string[]): string[] {
  const out = uniqueStrings(card, MAX_INGREDIENTS);
  for (const x of uniqueStrings(next, MAX_INGREDIENTS)) {
    if (out.length >= MAX_INGREDIENTS) break;
    if (!out.some(y => sameIngredient(x, y))) out.push(x);
  }
  return out;
}

export function totalMinutes(d: RecipeDraft): number {
  return d.steps.reduce((sum, s) => sum + (Number.isFinite(s.minutes) ? s.minutes : 0), 0);
}

/** Human messages that block saving. Empty when the draft can be saved. */
export function validateDraft(d: RecipeDraft): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push('Give the recipe a name.');
  if (d.steps.length === 0) errors.push('Add at least one step.');
  else if (d.steps.some(s => !s.label.trim())) errors.push('Every step needs a name.');
  if (totalMinutes(d) > MAX_TOTAL_MINUTES) errors.push('Total time is over 6 hours.');
  return errors;
}

export function draftToRecipe(d: RecipeDraft, id: DishId, opts: { basedOn?: DishId } = {}): Recipe {
  const name = d.name.trim();
  const short = cleanShort(d.short) || defaultShort(name);
  const ingredients = uniqueStrings(d.ingredients, MAX_INGREDIENTS);
  return {
    id,
    name,
    short,
    photo: kindPhoto(d.kind),
    kind: d.kind,
    steps: d.steps
      .map(s => ({ label: str(s.label), call: str(s.call), minutes: clampMinutes(s.minutes) }))
      .filter(s => s.label)
      .map((s, i) => ({ id: `s${i + 1}`, label: s.label, call: s.call || defaultCall(short, s.label), minutes: s.minutes })),
    ...(ingredients.length ? { ingredients } : {}),
    custom: true,
    ...(opts.basedOn ? { basedOn: opts.basedOn } : {}),
    updatedAt: Date.now(),
  };
}

export function recipeToDraft(r: Recipe): RecipeDraft {
  return {
    name: r.name,
    short: r.short,
    kind: r.kind,
    steps: r.steps.map(s => ({ label: s.label, minutes: s.minutes, call: s.call })),
    ingredients: [...(r.ingredients ?? [])],
  };
}
