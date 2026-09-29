import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scribe, ScribeError } from '../voice/scribe';
import {
  applySuggestion, freshSuggestions, mergeIngredients, sameIngredient, totalMinutes, MAX_STEPS, MAX_SUGGESTIONS,
  type DraftStep, type RecipeDraft, type Suggestion,
} from '../kitchen/draft';

const API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY;

/** What the studio needs from Chef's scribe (the real one is `Scribe`; tests pass a fake). */
export interface ScribeLike {
  connect(): Promise<void>;
  format(
    text: string, current?: RecipeDraft, source?: 'typed' | 'said', dismissed?: string[],
  ): Promise<{ draft: RecipeDraft; suggestions: Suggestion[] }>;
  suggest(draft: RecipeDraft, dismissed: string[]): Promise<Suggestion[]>;
  close(): void;
}

export type ScribeFactory = () => ScribeLike;

/** The live scribe, or null without an AssemblyAI key (the studio then works by hand only). */
export const defaultScribeFactory: ScribeFactory | null = API_KEY ? () => new Scribe(API_KEY) : null;

/** Chef looks over the card this long after the cook's last edit. */
export const SUGGEST_DELAY_MS = 2500;
/** Dictation is formatted this long after the last finished sentence. */
export const AUTO_FORMAT_DELAY_MS = 1200;

export type Source = 'typed' | 'said';
export type ScribeStatus = { tone: 'busy' | 'done' | 'note' | 'error'; text: string };

interface Options {
  factory: ScribeFactory | null;
  /** Everything in the "Tell Chef" box. */
  text: string;
  /** The card as it is now. */
  draft: RecipeDraft;
  /** The scribe wrote the card (a format), or the cook applied a suggestion. */
  onDraft: (next: RecipeDraft, reason: 'format' | 'apply') => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const lower = (s: string) => s.trim().toLowerCase();

const sameStep = (a: DraftStep, b: DraftStep) => a.label === b.label && a.minutes === b.minutes && a.call === b.call;
const sameSteps = (a: DraftStep[], b: DraftStep[]) => a.length === b.length && a.every((s, i) => sameStep(s, b[i]));
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i]);

/**
 * Chef's steps with the cook's step edits from while Chef was reading laid over them. The cook's order wins;
 * a step they renamed, re-timed or added stays as they left it, one they deleted stays gone, one they didn't
 * touch follows Chef (its new version, or gone if Chef dropped it), and Chef's new steps slot in after the
 * step they follow in Chef's answer.
 */
function mergeSteps(sent: DraftStep[], now: DraftStep[], got: DraftStep[]): DraftStep[] {
  if (sameSteps(sent, now)) return got;
  const key = (s: DraftStep) => lower(s.label);
  const sentBy = new Map(sent.map(s => [key(s), s]));
  const gotBy = new Map(got.map(s => [key(s), s]));
  const out = now.flatMap(s => {
    const was = sentBy.get(key(s));
    if (!was || !sameStep(was, s)) return [s];
    const chef = gotBy.get(key(s));
    return chef ? [chef] : [];
  });
  let at = -1;
  for (const g of got) {
    const i = out.findIndex(o => key(o) === key(g));
    if (i >= 0) at = i;
    else if (!sentBy.has(key(g)) && out.length < MAX_STEPS) out.splice(++at, 0, g);
  }
  return out;
}

/** The ingredients the cook has now, plus the ones Chef added (not ones the cook removed meanwhile). */
function mergeNewIngredients(sent: string[], now: string[], got: string[]): string[] {
  if (sameList(sent, now)) return got;
  const added = got.filter(x => !sent.some(y => sameIngredient(x, y)));
  return mergeIngredients(now, added);
}

/** A format answer, keeping what the cook changed by hand while Chef was reading. */
function keepEdits(sent: RecipeDraft, now: RecipeDraft, got: RecipeDraft): RecipeDraft {
  if (sent === now) return got;
  return {
    name: now.name !== sent.name ? now.name : got.name,
    short: now.short !== sent.short ? now.short : got.short,
    kind: now.kind !== sent.kind ? now.kind : got.kind,
    steps: mergeSteps(sent.steps, now.steps, got.steps),
    ingredients: mergeNewIngredients(sent.ingredients, now.ingredients, got.ingredients),
  };
}

