import { AgentError, AgentSocket, type ServerEvent } from './agentSocket';
import type { SessionConfig } from './agentConfig';
import { DISH_KINDS } from '../kitchen/recipes';
import { capitalize } from '../kitchen/text';
import {
  freshSuggestions, mergeIngredients, normalizeDraft, normalizeSuggestions, MAX_SUGGESTIONS, type RecipeDraft, type Suggestion,
} from '../kitchen/draft';

export const FORMAT_TIMEOUT_MS = 15_000;
export const SUGGEST_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 10_000;
/**
 * After the tool call, wait this long at most for reply.done. Measured: a reply.create sent while a reply is
 * running cuts that reply short, and the new reply may answer both requests, so a reply that runs on this long
 * is dropped with its session rather than overlapped.
 */
const REPLY_GRACE_MS = 3_000;

const SYSTEM_PROMPT = `You are Chef's recipe scribe. You don't talk to a person: the Heard, Chef app sends you requests as text, and you answer only through tool calls. Chef later calls each step out loud and times it on the stove, so your output must work as a timed recipe.

Requests:
- FORMAT: turn the cook's recipe text into a recipe card. Call save_recipe exactly once.
- SUGGEST: look at a recipe card and suggest improvements. Call suggest exactly once.
After the tool call, say only "Done." Never ask questions.

Steps (FORMAT):
- Keep the cook's own steps and order. Don't invent steps they didn't write.
- Usually one step per sentence of the cook's. A sentence that adds things to one pan in turn ("heat ghee, add cumin, then garlic, then onion till golden, then tomato") is ONE step, with the total time.
- Prep done "meanwhile" or "while that cooks" is never a step of its own: put it at the end of the call of the step it overlaps.
- Split a step only when it hides a long wait, like "marinate for 30 minutes" or "rest the dough".
- Most dishes have 3 to 6 steps.
- minutes: realistic home-kitchen minutes for the step, including waiting. Use the cook's times when given. For example: rinse lentils 3, pressure cook for 3 whistles 15, fry onions till golden 8, a full tadka 8 to 12, simmer 5 to 20, rest dough 20.
- label: 2 to 6 words, sentence case, starts with a verb, like "Pressure cook the dal" or "Fry the tadka".
- call: what Chef says out loud when the step starts: a short kitchen call in plain words, under 14 words, not the cook's sentence copied. Don't start it with the dish's name or a one-word heading like "Prep." or "Tadka."; the app adds the dish name itself.
- No "serve", "enjoy" or "plate up" steps.

Example. The cook typed: "Chicken curry. Marinate the chicken in yogurt and spices for 30 min. Meanwhile slice 2 onions. Fry the onions till golden. Add the chicken and tomatoes, cover and cook 20 min. Top with coriander."
The card: name "Chicken curry", short "curry", kind "curry", steps:
1. "Marinate the chicken", 30 min, call "Chicken into the yogurt and spices. Slice the onions meanwhile."
2. "Fry the onions", 8 min, call "Onions into the pan till golden."
3. "Cook the chicken", 20 min, call "Chicken and tomatoes in. Lid on."
4. "Top with coriander", 1 min, call "Coriander on top."

The card (FORMAT):
- name: the dish's name in sentence case, keeping the cook's name for it if they gave one.
- short: the one lowercase word the cook would say for the dish, like dal, curry, rice, naan, pasta, salad.
- kind: the closest kind.
- ingredients: every ingredient mentioned, with its quantity when the cook gave one, like "1 cup toor dal". Don't invent quantities.
- Dictated text came through speech-to-text: ignore filler words and repeats, and fix misheard cooking words (like "tor dal" for toor dal, "dale" for dal).
- If the text has no cooking steps (it isn't a recipe, or it's only a dish name): don't make a recipe up. Call save_recipe with steps: [] and ingredients: [], name and short only if it names a dish (otherwise ""), and exactly one tip suggestion asking for the steps, like "Tell me the steps and I'll time them."

Suggestions (both requests):
- At most 3, each concrete and specific to this dish, about cooking: timing, technique or taste. One short sentence each.
- Prefer suggestions the app can apply: add_step, set_minutes or add_ingredient, with every field filled in. When you suggest two or more, at least two must be applicable, and at most one may be a tip. Use tip only for advice that isn't a change to the card.
- A useful missing step (like soaking, resting or garnishing) is usually the best suggestion: suggest it as add_step with its minutes and call.
- For set_minutes and after_label, use a step label exactly as it appears on the card.
- after_label is the card step the new step FOLLOWS. A step that goes "before X" follows the step before X, or "START" when X is the first step. On the chicken curry card above: "Soak the saffron" before marinating (the first step) is after_label "START"; "Toast the spices" before frying the onions is after_label "Marinate the chicken"; "Rest the curry" at the end is after_label "Top with coriander".
- Never suggest something the card already has: no step it already has, no ingredient already listed (not even with a quantity added), no minutes it already uses.
- The cook said no to everything on the dismissed list. Don't suggest those ideas again, even in other words: if they dismissed adding salt, don't mention salt.
- Nothing about tidying the card itself (listing, clarity, wording), and no "serve and enjoy" advice.
- When the card is thin, suggest the missing basics first (a missing step, a key ingredient, a wrong time).`;

