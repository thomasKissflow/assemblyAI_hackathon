import { BUILTIN_RECIPES, type Recipe } from '../kitchen/recipes';
import { MAX_DISHES } from '../kitchen/planner';
import type { KitchenStore } from '../kitchen/store';
import { kitchenStatus } from '../kitchen/views';

export { MAX_DISHES };

export type ToolResult = { ok: true; summary: string } | { ok: false; error: string };

const DISH_TOOLS = new Set(['report_delay', 'restart_step', 'mark_done', 'remove_dish']);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseArgs(raw: unknown): Record<string, unknown> {
  let args = raw;
  if (typeof raw === 'string') {
    try {
      args = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return isRecord(args) ? args : {};
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  if (v === undefined || v === null) return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

/** A recipe in the book by id, or failing that by its name, or by what the cook calls it when only one dish goes by that. */
function lookUp(library: Recipe[], dish: string | undefined): Recipe | undefined {
  if (!dish) return undefined;
  const key = dish.toLowerCase();
  const byShort = library.filter(r => r.short.toLowerCase() === key);
  return library.find(r => r.id === dish)
    ?? library.find(r => r.id.toLowerCase() === key || r.name.toLowerCase() === key)
    ?? (byShort.length === 1 ? byShort[0] : undefined);
}

export function executeTool(store: KitchenStore, name: string, rawArgs: unknown, library: Recipe[] = BUILTIN_RECIPES): ToolResult {
  const args = parseArgs(rawArgs);
  const plan = store.getState().plan;
  if (!plan) return { ok: false, error: 'No dinner is running yet.' };
  const dish = typeof args.dish === 'string' ? args.dish.trim() || undefined : undefined;
  if (DISH_TOOLS.has(name) && (!dish || !plan.dishes.some(d => d.id === dish))) {
    return { ok: false, error: `That dish isn't on tonight's menu. Tonight: ${plan.dishes.map(d => d.name).join(', ')}.` };
  }
  switch (name) {
    case 'report_delay':
      return { ok: true, summary: store.reportDelay(dish!, clampInt(args.minutes, 1, 60, 5)) };
    case 'shift_serve_time':
      return { ok: true, summary: store.shiftServe(clampInt(args.minutes, -60, 120, 10)) };
    case 'restart_step':
      return { ok: true, summary: store.restartStep(dish!) };
    case 'mark_done':
      return { ok: true, summary: store.markDone(dish!) };
    case 'kitchen_status':
      return { ok: true, summary: kitchenStatus(plan, store.kitchenNow()) };
    case 'add_dish': {
      const recipe = lookUp(library, dish);
      if (!recipe) return { ok: false, error: "That dish is not in your recipe book. You can add it from the start screen." };
      if (plan.dishes.some(d => d.id === recipe.id)) return { ok: false, error: `${recipe.name} is already on tonight's menu.` };
      if (plan.dishes.length >= MAX_DISHES) return { ok: false, error: `The pass is full: ${MAX_DISHES} dishes is the most Chef can run. Drop one first.` };
      return { ok: true, summary: store.addDish(recipe) };
    }
    case 'remove_dish':
      if (plan.dishes.length <= 1) return { ok: false, error: `You can't drop the last dish. ${plan.dishes[0].name} is all that's left.` };
      return { ok: true, summary: store.removeDish(dish!) };
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
