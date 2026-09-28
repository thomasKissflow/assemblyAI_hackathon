# Heard, Chef Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-backend browser app where a voice "head chef" runs the timing of a multi-dish dinner: it calls every step out loud and re-plans all dishes when the cook reports a problem.

**Architecture:** A static Vite + React + TypeScript app. The kitchen logic (recipes, planner, clock, store) is pure TypeScript with unit tests. The voice layer connects the browser mic and speakers straight to the AssemblyAI Voice Agent API WebSocket, using the raw API key as `?token=` (verified to work). The agent changes the plan through client-side tool calls. Chef's proactive calls go through a queue that never talks over the cook. The UI is designed with the Impeccable skill.

**Tech Stack:** Vite, React 19, TypeScript (strict), Vitest, lucide-react (icons), motion (layout animation), Archivo from Google Fonts, AssemblyAI Voice Agent API.

**Spec:** [docs/superpowers/specs/2026-09-28-heard-chef-design.md](../specs/2026-09-28-heard-chef-design.md). Read it first; it holds the design brief, palette and copy.

## Global Constraints

- **No backend.** No server code, no serverless functions, no proxy. Browser → `wss://agents.assemblyai.com/v1/ws?token=<API_KEY>` only.
- **The API key lives only in `.env.local`** as `VITE_ASSEMBLYAI_API_KEY` (gitignored). Never write the key into any committed file, including docs, tests, plans, READMEs and commit messages. The live test reads it from `AAI_KEY`.
- The audio format is `audio/pcm`, 16-bit little-endian, mono, **24 000 Hz**, both in and out. Send 50 ms chunks (1200 samples).
- **No TypeScript parameter properties** (`constructor(private x)`). The tsconfig uses `erasableSyntaxOnly`-safe syntax only.
- Colors in **OKLCH only**, and only via the tokens in `src/styles/tokens.css` (values are in the spec §8).
- Icons: **lucide-react only**. Font: **Archivo** only.
- Every time Chef speaks or the UI shows comes from the planner, never from the model.
- Commit after every task, with messages ending in the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The repo is MIT-licensed, and every third-party asset must be license-compatible and credited in the README.

## File Structure

```
package.json · tsconfig.json · vite.config.ts · index.html · .env.example · LICENSE
public/pcm-capture-worklet.js       AudioWorklet: copies mic frames to the main thread
public/dishes/*.jpg                 six dish photos (Unsplash, credited)
public/favicon.svg
src/main.tsx · src/App.tsx          entry and wiring (store ticker, session, screen switch)
src/vite-env.d.ts                   env typing
src/styles/tokens.css               palette, type scale, spacing, motion tokens
src/styles/app.css                  global styles
src/kitchen/recipes.ts              DishId, Recipe, RECIPES, MENUS
src/kitchen/planner.ts (+ .test)    planning maths (pure)
src/kitchen/clock.ts (+ .test)      virtual kitchen clock (pure)
src/kitchen/views.ts (+ .test)      ticket state derivation for the UI (pure)
src/kitchen/calls.ts                KitchenEvent → spoken call text
src/kitchen/store.ts (+ .test)      external store: plan, clock, log, events
src/voice/pcm.ts (+ .test)          PCM16 ⇄ base64, chunking (pure)
src/voice/calloutQueue.ts (+ .test) safe proactive speech (pure)
src/voice/agentConfig.ts (+ .test)  system prompt, greeting, tools, keyterms
src/voice/tools.ts (+ .test)        tool executor against the store
src/voice/agentSocket.ts            Voice Agent WebSocket client
src/voice/audio.ts                  AudioEngine: mic capture + playback
src/voice/useChefSession.ts         React hook wiring everything
src/voice/agent.e2e.test.ts         live API test (opt-in, macOS `say`)
src/ui/…                            components (Task 5)
docs/demo-script.md                 video shot list and lines
```

---

### Task 1: Project skeleton, recipes and planner

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.env.example`, `.env.local` (not committed), `LICENSE`, `src/vite-env.d.ts`, `src/main.tsx`, `src/App.tsx`
- Create: `src/kitchen/recipes.ts`, `src/kitchen/planner.ts`
- Test: `src/kitchen/planner.test.ts`

**Interfaces:**
- Produces: `DishId`, `MenuId`, `RECIPES`, `MENUS`, `MIN`, `Plan`, `PlannedDish`, `PlannedStep`, `KitchenEvent`, `createPlan`, `align`, `advance`, `reportDelay`, `shiftServe`, `restartStep`, `markDone`, `upcoming`, `UpcomingCall`, `describeChange`, `fmtTime`

- [ ] **Step 1: Scaffold the project by hand, not with `npm create`, because the repo root isn't empty**

`package.json`:
```json
{
  "name": "heard-chef",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "vitest run agent.e2e"
  }
}
```

Run:
```bash
npm install react react-dom lucide-react motion
npm install -D vite @vitejs/plugin-react typescript vitest @types/react @types/react-dom @types/node
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node' },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet" />
    <title>Heard, Chef</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_ASSEMBLYAI_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (a placeholder until Task 5):
```tsx
export default function App() {
  return <h1>Heard, Chef</h1>;
}
```

`.env.example`:
```
VITE_ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

`.env.local` (**gitignored, never committed**): the same line with the real key Thomas gave in chat. Confirm it's ignored with `git check-ignore .env.local`, which must print the path.

`LICENSE`: standard MIT text, `Copyright (c) 2026 Heard, Chef contributors`.

- [ ] **Step 2: Write `src/kitchen/recipes.ts`**

```ts
export type DishId = 'chicken_curry' | 'jeera_rice' | 'garlic_naan' | 'roast_potatoes' | 'salmon' | 'green_beans';
export type MenuId = 'indian' | 'western';

export interface RecipeStep {
  id: string;
  label: string;
  call: string;
  minutes: number;
}

export interface Recipe {
  id: DishId;
  name: string;
  short: string;
  photo: string;
  steps: RecipeStep[];
}

const step = (id: string, label: string, call: string, minutes: number): RecipeStep => ({ id, label, call, minutes });

export const RECIPES: Record<DishId, Recipe> = {
  chicken_curry: {
    id: 'chicken_curry', name: 'Chicken curry', short: 'curry', photo: '/dishes/chicken_curry.jpg',
    steps: [
      step('base', 'Fry onions, ginger & garlic', 'Curry on. Onions, ginger and garlic in the pan.', 8),
      step('chicken', 'Add chicken & spices', 'Chicken and spices into the curry.', 7),
      step('simmer', 'Simmer with tomatoes', 'Tomatoes in. Curry down to a low simmer.', 20),
    ],
  },
  jeera_rice: {
    id: 'jeera_rice', name: 'Jeera rice', short: 'rice', photo: '/dishes/jeera_rice.jpg',
    steps: [
      step('soak', 'Rinse & soak rice', 'Rice. Rinse it and leave it to soak.', 10),
      step('temper', 'Cumin in ghee, add rice & water', 'Cumin into hot ghee, then rice and water.', 3),
      step('steam', 'Boil, then steam on low', 'Rice to the boil, then lid on, lowest heat.', 15),
      step('rest', 'Rest, lid on', 'Rice off the heat. Keep the lid on.', 5),
    ],
  },
  garlic_naan: {
    id: 'garlic_naan', name: 'Garlic naan', short: 'naan', photo: '/dishes/garlic_naan.jpg',
    steps: [
      step('dough', 'Mix & knead dough', 'Naan. Mix and knead the dough.', 6),
      step('rest', 'Rest dough', 'Cover the naan dough. Let it rest.', 20),
      step('cook', 'Roll & cook naan', 'Roll the naan. Hot pan, one at a time.', 10),
      step('butter', 'Brush with garlic butter', 'Garlic butter on the naan.', 2),
    ],
  },
  roast_potatoes: {
    id: 'roast_potatoes', name: 'Roast potatoes', short: 'potatoes', photo: '/dishes/roast_potatoes.jpg',
    steps: [
      step('prep', 'Peel & chop potatoes', 'Potatoes. Peel and chop them.', 6),
      step('parboil', 'Parboil potatoes', 'Potatoes into boiling water.', 8),
      step('roast', 'Roast in the oven', 'Potatoes into the oven.', 30),
    ],
  },
  salmon: {
    id: 'salmon', name: 'Salmon', short: 'salmon', photo: '/dishes/salmon.jpg',
    steps: [
      step('season', 'Season the salmon', 'Salmon. Season it.', 4),
      step('bake', 'Bake the salmon', 'Salmon into the oven.', 14),
      step('rest', 'Rest the salmon', 'Salmon out. Let it rest.', 3),
    ],
  },
  green_beans: {
    id: 'green_beans', name: 'Green beans', short: 'beans', photo: '/dishes/green_beans.jpg',
    steps: [
      step('trim', 'Trim the beans', 'Beans. Trim them.', 5),
      step('blanch', 'Blanch the beans', 'Beans into boiling water.', 4),
      step('toss', 'Toss in butter & lemon', 'Beans out. Butter and lemon.', 2),
    ],
  },
};

export const MENUS: Record<MenuId, { label: string; dishes: DishId[] }> = {
  indian: { label: 'Indian dinner', dishes: ['chicken_curry', 'jeera_rice', 'garlic_naan'] },
  western: { label: 'Western dinner', dishes: ['salmon', 'roast_potatoes', 'green_beans'] },
};
```

- [ ] **Step 3: Write the failing test `src/kitchen/planner.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { MENUS } from './recipes';
import { MIN, createPlan, advance, reportDelay, shiftServe, restartStep, markDone, upcoming, describeChange, fmtTime } from './planner';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const SERVE = T0 + 45 * MIN;
const dish = (p: ReturnType<typeof createPlan>, id: string) => p.dishes.find(d => d.id === id)!;