const suggestionItem = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'The suggestion as one short sentence to the cook, e.g. "Soak the dal for 30 minutes first so it cooks evenly."' },
    action: {
      type: 'string',
      enum: ['add_step', 'set_minutes', 'add_ingredient', 'tip'],
      description: 'What applying it does: add_step adds a step, set_minutes changes one step\'s minutes, add_ingredient adds an ingredient, tip is advice only.',
    },
    step_label: { type: 'string', description: 'add_step: the new step\'s label. set_minutes: the exact label of the step to change.' },
    after_label: {
      type: 'string',
      description: 'add_step: where the new step goes. The exact label of the card step that comes right before it, or "START" when the new step comes before every other step (like soaking or marinating first).',
    },
    minutes: { type: 'integer', description: 'add_step: the new step\'s minutes. set_minutes: the new minutes.' },
    call: { type: 'string', description: 'add_step: what Chef says out loud when the new step starts.' },
    ingredient: { type: 'string', description: 'add_ingredient: the ingredient with its quantity, e.g. "1 tsp cumin seeds".' },
  },
  required: ['text', 'action'],
};

const suggestions = { type: 'array', items: suggestionItem, description: 'Up to 3 suggestions.' };

export function scribeSession(): SessionConfig {
  return {
    system_prompt: SYSTEM_PROMPT,
    tools: [
      {
        type: 'function',
        name: 'save_recipe',
        description: 'Save the structured recipe card (FORMAT requests).',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The dish\'s name, e.g. "Dal tadka".' },
            short: { type: 'string', description: 'One lowercase word the cook would say, e.g. "dal".' },
            kind: { type: 'string', enum: DISH_KINDS },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: 'Step name for a ticket, 2 to 6 words, starting with a verb, e.g. "Simmer the dal".' },
                  minutes: { type: 'integer', description: 'Realistic minutes for this step.' },
                  call: { type: 'string', description: 'What Chef says out loud when this step starts. One short line.' },
                },
                required: ['label', 'minutes', 'call'],
              },
            },
            ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingredients with quantities when given, e.g. "1 cup toor dal".' },
            suggestions,
          },
          required: ['name', 'short', 'kind', 'steps', 'ingredients', 'suggestions'],
        },
      },
      {
        type: 'function',
        name: 'suggest',
        description: 'Suggest up to 3 improvements to the recipe card (SUGGEST requests).',
        parameters: { type: 'object', properties: { suggestions }, required: ['suggestions'] },
      },
    ],
    output: { voice: 'michael' },
  };
}