/** True when the cook changed the card by hand between these two versions. */
const handChanged = (sent: RecipeDraft, now: RecipeDraft) =>
  sent !== now &&
  (sent.name !== now.name || sent.short !== now.short || sent.kind !== now.kind ||
    !sameSteps(sent.steps, now.steps) || !sameList(sent.ingredients, now.ingredients));

/** `full` is `last` with more written after it (not a word of it changed). */
function addedTo(full: string, last: string): boolean {
  if (!full.startsWith(last) || full === last) return false;
  return /[\s.,;:!?)]$/.test(last) || /^[\s.,;:!?(]/.test(full.slice(last.length));
}

/**
 * Chef's side of the recipe studio: formats what the cook told it into the card, and suggests improvements.
 * The scribe session opens with the studio (when there's a key) and closes with it.
 * - `format()` is single-flight: asked again mid-flight, it runs once more when the first answer lands.
 *   After the first format, text the cook only added to is sent on its own and merged into the card.
 * - `edited()` marks a hand edit; 2.5 s after the last one, Chef suggests (card has a name and 2+ steps, nothing in flight).
 */
export function useScribe({ factory, text, draft, onDraft }: Options) {
  const [busy, setBusy] = useState<'format' | 'suggest' | null>(null);
  const [status, setStatus] = useState<ScribeStatus | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [read, setRead] = useState('');

  const scribe = useRef<ScribeLike | null>(null);
  const alive = useRef(true);
  const textRef = useRef(text);
  const draftRef = useRef(draft);
  const onDraftRef = useRef(onDraft);
  const suggestionsRef = useRef(suggestions);
  /** Dismissed and applied suggestion texts: Chef shouldn't offer them again. */
  const handled = useRef<string[]>([]);
  const dismissedRef = useRef<string[]>([]);
  const formatting = useRef(false);
  const again = useRef<Source | null>(null);
  const suggesting = useRef(false);
  /** Bumped by every format, so a suggestion made for an older card is dropped. */
  const generation = useRef(0);
  /** The text the card was last formatted from, and whether the cook has edited the card since that format was sent. */
  const formatted = useRef('');
  const handEdited = useRef(false);
  const lastSuggested = useRef('');
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const formatTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    textRef.current = text;
    draftRef.current = draft;
    onDraftRef.current = onDraft;
    suggestionsRef.current = suggestions;
  });

  useEffect(() => {
    alive.current = true;
    if (!factory) return;
    const s = factory();
    scribe.current = s;
    // Warm up so the first format is quick; a failed connect is retried by the first request.
    s.connect().catch(() => {});
    return () => {
      alive.current = false;
      clearTimeout(suggestTimer.current);
      clearTimeout(formatTimer.current);
      s.close();
      if (scribe.current === s) scribe.current = null;
    };
  }, [factory]);

  const runFormat = useCallback(async (source: Source) => {
    const s = scribe.current;
    if (!s) return;
    const full = textRef.current.trim();
    if (!full) {
      setStatus({ tone: 'note', text: 'Write or say the recipe first.' });
      return;
    }
    const card = draftRef.current;
    const hasCard = card.steps.length > 0 || card.name.trim() !== '';
    let send = full;
    let current: RecipeDraft | undefined = hasCard ? card : undefined;
    const last = formatted.current;
    if (hasCard && last && full !== last) {
      // Only added to: send what's new and merge it in. Rewritten, with the card untouched since: start over.
      if (addedTo(full, last)) send = full.slice(last.length).trim();
      else if (!handEdited.current) current = undefined;
    }
    // From here on, it marks edits made while Chef is reading (which the answer must not undo).
    const editedBefore = handEdited.current;
    handEdited.current = false;

    formatting.current = true;
    generation.current++;
    clearTimeout(suggestTimer.current);
    setBusy('format');
    setStatus({ tone: 'busy', text: current ? 'Chef is adding that to the card…' : 'Chef is reading…' });
    try {
      const got = await s.format(send, current, source, handled.current);
      if (!alive.current) return;
      const now = draftRef.current;
      const next = keepEdits(card, now, got.draft);
      const kept = handChanged(card, now);
      formatted.current = full;
      setRead(full);
      lastSuggested.current = '';
      // A re-run starts before React renders this card, so it reads it from here.
      draftRef.current = next;
      onDraftRef.current(next, 'format');
      setSuggestions(got.suggestions.slice(0, MAX_SUGGESTIONS));
      const summary = `Formatted: ${plural(next.steps.length, 'step')}, ${totalMinutes(next)} min`;
      setStatus(
        next.steps.length
          ? { tone: 'done', text: kept ? `${summary}. Your changes are kept.` : summary }
          : { tone: 'note', text: 'Chef couldn’t find any cooking steps in that.' },
      );
    } catch (err) {
      if (!alive.current) return;
      handEdited.current ||= editedBefore;
      setStatus({ tone: 'error', text: err instanceof ScribeError ? err.message : 'Chef couldn’t read that one. Try again.' });
    }
    if (!alive.current) return;
    formatting.current = false;
    setBusy(null);
    // Asked again mid-flight: run once more, unless nothing new arrived since the text just formatted.
    const rerun = again.current;
    again.current = null;
    if (rerun && textRef.current.trim() !== formatted.current) void runFormat(rerun);
  }, []);

  const format = useCallback((source: Source = 'typed') => {
    clearTimeout(formatTimer.current);
    if (!scribe.current) return;
    if (formatting.current) {
      again.current = again.current === 'said' || source === 'said' ? 'said' : 'typed';
      return;
    }
    void runFormat(source);
  }, [runFormat]);

  /** Formats dictation once the cook pauses: 1.2 s after the last finished sentence. */
  const formatSoon = useCallback((source: Source = 'said') => {
    clearTimeout(formatTimer.current);
    if (!scribe.current) return;
    formatTimer.current = setTimeout(() => format(source), AUTO_FORMAT_DELAY_MS);
  }, [format]);

  const suggestNow = useCallback(async () => {
    const s = scribe.current;
    const d = draftRef.current;
    if (!s || formatting.current || suggesting.current) return;
    if (!d.name.trim() || d.steps.length < 2) return;
    if (freshSuggestions(d, suggestionsRef.current, dismissedRef.current).length >= MAX_SUGGESTIONS) return;
    const sig = JSON.stringify(d);
    if (sig === lastSuggested.current) return;
    lastSuggested.current = sig;
    suggesting.current = true;
    const at = generation.current;
    setBusy('suggest');
    try {
      const got = await s.suggest(d, handled.current);
      if (!alive.current || at !== generation.current) return;
      setSuggestions(prev => {
        const card = draftRef.current;
        // The ones on show stay unless the cook's card has made them pointless; new ones mustn't echo anything handled.
        const keep = freshSuggestions(card, prev, dismissedRef.current);
        // A new idea that repeats one on show ("red chilli powder" twice, in other words) is dropped too.
        const add = freshSuggestions(card, got, [...handled.current, ...keep.map(k => k.text)])
          .filter(g => !keep.some(k => k.id === g.id || lower(k.text) === lower(g.text)));
        return [...keep, ...add].slice(0, MAX_SUGGESTIONS);
      });
    } catch {
      // Suggestions are a bonus: a failed one stays quiet (a format shows any real problem).
    } finally {
      suggesting.current = false;
      if (alive.current) setBusy(b => (b === 'suggest' ? null : b));
    }
  }, []);

  /** The cook changed the card by hand. */
  const edited = useCallback(() => {
    handEdited.current = true;
    clearTimeout(suggestTimer.current);
    if (!scribe.current) return;
    suggestTimer.current = setTimeout(() => void suggestNow(), SUGGEST_DELAY_MS);
  }, [suggestNow]);

  const apply = useCallback((s: Suggestion) => {
    handled.current = [...handled.current, s.text];
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
    const d = draftRef.current;
    const next = applySuggestion(d, s);
    if (next === d) return;
    draftRef.current = next;
    onDraftRef.current(next, 'apply');
    edited();
  }, [edited]);

  const dismiss = useCallback((s: Suggestion) => {
    handled.current = [...handled.current, s.text];
    dismissedRef.current = [...dismissedRef.current, s.text];
    setDismissed(dismissedRef.current);
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
  }, []);

  // Suggestions the card has since made pointless (the cook added that ingredient themselves) drop out.
  const visible = useMemo(() => freshSuggestions(draft, suggestions, dismissed), [draft, suggestions, dismissed]);

  /** The box has text Chef hasn't formatted yet. */
  const unread = text.trim() !== '' && text.trim() !== read;

  return { enabled: factory !== null, busy, status, note: setStatus, suggestions: visible, unread, format, formatSoon, edited, apply, dismiss };
}

export type ScribeApi = ReturnType<typeof useScribe>;