describe('planner', () => {
  it('ends every dish exactly at serve time', () => {
    const p = createPlan(MENUS.indian.dishes, SERVE, T0);
    expect(p.serveAt).toBe(SERVE);
    for (const d of p.dishes) expect(d.steps.at(-1)!.end).toBe(SERVE);
    expect(dish(p, 'garlic_naan').steps[0].start).toBe(SERVE - 38 * MIN);
  });

  it('pushes serve time when there is not enough time', () => {
    const p = createPlan(MENUS.indian.dishes, T0 + 20 * MIN, T0);
    expect(p.serveAt).toBe(T0 + 38 * MIN);
    expect(dish(p, 'garlic_naan').steps[0].start).toBe(T0);
  });

  it('advance starts steps and emits each event once', () => {
    const p = createPlan(MENUS.indian.dishes, SERVE, T0);
    const r1 = advance(p, T0 + 7 * MIN);
    expect(r1.events.map(e => e.type)).toEqual(['step-started']);
    const r2 = advance(r1.plan, T0 + 7 * MIN + 1000);
    expect(r2.events).toHaveLength(0);
    expect(r2.plan).toBe(r1.plan);
  });

  it('reportDelay on the bottleneck pushes serve and slides other dishes', () => {
    const curryStart = SERVE - 35 * MIN;
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), curryStart).plan;
    const riceBefore = dish(p, 'jeera_rice').steps[0].start;
    const after = reportDelay(p, 'chicken_curry', 10, curryStart + MIN);
    expect(after.serveAt).toBe(SERVE + 10 * MIN);
    expect(dish(after, 'jeera_rice').steps[0].start).toBe(riceBefore + 10 * MIN);
    expect(dish(after, 'chicken_curry').steps.at(-1)!.end).toBe(after.serveAt);
    expect(describeChange(p, after)).toMatch(/^Serving now 8:10 PM \(was 8:00 PM\)\. /);
  });

  it('shiftServe later slides pending steps; earlier is clamped to what is possible', () => {
    const p = createPlan(MENUS.indian.dishes, SERVE, T0);
    expect(shiftServe(p, 20, T0).serveAt).toBe(SERVE + 20 * MIN);
    expect(shiftServe(p, -30, T0).serveAt).toBe(T0 + 38 * MIN);
  });

  it('restartStep restarts the active step for its full duration', () => {
    const curryStart = SERVE - 35 * MIN;
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), curryStart + 5 * MIN).plan;
    const r = restartStep(p, 'chicken_curry', curryStart + 5 * MIN);
    const base = dish(r, 'chicken_curry').steps[0];
    expect(base.status).toBe('active');
    expect(base.end).toBe(curryStart + 13 * MIN);
    expect(r.serveAt).toBe(SERVE + 5 * MIN);
  });

  it('markDone ends the active step now without moving serve', () => {
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), T0 + 7 * MIN).plan;
    const r = markDone(p, 'garlic_naan', T0 + 10 * MIN);
    expect(dish(r, 'garlic_naan').steps[0].status).toBe('done');
    expect(r.serveAt).toBe(SERVE);
  });

  it('fires the serve event exactly once when everything is done', () => {
    let p = createPlan(MENUS.indian.dishes, SERVE, T0);
    const types: string[] = [];
    for (let t = T0; t <= SERVE + MIN; t += 30_000) {
      const r = advance(p, t);
      p = r.plan;
      types.push(...r.events.map(e => e.type));
    }
    expect(types.filter(t => t === 'serve')).toHaveLength(1);
    expect(types.filter(t => t === 'step-started')).toHaveLength(11);
  });

  it('lists upcoming calls in time order', () => {
    const u = upcoming(createPlan(MENUS.indian.dishes, SERVE, T0), T0, 3);
    expect(u.map(c => c.dishId)).toEqual(['garlic_naan', 'chicken_curry', 'jeera_rice']);
    expect(fmtTime(u[0].at)).toBe('7:22 PM');
  });

  it('says so when nothing changed', () => {
    const p = createPlan(MENUS.indian.dishes, SERVE, T0);
    expect(describeChange(p, p)).toBe('No change to the plan.');
  });
});
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `npx vitest run src/kitchen/planner.test.ts`
Expected: FAIL, because `./planner` can't be resolved.

- [ ] **Step 5: Implement `src/kitchen/planner.ts`.** This code has already been verified against the same cases in a scratch run.

```ts
import { RECIPES, type DishId, type RecipeStep } from './recipes';

export const MIN = 60_000;

export type StepStatus = 'pending' | 'active' | 'done';
export interface PlannedStep extends RecipeStep {
  start: number;
  end: number;
  status: StepStatus;
}
export interface PlannedDish {
  id: DishId;
  name: string;
  short: string;
  photo: string;
  steps: PlannedStep[];
}
export interface Plan {
  serveAt: number;
  served: boolean;
  dishes: PlannedDish[];
}
export type KitchenEvent =
  | { type: 'step-started'; dishId: DishId; step: PlannedStep }
  | { type: 'step-done'; dishId: DishId; step: PlannedStep }
  | { type: 'serve' };

const ceilToMinute = (t: number) => Math.ceil(t / MIN) * MIN;

export function earliestFinish(d: PlannedDish, now: number): number {
  let t = now;
  for (const st of d.steps) {
    if (st.status === 'done') continue;
    if (st.status === 'active') {
      t = Math.max(t, st.end);
      continue;
    }
    t += st.minutes * MIN;
  }
  return t;
}

export function align(plan: Plan, now: number): Plan {
  const serveAt = ceilToMinute(Math.max(plan.serveAt, ...plan.dishes.map(d => earliestFinish(d, now))));
  const dishes = plan.dishes.map(d => {
    const steps = [...d.steps];
    let t = serveAt;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status !== 'pending') break;
      steps[i] = { ...steps[i], end: t, start: t - steps[i].minutes * MIN };
      t = steps[i].start;
    }
    return { ...d, steps };
  });
  return { ...plan, serveAt, dishes };
}

export function createPlan(ids: DishId[], serveAt: number, now: number): Plan {
  const dishes: PlannedDish[] = ids.map(id => {
    const r = RECIPES[id];
    return {
      id, name: r.name, short: r.short, photo: r.photo,
      steps: r.steps.map(st => ({ ...st, start: 0, end: 0, status: 'pending' as const })),
    };
  });
  return align({ serveAt, served: false, dishes }, now);
}

export function advance(plan: Plan, now: number): { plan: Plan; events: KitchenEvent[] } {
  const events: KitchenEvent[] = [];
  const dishes = plan.dishes.map(d => {
    const steps = d.steps.map(st => ({ ...st }));
    for (const st of steps) {
      if (st.status === 'pending' && st.start <= now) {
        st.status = 'active';
        events.push({ type: 'step-started', dishId: d.id, step: st });
      }
      if (st.status === 'active' && st.end <= now) {
        st.status = 'done';
        events.push({ type: 'step-done', dishId: d.id, step: st });
      }
    }
    return { ...d, steps };
  });
  let served = plan.served;
  if (!served && now >= plan.serveAt && dishes.every(d => d.steps.every(st => st.status === 'done'))) {
    served = true;
    events.push({ type: 'serve' });
  }
  if (events.length === 0) return { plan, events };
  return { plan: { ...plan, served, dishes }, events };
}

function mapDish(plan: Plan, id: DishId, fn: (d: PlannedDish) => PlannedDish): Plan {
  return { ...plan, dishes: plan.dishes.map(d => (d.id === id ? fn(d) : d)) };
}

export function reportDelay(plan: Plan, id: DishId, minutes: number, now: number): Plan {
  const add = minutes * MIN;
  return align(mapDish(plan, id, d => {
    const a = d.steps.findIndex(st => st.status === 'active');
    if (a >= 0) return { ...d, steps: d.steps.map((st, i) => (i === a ? { ...st, end: Math.max(st.end, now) + add } : st)) };
    const p = d.steps.findIndex(st => st.status === 'pending');
    if (p >= 0) return { ...d, steps: d.steps.map((st, i) => (i === p ? { ...st, minutes: st.minutes + minutes } : st)) };
    return d;
  }), now);
}

export function restartStep(plan: Plan, id: DishId, now: number): Plan {
  return align(mapDish(plan, id, d => {
    let i = d.steps.findIndex(st => st.status === 'active');
    if (i < 0) {
      for (let j = d.steps.length - 1; j >= 0; j--) {
        if (d.steps[j].status === 'done') {
          i = j;
          break;
        }
      }
    }
    if (i < 0) return d;
    return {
      ...d,
      steps: d.steps.map((st, k) => (k === i ? { ...st, status: 'active' as const, start: now, end: now + st.minutes * MIN } : st)),
    };
  }), now);
}

export function markDone(plan: Plan, id: DishId, now: number): Plan {
  return align(mapDish(plan, id, d => ({
    ...d,
    steps: d.steps.map(st => (st.status === 'active' ? { ...st, status: 'done' as const, end: now } : st)),
  })), now);
}

export function shiftServe(plan: Plan, minutes: number, now: number): Plan {
  return align({ ...plan, serveAt: plan.serveAt + minutes * MIN }, now);
}

export interface UpcomingCall {
  dishId: DishId;
  dish: string;
  label: string;
  call: string;
  at: number;
}

export function upcoming(plan: Plan, now: number, limit = 3): UpcomingCall[] {
  return plan.dishes
    .flatMap(d => d.steps
      .filter(st => st.status === 'pending' && st.start >= now)
      .map(st => ({ dishId: d.id, dish: d.name, label: st.label, call: st.call, at: st.start })))
    .sort((a, b) => a.at - b.at)
    .slice(0, limit);
}

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function describeChange(before: Plan, after: Plan): string {
  const parts: string[] = [];
  if (after.serveAt !== before.serveAt) parts.push(`Serving now ${fmtTime(after.serveAt)} (was ${fmtTime(before.serveAt)}).`);
  for (const d of after.dishes) {
    const prev = before.dishes.find(x => x.id === d.id);
    const next = d.steps.find(st => st.status === 'pending');
    const prevNext = prev?.steps.find(st => st.id === next?.id);
    if (next && prevNext && next.start !== prevNext.start) parts.push(`${d.name}: ${next.label.toLowerCase()} at ${fmtTime(next.start)}.`);
  }
  return parts.length ? parts.join(' ') : 'No change to the plan.';
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx vitest run src/kitchen/planner.test.ts`
Expected: 10 passed.

