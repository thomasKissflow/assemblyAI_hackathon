import { useRef, type RefObject } from 'react';
import { Check, ChefHat, Lightbulb, LoaderCircle, Mic, Plus, ShoppingBasket, Square, Timer, X } from 'lucide-react';
import type { Suggestion } from '../kitchen/draft';
import type { DictationStatus } from '../voice/dictation';
import type { ScribeApi } from './useScribe';
import { Waveform } from './Waveform';
import './StudioTell.css';

export interface StudioTellProps {
  text: string;
  onText: (text: string) => void;
  ai: ScribeApi;
  /** The mic's own errors reach the status line through `ai.note`. */
  mic: { status: DictationStatus; partial: string; level: () => number; toggle: () => void };
  textRef: RefObject<HTMLTextAreaElement | null>;
}

const NO_KEY = 'Add an AssemblyAI key to let Chef format and suggest.';

function SuggestionIcon({ s }: { s: Suggestion }) {
  const Icon = !s.patch ? Lightbulb : s.patch.type === 'add_step' ? Plus : s.patch.type === 'set_minutes' ? Timer : ShoppingBasket;
  return <Icon size={16} strokeWidth={2.25} aria-hidden="true" />;
}

function Suggestions({ ai, fallbackFocus }: { ai: ScribeApi; fallbackFocus: () => void }) {
  const list = useRef<HTMLUListElement>(null);
  const thinking = ai.busy === 'suggest';
  if (!ai.enabled) return null;

  // After Apply or Dismiss, focus goes to the next suggestion (its Apply when it has one), or back to the text box.
  const act = (i: number, fn: () => void) => () => {
    fn();
    requestAnimationFrame(() => {
      const rows = list.current?.querySelectorAll<HTMLElement>('.sg-row');
      const row = rows?.[i] ?? rows?.[i - 1];
      const next = row?.querySelector<HTMLElement>('.sg-apply') ?? row?.querySelector<HTMLElement>('button');
      if (next) next.focus();
      else fallbackFocus();
    });
  };

  return (
    <section className="sg" aria-labelledby="sg-title" data-testid="studio-suggestions">
      <h3 id="sg-title" className="sg-title">
        <ChefHat size={16} aria-hidden="true" /> Chef suggests
        {thinking && (
          <span className="sg-thinking" role="status">
            thinking…
          </span>
        )}
      </h3>
      {ai.suggestions.length === 0 ? (
        <p className="sg-empty">Ideas for timing, technique and taste show up here while you work on the card.</p>
      ) : (
        <ul className="sg-list" ref={list}>
          {ai.suggestions.map((s, i) => (
            <li key={s.id} className={s.patch ? 'sg-row' : 'sg-row is-tip'} data-testid="studio-suggestion">
              <span className="sg-icon">
                <SuggestionIcon s={s} />
              </span>
              <p className="sg-text">{s.text}</p>
              <button type="button" className="sg-dismiss" onClick={act(i, () => ai.dismiss(s))} aria-label={`Dismiss: ${s.text}`} title="Dismiss">
                <X size={16} strokeWidth={2.25} aria-hidden="true" />
              </button>
              {s.patch && (
                <button type="button" className="btn btn-ghost sg-apply" onClick={act(i, () => ai.apply(s))} aria-label={`Apply: ${s.text}`}>
                  <Check size={16} strokeWidth={2.5} aria-hidden="true" /> Apply
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StudioTell({ text, onText, ai, mic, textRef }: StudioTellProps) {
  const listening = mic.status === 'listening';
  const starting = mic.status === 'starting';
  const formatting = ai.busy === 'format';
  const status = ai.status;
  const idle = ai.enabled
    ? 'Chef writes it up as timed steps you can edit.'
    : NO_KEY;

  return (
    <section className="tell" aria-labelledby="tell-title">
      <h3 id="tell-title" className="studio-pane-title">
        Tell Chef
      </h3>
      <div className={`composer${listening ? ' is-listening' : ''}`}>
        <label htmlFor="tell-text" className="visually-hidden">
          Your recipe, for Chef to read
        </label>
        <textarea
          id="tell-text"
          ref={textRef}
          className="composer-text"
          value={text}
          placeholder="Paste a recipe, jot it down roughly, or press the mic and just talk it through."
          spellCheck
          onChange={e => onText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ai.enabled) {
              e.preventDefault();
              ai.format('typed');
            }
          }}
          data-testid="studio-text"
        />
        {(listening || starting) && (
          <p className="composer-partial" aria-hidden="true">
            {mic.partial || (starting ? 'Opening the mic…' : 'Listening. Talk it through, step by step.')}
          </p>
        )}
        <div className="composer-bar">
          {/* Ears open: the mic inverts like the kitchen's voice bar, with the level running inside it. */}
          <button
            type="button"
            className="composer-mic"
            aria-pressed={listening || starting}
            aria-label={listening || starting ? 'Stop listening' : 'Talk it through'}
            disabled={!ai.enabled}
            onClick={mic.toggle}
            data-testid="studio-mic"
          >
            {listening || starting ? (
              <>
                <Square size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                <span className="composer-mic-label">Listening</span>
                <Waveform level={mic.level} className="composer-wave" bars={18} gain={9} active={listening} />
              </>
            ) : (
              <>
                <Mic size={18} aria-hidden="true" />
                <span className="composer-mic-label">
                  Talk<span className="composer-mic-more"> it through</span>
                </span>
              </>
            )}
          </button>
          <span className="composer-spacer" />
          <button
            type="button"
            className={ai.unread && !formatting && !listening ? 'btn composer-format is-ready' : 'btn composer-format'}
            disabled={!ai.enabled || !text.trim()}
            onClick={() => ai.format('typed')}
            aria-describedby="tell-status"
            title="Format with Chef (Ctrl or ⌘ + Enter)"
            data-testid="studio-format"
          >
            {formatting ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <ChefHat size={18} aria-hidden="true" />}
            Format with Chef
          </button>
        </div>
      </div>
      <p id="tell-status" className={`tell-status is-${status?.tone ?? 'idle'}`} role="status" data-testid="studio-status">
        {status?.tone === 'done' && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
        {status?.text ?? idle}
      </p>
      <Suggestions ai={ai} fallbackFocus={() => textRef.current?.focus()} />
    </section>
  );
}
