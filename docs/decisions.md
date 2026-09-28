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

## Open Decisions (not yet made)

- Which idea from [brainstorming.md](brainstorming.md) are we building?
- Frontend framework/tooling
- Build from scratch vs. fork AssemblyAI's official starter kit (see above)
- Hosting platform (also covers token-mint function + the required demo "Application URL")
- Developer B's name and preferred task split