- [ ] **Step 7: Check that the skeleton runs**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors and a successful build.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .env.example LICENSE src
git status --short   # .env.local must NOT appear
git commit -m "feat: project skeleton, recipes and dinner planner"
```

---

### Task 2: Kitchen clock, ticket views and store

**Files:**
- Create: `src/kitchen/clock.ts`, `src/kitchen/views.ts`, `src/kitchen/calls.ts`, `src/kitchen/store.ts`
- Test: `src/kitchen/clock.test.ts`, `src/kitchen/views.test.ts`, `src/kitchen/store.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces:
  - `ClockState`, `createClock(kitchenStart, realNow, speed)`, `kitchenNow(c, realNow)`, `withSpeed(c, speed, realNow)`, `withPaused(c, paused, realNow)`, `jumpTo(c, kitchenTime, realNow)`
  - `ticketView(dish, now): TicketView`, `TicketState`, `FIRE_WINDOW_MS`
  - `callText(event): string | null`, `SERVICE_CALL`
  - `createKitchenStore(realNow?)` returning `KitchenStore` with: `getState`, `subscribe`, `onKitchenEvents`, `start(menu, serveInMinutes)`, `tick()`, `reportDelay(dish, minutes): string`, `shiftServe(minutes): string`, `restartStep(dish): string`, `markDone(dish): string`, `upcoming(limit?)`, `log(kind, text)`, `setSpeed(speed)`, `togglePause()`, `skipToNextCall()`, `reset()`
  - `KitchenState`, `LogEntry`, `LogKind`, `DEFAULT_SPEED`, `SPEEDS`, `demoStart()`, `useKitchen(store)`

- [ ] **Step 1: Write the failing tests**

`src/kitchen/clock.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createClock, kitchenNow, withSpeed, withPaused, jumpTo } from './clock';

describe('kitchen clock', () => {
  it('runs at its speed', () => {
    expect(kitchenNow(createClock(1000, 0, 30), 100)).toBe(1000 + 3000);
  });
  it('pausing freezes time and resuming continues from there', () => {
    const paused = withPaused(createClock(0, 0, 30), true, 100);
    expect(kitchenNow(paused, 5000)).toBe(3000);
    const resumed = withPaused(paused, false, 5000);
    expect(kitchenNow(resumed, 5100)).toBe(6000);
  });
  it('changing speed keeps time continuous', () => {
    const c = withSpeed(createClock(0, 0, 30), 1, 100);
    expect(kitchenNow(c, 100)).toBe(3000);
    expect(kitchenNow(c, 200)).toBe(3100);
  });
  it('jumpTo sets kitchen time', () => {
    expect(kitchenNow(jumpTo(createClock(0, 0, 30), 50_000, 10), 10)).toBe(50_000);
  });
});
```

`src/kitchen/views.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MENUS } from './recipes';
import { MIN, advance, createPlan, markDone } from './planner';
import { ticketView, FIRE_WINDOW_MS } from './views';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const SERVE = T0 + 45 * MIN;
const naan = (p: ReturnType<typeof createPlan>) => p.dishes.find(d => d.id === 'garlic_naan')!;

describe('ticketView', () => {
  it('is waiting before the first step, counting down to it', () => {
    const v = ticketView(naan(createPlan(MENUS.indian.dishes, SERVE, T0)), T0);
    expect(v.state).toBe('waiting');
    expect(v.remainingMs).toBe(7 * MIN);
    expect(v.stepIndex).toBe(0);
  });
  it('is fire right after a step starts, then cooking', () => {
    const p = advance(createPlan(MENUS.indian.dishes, SERVE, T0), T0 + 7 * MIN).plan;
    expect(ticketView(naan(p), T0 + 7 * MIN).state).toBe('fire');
    const later = ticketView(naan(p), T0 + 7 * MIN + FIRE_WINDOW_MS + 1);
    expect(later.state).toBe('cooking');
    expect(later.progress).toBeGreaterThan(0);
  });
  it('is holding between steps when a step finished early', () => {
    const p = markDone(advance(createPlan(MENUS.indian.dishes, SERVE, T0), T0 + 7 * MIN).plan, 'garlic_naan', T0 + 9 * MIN);
    const v = ticketView(naan(p), T0 + 9 * MIN);
    expect(v.state).toBe('holding');
    expect(v.next?.id).toBe('rest');
  });
  it('is ready when every step is done', () => {
    let p = createPlan(MENUS.indian.dishes, SERVE, T0);
    p = advance(p, SERVE).plan;
    expect(ticketView(naan(p), SERVE).state).toBe('ready');
  });
});
```

`src/kitchen/store.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createKitchenStore, DEFAULT_SPEED } from './store';
import { MIN } from './planner';

function setup() {
  let real = 0;
  const store = createKitchenStore(() => real);
  return { store, passReal: (ms: number) => { real += ms; } };
}
const kitchenMinutes = (m: number) => (m * MIN) / DEFAULT_SPEED;

describe('kitchen store', () => {
  it('starts a dinner with a plan and a running demo-speed clock', () => {
    const { store } = setup();
    store.start('indian', 45);
    const s = store.getState();
    expect(s.phase).toBe('cooking');
    expect(s.plan!.serveAt - s.now).toBe(45 * MIN);
    expect(s.clock.speed).toBe(DEFAULT_SPEED);
  });

  it('tick advances kitchen time and emits step events', () => {
    const { store, passReal } = setup();
    const seen: string[] = [];
    store.onKitchenEvents(evs => seen.push(...evs.map(e => e.type)));
    store.start('indian', 45);
    passReal(kitchenMinutes(7));
    store.tick();
    expect(seen).toEqual(['step-started']);
  });

  it('reportDelay returns the spoken summary and logs the change', () => {
    const { store, passReal } = setup();
    store.start('indian', 45);
    passReal(kitchenMinutes(10));
    store.tick();
    const summary = store.reportDelay('chicken_curry', 10);
    expect(summary).toMatch(/^Serving now 8:10 PM \(was 8:00 PM\)\./);
    expect(store.getState().log.at(-1)).toMatchObject({ kind: 'change', text: summary });
    expect(store.getState().lastServeShift?.minutes).toBe(10);
  });

  it('skipToNextCall jumps to the next call and fires it', () => {
    const { store } = setup();
    const seen: string[] = [];
    store.onKitchenEvents(evs => seen.push(...evs.map(e => e.type)));
    store.start('indian', 45);
    store.skipToNextCall();
    expect(seen).toEqual(['step-started']);
    expect(store.getState().now - store.getState().plan!.serveAt).toBe(-38 * MIN);
  });

  it('togglePause freezes kitchen time', () => {
    const { store, passReal } = setup();
    store.start('indian', 45);
    const before = store.getState().now;
    store.togglePause();
    passReal(60_000);
    store.tick();
    expect(store.getState().now).toBe(before);
  });

  it('notifies subscribers on change', () => {
    const { store } = setup();
    let n = 0;
    store.subscribe(() => { n++; });
    store.start('western', 45);
    expect(n).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/kitchen`
Expected: FAIL, because `./clock`, `./views` and `./store` can't be resolved (the planner tests still pass).

- [ ] **Step 3: Implement the modules**

`src/kitchen/clock.ts`:
```ts
export interface ClockState {
  kitchenAnchor: number;
  realAnchor: number;
  speed: number;
  paused: boolean;
}

export const createClock = (kitchenStart: number, realNow: number, speed: number): ClockState => ({
  kitchenAnchor: kitchenStart, realAnchor: realNow, speed, paused: false,
});

export const kitchenNow = (c: ClockState, realNow: number): number =>
  c.paused ? c.kitchenAnchor : c.kitchenAnchor + (realNow - c.realAnchor) * c.speed;

const reanchor = (c: ClockState, realNow: number): ClockState => ({ ...c, kitchenAnchor: kitchenNow(c, realNow), realAnchor: realNow });

export const withSpeed = (c: ClockState, speed: number, realNow: number): ClockState => ({ ...reanchor(c, realNow), speed });
export const withPaused = (c: ClockState, paused: boolean, realNow: number): ClockState => ({ ...reanchor(c, realNow), paused });
export const jumpTo = (c: ClockState, kitchenTime: number, realNow: number): ClockState => ({ ...c, kitchenAnchor: kitchenTime, realAnchor: realNow });
```

