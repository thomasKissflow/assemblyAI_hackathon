# Team Handoff Notes

*Keep this current — it's the first thing to read after pulling latest.*

---

## Latest Handoff — 2026-09-25 (Claude Code, rescan + re-ideation kickoff)

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
