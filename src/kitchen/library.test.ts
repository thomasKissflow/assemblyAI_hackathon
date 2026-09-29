import { afterEach, describe, it, expect, vi } from 'vitest';
import { BUILTIN_MENUS, BUILTIN_RECIPES, type Menu, type Recipe } from './recipes';
import {
  LIBRARY_KEY, browserStorage, createLibraryStore, findRecipe, libraryStore, menuDishes, newMenuId, newRecipeId, type Library,
} from './library';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
}

const dal = (over: Partial<Recipe> = {}): Recipe => ({
  id: 'my_mums_dal', name: "Mum's dal", short: 'dal', photo: 'ignored.jpg', kind: 'curry',
  steps: [
    { id: 's1', label: 'Rinse the dal', call: 'Dal. Rinse it.', minutes: 3 },
    { id: 's2', label: 'Boil the dal', call: 'Dal on to boil.', minutes: 25 },
  ],
  ingredients: ['250 g toor dal'],
  ...over,
});
const lib = (recipes: Partial<Recipe>[] = [], menus: Partial<Menu>[] = []): Library => ({
  recipes: [...BUILTIN_RECIPES, ...recipes.map(r => dal(r))],
  menus: [...BUILTIN_MENUS, ...menus.map(m => ({ id: 'x', label: 'x', dishes: [], ...m }))],
});

describe('ids', () => {
  it('slugs recipe names into my_ ids', () => {
    expect(newRecipeId("Mum's Dal!", lib())).toBe('my_mum_s_dal');
    expect(newRecipeId('Crème brûlée', lib())).toBe('my_creme_brulee');
    expect(newRecipeId('   ', lib())).toBe('my_untitled');
  });
  it('caps the slug at 24 characters without a trailing underscore', () => {
    const id = newRecipeId('Slow roasted pork shoulder with apple sauce', lib());
    expect(id).toBe('my_slow_roasted_pork_should');
    expect(id.length).toBeLessThanOrEqual(3 + 24);
    expect(newRecipeId('abcdefghijklmnopqrstuvw xyz', lib())).toBe('my_abcdefghijklmnopqrstuvw');
  });
  it('adds _2, _3… on collision', () => {
    expect(newRecipeId("Mum's dal", lib([{ id: 'my_mum_s_dal' }]))).toBe('my_mum_s_dal_2');
    expect(newRecipeId("Mum's dal", lib([{ id: 'my_mum_s_dal' }, { id: 'my_mum_s_dal_2' }]))).toBe('my_mum_s_dal_3');
  });
  it('slugs menu labels into menu_ ids, with suffixes on collision', () => {
    expect(newMenuId('Sunday lunch', lib())).toBe('menu_sunday_lunch');
    expect(newMenuId('Sunday lunch', lib([], [{ id: 'menu_sunday_lunch' }]))).toBe('menu_sunday_lunch_2');
  });
});