`src/kitchen/views.ts`:
```ts
import { MIN, type PlannedDish, type PlannedStep } from './planner';

export const FIRE_WINDOW_MS = 2 * MIN;
export type TicketState = 'waiting' | 'fire' | 'cooking' | 'holding' | 'ready';

export interface TicketView {
  state: TicketState;
  step: PlannedStep | null;
  next: PlannedStep | null;
  progress: number;
  remainingMs: number;
  stepIndex: number;
  stepCount: number;
}

export function ticketView(d: PlannedDish, now: number): TicketView {
  const stepCount = d.steps.length;
  const activeIndex = d.steps.findIndex(s => s.status === 'active');
  const nextIndex = d.steps.findIndex(s => s.status === 'pending');
  const next = nextIndex >= 0 ? d.steps[nextIndex] : null;
  if (activeIndex >= 0) {
    const step = d.steps[activeIndex];
    const span = Math.max(1, step.end - step.start);
    return {
      state: now - step.start < FIRE_WINDOW_MS ? 'fire' : 'cooking',
      step, next,
      progress: Math.min(1, Math.max(0, (now - step.start) / span)),
      remainingMs: Math.max(0, step.end - now),
      stepIndex: activeIndex, stepCount,
    };
  }
  if (!next) return { state: 'ready', step: null, next: null, progress: 1, remainingMs: 0, stepIndex: stepCount - 1, stepCount };
  const started = d.steps.some(s => s.status === 'done');
  return {
    state: started ? 'holding' : 'waiting',
    step: null, next, progress: 0,
    remainingMs: Math.max(0, next.start - now),
    stepIndex: nextIndex, stepCount,
  };
}
```

`src/kitchen/calls.ts`:
```ts
import type { KitchenEvent } from './planner';

export const SERVICE_CALL = "Service. Everything's ready. Plate up.";

export function callText(e: KitchenEvent): string | null {
  if (e.type === 'step-started') return e.step.call;
  if (e.type === 'serve') return SERVICE_CALL;
  return null;
}
```

`src/kitchen/store.ts`:
```ts
import { useSyncExternalStore } from 'react';
import { MENUS, type DishId, type MenuId } from './recipes';
import {
  MIN, advance, createPlan, describeChange, markDone, reportDelay, restartStep, shiftServe, upcoming,
  type KitchenEvent, type Plan, type UpcomingCall,
} from './planner';
import { createClock, jumpTo, kitchenNow, withPaused, withSpeed, type ClockState } from './clock';

export type LogKind = 'call' | 'chef' | 'cook' | 'change' | 'system';
export interface LogEntry {
  id: number;
  kind: LogKind;
  text: string;
  at: number;
}
export interface KitchenState {
  phase: 'setup' | 'cooking' | 'served';
  menu: MenuId;
  plan: Plan | null;
  clock: ClockState;
  now: number;
  log: LogEntry[];
  replans: number;
  lastServeShift: { id: number; minutes: number } | null;
}

export const DEFAULT_SPEED = 30;
export const SPEEDS = [1, 10, 30] as const;

export function demoStart(): number {
  const d = new Date();
  d.setHours(19, 15, 0, 0);
  return d.getTime();
}

export function createKitchenStore(realNow: () => number = () => performance.now()) {
  const start0 = demoStart();
  let state: KitchenState = {
    phase: 'setup', menu: 'indian', plan: null, clock: createClock(start0, realNow(), DEFAULT_SPEED),
    now: start0, log: [], replans: 0, lastServeShift: null,
  };
  const subs = new Set<() => void>();
  const eventSubs = new Set<(events: KitchenEvent[]) => void>();
  let logId = 0;
  let shiftId = 0;

  const set = (patch: Partial<KitchenState>) => {
    state = { ...state, ...patch };
    subs.forEach(fn => fn());
  };
  const entry = (kind: LogKind, text: string, at: number): LogEntry => ({ id: ++logId, kind, text, at });
  const currentNow = () => kitchenNow(state.clock, realNow());

  function change(mutate: (p: Plan, now: number) => Plan): string {
    if (!state.plan) return 'No dinner is running yet.';
    const now = currentNow();
    const before = state.plan;
    const after = mutate(before, now);
    const summary = describeChange(before, after);
    const deltaMin = Math.round((after.serveAt - before.serveAt) / MIN);
    set({
      plan: after, now,
      log: [...state.log, entry('change', summary, now)],
      replans: state.replans + 1,
      lastServeShift: deltaMin !== 0 ? { id: ++shiftId, minutes: deltaMin } : state.lastServeShift,
    });
    return summary;
  }

  function tick() {
    if (!state.plan || state.phase === 'setup') return;
    const now = currentNow();
    const { plan, events } = advance(state.plan, now);
    const served = events.some(e => e.type === 'serve');
    set({ plan, now, phase: served ? 'served' : state.phase });
    if (events.length) eventSubs.forEach(fn => fn(events));
  }

  function nextCalls(limit = 3): UpcomingCall[] {
    return state.plan ? upcoming(state.plan, currentNow(), limit) : [];
  }

  return {
    getState: () => state,
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
    onKitchenEvents(fn: (events: KitchenEvent[]) => void) {
      eventSubs.add(fn);
      return () => { eventSubs.delete(fn); };
    },
    start(menu: MenuId, serveInMinutes: number) {
      const start = demoStart();
      set({
        phase: 'cooking', menu,
        plan: createPlan(MENUS[menu].dishes, start + serveInMinutes * MIN, start),
        clock: createClock(start, realNow(), state.clock.speed),
        now: start, log: [], replans: 0, lastServeShift: null,
      });
    },
    tick,
    reportDelay: (dish: DishId, minutes: number) => change((p, now) => reportDelay(p, dish, minutes, now)),
    shiftServe: (minutes: number) => change((p, now) => shiftServe(p, minutes, now)),
    restartStep: (dish: DishId) => change((p, now) => restartStep(p, dish, now)),
    markDone: (dish: DishId) => change((p, now) => markDone(p, dish, now)),
    upcoming: nextCalls,
    log(kind: LogKind, text: string) {
      set({ log: [...state.log, entry(kind, text, currentNow())] });
    },
    setSpeed(speed: number) {
      set({ clock: withSpeed(state.clock, speed, realNow()) });
    },
    togglePause() {
      set({ clock: withPaused(state.clock, !state.clock.paused, realNow()) });
    },
    skipToNextCall() {
      const next = nextCalls(1)[0];
      if (!next) return;
      set({ clock: jumpTo(state.clock, next.at, realNow()) });
      tick();
    },
    reset() {
      set({ phase: 'setup', plan: null, log: [], replans: 0, lastServeShift: null });
    },
  };
}

export type KitchenStore = ReturnType<typeof createKitchenStore>;

export function useKitchen(store: KitchenStore): KitchenState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/kitchen`
Expected: every test in planner, clock, views and store passes.

- [ ] **Step 5: Commit**

```bash
git add src/kitchen
git commit -m "feat: kitchen clock, ticket views and store"
```

---

### Task 3: Voice core (PCM helpers, callout queue, agent config, tool executor)

**Files:**
- Create: `src/voice/pcm.ts`, `src/voice/calloutQueue.ts`, `src/voice/agentConfig.ts`, `src/voice/tools.ts`
- Test: `src/voice/pcm.test.ts`, `src/voice/calloutQueue.test.ts`, `src/voice/agentConfig.test.ts`, `src/voice/tools.test.ts`

**Interfaces:**
- Consumes: `Plan`, `fmtTime` (planner); `KitchenStore` (store); `DishId` (recipes).
- Produces:
  - `floatTo16`, `int16ToBase64`, `base64ToFloat`, `ChunkAccumulator`
  - `CalloutQueue` (`push`, `pump(gate, nowMs)`, `onReplyAudio`, `onReplyDone`, `busy`, `pending`), `VoiceGate`, `CALL_TIMEOUT_MS`, `callInstructions`
  - `AGENT_WS_URL`, `SessionConfig`, `ToolDef`, `buildSession(plan)`
  - `executeTool(store, name, args): ToolResult`, `ToolResult`

- [ ] **Step 1: Write the failing tests**

`src/voice/pcm.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ChunkAccumulator, base64ToFloat, floatTo16, int16ToBase64 } from './pcm';

describe('pcm', () => {
  it('converts floats to clipped 16-bit samples', () => {
    expect(Array.from(floatTo16(new Float32Array([0, 1, -1, 2, -2])))).toEqual([0, 32767, -32768, 32767, -32768]);
  });
  it('round-trips through base64', () => {
    const src = new Float32Array([0, 0.5, -0.5, 0.25]);
    const back = base64ToFloat(int16ToBase64(floatTo16(src)));
    back.forEach((v, i) => expect(v).toBeCloseTo(src[i], 3));
  });
  it('emits fixed-size chunks and keeps the remainder', () => {
    const acc = new ChunkAccumulator(4);
    expect(acc.push(new Float32Array(3))).toHaveLength(0);
    const out = acc.push(new Float32Array(3));
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(4);
    expect(acc.push(new Float32Array(2))).toHaveLength(1);
  });
});
```

`src/voice/calloutQueue.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CALL_TIMEOUT_MS, CalloutQueue } from './calloutQueue';

const idle = { userSpeaking: false, replyInProgress: false, pendingToolResults: 0 };
function setup() {
  const sent: string[] = [];
  return { sent, q: new CalloutQueue(i => sent.push(i)) };
}

describe('CalloutQueue', () => {
  it('waits while the cook is speaking, then merges queued calls', () => {
    const { sent, q } = setup();
    q.push('Rice on.');
    q.push('Naan dough out.');
    q.pump({ ...idle, userSpeaking: true }, 0);
    expect(sent).toHaveLength(0);
    q.pump(idle, 10);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('"Rice on. Naan dough out."');
    expect(q.busy).toBe(true);
  });
  it('never sends during a reply or with tool results pending', () => {
    const { sent, q } = setup();
    q.push('Rice on.');
    q.pump({ ...idle, replyInProgress: true }, 0);
    q.pump({ ...idle, pendingToolResults: 1 }, 0);
    expect(sent).toHaveLength(0);
  });
  it('retries once when the reply had no audio, then gives up', () => {
    const { sent, q } = setup();
    q.push('Rice on.');
    q.pump(idle, 0);
    q.onReplyDone();
    q.pump(idle, 100);
    expect(sent).toHaveLength(2);
    q.onReplyDone();
    q.pump(idle, 200);
    expect(sent).toHaveLength(2);
    expect(q.pending).toBe(0);
  });
  it('clears once audio was heard', () => {
    const { q } = setup();
    q.push('Rice on.');
    q.pump(idle, 0);
    q.onReplyAudio();
    q.onReplyDone();
    expect(q.pending).toBe(0);
    expect(q.busy).toBe(false);
  });
  it('retries once when a call never started', () => {
    const { sent, q } = setup();
    q.push('Rice on.');
    q.pump(idle, 0);
    q.pump(idle, CALL_TIMEOUT_MS + 1);
    expect(sent).toHaveLength(2);
    q.pump(idle, 2 * CALL_TIMEOUT_MS + 2);
    expect(sent).toHaveLength(2);
    expect(q.pending).toBe(0);
  });
});
```

