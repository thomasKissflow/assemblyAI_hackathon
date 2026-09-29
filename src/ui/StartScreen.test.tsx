// @vitest-environment jsdom
import { BUILTIN_RECIPES, RECIPES, kindPhoto, menuRecipes, type Recipe } from '../kitchen/recipes';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartScreen } from './StartScreen';
import { createKitchenStore } from '../kitchen/store';
import { libraryStore } from '../kitchen/library';
import { CaptionFeed } from '../voice/captionFeed';
import type { ChefSession } from '../voice/useChefSession';
import type { RecipeStudioProps } from './RecipeStudio';

// The studio is its own component (and its own tests): here it only records what the start screen asked of it.
const studio = vi.hoisted(() => ({ props: null as RecipeStudioProps | null }));
vi.mock('./RecipeStudio', () => ({
  RecipeStudio: (p: RecipeStudioProps) => {
    studio.props = p;
    return p.open ? <div role="dialog" aria-label="Recipe studio" /> : null;
  },
}));

afterEach(() => {
  libraryStore.clear();
  studio.props = null;
});

function fakeSession(overrides: Partial<ChefSession> = {}): ChefSession {
  return {
    phase: 'idle', error: null, wakeCount: 0, captions: new CaptionFeed(),
    voice: { ears: 'asleep', pushToTalk: false, userSpeaking: false, chefSpeaking: false, muted: false },
    start: vi.fn(), stop: vi.fn(), announce: vi.fn(), setPushToTalk: vi.fn(), toggleMute: vi.fn(),
    levels: () => ({ mic: 0, out: 0 }), audioTime: () => 0,
    ...overrides,
  } as unknown as ChefSession;
}

