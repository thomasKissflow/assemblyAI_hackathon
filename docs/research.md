# Research Notes

## 1. The Hackathon, in Detail

Source: [hackathon page](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) (fetched 2026-09-16).

### Two supported technical paths

| | **Voice Agent API** | **Realtime STT API** |
|---|---|---|
| What AssemblyAI gives you | STT (Universal-3 Pro) + LLM routing + TTS + turn-taking/VAD + JSON-schema tool calling, all over **one WebSocket** | Real-time STT only, over WebSocket. Sub-second, multilingual. |
| What you bring | Almost nothing — a system prompt, tool definitions, a UI | Your own LLM + TTS + orchestration logic |
| Control | Less — AssemblyAI owns the conversation loop | More — you own the loop |
| Build speed | Fast — this is "the fastest path to a working voice agent" per the tagline | Slower — more integration work |
| Best for | Teams that want a robust agent fast and care more about the *use case* than the *stack* | Teams that want to showcase custom orchestration, non-English/LLM choice flexibility, or need STT-only (e.g. transcription/analytics tools, not a talking agent) |

**Recommendation for a 2-person, ~2-week, frontend-only team: default to the Voice Agent API.** It collapses LLM + TTS + turn-taking into infrastructure we don't have to build, which matters a lot given the timeline. Reach for Realtime STT only if an idea specifically needs STT-only (e.g., a live transcript/analytics tool with no spoken agent reply) or needs an LLM/TTS AssemblyAI doesn't route to.

### Critical technical finding: "frontend only, no backend" needs a caveat

Both APIs require WebSocket auth. Browsers cannot set custom `Authorization` headers on a WebSocket handshake, so AssemblyAI's docs say explicitly: **generate a short-lived token server-side** (`GET /v1/token` with your permanent API key in the `Authorization` header) and pass it to the browser as `?token=`. Tokens are single-use, expire in 1–600 seconds. This applies to **both** the Voice Agent API and Realtime STT.

**Implication:** a pure static frontend with the permanent API key embedded client-side is possible but means shipping a real API key to every visitor's browser — fine for a private demo, risky/against AssemblyAI's own guidance for anything shared publicly. See [architecture.md](architecture.md) for how this changes the "no backend" constraint and the recommended minimal fix (a stateless token-minting function, not a real backend).

Sources: [Voice Agent WebSocket API spec](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/api-spec/voice-agent-websocket), AssemblyAI streaming STT docs.

### Judging criteria (exact wording)

1. **Application of Technology** — how effectively the chosen model(s) are integrated into the solution
2. **Presentation** — clarity and effectiveness of the project presentation
3. **Business Value** — impact and practical value, fit into business areas
4. **Originality** — uniqueness and creativity, ability to demonstrate behaviors

### Submission requirements

- Project title, short description, long description, tech/category tags
- Cover image
- Video presentation
- Slide presentation
- Public GitHub repository
- Demo application URL (hosted somewhere reachable — see hosting note below)

### Constraints/logistics

