# Heard, Chef — Design Spec

**Date:** 2026-09-28 · **Status:** Draft for Thomas's approval · **Deadline:** Sep 30, 8:30 PM IST
**Related:** [PRODUCT.md](../../../PRODUCT.md) · [brainstorming.md](../../brainstorming.md) (B1) · [research.md §8](../../research.md) (measured API behavior)

## 1. What we're building

A browser app that runs the timing of a multi-dish dinner by voice. The cook says what they're making and when they eat. Chef plans every dish backwards from serving time, **calls each step out loud when it's due**, and **re-plans every dish** when the cook reports a problem. The screen is a glanceable "kitchen pass" that mirrors every call.

**Positioning:** the dinner timer you can talk back to.

**Deliverables (Thomas):** a codebase (public GitHub repo, MIT) and a demo video. Hosting is optional and not part of tonight's scope.

## 2. Hard constraints

- **No backend at all.** Static Vite + React app. The browser connects straight to `wss://agents.assemblyai.com/v1/ws?token=<API_KEY>` (verified 2026-09-28).
- The key is hard-coded via the gitignored `.env.local` (`VITE_ASSEMBLYAI_API_KEY`). It's never committed. Rotate it after judging.
- Keep it simple: one screen plus a start screen, six recipes, five tools. No accounts and no persistence beyond the tab.
- Target browser: desktop Chrome. Video at 1440×900 or 1920×1080. Must also compose sensibly on a tablet (≥ 900 px) and stack on a phone.

## 3. The experience

1. **Start screen.** Pick a menu (Indian dinner or Western dinner) and "serve in" (30 / 45 / 60 min), then press **Start cooking**, which asks for mic permission.
2. **Chef greets:** "Chef here. Chicken curry, jeera rice and garlic naan, serving at 8:00 PM. Heard?"
3. **The kitchen clock runs** at demo speed by default: 30×, so 1 kitchen minute = 2 real seconds. It can be set to 1× (real kitchen), 10×, or paused.
4. **Chef calls steps unprompted** when they're due ("Naan. Mix and knead the dough."). A soft service-bell ding plays and the call appears on screen at the same moment.
5. **The cook talks back** in plain words:
   - "The curry needs ten more minutes" → everything re-plans. The serve clock moves 8:00 → 8:10, later steps slide, and Chef says "Heard. Serving now 8:10."
   - "Guests are running twenty minutes late" → serving moves; pending steps slide.
   - "I burnt the garlic" → the curry's current step restarts; the plan re-flows.
   - "Naan dough's done" → that step closes early; the dish holds until its next call.
   - "What's next?" → Chef reads the next calls.
6. **Service.** When every dish is done: "Service. Everything's ready. Plate up." The screen shows the served state.

## 4. Architecture

```
Browser (static, no backend)
├─ Kitchen core (pure TS, unit-tested)
│   ├─ recipes.ts   6 recipes, 2 menus
│   ├─ planner.ts   createPlan / align / advance / reportDelay / shiftServe / restartStep / markDone / upcoming / describeChange
│   ├─ clock.ts     virtual kitchen clock (speed, pause, jump)
│   └─ store.ts     external store (useSyncExternalStore): plan, clock, log; emits KitchenEvents on tick
├─ Voice layer
│   ├─ agentSocket.ts   WebSocket client for the Voice Agent API
│   ├─ audio.ts + public/pcm-capture-worklet.js   mic → PCM16 24 kHz → base64 chunks (50 ms); playback queue
│   ├─ pcm.ts           pure PCM helpers (unit-tested)
│   ├─ calloutQueue.ts  speaks Chef's proactive calls only when it is safe (unit-tested)
│   ├─ agentConfig.ts   system prompt, greeting, tools, keyterms, turn detection
│   ├─ tools.ts         executes tool calls against the store (unit-tested)
│   └─ useChefSession.ts  wires socket + audio + queue + store
└─ UI (React) — designed with Impeccable (see §8)
```

**Data flow:**
1. Mic → AudioWorklet → PCM16 24 kHz → `input.audio`.
2. The agent calls a tool → `tools.ts` changes the plan **immediately**, so the UI updates optimistically → the result is sent back after `reply.done` → Chef reads the planner's summary aloud.
3. Clock tick → `advance()` emits `step-started` events. That triggers the bell, an on-screen call, and a spoken call via the callout queue (`reply.create`).

