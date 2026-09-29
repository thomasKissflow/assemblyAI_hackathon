# Spec: menus, recipe studio, and a calmer pass (2026-09-29)

Requested by Thomas after the overnight build:
1. The kitchen's left panel (the pass) is cluttered. Make it calmer.
2. The demo video is recorded at **90% browser zoom**, so the app must look designed at that size.
3. Cooks pick from a **list of menus** and **customise on the go**. They add their own recipes by **typing or by voice**. AI reads the input, **suggests improvements while they enter it**, and **formats it into a usable recipe** that's stored for next time. No database: browser storage is enough.

Base commit: `f957390` (open recipe/menu model: `DishId = string`, `Recipe.kind`, `createPlan(recipes: Recipe[])`, `store.prepare(recipes, serveIn, label)`).

## 0. Target viewports

- Thomas's machine is a MacBook Air M1 (2560×1600 Retina, which looks like 1440×900).
- At 90% zoom, Chrome's CSS viewport is **1600×878** in a normal window, or **1600×1000** in full screen.

The primary target is 1600×878: everything important must fit without page scroll. Also check 1440×790 (100% zoom), and keep the existing 1024 and 390 layouts working.

## 1. Measured facts this design relies on (probes in `spikes/scribe-probe*.mjs`)

- **The AssemblyAI LLM Gateway can't be used here.** It returns "Your account does not have access to LLM Gateway", and its CORS preflight returns 401. Use the **Voice Agent API as a text-in LLM** instead.
- **`reply.create {instructions}` with the recipe text, plus a tool with a nested JSON schema, works.**
  - A structured `tool.call` arrives in about 1.8 s for a full recipe, and about 0.5 s for small requests.
  - Arrays of objects work in tool parameters.
- **No audio needs to be sent.**
  - A session idle for 25 s still answers.
  - Back-to-back `reply.create` calls work.
- **Don't send `tool.result`.**
  - Without it, there's no spoken follow-up and requests stay fast.
  - With it, Chef speaks "Done." after each call. That's harmless, but it slows the next request.
- Ignore `reply.audio` in scribe sessions; nothing is played.

## 2. Data model (already in `src/kitchen/recipes.ts`)

```ts
type DishId = string;
type DishKind = 'curry'|'rice'|'bread'|'roast'|'fish'|'veg'|'pasta'|'soup'|'salad'|'dessert'|'other';
interface RecipeStep { id: string; label: string; call: string; minutes: number }
interface Recipe { id; name; short; photo: string; kind: DishKind; steps: RecipeStep[]; ingredients?: string[]; custom?: boolean; basedOn?: DishId; updatedAt?: number }
interface Menu { id: string; label: string; dishes: DishId[]; custom?: boolean }
kindPhoto(kind) => `/dishes/kinds/${kind}.svg`   // plate art for custom recipes
BUILTIN_RECIPES, RECIPES (record), BUILTIN_MENUS, MENUS (record), menuRecipes(menuId)
```

### New built-in recipes and menus (Task A1 writes the data; Task A3 supplies `/dishes/<id>.jpg`)

**Menu `pasta`, "Weeknight pasta":**

| id | name | short | kind | steps (label · call · minutes) |
|---|---|---|---|---|
| `tomato_pasta` | Spaghetti pomodoro | pasta | pasta | `sauce` Start the tomato sauce · "Pasta sauce on. Garlic in olive oil, then the tomatoes." · 6<br>`simmer` Simmer the sauce · "Sauce down to a gentle simmer." · 12<br>`boil` Cook the spaghetti · "Spaghetti into salted boiling water." · 10<br>`toss` Toss pasta in the sauce · "Spaghetti into the sauce. Toss it with a splash of pasta water." · 2 |
| `garlic_bread` | Garlic bread | bread | bread | `butter` Mix garlic butter · "Garlic bread. Mash the butter with garlic and parsley." · 4<br>`spread` Butter & wrap the loaf · "Butter onto the bread, then wrap it in foil." · 3<br>`bake` Bake the bread · "Garlic bread into the oven." · 12 |
| `green_salad` | Green salad | salad | salad | `wash` Wash & dry the leaves · "Salad. Wash and dry the leaves." · 5<br>`dress` Whisk the dressing · "Whisk the salad dressing." · 3<br>`toss` Dress & toss · "Dress the salad and toss it." · 2 |

