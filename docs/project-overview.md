# Project Overview

## Hackathon Summary

- **Event:** [AssemblyAI - Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) (run by lablab.ai + AssemblyAI)
- **Format:** Fully online, month-long
- **Dates:** September 1 – 30, 2026 (submissions close Sep 30, 8:30 PM IST)
- **Days remaining (as of 2026-09-16):** ~14 days
- **Prize pool:** $10,000 total — **5 winners**, each $1,000 cash + $1,000 AssemblyAI API credits
- **Team size:** 1–6 people (we are 2)
- **Tagline:** "The fastest path to a working voice agent"

## Problem Statement (as set by the hackathon)

Build a voice AI agent using AssemblyAI's real-time voice AI infrastructure. Two supported paths:

1. **Voice Agent API** — end-to-end voice agent through one WebSocket connection. AssemblyAI handles STT (Universal-3 Pro), LLM routing, voice output (TTS), turn-taking/VAD, and JSON-schema tool calling.
2. **Realtime Speech-to-Text API** — just the real-time STT over WebSocket (sub-second, multilingual); you bring your own LLM and TTS and own the orchestration.

Full technical detail in [research.md](research.md).

## Vision

*Not yet decided — pending idea selection. See [brainstorming.md](brainstorming.md) for candidate ideas and [decisions.md](decisions.md) for the decision log.*

## Target Users

*Depends on which idea we converge on — see [brainstorming.md](brainstorming.md).*

## High-Level Solution

*TBD once an idea is accepted.* Known constraints going in (see [architecture.md](architecture.md) for the full discussion, including one constraint we're challenging):

- Frontend-only, API-driven — no custom backend server
- AssemblyAI is mandatory infrastructure (either path above)
- Built and iterated on with Claude Code, versioned in Git
- Two developers working in parallel — needs a clean vertical split

## Current Status

**Stage:** Research & brainstorming — no idea accepted yet.

| Date | Milestone |
|---|---|
| 2026-09-16 | Repo created, hackathon requirements extracted, initial doc set + 6 candidate ideas drafted |

See [tasks.md](tasks.md) for the live task board and [team-handoff.md](team-handoff.md) for the latest handoff note.

## Important Links

- Hackathon page: https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon
- Live submissions / leaderboard: https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/live
- Voice Agent API docs: https://www.assemblyai.com/docs/voice-agents/voice-agent-api
- Realtime STT docs: https://www.assemblyai.com/docs/speech-to-text/streaming
- Voice Agent WebSocket API spec: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/api-spec/voice-agent-websocket
- LLM Gateway docs: (linked from hackathon Resources section — fetch link when we pick a path)
- lablab.ai Discord (team formation, mentors, Q&A): linked from hackathon page
- AssemblyAI GitHub quickstarts: linked from hackathon page

## Judging Criteria (from lablab.ai)

1. **Application of Technology** — how effectively the chosen model(s) are integrated
2. **Presentation** — clarity and effectiveness of the project presentation
3. **Business Value** — impact and practical value, fit into business areas
4. **Originality** — uniqueness/creativity, ability to demonstrate behaviors

Every idea we evaluate should be scored against these four explicitly — see [brainstorming.md](brainstorming.md).
