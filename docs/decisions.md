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

## Open Decisions (not yet made)

- Which idea from [brainstorming.md](brainstorming.md) are we building?
- Frontend framework/tooling
- Hosting platform (also covers token-mint function + the required demo "Application URL")
- Developer B's name and preferred task split
