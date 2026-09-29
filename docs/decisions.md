# Decisions Log

Each entry: date, decision, reasoning, alternatives considered, impact. Nothing here is final until explicitly confirmed by the team — entries marked *(pending confirmation)* are proposals surfaced during research/brainstorming, not yet ratified.

---

### 2026-09-16 — Use this repo as a docs-first hackathon workspace, no code until an idea is accepted

**Decision:** Set up `docs/` as the source of truth for problem understanding, research, ideas, architecture, tasks, and handoffs before writing any application code.

**Reasoning:** Explicit team requirement — two developers working in parallel need a shared, current source of truth; documentation-first avoids duplicated exploration and keeps both developers unblocked regardless of who's active when.

**Alternatives Considered:** Jumping straight to scaffolding a frontend and figuring out direction in code — rejected, matches neither the stated working style nor the hackathon's tight, decision-heavy first phase.

**Impact:** No code exists yet; all of the initial doc set (project-overview, brainstorming, research, architecture, tasks, decisions, team-handoff) was created in this pass.

---

### 2026-09-16 — Default technical path: AssemblyAI Voice Agent API over Realtime STT *(pending confirmation)*

**Decision (proposed):** Unless an accepted idea specifically needs STT-only or custom LLM/TTS orchestration, default to the bundled Voice Agent API.

**Reasoning:** Frontend-only, 2-person team, ~14 days left. The Voice Agent API collapses LLM routing, TTS, and turn-taking into infrastructure we don't have to build — directly reduces build risk under time pressure. See [research.md](research.md#1-the-hackathon-in-detail).

**Alternatives Considered:** Realtime STT + bring-your-own LLM/TTS — more control and a stronger "we built the orchestration" story for Application of Technology, but meaningfully more integration work; only worth it if the accepted idea needs STT-only (e.g. a pure live-transcript tool) or a capability the Voice Agent API doesn't route to.

**Impact:** Shapes the architecture (single WebSocket, JSON-schema tool calling) and the token-mint requirement below. Will be re-confirmed once an idea is accepted, since idea 3 (LiveMeetingCoPilot) in brainstorming.md specifically leans toward Realtime STT instead.

---

### 2026-09-16 — Challenge to "no custom backend": add a minimal token-mint function *(pending confirmation)*

**Decision (proposed):** Add one stateless serverless/edge function whose only job is minting short-lived AssemblyAI WebSocket tokens, rather than either (a) shipping the permanent API key client-side or (b) building a real backend.

**Reasoning:** AssemblyAI's docs require server-side token minting for browser WebSocket auth on both API paths (browsers can't set custom WebSocket headers, and AssemblyAI advises against exposing the permanent key client-side). A stateless edge function has no app server, no database, no business logic — it preserves the *spirit* of "frontend only, no backend" while following AssemblyAI's documented security guidance. See [architecture.md](architecture.md#constraint-under-challenge-no-custom-backend).

