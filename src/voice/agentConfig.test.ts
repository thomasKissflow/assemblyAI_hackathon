import { describe, it, expect } from 'vitest';
import { BUILTIN_RECIPES, RECIPES, menuRecipes, type Recipe } from '../kitchen/recipes';
import { MIN, createPlan } from '../kitchen/planner';
import { buildSession, sttKeyterms } from './agentConfig';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const plan = createPlan(menuRecipes('indian'), T0 + 45 * MIN, T0);

describe('buildSession', () => {
  const s = buildSession(plan);
  it("states tonight's plan and leaves the greeting to the app", () => {
    expect(s.greeting).toBeUndefined();
    expect(s.system_prompt).toContain('Tonight: chicken curry, jeera rice and garlic naan. Serving at 8:00 PM.');
  });
  it('carries the conversation rules and guardrails', () => {
    expect(s.system_prompt).toContain('Not my station');
    expect(s.system_prompt).toMatch(/never say "hey chef" yourself/i);
    expect(s.system_prompt).toContain('drop what you were saying');
  });
  it("exposes the five kitchen tools with tonight's dishes as an enum", () => {
    expect(s.tools.map(t => t.name)).toEqual(['report_delay', 'shift_serve_time', 'restart_step', 'mark_done', 'kitchen_status']);
    const params = s.tools[0].parameters as { properties: { dish: { enum: string[] } } };
    expect(params.properties.dish.enum).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
  });
  it('biases recognition and uses snappy turn detection', () => {
    expect(s.input?.keyterms).toEqual(expect.arrayContaining(['Hey Chef', 'Heard', 'naan', 'Jeera rice']));
    expect(s.input?.turn_detection?.min_silence).toBe(500);
  });
  it('speaks in a calm, warm head-chef voice', () => {
    expect(s.output?.voice).toBe('michael');
  });
});

it('gives the STT the wake phrase and dish names as keyterms', () => {
  expect(sttKeyterms(plan)).toEqual(expect.arrayContaining(['Hey Chef', 'Chef', 'Garlic naan']));
});

