# Architecture Notes

Status: **final for the MVP (2026-09-28).** The authoritative design is the [Heard, Chef spec](superpowers/specs/2026-09-28-heard-chef-design.md) (§4 architecture, §5 planner, §6 agent config). In short:

```
Browser (Vite + React + TS, static, no backend)
 ├─ kitchen/  recipes · planner (pure maths) · clock (virtual, 30× demo speed) · store (useSyncExternalStore)
 ├─ voice/    AudioWorklet mic → PCM16 24 kHz → WebSocket ⇄ AssemblyAI Voice Agent API → speaker
 │            tool.call → tools.ts mutates the plan (optimistic UI) → tool.result after reply.done
 │            clock tick → step-started → bell + on-screen call + CalloutQueue → reply.create (never while the cook talks)
 └─ ui/       dark "kitchen pass": tickets, rail, NEXT UP, Heard log (designed with Impeccable)
```

Two-developer split for the remaining days:
- **Thomas:** voice runs and prompt tuning, the demo video.
- **Developer B:** slides, cover image, optional deploy.

The MVP itself is built by Claude Code overnight; see [tasks.md](tasks.md).

The sections below are the earlier research-phase notes, kept for history.

## Starting Constraints (as given)

- Frontend only
- No custom backend
- API-driven architecture (AssemblyAI + whatever else an idea needs)
- Git workflow, two developers working in parallel
- Claude Code–assisted development

## Resolved 2026-09-28: truly no backend

The browser connects straight to `wss://agents.assemblyai.com/v1/ws?token=<API_KEY>` with the hard-coded key. This was verified in a real browser on a localhost origin, and a bogus key is correctly rejected. The token endpoint is CORS-blocked, so the browser can't mint tokens, but it doesn't need to. The key lives in a gitignored `.env.local` and is inlined by Vite at build time. Fallback if AssemblyAI stops accepting the raw key: a same-origin rewrite proxy to `/v1/token` (Vercel/Netlify config only, no code). Full reasoning in [decisions.md](decisions.md).

The section below is kept for history; its recommendation is superseded.

## Constraint Under Challenge: "No custom backend" (superseded 2026-09-28)

Per [research.md](research.md#critical-technical-finding-frontend-only-no-backend-needs-a-caveat), both AssemblyAI WebSocket APIs (Voice Agent API and Realtime STT) require a **short-lived auth token minted server-side** — browsers can't send the permanent API key as a WebSocket header, and AssemblyAI's own docs recommend against shipping the permanent key to the client.

This means "zero server-side code" isn't quite achievable if we want to follow AssemblyAI's documented security practice. Three options:

1. **Ship the permanent API key client-side anyway.** Simplest, truly zero backend. Acceptable risk for a hackathon demo with a rate-limited/free-tier key, but the key is visible to anyone who opens devtools on the deployed demo — a judge could see it. Not recommended for the public "Application URL" we have to submit.
2. **Add one stateless token-minting function** (Vercel/Netlify Edge Function, Cloudflare Worker, or a tiny Node/Express server) that does nothing but call AssemblyAI's `GET /v1/token` and return it. Deploys alongside the static frontend, no database, no business logic. This is the recommended middle ground — it satisfies the spirit of "frontend only, no backend" (no app server holding state, no persistent store) while following AssemblyAI's own security guidance.
3. **Ask in the hackathon Discord** whether lablab.ai/AssemblyAI provide a hosted token-mint service for participants — would let us hit option 1's simplicity with option 2's safety. Logged as an open research question.

**This is no longer just our guess — it's AssemblyAI's own documented pattern.** Both of AssemblyAI's official example repos do exactly this: [`voice-agent-starter-js`](https://github.com/AssemblyAI/voice-agent-starter-js)'s `npm start` "serves a page with a call button and mints session tokens — the API key stays on the server," and [`realtime-transcription-browser-js-example`](https://github.com/AssemblyAI/realtime-transcription-browser-js-example) does the same with a small Express server. See [research.md §6](research.md#6-official-starter-kits-sdks--example-repos).

**Recommendation:** default to option 2, revisit if option 3 turns out to be available. This will be finalized in [decisions.md](decisions.md) once we scope it against the accepted idea. Also worth deciding then: build our own minimal token-mint function from scratch, or fork AssemblyAI's official starter kit (which already includes this, plus a declarative agent-publishing flow) — see the open decision in [research.md §6](research.md#6-official-starter-kits-sdks--example-repos).

### Related constraint: how tool calls execute

Once an idea uses tool calling (most of our candidates do), there are two execution models AssemblyAI supports, and only one keeps us backend-free:

- **Client-side / WebSocket tools** (`Tool Call` → app executes locally → `Tool Result` back over the same socket) — **use this.** The browser already holds the WebSocket; no extra infrastructure needed.
- **Server-side / HTTP tools** (AssemblyAI calls a webhook URL we host, per the starter kit's `http-tools` example) — **avoid**, since it requires a public backend endpoint beyond the token mint. Only reach for this if an idea needs a real third-party write (e.g., an actual CRM) that truly can't happen client-side.

## Frontend Architecture

*TBD once an idea is accepted.* Placeholder defaults to discuss:

- Framework: likely React + Vite (fast setup, large ecosystem for real-time audio UI, familiar territory for Claude Code–assisted builds) — not yet decided, open for Developer B's input
- Component split should mirror the two-developer parallel workflow — see "Two-Developer Split" below

## API Integrations

- **AssemblyAI** (mandatory) — Voice Agent API (recommended default per [research.md](research.md#1-the-hackathon-in-detail)) or Realtime STT, depending on the accepted idea
- Any additional third-party API is idea-specific — to be listed per idea in [brainstorming.md](brainstorming.md) and finalized in [decisions.md](decisions.md) once selected

## Data Flow (generic shape, pending idea)

```
Browser mic → AssemblyAI WebSocket (token from mint function)
           → [transcript / agent audio / tool-call events]
           → App state (in-browser only — no persistent backend store)
           → UI updates
```

If an idea needs data to persist across sessions (e.g., CareCheck's check-in history, Workflow Console's queue state), default to **browser storage (localStorage/IndexedDB)** rather than a real database, to stay within the no-backend constraint. Flag if an idea's data needs genuinely outlive a browser session in a way storage can't cover — that would be a real scope/constraint conflict worth surfacing early.

## State Management

*TBD once an idea and framework are picked.*

## Tradeoffs Considered

| Decision point | Options | Status |
|---|---|---|
| Voice Agent API vs Realtime STT | Bundled (fast, less control) vs DIY orchestration (slower, more control) | Leaning Voice Agent API by default — see research.md |
| Token minting | Client-side key vs edge function vs ask hackathon for hosted option | Leaning edge function — see above |
| Persistence | Real backend vs browser storage | Leaning browser storage to preserve "no backend" |

## Two-Developer Split (general principle)

Whatever idea is picked, aim for a vertical split that lets both developers work without blocking each other most of the time:

- **Developer A:** voice/AssemblyAI integration layer (WebSocket session lifecycle, audio capture/playback, tool-calling wiring)
- **Developer B:** application logic + UI (the domain-specific state, dashboards, scoring/extraction logic, presentation polish)

The integration layer should expose a small, stable interface (e.g., events like "user said X," "agent tool-called Y," "session ended") so Developer B can build against a mock of it before the real integration is done, and vice versa. Concrete split will be finalized per-idea in [tasks.md](tasks.md).
