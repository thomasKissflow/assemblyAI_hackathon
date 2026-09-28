import { fmtTime, upcoming, type KitchenEvent, type Plan } from './planner';
import { capitalize, joinList } from './text';

export const SERVICE_CALL = "Service. Everything's ready. Plate up.";

export function callText(e: KitchenEvent): string | null {
  if (e.type === 'step-started') return e.step.call;
  if (e.type === 'serve') return SERVICE_CALL;
  return null;
}

export function greetingText(plan: Plan, now: number): string {
  const menu = capitalize(joinList(plan.dishes.map(d => d.name.toLowerCase())));
  const first = upcoming(plan, now, 1)[0];
  const firstLine = first ? ` First up, the ${first.dish.toLowerCase()} at ${fmtTime(first.at)}.` : '';
  return `Evening. ${menu}, serving at ${fmtTime(plan.serveAt)}.${firstLine}`;
}
