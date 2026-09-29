import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  applySuggestion, draftToRecipe, emptyDraft, freshSuggestions, mergeIngredients, normalizeDraft, normalizeSuggestions,
  recipeToDraft, sameIngredient, totalMinutes, validateDraft, type RecipeDraft, type Suggestion,
} from './draft';
import { RECIPES } from './recipes';

const dal = (): RecipeDraft => ({
  name: 'Dal tadka',
  short: 'dal',
  kind: 'curry',
  steps: [
    { label: 'Rinse the dal', minutes: 3, call: 'Dal. Rinse it.' },
    { label: 'Pressure cook the dal', minutes: 15, call: 'Dal into the cooker.' },
    { label: 'Make the tadka', minutes: 5, call: 'Tadka on.' },
  ],
  ingredients: ['1 cup toor dal', 'ghee'],
});

afterEach(() => vi.useRealTimers());

describe('normalizeDraft', () => {
  it('trims, clamps minutes and fills defaults', () => {
    const d = normalizeDraft({
      name: '  Mom\'s Dal  ',
      kind: 'stew',
      steps: [
        { label: ' Rinse the dal ', minutes: 2.6, call: '  ' },
        { label: 'Pressure cook', minutes: 900 },
        { label: 'Rest', minutes: 0 },
        { label: 'Simmer', minutes: '12 min' },
        { label: '   ', minutes: 4 },
        { minutes: 4 },
      ],
      ingredients: [' ghee ', '', 'Ghee', 'cumin', 7],
    });
    expect(d.name).toBe("Mom's Dal");
    expect(d.short).toBe('dal');
    expect(d.kind).toBe('other');
    expect(d.steps).toEqual([
      { label: 'Rinse the dal', minutes: 3, call: 'Dal. Rinse the dal.' },
      { label: 'Pressure cook', minutes: 240, call: 'Dal. Pressure cook.' },
      { label: 'Rest', minutes: 1, call: 'Dal. Rest.' },
      { label: 'Simmer', minutes: 12, call: 'Dal. Simmer.' },
    ]);
    expect(d.ingredients).toEqual(['ghee', 'cumin', '7']);
  });

  it('defaults missing minutes to 5 and keeps the given short and kind', () => {
    const d = normalizeDraft({ name: 'Chana masala', short: ' Chana ', kind: 'curry', steps: [{ label: 'Soak chickpeas', call: 'Chana. Soak them.' }] });
    expect(d).toMatchObject({ short: 'chana', kind: 'curry', steps: [{ label: 'Soak chickpeas', minutes: 5, call: 'Chana. Soak them.' }] });
  });

  it('caps steps at 12 and ingredients at 20', () => {
    const d = normalizeDraft({
      name: 'Big one',
      steps: Array.from({ length: 15 }, (_, i) => ({ label: `Step ${i}`, minutes: 1 })),
      ingredients: Array.from({ length: 25 }, (_, i) => `thing ${i}`),
    });
    expect(d.steps).toHaveLength(12);
    expect(d.ingredients).toHaveLength(20);
  });

  it('accepts plain string steps and survives junk', () => {
    expect(normalizeDraft({ name: 'Toast', steps: ['Toast the bread'] }).steps).toEqual([{ label: 'Toast the bread', minutes: 5, call: 'Toast. Toast the bread.' }]);
    expect(normalizeDraft(null)).toEqual(emptyDraft());
    expect(normalizeDraft([1, 2])).toEqual(emptyDraft());
    expect(normalizeDraft({ steps: 'nope', ingredients: {} })).toEqual(emptyDraft());
    expect(normalizeDraft({ name: 'Toast', steps: [null, 7, [], { label: {} }, { label: 'Toast it', minutes: null, call: 3 }] }).steps)
      .toEqual([{ label: 'Toast it', minutes: 5, call: '3' }]);
  });

  it('clamps every kind of odd minutes', () => {
    const minutes = (m: unknown) => normalizeDraft({ name: 'X', steps: [{ label: 'Do it', minutes: m }] }).steps[0].minutes;
    expect([NaN, 'ten', '', true, {}, undefined].map(minutes)).toEqual([5, 5, 5, 5, 5, 5]);
    expect([-4, 0, 0.4, 1.5, '7', ' 20 minutes', 1e9, Infinity, -Infinity].map(minutes)).toEqual([1, 1, 1, 2, 7, 20, 240, 240, 1]);
  });

  it('reads the kind and short leniently, and a list sent as one string', () => {
    const d = normalizeDraft({ name: 'Dal tadka', short: ' Dal. ', kind: ' Curry ', steps: [], ingredients: '1 cup toor dal, ghee; cumin\nghee' });
    expect(d).toMatchObject({ short: 'dal', kind: 'curry', ingredients: ['1 cup toor dal', 'ghee', 'cumin'] });
    expect(normalizeDraft({ name: 'Paneer tikka!' }).short).toBe('tikka');
  });

  it('copes with a huge answer', () => {
    const d = normalizeDraft({
      name: 'Big',
      steps: [{ label: '' }, ...Array.from({ length: 5000 }, (_, i) => ({ label: `Step ${i}`, minutes: 1 }))],
      ingredients: Array.from({ length: 5000 }, (_, i) => `thing ${i}`),
    });
    expect(d.steps).toHaveLength(12);
    expect(d.steps[0].label).toBe('Step 0');
    expect(d.ingredients).toHaveLength(20);
  });
});