**Menu `veg`, "Dal & roti night":**

| id | name | short | kind | steps (label · call · minutes) |
|---|---|---|---|---|
| `dal_tadka` | Dal tadka | dal | curry | `rinse` Rinse the dal · "Dal. Rinse it till the water runs clear." · 3<br>`cook` Pressure cook with turmeric · "Dal into the pressure cooker with turmeric and salt." · 15<br>`tadka` Make the tadka · "Tadka. Ghee, cumin, garlic and chilli, then pour it over the dal." · 5<br>`finish` Simmer & finish · "Dal down to a simmer. Coriander on top." · 5 |
| `aloo_gobi` | Aloo gobi | gobi | veg | `chop` Chop potato & cauliflower · "Aloo gobi. Chop the potato and cauliflower." · 8<br>`fry` Fry with spices · "Potato and cauliflower into the pan with the spices." · 7<br>`cook` Cover & cook on low · "Lid on the aloo gobi. Low heat." · 15 |
| `roti` | Roti | roti | bread | `dough` Knead the dough · "Roti. Knead the dough." · 5<br>`rest` Rest the dough · "Cover the roti dough. Let it rest." · 15<br>`cook` Roll & cook roti · "Roll the roti. Hot tawa, one at a time." · 10 |

- Menu order is `indian`, `western`, `pasta`, `veg`.
- Every built-in also gets a short `ingredients` list (5–9 items with rough quantities for 4 people), which Chef uses to answer questions.
- Existing built-in steps and timings must NOT change; tests and the demo script depend on them.

## 3. Library (`src/kitchen/library.ts`, Task A1)

- A store object like the kitchen store: `createLibraryStore(storage?: Storage | null)` has `getState(): Library`, `subscribe`, `saveRecipe(r)`, `deleteRecipe(id)`, `saveMenu(m)`, `deleteMenu(id)`.
- Also provide:
  - `libraryStore`, a module singleton on `window.localStorage` when available
  - `useLibrary()`, a hook using `useSyncExternalStore`
  - `newRecipeId(name, lib)`: `my_<slug>` (slug = lowercase a–z0–9 plus `_`, max 24 chars), with `_2`, `_3`… on collision
  - `newMenuId(label, lib)`: `menu_<slug>`
- **The `Library` shape:** `{ recipes: Recipe[]; menus: Menu[] }`, built-ins first and then the cook's own.
  - The cook's recipes carry `custom: true` and use `photo = kindPhoto(kind)`.
  - Deleting a custom recipe also removes it from custom menus. A custom menu left with no dishes is deleted.
- **Storage:** localStorage key `heard-chef.library.v1`, JSON `{ version: 1, recipes: Recipe[], menus: Menu[] }`, holding only the custom entries.
  - Every read and write is wrapped in try/catch.
  - Corrupt or missing data means an empty library plus the built-ins.
  - Without storage, it works in memory only.
- **Why localStorage:** it survives a reload ("next time the user wants to cook it"). It's still browser-only, with no backend.

## 4. Planner, store and voice tools (Task A1)

- **Planner:** add `addDish(plan, recipe, now)` and `removeDish(plan, id, now)`.
  - Both re-align. Serve time never moves earlier on its own; adding a long dish can push it later.
  - Adding a dish already on the plan does nothing.
  - Removing the last dish is refused (the plan is returned unchanged).
