// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { FOLLOW_UP_SUGGEST_MS, useScribe, type ScribeLike } from './useScribe';
import { emptyDraft, type RecipeDraft, type Suggestion } from '../kitchen/draft';

const DAL: RecipeDraft = {
  name: 'Dal',
  short: 'dal',
  kind: 'curry',
  steps: [
    { label: 'Rinse the dal', minutes: 3, call: 'Dal. Rinse it.' },
    { label: 'Cook the dal', minutes: 15, call: 'Dal on.' },
  ],
  ingredients: ['toor dal'],
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
}

function setup(text: string, draft: RecipeDraft = emptyDraft()) {
  const s = {
    connect: vi.fn(async () => {}),
    format: vi.fn(async (..._a: Parameters<ScribeLike['format']>) => ({ draft: DAL, suggestions: [] as Suggestion[] })),
    suggest: vi.fn(async (..._a: Parameters<ScribeLike['suggest']>): Promise<Suggestion[]> => []),
    close: vi.fn(),
  };
  const factory = () => s as ScribeLike;
  const onDraft = vi.fn();
  const hook = renderHook(props => useScribe({ factory, onDraft, ...props }), { initialProps: { text, draft } });
  return { s, onDraft, hook };
}

describe('useScribe', () => {
  it('keeps what the cook typed into the card while Chef was reading', async () => {
    const { s, onDraft, hook } = setup('dal recipe');
    const answer = deferred<{ draft: RecipeDraft; suggestions: Suggestion[] }>();
    s.format.mockReturnValueOnce(answer.promise);
    act(() => hook.result.current.format('typed'));
    hook.rerender({ text: 'dal recipe', draft: { ...emptyDraft(), name: "Nani's dal" } });
    await act(async () => answer.resolve({ draft: DAL, suggestions: [] }));
    const [next] = onDraft.mock.calls[0];
    expect(next.name).toBe("Nani's dal");
    expect(next.steps).toEqual(DAL.steps);
  });

  it('keeps step and ingredient edits made while Chef was reading, and slots in the steps Chef added', async () => {
    const card: RecipeDraft = {
      ...DAL,
      steps: [...DAL.steps, { label: 'Fry the tadka', minutes: 10, call: 'Tadka on.' }],
      ingredients: ['toor dal', 'ghee', 'cumin'],
    };
    const { s, onDraft, hook } = setup('Add a pinch of hing.', card);
    const answer = deferred<{ draft: RecipeDraft; suggestions: Suggestion[] }>();
    s.format.mockReturnValueOnce(answer.promise);
    act(() => hook.result.current.format('typed'));
    expect(s.format.mock.calls[0][1]).toBe(card);

    // While Chef reads: rename step 1, re-time step 2, delete the tadka, add a step, drop ghee.
    const edited: RecipeDraft = {
      ...card,
      steps: [
        { label: 'Rinse the dal twice', minutes: 3, call: 'Dal. Rinse it.' },
        { label: 'Cook the dal', minutes: 20, call: 'Dal on.' },
        { label: 'Chop the coriander', minutes: 2, call: 'Coriander.' },
      ],
      ingredients: ['toor dal', 'cumin'],
    };
    hook.rerender({ text: 'Add a pinch of hing.', draft: edited });
    act(() => hook.result.current.edited());
    await act(async () =>
      answer.resolve({
        draft: {
          ...card,
          steps: [
            DAL.steps[0],
            { label: 'Cook the dal', minutes: 18, call: 'Dal on.' },
            { label: 'Fry the tadka', minutes: 10, call: 'Tadka on. Hing in.' },
            { label: 'Rest the dal', minutes: 5, call: 'Lid on.' },
          ],
          ingredients: ['toor dal', 'ghee', 'cumin', 'pinch of hing'],
        },
        suggestions: [],
      }),
    );

    const [next] = onDraft.mock.calls[0];
    expect(next.steps.map((st: { label: string; minutes: number }) => `${st.label} ${st.minutes}`)).toEqual([
      'Rinse the dal twice 3',
      'Cook the dal 20',
      'Rest the dal 5',
      'Chop the coriander 2',
    ]);
    expect(next.ingredients).toEqual(['toor dal', 'cumin', 'pinch of hing']);
    expect(hook.result.current.status?.text).toBe('Formatted: 4 steps, 30 min. Your changes are kept.');
  });

  it('asks for suggestions right after a format that left only tips on a full card', async () => {
    vi.useFakeTimers();
    try {
      const { s, hook } = setup('Dal. Rinse it. Cook it.');
      s.format.mockResolvedValueOnce({ draft: DAL, suggestions: [{ id: 't', text: "Tell me the steps and I'll time them." }] });
      s.suggest.mockResolvedValueOnce([{ id: 'a', text: 'Soak the dal first.', patch: { type: 'add_step', after: null, step: { label: 'Soak the dal', minutes: 20, call: 'Dal. Soak it.' } } }]);
      await act(async () => hook.result.current.format('said'));
      hook.rerender({ text: 'Dal. Rinse it. Cook it.', draft: DAL });
      expect(s.suggest).not.toHaveBeenCalled();
      await act(async () => { vi.advanceTimersByTime(FOLLOW_UP_SUGGEST_MS + 50); });
      expect(s.suggest).toHaveBeenCalledTimes(1);
      expect(hook.result.current.suggestions.map(x => x.text)).toEqual(['Soak the dal first.']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes Chef’s whole answer when nothing was edited meanwhile', async () => {
    const { s, onDraft, hook } = setup('Add a pinch of hing.', DAL);
    const answer = deferred<{ draft: RecipeDraft; suggestions: Suggestion[] }>();
    s.format.mockReturnValueOnce(answer.promise);
    act(() => hook.result.current.format('typed'));
    // A re-render with the same card (a new object) is not an edit.
    hook.rerender({ text: 'Add a pinch of hing.', draft: { ...DAL, steps: DAL.steps.map(st => ({ ...st })) } });
    const got = { ...DAL, steps: [DAL.steps[1]], ingredients: ['toor dal', 'hing'] };
    await act(async () => answer.resolve({ draft: got, suggestions: [] }));
    expect(onDraft.mock.calls[0][0]).toEqual(got);
    expect(hook.result.current.status?.text).toBe('Formatted: 1 step, 15 min');
  });

  it('remembers hand edits across a failed format, so rewritten text still merges into the card', async () => {
    const { s, hook } = setup('Dal. Rinse and cook it.');
    await act(async () => hook.result.current.format('typed'));
    hook.rerender({ text: 'Dal. Rinse and cook it.', draft: { ...DAL, name: "Nani's dal" } });
    act(() => hook.result.current.edited());
    hook.rerender({ text: 'Moong dal. Rinse and cook it.', draft: { ...DAL, name: "Nani's dal" } });
    s.format.mockRejectedValueOnce(new Error('offline'));
    await act(async () => hook.result.current.format('typed'));
    await act(async () => hook.result.current.format('typed'));
    expect(s.format.mock.calls[2][1]?.name).toBe("Nani's dal");
  });

  it('counts an edit made while Chef was reading, so a later rewrite merges instead of wiping it', async () => {
    const { s, hook } = setup('Dal. Rinse and cook it.');
    const answer = deferred<{ draft: RecipeDraft; suggestions: Suggestion[] }>();
    s.format.mockReturnValueOnce(answer.promise);
    act(() => hook.result.current.format('typed'));
    hook.rerender({ text: 'Dal. Rinse and cook it.', draft: { ...emptyDraft(), name: "Nani's dal" } });
    act(() => hook.result.current.edited());
    await act(async () => answer.resolve({ draft: DAL, suggestions: [] }));
    hook.rerender({ text: 'Moong dal. Rinse and cook it.', draft: { ...DAL, name: "Nani's dal" } });
    await act(async () => hook.result.current.format('typed'));
    expect(s.format.mock.calls[1][1]?.name).toBe("Nani's dal");
  });

  it('treats a changed last word as a rewrite, not new text', async () => {
    const { s, hook } = setup('Dal. Cook the dal');
    await act(async () => hook.result.current.format('typed'));
    hook.rerender({ text: 'Dal. Cook the dals', draft: DAL });
    await act(async () => hook.result.current.format('typed'));
    expect(s.format.mock.calls[1].slice(0, 2)).toEqual(['Dal. Cook the dals', undefined]);
  });

  it('starts over when the text was rewritten and the card is untouched, and merges when it was only added to', async () => {
    const { s, hook } = setup('Dal. Rinse and cook it.');
    await act(async () => hook.result.current.format('typed'));
    hook.rerender({ text: 'Moong dal. Rinse and cook it.', draft: DAL });
    await act(async () => hook.result.current.format('typed'));
    expect(s.format.mock.calls[1].slice(0, 2)).toEqual(['Moong dal. Rinse and cook it.', undefined]);

    hook.rerender({ text: 'Moong dal. Rinse and cook it. Add ghee.', draft: DAL });
    await act(async () => hook.result.current.format('typed'));
    expect(s.format.mock.calls[2].slice(0, 2)).toEqual(['Add ghee.', DAL]);
  });

  it('drops a suggestion made for a card that Chef has since re-formatted', async () => {
    vi.useFakeTimers();
    const { s, hook } = setup('', DAL);
    const late = deferred<Suggestion[]>();
    s.suggest.mockReturnValueOnce(late.promise);
    act(() => hook.result.current.edited());
    await act(async () => vi.advanceTimersByTime(2500));
    expect(s.suggest).toHaveBeenCalledTimes(1);
    expect(hook.result.current.busy).toBe('suggest');

    hook.rerender({ text: 'More dal notes', draft: DAL });
    await act(async () => hook.result.current.format('typed'));
    await act(async () => late.resolve([{ id: 'x', text: 'Add lemon', patch: { type: 'add_ingredient', ingredient: 'lemon' } }]));
    expect(hook.result.current.suggestions).toEqual([]);
    vi.useRealTimers();
  });

  it('does nothing without a scribe', () => {
    const onDraft = vi.fn();
    const { result } = renderHook(() => useScribe({ factory: null, text: 'dal', draft: DAL, onDraft }));
    act(() => result.current.format('typed'));
    act(() => result.current.edited());
    expect(result.current.enabled).toBe(false);
    expect(result.current.busy).toBeNull();
    expect(onDraft).not.toHaveBeenCalled();
  });
});