describe('library store', () => {
  it('starts with the built-ins, built-ins first', () => {
    const s = createLibraryStore(new MemoryStorage());
    expect(s.getState().recipes).toEqual(BUILTIN_RECIPES);
    expect(s.getState().menus).toEqual(BUILTIN_MENUS);
    expect(s.getState().menus.map(m => m.id)).toEqual(['indian', 'western', 'pasta', 'veg']);
  });

  it("saves the cook's recipe as custom with its kind's plate art, after the built-ins", () => {
    const s = createLibraryStore(new MemoryStorage());
    const saved = s.saveRecipe(dal());
    expect(saved).toMatchObject({ id: 'my_mums_dal', custom: true, photo: '/dishes/kinds/curry.svg', short: 'dal' });
    expect(saved.updatedAt).toBeGreaterThan(0);
    expect(s.getState().recipes.at(-1)).toEqual(saved);
    expect(s.getState().recipes.slice(0, BUILTIN_RECIPES.length)).toEqual(BUILTIN_RECIPES);
  });

  it('replaces a recipe saved again under the same id', () => {
    const s = createLibraryStore(new MemoryStorage());
    s.saveRecipe(dal());
    s.saveRecipe(dal({ name: "Mum's dal, extra garlic" }));
    const mine = s.getState().recipes.filter(r => r.custom);
    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe("Mum's dal, extra garlic");
  });

  it('never overwrites a built-in: a built-in id gets a fresh my_ id', () => {
    const s = createLibraryStore(new MemoryStorage());
    const saved = s.saveRecipe(dal({ id: 'dal_tadka', name: 'Dal tadka', basedOn: 'dal_tadka' }));
    expect(saved.id).toBe('my_dal_tadka');
    expect(saved.basedOn).toBe('dal_tadka');
    expect(findRecipe(s.getState(), 'dal_tadka')).toBe(BUILTIN_RECIPES.find(r => r.id === 'dal_tadka'));
  });

  it('refuses a recipe with no steps', () => {
    const s = createLibraryStore(new MemoryStorage());
    expect(() => s.saveRecipe(dal({ steps: [] }))).toThrow(/at least one step/);
    expect(s.getState().recipes).toEqual(BUILTIN_RECIPES);
  });

  it('persists to localStorage as version 1, holding only custom entries', () => {
    const storage = new MemoryStorage();
    const s = createLibraryStore(storage);
    s.saveRecipe(dal());
    s.saveMenu({ id: 'menu_dal_night', label: 'Dal night', dishes: ['my_mums_dal', 'roti'] });
    const data = JSON.parse(storage.getItem(LIBRARY_KEY)!);
    expect(data.version).toBe(1);
    expect(data.recipes.map((r: Recipe) => r.id)).toEqual(['my_mums_dal']);
    expect(data.menus.map((m: Menu) => m.id)).toEqual(['menu_dal_night']);
  });

  it('loads what was saved last time', () => {
    const storage = new MemoryStorage();
    const first = createLibraryStore(storage);
    const recipe = first.saveRecipe(dal());
    const menu = first.saveMenu({ id: 'menu_dal_night', label: 'Dal night', dishes: ['my_mums_dal', 'roti'] });
    const again = createLibraryStore(storage).getState();
    expect(again.recipes.at(-1)).toEqual(recipe);
    expect(again.menus.at(-1)).toEqual(menu);
    expect(menuDishes(again, again.menus.at(-1)!).map(r => r.name)).toEqual(["Mum's dal", 'Roti']);
  });

  it.each([
    ['corrupt JSON', '{"version":1,"recipes":[{'],
    ['the wrong version', JSON.stringify({ version: 2, recipes: [dal()], menus: [] })],
    ['not an object', '"hello"'],
    ['junk entries', JSON.stringify({ version: 1, recipes: [null, 7, { id: 'my_x' }, { id: 'my_y', name: 'Y', steps: [] }], menus: [{ id: 'm' }] })],
  ])('treats %s as an empty book plus the built-ins', (_, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(LIBRARY_KEY, raw);
    const s = createLibraryStore(storage);
    expect(s.getState()).toEqual({ recipes: BUILTIN_RECIPES, menus: BUILTIN_MENUS });
  });

  it('cleans what it loads: plate art, known kinds, no built-in ids, no dangling menu dishes', () => {
    const storage = new MemoryStorage();
    storage.setItem(LIBRARY_KEY, JSON.stringify({
      version: 1,
      recipes: [
        { ...dal(), photo: 'https://example.com/x.jpg', kind: 'spaceship', custom: false },
        { ...dal(), id: 'salmon', name: 'Fake salmon' },
        { ...dal(), name: 'Duplicate id' },
      ],
      menus: [
        { id: 'menu_a', label: 'A', dishes: ['my_mums_dal', 'my_gone', 'roti', 'roti'] },
        { id: 'menu_b', label: 'B', dishes: ['my_gone'] },
        { id: 'indian', label: 'Fake Indian', dishes: ['roti'] },
      ],
    }));
    const { recipes, menus } = createLibraryStore(storage).getState();
    const mine = recipes.filter(r => r.custom);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: 'my_mums_dal', name: "Mum's dal", kind: 'other', photo: '/dishes/kinds/other.svg' });
    expect(findRecipe({ recipes, menus }, 'salmon')!.name).toBe('Salmon');
    expect(menus.filter(m => m.custom)).toEqual([{ id: 'menu_a', label: 'A', dishes: ['my_mums_dal', 'roti'], custom: true }]);
  });

  it('works in memory without storage', () => {
    const s = createLibraryStore(null);
    expect(s.saveRecipe(dal()).id).toBe('my_mums_dal');
    expect(s.getState().recipes.at(-1)!.name).toBe("Mum's dal");
    expect(createLibraryStore().getState().recipes).toEqual(BUILTIN_RECIPES);
  });

  it('survives storage that throws on read and on write', () => {
    const broken = new MemoryStorage();
    broken.getItem = () => { throw new Error('SecurityError'); };
    broken.setItem = () => { throw new Error('QuotaExceededError'); };
    const s = createLibraryStore(broken);
    expect(s.getState().recipes).toEqual(BUILTIN_RECIPES);
    s.saveRecipe(dal());
    expect(s.getState().recipes.at(-1)!.id).toBe('my_mums_dal');
  });

  it('deleting a recipe removes it from custom menus and drops menus left empty', () => {
    const s = createLibraryStore(new MemoryStorage());
    s.saveRecipe(dal());
    s.saveRecipe(dal({ id: 'my_rice', name: 'My rice', kind: 'rice' }));
    s.saveMenu({ id: 'menu_mixed', label: 'Mixed', dishes: ['my_mums_dal', 'roti'] });
    s.saveMenu({ id: 'menu_only_dal', label: 'Only dal', dishes: ['my_mums_dal'] });
    s.saveMenu({ id: 'menu_rice', label: 'Rice', dishes: ['my_rice'] });
    s.deleteRecipe('my_mums_dal');
    const { recipes, menus } = s.getState();
    expect(recipes.filter(r => r.custom).map(r => r.id)).toEqual(['my_rice']);
    expect(menus.filter(m => m.custom).map(m => [m.id, m.dishes])).toEqual([['menu_mixed', ['roti']], ['menu_rice', ['my_rice']]]);
  });

  it("can't delete a built-in recipe or menu", () => {
    const s = createLibraryStore(new MemoryStorage());
    const fn = vi.fn();
    s.subscribe(fn);
    s.deleteRecipe('chicken_curry');
    s.deleteMenu('indian');
    expect(s.getState()).toEqual({ recipes: BUILTIN_RECIPES, menus: BUILTIN_MENUS });
    expect(fn).not.toHaveBeenCalled();
  });

  it('saves menus with only known, unique dishes; a built-in id gets a fresh id; nothing known means not saved', () => {
    const s = createLibraryStore(new MemoryStorage());
    expect(s.saveMenu({ id: 'indian', label: 'Indian dinner', dishes: ['roti', 'roti', 'my_gone', 'dal_tadka'] }))
      .toEqual({ id: 'menu_indian_dinner', label: 'Indian dinner', dishes: ['roti', 'dal_tadka'], custom: true });
    expect(s.saveMenu({ id: 'menu_x', label: 'X', dishes: ['my_gone'] })).toBeNull();
    expect(s.getState().menus.filter(m => m.custom).map(m => m.id)).toEqual(['menu_indian_dinner']);
  });

  it('replaces a menu saved again under the same id, and deletes menus', () => {
    const s = createLibraryStore(new MemoryStorage());
    s.saveMenu({ id: 'menu_a', label: 'A', dishes: ['roti'] });
    s.saveMenu({ id: 'menu_a', label: 'A again', dishes: ['roti', 'dal_tadka'] });
    expect(s.getState().menus.filter(m => m.custom)).toEqual([{ id: 'menu_a', label: 'A again', dishes: ['roti', 'dal_tadka'], custom: true }]);
    s.deleteMenu('menu_a');
    expect(s.getState().menus).toEqual(BUILTIN_MENUS);
  });

  it('notifies subscribers on every change, keeps state stable between changes, and unsubscribes', () => {
    const s = createLibraryStore(new MemoryStorage());
    const fn = vi.fn();
    const off = s.subscribe(fn);
    const before = s.getState();
    expect(s.getState()).toBe(before);
    s.saveRecipe(dal());
    s.saveMenu({ id: 'menu_a', label: 'A', dishes: ['my_mums_dal'] });
    s.deleteMenu('menu_a');
    s.deleteRecipe('my_mums_dal');
    expect(fn).toHaveBeenCalledTimes(4);
    expect(s.getState()).not.toBe(before);
    off();
    s.saveRecipe(dal());
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('clear forgets everything the cook saved', () => {
    const storage = new MemoryStorage();
    const s = createLibraryStore(storage);
    s.saveRecipe(dal());
    s.clear();
    expect(createLibraryStore(storage).getState()).toEqual({ recipes: BUILTIN_RECIPES, menus: BUILTIN_MENUS });
  });
});