`src/voice/agentConfig.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MENUS } from '../kitchen/recipes';
import { MIN, createPlan } from '../kitchen/planner';
import { buildSession } from './agentConfig';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();

describe('buildSession', () => {
  const s = buildSession(createPlan(MENUS.indian.dishes, T0 + 45 * MIN, T0));
  it('greets with tonight\'s menu and serve time', () => {
    expect(s.greeting).toBe('Chef here. Chicken curry, jeera rice and garlic naan, serving at 8:00 PM. Heard?');
    expect(s.system_prompt).toContain('Serving at 8:00 PM');
  });
  it('exposes the five kitchen tools with tonight\'s dishes as an enum', () => {
    expect(s.tools.map(t => t.name)).toEqual(['report_delay', 'shift_serve_time', 'restart_step', 'mark_done', 'whats_next']);
    const params = s.tools[0].parameters as { properties: { dish: { enum: string[] } } };
    expect(params.properties.dish.enum).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
  });
  it('biases recognition toward dish names and uses snappy turn detection', () => {
    expect(s.input?.keyterms).toEqual(expect.arrayContaining(['Heard', 'naan', 'Jeera rice']));
    expect(s.input?.turn_detection?.min_silence).toBe(500);
  });
});
```

`src/voice/tools.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createKitchenStore, DEFAULT_SPEED } from '../kitchen/store';
import { MIN } from '../kitchen/planner';
import { executeTool } from './tools';

function cooking(minutesIn: number) {
  let real = 0;
  const store = createKitchenStore(() => real);
  store.start('indian', 45);
  real += (minutesIn * MIN) / DEFAULT_SPEED;
  store.tick();
  return store;
}

describe('executeTool', () => {
  it('report_delay re-plans and returns the summary', () => {
    const r = executeTool(cooking(10), 'report_delay', { dish: 'chicken_curry', minutes: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.summary).toMatch(/^Serving now 8:10 PM/);
  });
  it('accepts JSON-string arguments and defaults minutes to 5', () => {
    const r = executeTool(cooking(10), 'report_delay', '{"dish":"chicken_curry"}');
    if (r.ok) expect(r.summary).toMatch(/^Serving now 8:05 PM/);
    else throw new Error(r.error);
  });
  it('rejects dishes that are not on tonight\'s menu', () => {
    const r = executeTool(cooking(10), 'report_delay', { dish: 'biryani', minutes: 5 });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("isn't on tonight's menu");
  });
  it('shift_serve_time moves dinner', () => {
    const r = executeTool(cooking(0), 'shift_serve_time', { minutes: 20 });
    if (r.ok) expect(r.summary).toMatch(/^Serving now 8:20 PM/);
    else throw new Error(r.error);
  });
  it('whats_next reads the next calls', () => {
    const r = executeTool(cooking(0), 'whats_next', {});
    if (r.ok) expect(r.summary).toMatch(/^Serving at 8:00 PM\. Next: Garlic naan: mix & knead dough at 7:22 PM/);
    else throw new Error(r.error);
  });
  it('reports unknown tools', () => {
    expect(executeTool(cooking(0), 'launch_rocket', {})).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/voice`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement the modules**

`src/voice/pcm.ts`:
```ts
export function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToFloat(b64: string): Float32Array {
  const bin = atob(b64);
  const n = Math.floor(bin.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

export class ChunkAccumulator {
  private readonly size: number;
  private buf: Int16Array;
  private fill = 0;

  constructor(size: number) {
    this.size = size;
    this.buf = new Int16Array(size);
  }

  push(input: Float32Array): Int16Array[] {
    const samples = floatTo16(input);
    const out: Int16Array[] = [];
    let i = 0;
    while (i < samples.length) {
      const take = Math.min(this.size - this.fill, samples.length - i);
      this.buf.set(samples.subarray(i, i + take), this.fill);
      this.fill += take;
      i += take;
      if (this.fill === this.size) {
        out.push(this.buf);
        this.buf = new Int16Array(this.size);
        this.fill = 0;
      }
    }
    return out;
  }
}
```

`src/voice/calloutQueue.ts` (verified in a scratch run):
```ts
export interface VoiceGate {
  userSpeaking: boolean;
  replyInProgress: boolean;
  pendingToolResults: number;
}
interface Queued {
  text: string;
  isRetry: boolean;
}
interface InFlight extends Queued {
  sentAt: number;
  heardAudio: boolean;
}

export const CALL_TIMEOUT_MS = 4000;
export const callInstructions = (text: string) => `Say exactly this kitchen call and nothing else: "${text}"`;

export class CalloutQueue {
  private queue: Queued[] = [];
  private inFlight: InFlight | null = null;
  private readonly send: (instructions: string) => void;

  constructor(send: (instructions: string) => void) {
    this.send = send;
  }

  push(text: string) {
    this.queue.push({ text, isRetry: false });
  }

  get pending() {
    return this.queue.length + (this.inFlight ? 1 : 0);
  }

  get busy() {
    return this.inFlight !== null;
  }

  pump(gate: VoiceGate, now: number) {
    if (this.inFlight && !gate.replyInProgress && now - this.inFlight.sentAt > CALL_TIMEOUT_MS) this.dropInFlight();
    if (this.inFlight || this.queue.length === 0) return;
    if (gate.userSpeaking || gate.replyInProgress || gate.pendingToolResults > 0) return;
    const batch = this.queue.splice(0);
    const text = batch.map(q => q.text).join(' ');
    this.inFlight = { text, isRetry: batch.every(q => q.isRetry), sentAt: now, heardAudio: false };
    this.send(callInstructions(text));
  }

  onReplyAudio() {
    if (this.inFlight) this.inFlight.heardAudio = true;
  }

  onReplyDone() {
    if (!this.inFlight) return;
    if (this.inFlight.heardAudio) this.inFlight = null;
    else this.dropInFlight();
  }

  private dropInFlight() {
    const f = this.inFlight;
    this.inFlight = null;
    if (f && !f.isRetry) this.queue.unshift({ text: f.text, isRetry: true });
  }
}
```

`src/voice/agentConfig.ts`:
```ts
import { fmtTime, type Plan } from '../kitchen/planner';

export const AGENT_WS_URL = 'wss://agents.assemblyai.com/v1/ws';

export interface ToolDef {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface SessionConfig {
  system_prompt: string;
  greeting?: string;
  tools: ToolDef[];
  input?: { keyterms?: string[]; turn_detection?: { min_silence?: number; vad_threshold?: number } };
  output?: { voice?: string; volume?: number };
}

const SYSTEM_PROMPT = `You are Chef, the head chef on the pass, running a home cook's dinner by voice. Their hands are busy and their eyes are on the stove, so everything you say must work by ear.

Tonight: {MENU}. Serving at {SERVE}.

How you talk:
- Short kitchen calls. Calm, sure, warm. Usually under 12 words. No small talk, no lists, no emoji, no markdown.
- Acknowledge a report with "Heard." and then the one change that matters.
- Say times the way a person would, like "eight ten".