**Protocol facts** (measured 2026-09-28, see research.md §8):
- Input and output audio are `audio/pcm` at 24 kHz. The default voice is `anna`.
- `tool.call.arguments` arrives as an object.
- `reply.audio.data` is base64 PCM16.
- Events used: `session.ready`, `input.speech.started/stopped`, `transcript.user`, `reply.started`, `reply.audio`, `transcript.agent`, `tool.call`, `reply.done` (`status: "interrupted"` on barge-in), `session.error`.
- `reply.create` sent while the user is speaking is **silently dropped**, which is why the callout queue exists.

## 5. Planner semantics

The core rule is `align(plan, now)`.
- **Serve time** = max(current serve time, each dish's earliest possible finish), rounded up to the minute. It never moves earlier on its own.
- Each dish's **pending** steps are back-scheduled from the serve time, as late as possible.
- **Active and done** steps keep their times.
- If a dish's active step ends before its next pending step starts, the dish is **holding**.

| Report | Tool | Planner effect |
|---|---|---|
| "X needs N more minutes" / "not ready" / "haven't started" | `report_delay(dish, minutes=5)` | Active step's end += N. If no step is active, the next pending step's duration += N. Then align. |
| "Guests late / eat earlier" | `shift_serve_time(minutes)` | Serve += minutes, then align. Moving earlier is clamped to what's physically possible. |
| "Burnt it / starting again" | `restart_step(dish)` | Active step (or the last done step) restarts now, for its full duration. Then align. |
| "X finished early" | `mark_done(dish)` | Active step is done now. Then align (serve time doesn't move). |
| "What's next?" | `whats_next()` | Returns the next 3 calls and the serve time. |

Every tool result carries a **deterministic summary** from `describeChange()`, for example "Serving now 8:10 PM (was 8:00 PM). Jeera rice: rinse & soak rice at 7:37 PM." Chef reads that summary rather than doing any arithmetic.

## 6. Chef's voice (agent config)

- **Persona:** the head chef on the pass. Short kitchen calls, calm, sure, warm, usually under 12 words. "Heard." is the acknowledgement.
- **Rules:**
  - Never compute times; always use tools and read back the summary.
  - Only tonight's dishes exist.
  - No food-safety guarantees; explain how to check doneness instead.
- **Settings:** keyterms are the dish names and short names plus "Heard" and "Chef". `turn_detection.min_silence` = 500 ms. Pick the output voice from the docs' voice list if a calmer, deeper one exists; otherwise keep `anna`.
- **Proactive calls** go out via `reply.create`: `Say exactly this kitchen call and nothing else: "<call>"`. They're sent only when the user isn't speaking, no reply is in progress and no tool results are pending. Calls queued together are merged. A call is retried once if it produced no audio or never started within 4 s. A call is always mirrored on screen regardless.
- **Barge-in:** playback is flushed when `reply.done` arrives with `status: "interrupted"`.

## 7. Recipes

Durations are realistic but demo-friendly. Indian is the demo menu.

- **Chicken curry (35 min):** fry onions, ginger & garlic 8 → add chicken & spices 7 → simmer with tomatoes 20
- **Jeera rice (33 min):** rinse & soak 10 → cumin in ghee, add rice & water 3 → boil, then steam on low 15 → rest, lid on 5
- **Garlic naan (38 min):** mix & knead dough 6 → rest dough 20 → roll & cook 10 → garlic butter 2
- **Roast potatoes (44 min):** peel & chop 6 → parboil 8 → roast 30
- **Salmon (21 min):** season 4 → bake 14 → rest 3
- **Green beans (11 min):** trim 5 → blanch 4 → butter & lemon 2

With "serve in 45 min" from 7:15 PM, the first call is naan at 7:22. At 30× that's about 14 seconds after starting, so the demo gets moving fast.

## 8. Design brief (Impeccable shape)

*Visual direction probes skipped: this harness has no native image generation. This brief is the design contract.*

**Feature summary.** One kitchen screen plus a start screen. The cook runs dinner by voice and glances at the screen from two metres away. It must feel like a professional kitchen pass, not an app and not a dashboard.

**Primary user action.** Hear or read the next call and do it. Secondary: say what's happening and watch the plan re-settle.

**Color strategy: Restrained.**
- Near-black neutral surfaces, bright white dish tickets.
- **Flame** is used only for "do this now" and stays under 10% of the screen.
- **Saffron** marks time and serving.
- **Herb green** appears only when a dish is ready.

**Scene sentence.** A home cook at 7:30 on a weeknight, laptop propped against the backsplash under warm pendant light, hands in dough, glancing over from two metres between stirs. That means a dark surface with no glare, so the few bright elements carry across the room.

**Anchor references:**
- **Toast / restaurant kitchen display screens:** a ticket rail, state colors readable at distance, zero decoration.
- **A split-flap airport departures board:** big tabular times that re-shuffle when something slips. This is the metaphor for re-planning.
- **A Braun kitchen timer:** one bold ring dial, orange on black, with a single glanceable number.

**Palette (OKLCH).** Seed: Impeccable seed-016, hue 20.

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.14 0 0)` | page |
| `--surface` | `oklch(0.19 0 0)` | panels |
| `--surface-2` | `oklch(0.24 0 0)` | raised / hover |
| `--line` | `oklch(0.30 0 0)` | hairlines |
| `--ink` | `oklch(0.97 0 0)` | text on dark |
| `--muted` | `oklch(0.72 0 0)` | secondary text on dark |
| `--ticket` | `oklch(0.96 0 0)` | dish tickets (chroma 0, not cream) |
| `--ticket-ink` | `oklch(0.17 0 0)` | text on tickets |
| `--ticket-muted` | `oklch(0.45 0 0)` | secondary text on tickets |
| `--fire` | `oklch(0.64 0.21 29)` | "do this now": white text on it |
| `--fire-deep` | `oklch(0.52 0.19 27)` | pressed / hover of fire |
| `--saffron` | `oklch(0.86 0.16 85)` | serve clock, countdowns: dark text on it |
| `--herb` | `oklch(0.80 0.17 150)` | ready / done: dark text on it |

**Typography.**
- One family: **Archivo** (variable: `wdth` 62–125, `wght` 100–900, via Google Fonts).
- Condensed heavy weights for clock digits, countdowns and dish names. Normal width for labels and the log.
- `font-variant-numeric: tabular-nums` everywhere digits change.
- Fixed rem scale at a ratio of about 1.2. Glance elements (kitchen clock, NEXT UP, countdowns) are deliberately oversized for a 2 m read.

**Layout strategy (desktop).**
- **Top bar:** wordmark (lucide `ChefHat` + "Heard, Chef"), the kitchen clock (large), the **Serving at** chip (saffron; flashes "+10" when it moves), speed control (1× · 10× · 30× · pause · skip), mic state.
- **Main left, about ⅔: "The pass."** One ticket per dish in a row. Each ticket shows:
  - a round dish photo and the dish name
  - the current step
  - a ring countdown with mm:ss left
  - step dots (step *i* of *n*)
  - a state: waiting / cooking / holding / ready / **fire now**
  - Below the tickets, **"The rail":** a horizontal strip from *now* to *serve* with a flag marker per upcoming call (dish photo + short label), positioned by time. Markers **glide** to new positions on a re-plan. Markers only, **never bars**: this must not look like a Gantt chart.
- **Right, about ⅓:**
  - **NEXT UP:** the single next call in huge type, with "in 1:45" or a flame **NOW** state.
  - **Heard log:** a time-stamped stream of calls (flame dot), Chef's words, the cook's words (quoted) and plan changes ("Serving 8:00 → 8:10").
  - **Voice indicator** at the bottom: listening / you're talking / Chef is talking / muted, with a mic level. It must not be a generic glowing orb.

**Key states.**
- **Start screen:** idle, asking for mic, connecting, error (mic blocked · key rejected · no network · missing key).
- **Kitchen:** live, reconnecting/lost (banner plus a Reconnect button), muted, paused (the clock shows PAUSED).
- **Ticket:** waiting ("starts 7:37"), cooking (ring), holding ("next: roll & cook at 7:48"), fire-now (flame band plus one pulse), ready ("Ready · keep warm", herb).
- **Plan changed:** the serve chip flashes the delta, rail markers glide, a log entry appears, and changed tickets highlight briefly.
- **Served:** a "Service" state that summarises served at *time*, how many re-plans, and a **Cook again** button.

**Interaction model.**
- Voice first.
- Keyboard for the video and for anyone without voice: **N** skip to the next call, **P** pause/resume, **M** mute mic, **S** cycle speed.
- Every control also has a visible button with an accessible label.

**Motion.**
- 150–250 ms state transitions. The re-plan glide is about 400 ms ease-out-quart because it conveys the change.
- The fire pulse runs once per call.
- `prefers-reduced-motion`: instant position changes and crossfades only.

**Content and copy.** Title: "Heard, Chef". Tagline: "The dinner timer you can talk back to."
- **Start screen:** "Chef listens through your mic. Headphones give the cleanest audio." · "Demo speed: 1 kitchen minute = 2 seconds."
- **Errors:**
  - "Microphone is blocked. Allow it from the icon in the address bar, then try again."
  - "AssemblyAI rejected the API key. Check VITE_ASSEMBLYAI_API_KEY in .env.local."
  - "Couldn't reach Chef. Check your internet connection and try again."
  - "Add your AssemblyAI key to .env.local as VITE_ASSEMBLYAI_API_KEY, then restart the dev server."

**Assets.**
- Dish photos: Unsplash, under the Unsplash License. Downloaded into `public/dishes/`, never hot-linked, and credited in the README.
- Icons: `lucide-react` only.
- Font: Archivo from Google Fonts.
- Service bell: synthesized with WebAudio, so there's no asset license to worry about.
- If a photo can't be verified, fall back to Microsoft Fluent Emoji 3D PNGs (MIT) for that dish.

**Impeccable references to load during the build:** layout.md, typeset.md, colorize.md, animate.md, adapt.md, clarify.md.

## 9. Error handling

| Failure | Behavior |
|---|---|
| Missing key | The start screen shows the missing-key message and Start is disabled. |
| Mic denied or missing | Error on the start screen; try again. |
| `session.error unauthorized` | Key-rejected message. |
| Socket closes before ready | Couldn't-reach message. |
| Socket closes mid-dinner | Banner plus a Reconnect button. The kitchen clock keeps running and calls still show on screen. |
| A tool call for a dish that isn't on the menu | The tool returns `{ok:false, error}` and Chef says it in one line. |

## 10. Testing and verification

- **Unit (Vitest):** planner, clock, store, PCM helpers, callout queue, tool executor.
- **Live agent test (opt-in, `AAI_KEY=… npm run test:e2e`, macOS):**
  - Synthesizes cook lines with `say` at 24 kHz and streams them to the real Voice Agent API with our exact session config.
  - Asserts the right tool call: "The curry needs ten more minutes" → `report_delay{dish:chicken_curry, minutes:10}`; the guests-late, burnt-garlic and what's-next lines likewise.
- **Browser:**
  - Dev server plus screenshots at 1440×900, 1024×768 and 390×844.
  - `?debug` exposes `window.__kitchen` so the plan can be driven without a mic.
  - No console errors; `npm run build` passes; Impeccable `detect.mjs` is clean.
- **Human (Thomas, morning):** a real voice run with headphones, then prompt tuning.

## 11. Risks

- **Echo when not using headphones** could cause false barge-in. Rely on Chrome echo cancellation, flush only on a server-confirmed interrupt, and recommend headphones for the video.
- **The raw key as `token` is undocumented.** Fallback: a same-origin rewrite proxy to `/v1/token`.
- **"Alexa does timers" perception.** The demo leads with the re-plan, never with "set a timer".
- **Laptop-mic accuracy in a noisy kitchen.** Out of scope for the demo; mention in the pitch.

## 12. Out of scope (for now)

- Custom dishes and pasting a recipe URL
- Oven and burner resource clashes
- Deployment and multi-device use
- Saved dinners
- Languages other than English