describe('normalizeSuggestions', () => {
  it('maps each action to a patch', () => {
    const s = normalizeSuggestions([
      { text: 'Soak the dal first.', action: 'add_step', step_label: 'Soak the dal', after_label: 'START', minutes: 30, call: 'Dal. Soak it.' },
      { text: 'Tadka needs only 3 minutes.', action: 'set_minutes', step_label: 'Make the tadka', minutes: 3 },
      { text: 'Add a pinch of hing.', action: 'add_ingredient', ingredient: 'pinch of hing' },
    ]);
    expect(s.map(x => x.patch)).toEqual([
      { type: 'add_step', after: null, step: { label: 'Soak the dal', minutes: 30, call: 'Dal. Soak it.' } },
      { type: 'set_minutes', step: 'Make the tadka', minutes: 3 },
      { type: 'add_ingredient', ingredient: 'pinch of hing' },
    ]);
    expect(new Set(s.map(x => x.id)).size).toBe(3);
  });

  it('gives tips, unknown actions and incomplete patches no patch', () => {
    const s = normalizeSuggestions([
      { text: 'Taste for salt.', action: 'tip' },
      { text: 'Try a pressure cooker.', action: 'buy_things' },
      { text: 'Simmer longer.', action: 'set_minutes', step_label: 'Simmer' },
    ]);
    expect(s).toHaveLength(3);
    expect(s.every(x => x.patch === undefined)).toBe(true);
  });

  it('keeps at most 3, drops empty and repeated texts, and gives stable ids', () => {
    const raw = [
      { text: '', action: 'tip' },
      { text: 'One', action: 'tip' },
      { text: 'one', action: 'tip' },
      { text: 'Two', action: 'tip' },
      'Three',
      { text: 'Four', action: 'tip' },
    ];
    const s = normalizeSuggestions(raw);
    expect(s.map(x => x.text)).toEqual(['One', 'Two', 'Three']);
    expect(normalizeSuggestions(raw).map(x => x.id)).toEqual(s.map(x => x.id));
    expect(normalizeSuggestions('nope')).toEqual([]);
  });

  it('a missing after_label is kept as a label that will not match (so the step goes last)', () => {
    const [s] = normalizeSuggestions([{ text: 'Garnish.', action: 'add_step', step_label: 'Garnish with coriander' }]);
    expect(s.patch).toMatchObject({ type: 'add_step', after: '' });
    expect(applySuggestion(dal(), s).steps.at(-1)?.label).toBe('Garnish with coriander');
  });
});

