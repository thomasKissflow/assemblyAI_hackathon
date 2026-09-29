import { describe, it, expect, afterAll } from 'vitest';
import { appendFileSync } from 'node:fs';
import { Scribe } from './scribe';
import { DISH_KINDS } from '../kitchen/recipes';
import { applySuggestion, totalMinutes, type RecipeDraft } from '../kitchen/draft';

const KEY = process.env.AAI_KEY;
/** SCRIBE_LOG=<file> appends each answer to that file, for tuning the prompt. */
const LOG = process.env.SCRIBE_LOG
  ? (label: string, x: unknown) => appendFileSync(process.env.SCRIBE_LOG!, `${label} ${JSON.stringify(x)}\n`)
  : () => {};

const DAL = `My mom's dal. Wash one cup of toor dal and pressure cook it with turmeric and salt, about 3 whistles. Meanwhile chop onion, tomato, garlic and green chillies. Heat ghee, add cumin and mustard seeds, then garlic, onion till golden, then tomato till soft. Mix in the cooked dal and simmer. Finish with coriander and a squeeze of lemon.`;

const DAL_CARD: RecipeDraft = {
  name: "Mom's dal",
  short: 'dal',
  kind: 'curry',
  steps: [
    { label: 'Rinse the toor dal', minutes: 3, call: 'Dal. Rinse it till the water runs clear.' },
    { label: 'Pressure cook the dal', minutes: 15, call: 'Dal into the pressure cooker with turmeric and salt.' },
    { label: 'Fry the tadka', minutes: 12, call: 'Ghee on. Cumin, mustard seeds, garlic, then onion and tomato.' },
    { label: 'Simmer the dal', minutes: 7, call: 'Dal into the tadka. Down to a simmer.' },
  ],
  ingredients: ['1 cup toor dal', 'turmeric', 'salt', 'ghee', 'cumin seeds', 'onion', 'tomato'],
};

const THIN: RecipeDraft = {
  name: 'Jeera rice',
  short: 'rice',
  kind: 'rice',
  steps: [
    { label: 'Fry cumin in ghee', minutes: 2, call: 'Rice. Cumin into hot ghee.' },
    { label: 'Cook the rice', minutes: 15, call: 'Rice and water in. Lid on.' },
  ],
  ingredients: ['1 cup basmati rice', 'ghee', 'cumin seeds'],
};

const labelOk = (l: string) => /^[A-Z]/.test(l) && l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 7;

describe.runIf(!!KEY)('Chef scribe (live AssemblyAI)', () => {
  const scribe = new Scribe(KEY ?? '');
  afterAll(() => scribe.close());

  it('formats a rough dal recipe into timed steps', async () => {
    const { draft, suggestions } = await scribe.format(DAL);
    LOG('dal', { draft, suggestions });
    expect(draft.short).toBe('dal');
    expect(draft.kind).toBe('curry');
    expect(DISH_KINDS).toContain(draft.kind);
    expect(draft.steps.length).toBeGreaterThanOrEqual(3);
    expect(draft.steps.length).toBeLessThanOrEqual(7);
    for (const s of draft.steps) {
      expect(labelOk(s.label), s.label).toBe(true);
      expect(s.minutes).toBeGreaterThanOrEqual(1);
      expect(s.minutes).toBeLessThanOrEqual(30);
      expect(s.call.length).toBeGreaterThan(5);
    }
    const cook = draft.steps.find(s => /pressure|cook|boil/i.test(s.label));
    expect(cook?.minutes).toBeGreaterThanOrEqual(8);
    expect(totalMinutes(draft)).toBeGreaterThanOrEqual(20);
    expect(totalMinutes(draft)).toBeLessThanOrEqual(75);
    expect(draft.steps[0].call).toMatch(/^dal\b/i);
    expect(draft.ingredients.some(i => /toor dal/i.test(i))).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  }, 30_000);

  it('suggests a few useful, non-duplicate improvements for a thin card', async () => {
    const suggestions = await scribe.suggest(THIN, []);
    LOG('thin', suggestions);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(new Set(suggestions.map(s => s.text.toLowerCase())).size).toBe(suggestions.length);
    expect(suggestions.some(s => s.patch)).toBe(true);
    for (const s of suggestions) {
      expect(s.text).not.toMatch(/enjoy/i);
      if (s.patch) expect(applySuggestion(THIN, s)).not.toBe(THIN);
    }
  }, 30_000);

  it('does not repeat a dismissed suggestion', async () => {
    const first = await scribe.suggest(THIN, []);
    const dismissed = first.map(s => s.text);
    const again = await scribe.suggest(THIN, dismissed);
    LOG('dismissed', { dismissed, again });
    for (const s of again) expect(dismissed.map(t => t.toLowerCase())).not.toContain(s.text.toLowerCase());
  }, 40_000);

  it('makes no recipe out of text that is not one, and asks for the steps', async () => {
    const { draft, suggestions } = await scribe.format("what's the cricket score");
    LOG('cricket', { draft, suggestions });
    expect(draft.steps).toHaveLength(0);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].patch).toBeUndefined();
  }, 30_000);

  it('merges new text into the card and keeps the cook\'s steps', async () => {
    const { draft } = await scribe.format('Then garnish with fried onions.', DAL_CARD);
    LOG('merge', draft);
    expect(draft.name).toBe(DAL_CARD.name);
    const labels = draft.steps.map(s => s.label.toLowerCase());
    for (const s of DAL_CARD.steps) expect(labels).toContain(s.label.toLowerCase());
    const kept = DAL_CARD.steps.map(s => draft.steps.find(d => d.label.toLowerCase() === s.label.toLowerCase())!);
    expect(kept.map(s => s.minutes)).toEqual(DAL_CARD.steps.map(s => s.minutes));
    expect(labels.indexOf(DAL_CARD.steps[0].label.toLowerCase())).toBeLessThan(labels.indexOf(DAL_CARD.steps[3].label.toLowerCase()));
    expect(draft.steps.length).toBe(DAL_CARD.steps.length + 1);
    expect(draft.steps.at(-1)?.label).toMatch(/garnish|onion/i);
  }, 30_000);

  it('cleans up a dictated recipe', async () => {
    const said = 'um okay so this is my jeera rice. uh wash the basmati and soak it for twenty minutes. then heat ghee and add jeera, then add the rice and water and cook it covered for fifteen minutes. um yeah let it rest five minutes';
    const { draft } = await scribe.format(said, undefined, 'said');
    LOG('said', draft);
    expect(draft.short).toBe('rice');
    expect(draft.kind).toBe('rice');
    expect(draft.steps.length).toBeGreaterThanOrEqual(3);
    expect(draft.steps.map(s => s.label).join(' ')).not.toMatch(/\bum\b|\buh\b/i);
    expect(draft.steps.find(s => /soak/i.test(s.label))?.minutes).toBe(20);
  }, 30_000);
});
