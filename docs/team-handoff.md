# Team Handoff Notes

*Keep this current — it's the first thing to read after pulling latest.*

---

## Latest Handoff — 2026-09-16 (Claude Code, initial setup)

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