- **`describeChange`** also reports added and dropped dishes, e.g. "Added Dal tadka: rinse the dal at 7:41 PM." and "Dropped Garlic naan."
- **Store:** add `addDish(recipe)` and `removeDish(id)`, both through `change()`, so they're logged and counted as re-plans.
- **Voice tools** (`src/voice/tools.ts`, `src/voice/agentConfig.ts`):
  - `buildSession(plan, library: Recipe[] = [])`. The `dish` enum becomes plan dish ids plus library ids, with a description that says which are tonight's and which can be added.
  - New tools:
    - `add_dish {dish}`: "Add a dish from the cook's recipe book to tonight's dinner. Re-plans every dish."
    - `remove_dish {dish}`: "Drop a dish from tonight's dinner."
  - `executeTool(store, name, args, library: Recipe[] = BUILTIN_RECIPES)` resolves `add_dish` through the library. Its errors:
    - "not in your recipe book"
    - "already on tonight's menu"
    - "can't drop the last dish"
  - **System prompt:**
    - Add a short "Adding or dropping a dish" rule: use add_dish or remove_dish only for dishes in the recipe book. For anything else, say they can add it from the start screen.
    - Add a "Recipe book" line listing the addable dish names.
    - Add "Recipe notes" with each tonight dish's ingredients (one line per dish), so Chef can answer "how much dal?".
  - **Keyterms:** tonight's names and shorts plus library names, capped at 40.
  - `useChefSession` passes `libraryStore.getState().recipes` to `buildSession` and `executeTool`.
- **Tests:** unit tests for all of the above. Existing tests must keep passing unchanged, apart from the migration already done.

## 5. Scribe and dictation (Task A2)

### `src/kitchen/draft.ts` (pure)

```ts
interface DraftStep { label: string; minutes: number; call: string }
interface RecipeDraft { name: string; short: string; kind: DishKind; steps: DraftStep[]; ingredients: string[] }
type SuggestionPatch =
  | { type: 'add_step'; after: string | null; step: DraftStep }   // after = label of the step it follows; null = at the start
  | { type: 'set_minutes'; step: string; minutes: number }        // step = label to match
  | { type: 'add_ingredient'; ingredient: string };
interface Suggestion { id: string; text: string; patch?: SuggestionPatch }   // no patch = a tip (dismiss only)
emptyDraft(): RecipeDraft
normalizeDraft(raw: unknown): RecipeDraft
normalizeSuggestions(raw: unknown): Suggestion[]
applySuggestion(d, s): RecipeDraft
validateDraft(d): string[]
draftToRecipe(d, id, opts?: { basedOn?: DishId }): Recipe
recipeToDraft(r): RecipeDraft
totalMinutes(d): number
```

**`normalizeDraft`:**
- Trims strings.
- Clamps minutes to integers 1–240; a missing value becomes 5.
- Keeps at most 12 steps and 20 ingredients.
- An unknown kind becomes `'other'`.
- The default `short` is the last word of the name, lowercased.
- An empty `call` becomes `"<Short>. <label>."`.
- Drops steps with an empty label.

**`normalizeSuggestions`:**
- Maps the scribe's flattened objects `{text, action, step_label?, after_label?, minutes?, call?, ingredient?}` to `Suggestion`, with max 3.
- `action: 'tip'` or an unknown action gives no patch.

**`applySuggestion`:**
- Matches step labels case-insensitively, falling back to a substring match.
- If an `add_step`'s `after` isn't found, the step goes at the end.
- If a `set_minutes` step isn't found, the draft is returned unchanged.
- An ingredient is added only if it isn't already there.

**`validateDraft`** returns human messages that block saving:
- "Give the recipe a name."
- "Add at least one step."
- "Every step needs a name."
- "Total time is over 6 hours."

**`draftToRecipe`** sets step ids `s1..sn`, `custom: true`, `photo: kindPhoto(kind)` and `updatedAt: Date.now()`.

### `src/voice/scribe.ts`

