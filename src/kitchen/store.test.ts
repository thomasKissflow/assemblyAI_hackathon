import { RECIPES, menuRecipes } from './recipes';
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
  it('prepare sets up a paused plan; begin starts the clock', () => {
    const { store, passReal } = setup();
    const seen: string[] = [];
    store.onKitchenEvents(evs => seen.push(...evs.map(e => e.type)));
    store.prepare(menuRecipes('indian'), 45);
    expect(store.getState().phase).toBe('ready');
    passReal(kitchenMinutes(30));
    store.tick();
    expect(seen).toHaveLength(0);
    store.begin();
    expect(store.getState().phase).toBe('cooking');
    passReal(kitchenMinutes(7));
    store.tick();
    expect(seen).toEqual(['step-started']);
  });

  it('start = prepare + begin, with a demo-speed clock', () => {
    const { store } = setup();
    store.start(menuRecipes('indian'), 45);
    const s = store.getState();
    expect(s.phase).toBe('cooking');
    expect(s.plan!.serveAt - s.now).toBe(45 * MIN);
    expect(s.clock.speed).toBe(DEFAULT_SPEED);
  });

  it('reportDelay returns the spoken summary and logs the change', () => {
    const { store, passReal } = setup();
    store.start(menuRecipes('indian'), 45);
    passReal(kitchenMinutes(10));
    store.tick();
    const summary = store.reportDelay('chicken_curry', 10);
    expect(summary).toMatch(/^Serving now 8:10 PM \(was 8:00 PM\)\./);
    expect(store.getState().log.at(-1)).toMatchObject({ kind: 'change', text: summary });
    expect(store.getState().lastServeShift?.minutes).toBe(10);
    expect(store.getState().replans).toBe(1);
  });

  it('skipToNextCall jumps to the next call, then to service at the end', () => {
    const { store } = setup();
    const seen: string[] = [];
    store.onKitchenEvents(evs => seen.push(...evs.map(e => e.type)));
    store.start(menuRecipes('indian'), 45);
    store.skipToNextCall();
    expect(seen).toEqual(['step-started']);
    expect(store.getState().plan!.serveAt - store.getState().now).toBe(38 * MIN);
    for (let i = 0; i < 20 && store.getState().phase !== 'served'; i++) store.skipToNextCall();
    expect(store.getState().phase).toBe('served');
    expect(seen.filter(t => t === 'serve')).toHaveLength(1);
  });

  it('togglePause freezes kitchen time', () => {
    const { store, passReal } = setup();
    store.start(menuRecipes('indian'), 45);
    const before = store.getState().now;
    store.togglePause();
    passReal(60_000);
    store.tick();
    expect(store.getState().now).toBe(before);
  });

  it('addDish and removeDish re-plan through change: logged, counted, and the new dish gets called', () => {
    const { store, passReal } = setup();
    const seen: string[] = [];
    store.onKitchenEvents(evs => seen.push(...evs.flatMap(e => (e.type === 'step-started' ? [e.dishId] : []))));
    store.start(menuRecipes('indian'), 45);
    passReal(kitchenMinutes(10));
    store.tick();
    const added = store.addDish(RECIPES.dal_tadka);
    expect(added).toBe('Added Dal tadka: rinse the dal at 7:32 PM.');
    expect(store.getState().plan!.dishes.map(d => d.id)).toContain('dal_tadka');
    expect(store.getState().log.at(-1)).toMatchObject({ kind: 'change', text: added });
    const dropped = store.removeDish('garlic_naan');
    expect(dropped).toBe('Dropped Garlic naan.');
    expect(store.getState().plan!.dishes.map(d => d.id)).toEqual(['chicken_curry', 'jeera_rice', 'dal_tadka']);
    expect(store.getState().replans).toBe(2);
    passReal(kitchenMinutes(7));
    store.tick();
    expect(seen).toContain('dal_tadka');
    expect(store.getState().plan!.dishes.find(d => d.id === 'dal_tadka')!.steps[0].status).toBe('active');
  });

  it('addDish that pushes serving records the serve shift', () => {
    const { store, passReal } = setup();
    store.start(menuRecipes('indian'), 45);
    passReal(kitchenMinutes(20));
    store.tick();
    expect(store.addDish(RECIPES.aloo_gobi)).toMatch(/Serving now 8:05 PM \(was 8:00 PM\)/);
    expect(store.getState().lastServeShift?.minutes).toBe(5);
  });

  it('kitchenNow reads the live clock', () => {
    const { store, passReal } = setup();
    store.start(menuRecipes('indian'), 45);
    passReal(1000);
    expect(store.kitchenNow() - store.getState().plan!.serveAt).toBe(-45 * MIN + 1000 * DEFAULT_SPEED);
  });
});