describe('applySuggestion', () => {
  const add = (after: string | null, label = 'Soak the dal'): Suggestion => ({ id: 'x', text: 't', patch: { type: 'add_step', after, step: { label, minutes: 30, call: '' } } });

  it('adds a step after a label matched case-insensitively, at the start for null, at the end if not found', () => {
    expect(applySuggestion(dal(), add('rinse THE dal')).steps.map(s => s.label)).toEqual(['Rinse the dal', 'Soak the dal', 'Pressure cook the dal', 'Make the tadka']);
    expect(applySuggestion(dal(), add(null)).steps[0].label).toBe('Soak the dal');
    expect(applySuggestion(dal(), add('Knead the dough')).steps.at(-1)?.label).toBe('Soak the dal');
  });

  it('falls back to a substring match and fills in the spoken call', () => {
    const d = applySuggestion(dal(), add('pressure cook'));
    expect(d.steps[2]).toEqual({ label: 'Soak the dal', minutes: 30, call: 'Dal. Soak the dal.' });
  });

  it('sets minutes on a matching step, or returns the draft unchanged', () => {
    const d = dal();
    const s = (step: string, minutes: number): Suggestion => ({ id: 'x', text: 't', patch: { type: 'set_minutes', step, minutes } });
    expect(applySuggestion(d, s('tadka', 3)).steps[2].minutes).toBe(3);
    expect(applySuggestion(d, s('Bake the bread', 3))).toBe(d);
    expect(applySuggestion(d, s('Make the tadka', 5))).toBe(d);
  });

  it('adds an ingredient only if it is not there yet', () => {
    const d = dal();
    const s = (ingredient: string): Suggestion => ({ id: 'x', text: 't', patch: { type: 'add_ingredient', ingredient } });
    expect(applySuggestion(d, s('pinch of hing')).ingredients).toEqual(['1 cup toor dal', 'ghee', 'pinch of hing']);
    expect(applySuggestion(d, s('Ghee'))).toBe(d);
    expect(applySuggestion(d, s('2 tbsp ghee'))).toBe(d);
  });

  it('does not grow a card past 12 steps or 20 ingredients', () => {
    const full = { ...dal(), steps: Array.from({ length: 12 }, (_, i) => ({ label: `Step ${i}`, minutes: 1, call: '' })) };
    expect(applySuggestion(full, add(null))).toBe(full);
    const stocked = { ...dal(), ingredients: Array.from({ length: 20 }, (_, i) => `spice ${String.fromCharCode(97 + i)}`) };
    expect(applySuggestion(stocked, { id: 'x', text: 't', patch: { type: 'add_ingredient', ingredient: 'hing' } })).toBe(stocked);
    expect(freshSuggestions(full, [add(null)])).toEqual([]);
  });

  it('a tip changes nothing and the input is never mutated', () => {
    const d = dal();
    const before = JSON.stringify(d);
    expect(applySuggestion(d, { id: 'x', text: 'Taste it.' })).toBe(d);
    applySuggestion(d, add(null));
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe('freshSuggestions', () => {
  it('drops the "tell me the steps" tip once the card has steps', () => {
    const tip = normalizeSuggestions([{ text: "Tell me the steps and I'll time them.", action: 'tip' }]);
    expect(freshSuggestions(dal(), tip)).toEqual([]);
    expect(freshSuggestions({ ...dal(), steps: [] }, tip)).toHaveLength(1);
  });

  it('drops dismissed texts and patches that would change nothing', () => {
    const s = normalizeSuggestions([
      { text: 'Add ghee.', action: 'add_ingredient', ingredient: 'ghee' },
      { text: 'Rinse first.', action: 'add_step', step_label: 'Rinse the dal' },
      { text: 'Taste for salt.', action: 'tip' },
    ]);
    expect(freshSuggestions(dal(), s).map(x => x.text)).toEqual(['Taste for salt.']);
    expect(freshSuggestions(dal(), s, ['taste for salt.'])).toEqual([]);
  });

  it('drops a dismissed idea that comes back in other words, but keeps new ones', () => {
    const s = normalizeSuggestions([
      { text: 'Add salt to the water for more flavour.', action: 'add_ingredient', ingredient: '1 tsp salt' },
      { text: 'Let the dal rest for 5 minutes.', action: 'add_step', step_label: 'Rest the dal', minutes: 5 },
      { text: 'Bloom the cumin until it crackles.', action: 'tip' },
      { text: 'Squeeze in lemon at the end.', action: 'add_ingredient', ingredient: 'half a lemon' },
    ], 6);
    const dismissed = ['Add salt to season the dal.', 'Rest the dal after cooking so it thickens.', 'Cumin should bloom till it crackles!'];
    expect(freshSuggestions(dal(), s, dismissed).map(x => x.text)).toEqual(['Squeeze in lemon at the end.']);
  });

  it('catches a reworded tip but not a different idea about the same dish', () => {
    const rice = { ...dal(), name: 'Jeera rice', short: 'rice' };
    const s = normalizeSuggestions([
      { text: 'Let the rice rest for five minutes after cooking to help it fluff up.', action: 'tip' },
      { text: 'Rinse the rice before cooking to remove excess starch.', action: 'tip' },
    ]);
    const dismissed = ['Let the rice rest for 5 minutes after cooking to make it fluffier.'];
    expect(freshSuggestions(rice, s, dismissed).map(x => x.text)).toEqual(['Rinse the rice before cooking to remove excess starch.']);
  });
});

describe('validateDraft and totalMinutes', () => {
  it('passes a good draft', () => {
    expect(validateDraft(dal())).toEqual([]);
    expect(totalMinutes(dal())).toBe(23);
  });

  it('explains what blocks saving', () => {
    expect(validateDraft(emptyDraft())).toEqual(['Give the recipe a name.', 'Add at least one step.']);
    const d = dal();
    d.steps[1] = { ...d.steps[1], label: ' ' };
    expect(validateDraft(d)).toEqual(['Every step needs a name.']);
    const long = { ...dal(), steps: [{ label: 'Braise', minutes: 240, call: '' }, { label: 'Rest', minutes: 121, call: '' }] };
    expect(validateDraft(long)).toEqual(['Total time is over 6 hours.']);
  });
});

describe('draftToRecipe and recipeToDraft', () => {
  it('builds a custom recipe with step ids, plate art and a timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_790_000_000_000);
    const r = draftToRecipe({ ...dal(), steps: [...dal().steps, { label: 'Garnish', minutes: 1, call: ' ' }] }, 'my_dal_tadka', { basedOn: 'dal_tadka' });
    expect(r).toMatchObject({
      id: 'my_dal_tadka', name: 'Dal tadka', short: 'dal', kind: 'curry', photo: '/dishes/kinds/curry.svg',
      custom: true, basedOn: 'dal_tadka', updatedAt: 1_790_000_000_000, ingredients: ['1 cup toor dal', 'ghee'],
    });
    expect(r.steps.map(s => s.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect(r.steps[3]).toEqual({ id: 's4', label: 'Garnish', call: 'Dal. Garnish.', minutes: 1 });
    expect('basedOn' in draftToRecipe(dal(), 'my_dal')).toBe(false);
  });

  it('cleans the short and survives a step a hand edit left incomplete', () => {
    const d = { ...dal(), short: ' Dal! ', steps: [{ label: 'Rinse', minutes: Number.NaN, call: undefined as unknown as string }, { label: undefined as unknown as string, minutes: 3, call: '' }] };
    const r = draftToRecipe(d, 'my_dal');
    expect(r.short).toBe('dal');
    expect(r.steps).toEqual([{ id: 's1', label: 'Rinse', call: 'Dal. Rinse.', minutes: 5 }]);
  });

  it('round-trips a built-in recipe', () => {
    const curry = RECIPES.chicken_curry;
    const d = recipeToDraft(curry);
    expect(d.steps.map(s => s.minutes)).toEqual(curry.steps.map(s => s.minutes));
    const r = draftToRecipe(d, 'my_chicken_curry', { basedOn: curry.id });
    expect(r.steps.map(({ label, call, minutes }) => ({ label, call, minutes }))).toEqual(curry.steps.map(({ label, call, minutes }) => ({ label, call, minutes })));
    expect(r.photo).toBe('/dishes/kinds/curry.svg');
    d.steps[0].minutes = 99;
    expect(curry.steps[0].minutes).toBe(8);
  });
});

describe('mergeIngredients', () => {
  it('keeps the card\'s ingredients as written and adds only new ones', () => {
    expect(mergeIngredients(['1 cup toor dal', 'ghee', 'hing'], ['toor dal', '2 tbsp ghee', 'fried onions', 'Fried onions'])).toEqual(['1 cup toor dal', 'ghee', 'hing', 'fried onions']);
    expect(mergeIngredients([], ['salt'])).toEqual(['salt']);
    expect(mergeIngredients(Array.from({ length: 20 }, (_, i) => `x${i}`), ['salt'])).toHaveLength(20);
  });
});

describe('sameIngredient', () => {
  it('ignores quantities, units and plurals', () => {
    expect(sameIngredient('turmeric', '1 tsp turmeric')).toBe(true);
    expect(sameIngredient('2 onions', 'onion')).toBe(true);
    expect(sameIngredient('green chillies', '3 green chilli')).toBe(true);
    expect(sameIngredient('cumin seeds', '1 tsp cumin seeds')).toBe(true);
    expect(sameIngredient('tomatoes', '2 tomato')).toBe(true);
  });

  it('keeps different ingredients apart', () => {
    expect(sameIngredient('salt', 'salted butter')).toBe(false);
    expect(sameIngredient('green chillies', 'chilli powder')).toBe(false);
    expect(sameIngredient('cumin seeds', 'mustard seeds')).toBe(false);
    expect(sameIngredient('1 cup', '2 cups')).toBe(false);
  });
});