- `scribeSession(): SessionConfig` defines the system prompt and two tools:
  - `save_recipe {name, short, kind(enum), steps[{label, minutes, call}], ingredients[], suggestions[]}`
  - `suggest {suggestions[]}`
- **The suggestion item schema** is flattened: `{text, action: enum['add_step','set_minutes','add_ingredient','tip'], step_label?, after_label?, minutes?, call?, ingredient?}`.
- **The prompt** (tune it with the live test):
  - It's Chef's recipe scribe; requests come from the app as text, not from a person.
  - For a FORMAT request, call `save_recipe` exactly once. For a SUGGEST request, call `suggest` exactly once. Then say only "Done."
  - Keep the cook's own steps, words and order. Merge tiny steps. Split a step only when it hides a long wait (for example "marinate for 30 minutes").
  - Give every step realistic home-kitchen minutes.
  - Labels are 2–6 words in sentence case, starting with a verb.
  - `call` is one short spoken line for when the step starts. The first step's call starts with the dish's short name.
  - `short` is the one word the cook would say for the dish.
  - Ingredients include quantities when given.
  - Suggestions: at most 3, concrete, about timing, technique or taste. Prefer ones the app can apply. Never repeat anything already in the recipe or on the dismissed list. No "serve and enjoy" steps.
  - If the text has no cooking steps, call `save_recipe` with `steps: []` and one tip asking for the steps.
- **`class Scribe`:**
  - `constructor(apiKey: string, makeSocket = () => new AgentSocket())`
  - `connect()` is lazy and idempotent, and reconnects if the socket closed.
  - `format(text: string, current?: RecipeDraft, source: 'typed' | 'said' = 'typed'): Promise<{ draft: RecipeDraft; suggestions: Suggestion[] }>`. With `current`, it asks the scribe to merge the new text into the current card and keep the cook's edits.
  - `suggest(draft: RecipeDraft, dismissed: string[]): Promise<Suggestion[]>`
  - `close()`
  - Requests are serialized, one `reply.create` at a time. Each resolves on its `tool.call` (matched by name) or rejects after a timeout (format 15 s, suggest 10 s).
  - Never send `tool.result`.
  - Map errors to friendly messages ("Chef's scribe couldn't connect. Check your connection.").

### Dictation

- **`src/voice/sttSocket.ts`:**
  - `connect(apiKey, keyterms, opts?: { formatTurns?: boolean })`, default false, which keeps wake-word behaviour identical.
  - `SttTurn` gains `formatted: boolean` (from `turn_is_formatted`).
- **`src/voice/dictation.ts`:**
  - A pure `DictationBuffer` class. `push(turn)` commits a turn on `endOfTurn && (formatted || !formatTurns)`; otherwise that turn's text is the current partial. It exposes `{ committed: string, partial: string }`, where committed is the turns joined with spaces.
  - `useDictation()` hook: `{ status: 'idle'|'starting'|'listening'|'error', committed, partial, error, start(), stop(), level() }`.
    - It uses `AudioEngine.startMic` (mic only, no playback) and `SttSocket` with `formatTurns: true`.
    - Keyterms are common Indian and home-cooking words (jeera, ghee, hing, toor dal, garam masala, paneer, methi, tadka, tawa, roti, naan, biryani, simmer, sauté, parboil, knead…).
    - It releases the mic and socket on stop and on unmount.
- **Tests:**
  - Unit tests: draft.ts; Scribe with a fake socket (request shape, serialization, timeout, ignoring other events); DictationBuffer.
  - **Live test** `src/voice/scribe.e2e.test.ts` (skipped unless `AAI_KEY`):
    - Formatting the dal text gives 3 or more steps, `short` of `dal`, and a kind in the enum.
    - `suggest` on a thin draft returns 1 or more suggestions.
    - Non-recipe text ("what's the cricket score") gives 0 steps.
  - Change the `test:e2e` script to `vitest run e2e.test` so both live suites run.