How you work:
- You never work out times yourself. Every change goes through a tool, and you only repeat what the tool's summary says.
- Needs more time, not ready, still raw, not started yet: report_delay.
- Guests late or early, eat later or sooner: shift_serve_time.
- Burnt it, ruined it, starting a step again: restart_step.
- A step finished early: mark_done.
- What's next, how long, where are we, when do we eat: whats_next.
- If a tool returns an error, say it in one short line.
- Only tonight's dishes exist. If asked about anything else, say you're running tonight's menu.
- Never promise food is safe. If asked whether something is cooked, tell them how to check.`;

const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildSession(plan: Plan): SessionConfig {
  const menu = joinList(plan.dishes.map(d => d.name.toLowerCase()));
  const serve = fmtTime(plan.serveAt);
  const dish = {
    type: 'string',
    enum: plan.dishes.map(d => d.id),
    description: `Tonight's dishes: ${plan.dishes.map(d => `${d.id} = ${d.name} (the "${d.short}")`).join(', ')}.`,
  };
  return {
    system_prompt: SYSTEM_PROMPT.replace('{MENU}', menu).replace('{SERVE}', serve),
    greeting: `Chef here. ${capitalize(menu)}, serving at ${serve}. Heard?`,
    tools: [
      {
        type: 'function', name: 'report_delay',
        description: 'A dish needs more time than planned: not ready, still raw, still hard, or not started yet. Re-plans every dish.',
        parameters: { type: 'object', properties: { dish, minutes: { type: 'integer', description: 'Extra minutes. Use 5 if the cook did not say.' } }, required: ['dish'] },
      },
      {
        type: 'function', name: 'shift_serve_time',
        description: 'Move dinner later (guests late: positive minutes) or earlier (negative minutes). Re-plans every dish.',
        parameters: { type: 'object', properties: { minutes: { type: 'integer' } }, required: ['minutes'] },
      },
      {
        type: 'function', name: 'restart_step',
        description: 'The cook burnt or ruined the current step of a dish and is starting it again.',
        parameters: { type: 'object', properties: { dish }, required: ['dish'] },
      },
      {
        type: 'function', name: 'mark_done',
        description: 'The current step of a dish finished early.',
        parameters: { type: 'object', properties: { dish }, required: ['dish'] },
      },
      {
        type: 'function', name: 'whats_next',
        description: "What happens next, how long until something, where are we, or when do we eat.",
        parameters: { type: 'object', properties: {} },
      },
    ],
    input: {
      keyterms: ['Heard', 'Chef', ...plan.dishes.flatMap(d => [d.name, d.short])],
      turn_detection: { min_silence: 500 },
    },
  };
}
```

`src/voice/tools.ts`:
```ts
import { fmtTime } from '../kitchen/planner';
import type { DishId } from '../kitchen/recipes';
import type { KitchenStore } from '../kitchen/store';

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
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== undefined && v !== null ? Math.min(hi, Math.max(lo, n)) : fallback;
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
    case 'whats_next': {
      const next = store.upcoming(3);
      const serve = fmtTime(store.getState().plan!.serveAt);
      if (!next.length) return { ok: true, summary: `Everything's on. Serving at ${serve}.` };
      return { ok: true, summary: `Serving at ${serve}. Next: ${next.map(c => `${c.dish}: ${c.label.toLowerCase()} at ${fmtTime(c.at)}`).join('; ')}.` };
    }
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run`
Expected: every kitchen and voice test passes.

- [ ] **Step 5: Commit**

```bash
git add src/voice
git commit -m "feat: voice core — PCM helpers, callout queue, agent config, tool executor"
```

---

### Task 4: Voice runtime (audio engine, socket, session hook) and live agent test

**Files:**
- Create: `public/pcm-capture-worklet.js`, `src/voice/audio.ts`, `src/voice/agentSocket.ts`, `src/voice/useChefSession.ts`, `src/ui/sound.ts`
- Test: `src/voice/agent.e2e.test.ts` (live API, opt-in)

**Interfaces:**
- Consumes: `buildSession`, `SessionConfig`, `AGENT_WS_URL`, `CalloutQueue`, `VoiceGate`, `executeTool`, `ToolResult`, `ChunkAccumulator`, `int16ToBase64`, `base64ToFloat`, `KitchenStore`, `callText`
- Produces:
  - `AudioEngine` (`startMic(onChunk)`, `play(b64)`, `flush()`, `speaking`, `micLevel`, `muted`, `close()`), `SAMPLE_RATE`
  - `AgentSocket` (`connect(key, session)`, `onEvent(fn)`, `sendAudio`, `sendToolResult`, `replyCreate`, `updateSession`, `close`), `AgentError`, `ServerEvent`
  - `useChefSession(store)` returning `{ phase, error, voice, start, stop, toggleMute }`, plus `SessionPhase` and `VoiceStatus`
  - `playBell()`, `unlockSound()`

- [ ] **Step 1: Write the live agent test.** It is skipped unless `AAI_KEY` is set on macOS. Save it as `src/voice/agent.e2e.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MENUS } from '../kitchen/recipes';
import { MIN, createPlan } from '../kitchen/planner';
import { AGENT_WS_URL, buildSession } from './agentConfig';

const KEY = process.env.AAI_KEY;
const RATE = 24000;
const CHUNK_BYTES = (RATE * 2 * 50) / 1000;
const dir = mkdtempSync(join(tmpdir(), 'chef-e2e-'));

function speech(line: string): Buffer {
  const file = join(dir, `${line.replace(/\W+/g, '_')}.wav`);
  execFileSync('say', ['-o', file, `--data-format=LEI16@${RATE}`, line]);
  const b = readFileSync(file);
  let off = 12;
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'data') return b.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
}

async function toolCallsFor(line: string): Promise<{ name: string; arguments: Record<string, unknown> }[]> {
  const t0 = new Date(2026, 8, 28, 19, 15).getTime();
  const session = { ...buildSession(createPlan(MENUS.indian.dishes, t0 + 45 * MIN, t0)), greeting: undefined };
  const ws = new WebSocket(`${AGENT_WS_URL}?token=${KEY}`);
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session }));
    ws.onerror = () => reject(new Error('socket error'));
    ws.onmessage = m => {
      const d = JSON.parse(String(m.data));
      if (d.type === 'session.ready') resolve();
      if (d.type === 'session.error') reject(new Error(d.message));
      if (d.type === 'tool.call') calls.push({ name: d.name, arguments: d.arguments });
    };
  });
  const audio = Buffer.concat([speech(line), Buffer.alloc(RATE * 2 * 3)]);
  for (let i = 0; i < audio.length; i += CHUNK_BYTES) {
    ws.send(JSON.stringify({ type: 'input.audio', audio: audio.subarray(i, i + CHUNK_BYTES).toString('base64') }));
    await new Promise(r => setTimeout(r, 50));
  }
  await new Promise(r => setTimeout(r, 2500));
  ws.send(JSON.stringify({ type: 'session.end' }));
  ws.close();
  return calls;
}

describe.runIf(!!KEY && process.platform === 'darwin')('Chef agent (live AssemblyAI)', () => {
  it.each([
    ['The curry needs ten more minutes.', 'report_delay', { dish: 'chicken_curry', minutes: 10 }],
    ['Our guests are running twenty minutes late.', 'shift_serve_time', { minutes: 20 }],
    ['Oh no, I burnt the garlic for the curry.', 'restart_step', { dish: 'chicken_curry' }],
    ["What's next?", 'whats_next', {}],
  ])('"%s" → %s', async (line, tool, args) => {
    const calls = await toolCallsFor(line);
    expect(calls[0]).toMatchObject({ name: tool, arguments: args });
  }, 45_000);
});
```

- [ ] **Step 2: Implement the runtime**

`public/pcm-capture-worklet.js`:
```js
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
```

`src/voice/audio.ts`:
```ts
import { ChunkAccumulator, base64ToFloat, int16ToBase64 } from './pcm';

export const SAMPLE_RATE = 24000;
const CHUNK_SAMPLES = SAMPLE_RATE / 20;

export class AudioEngine {
  readonly ctx: AudioContext;
  micLevel = 0;
  muted = false;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private readonly acc = new ChunkAccumulator(CHUNK_SAMPLES);
  private readonly sources = new Set<AudioBufferSourceNode>();
  private nextPlay = 0;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  }

  async startMic(onChunk: (b64: string) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    await this.ctx.audioWorklet.addModule('/pcm-capture-worklet.js');
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'pcm-capture');
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    source.connect(this.node);
    this.node.connect(silent).connect(this.ctx.destination);
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const frame = e.data;
      let sum = 0;
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
      this.micLevel = Math.sqrt(sum / frame.length);
      if (this.muted) return;
      for (const chunk of this.acc.push(frame)) onChunk(int16ToBase64(chunk));
    };
    await this.ctx.resume();
  }

  play(b64: string) {
    const samples = base64ToFloat(b64);
    if (!samples.length) return;
    const buffer = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.02, this.nextPlay);
    src.start(at);
    this.nextPlay = at + buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  flush() {
    for (const s of this.sources) {
      try { s.stop(); } catch { /* already stopped */ }
    }
    this.sources.clear();
    this.nextPlay = 0;
  }

  get speaking() {
    return this.sources.size > 0;
  }

  async close() {
    this.flush();
    this.node?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    if (this.ctx.state !== 'closed') await this.ctx.close();
  }
}
```

`src/voice/agentSocket.ts`:
```ts
import { AGENT_WS_URL, type SessionConfig } from './agentConfig';

export type ServerEvent = { type: string } & Record<string, unknown>;

export class AgentError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AgentError';
  }
}

export class AgentSocket {
  private ws: WebSocket | null = null;
  private readonly listeners = new Set<(e: ServerEvent) => void>();