- Teams: 1–6 people (we're 2)
- Submission deadline: Sep 30, 8:30 PM IST — **hard deadline, same for everyone regardless of join date**
- Original + MIT-compliant submissions required
- A company email at signup is encouraged (not required) — Thomas can use thomas@kissflow.com

## 2. Competitor / Prior-Art Analysis

The hackathon's live submissions page already lists **40+ shipped projects** as of 2026-09-16 (mid-hackathon). This is unusually good competitive intel — most hackathons don't expose the field this clearly before you submit. Read before finalizing an idea, to avoid both direct collisions and to calibrate ambition.

### Clusters already well-covered (treat new entries here as "differentiate hard or avoid")

- **Ops/business-process voice agents:** Robin Voice Ops (home services), HangON (front desk), BugSpeak (voice→GitHub issue), OpsVoice AI / AuraCommand / OpsPilot Voice (SRE/DevOps incident commanders — *three* separate teams built this), Uh-Huh (busy-handed field workers)
- **IT/customer helpdesk:** VoiceDesk AI, TechSəs
- **Insurance claims intake:** ClaimVoice, "the claim intake agent that refuses to guess", EvidenTurn (consumer disputes)
- **Education/tutoring:** KT, EduVoice Copilot, Voice Language Partner
- **Debugging/dev tools:** SpeakToDebug, SpokeUI
- **Accessibility:** voicebridgeai (voice-driven web dashboard navigation for blind/low-vision/motor-impaired users) — **direct prior art** for any "voice-controls-a-webapp" accessibility idea
- **Meeting/call debrief:** Second Listen, Briefkeeper (both post-call analysis, not live-in-call Q&A)
- **Games/entertainment:** Voice Case - The Glasshouse (murder mystery), Radio Universe (AI radio station)
- **Medical/compliance:** AegisOR (OR compliance), Heat Warning Agent (industrial worker safety check-ins)
- **Interview/exam rehearsal:** Officer Parker (US visa interview rehearsal) — closest prior art to a general "pitch/interview coach" idea, but scoped narrowly to visas
- **Sales/lead qualification:** VoxSales, RevenueFlow (WhatsApp voice receptionist), Siberia Voice Agent (voice RAG + lead capture)
- **Security-flavored:** AegisVoice (financial ops security gateway), Second Chair (compliance chaperone), Voxrede (voice-agent red-teaming)

### Whitespace observations

- Almost nothing targets **home/family caregiving** (elder check-ins) specifically — Heat Warning Agent is industrial, AegisOR is clinical/OR. A consumer caregiving angle is comparatively open.
- **General-purpose interview/pitch rehearsal** (job interviews, investor pitches, sales pitches — not just visas) has one narrow neighbor (Officer Parker) but no broad competitor yet.
- Business-process/workflow voice control has several entries, but none framed around **approval chains + audit trail** specifically (most are intake/booking-flavored).
- No entry visibly targets **enterprise BPM/low-code platforms** (Kissflow-style) — if we lean into that, we'd likely be first movers in this specific niche, and it's a domain one of us already knows professionally.

### What this means for scoring

- **Originality** is the criterion most at risk from the crowded clusters above — picking an idea that clones an existing entry's core loop (even with a different UI) will read as derivative to judges who see the whole submission list.
- **Business Value** rewards a crisp, named buyer/user and a believable "who pays for this" story — several existing entries are vague on this; we can differentiate by being specific.

### Rescan — 2026-09-25 (supersedes the whitespace notes above)

The field grew from ~45 submissions / 3,136 participants (Sep 16) to **~150 submissions / 3,748 participants**. Three of our six ideas now have near-identical entries:

| Our idea | New collisions | Verdict |
|---|---|---|
| 1. RehearsAI (interview/pitch coach) | **MockMate** (résumé-aware interviewer, live JSON-schema scoring, filler words + pace, report card: almost exactly our spec), **Interview Lab** (clarity/structure/delivery report), **Mockrill**, VoxHire, CodeTalk, Readdy AI, Probe, Viva (oral exam), LinguSim, and Officer Parker from before | **Dead on Originality.** About 10 entries. |
| 4. AccessNav (voice-drives-a-web-app) | **Talkie** (voice assistant for any website that acts on the page), **Aalto** (Chrome side-panel agent that fills forms and scrolls), Heed, VoiceNova, Koi Charts, and voicebridgeai from before | **Dead.** |
| 6. CareCheck (elder check-ins) | **EverCall "Jarvis for Grandma"** (daily calls to elderly parents, mood/medication/memory analysis, family dashboard alerts: almost exactly our spec), **SilverLine** (elderly patient line, medication confirmations, receipt for family), **Tell** (medication adherence) | **Dead.** |
| 2. Workflow Voice Console | The ops cluster roughly tripled: **CampusFlow** (voice ops desk with a live dashboard reflecting every action, the closest to our demo), EchoLogic, Relay, Benchback, CrewVoice, WalkAround, DockWitness, RECEBE, RouteProof, Recount, EchoAgent, Wavelink, OpenLine, Night Desk | **Generic version is dead.** A narrow angle may survive (see whitespace below). |
| 3. LiveMeetingCoPilot | Meeting Shadow Agent, ClauseCatcher, Saakshi, Second Chair, Echos, plus IncidentBridge (a team still forming) | Crowding fast; still technically risky for us. |
| 5. VoiceQuest (game) | Voice Case, Radio Universe, Playhead (interruptible audiobook) | Unchanged: weak Business Value. |

**Meta-trends that matter for positioning:**
- **"Refuses to guess" / transcript-evidence / human-approval / hash-chained audit** is now claimed by 30+ entries. It's table stakes. Don't pitch it as a differentiator.
- New clusters: **voice-agent reliability tooling** (Tally, Patchline, Say Less, Voice Action Gate, ToneGap, Voxrede), **healthcare intake/triage** (MediVoice ×2, MediScribe, Voicemed, Veritas, Kwik 112, Rollcall), **agents that phone on your behalf** (Afterward, Orion, Rollcall).
- **Voice → structured artifact builders** are a growing pattern: STICK (slides), NovelOS (story bible), CVoxPuzzle (CV), Legal-Voice (legal forms), NodeFlow (knowledge-graph plans), Koi Charts (flowcharts, accessibility-focused). Nobody has applied this pattern to **business processes / workflow apps**.

**Whitespace that remains (as of 2026-09-25):**
- **Approver-side enterprise approvals.** Everyone builds the *intake* side (a caller submits a request). Nobody builds the manager clearing an approval queue by voice (POs, expenses, leave, invoices), with context read out, policy flags, and approve/reject/ask/delegate.
- **Voice-driven process design / low-code building.** An "AI business analyst" interviews a process owner and assembles a live workflow diagram plus a request form as they talk. The nearest neighbors are generic (Koi Charts' accessible flowcharts, NodeFlow's plans), not BPM.
- Both sit squarely in Thomas's professional domain (Kissflow: low-code workflow/BPM). That's a real advantage for realism and the Business Value story, and no other entry appears to come from a BPM vendor's perspective.

## 3. AssemblyAI Product/API Notes

The full product suite (per [docs.assemblyai.com](https://www.assemblyai.com/docs), fetched 2026-09-16) is seven products: Pre-recorded STT (async, 99 languages, diarization, PII redaction), Streaming STT, Synchronous STT (single request/response, clips ≤120s, no polling), **Voice Agent API**, Speech Understanding API (summarization/sentiment/topic — LeMUR-style), Guardrails API (PII handling, content moderation), and LLM Gateway API (unified access to frontier LLMs). We only need the first four for anything in [brainstorming.md](brainstorming.md), but Speech Understanding/Guardrails are worth knowing about if an idea's requirements shift.

- **Voice Agent API pricing:** $4.50/hr ($0.075/min), unified billing (covers STT+LLM+TTS in one rate). PCI-certified end-to-end encryption. Claimed ~1 second end-to-end latency (mic input → agent audio response). Targets called out on the product page: customer support automation, scheduling/routing, medical intake, sales qualification, field service — i.e. AssemblyAI's own marketing leans toward the ops/workflow cluster that's already crowded in the submissions list (see §2) — worth keeping in mind, not a reason to avoid it.
- **Streaming STT models (pick one per session):** **Universal-3.5 Pro Realtime** (highest accuracy, for voice agents/critical workflows), **Universal-Streaming** (cost-efficient, English), **Universal-Streaming Multilingual** (lower-cost multilingual), **Whisper-Streaming** (broadest language coverage). Streaming STT alone claims ~150ms latency. Universal-Streaming pricing noted earlier: $0.15/hr.
- **Tool calling** — Voice Agent API supports JSON-schema tool calling. Two distinct execution models, and this matters for our "no backend" constraint:
  - **Client-side (WebSocket) tools** — a `Tool Call` event arrives over the same WebSocket the browser already holds; the browser executes the tool (e.g., mutate local app state) and sends `Tool Result` back. **This is the one that fits frontend-only** — no extra backend needed beyond the token mint.
  - **Server-side (HTTP) tools** — the official starter kit's `http-tools` example has AssemblyAI call a webhook URL directly on the agent's behalf. This requires a public HTTP endpoint we control, i.e. a real backend component — **avoid this pattern** unless an idea specifically needs a server-side integration (e.g. a real CRM write) that can't happen in-browser.
- **Agents can be declarative** — an agent (system prompt, greeting, tools, input/output config) can be defined as a JSON file and published via `POST /v1/agents`, then referenced by `agent_id` at connect time instead of sending full inline config every session (the WebSocket spec calls this "stored agent" mode). AssemblyAI's own starter kit is built entirely around this pattern (see §6) — worth adopting once we pick an idea, since it keeps agent behavior in version-controlled config rather than scattered in app code.
- **Session model** — WebSocket sessions have a `max_session_duration_seconds` cap and a 30-second grace/resume window; explicitly call `session.end` to stop billing immediately rather than just closing the socket.
- **LLM Gateway** — unified access to frontier LLMs, relevant mainly for the Realtime STT path (bring-your-own-LLM) or the Voice Agent API's `byo-llm` mode. Not yet explored in API-reference depth — open item below.

## 4. Useful Libraries / Hosting

- **Official SDKs:** Python (`assemblyai-python-sdk`) and TypeScript/JS (`assemblyai-node-sdk`), both MIT-licensed, on the [AssemblyAI GitHub org](https://github.com/AssemblyAI) (69 public repos total). Also an MCP server integration for AI coding agents, and pre-built connectors for LiveKit, Pipecat, Twilio, and Langflow.
- Frontend framework: not yet decided (React/Vite is the likely default given Claude Code + shadcn ecosystem familiarity from other projects, but open — see [decisions.md](decisions.md))
- Token-mint hosting candidates: Vercel/Netlify Edge Functions, Cloudflare Workers — all deploy alongside a static frontend with no server to operate. Needs a spike once we pick a deployment target. (AssemblyAI's own starter kit instead ships a tiny Node/Express server for this — see §6 — which is also a fine option if we're already deploying to something that can run a small Node process, e.g. Render.)
- Demo hosting for the required "Application URL" — same platform as above likely covers this.

## 5. Open Research Questions

- [ ] Does AssemblyAI or lablab.ai provide a hackathon-specific hosted token-mint service (so we truly need zero backend)? Worth asking in the hackathon Discord before building our own.
- [ ] LLM Gateway docs — what models/providers does it route to, and do we need it if we take the Voice Agent API path? (Likely only relevant for Realtime STT path or `byo-llm`.)
- [ ] Rate limits / concurrency limits on the free hackathon credits — affects how much we can live-demo/test.
- [ ] Confirm TTS voice options for the Voice Agent API (matters for demo polish).
- [ ] **New, from the browser example repo's README:** historically, AssemblyAI's real-time API required an "upgraded account" (card on file) to avoid a 402 error — need to confirm whether the hackathon's free credit grant waives this, or whether we/teammates need to add a card regardless.

## 6. Official Starter Kits, SDKs & Example Repos

From the [AssemblyAI GitHub org](https://github.com/AssemblyAI) (fetched 2026-09-16) — these are directly relevant scaffolding options once we pick an idea and path:

| Repo | What it is | Relevance |
|---|---|---|
| [`voice-agent-starter-js`](https://github.com/AssemblyAI/voice-agent-starter-js) | Official Voice Agent API starter. Agents are JSON files (`agents/*.jsonc`), published via `npm run publish`; `npm start` serves a browser page with a call button **and mints session tokens itself — API key stays on the server**; `npm run phone` attaches the agent to a Twilio number. Node 18+, zero dependencies. Ships a `render.yaml` for one-click Render hosting. **Ships `AGENTS.md`/`CLAUDE.md` — built for coding-agent-assisted use.** | **This independently confirms our token-mint recommendation in [architecture.md](architecture.md) is AssemblyAI's own blessed pattern, not something we invented.** Strong candidate as our actual scaffold once we pick an idea — see open decision below. Nine example agents demonstrate keyterm biasing, turn-taking tuning, BYO-LLM, client/server tool calling, web search (Exa), CRM read/write (Airtable), calendar booking (Cal.com), and PCI-safe DTMF card entry — several map directly onto our candidate ideas (e.g. `cal-booking` is close to what CareCheck or a scheduling-flavored idea would need; `http-tools`/`airtable-crm` show the server-side-tool pattern we're deliberately avoiding). |
| [`voice-agent-starter-python`](https://github.com/AssemblyAI/voice-agent-starter-python) | Same starter, Python instead of Node. | Alternate if the team prefers Python for the token-mint piece. |
| [`realtime-transcription-browser-js-example`](https://github.com/AssemblyAI/realtime-transcription-browser-js-example) | Official Realtime STT browser demo. Express backend generates the temp token (`tokenGenerator.js`), browser uses `AudioWorklet` to stream mic audio. 134 stars, MIT. | Confirms the same token-mint pattern applies to the Realtime STT path, and is the reference implementation if we end up needing custom orchestration (e.g. Idea 3, LiveMeetingCoPilot). |
| [`assemblyai-node-sdk`](https://github.com/AssemblyAI/assemblyai-node-sdk) / [`assemblyai-python-sdk`](https://github.com/AssemblyAI/assemblyai-python-sdk) | Official SDKs, MIT. | Use instead of hand-rolled `fetch`/WebSocket calls once we're building. |
| [`blurt`](https://github.com/AssemblyAI/blurt) | Open-source macOS dictation app powered by AssemblyAI. | Not directly relevant (native macOS, not browser) — noted for completeness. |

**Open decision to raise with the team:** should we fork/build on `voice-agent-starter-js` directly (fastest path, official support, coding-agent-ready docs already in the repo) rather than scaffolding our own React app from scratch? This trades some frontend flexibility for speed and an officially-validated token-mint + agent-publish flow. Logged in [decisions.md](decisions.md) as pending, to be decided alongside the idea and framework choice.

## 7. NativelyAI (hackathon co-organizer)

[NativelyAI](https://nativelyai.com) — Andrea Marazzi (Founder/CEO) is a listed speaker/judge. Their platform ("AIFoundry") has three pieces:

- **native.builder** — "describe it, agents build it" AI software factory (not relevant to us as builders)
- **native.relay** — an OpenAI-compatible endpoint routing to 40+ models (GPT-5, Claude, DeepSeek, etc.), pitched as up to 55% cheaper than going direct. **Potentially relevant as an alternative LLM source** if we take the Realtime STT / BYO-LLM path and want model choice beyond AssemblyAI's own LLM Gateway — worth a quick pricing/access comparison if that path is chosen.
- **native.compute** — decentralized GPU network (not relevant to a frontend-only voice agent)

No hackathon-specific rules, resources, or requirements were found on their site — their role here appears to be co-organizer/sponsor rather than a mandatory dependency.

## 8. Measured Voice Agent API behavior (probes run 2026-09-28)

These come from real probes with our key: synthetic speech from macOS `say`, streamed at real-time pace from Node. Scripts are in [`spikes/`](../spikes/) (`AAI_KEY=... node spikes/va-probe.mjs <scenario>`). The audio fixtures are regenerable with `say` and aren't committed. Treat single-run numbers as indicative, not benchmarks.

**Protocol shape (confirmed):**
- Connect: `wss://agents.assemblyai.com/v1/ws?token=<API_KEY>`. The raw key works from the browser, and a bogus key gets `session.error: unauthorized`, close 1008.
- The first message is `{type:'session.update', session:{system_prompt, greeting, tools:[{type:'function', name, description, parameters}], input:{keyterms:[...], turn_detection:{min_silence, vad_threshold}}}}`, answered by `session.ready` / `session.updated`.
- Audio in: `{type:'input.audio', audio:<base64 PCM16 mono @ 24 kHz>}` in 50 ms chunks. Audio out: `reply.audio` (base64 PCM16).
- Events seen: `session.ready`, `session.updated`, `input.speech.started/stopped`, `transcript.user.delta`, `transcript.user`, `reply.started`, `reply.audio`, `transcript.agent`, `tool.call {call_id, name, arguments}`, `reply.done`.
- Tool results: collect every `tool.call`, then after `reply.done` send `{type:'tool.result', call_id, result:<JSON string>}`. The agent then speaks a follow-up.
- `reply.create {instructions}` makes the agent speak unprompted, driven by app state.
- A mid-session `session.update` works: new system_prompt, keyterms, turn_detection, and `output.volume`.
- End with `{type:'session.end'}` to stop billing immediately.

**Timing and behavior:**
- `reply.create` when idle: `reply.started` at ~163 ms, first audio at ~681 ms, and it said the exact line.
- ⚠️ `reply.create` sent **while the user is mid-sentence is silently dropped**: `reply.done` "completed", with no audio and no error. Any proactive callout needs a queue. Send only after `input.speech.stopped`, and only when no reply is in progress. Always mirror the callout on screen as well.
- Default `min_silence` 1000 ms gives 1.2–3.0 s from end of speech to `tool.call`, and 2.0–3.7 s to spoken confirmation. Recommended: `min_silence` ≈ 500 ms, and update the UI optimistically on `tool.call` rather than waiting for the result round trip.
- Several events in one utterance ("she's done, and it was a wet diaper") produced **two parallel tool.calls** in one reply. That works.
- `transcript.user.delta` partials arrive about every 1.2 s and are unstable early, so they aren't word by word.
- **Realtime STT v3** (`wss://streaming.assemblyai.com/v3/ws?...&token=<API_KEY>`) also accepts the raw key from the browser. Its partials grow word by word every 100–300 ms, but still run about 1.1 s behind the audio.
- Whisper: synthetic whisper was mis-transcribed, though an enum tool argument still fired correctly. Quiet normal speech at −22 dB was transcribed perfectly. A real human whisper on a laptop mic is untested.

**Added 2026-09-29: the Voice Agent API as a text-in LLM** (`spikes/scribe-probe.mjs`, `spikes/scribe-probe2.mjs`)
- **The LLM Gateway is not an option for this account.**
  - `POST https://llm-gateway.assemblyai.com/v1/chat/completions` returns "Your account does not have access to LLM Gateway".
  - Its CORS preflight (`OPTIONS`) returns 401, so a browser couldn't call it anyway.
- **Instead, `reply.create {instructions}` carrying the cook's text, plus a tool with a nested JSON schema** (arrays of step objects), returns a structured `tool.call`.
  - A full recipe takes ~1.8 s; small requests take ~0.3–0.7 s.
  - The reply's `reply_id` is on `reply.started` and `reply.done`, not on `tool.call`.
- **No audio is needed.** A session idle for 25 s still answers, and back-to-back requests on one socket work.
- **Don't send `tool.result`** for these calls. Without it, there's no spoken follow-up and the next request is faster.
  - A second `reply.create` sent while a reply is still running cuts the first reply short, so requests must be serialized. The app's `Scribe` does this.
- **Universal-Streaming with `format_turns=true`:** partials arrive already flagged `turn_is_formatted`, and each turn ends with one formatted end. `turn_order` identifies the turn.