## 6. Start screen: the menu builder (Task B1)

**Right panel, "What's cooking tonight?":**
1. **Menus:** compact tiles for built-in and saved menus (plates, name, dish count), pressed state, `data-testid="menu-<id>"`. Selecting one loads its dishes into Tonight. Saved menus can be deleted (with confirm).
2. **Tonight:** the editable list of dishes.
   - Each row shows the photo or plate art, the name, "N min · M steps", **Customise** (opens the studio with a copy for a built-in, or the recipe itself if it's theirs) and **Remove**.
   - **Add a dish** opens a picker (a popover or native dialog, never clipped): the library minus tonight's dishes, grouped as "Your recipes" and "Chef's recipes". Your recipes can be edited and deleted there.
   - **New recipe** (typed or spoken) opens the studio.
   - Between 1 and 6 dishes. With 0 dishes, Continue is disabled with a hint.
   - When Tonight differs from the selected menu, offer **Save as menu** (inline name field) and select the saved menu.
3. **Serve in** plus the first-calls preview (it uses plan dishes for photos and names, not `RECIPES[...]`).
4. **Actions.** `onPrepare(dishes, label, serveIn, withVoice)`. The label is the menu's name, or "Tonight" when it's been customised and not saved.

**Constraints:**
- Everything fits at 1600×878 with 3–4 dishes, with no page scroll.
- Keep these testids: `menu-indian`, `menu-western`, `serve-in-*`, `plan-preview`, `start-continue`, `start-cook-without-voice`.
- The hero stays, but may be tightened.

## 7. Recipe studio (Task B2)

`src/ui/RecipeStudio.tsx`: `<RecipeStudio open initial?: Recipe basedOn?: DishId addToTonight?: boolean onClose onSave(recipe: Recipe, opts: { addToTonight: boolean }) />`. The props interface `RecipeStudioProps` is already in the file (a placeholder the studio task replaces). It's a native `<dialog>` modal, sized about min(1120px, 94vw) × min(780px, 92vh).

**Left, "Tell Chef":**
- A large textarea: "Paste a recipe, jot it down roughly, or press the mic and just talk it through."
- **Mic** (dictation): committed turns are appended to the textarea and the live partial shows in muted text. Show a level meter while listening.
- **Format with Chef:** sends the whole text to `scribe.format` (merging with the current card if it has steps).
- After dictation, auto-format **1.2 s after the last committed turn** (single-flight; if more text arrives meanwhile, run once more).
- A status line: "Chef is reading…", errors, and "Formatted: 5 steps, 38 min".

**Right, the recipe card (always editable by hand):**
- Name, "What you call it" (short), and a kind picker showing the plate art.
- Steps: label, minutes (stepper or number input), an optional "Chef says…" line (collapsed by default), move up/down, delete, and **Add step**.
- Ingredients as editable chips.
- Total time.
- New content arriving from the scribe animates in (steps stagger), with reduced-motion fallbacks.

**Chef's suggestions:**
- Up to 3 suggestion cards, each with **Apply** (when it has a patch) or **Dismiss**.
- They come from `format`, and also from `scribe.suggest` **2.5 s after manual edits**, when the card has a name and at least 2 steps, and no request is in flight.
- Dismissed texts are passed back as `dismissed`.

**Footer:**
- Validation messages, **Cancel**, **Save recipe**, and **Save & add to tonight** (the default when opened from Tonight).
- Saving calls `libraryStore.saveRecipe` via `onSave`. The parent decides whether to add the recipe to Tonight.
- When customising a built-in, the saved copy replaces the built-in in Tonight and sets `basedOn`.

**Without a key,** the AI controls are disabled with one line ("Add an AssemblyAI key to let Chef format and suggest") and manual entry still works.

**Lifecycle:** open the scribe when the studio opens (lazily, on the first AI action or on open when there's a key), and close it and stop dictation when the studio closes.

**Also:**
- Keyboard and screen-reader complete: labelled inputs, focus trap from `<dialog>`, Esc closes (confirm if there are unsaved changes).
- Fits 1600×878 without the dialog overflowing; the card pane scrolls internally.

## 8. The pass: calmer and fitted to 90% (Task A4)

**Goals, in order:**
1. **At 1600×878, 1600×1000 and 1440×790,** with voice off and with voice on, the whole kitchen screen fits with **no scroll**. That covers the top bar, the pass (optional paused band, tickets, rail) and the right column (NOW card, captions, voice bar, Heard log). This holds for 1–4 dishes. With 5–6 dishes, tickets switch to a compact mode, and the pass may scroll only as a last resort.
2. **Declutter the tickets:**
   - Fewer fills and borders.
   - No per-row tinted step backgrounds; show time and label. The current step is emphasised, done steps are dimmed, and pending steps are muted.
   - One accent per ticket state.
   - Show the per-dish delta only when it's non-zero, and keep it quiet (keep `data-testid="ticket-delta-<id>"`, text like "+10 min").
   - A smaller photo ring, or a horizontal header, to save height.
   - Equal-height tickets in a row.
   - **+5 min** and **Done** stay visible and accessible but lighter (text buttons).
3. **Rail:** compact, fully visible, no overlapping labels, handles 1–6 lanes.
4. **Dishes added or dropped mid-cook** animate in and out; there's no layout jump beyond the ticket itself.
5. **Keep:**
   - every testid and `data-state`
   - glance mode, pause, reduced motion
   - WCAG AA contrast
   - the 1024 and 390 layouts
   - the Impeccable design language (tokens.css, Archivo, flame only for "now")

Custom recipes render `/dishes/kinds/<kind>.svg` where photos go, so the ring must look right with plate art.

## 9. Assets (Task A3)

- **Photos:** six 480×480 JPGs from Unsplash (free licence) at `public/dishes/{tomato_pasta,garlic_bread,green_salad,dal_tadka,aloo_gobi,roti}.jpg`.
  - Fetch with `https://images.unsplash.com/photo-<id>?w=480&h=480&fit=crop&q=80`.
  - Each must be a top-down or three-quarter plate shot that reads well in a small circle on a dark UI, consistent with the existing six.
  - Credit the photographers in README.md, following the existing list's format.
- **Plate art:** `public/dishes/kinds/<kind>.svg` for all 11 kinds.
  - A 480×480 viewBox, a round plate (subtle rim) on transparent, and a lucide icon (ISC, paths from `node_modules/lucide-react`) centred in a warm tint.
  - Each kind gets a distinct but harmonious hue, and they must read at 28 px and at 160 px.
  - Suggested icons: curry→CookingPot, rice→Wheat, bread→Croissant, roast→Drumstick, fish→Fish, veg→Carrot, pasta→Utensils, soup→Soup, salad→Salad, dessert→CakeSlice, other→ChefHat.
  - Add a small `public/dishes/kinds/README.md` noting the lucide licence.

## 10. Definition of done (all tasks)

- `npx tsc --noEmit` is clean. `npx vitest run` is green (new tests included). `npm run test:ui` is green (existing flows plus new ones). `npm run test:e2e` with the key is green.
- New Playwright flows:
  - Build a recipe by hand, save and add it to Tonight, cook with it, and confirm its ticket appears with plate art.
  - Customise a built-in's step time, and confirm the preview reflects it.
  - Save a menu, reload, and confirm it's still there.
  - Check 1600×878 and 1440×790 for no page overflow on the start screen, the studio and the kitchen.
- A voice-dictation flow with a fake mic (like `e2e/voice.spec.ts`, gated by `VOICE_E2E`): say a short recipe, and the card fills in via the scribe.
- The Impeccable detector is clean on changed files.
- The API key is never written to any tracked file.
