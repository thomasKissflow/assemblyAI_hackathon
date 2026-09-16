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

## 3. AssemblyAI Product/API Notes

- **Universal-3 Pro** — the STT model behind the Voice Agent API; used for the end-to-end path.
- **Universal-Streaming** — the real-time STT model (immutable transcripts — text already emitted is never rewritten, unlike many competitors; supports word-level timestamps, speaker diarization, keyterm prompting, intelligent endpointing, unlimited concurrent streams). Priced at $0.15/hr for English + multilingual.
- **Tool calling** — Voice Agent API supports JSON-schema tool calling and a `Tool Call` / `Tool Result` message pair over the same WebSocket — this is how an idea like a workflow agent or a game would drive app state from voice, without a backend beyond the token mint.
- **Session model** — WebSocket sessions have a `max_session_duration_seconds` cap and a 30-second grace/resume window; explicitly call `session.end` to stop billing immediately rather than just closing the socket.
- **LLM Gateway** — mentioned in hackathon resources as available if we need LLM access outside what the Voice Agent API bundles (relevant mainly for the Realtime STT path). Not yet explored in depth — open item below.

## 4. Useful Libraries / Hosting (unresearched — flagged for follow-up)

- Frontend framework: not yet decided (React/Vite is the likely default given Claude Code + shadcn ecosystem familiarity from other projects, but open — see [decisions.md](decisions.md))
- Token-mint hosting candidates: Vercel/Netlify Edge Functions, Cloudflare Workers — all deploy alongside a static frontend with no server to operate. Needs a spike once we pick a deployment target.
- Demo hosting for the required "Application URL" — same platform as above likely covers this.

## 5. Open Research Questions

- [ ] Does AssemblyAI or lablab.ai provide a hackathon-specific hosted token-mint service (so we truly need zero backend)? Worth asking in the hackathon Discord before building our own.
- [ ] LLM Gateway docs — what models/providers does it route to, and do we need it if we take the Voice Agent API path? (Likely only relevant for Realtime STT path.)
- [ ] Rate limits / concurrency limits on the free hackathon credits — affects how much we can live-demo/test.
- [ ] Confirm TTS voice options and latency characteristics for the Voice Agent API (matters for demo polish).
