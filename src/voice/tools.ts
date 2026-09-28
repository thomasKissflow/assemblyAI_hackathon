import type { DishId } from '../kitchen/recipes';
import type { KitchenStore } from '../kitchen/store';
import { kitchenStatus } from '../kitchen/views';

export type ToolResult = { ok: true; summary: string } | { ok: false; error: string };

const DISH_TOOLS = new Set(['report_delay', 'restart_step', 'mark_done']);

function parseArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (raw ?? {}) as Record<string, unknown>;
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  if (v === undefined || v === null) return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

export function executeTool(store: KitchenStore, name: string, rawArgs: unknown): ToolResult {
  const args = parseArgs(rawArgs);
  const plan = store.getState().plan;
  if (!plan) return { ok: false, error: 'No dinner is running yet.' };
  const dish = args.dish as DishId | undefined;
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
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