describe('library edge cases', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('trims ids before checking them, so padding never sneaks in a built-in id or a duplicate', () => {
    const s = createLibraryStore(new MemoryStorage());
    expect(s.saveRecipe(dal({ id: ' salmon ' })).id).toBe('my_mum_s_dal');
    expect(s.saveRecipe(dal({ id: ' my_mum_s_dal ', name: 'Dal again' })).id).toBe('my_mum_s_dal');
    expect(s.getState().recipes.filter(r => r.id === 'salmon')).toEqual([BUILTIN_RECIPES.find(r => r.id === 'salmon')]);
    expect(s.getState().recipes.filter(r => r.custom).map(r => [r.id, r.name])).toEqual([['my_mum_s_dal', 'Dal again']]);
    expect(s.saveMenu({ id: ' indian ', label: 'My Indian', dishes: ['roti'] })!.id).toBe('menu_my_indian');
  });

  it('gives every step an id unique in the recipe, and keeps minutes whole and sane', () => {
    const s = createLibraryStore(new MemoryStorage());
    const saved = s.saveRecipe(dal({
      steps: [
        { id: 'a', label: 'Soak', call: '', minutes: 29.6 },
        { id: 'a', label: 'Boil', call: 'Boil it.', minutes: 9999 },
        { id: '', label: 'Temper', call: 'Tadka.', minutes: 4 },
        { id: 'x', label: 'Nothing', call: '', minutes: 0 },
        { id: 'y', label: '   ', call: '', minutes: 5 },
      ],
    }));
    expect(saved.steps).toEqual([
      { id: 'a', label: 'Soak', call: 'Soak.', minutes: 30 },
      { id: 'a_2', label: 'Boil', call: 'Boil it.', minutes: 240 },
      { id: 's3', label: 'Temper', call: 'Tadka.', minutes: 4 },
    ]);
  });

  it('stamps updatedAt on every save', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const s = createLibraryStore(new MemoryStorage());
    vi.setSystemTime(1_000_000);
    expect(s.saveRecipe(dal({ updatedAt: 5 })).updatedAt).toBe(1_000_000);
    vi.setSystemTime(2_000_000);
    expect(s.saveRecipe(dal()).updatedAt).toBe(2_000_000);
  });

  it("stores a copy: changing the cook's object afterwards doesn't touch the book", () => {
    const s = createLibraryStore(new MemoryStorage());
    const input = dal();
    s.saveRecipe(input);
    input.steps[0].minutes = 99;
    input.ingredients!.push('a whole cow');
    const mine = findRecipe(s.getState(), 'my_mums_dal')!;
    expect(mine.steps[0].minutes).toBe(3);
    expect(mine.ingredients).toEqual(['250 g toor dal']);
  });

  it("doesn't save a menu without a label, or notify for no-op deletes", () => {
    const s = createLibraryStore(new MemoryStorage());
    const fn = vi.fn();
    s.subscribe(fn);
    expect(s.saveMenu({ id: 'menu_x', label: '  ', dishes: ['roti'] })).toBeNull();
    s.deleteRecipe('my_nothing');
    s.deleteMenu('menu_nothing');
    expect(fn).not.toHaveBeenCalled();
    expect(s.getState().menus).toEqual(BUILTIN_MENUS);
  });

  it('finds localStorage when the browser has it, and falls back to none', () => {
    expect(browserStorage()).toBeNull();
    const storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    expect(browserStorage()).toBe(storage);
    vi.stubGlobal('window', { get localStorage(): Storage { throw new Error('SecurityError'); } });
    expect(browserStorage()).toBeNull();
  });

  it('the app-wide book works without a browser (memory only)', () => {
    expect(libraryStore.getState().recipes).toEqual(BUILTIN_RECIPES);
    const saved = libraryStore.saveRecipe(dal());
    try {
      expect(findRecipe(libraryStore.getState(), saved.id)).toEqual(saved);
    } finally {
      libraryStore.clear();
    }
    expect(libraryStore.getState().recipes).toEqual(BUILTIN_RECIPES);
  });
});
