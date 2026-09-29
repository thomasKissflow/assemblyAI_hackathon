// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeStudio, appendSaid, type RecipeStudioProps } from './RecipeStudio';
import { AUTO_FORMAT_DELAY_MS, SUGGEST_DELAY_MS, type ScribeLike } from './useScribe';
import { libraryStore } from '../kitchen/library';
import { RECIPES, type Recipe } from '../kitchen/recipes';
import type { RecipeDraft, Suggestion } from '../kitchen/draft';
import { ScribeError } from '../voice/scribe';
import type { DictationOptions, DictationStatus } from '../voice/dictation';

const DAL: RecipeDraft = {
  name: "Mom's dal",
  short: 'dal',
  kind: 'curry',
  steps: [
    { label: 'Rinse the toor dal', minutes: 3, call: 'Dal. Rinse it till the water runs clear.' },
    { label: 'Pressure cook the dal', minutes: 15, call: 'Dal into the pressure cooker.' },
    { label: 'Fry the tadka', minutes: 12, call: 'Ghee on. Cumin, garlic, onion, tomato.' },
    { label: 'Simmer the dal', minutes: 8, call: 'Dal into the tadka. Down to a simmer.' },
  ],
  ingredients: ['1 cup toor dal', 'turmeric', 'ghee'],
};

const LEMON: Suggestion = { id: 'sg_lemon', text: 'Finish with a squeeze of lemon.', patch: { type: 'add_ingredient', ingredient: '1 lemon' } };
const SOAK: Suggestion = { id: 'sg_soak', text: 'Soak the dal for 30 minutes first so it cooks evenly.' };

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeScribe(result: { draft: RecipeDraft; suggestions: Suggestion[] } = { draft: DAL, suggestions: [LEMON, SOAK] }) {
  const s = {
    connect: vi.fn(async () => {}),
    format: vi.fn(async (..._args: Parameters<ScribeLike['format']>) => result),
    suggest: vi.fn(async (..._args: Parameters<ScribeLike['suggest']>): Promise<Suggestion[]> => []),
    close: vi.fn(),
  };
  return { scribe: s, factory: vi.fn(() => s as ScribeLike) };
}