describe('buildSession with the recipe book', () => {
  const s = buildSession(plan, BUILTIN_RECIPES);
  const dishParam = (name: string) =>
    (s.tools.find(t => t.name === name)!.parameters as { properties: { dish: { enum: string[]; description: string } } }).properties.dish;

  it('adds add_dish and remove_dish after the kitchen tools', () => {
    expect(s.tools.map(t => t.name)).toEqual(['report_delay', 'shift_serve_time', 'restart_step', 'mark_done', 'kitchen_status', 'add_dish', 'remove_dish']);
    expect(s.tools.find(t => t.name === 'add_dish')!.description).toBe("Add a dish from the cook's recipe book to tonight's dinner. Re-plans every dish.");
    expect(s.tools.find(t => t.name === 'remove_dish')!.description).toBe("Drop a dish from tonight's dinner.");
  });

  it("widens the dish enum to tonight's dishes first, then the book, and says which is which", () => {
    const dish = dishParam('add_dish');
    expect(dish.enum.slice(0, 3)).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
    expect(dish.enum).toHaveLength(12);
    expect(new Set(dish.enum).size).toBe(12);
    expect(dish.description).toMatch(/^Tonight's dishes: chicken_curry = Chicken curry \(the "curry"\), .*garlic_naan = Garlic naan \(the "naan"\)\. /);
    expect(dish.description).toContain('dal_tadka = Dal tadka (the "dal")');
    expect(dishParam('report_delay')).toBe(dish);
  });

  it('lists the addable dishes as the recipe book, with the rule for anything else', () => {
    expect(s.system_prompt).toContain('Adding or dropping a dish:');
    expect(s.system_prompt).toMatch(/Recipe book \(dishes that can be added tonight\): roast potatoes, salmon, .*dal tadka, aloo gobi and roti\./);
    expect(s.system_prompt).not.toMatch(/Recipe book[^\n]*chicken curry/);
    expect(s.system_prompt).toContain('add it from the start screen');
  });

  it("keeps recipe notes: one line of ingredients per dish tonight", () => {
    expect(s.system_prompt).toContain('Recipe notes (ingredients for four');
    expect(s.system_prompt).toContain(`- Jeera rice: ${RECIPES.jeera_rice.ingredients!.join('; ')}.`);
    expect(s.system_prompt).not.toContain('- Dal tadka:');
  });

  it('leaves the book out when there is none, but keeps the notes', () => {
    const bare = buildSession(plan).system_prompt;
    expect(bare).not.toContain('Recipe book');
    expect(bare).not.toContain('add_dish');
    expect(bare).toContain('- Chicken curry: 700 g chicken thighs');
  });

  it("biases recognition to tonight's names and shorts, then the book's names, capped at 40", () => {
    expect(s.input!.keyterms!.slice(0, 9)).toEqual(['Hey Chef', 'Chef', 'Heard', 'Chicken curry', 'curry', 'Jeera rice', 'rice', 'Garlic naan', 'naan']);
    expect(s.input!.keyterms).toEqual(expect.arrayContaining(['Dal tadka', 'Aloo gobi', 'Spaghetti pomodoro']));
    const many: Recipe[] = Array.from({ length: 60 }, (_, i) => ({ ...RECIPES.roti, id: `my_r${i}`, name: `Roti number ${i}` }));
    const capped = buildSession(plan, many).input!.keyterms!;
    expect(capped).toHaveLength(40);
    expect(new Set(capped.map(k => k.toLowerCase())).size).toBe(40);
    expect(sttKeyterms(plan, many)).toHaveLength(40);
  });

  it('keeps cook-written text literal in the prompt', () => {
    const odd: Recipe = { ...RECIPES.roti, id: 'my_odd', name: 'Odd $& roti', ingredients: ['$1 of flour', "$' salt"] };
    const p = createPlan([odd], T0 + 45 * MIN, T0);
    const prompt = buildSession(p, [odd]).system_prompt;
    expect(prompt).toContain('Tonight: odd $& roti.');
    expect(prompt).toContain("- Odd $& roti: $1 of flour; $' salt.");
  });

  it('fills each placeholder once, even when cook-written text looks like one', () => {
    const odd: Recipe = { ...RECIPES.roti, id: 'my_odd', name: 'Odd roti', ingredients: ['{BOOK} flour', '{SERVE} salt'] };
    const prompt = buildSession(createPlan([odd], T0 + 45 * MIN, T0), [...BUILTIN_RECIPES, odd]).system_prompt;
    expect(prompt).toContain('- Odd roti: {BOOK} flour; {SERVE} salt.');
    expect(prompt.split('Adding or dropping a dish:')).toHaveLength(2);
    expect(prompt).toContain('Serving at 8:00 PM.');
    expect(prompt).not.toMatch(/^\{(MENU|SERVE|NOTES|BOOK)\}$/m);
  });

  it("marks the cook's own recipes in the notes, since they may not be for four", () => {
    const mine: Recipe = { ...RECIPES.roti, id: 'my_roti', name: "Nani's roti", custom: true };
    const prompt = buildSession(createPlan([mine, RECIPES.dal_tadka], T0 + 45 * MIN, T0), [mine]).system_prompt;
    expect(prompt).toContain("- Nani's roti (the cook's own recipe): 300 g chapati atta");
    expect(prompt).toContain('- Dal tadka: 250 g toor dal');
  });

  it('lists each dish once in the enum, even from a book with repeats', () => {
    const s2 = buildSession(plan, [...BUILTIN_RECIPES, RECIPES.salmon, RECIPES.chicken_curry]);
    const dish = (s2.tools[0].parameters as { properties: { dish: { enum: string[]; description: string } } }).properties.dish;
    expect(dish.enum).toHaveLength(12);
    expect(new Set(dish.enum).size).toBe(12);
    expect(dish.description.split('salmon = Salmon')).toHaveLength(2);
  });

  it("keeps tonight's own dishes in the enum when the book no longer has them", () => {
    const mine: Recipe = { ...RECIPES.roti, id: 'my_roti', name: "Nani's roti", custom: true };
    const s2 = buildSession(createPlan([mine], T0 + 45 * MIN, T0), BUILTIN_RECIPES);
    const dish = (s2.tools.find(t => t.name === 'remove_dish')!.parameters as { properties: { dish: { enum: string[] } } }).properties.dish;
    expect(dish.enum[0]).toBe('my_roti');
    expect(dish.enum).toHaveLength(13);
  });

  it('leaves out keyterms too long for the recognizer', () => {
    const long: Recipe = { ...RECIPES.roti, id: 'my_long', name: 'Grandma Kaur\'s slow-cooked Sunday rajma with extra ghee and love' };
    expect(long.name.length).toBeGreaterThan(50);
    expect(buildSession(plan, [long]).input!.keyterms).not.toContain(long.name);
    expect(sttKeyterms(plan, [long])).not.toContain(long.name);
    expect(buildSession(plan, [long]).system_prompt).toContain(long.name.toLowerCase());
  });
});