const card = (d: RecipeDraft) => JSON.stringify({ name: d.name, short: d.short, kind: d.kind, steps: d.steps, ingredients: d.ingredients });

const HEARD = 'The cook said this out loud, so it came through speech-to-text.';

const dismissedList = (dismissed: string[]) => dismissed.map(t => `- ${t.trim()}`).filter(t => t !== '- ').join('\n');

export function formatInstructions(text: string, current?: RecipeDraft, source: 'typed' | 'said' = 'typed', dismissed: string[] = []): string {
  const how = source === 'said' ? HEARD : 'The cook typed this.';
  const gone = dismissedList(dismissed);
  const noRepeat = gone ? `\n\nDismissed suggestions (never suggest these or anything like them):\n${gone}` : '';
  if (!current) {
    return `FORMAT request. Turn this recipe into a recipe card and call save_recipe once. ${how}\n\n<recipe>\n${text}\n</recipe>${noRepeat}`;
  }
  return `FORMAT request, updating the cook's card. The card below may have hand edits, so the card wins: keep its name, short, kind, every step (label, minutes and call, in order) and its ingredients. Then add whatever the new text has that the card doesn't: each new instruction becomes a new step, even a quick one like a garnish, placed where the text puts it (after the last step if it doesn't say); new ingredients go at the end. Change a card step only if the new text clearly changes that step. Call save_recipe once with the whole updated card.

<card>
${card(current)}
</card>

New text. ${how}
<recipe>
${text}
</recipe>${noRepeat}`;
}

export function suggestInstructions(draft: RecipeDraft, dismissed: string[]): string {
  const gone = dismissedList(dismissed) || '(none)';
  return `SUGGEST request. Suggest up to 3 improvements to this recipe card and call suggest once.

<card>
${card(draft)}
</card>

Dismissed by the cook (never suggest these or anything like them):
${gone}`;
}

export type ScribeErrorCode = 'auth' | 'connect' | 'timeout' | 'closed' | 'failed' | 'empty';

export class ScribeError extends Error {
  readonly code: ScribeErrorCode;
  constructor(code: ScribeErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ScribeError';
  }
}

const MESSAGES: Record<ScribeErrorCode, string> = {
  auth: 'AssemblyAI rejected the API key. Check VITE_ASSEMBLYAI_API_KEY in .env.local.',
  connect: "Chef's scribe couldn't connect. Check your connection.",
  timeout: 'Chef took too long to read that. Try again.',
  closed: "Lost the connection to Chef's scribe. Try again.",
  failed: "Chef couldn't read that one. Try again.",
  empty: 'Write or say the recipe first.',
};
const scribeError = (code: ScribeErrorCode) => new ScribeError(code, MESSAGES[code]);

function toScribeError(err: unknown): ScribeError {
  if (err instanceof ScribeError) return err;
  if (err instanceof AgentError && err.code === 'unauthorized') return scribeError('auth');
  return scribeError('connect');
}

/** The first call names the dish, like the built-ins: "Dal. Rinse it till the water runs clear." */
export function leadWithShort(d: RecipeDraft): RecipeDraft {
  const first = d.steps[0];
  const short = d.short.trim();
  if (!first || !short) return d;
  const said = first.call.trim().toLowerCase();
  if (said.startsWith(short.toLowerCase()) && !/[\p{L}\p{N}]/u.test(said.charAt(short.length))) return d;
  const call = `${capitalize(short)}. ${capitalize(first.call)}`;
  return { ...d, steps: [{ ...first, call }, ...d.steps.slice(1)] };
}

type Args = Record<string, unknown>;

/** A tool call's arguments as an object, or null when they aren't one (like truncated JSON). */
function parseArgs(raw: unknown): Args | null {
  if (typeof raw === 'string') {
    try { return parseArgs(JSON.parse(raw)); } catch { return null; }
  }
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Args) : null;
}