**Alternatives Considered:**
- Ship the permanent API key client-side — zero infra, but exposes the key to anyone opening devtools on the publicly-submitted demo URL. Rejected as the default; could be a fallback if time runs out.
- Ask the hackathon for a hosted token-mint service — logged as an open research question in [research.md](research.md#5-open-research-questions); would let us skip building this ourselves if it exists.

**Impact:** Adds one small piece of "not quite frontend-only" infrastructure to every idea's build. Needs explicit sign-off from the team since it modifies a stated constraint — flagging here rather than assuming.

---

---

### 2026-09-16 — Token-mint-server pattern confirmed as AssemblyAI's own official approach

**Decision:** Treat the token-minting-function approach (proposed above) as confirmed, not just our best guess — no longer "pending confirmation" on the *pattern* itself, only on *which idea/framework* it gets built into.

**Reasoning:** AssemblyAI's own official example repos (`voice-agent-starter-js`, `realtime-transcription-browser-js-example`) both implement exactly this — a small server whose only real job is minting short-lived tokens, with the permanent API key never reaching the browser. See [research.md §6](research.md#6-official-starter-kits-sdks--example-repos).

**Alternatives Considered:** No new alternatives surfaced; this just upgrades our confidence in the option already chosen over shipping the permanent key client-side.

**Impact:** Removes one open risk from [architecture.md](architecture.md). Still open: whether we hand-roll this (edge function) or adopt AssemblyAI's starter kit wholesale (see next entry).

---

### 2026-09-16 — Open: build our own scaffold vs. fork AssemblyAI's official starter kit *(pending confirmation)*

**Decision (not yet made):** Whether to build our frontend from scratch (e.g. React/Vite + a hand-rolled edge function for token minting) or fork [`voice-agent-starter-js`](https://github.com/AssemblyAI/voice-agent-starter-js) as our starting point.

**Reasoning for considering the fork:** it already has the token-mint server, a declarative JSON-based agent-publish flow, nine working tool-calling examples (BYO-LLM, web search, CRM read/write, calendar booking), Twilio phone deployment for free, a Render one-click deploy config, and — notably — ships `CLAUDE.md`/`AGENTS.md` files, meaning it's designed to be extended by a coding agent like the one building this project.

**Reasoning for considering a from-scratch build:** more control over frontend UX/design (several of our candidate ideas, e.g. RehearsAI's scoreccard UI or Workflow Voice Console's kanban board, need a fair amount of custom UI the starter kit doesn't provide out of the box); avoids inheriting structure/conventions we don't need.

**Impact:** Affects how fast we can move once an idea is picked. Needs a decision alongside idea selection and framework choice — not blocking brainstorming, but should be resolved in the same conversation as accepting an idea.

---

### 2026-09-28 — Drop BPM/Kissflow-adjacent ideas; pick a use case where voice is genuinely useful

**Decision:** Thomas rejected the Sep 25 seeds (Voice Approvals Inbox, Talk-to-Build Process Designer) as too close to Kissflow. New filter: the use case must be one where a voice agent is *actually* useful, meaning voice clearly beats typing or tapping in the real moment.

**Reasoning:** Thomas's call. It also avoids any employer-IP ambiguity in a public MIT repo.

**Alternatives Considered:** Seeds A and B from 2026-09-25 (logged in brainstorming.md, now Rejected).

**Impact:** Re-ideation on Sep 28, with about 2.5 days to the deadline. The plan: MVP built overnight Sep 28, polish Sep 29, video and submission Sep 30.

---

### 2026-09-28 — No backend at all: connect the browser straight to the Voice Agent WebSocket with the API key

**Decision:** The MVP is a pure static frontend. The browser opens `wss://agents.assemblyai.com/v1/ws?token=<API_KEY>` directly with the hard-coded key. No token-mint function and no proxy. This **supersedes** the 2026-09-16 token-mint decisions above.

**Reasoning (spike run 2026-09-28):**
- `GET /v1/token` works server-side (200, token minted), but it has **no CORS headers** and the preflight returns **405**. A browser `fetch` to it is blocked ("Failed to fetch", confirmed in a real browser on `http://localhost`).
- The WebSocket **accepts the permanent API key as the `token` query param**. From a real browser on a localhost origin it returned `open` → `session.updated`.
- A bogus key is rejected (`session.error: unauthorized`, close 1008), so the key really is being authenticated.
- Thomas explicitly asked for hard-coded credentials and no backend.

**Alternatives Considered:**
- Token-mint edge function: needs hosting config and adds a failure point. Unnecessary now.
- Same-origin rewrite proxy (Vercel/Netlify) for `/v1/token`: works with config only, and is the **fallback** if AssemblyAI stops accepting the raw key on the WebSocket.

**Impact / risks:**
- Passing the raw key as `token` is **not documented** behavior (docs describe `token` as a temporary token), so it could change. The rewrite-proxy fallback above covers that.
- The key is visible in the deployed JS bundle. Accepted for the demo. **Rotate the key after judging.**
- Keep the key out of the public repo: it lives in a gitignored `.env.local` (`VITE_ASSEMBLYAI_API_KEY`). Vite inlines it at build time, so it's still hard-coded in the built app but never committed.

---

### 2026-09-28 — Build "Heard, Chef"

**Decision:** Build **Heard, Chef** (brainstorming B1), a voice head chef that runs the timing of a multi-dish dinner. It calls each step out loud and re-plans every dish when the cook reports a problem.

**Reasoning:** Of the Sep 28 shortlist, it's the clearest case of "voice is actually useful": raw-chicken hands, eyes on the pan. None of the 216 submissions covers cooking. It gives the richest frontend and a visible showcase of AssemblyAI (unprompted spoken calls driven by app state, plus client-side tool calls). The skeptics' main risk, "Alexa does timers", is handled by leading with the re-plan.

**Alternatives Considered:** Sideline (youth-sports playing time: useful, less visual), Buzzkill (the most original, but a toy), Hush (Amazon already ships voice baby logging).

**Impact:** Spec at [specs/2026-09-28-heard-chef-design.md](superpowers/specs/2026-09-28-heard-chef-design.md), plan at [plans/2026-09-28-heard-chef.md](superpowers/plans/2026-09-28-heard-chef.md). MVP to be built overnight Sep 28→29.

---

### 2026-09-28 — Stack and scope for the MVP

**Decision:**
- Vite + React + TypeScript, built from scratch rather than forking `voice-agent-starter-js`, because the starter needs a Node server and we want no backend.
- Vitest for tests. lucide-react for icons, motion for animation, and Archivo as the only font.
- Voice Agent API with inline session config (no stored agent), client-side tools only, and a callout queue for proactive speech.
- Deliverables: the codebase plus the demo video. Hosting is optional and deferred.

**Reasoning:** "Keep it simple, no backend at all" (Thomas). Every piece above runs in the browser. Fewer moving parts means less to go wrong overnight.

**Alternatives Considered:** Forking the official starter kit (it has a server), a stored agent via `POST /v1/agents` (an extra publish step), and Realtime STT with our own LLM/TTS (more to build).

**Impact:** The architecture is final; see the spec §4.

---

### 2026-09-28 — Design direction (Impeccable)

**Decision:**
- **Voice:** a calm head chef on the pass.
- **Look:** a dark "kitchen pass": near-black surfaces, bright white tickets, flame orange only for "do this now", saffron for time, herb green for ready.
- **Demo menu:** Indian dinner (chicken curry, jeera rice, garlic naan). The Western menu is included too.
- **Palette seed:** Impeccable seed-016 (hue 20).

**Reasoning:** Thomas's picks via Impeccable's discovery questions. The scene is a laptop glanced at from 2 m under evening kitchen light, which favors a dark surface with a few high-contrast elements.

**Alternatives Considered:** For the voice: a friendly home cook, a playful sous-chef. For the look: bright and fresh, bold tomato-red. For the demo menu: Western dinner.

**Impact:** Captured in [PRODUCT.md](../PRODUCT.md) and spec §8. Note: the Impeccable update to v4.4.0 failed (their server returned a 404); tonight uses v3.9.1.

---

### 2026-09-28 — v2 scope: "Hey Chef", conversation, guardrails, wow UI, pitch

**Decision:**
- **The browser always listens.** A second AssemblyAI socket (Universal-Streaming STT) detects "Hey Chef" from word timestamps. Only audio from the "hey" onward is replayed into the Voice Agent session; before that, the agent receives silence.
- **Chef is conversational:**
  - a ~7 s follow-up window after it answers
  - "Hey Chef" cuts Chef off mid-sentence
  - hold Space for push-to-talk
  - cooking Q&A mid-cook, with prompt guardrails for off-topic requests
- **Eight required wow moments** (spec §8).
- **Tests:** stronger UI tests (component tests plus Playwright flows plus a real-voice fake-mic test).
- **`docs/pitch.md`** is a deliverable.

**Reasoning:** Thomas asked for all of this before sleeping. The approach was probed first:
- the STT accepted 24 kHz binary audio with keyterms
- it caught "hey chef" about 1.2–1.8 s after it was spoken
- it returned word starts in stream milliseconds, which is what makes an exact pre-roll replay possible

**Alternatives Considered:**
- Stream everything to the agent and have it ignore anything not addressed to it. Rejected: the agent replies to every turn, and kitchen chatter would trigger tools.
- Client-side keyword spotting without STT. Rejected: no reliable in-browser wake-word model without extra dependencies.

**Impact:** The spec and plan were rewritten as v2. The pre-verified modules (wake, ears, preroll, captions) passed their checks in a scratch run.

---

### 2026-09-28 — Task 3 review: `stripWake` shares `findWake`'s vocabulary

**Decision:** `src/voice/wake.ts` now builds the `stripWake` pattern from the same `PREFIXES`, `NAMES` and `SOUNDALIKES` sets that `findWake` uses, instead of the plan's hand-written regex. A test covers the sound-alikes.

**Reasoning:** The plan's regex only stripped `chef`/`shef`/`jeff`, but `findWake` also wakes on `chefs`, `chef's`, `chevy` and `sheff`. After a wake like "Hey Chevy, how long?", the cook's live caption and log line (Task 4 passes them through `stripWake`) would have shown the wake phrase, or a stray `'s,` for "chef's".

**Impact:** Deviation from the plan's Task 3 code for `stripWake` only. The plan's tests are unchanged and still pass.

---

### 2026-09-29 — Task 4: Chef speaks in the `michael` voice

**Decision:** `buildSession` sets `output: { voice: 'michael' }`, and `agentConfig.test.ts` asserts it.

**Reasoning:** The [Voices](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices) page lists 11 English voices by accent only, with no notes on tone. All 11 were auditioned live on the same kitchen call, measuring pace and pitch as proxies for "calm, warm":
- `michael` (US) was low (median about 94 Hz), one of the slowest (about 4.7 words/s), paused between sentences, and kept a moderate intonation range (about 41 Hz), so it wasn't flat.
- `anna` (the default) was higher (about 200 Hz) and faster (about 5.2 words/s).
- `charles` and `paul` were low but flat (range about 20 Hz).

**Alternatives Considered:** Keeping `anna`, or choosing British male `paul` or `charles`. A human should still listen before the demo. The voice is fixed once the session starts, so switching is a one-line change in `buildSession` plus its test.

**Impact:** No behaviour change beyond the sound of Chef. The live suite passes with it.

---

### 2026-09-29 — Task 4: live agent tuning and one typings cast

**Decision:** The live suite (`npm run test:e2e`) passes 7/7 after three prompt and tool-description changes in `src/voice/agentConfig.ts`:
1. **Dish vs ingredient.** "I burnt the garlic for the curry" got "Which dish? The curry or the naan?" in 3 of 3 runs, because "garlic" collides with "Garlic naan". The prompt now says to go by the dish the cook names, not an ingredient that sounds like a dish, and to ask which dish only when none is named. `restart_step` now covers an ingredient in a dish's step, with the same example. After the change: 3 of 3 runs called `restart_step {dish: chicken_curry}`.
2. **Guard example gave a made-up time.** Both off-topic cases repeated the prompt's example word for word: "Not my station. The rice goes on in two minutes, though." That time came from the model, not the planner, which breaks the "truthful numbers" constraint, and it names rice even on the western menu. The example is now "Not my station. Let's get back to dinner.", and the rule adds "without quoting any times". Chef now says exactly that.
3. **Say what the answer is about.** "Can I use butter instead of ghee?" sometimes got "Yep. It'll be a bit creamier but will work just fine." That's right, but it doesn't work by ear from across the kitchen. A new line asks Chef to name the thing it's answering about, with a lime/lemon example so the test isn't just echoed. After the change: 3 of 3 answers started with "Butter works fine for the rice" or "Butter's fine for the rice", and none called a tool.

Also, `SttSocket.sendPcm` casts `chunk as Int16Array<ArrayBuffer>` for `WebSocket.send`. This is the same TS ≥ 5.7 typed-array generics issue the plan notes for `audio.ts`. It's a typings difference only; mic chunks are always `ArrayBuffer`-backed.

**Reasoning:** The plan's rule is to tune only the prompt and tool descriptions until the live cases pass, keeping `agentConfig.test.ts` green. That test still passes unchanged.

**Impact:** One live run also failed with a WebSocket `socket error` before `session.ready`, right after the voice auditions. The next run connected normally, so treat it as transient.

---

### 2026-09-29 — Task 4 review: three runtime fixes in `useChefSession`

**Decision:** Three changes to the plan's `useChefSession.ts`, each measured live or reproduced in the new `useChefSession.test.ts` (fake sockets, no key):
1. **Callouts wait for Chef to speak tool results.** The plan cleared `pendingToolResults` at `reply.done`, so a queued call went out as `reply.create` right after `tool.result`. Live, that collides with the follow-up reply: it ends at once with no audio, the call is sent twice, and the answer is treated as a callout (not logged, no follow-up window). Now the gate stays closed until the follow-up's `reply.started`, or 3 s if none comes.
2. **Interrupting really stops Chef.** `reply.audio` arrives at about real time (9.06 s of audio over 8.95 s), so `flush()` alone drops only ~150 ms and the next chunk plays on. Push-to-talk and a wake with the ears asleep now also drop the rest of that reply's audio and caption words until the next `reply.started`. A wake with the ears already open still only flushes, since the agent hears the cook and barges in itself.
3. **Stop while connecting.** If `stop()` ran before `start()` finished, `start()` still went `live` (a leaked timer, open sockets and mic) or showed an error. Now it tears the stale runtime down quietly. `AudioEngine.close()` ignores a second close.

**Reasoning:** The spec asks for callouts that never talk over a pending answer, and for "Hey Chef" to cut Chef off instantly.

**Impact:** Runtime behaviour only. The live suite still passes 7/7.

---

### 2026-09-29 — UI build decisions (Task 5)

**Decision:**
- **Caption spacing is normalised.** Measured: `transcript.agent.delta` sends whole words, but only some have a trailing space (`"serving "`, `"8:00"`, `"PM."`), so `splitCaption` trims each word and joins with single spaces.
- **Captions roll** like live TV captions (a window of the newest words) so a long reply never pushes the voice bar off screen.
- **The rail shows one labelled marker per dish** (its next call) and small pips for later steps, and it is hidden on phones. The first version labelled every call and the labels collided.
- **The AM/PM suffix on the split-flaps is plain text, not flaps.** Tiny flaps read as a glitch.

**Reasoning:** Each came from reading real screenshots of the running app, including a real-voice run.

**Alternatives Considered:** Keeping the motion library for rail animation. Dropped after the audit (see below).

**Impact:** No change to the spec's intent.

---

### 2026-09-29 — Design review and fixes (Task 7)

**Decision:** Ran Impeccable's critique as three isolated agents: design review, detector, technical audit. The results were a design score of 26/40, a clean detector scan, and an audit score of 13/20. Every major issue and most minor ones were fixed:
- **NEXT UP is the hero** (54 px call, 48 px countdown), and simultaneous calls show as "Also now: …".
- **Tickets carry plain-language state** (Waiting, Fire · start now, Cooking, Holding, Ready) and one big time. They also gain **+5 min / Done** buttons, so re-planning works without voice and a misheard re-plan can be fixed by hand.
- **Pause is loud:** a saffron banner with a Resume button, and the tickets dim.
- **Contrast:** `--fire` darkened to L 0.58 so small white text passes AA (4.6:1). `--fire-text` is used for flame text on dark, and `--faint` rose to L 0.62.
- **Accessibility:**
  - Overlays make the page `inert` and restore focus when closed.
  - The countdown is no longer an `aria-live` region; a hidden announcer speaks only when the call changes.
  - Re-plan chips show under reduced motion.
  - Space and Enter are no longer stolen from focused buttons.
  - The kitchen has an h1 and h2 structure, and hold-to-talk works from the keyboard.
- **Performance:**
  - The motion library is gone; the rail uses CSS transitions, gliding only on a re-plan. The bundle dropped from 133 KB to 92 KB gzipped.
  - Ticket shadows use pseudo-elements instead of `filter`.
  - The store skips renders while paused, and the rAF loops stop when idle.
- **Other fixes:**
  - An "End" button leaves the kitchen.
  - The serve-delta chip no longer shifts the clocks.
  - The start-screen teaser is printed on an order ticket, and the brand mark is neutral so flame keeps its meaning.

**Reasoning:** The core principle, glanceable from two metres, wasn't being met between calls, and several WCAG AA failures sat on the most important surfaces.

**Alternatives Considered:**
- Auto-entering glance mode when idle. Not done; it would take control away from the cook.
- A '?' help overlay. Rotating "Try saying…" examples in the captions area cover the key need.

**Impact:** All 84 unit/component tests, the 4 browser flows, the real-voice test and the 7 live agent tests pass after the changes.

---

## 2026-09-29 — Menus, the cook's own recipes, and a calmer pass

**Decision:**
- Cooks pick from 4 built-in menus (Indian dinner, Western dinner, Weeknight pasta, Dal & roti night) or menus they've saved, and customise Tonight's dishes before cooking.
- They add their own recipes in a **recipe studio**, by typing or by voice (Universal-Streaming dictation). The **Voice Agent API acts as a text-in "scribe"**: it formats the text into timed steps and suggests improvements.
- Recipes and menus are kept in `localStorage`.
- Mid-cook, "Hey Chef, add the dal" or "drop the naan" re-plans through new `add_dish`/`remove_dish` tools.
- The kitchen pass is decluttered and fitted to 1600×878, which is Chrome at 90% zoom on Thomas's 1440×900 MacBook, where the demo video is recorded.

**Reasoning:** Thomas asked for these on Sep 29. The **LLM Gateway isn't available** on our key (see [research.md §8](research.md#8-measured-voice-agent-api-behavior-probes-run-2026-09-28)), and its preflight fails CORS. Using the Voice Agent API for text keeps the app backend-free and uses only AssemblyAI. **localStorage over sessionStorage:** "cook it again next time" has to survive a reload, and it's still browser-only.

**Alternatives:**
- The LLM Gateway (no access).
- A client-side rules parser (brittle, and no suggestions).
- A conversational voice intake with Chef talking back (slower, harder to edit; dictation plus a live card reads better on video).
- sessionStorage (lost when the tab closes).

**Impact:**
- A spec is in [superpowers/specs/2026-09-29-menus-and-recipe-studio.md](superpowers/specs/2026-09-29-menus-and-recipe-studio.md).
- New modules: `library.ts`, `draft.ts`, `scribe.ts`, `dictation.ts`, and `RecipeStudio`.
- Chef's prompt now has recipe notes (ingredients), so it can answer "how much rice?".
- **The lablab title must be "Heard Chef"** (the form allows letters and spaces only).

## 2026-09-30 — The demo video is automated, fully live, and voiced with AssemblyAI

**Decision:**
- The demo video is recorded by a script (`video/`) rather than by hand.
- It records one continuous take of the production build through the real APIs.
- The cook's lines are pre-rendered with an AssemblyAI voice (`anna`) and played into the app through a virtual microphone.
- The narration is AssemblyAI's `mary`, rendered through the Voice Agent API and checked word for word against the agent's transcript.
- The editor trims only dead air (the 7–12 s before each reply, down to 0.9 s) and the call barrage when skipping to service.

**Reasoning:**
- Thomas asked for a Google TTS voice-over, but the key's API restrictions block both Google speech APIs. He chose AssemblyAI voices instead, which keeps the whole demo AssemblyAI.
- A scripted live take is repeatable (18 takes overnight) and honest: every reply is real.

**Alternatives:** Screen-recording a human session (not possible overnight); macOS voices (less natural); a mocked session (not honest).

**Impact:**
- Recording found and fixed real app bugs: mid-answer barge-in, verbose re-plans, a stale studio tip and fused wake words.
- The recording deliberately doesn't show the reply latency. It's documented in the handoff.

## Open Decisions (not yet made)

- Hosting for the lablab "Application URL" field. It's optional; the build is static. Decide on Sep 30, weighing that the key would be visible in the deployed bundle.
- Developer B's name and role in the final polish, video and slides.
