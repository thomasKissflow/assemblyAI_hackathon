# Task Board

Owners: **Thomas** (thomas@kissflow.com), **Developer B** (name not yet provided), **Claude Code** (overnight build).
Deadline: **Sep 30, 8:30 PM IST.** Build plan: [plans/2026-09-28-heard-chef.md](superpowers/plans/2026-09-28-heard-chef.md).

## Backlog

| Task | Owner | Priority | Status |
|---|---|---|---|
| Plan T1: project skeleton, recipes, planner (TDD) | Claude Code | High | Backlog, starts on Thomas's go-ahead |
| Plan T2: kitchen clock, ticket views, store (TDD) | Claude Code | High | Backlog |
| Plan T3: voice core (PCM, callout queue, agent config, tools) | Claude Code | High | Backlog |
| Plan T4: voice runtime (Hey Chef ears, agent session, captions) + live agent tests incl. guardrails | Claude Code | High | Backlog |
| Plan T5: show-stealer UI with Impeccable (8 wow moments) | Claude Code | High | Backlog |
| Plan T6: component tests + Playwright flows + real-voice fake-mic test | Claude Code | High | Backlog |
| Plan T7: browser polish (Impeccable critique + audit) | Claude Code | High | Backlog |
| Plan T8: pitch.md, README, demo script, handoff | Claude Code | High | Backlog |
| Morning Sep 29: real voice run with headphones, report what feels off | Thomas | High | Backlog |
| Sep 29: prompt/voice tuning from Thomas's run | Thomas + Claude Code | High | Backlog |
| Sep 29–30: record demo video (script in `docs/demo-script.md`) | Thomas | High | Backlog |
| Sep 29–30: slide deck + cover image for lablab submission | Developer B / Thomas | High | Backlog |
| Sep 30: push public GitHub repo, confirm `.env.local` is not in it | Thomas | High | Backlog |
| Sep 30: decide on hosting for the "Application URL" field (optional; key exposure trade-off) | Thomas | Medium | Backlog |
| Sep 30: submit on lablab.ai (title, short/long description, tags, video, slides, repo, URL) | Thomas | High | Backlog |
| After judging: rotate the AssemblyAI API key | Thomas | Medium | Backlog |
| Confirm Developer B's name/role for the docs | Thomas | Low | Backlog |

## In Progress

| Overnight build of plan v2 (T1–T4 by build workflow, then T5–T8) | Claude Code | High | In progress (started 2026-09-28 night) |

## Blocked

*(none)*

## Completed

| Task | Owner | Priority | Status |
|---|---|---|---|
| Extract hackathon requirements, judging criteria, timeline, submission requirements | Claude Code | High | Done (2026-09-16) |
| Research Voice Agent API vs Realtime STT, including browser auth | Claude Code | High | Done (2026-09-16) |
| Competitor/prior-art scans (~45 → ~150 → 216 entries) | Claude Code | High | Done (2026-09-16, 09-25, 09-28) |
| Set up docs/ structure | Claude Code | High | Done (2026-09-16) |
| Verify the no-backend connection (raw key on the WebSocket, browser + Node) | Claude Code | High | Done (2026-09-28) |
| Multi-agent brainstorm: 24 ideas → 8 ranked → 3 skeptics | Claude Code | High | Done (2026-09-28) |
| Pick the idea: Heard, Chef | Thomas | High | Done (2026-09-28) |
| Design discovery (voice, look, demo menu) + PRODUCT.md | Thomas + Claude Code | High | Done (2026-09-28) |
| Spec + implementation plan (planner and callout queue logic pre-verified) | Claude Code | High | Done (2026-09-28) |

## Notes on Priority

About two days are left. Tonight is the build. Sep 29 is Thomas's real-voice check and tuning. Sep 30 is video, slides and submission. Anything not on the list above is out of scope; see spec §12.