interface Job {
  tool: 'save_recipe' | 'suggest';
  instructions: string;
  timeoutMs: number;
  generation: number;
  resolve: (args: Args) => void;
  reject: (err: ScribeError) => void;
}

interface Pending extends Job {
  sent: boolean;
  started: boolean;
  /** The reply_id of this request's reply, from reply.started. */
  replyId: string | undefined;
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  release: () => void;
}

/**
 * Chef's recipe scribe: the Voice Agent API used as a text-in LLM. Each request is one reply.create;
 * the answer is the tool call it triggers. No audio is sent, reply audio is ignored, and tool.result
 * is never sent (so no spoken follow-up slows the next request).
 */
export class Scribe {
  private readonly apiKey: string;
  private readonly makeSocket: () => AgentSocket;
  private socket: AgentSocket | null = null;
  private ready: Promise<void> | null = null;
  private live = false;
  private unsubscribe = () => {};
  private pending: Pending | null = null;
  private tail: Promise<void> = Promise.resolve();
  private generation = 0;

  constructor(apiKey: string, makeSocket = () => new AgentSocket()) {
    this.apiKey = apiKey;
    this.makeSocket = makeSocket;
  }

  /** Opens the session if it isn't open. Safe to call any time; reconnects after a drop. */
  connect(): Promise<void> {
    if (this.ready) return this.ready;
    let socket: AgentSocket;
    try {
      socket = this.makeSocket();
    } catch (err) {
      return Promise.reject(toScribeError(err));
    }
    this.socket = socket;
    this.live = false;
    this.unsubscribe = socket.onEvent(e => this.onEvent(socket, e));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(scribeError('connect')), CONNECT_TIMEOUT_MS);
    });
    const ready = Promise.race([socket.connect(this.apiKey, scribeSession()), timeout]).then(
      () => {
        clearTimeout(timer);
        // It can close in the moment between getting ready and here.
        if (this.socket !== socket) throw scribeError('closed');
        this.live = true;
      },
      err => {
        clearTimeout(timer);
        if (this.socket === socket) this.drop();
        throw toScribeError(err);
      },
    );
    this.ready = ready;
    return ready;
  }

  /**
   * Formats recipe text into a card. With a `current` card that has a name or steps, the text is merged into it.
   * `dismissed` (optional) keeps suggestions the cook already turned down from coming back.
   */
  async format(
    text: string, current?: RecipeDraft, source: 'typed' | 'said' = 'typed', dismissed: string[] = [],
  ): Promise<{ draft: RecipeDraft; suggestions: Suggestion[] }> {
    const body = text.trim();
    if (!body) throw scribeError('empty');
    const merging = current && (current.steps.length > 0 || current.name.trim() !== '') ? current : undefined;
    const args = await this.request('save_recipe', formatInstructions(body, merging, source, dismissed), FORMAT_TIMEOUT_MS);
    let draft = normalizeDraft(args);
    if (merging) {
      // The card is the cook's: what they named it survives a merge, text with no steps in it can't wipe it,
      // and no ingredient on it goes missing.
      const steps = draft.steps.length ? draft.steps : merging.steps.map(st => ({ ...st }));
      draft = {
        name: merging.name.trim() || draft.name,
        short: merging.short.trim().toLowerCase() || draft.short,
        kind: merging.kind !== 'other' ? merging.kind : draft.kind,
        steps,
        ingredients: mergeIngredients(merging.ingredients, draft.ingredients),
      };
    }
    // A first call the cook already had on the card stays as they wrote it.
    if (!merging?.steps.some(st => st.call === draft.steps[0]?.call)) draft = leadWithShort(draft);
    const suggestions = freshSuggestions(draft, normalizeSuggestions(args.suggestions, MAX_SUGGESTIONS * 2), dismissed);
    return { draft, suggestions: suggestions.slice(0, MAX_SUGGESTIONS) };
  }

  async suggest(draft: RecipeDraft, dismissed: string[]): Promise<Suggestion[]> {
    const args = await this.request('suggest', suggestInstructions(draft, dismissed), SUGGEST_TIMEOUT_MS);
    return freshSuggestions(draft, normalizeSuggestions(args.suggestions, MAX_SUGGESTIONS * 2), dismissed).slice(0, MAX_SUGGESTIONS);
  }

  /** Ends the session. Requests in flight or queued reject; a later request opens a new session. */
  close() {
    this.generation++;
    const p = this.pending;
    this.drop();
    if (p) this.abort(p, 'closed');
  }

  private request(tool: Job['tool'], instructions: string, timeoutMs: number): Promise<Args> {
    return new Promise<Args>((resolve, reject) => {
      const job: Job = { tool, instructions, timeoutMs, generation: this.generation, resolve, reject };
      this.tail = this.tail.then(() => new Promise<void>(release => this.run(job, release)));
    });
  }

  private run(job: Job, release: () => void) {
    if (job.generation !== this.generation) {
      job.reject(scribeError('closed'));
      release();
      return;
    }
    const p: Pending = { ...job, sent: false, started: false, replyId: undefined, settled: false, timer: undefined, release };
    this.pending = p;
    p.timer = setTimeout(() => {
      // A late answer must not land on the next request, so start the next one on a fresh session.
      this.drop();
      this.settle(p, scribeError('timeout'));
    }, job.timeoutMs);
    this.connect().then(
      () => {
        if (this.pending !== p || p.settled) return;
        if (!this.socket) return this.settle(p, scribeError('closed'));
        p.sent = true;
        this.socket.replyCreate(p.instructions);
      },
      err => this.settle(p, toScribeError(err)),
    );
  }

  private settle(p: Pending, outcome: Args | ScribeError) {
    if (p.settled) return;
    p.settled = true;
    clearTimeout(p.timer);
    if (outcome instanceof ScribeError) {
      p.reject(outcome);
      this.release(p);
    } else {
      p.resolve(outcome);
      p.timer = setTimeout(() => {
        this.drop();
        this.release(p);
      }, REPLY_GRACE_MS);
    }
  }

  /** Fails a request, or if it was already answered, stops waiting for the rest of its reply. */
  private abort(p: Pending, code: ScribeErrorCode) {
    if (p.settled) this.release(p);
    else this.settle(p, scribeError(code));
  }

  private release(p: Pending) {
    clearTimeout(p.timer);
    if (this.pending === p) this.pending = null;
    p.release();
  }

  private onEvent(socket: AgentSocket, e: ServerEvent) {
    if (socket !== this.socket) return;
    const p = this.pending;
    switch (e.type) {
      case 'reply.started':
        if (!p?.sent || p.started) break;
        p.started = true;
        p.replyId = typeof e.reply_id === 'string' ? e.reply_id : undefined;
        break;
      case 'tool.call': {
        if (!p?.sent || p.settled || e.name !== p.tool) break;
        const args = parseArgs(e.arguments);
        if (args) {
          this.settle(p, args);
          break;
        }
        // The rest of this reply is still coming; don't let it overlap the next request.
        this.drop();
        this.settle(p, scribeError('failed'));
        break;
      }
      case 'reply.done':
        if (!p?.started || (p.replyId && typeof e.reply_id === 'string' && e.reply_id !== p.replyId)) break;
        if (p.settled) this.release(p);
        else this.settle(p, scribeError('failed'));
        break;
      case 'session.error':
        if (!this.live) break;
        this.drop();
        if (p) this.abort(p, 'failed');
        break;
      case 'socket.closed': {
        const wasLive = this.live;
        this.drop();
        if (p && wasLive) this.abort(p, 'closed');
        break;
      }
    }
  }

  private drop() {
    const socket = this.socket;
    this.socket = null;
    this.ready = null;
    this.live = false;
    this.unsubscribe();
    this.unsubscribe = () => {};
    socket?.close();
  }
}