/** A stand-in for useDictation: the test says sentences through `say`. */
function fakeMic() {
  const mic = { onCommit: undefined as DictationOptions['onCommit'], start: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
  const listen = (opts: DictationOptions) => {
    mic.onCommit = opts.onCommit;
    return { status: 'idle' as const, partial: '', error: null, start: mic.start, stop: mic.stop, level: () => 0 };
  };
  const say = (text: string) => act(() => mic.onCommit?.(text));
  return { mic, listen, say };
}

function renderStudio(props: Partial<RecipeStudioProps> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const view = render(<RecipeStudio open onClose={onClose} onSave={onSave} scribe={null} {...props} />);
  return { ...view, onSave, onClose };
}

const steps = () => screen.queryAllByTestId('studio-step');
const flush = () => act(async () => {});

afterEach(() => {
  libraryStore.clear();
  vi.useRealTimers();
});

describe('RecipeStudio', () => {
  beforeEach(() => libraryStore.clear());

  it('renders nothing while closed', () => {
    render(<RecipeStudio open={false} onClose={vi.fn()} onSave={vi.fn()} scribe={null} />);
    expect(screen.queryByTestId('recipe-studio')).toBeNull();
  });

  it('opens a new, empty recipe as a modal dialog with the text box focused', () => {
    renderStudio();
    const dialog = screen.getByRole('dialog', { name: 'New recipe' });
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByTestId('studio-text')).toHaveFocus();
    expect(steps()).toHaveLength(0);
    expect(screen.getByText(/no steps yet/i)).toBeInTheDocument();
  });

  it('formats typed text into the card, with a status line and suggestions', async () => {
    const { scribe, factory } = fakeScribe();
    renderStudio({ scribe: factory });
    const text = "My mom's dal. Wash a cup of toor dal and pressure cook it with turmeric.";
    await userEvent.type(screen.getByTestId('studio-text'), text);
    await userEvent.click(screen.getByTestId('studio-format'));

    expect(scribe.format).toHaveBeenCalledWith(text, undefined, 'typed', []);
    expect(steps()).toHaveLength(4);
    expect(screen.getByTestId('studio-name')).toHaveValue("Mom's dal");
    expect(screen.getByTestId('studio-short')).toHaveValue('dal');
    expect(screen.getByTestId('studio-kind')).toHaveAccessibleName(/curry/i);
    expect(screen.getByRole('textbox', { name: 'Step 2' })).toHaveValue('Pressure cook the dal');
    expect(screen.getByRole('spinbutton', { name: 'Step 2 minutes' })).toHaveValue(15);
    expect(screen.getByTestId('studio-status')).toHaveTextContent('Formatted: 4 steps, 38 min');
    expect(screen.getByTestId('studio-total')).toHaveTextContent('38 min');
    expect(screen.getAllByTestId('studio-suggestion')).toHaveLength(2);
    // Chef's steps arrive one after another.
    expect(steps().map(s => s.style.getPropertyValue('--i'))).toEqual(['0', '1', '2', '3']);
  });

  it('applies and dismisses suggestions, and passes both back so Chef does not repeat them', async () => {
    const { scribe, factory } = fakeScribe();
    renderStudio({ scribe: factory });
    await userEvent.type(screen.getByTestId('studio-text'), 'dal');
    await userEvent.click(screen.getByTestId('studio-format'));

    await userEvent.click(screen.getByRole('button', { name: `Apply: ${LEMON.text}` }));
    expect(screen.getByRole('button', { name: 'Edit 1 lemon' })).toBeInTheDocument();
    expect(screen.getByText(SOAK.text)).toBeInTheDocument();
    // A tip has nothing to apply.
    expect(screen.queryByRole('button', { name: `Apply: ${SOAK.text}` })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: `Dismiss: ${SOAK.text}` }));
    expect(screen.queryAllByTestId('studio-suggestion')).toHaveLength(0);

    await userEvent.type(screen.getByTestId('studio-text'), ' Then garnish with fried onions.');
    await userEvent.click(screen.getByTestId('studio-format'));
    // Only the new sentence is sent, merged into the card.
    const [sent, current, , dismissed] = scribe.format.mock.calls[1];
    expect(sent).toBe('Then garnish with fried onions.');
    expect(current?.ingredients).toContain('1 lemon');
    expect(dismissed).toEqual([LEMON.text, SOAK.text]);
  });

  it('asks Chef for suggestions 2.5 s after a hand edit, once the card has a name and two steps', async () => {
    vi.useFakeTimers();
    const { scribe, factory } = fakeScribe();
    scribe.suggest.mockResolvedValue([LEMON]);
    const mine: Recipe = { ...RECIPES.dal_tadka, id: 'my_dal', custom: true, ingredients: [] };
    renderStudio({ scribe: factory, initial: mine });

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Step 2 minutes' }), { target: { value: '20' } });
    act(() => vi.advanceTimersByTime(SUGGEST_DELAY_MS - 100));
    fireEvent.change(screen.getByRole('textbox', { name: 'Step 1' }), { target: { value: 'Rinse the dal well' } });
    act(() => vi.advanceTimersByTime(SUGGEST_DELAY_MS - 100));
    expect(scribe.suggest).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(100));

    expect(scribe.suggest).toHaveBeenCalledTimes(1);
    const [draft, dismissed] = scribe.suggest.mock.calls[0];
    expect(draft.steps[0].label).toBe('Rinse the dal well');
    expect(draft.steps[1].minutes).toBe(20);
    expect(dismissed).toEqual([]);
    expect(screen.getByText(LEMON.text)).toBeInTheDocument();
  });

  it('does not ask for suggestions without a name and two steps', async () => {
    vi.useFakeTimers();
    const { scribe, factory } = fakeScribe();
    renderStudio({ scribe: factory });
    fireEvent.change(screen.getByTestId('studio-name'), { target: { value: 'Toast' } });
    fireEvent.click(screen.getByTestId('studio-add-step'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Step 1' }), { target: { value: 'Toast the bread' } });
    await act(async () => vi.advanceTimersByTime(SUGGEST_DELAY_MS * 2));
    expect(scribe.suggest).not.toHaveBeenCalled();
  });

  it('blocks saving with the reasons, then saves once they are fixed', async () => {
    const { onSave } = renderStudio();
    await userEvent.click(screen.getByTestId('studio-save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Give the recipe a name. Add at least one step.');
    expect(screen.getByTestId('studio-name')).toHaveFocus();
    expect(screen.getByTestId('studio-name')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(screen.getByTestId('studio-name'), 'Toast');
    await userEvent.click(screen.getByTestId('studio-add-step'));
    await userEvent.click(screen.getByTestId('studio-save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Every step needs a name.');
    expect(screen.getByRole('textbox', { name: 'Step 1' })).toHaveFocus();

    await userEvent.type(screen.getByRole('textbox', { name: 'Step 1' }), 'Toast the bread');
    await userEvent.click(screen.getByTestId('studio-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('saves a hand-made recipe as the cook’s own, with a fresh id', async () => {
    const { onSave } = renderStudio({ addToTonight: true });
    await userEvent.type(screen.getByTestId('studio-name'), 'Cheese toast');
    await userEvent.click(screen.getByTestId('studio-kind'));
    await userEvent.click(screen.getByTestId('kind-bread'));
    await userEvent.click(screen.getByTestId('studio-add-step'));
    await userEvent.type(screen.getByRole('textbox', { name: 'Step 1' }), 'Grill the toast');
    const minutes = screen.getByRole('spinbutton', { name: 'Step 1 minutes' });
    await userEvent.clear(minutes);
    await userEvent.type(minutes, '4');
    await userEvent.type(screen.getByTestId('studio-add-ingredient'), 'bread, cheddar{Enter}');
    // Save & add to tonight is the primary action here.
    expect(screen.getByTestId('studio-save-add')).toHaveClass('btn-fire');
    await userEvent.click(screen.getByTestId('studio-save-add'));

    const [recipe, opts] = onSave.mock.calls[0];
    expect(opts).toEqual({ addToTonight: true });
    expect(recipe).toMatchObject({
      id: 'my_cheese_toast',
      name: 'Cheese toast',
      short: 'toast',
      kind: 'bread',
      photo: '/dishes/kinds/bread.svg',
      custom: true,
      ingredients: ['bread', 'cheddar'],
      steps: [{ id: 's1', label: 'Grill the toast', minutes: 4, call: 'Toast. Grill the toast.' }],
    });
    expect(recipe.basedOn).toBeUndefined();
  });

  it('customises a built-in: pre-filled, saved as a copy that records where it came from', async () => {
    const { onSave } = renderStudio({ initial: RECIPES.dal_tadka, basedOn: 'dal_tadka' });
    expect(screen.getByRole('dialog', { name: 'Customise Dal tadka' })).toBeInTheDocument();
    expect(screen.getByTestId('studio-name')).toHaveValue('Dal tadka');
    expect(steps()).toHaveLength(4);
    const cook = screen.getByRole('spinbutton', { name: 'Step 2 minutes' });
    await userEvent.clear(cook);
    await userEvent.type(cook, '20');
    // Save recipe is primary when it's not being added to tonight.
    expect(screen.getByTestId('studio-save')).toHaveClass('btn-fire');
    await userEvent.click(screen.getByTestId('studio-save'));

    const [recipe, opts] = onSave.mock.calls[0];
    expect(opts).toEqual({ addToTonight: false });
    expect(recipe).toMatchObject({ id: 'my_dal_tadka', basedOn: 'dal_tadka', custom: true, name: 'Dal tadka' });
    expect(recipe.steps.map((s: { minutes: number }) => s.minutes)).toEqual([3, 20, 5, 5]);
    expect(recipe.ingredients).toEqual(RECIPES.dal_tadka.ingredients);
  });

  it('records basedOn for a built-in even when the parent leaves it out', async () => {
    const { onSave } = renderStudio({ initial: RECIPES.dal_tadka });
    await userEvent.click(screen.getByTestId('studio-save'));
    expect(onSave.mock.calls[0][0]).toMatchObject({ basedOn: 'dal_tadka', id: 'my_dal_tadka' });
  });

  it('keeps the id of the cook’s own recipe when editing it', async () => {
    const mine = libraryStore.saveRecipe({ ...RECIPES.roti, id: 'my_roti', name: 'Roti', custom: true, basedOn: 'roti' });
    const { onSave } = renderStudio({ initial: mine });
    expect(screen.getByRole('dialog', { name: 'Edit Roti' })).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('studio-name'), ' for two');
    await userEvent.click(screen.getByTestId('studio-save'));
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: 'my_roti', name: 'Roti for two', basedOn: 'roti' });
  });

  it('moves, deletes and adds steps, and edits what Chef says', async () => {
    renderStudio({ initial: RECIPES.dal_tadka });
    await userEvent.click(screen.getByRole('button', { name: 'Move step 2 up' }));
    expect(screen.getByRole('textbox', { name: 'Step 1' })).toHaveValue('Pressure cook with turmeric');
    // Focus follows the moved step (its up button is now disabled, so down).
    expect(screen.getByRole('button', { name: 'Move step 1 down' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Delete step 4' }));
    expect(steps()).toHaveLength(3);

    const say = screen.getByRole('button', { name: 'What Chef says for step 1' });
    expect(say).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(say);
    expect(say).toHaveAttribute('aria-expanded', 'true');
    const call = within(steps()[0]).getByRole('textbox', { name: 'Chef says' });
    expect(call).toHaveValue('Dal into the pressure cooker with turmeric and salt.');

    await userEvent.click(screen.getByTestId('studio-add-step'));
    expect(steps()).toHaveLength(4);
    expect(screen.getByRole('textbox', { name: 'Step 4' })).toHaveFocus();
  });

  it('edits and removes ingredient chips', async () => {
    renderStudio({ initial: RECIPES.dal_tadka });
    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 litre water' }));
    expect(screen.queryByRole('button', { name: 'Edit 1 litre water' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Edit 2 tbsp ghee' }));
    const input = screen.getByRole('textbox', { name: /^Ingredient/ });
    await userEvent.clear(input);
    await userEvent.type(input, '3 tbsp ghee{Enter}');
    expect(screen.getByRole('button', { name: 'Edit 3 tbsp ghee' })).toBeInTheDocument();
  });

  it('works by hand without a key: AI controls are off, with one line saying why', async () => {
    const { onSave } = renderStudio({ scribe: null });
    expect(screen.getByTestId('studio-format')).toBeDisabled();
    expect(screen.getByTestId('studio-mic')).toBeDisabled();
    expect(screen.getByText('Add an AssemblyAI key to let Chef format and suggest.')).toBeInTheDocument();
    expect(screen.queryByTestId('studio-suggestions')).toBeNull();

    await userEvent.type(screen.getByTestId('studio-name'), 'Toast');
    await userEvent.click(screen.getByTestId('studio-add-step'));
    await userEvent.type(screen.getByRole('textbox', { name: 'Step 1' }), 'Toast the bread');
    await userEvent.click(screen.getByTestId('studio-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows a scribe error and keeps the card', async () => {
    const { scribe, factory } = fakeScribe();
    scribe.format.mockRejectedValueOnce(new ScribeError('timeout', 'Chef took too long to read that. Try again.'));
    renderStudio({ scribe: factory, initial: RECIPES.dal_tadka });
    await userEvent.type(screen.getByTestId('studio-text'), 'Add a pinch of hing to the tadka.');
    await userEvent.click(screen.getByTestId('studio-format'));
    expect(screen.getByTestId('studio-status')).toHaveTextContent('Chef took too long to read that. Try again.');
    expect(steps()).toHaveLength(4);
    expect(screen.getByTestId('studio-name')).toHaveValue('Dal tadka');
    // A customised built-in is merged into, with the whole text.
    expect(scribe.format.mock.calls[0][1]?.name).toBe('Dal tadka');
  });

  it('formats dictation 1.2 s after the last sentence, one request at a time with one re-run', async () => {
    vi.useFakeTimers();
    const { scribe, factory } = fakeScribe();
    const first = deferred<{ draft: RecipeDraft; suggestions: Suggestion[] }>();
    scribe.format.mockReturnValueOnce(first.promise);
    const { listen, say } = fakeMic();
    renderStudio({ scribe: factory, listen });

    say("My mom's dal.");
    act(() => vi.advanceTimersByTime(AUTO_FORMAT_DELAY_MS - 200));
    say('Wash the toor dal and pressure cook it.');
    expect(screen.getByTestId('studio-text')).toHaveValue("My mom's dal. Wash the toor dal and pressure cook it.");
    act(() => vi.advanceTimersByTime(AUTO_FORMAT_DELAY_MS - 1));
    expect(scribe.format).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(scribe.format).toHaveBeenCalledTimes(1);
    expect(scribe.format.mock.calls[0]).toEqual(["My mom's dal. Wash the toor dal and pressure cook it.", undefined, 'said', []]);

    // More said while Chef is reading: it waits, then runs once with just the new text.
    say('Then make a tadka.');
    act(() => vi.advanceTimersByTime(AUTO_FORMAT_DELAY_MS));
    say('Finish with coriander.');
    act(() => vi.advanceTimersByTime(AUTO_FORMAT_DELAY_MS));
    expect(scribe.format).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve({ draft: DAL, suggestions: [] }));
    await flush();
    expect(scribe.format).toHaveBeenCalledTimes(2);
    const [text, current, source] = scribe.format.mock.calls[1];
    expect(text).toBe('Then make a tadka. Finish with coriander.');
    expect(current?.name).toBe("Mom's dal");
    expect(source).toBe('said');
  });

  it('opens the scribe with the studio and closes it, with the mic, when the studio closes', async () => {
    const { scribe, factory } = fakeScribe();
    const { listen, mic } = fakeMic();
    const { rerender, onClose } = renderStudio({ scribe: factory, listen });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(scribe.connect).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('studio-mic'));
    expect(mic.start).toHaveBeenCalled();
    rerender(<RecipeStudio open={false} onClose={onClose} onSave={vi.fn()} scribe={factory} listen={listen} />);
    expect(scribe.close).toHaveBeenCalled();
  });

  it('gives focus back to what opened it', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            New recipe
          </button>
          <RecipeStudio open={open} onClose={() => setOpen(false)} onSave={vi.fn()} scribe={null} />
        </>
      );
    }
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'New recipe' }));
    expect(screen.getByTestId('studio-text')).toHaveFocus();
    await userEvent.click(screen.getByTestId('studio-cancel'));
    await act(() => new Promise(r => requestAnimationFrame(() => r(null))));
    expect(screen.getByRole('button', { name: 'New recipe' })).toHaveFocus();
  });

  it('closes straight away when nothing changed, and asks first when something did', async () => {
    const first = renderStudio();
    await userEvent.click(screen.getByTestId('studio-cancel'));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    const { onClose } = renderStudio();
    await userEvent.type(screen.getByTestId('studio-text'), 'Some notes');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard this recipe?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Discard this recipe?')).toBeNull();

    // Other close requests ask too.
    fireEvent(screen.getByTestId('recipe-studio'), new Event('cancel', { cancelable: true }));
    expect(screen.getByText('Discard this recipe?')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('studio-discard'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles Esc itself, so pressing it again and again never throws the recipe away', async () => {
    const { onClose } = renderStudio();
    await userEvent.type(screen.getByTestId('studio-text'), 'Some notes');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('Discard this recipe?')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Discard this recipe?')).toBeNull();
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => void screen.getByTestId('studio-text').dispatchEvent(esc));
    // The browser's own close is cancelled at the key press.
    expect(esc.defaultPrevented).toBe(true);
    expect(screen.getByText('Discard this recipe?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers the kinds as a radio group: the chosen plate is focusable, and arrows move the choice', async () => {
    renderStudio({ initial: RECIPES.dal_tadka });
    const group = screen.getByRole('radiogroup', { name: 'What kind of dish?', hidden: true });
    const radios = within(group).getAllByRole('radio', { hidden: true });
    expect(radios).toHaveLength(11);
    const curry = within(group).getByRole('radio', { name: 'Curry', hidden: true });
    expect(curry).toHaveAttribute('aria-checked', 'true');
    expect(radios.filter(r => r.tabIndex === 0)).toEqual([curry]);
    curry.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByTestId('studio-kind')).toHaveAccessibleName(/rice/i);
    expect(within(group).getByRole('radio', { name: 'Rice', hidden: true })).toHaveFocus();
    // Four plates to a row: down from Rice is Veg.
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByTestId('studio-kind')).toHaveAccessibleName(/veg/i);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('studio-kind')).toHaveFocus();
  });

  it('takes only whole minutes from 1 up', async () => {
    renderStudio({ initial: RECIPES.dal_tadka });
    const rinse = screen.getByRole('spinbutton', { name: 'Step 1 minutes' });
    await userEvent.type(rinse, 'e-.');
    expect(rinse).toHaveValue(3);
    await userEvent.clear(rinse);
    await userEvent.type(rinse, '0');
    expect(screen.getByTestId('studio-total')).toHaveTextContent('28 min');
    await userEvent.tab();
    expect(rinse).toHaveValue(3);
  });

  it('shows a mic problem in the status line until Chef has something newer to say', async () => {
    const { factory } = fakeScribe();
    const state = { status: 'idle' as DictationStatus, error: null as string | null };
    const listen = () => ({ ...state, partial: '', start: vi.fn(async () => {}), stop: vi.fn(async () => {}), level: () => 0 });
    const view = renderStudio({ scribe: factory, listen });
    Object.assign(state, { status: 'error', error: 'Microphone is blocked. Allow it from the icon in the address bar, then try again.' });
    view.rerender(<RecipeStudio open onClose={view.onClose} onSave={view.onSave} scribe={factory} listen={listen} />);
    expect(screen.getByTestId('studio-status')).toHaveTextContent('Microphone is blocked.');
    await userEvent.type(screen.getByTestId('studio-text'), 'dal');
    await userEvent.click(screen.getByTestId('studio-format'));
    expect(screen.getByTestId('studio-status')).toHaveTextContent('Formatted: 4 steps, 38 min');
  });

  it('keeps focus on an ingredient chip after editing it from the keyboard', async () => {
    renderStudio({ initial: RECIPES.dal_tadka });
    await userEvent.click(screen.getByRole('button', { name: 'Edit 2 tbsp ghee' }));
    await userEvent.keyboard('{Control>}a{/Control}3 tbsp ghee{Enter}');
    expect(screen.getByRole('button', { name: 'Edit 3 tbsp ghee' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Control>}a{/Control}nothing{Escape}');
    expect(screen.getByRole('button', { name: 'Edit 3 tbsp ghee' })).toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps hand edits made while Chef is reading, and says so', async () => {
    const { scribe, factory } = fakeScribe();
    const answer = deferred<{ draft: RecipeDraft; suggestions: Suggestion[] }>();
    scribe.format.mockReturnValueOnce(answer.promise);
    renderStudio({ scribe: factory, initial: RECIPES.dal_tadka });
    await userEvent.type(screen.getByTestId('studio-text'), 'Add a pinch of hing to the tadka.');
    await userEvent.click(screen.getByTestId('studio-format'));
    const cook = screen.getByRole('spinbutton', { name: 'Step 2 minutes' });
    await userEvent.clear(cook);
    await userEvent.type(cook, '20');
    await userEvent.click(screen.getByRole('button', { name: 'Delete step 4' }));

    const chef = scribe.format.mock.calls[0][1]!;
    await act(async () =>
      answer.resolve({
        draft: { ...chef, steps: [...chef.steps, { label: 'Rest the dal', minutes: 2, call: 'Lid on.' }], ingredients: [...chef.ingredients, 'pinch of hing'] },
        suggestions: [],
      }),
    );
    expect(steps().map(s => (within(s).getByRole('spinbutton') as HTMLInputElement).value)).toEqual(['3', '20', '5', '2']);
    expect(screen.getByRole('textbox', { name: 'Step 4' })).toHaveValue('Rest the dal');
    expect(screen.getByRole('button', { name: 'Edit pinch of hing' })).toBeInTheDocument();
    expect(screen.getByTestId('studio-status')).toHaveTextContent('Your changes are kept.');
  });
});

describe('appendSaid', () => {
  it('adds a full stop between sentences when the first turn came through unformatted', () => {
    expect(appendSaid('', 'Tomato soup')).toBe('Tomato soup');
    expect(appendSaid('Tomato soup', 'Roast the tomatoes.')).toBe('Tomato soup. Roast the tomatoes.');
    expect(appendSaid('Roast the tomatoes.', 'Then blend.')).toBe('Roast the tomatoes. Then blend.');
    expect(appendSaid('Roast the tomatoes,', 'then blend.')).toBe('Roast the tomatoes, then blend.');
    expect(appendSaid('My dal ', 'with ghee')).toBe('My dal with ghee');
  });
});
