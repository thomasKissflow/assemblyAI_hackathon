# Team Handoff Notes

*Keep this current — it's the first thing to read after pulling latest.*

---

## Latest Handoff — 2026-09-29 afternoon (Claude Code, menus, recipe studio, calmer pass)

### What's new
- **The kitchen pass is calmer** and fits Chrome at **90% zoom** (1600×878) with no scrolling:
  - quieter tickets
  - a step window for long recipes
  - the full rail
  - the Heard log stays pinned to the newest entry
- **Menus.** Four built-in menus (Indian dinner, Western dinner, Weeknight pasta, Dal & roti night) plus your saved menus.
  - Customise tonight: add, remove, or customise a dish as your own copy, then **Save as menu**.
- **Recipe studio** (**New recipe** on the start screen):
  - Type, paste, or **Talk it through** (Universal-Streaming dictation).
  - **Chef's scribe** (the Voice Agent API as a text-in LLM) turns it into timed steps, calls and ingredients, and suggests improvements you can apply.
  - Everything is editable by hand, and edits made while Chef is reading are kept.
  - Saved in this browser (localStorage).
- **Mid-cook:** "Hey Chef, add the dal tadka tonight" or "drop the naan" re-plans everything.
- **Chef knows each dish's ingredients,** so it can answer "how much rice?".
- **Specs and decisions:**
  - [spec](superpowers/specs/2026-09-29-menus-and-recipe-studio.md)
  - [decisions.md](decisions.md): "Menus, the cook's own recipes, and a calmer pass"
  - Why not the LLM Gateway: [research.md §8](research.md#8-measured-voice-agent-api-behavior-probes-run-2026-09-28)

### Test status (all green)
- `npm test`: 309 unit and component tests.
- `npm run test:e2e` (with the key): 16 live tests. That's 10 agent tests (including add/drop dish and a "how much rice" question from the recipe notes) and 6 scribe tests.
- `npm run test:ui`: 17 Playwright flows (menus, own recipes, saved menus across a reload, fit at 1600×878 and 1440×790).
- `npm run test:voice`, `npm run test:studio` and `npm run test:dictation` all pass against the real API.

### Known issues
- **The scribe's suggestions vary from run to run.**
  - Sometimes they're only tips with no Apply button. Press Format with Chef again if you want an applicable one on camera.
  - It sometimes folds "wash/rinse" into the next step.
- **Customising a built-in you already customised** saves a second copy ("your version" appears twice in the picker). Delete one from the picker.
- **After a mid-cook add or drop,** Chef's prompt line "Tonight: …" is stale. The tools use the live plan, so re-plans are still right.
- **With 6 dishes** the start screen scrolls slightly at 1600×878 (3–4 dishes fit).

### Next actions
1. Try the recipe studio with your own voice once.
2. Record the video at 90% zoom ([demo-script.md](demo-script.md)). Delete rehearsal recipes first.
3. Slides and cover image, then the public repo, optional hosting and the lablab submission **as "Heard Chef"**.

---

## Handoff — 2026-09-29 morning (Claude Code, overnight build done)

### Morning checklist (about 15 minutes)

1. `git pull` (if you're on another machine), then `npm install`.
2. Make sure `.env.local` exists with `VITE_ASSEMBLYAI_API_KEY=…`. It's already on Thomas's machine; it's gitignored.
3. `npm run dev`, then open http://localhost:5173 in **Chrome**, with **headphones on**.
4. Pick Indian dinner, then **Continue with voice**, then say "Hey Chef" (the ring should turn green), then **Start cooking**.
5. Try these:
   - Chef calls the naan on its own. Wait for it.
   - "Hey Chef, what's next?"
   - Press **N** until the curry starts, then say "Hey Chef, the curry needs ten more minutes." Serving should flip 8:00 → 8:10.
   - While Chef is talking: "Hey Chef, wait…" It should stop immediately.
   - "Hey Chef, can I use butter instead of ghee?"
   - "Hey Chef, who won the cricket?" Chef should steer you back to dinner.
   - Press **G** for glance mode, **P** to pause, and **N** to skip to service.
6. Tell Claude Code what felt off (wake reliability, voice, pace, wording). Most tuning lives in `src/voice/agentConfig.ts` (prompt and tools) and `src/voice/ears.ts` (listening windows).

### What was built overnight

- **The whole app,** following plan v2 in 8 tasks. Everything is committed; see `git log`.
- **Kitchen logic:**
  - a pure-TypeScript planner that back-schedules every dish and re-plans on a delay, a serve shift, a restart or an early finish
  - a virtual clock (30× demo speed)
  - a store that emits step events
- **Voice, with no backend:**
  - **Universal-Streaming** is the always-on "Hey Chef" ears. Word timestamps drive a pre-roll replay from the "hey".
  - **The Voice Agent API** is Chef ("michael" voice): 5 client-side tools, proactive calls through a queue that never talks over you, word-synced captions, barge-in and push-to-talk (hold Space).
- **UI with Impeccable:**
  - a dark kitchen pass: split-flap clocks, perforated order tickets with countdown rings, a rail of the next calls, a flame NOW card
  - glance mode, a sound check, a service report
  - **+5 min / Done** buttons on each ticket for a voice-free re-plan
- **Design review:** an isolated Impeccable critique scored 26/40 and a technical audit scored 13/20. All the major findings and most minor ones are fixed; details are in [decisions.md](decisions.md).
- **Deliverables:** [pitch.md](pitch.md) (what's unique, the comparison, lablab copy, slide outline), [demo-script.md](demo-script.md), the README, and `docs/screenshot.png` (a real-voice re-plan).

### Test status (all green at hand-off)

- `npm test`: **84** unit and component tests.
- `npm run test:e2e`: **7/7** live agent tests (re-plan routing, the butter question, cricket and the "ignore your instructions" guardrails).
- `npm run test:ui`: **4/4** Playwright flows (a full dinner, the Western menu, 1024 px, 390 px), with no console errors and no horizontal overflow.
- `npm run test:voice`: **passes**. A fake mic says "Hey Chef, the curry needs ten more minutes" through the real APIs and serving flips to 8:10.
- The Impeccable detector is clean, and `npm run build` succeeds.

### Known issues and caveats

- **A real human voice on a real mic hasn't been tested**; synthetic speech has. That's your step 5.
- **Without headphones,** Chef's voice can leak into the mic. Chrome's echo cancellation usually handles it, but record the video with headphones.
- **Passing the raw key as `token` is undocumented.** If it ever stops working, the fallback is a same-origin rewrite to `/v1/token` (hosting config only).
- **The kitchen clock always starts at 7:15 PM** (demo framing), even at 1× speed.
- **Occasional network flake:** one live run had a transient socket error, and one hero-screenshot run failed once and then passed.
- **Tech stack versions:** TypeScript 7, Vite 8, Vitest 5, React 19.3.

### Next actions

See [tasks.md](tasks.md). In short:
1. Your voice run.
2. Tune.
3. Video.
4. Slides and cover.
5. Repo, optional hosting, then submit on lablab (the copy is in pitch.md).

---

## Handoff — 2026-09-28 (Claude Code, idea locked, plan written)

### Current Progress

- **Idea accepted: Heard, Chef.** It's a voice head chef that runs the timing of a multi-dish dinner: it calls each step out loud and re-plans every dish when you report a problem. Why it won: [decisions.md](decisions.md).
- **No backend, verified.** The browser connects to `wss://agents.assemblyai.com/v1/ws?token=<API_KEY>` directly.
- **The real protocol is measured and written down** in [research.md §8](research.md#8-measured-voice-agent-api-behavior-probes-run-2026-09-28). Most important: a proactive `reply.create` is silently dropped if the cook is talking, so the app uses a callout queue.
- **Design decided with Thomas via Impeccable:** calm head-chef voice, dark kitchen-pass look, Indian dinner demo. See [PRODUCT.md](../PRODUCT.md).
- **Spec:** [superpowers/specs/2026-09-28-heard-chef-design.md](superpowers/specs/2026-09-28-heard-chef-design.md)
- **Plan:** [superpowers/plans/2026-09-28-heard-chef.md](superpowers/plans/2026-09-28-heard-chef.md), 7 tasks. The planner and callout-queue code in it was already run against its tests.

### What Is Being Worked On

Waiting for Thomas's OK. Then Claude Code builds the MVP overnight (plan tasks T1–T7).

### Known Issues / Open Items

- The API key goes only in `.env.local` (gitignored). Never commit it; rotate it after judging.
- Passing the raw key as `token` is undocumented. The fallback is a same-origin rewrite proxy.
- The Impeccable update failed (their server returned a 404); v3.9.1 is in use.
- Real-voice testing needs a human with a mic. That's Thomas's first job in the morning.

### Next Actions

1. Thomas approves the plan, then the overnight build starts.
2. Morning: pull, `npm install`, copy the key into `.env.local`, `npm run dev`, and cook a fake dinner with headphones.

---

## Handoff — 2026-09-25 (Claude Code, rescan + re-ideation kickoff)

### Current Progress

- **Timeline reset:** about 5 days left (deadline Sep 30, 8:30 PM IST), not 14. Every "1–1.5 week" estimate in brainstorming.md is stale.
- **Field rescan:** about 150 submissions now. Our top pick (RehearsAI) and dark horse (CareCheck) each have near-identical entries, and so does AccessNav. Details in [research.md, Rescan 2026-09-25](research.md#rescan--2026-09-25-supersedes-the-whitespace-notes-above).
- Whitespace that remains is in BPM/workflow: approver-side approvals, and voice-driven process design. Both fit Thomas's Kissflow background. Logged as seeds in [brainstorming.md](brainstorming.md).

### What Is Being Worked On

Re-ideation with Thomas. Goal for today: confirm one idea, then write the build plan.

### Next Actions

1. Pick the direction and confirm the idea.
2. Resolve open decisions in the same sitting: fork-vs-scratch, framework, hosting, Developer B's split.
3. Write the build plan (4 build days plus 1 submission day).

---

## Handoff — 2026-09-16 (Claude Code, additional research pass)

### Current Progress

Extended the initial research with AssemblyAI's product pages, docs index, GitHub org, and the co-organizer NativelyAI. Two things worth knowing before the next session:

- **The token-mint-server question is now resolved, not just proposed.** AssemblyAI's own official starter kits (`voice-agent-starter-js`, `realtime-transcription-browser-js-example`) both do exactly what [architecture.md](architecture.md) recommended — a small server that mints short-lived tokens, permanent API key never touching the browser. See [research.md §6](research.md#6-official-starter-kits-sdks--example-repos).
- **New open decision:** fork AssemblyAI's official starter kit (fast, officially supported, already has token minting + declarative agent config + working tool-calling examples + Twilio phone deploy) vs. build our frontend from scratch (more UI control for ideas like RehearsAI or Workflow Voice Console). Logged in [decisions.md](decisions.md), not yet decided — should be resolved alongside idea selection.
- Full product/pricing details added to [research.md §3](research.md#3-assemblyai-productapi-notes) ($4.50/hr Voice Agent API, ~1s end-to-end latency, 4 streaming STT model options, ~150ms streaming latency).
- One new risk flagged: the official browser example's README notes real-time API access has historically required an "upgraded account" (card on file) — need to confirm this doesn't apply to hackathon credits.

### What Is Being Worked On

Still nothing in progress — idea selection remains the blocking item (unchanged from previous handoff).

### Next Actions

Same as before, plus: when accepting an idea, also decide fork-vs-scratch (see [decisions.md](decisions.md)).

---

## Handoff — 2026-09-16 (Claude Code, initial setup)

### Current Progress

Nothing built yet, by design. This session did the requirements/research/ideation groundwork the team asked for before any code:

- Extracted full hackathon requirements from the lablab.ai page (timeline, prizes, judging criteria, submission requirements, both technical paths) → [project-overview.md](project-overview.md), [research.md](research.md)
- Found a real technical wrinkle: both AssemblyAI WebSocket APIs need a server-minted short-lived token for browser auth, which complicates the "no custom backend" assumption → flagged, not resolved, in [architecture.md](architecture.md) and [decisions.md](decisions.md)
- Scanned the 40+ already-submitted hackathon projects for prior art / crowded clusters → [research.md §2](research.md#2-competitor--prior-art-analysis)
- Generated and compared 6 candidate ideas against the actual judging criteria → [brainstorming.md](brainstorming.md)
- Proposed (not decided) a default technical path (Voice Agent API) and a top idea recommendation (RehearsAI) — both explicitly marked pending confirmation in [decisions.md](decisions.md)

### What Is Being Worked On

Nothing in progress — the workspace is between the "research" and "converge on an idea" stages.

### Known Issues / Open Items

- **No idea has been accepted yet.** This is the single blocking item — see [tasks.md](tasks.md) for why it's top priority.
- The "no custom backend" constraint has a documented exception need (token minting) that hasn't been signed off by the team yet.
- Developer B is referenced throughout the docs as a placeholder — name/role not yet captured.
- Several open research questions remain unanswered (hosted token-mint service? LLM Gateway details? rate limits on hackathon credits?) — full list in [research.md §5](research.md#5-open-research-questions).

### Next Actions

1. Team reviews [brainstorming.md](brainstorming.md) and either accepts an idea, requests changes to one, or asks for a new batch.
2. Once an idea is accepted, record it in [decisions.md](decisions.md), then flesh out [architecture.md](architecture.md) and [tasks.md](tasks.md) with concrete, owned tasks split across the two developers.
3. Only after that: scaffold the actual frontend project (explicitly out of scope for this session per the "no application code yet" instruction).

---

*(Add new entries above this line, newest first, each time you push a meaningful chunk of work.)*