describe('StartScreen', () => {
  const store = createKitchenStore(() => 0);
  const setup = store.getState();

  it("previews tonight's first calls and updates with the menu", async () => {
    render(<StartScreen state={setup} session={fakeSession()} hasKey onPrepare={vi.fn()} onBegin={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('plan-preview')).toHaveTextContent('7:22');
    await userEvent.click(screen.getByTestId('menu-western'));
    expect(screen.getByTestId('plan-preview')).toHaveTextContent(/potatoes/i);
  });

  it('continues with voice, or cooks without it', async () => {
    const onPrepare = vi.fn();
    render(<StartScreen state={setup} session={fakeSession()} hasKey onPrepare={onPrepare} onBegin={vi.fn()} onBack={vi.fn()} />);
    await userEvent.click(screen.getByTestId('serve-in-60'));
    await userEvent.click(screen.getByTestId('start-continue'));
    expect(onPrepare).toHaveBeenLastCalledWith(menuRecipes('indian'), 'Indian dinner', 60, true);
    await userEvent.click(screen.getByTestId('start-cook-without-voice'));
    expect(onPrepare).toHaveBeenLastCalledWith(menuRecipes('indian'), 'Indian dinner', 60, false);
  });

  it('explains a missing key and blocks voice start', () => {
    render(<StartScreen state={setup} session={fakeSession()} hasKey={false} onPrepare={vi.fn()} onBegin={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('start-continue')).toBeDisabled();
    expect(screen.getByText(/VITE_ASSEMBLYAI_API_KEY/)).toBeInTheDocument();
  });

  describe('menu builder', () => {
    const start = (props: Partial<Parameters<typeof StartScreen>[0]> = {}) => {
      const onPrepare = vi.fn();
      render(<StartScreen state={setup} session={fakeSession()} hasKey onPrepare={onPrepare} onBegin={vi.fn()} onBack={vi.fn()} {...props} />);
      return { onPrepare, user: userEvent.setup() };
    };
    const tonightIds = () => screen.queryAllByTestId(/^tonight-(?!empty)/).map(el => el.dataset.testid!.replace('tonight-', ''));
    const mine = (over: Partial<Recipe> = {}): Recipe => ({
      id: '', name: "Mum's dal", short: 'dal', photo: kindPhoto('curry'), kind: 'curry', custom: true,
      steps: [
        { id: 's1', label: 'Rinse the dal', call: 'Dal. Rinse it.', minutes: 3 },
        { id: 's2', label: 'Pressure cook', call: 'Dal into the cooker.', minutes: 15 },
      ],
      ...over,
    });

    it('lists every menu, and picking one loads its dishes into Tonight', async () => {
      const { user } = start();
      for (const id of ['indian', 'western', 'pasta', 'veg']) expect(screen.getByTestId(`menu-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId('menu-indian')).toHaveAttribute('aria-pressed', 'true');
      expect(tonightIds()).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
      expect(screen.getByTestId('tonight-chicken_curry')).toHaveTextContent('35 min · 3 steps');

      await user.click(screen.getByTestId('menu-pasta'));
      expect(screen.getByTestId('menu-pasta')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('menu-indian')).toHaveAttribute('aria-pressed', 'false');
      expect(tonightIds()).toEqual(['tomato_pasta', 'garlic_bread', 'green_salad']);
      expect(screen.getByTestId('plan-preview')).toHaveTextContent(/pasta/i);
    });

    it('removes a dish and adds one from the recipe book', async () => {
      const { user, onPrepare } = start();
      expect(screen.getByTestId('menu-indian')).not.toHaveAttribute('data-changed');
      await user.click(screen.getByTestId('remove-jeera_rice'));
      expect(tonightIds()).toEqual(['chicken_curry', 'garlic_naan']);
      expect(screen.getByText('Changed from Indian dinner')).toBeInTheDocument();
      // The menu it started from stays marked, as changed.
      expect(screen.getByTestId('menu-indian')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('menu-indian')).toHaveAttribute('data-changed');
      expect(screen.getByTestId('menu-indian')).toHaveTextContent('3 dishes · changed');

      await user.click(screen.getByTestId('add-dish'));
      const picker = screen.getByRole('dialog', { name: 'Add a dish' });
      expect(within(picker).getByRole('heading', { name: 'Chef’s recipes' })).toBeInTheDocument();
      expect(within(picker).queryByTestId('picker-chicken_curry')).toBeNull(); // already on tonight
      await user.click(within(picker).getByTestId('picker-dal_tadka'));
      expect(within(picker).queryByTestId('picker-dal_tadka')).toBeNull();
      expect(picker).toHaveTextContent('Added Dal tadka. Tonight: 3 dishes.');
      await user.click(within(picker).getByRole('button', { name: 'Done' }));
      expect(screen.queryByRole('dialog', { name: 'Add a dish' })).toBeNull();
      expect(tonightIds()).toEqual(['chicken_curry', 'garlic_naan', 'dal_tadka']);

      await user.click(screen.getByTestId('start-cook-without-voice'));
      expect(onPrepare).toHaveBeenLastCalledWith([RECIPES.chicken_curry, RECIPES.garlic_naan, RECIPES.dal_tadka], 'Tonight', 45, false);
    });

    it('holds at most six dishes', async () => {
      const { user } = start();
      await user.click(screen.getByTestId('add-dish'));
      const picker = screen.getByRole('dialog', { name: 'Add a dish' });
      for (const id of ['salmon', 'roti', 'green_salad']) await user.click(within(picker).getByTestId(`picker-${id}`));
      expect(within(picker).getByTestId('picker-roast_potatoes')).toBeDisabled();
      expect(picker).toHaveTextContent(/tonight is full/i);
      await user.click(within(picker).getByRole('button', { name: 'Done' }));
      expect(tonightIds()).toHaveLength(6);
      expect(screen.getByTestId('add-dish')).toBeDisabled();
      expect(screen.getByTestId('add-dish')).toHaveAccessibleDescription(/six dishes is the most/i);
    });

    it('disables Continue with a hint when Tonight is empty', async () => {
      const { user } = start();
      for (const id of ['chicken_curry', 'jeera_rice', 'garlic_naan']) await user.click(screen.getByTestId(`remove-${id}`));
      expect(screen.getByTestId('tonight-empty')).toBeInTheDocument();
      expect(screen.getByTestId('start-continue')).toBeDisabled();
      expect(screen.getByTestId('start-cook-without-voice')).toBeDisabled();
      expect(screen.getByTestId('start-continue')).toHaveAccessibleDescription('Add at least one dish to start cooking.');
      expect(screen.getByTestId('plan-preview')).not.toHaveTextContent(/serving at/);
    });

    it('saves a changed Tonight as a menu and selects it', async () => {
      const { user, onPrepare } = start();
      expect(screen.queryByTestId('save-menu')).toBeNull(); // unchanged from the menu
      await user.click(screen.getByTestId('remove-garlic_naan'));
      await user.click(screen.getByTestId('save-menu'));
      expect(screen.getByTestId('save-menu-confirm')).toBeDisabled();
      await user.type(screen.getByRole('textbox', { name: 'Menu name' }), 'Curry and rice{Enter}');

      const saved = libraryStore.getState().menus.find(m => m.custom)!;
      expect(saved).toMatchObject({ label: 'Curry and rice', dishes: ['chicken_curry', 'jeera_rice'] });
      expect(screen.getByTestId(`menu-${saved.id}`)).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('menu-indian')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByTestId('save-menu')).toBeNull();

      await user.click(screen.getByTestId('start-continue'));
      expect(onPrepare).toHaveBeenLastCalledWith([RECIPES.chicken_curry, RECIPES.jeera_rice], 'Curry and rice', 45, true);
    });

    it('deletes a saved menu only after confirming', async () => {
      const menu = libraryStore.saveMenu({ id: '', label: 'Fish supper', dishes: ['salmon', 'green_beans'] })!;
      const { user } = start();
      await user.click(screen.getByTestId(`menu-${menu.id}`));
      expect(tonightIds()).toEqual(['salmon', 'green_beans']);
      expect(screen.queryByTestId('menu-delete-indian')).toBeNull(); // Chef's menus stay

      await user.click(screen.getByRole('button', { name: 'Delete the menu Fish supper' }));
      await user.click(within(screen.getByRole('dialog', { name: 'Delete “Fish supper”?' })).getByRole('button', { name: 'Keep it' }));
      expect(screen.getByTestId(`menu-${menu.id}`)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Delete the menu Fish supper' }));
      await user.click(within(screen.getByRole('dialog', { name: 'Delete “Fish supper”?' })).getByRole('button', { name: 'Delete menu' }));
      expect(screen.queryByTestId(`menu-${menu.id}`)).toBeNull();
      expect(libraryStore.getState().menus.some(m => m.id === menu.id)).toBe(false);
      expect(tonightIds()).toEqual(['salmon', 'green_beans']); // Tonight stays, now unsaved
      expect(screen.getByTestId('save-menu')).toBeInTheDocument();
    });

    it('customises a built-in in the studio, and the saved copy takes its place', async () => {
      const { user, onPrepare } = start();
      expect(studio.props?.open).toBe(false);
      await user.click(screen.getByRole('button', { name: 'Customise Jeera rice' }));
      expect(screen.getByRole('dialog', { name: 'Recipe studio' })).toBeInTheDocument();
      expect(studio.props).toMatchObject({ open: true, initial: RECIPES.jeera_rice, basedOn: 'jeera_rice', addToTonight: false });

      const copy = { ...RECIPES.jeera_rice, id: 'jeera_rice', custom: true, basedOn: 'jeera_rice', steps: RECIPES.jeera_rice.steps.map(s => ({ ...s, minutes: s.minutes + 1 })) };
      await act(() => studio.props!.onSave(copy, { addToTonight: false }));
      const stored = libraryStore.getState().recipes.find(r => r.custom)!;
      expect(stored.id).toMatch(/^my_jeera_rice/);
      expect(screen.queryByRole('dialog', { name: 'Recipe studio' })).toBeNull();
      expect(tonightIds()).toEqual(['chicken_curry', stored.id, 'garlic_naan']);
      expect(screen.getByTestId(`tonight-${stored.id}`)).toHaveTextContent('37 min · 4 steps · your version');

      await user.click(screen.getByTestId('start-cook-without-voice'));
      expect(onPrepare.mock.lastCall![0].map((r: Recipe) => r.id)).toEqual(['chicken_curry', stored.id, 'garlic_naan']);
      expect(onPrepare.mock.lastCall![1]).toBe('Tonight');

      // Their own recipe opens as itself.
      await user.click(screen.getByRole('button', { name: 'Edit Jeera rice' }));
      expect(studio.props).toMatchObject({ open: true, initial: stored, basedOn: 'jeera_rice' });
    });

    it('writes a new recipe in the studio and adds it to tonight', async () => {
      const { user } = start();
      await user.click(screen.getByTestId('new-recipe'));
      expect(studio.props).toMatchObject({ open: true, initial: undefined, basedOn: undefined, addToTonight: true });
      await act(() => studio.props!.onSave(mine(), { addToTonight: true }));
      expect(tonightIds()).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan', 'my_mum_s_dal']);
      expect(screen.getByTestId('tonight-my_mum_s_dal')).toHaveTextContent('18 min · 2 steps · your recipe');
    });

    it('keeps a recipe saved without adding it out of Tonight', async () => {
      const { user } = start();
      await user.click(screen.getByTestId('new-recipe'));
      await act(() => studio.props!.onSave(mine(), { addToTonight: false }));
      expect(tonightIds()).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
      expect(libraryStore.getState().recipes.some(r => r.id === 'my_mum_s_dal')).toBe(true);
    });

    it("groups the cook's recipes first in the picker, where they can be edited or deleted", async () => {
      const saved = libraryStore.saveRecipe(mine());
      const { user } = start();
      await user.click(screen.getByTestId('add-dish'));
      const picker = screen.getByRole('dialog', { name: 'Add a dish' });
      const groups = within(picker).getAllByRole('heading', { level: 3 }).map(h => h.textContent);
      expect(groups).toEqual(['Your recipes', 'Chef’s recipes']);
      expect(within(picker).queryByRole('button', { name: 'Delete Salmon' })).toBeNull();

      await user.type(within(picker).getByRole('searchbox', { name: 'Find a dish' }), 'dal');
      expect(within(picker).getAllByRole('listitem').map(li => li.textContent)).toEqual([
        expect.stringContaining("Mum's dal"), expect.stringContaining('Dal tadka'),
      ]);

      await user.click(within(picker).getByRole('button', { name: "Delete Mum's dal" }));
      await user.click(within(screen.getByRole('dialog', { name: "Delete Mum's dal?" })).getByRole('button', { name: 'Delete recipe' }));
      expect(libraryStore.getState().recipes.some(r => r.id === saved.id)).toBe(false);
      expect(within(picker).queryByTestId(`picker-${saved.id}`)).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Add a dish' })).toBeInTheDocument();
    });

    it('edits their own recipe from the picker', async () => {
      const saved = libraryStore.saveRecipe(mine());
      const { user } = start();
      await user.click(screen.getByTestId('add-dish'));
      await user.click(screen.getByRole('button', { name: "Edit Mum's dal" }));
      expect(screen.queryByRole('dialog', { name: 'Add a dish' })).toBeNull();
      expect(studio.props).toMatchObject({ open: true, initial: saved, addToTonight: true });
    });

    it('never puts two versions of one dish on tonight: adding one swaps the other out', async () => {
      const { user } = start();
      await user.click(screen.getByRole('button', { name: 'Customise Jeera rice' }));
      const copy = libraryStore.saveRecipe({ ...RECIPES.jeera_rice, id: '', custom: true, basedOn: 'jeera_rice' });
      await act(() => studio.props!.onSave(copy, { addToTonight: false }));
      expect(tonightIds()).toEqual(['chicken_curry', copy.id, 'garlic_naan']);

      // Fill tonight up, then Chef's rice is still offered: as a swap for the cook's version.
      await user.click(screen.getByTestId('add-dish'));
      const picker = screen.getByRole('dialog', { name: 'Add a dish' });
      for (const id of ['salmon', 'roti', 'green_salad']) await user.click(within(picker).getByTestId(`picker-${id}`));
      expect(within(picker).getByTestId('picker-roast_potatoes')).toBeDisabled();
      const chefs = within(picker).getByTestId('picker-jeera_rice');
      expect(chefs).toBeEnabled();
      expect(chefs).toHaveAccessibleName(/^Swap in\s*Jeera rice.*instead of your version/);
      await user.click(chefs);
      expect(picker).toHaveTextContent('Jeera rice is on instead of your version.');
      expect(tonightIds()).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan', 'salmon', 'roti', 'green_salad']);
      expect(within(picker).getByTestId(`picker-${copy.id}`)).toHaveAccessibleName(/instead of Chef’s/);
    });

    it("saving your version from the picker swaps it in for Chef's", async () => {
      const copy = libraryStore.saveRecipe({ ...RECIPES.garlic_naan, id: '', custom: true, basedOn: 'garlic_naan' });
      const { user } = start();
      await user.click(screen.getByTestId('add-dish'));
      await user.click(screen.getByRole('button', { name: `Edit ${copy.name}` }));
      await act(() => studio.props!.onSave(copy, { addToTonight: true }));
      expect(tonightIds()).toEqual(['chicken_curry', 'jeera_rice', copy.id]);
      expect(screen.getByText(/on tonight instead of Chef’s/)).toBeInTheDocument();
    });

    it('keeps a new recipe in the book when tonight is already full', async () => {
      const { user } = start({ lastDinner: { dishIds: ['chicken_curry', 'jeera_rice', 'garlic_naan', 'salmon', 'roti', 'green_salad'], serveIn: 45 } });
      await user.click(screen.getByTestId('new-recipe'));
      expect(studio.props).toMatchObject({ addToTonight: false });
      await act(() => studio.props!.onSave(mine(), { addToTonight: true }));
      expect(tonightIds()).toHaveLength(6);
      expect(libraryStore.getState().recipes.some(r => r.id === 'my_mum_s_dal')).toBe(true);
      expect(screen.getByText(/Tonight already has 6 dishes/)).toBeInTheDocument();
    });

    it('recognises a Tonight that is exactly one of the saved menus', async () => {
      const menu = libraryStore.saveMenu({ id: '', label: 'Curry and rice', dishes: ['chicken_curry', 'jeera_rice'] })!;
      const { user, onPrepare } = start();
      await user.click(screen.getByTestId('remove-garlic_naan'));
      expect(screen.getByTestId(`menu-${menu.id}`)).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByTestId('save-menu')).toBeNull(); // already saved
      await user.click(screen.getByTestId('start-cook-without-voice'));
      expect(onPrepare.mock.lastCall![1]).toBe('Curry and rice');
    });

    it('loads at most six dishes from a menu', async () => {
      const seven = ['chicken_curry', 'jeera_rice', 'garlic_naan', 'salmon', 'roti', 'green_salad', 'dal_tadka'];
      const menu = libraryStore.saveMenu({ id: '', label: 'Feast', dishes: seven })!;
      const { user } = start();
      await user.click(screen.getByTestId(`menu-${menu.id}`));
      expect(tonightIds()).toEqual(seven.slice(0, 6));
    });

    it('moves focus to the neighbouring menu after deleting one', async () => {
      libraryStore.saveMenu({ id: '', label: 'Fish supper', dishes: ['salmon', 'green_beans'] });
      const { user } = start();
      await user.click(screen.getByRole('button', { name: 'Delete the menu Fish supper' }));
      await user.click(screen.getByRole('button', { name: 'Delete menu' }));
      await waitFor(() => expect(screen.getByTestId('menu-veg')).toHaveFocus());
    });

    it('closes the picker from the backdrop, but not after a drag out of it', async () => {
      const { user } = start();
      await user.click(screen.getByTestId('add-dish'));
      const picker = screen.getByRole('dialog', { name: 'Add a dish' });
      await user.pointer([{ keys: '[MouseLeft>]', target: within(picker).getByRole('searchbox') }, { target: picker }, { keys: '[/MouseLeft]', target: picker }]);
      expect(screen.getByRole('dialog', { name: 'Add a dish' })).toBeInTheDocument();
      await user.click(picker);
      expect(screen.queryByRole('dialog', { name: 'Add a dish' })).toBeNull();
    });

    it('comes back to the last dinner prepared', () => {
      start({ lastDinner: { dishIds: ['salmon', 'green_beans', 'roast_potatoes'], serveIn: 60 } });
      expect(screen.getByTestId('menu-western')).toHaveAttribute('aria-pressed', 'true');
      expect(tonightIds()).toEqual(['salmon', 'green_beans', 'roast_potatoes']);
      expect(screen.getByTestId('serve-in-60')).toHaveAttribute('aria-pressed', 'true');
    });

    it('builds the preview from the plan, custom recipes included', async () => {
      const saved = libraryStore.saveRecipe(mine({ steps: [{ id: 's1', label: 'Soak the lentils', call: 'Dal. Soak it.', minutes: 50 }] }));
      start({ lastDinner: { dishIds: [saved.id], serveIn: 45 } });
      const preview = screen.getByTestId('plan-preview');
      expect(preview).toHaveTextContent(/dal soak the lentils/i);
      expect(preview).toHaveTextContent(/serving at 8:05/);
      expect(preview).toHaveTextContent("Mum's dal takes 50 min");
      expect(BUILTIN_RECIPES.some(r => r.id === saved.id)).toBe(false);
    });
  });

  describe('sound check', () => {
    store.prepare(menuRecipes('indian'), 45);
    const ready = store.getState();

    it('waits for the connection, then lets the cook start', () => {
      const onBegin = vi.fn();
      const { rerender } = render(<StartScreen state={ready} session={fakeSession({ phase: 'connecting' })} hasKey onPrepare={vi.fn()} onBegin={onBegin} onBack={vi.fn()} />);
      expect(screen.getByTestId('soundcheck-start')).toBeDisabled();
      rerender(<StartScreen state={ready} session={fakeSession({ phase: 'live' })} hasKey onPrepare={vi.fn()} onBegin={onBegin} onBack={vi.fn()} />);
      expect(screen.getByTestId('soundcheck-start')).toBeEnabled();
      expect(screen.getByTestId('soundcheck-heard')).toHaveTextContent(/hey chef/i);
    });

    it('confirms once Chef heard the wake phrase', () => {
      render(<StartScreen state={ready} session={fakeSession({ phase: 'live', wakeCount: 1 })} hasKey onPrepare={vi.fn()} onBegin={vi.fn()} onBack={vi.fn()} />);
      expect(screen.getByTestId('soundcheck-heard')).toHaveTextContent('Heard you.');
    });

    it('offers a way forward when the voice connection fails', async () => {
      const onWithoutVoice = vi.fn();
      render(
        <StartScreen
          state={ready}
          session={fakeSession({ phase: 'error', error: 'Microphone is blocked. Allow it from the icon in the address bar, then try again.' })}
          hasKey
          onPrepare={vi.fn()}
          onBegin={vi.fn()}
          onBack={vi.fn()}
          onWithoutVoice={onWithoutVoice}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(/microphone is blocked/i);
      await userEvent.click(screen.getByRole('button', { name: /cook without voice/i }));
      expect(onWithoutVoice).toHaveBeenCalled();
    });
  });
});