  onEvent(fn: (e: ServerEvent) => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  connect(apiKey: string, session: SessionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${AGENT_WS_URL}?token=${encodeURIComponent(apiKey)}`);
      this.ws = ws;
      let ready = false;
      ws.onopen = () => this.send({ type: 'session.update', session });
      ws.onmessage = m => {
        const e = JSON.parse(String(m.data)) as ServerEvent;
        if (e.type === 'session.ready' && !ready) {
          ready = true;
          resolve();
        }
        if (e.type === 'session.error' && !ready) reject(new AgentError(String(e.code ?? 'error'), String(e.message ?? 'Session error')));
        this.listeners.forEach(fn => fn(e));
      };
      ws.onclose = ev => {
        if (!ready) reject(new AgentError('closed', `Connection closed (${ev.code})`));
        if (this.ws === ws) this.listeners.forEach(fn => fn({ type: 'socket.closed', code: ev.code }));
      };
    });
  }

  send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendAudio(b64: string) {
    this.send({ type: 'input.audio', audio: b64 });
  }

  sendToolResult(callId: string, result: unknown) {
    this.send({ type: 'tool.result', call_id: callId, result: JSON.stringify(result) });
  }

  replyCreate(instructions: string) {
    this.send({ type: 'reply.create', instructions });
  }

  updateSession(session: Partial<SessionConfig>) {
    this.send({ type: 'session.update', session });
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'session.end' }));
    setTimeout(() => ws?.close(), 300);
  }
}
```

`src/ui/sound.ts`:
```ts
let ctx: AudioContext | null = null;

export function unlockSound() {
  ctx ??= new AudioContext();
  void ctx.resume();
}

export function playBell() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [freq, peak] of [[1318.5, 0.16], [2637, 0.05], [3951, 0.025]] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.25);
  }
}
```

`src/voice/useChefSession.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KitchenStore } from '../kitchen/store';
import { callText } from '../kitchen/calls';
import { AgentError, AgentSocket, type ServerEvent } from './agentSocket';
import { AudioEngine } from './audio';
import { CalloutQueue, type VoiceGate } from './calloutQueue';
import { buildSession } from './agentConfig';
import { executeTool, type ToolResult } from './tools';

export type SessionPhase = 'idle' | 'connecting' | 'live' | 'error';
export interface VoiceStatus {
  userSpeaking: boolean;
  chefSpeaking: boolean;
  muted: boolean;
  micLevel: number;
}

interface Runtime {
  socket: AgentSocket;
  engine: AudioEngine;
  queue: CalloutQueue;
  gate: VoiceGate;
  results: { callId: string; result: ToolResult }[];
  replyIsCall: boolean;
  timer: number;
  unsubscribe: () => void;
}

const API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY;
export const hasApiKey = Boolean(API_KEY);

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'NotAllowedError') return 'Microphone is blocked. Allow it from the icon in the address bar, then try again.';
  if (err instanceof DOMException && err.name === 'NotFoundError') return 'No microphone found. Plug one in and try again.';
  if (err instanceof AgentError && err.code === 'unauthorized') return 'AssemblyAI rejected the API key. Check VITE_ASSEMBLYAI_API_KEY in .env.local.';
  if (err instanceof AgentError) return "Couldn't reach Chef. Check your internet connection and try again.";
  return `Something went wrong starting Chef: ${err instanceof Error ? err.message : String(err)}`;
}

async function teardown(r: Runtime) {
  window.clearInterval(r.timer);
  r.unsubscribe();
  r.socket.close();
  await r.engine.close();
}

export function useChefSession(store: KitchenStore) {
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceStatus>({ userSpeaking: false, chefSpeaking: false, muted: false, micLevel: 0 });
  const rt = useRef<Runtime | null>(null);

  const stop = useCallback(async () => {
    const r = rt.current;
    rt.current = null;
    if (r) await teardown(r);
    setPhase('idle');
  }, []);

  const start = useCallback(async () => {
    if (!API_KEY) {
      setError('Add your AssemblyAI key to .env.local as VITE_ASSEMBLYAI_API_KEY, then restart the dev server.');
      setPhase('error');
      return;
    }
    const plan = store.getState().plan;
    if (!plan) return;
    if (rt.current) await teardown(rt.current);
    setPhase('connecting');
    setError(null);

    const engine = new AudioEngine();
    const socket = new AgentSocket();
    const gate: VoiceGate = { userSpeaking: false, replyInProgress: false, pendingToolResults: 0 };
    const queue = new CalloutQueue(instructions => socket.replyCreate(instructions));
    const r: Runtime = { socket, engine, queue, gate, results: [], replyIsCall: false, timer: 0, unsubscribe: () => {} };
    rt.current = r;

    socket.onEvent((e: ServerEvent) => {
      switch (e.type) {
        case 'input.speech.started':
          gate.userSpeaking = true;
          break;
        case 'input.speech.stopped':
          gate.userSpeaking = false;
          break;
        case 'transcript.user':
          if (e.text) store.log('cook', String(e.text));
          break;
        case 'reply.started':
          gate.replyInProgress = true;
          r.replyIsCall = queue.busy;
          break;
        case 'reply.audio':
          engine.play(String(e.data));
          queue.onReplyAudio();
          break;
        case 'transcript.agent':
          if (!r.replyIsCall && e.text) store.log('chef', String(e.text));
          break;
        case 'tool.call':
          r.results.push({ callId: String(e.call_id), result: executeTool(store, String(e.name), e.arguments) });
          gate.pendingToolResults = r.results.length;
          break;
        case 'reply.done':
          gate.replyInProgress = false;
          if (e.status === 'interrupted') engine.flush();
          for (const x of r.results.splice(0)) socket.sendToolResult(x.callId, x.result);
          gate.pendingToolResults = 0;
          queue.onReplyDone();
          break;
        case 'session.error':
          store.log('system', `Voice error: ${String(e.message ?? e.code ?? 'unknown')}`);
          break;
        case 'socket.closed':
          if (rt.current === r) {
            setError('Lost the connection to Chef. Check your internet, then reconnect.');
            setPhase('error');
          }
          break;
      }
      queue.pump(gate, performance.now());
    });

    r.unsubscribe = store.onKitchenEvents(events => {
      for (const ev of events) {
        const text = callText(ev);
        if (text) queue.push(text);
      }
      queue.pump(gate, performance.now());
    });

    try {
      await engine.startMic(b64 => socket.sendAudio(b64));
      await socket.connect(API_KEY, buildSession(plan));
    } catch (err) {
      rt.current = null;
      await teardown(r);
      setError(describeError(err));
      setPhase('error');
      return;
    }

    r.timer = window.setInterval(() => {
      queue.pump(gate, performance.now());
      setVoice(v => {
        const next = { userSpeaking: gate.userSpeaking, chefSpeaking: engine.speaking, muted: engine.muted, micLevel: Math.round(engine.micLevel * 100) / 100 };
        return v.userSpeaking === next.userSpeaking && v.chefSpeaking === next.chefSpeaking && v.muted === next.muted && v.micLevel === next.micLevel ? v : next;
      });
    }, 100);
    setPhase('live');
  }, [store]);

  const toggleMute = useCallback(() => {
    const r = rt.current;
    if (!r) return;
    r.engine.muted = !r.engine.muted;
    setVoice(v => ({ ...v, muted: r.engine.muted }));
  }, []);

  useEffect(() => () => { if (rt.current) void teardown(rt.current); }, []);

  return { phase, error, voice, start, stop, toggleMute };
}
```

- [ ] **Step 3: Type-check and run the unit tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all unit tests pass; the live suite is skipped.

- [ ] **Step 4: Run the live agent test against the real API**

Run: `AAI_KEY=<key from .env.local> npm run test:e2e`, and read the key with `grep VITE_ASSEMBLYAI_API_KEY .env.local | cut -d= -f2`. Don't paste it into any file.
Expected: 4 passed.
- If a case fails, adjust the tool descriptions or the system prompt in `agentConfig.ts` (not the test) and re-run.
- Also check the Voice Agent API docs for the list of output voices. If there's a calm, deeper voice, set `output: { voice: '<name>' }` in `buildSession` and add a unit assertion for it. Otherwise leave the default `anna`.

- [ ] **Step 5: Commit**

```bash
git add public/pcm-capture-worklet.js src/voice src/ui/sound.ts
git commit -m "feat: voice runtime — audio engine, agent socket, session hook, live agent test"
```

---

### Task 5: UI build with Impeccable

**REQUIRED SKILL:** `impeccable:impeccable` (craft flow). PRODUCT.md exists, and the spec §8 is the confirmed design brief, so go straight to the build. Load `reference/layout.md`, `typeset.md`, `colorize.md`, `animate.md`, `adapt.md` and `clarify.md` first. There is no native image generation, so the brief is the visual contract.

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/app.css`, `public/favicon.svg`, `public/dishes/{chicken_curry,jeera_rice,garlic_naan,roast_potatoes,salmon,green_beans}.jpg`
- Create: `src/ui/StartScreen.tsx`, `src/ui/KitchenScreen.tsx`, `src/ui/TopBar.tsx`, `src/ui/DishTicket.tsx`, `src/ui/Rail.tsx`, `src/ui/NextUp.tsx`, `src/ui/HeardLog.tsx`, `src/ui/VoiceIndicator.tsx`, `src/ui/ServedPanel.tsx`, `src/ui/ErrorBanner.tsx`, `src/ui/useShortcuts.ts`, `src/ui/format.ts`
- Test: `src/ui/format.test.ts`
- Modify: `src/App.tsx`, `src/main.tsx` (import the styles)

**Interfaces:**
- Consumes: `KitchenStore`, `useKitchen`, `KitchenState`, `LogEntry`, `ticketView`, `TicketState`, `upcoming`, `fmtTime`, `MENUS`, `RECIPES`, `SPEEDS`, `callText`, `useChefSession`, `hasApiKey`, `playBell`, `unlockSound`
- Produces: the finished app.

- [ ] **Step 1: Source the assets**
  - For each of the six dishes, find a matching photo on Unsplash (Unsplash License). The browser pane or web search works.
  - Download each at 480×480 crop (`https://images.unsplash.com/photo-<id>?w=480&h=480&fit=crop&q=80`) with `curl -fL -o public/dishes/<dish>.jpg`.
  - Verify each file is a real JPEG over 10 KB (`file public/dishes/*.jpg`).
  - Record the photographer name and URL for each, for the README credits.
  - If no good photo verifies for a dish, use the Microsoft Fluent Emoji 3D PNG (MIT) for that dish instead, and note it.
  - Create a simple `favicon.svg`: a flame or chef-hat mark in `--fire`.

- [ ] **Step 2: Write `src/styles/tokens.css`**
  - The OKLCH palette from spec §8, exactly.
  - Font stack `'Archivo', system-ui, sans-serif`.
  - A fixed rem type scale (ratio 1.2) plus the oversized glance sizes.
  - A spacing scale, radii, and motion tokens (`--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1)`; durations 160 ms / 240 ms / 400 ms).
  - A semantic z-index scale.
  - The `prefers-reduced-motion` overrides.

- [ ] **Step 3: Wire `src/App.tsx`.** This wiring is required as written; the components below are yours to design within the brief.

```tsx
import { useEffect, useMemo } from 'react';
import { createKitchenStore, useKitchen } from './kitchen/store';
import { callText } from './kitchen/calls';
import { useChefSession } from './voice/useChefSession';
import { playBell, unlockSound } from './ui/sound';
import { StartScreen } from './ui/StartScreen';
import { KitchenScreen } from './ui/KitchenScreen';
import type { MenuId } from './kitchen/recipes';

const store = createKitchenStore();
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __kitchen: typeof store }).__kitchen = store;

export default function App() {
  const state = useKitchen(store);
  const session = useChefSession(store);
  const debug = useMemo(() => new URLSearchParams(location.search).has('debug'), []);

  useEffect(() => {
    const id = window.setInterval(() => store.tick(), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => store.onKitchenEvents(events => {
    for (const e of events) {
      const text = callText(e);
      if (text) {
        store.log('call', text);
        playBell();
      }
    }
  }), []);

  const begin = async (menu: MenuId, serveIn: number) => {
    unlockSound();
    store.start(menu, serveIn);
    if (!debug) await session.start();
  };

  if (state.phase === 'setup') return <StartScreen onStart={begin} session={session} />;
  return <KitchenScreen store={store} state={state} session={session} onCookAgain={() => { void session.stop(); store.reset(); }} />;
}
```

If `session.start()` fails after `store.start()`, the kitchen screen should show the error banner with **Try again** (it calls `session.start()`) and **Back** (it calls `store.reset()`). Leave the plan intact.

- [ ] **Step 4: Build the components to these contracts**

| Component | Props | Must show / do |
|---|---|---|
| `StartScreen` | `onStart(menu, serveIn)`, `session` | Wordmark and tagline. Two menu choices with dish photos and dish names. A serve-in segmented control (30 / 45 / 60, default 45). A **Start cooking** button (mic icon) with busy state while `session.phase === 'connecting'`, disabled with the missing-key message when `!hasApiKey`. The headphones note and the demo-speed note. `session.error` inline. |
| `KitchenScreen` | `store`, `state`, `session`, `onCookAgain` | Layout from spec §8: top bar, the pass (tickets plus rail), the right column (NEXT UP, Heard log, voice indicator). `ErrorBanner` when `session.phase === 'error'`. `ServedPanel` when `state.phase === 'served'`. Keyboard shortcuts via `useShortcuts`: N `skipToNextCall`, P `togglePause`, M `toggleMute`, S cycles `SPEEDS`. |
| `TopBar` | `state`, `onSpeed`, `onPause`, `onSkip`, `voice` | Wordmark (`ChefHat`). The kitchen clock `fmtTime(state.now)` in big tabular numerals (PAUSED state). The **Serving at** chip in saffron; on `lastServeShift` change it flashes `+N` / `−N` for about 1.5 s. Speed buttons 1× · 10× · 30× with the current one pressed (`aria-pressed`), pause/play, skip-to-next (`SkipForward`). |
| `DishTicket` | `dish: PlannedDish`, `now` | Uses `ticketView`. Photo, name, current or next step label. A ring countdown (SVG) with mm:ss. Step dots. State styling: waiting / cooking / holding / **fire** (flame band plus one pulse) / ready (herb, "Ready · keep warm"). Changed tickets briefly highlight after a re-plan. |
| `Rail` | `plan`, `now` | A horizontal strip from now to serve. One marker per upcoming call (`upcoming(plan, now, 12)`), positioned by time, with photo and short label. Markers animate position (motion `layout`) when the plan changes. **No bars.** |
| `NextUp` | `plan`, `now` | The single next call in huge type (`upcoming(...)[0]`). "in m:ss", or a **NOW** flame state when a step started within `FIRE_WINDOW_MS`. The served / empty states. |
| `HeardLog` | `log: LogEntry[]` | Newest at the bottom, auto-scrolls. Kind styling: `call` (flame dot, bold), `chef` (Chef), `cook` (quoted, "You"), `change` (arrow icon, shows the summary), `system` (muted). Kitchen timestamps. `aria-live="polite"`. |
| `VoiceIndicator` | `voice`, `phase` | Listening / You're talking / Chef is talking / Muted / Connecting, with a mic-level meter. A mute toggle button. Not a glowing orb. |
| `ServedPanel` | `state`, `onCookAgain` | "Service", served at `fmtTime`, number of re-plans (`state.replans`), and a **Cook again** button. |
| `ErrorBanner` | `message`, `onRetry`, `onBack?` | `WifiOff` / `MicOff` icon, the message, and the buttons. |

`src/ui/format.ts` must export `mmss(ms: number): string` (for example `mmss(125_000) === '2:05'`), with a unit test in `src/ui/format.test.ts`:
```ts
import { it, expect } from 'vitest';
import { mmss } from './format';
it('formats kitchen milliseconds as m:ss', () => {
  expect(mmss(125_000)).toBe('2:05');
  expect(mmss(0)).toBe('0:00');
  expect(mmss(-5)).toBe('0:00');
});
```
```ts
export function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
```

`src/ui/useShortcuts.ts`:
```ts
import { useEffect } from 'react';

export function useShortcuts(map: Record<string, () => void>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const fn = map[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map]);
}
```

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no errors, all tests pass, the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add public src index.html
git commit -m "feat: kitchen-pass UI — start screen, tickets, rail, next up, heard log"
```

---

### Task 6: Browser verification and Impeccable polish

**Files:** Modify whatever the inspection finds.

- [ ] **Step 1:** Start the dev server with the browser pane's `preview_start` (via `.claude/launch.json`: `npm run dev`, port 5173). Open `http://localhost:5173/?debug`.
- [ ] **Step 2:** In debug mode, press Start cooking; the voice session is skipped. Drive the dinner with `window.__kitchen`:
  - `skipToNextCall()` several times
  - `reportDelay('chicken_curry', 10)`
  - `shiftServe(15)`
  - `restartStep('chicken_curry')`
  - `togglePause()`

  Screenshot after each step and read every screenshot. Confirm:
  - The serve chip flashes.
  - Rail markers glide.
  - Tickets change state, including fire, holding and ready.
  - The log fills.
  - The served panel appears after skipping to the end.
- [ ] **Step 3:** Screenshot at 1440×900, 1024×768 and 390×844 (`resize_window`). Fix any overflow, cramped spacing or unreadable text. The kitchen clock and NEXT UP must read clearly at 1440 wide.
- [ ] **Step 4:** Check `read_console_messages` for errors, and fix any.
- [ ] **Step 5:** Run Impeccable's detector: `node <impeccable-skill-dir>/scripts/detect.mjs --json src index.html`. Fix every real hit (bans: side-stripe borders, gradient text, decorative glass, and so on).
- [ ] **Step 6:** Do an Impeccable critique pass against spec §8 and the Design Principles in PRODUCT.md. Fix material defects only; don't invent them. Check reduced motion with DevTools emulation (`resize_window` colorScheme doesn't cover this, so check the CSS by reading it).
- [ ] **Step 7:** Real-voice smoke test is not possible in the browser pane. Record this in the handoff as Thomas's morning check.
- [ ] **Step 8:** Run `npx tsc --noEmit && npx vitest run && npm run build`, then commit:

```bash
git add -A && git status --short   # .env.local must NOT be listed
git commit -m "fix: polish kitchen UI after browser review"
```

---

### Task 7: README, demo script and project docs

**Files:**
- Modify: `README.md`, `docs/project-overview.md`, `docs/architecture.md`, `docs/tasks.md`, `docs/team-handoff.md`
- Create: `docs/demo-script.md`

- [ ] **Step 1: Rewrite `README.md`.** Include:
  - what Heard, Chef is (positioning line plus two sentences)
  - one screenshot at `docs/screenshot.png`, taken in Task 6
  - how it uses AssemblyAI: the Voice Agent API, a single browser WebSocket, client-side tool calls, proactive `reply.create` callouts, keyterms, turn detection
  - quick start: `npm install` · copy `.env.example` to `.env.local` and add a key · `npm run dev` · open localhost:5173 · use headphones
  - keyboard shortcuts, tests (`npm test`, `AAI_KEY=… npm run test:e2e`)
  - architecture (a short version of spec §4), the "no backend" note plus the key caveat
  - credits (photos with photographer links, lucide, Archivo), and the MIT license
- [ ] **Step 2: Write `docs/demo-script.md`**, a 2:30 video shot list:
  1. **0:00 cold open:** "Three dishes. One cook. Hands covered in dough."
  2. **0:10:** the start screen, pick Indian dinner, serve in 45.
  3. **0:20:** Chef greets.
  4. **0:30:** the first unprompted call, with bell and ticket fire.
  5. **0:45:** "What's next?"
  6. **1:00:** "The curry needs ten more minutes." Everything re-plans, serving 8:00 → 8:10.
  7. **1:20:** "Guests are running fifteen minutes late."
  8. **1:40:** "I burnt the garlic."
  9. **2:00:** skip to service ("Service. Plate up.").
  10. **2:15:** a closing slide: browser ↔ AssemblyAI Voice Agent API (speech-to-text + LLM + voice + tool calls), no backend, the planner does the maths.

  Also list the exact lines Thomas should say, and recording tips (headphones, 1440×900 window, the N key to skip).
- [ ] **Step 3:** Update the project docs:
  - project-overview: vision, users, solution and status
  - architecture: final architecture, a pointer to the spec
  - tasks: the task board with what's done and what's left for Sep 29–30 (voice run, prompt tuning, video, slides, cover image, optional deploy)
  - team-handoff: a new top entry covering what was built overnight, how to run it, known issues and the morning checklist
- [ ] **Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs: README, demo script and handoff for Heard, Chef MVP"
```

---

## Execution notes

- **Tasks 1–4** (logic plus the voice runtime) go subagent-driven: one implementer per task, then a spec-compliance review and a code-quality review before moving on.
- **Tasks 5–6** (UI) run inline with the Impeccable skill and the browser pane, because design quality depends on looking at screenshots and iterating.
- **Task 7** closes out.
- If anything in the brief turns out to be wrong in practice (an API field, a layout that doesn't work), note it in `docs/decisions.md` with the reason rather than silently deviating.
