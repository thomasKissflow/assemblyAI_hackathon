# Project Overview

## Hackathon Summary

- **Event:** [AssemblyAI - Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) (run by lablab.ai + AssemblyAI)
- **Format:** Fully online, month-long
- **Dates:** September 1 – 30, 2026 (submissions close Sep 30, 8:30 PM IST)
- **Days remaining (as of 2026-09-25):** ~5 days. Budget the final day for submission assets (video, slides, cover, hosted URL), which leaves about 4 build days.
- **Prize pool:** $10,000 total — **5 winners**, each $1,000 cash + $1,000 AssemblyAI API credits
- **Team size:** 1–6 people (we are 2)
- **Tagline:** "The fastest path to a working voice agent"

## Problem Statement (as set by the hackathon)

Build a voice AI agent using AssemblyAI's real-time voice AI infrastructure. Two supported paths:

1. **Voice Agent API** — end-to-end voice agent through one WebSocket connection. AssemblyAI handles STT (Universal-3 Pro), LLM routing, voice output (TTS), turn-taking/VAD, and JSON-schema tool calling.
2. **Realtime Speech-to-Text API** — just the real-time STT over WebSocket (sub-second, multilingual); you bring your own LLM and TTS and own the orchestration.

Full technical detail in [research.md](research.md).

## Vision

**Heard, Chef: the dinner timer you can talk back to.** A calm voice head chef runs the timing of a multi-dish dinner. It calls every step out loud when it's due, and it re-plans every dish the moment you say what the food is doing ("the curry needs ten more minutes", "guests are running late").

## Target Users

Home cooks making a meal with several dishes that must land hot at the same time: people hosting dinner, busy parents, beginner cooks and meal-kit customers. They're cooking with messy hands and their eyes on the stove, with a laptop or tablet on the counter. Likely buyers: recipe apps, meal-kit companies, and smart-appliance makers. Full context is in [PRODUCT.md](../PRODUCT.md).

## High-Level Solution

A static browser app with **no backend**. The browser talks straight to the AssemblyAI Voice Agent API over one WebSocket, which handles speech-to-text, the LLM, the voice and tool calls. A deterministic planner in the browser does all the timing maths. Chef changes the plan through client-side tool calls and speaks unprompted calls when steps are due. Design: [spec](superpowers/specs/2026-09-28-heard-chef-design.md). Build: [plan](superpowers/plans/2026-09-28-heard-chef.md).

## Current Status

**Stage:** Feature-complete (Sep 29): the MVP, plus menus, the recipe studio and a pass fitted to 90% zoom. The demo video, deck and cover are done (Sep 30 night). What's left: deploy, public repo and the lablab submission. See [team-handoff.md](team-handoff.md).

| Date | Milestone |
|---|---|
| 2026-09-16 | Repo created, hackathon requirements extracted, initial doc set + 6 candidate ideas drafted |
| 2026-09-25 | Rescanned submissions (~150 now). Ideas 1, 4 and 6 collided; re-ideating in the BPM/workflow whitespace |
| 2026-09-28 | No-backend connection verified. Multi-agent brainstorm against 216 entries. **Heard, Chef accepted.** Spec, plan and PRODUCT.md written |
| 2026-09-29 | Overnight build done: planner, "Hey Chef" voice, kitchen-pass UI, 84 tests + 7 live + real-voice e2e, design review fixes, pitch, demo script, README |
| 2026-09-29 | Thomas's real-voice run passed. Added menus, the recipe studio (dictation + AI scribe), mid-cook add/drop dish, and a calmer pass at 90% zoom. 309 tests + 16 live + 17 browser flows |
| 2026-09-30 | Overnight: fully live, automated 3:17 demo video; 13-slide pitch deck with notes; cover image; barge-in and wake-word fixes found while recording (313 tests) |

See [tasks.md](tasks.md) for the live task board and [team-handoff.md](team-handoff.md) for the latest handoff note.

## Important Links

**Hackathon**
- Hackathon page: https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon
- Live submissions / leaderboard: https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/live
- lablab.ai Discord (team formation, mentors, Q&A): linked from hackathon page

**AssemblyAI docs**
- Docs home: https://www.assemblyai.com/docs
- Voice Agent API product page: https://www.assemblyai.com/products/voice-agent-api
- Voice Agent API docs: https://www.assemblyai.com/docs/voice-agents/voice-agent-api
- Voice Agent WebSocket API spec: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/api-spec/voice-agent-websocket
- Realtime STT product page: https://www.assemblyai.com/products/streaming-speech-to-text
- Realtime STT docs: https://www.assemblyai.com/docs/speech-to-text/streaming
- LLM Gateway docs: linked from docs home — not yet fetched in depth, see [research.md §5](research.md#5-open-research-questions)

**Code / starter kits** (see [research.md §6](research.md#6-official-starter-kits-sdks--example-repos) for detail)
- AssemblyAI GitHub org: https://github.com/AssemblyAI
- Official Voice Agent starter (JS): https://github.com/AssemblyAI/voice-agent-starter-js
- Official Voice Agent starter (Python): https://github.com/AssemblyAI/voice-agent-starter-python
- Official Realtime STT browser example: https://github.com/AssemblyAI/realtime-transcription-browser-js-example
- Official SDKs: https://github.com/AssemblyAI/assemblyai-node-sdk · https://github.com/AssemblyAI/assemblyai-python-sdk

**Other**
- NativelyAI (co-organizer): https://nativelyai.com — see [research.md §7](research.md#7-nativelyai-hackathon-co-organizer)

## Judging Criteria (from lablab.ai)

1. **Application of Technology** — how effectively the chosen model(s) are integrated
2. **Presentation** — clarity and effectiveness of the project presentation
3. **Business Value** — impact and practical value, fit into business areas
4. **Originality** — uniqueness/creativity, ability to demonstrate behaviors

Every idea we evaluate should be scored against these four explicitly — see [brainstorming.md](brainstorming.md).
