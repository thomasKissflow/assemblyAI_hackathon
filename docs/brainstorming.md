# Brainstorming Log

Status legend: **Accepted** · **Rejected** · **Needs Research** · **Future Scope**
Nothing is deleted once logged, even if rejected — see individual entries for reasoning.

All ideas below are scored against the hackathon's actual judging criteria (Application of Technology, Presentation, Business Value, Originality) and against the crowded-cluster analysis in [research.md](research.md#2-competitor--prior-art-analysis).

---

## Candidate Ideas (2026-09-16 batch)

### 1. RehearsAI — voice pitch & interview rehearsal coach — `Needs Research` (top recommendation)

**Problem:** People rehearse high-stakes spoken moments (job interviews, investor pitches, sales pitches) alone, with no realistic pushback and no objective feedback on delivery.

**Target Users:** Job seekers, founders prepping investor pitches, sales reps, students.

**Why It Is Interesting:** Judges can try it live and feel the value in one exchange — the agent role-plays an interviewer/investor/customer persona, interrupts, asks hard follow-ups, then produces a scored breakdown (clarity, filler-word count, structure, confidence) with transcript evidence. Strong "Application of Technology" (STT + LLM reasoning about tone/content) and "Business Value" (career services, sales enablement, corporate training are real, paying markets).

**Technical Complexity:** Medium.

**Demo Impact:** High — live roleplay is inherently dramatic and interactive for judges.

**Feasibility:** Yes, for 2 devs in ~1–1.5 weeks via the Voice Agent API (bundled LLM+TTS avoids building orchestration).

**Risks:** Persona prompt needs real tuning to feel adversarial-but-fair, not scripted; turn-taking/interruption latency needs to feel natural; scoring pass (second LLM call over the transcript) is an extra integration to get right.

**APIs Needed:** AssemblyAI Voice Agent API (tool calling optional, for structured scorecards); no other external API strictly required.

**Recommended Team Split:** Dev A — voice session lifecycle, persona prompt library, turn-taking UX. Dev B — post-session scoring/analysis pipeline, transcript evidence UI, presentation polish.

**Prior art check:** Officer Parker (existing submission) does this narrowly for US visa interviews only — general-purpose interview/pitch coaching is meaningfully broader and not yet claimed.

---

### 2. Workflow Voice Console — spoken business-process actions — `Needs Research` (strong alternate, domain-expertise play)

**Problem:** Business users spend real time navigating BPM/ERP UIs for routine actions — approvals, status checks, submissions.

**Target Users:** Ops staff and approvers in BPM/workflow-heavy orgs (directly adjacent to Thomas's domain at Kissflow).

**Why It Is Interesting:** Strongest "Business Value" story of all six ideas — a believable enterprise buyer and ROI narrative, backed by real domain knowledge on the team. "Approve the PO from vendor X" spoken aloud instantly mutating a visible kanban/queue is satisfying to watch.

**Technical Complexity:** Medium — JSON-schema tool calling wired to an in-browser mock data store (state/localStorage, no real backend), UI reflecting live state changes.

**Demo Impact:** Medium-high — satisfying but less viscerally dramatic than a roleplay (Idea 1) or a game (Idea 5).

**Feasibility:** Yes, 2 devs, ~1–1.5 weeks, Voice Agent API + tool calling.

**Risks:** This cluster is the most crowded in the whole hackathon (Robin Voice Ops, HangON, BugSpeak, three separate SRE/incident-commander entries). Needs a genuinely narrow, differentiated angle — e.g., a multi-step **approval chain with a visible audit trail**, not another generic intake/booking flow — or it reads as derivative on Originality.

**APIs Needed:** AssemblyAI Voice Agent API with tool calling.

**Recommended Team Split:** Dev A — voice/tool-calling integration. Dev B — workflow state machine + kanban/queue UI + audit trail view.

---

### 3. LiveMeetingCoPilot — in-call voice Q&A over a live transcript — `Needs Research`

**Problem:** People lose track of decisions/action items during live calls; note-taking divides attention from the conversation.

**Target Users:** PMs, consultants, sales reps, anyone running frequent calls.

**Why It Is Interesting:** Push-to-talk mid-meeting ("what did we agree on pricing?") answered from the running transcript is a strong, visible "Application of Technology" showcase (streaming STT + diarization + live RAG-style query). Differs from existing post-call-analysis entries (Second Listen, Briefkeeper) by answering *during* the call, not after.

**Technical Complexity:** Medium-High.

**Demo Impact:** High if the live-query moment lands; riskier live because it requires capturing two audio concerns at once (the "meeting" audio plus a push-to-talk query) — flakier in a live judged demo than a single-channel conversation.

**Feasibility:** Tight for 2 devs in 2 weeks. Likely needs the **Realtime STT path** (bring-your-own LLM/TTS), which is more integration work than the bundled Voice Agent API — more moving pieces under time pressure.

**Risks:** Multi-speaker/dual-audio capture in-browser is technically finicky; diarization accuracy varies; scope creep on "what counts as a good answer."

**APIs Needed:** AssemblyAI Realtime STT (diarization) + an LLM (possibly via AssemblyAI's LLM Gateway) for the Q&A layer.

**Recommended Team Split:** Dev A — streaming transcript pipeline + diarization UI. Dev B — Q&A/retrieval logic + action-item extraction + presentation.

---

### 4. AccessNav Voice Companion — voice-only web app navigation — `Needs Research`, leaning `Future Scope`

**Problem:** Many web apps are hard to use with only voice or limited mobility; screen readers alone don't handle multi-step task completion well.

**Target Users:** Users with visual/motor impairments; aging-in-place users.

**Why It Is Interesting:** Strong social-impact/Business-Value narrative; a live "watch someone drive a UI hands-free" demo is moving.

**Technical Complexity:** Medium-High — DOM introspection + intent-to-action mapping (click/scroll/fill) via tool calling, careful accessibility semantics.

**Demo Impact:** High.

**Feasibility:** Tight for 2 devs in 2 weeks if scoped to exactly one demo app/flow (not a general SDK — a general SDK is out of scope for the timeline).

**Risks:** **Direct prior-art collision** — "voicebridgeai," an existing submission, already does voice-driven navigation of a live web dashboard for blind/low-vision/motor-impaired users. Building this without a sharply different angle would likely score poorly on Originality. DOM automation across a real app is also brittle to get demo-reliable.

**APIs Needed:** AssemblyAI Voice Agent API with tool calling; DOM actions are local JS, no external API.

**Recommended Team Split:** Dev A — voice/tool-calling + command grammar. Dev B — demo app + accessible action layer.

**Why not higher:** logged for completeness and because the social-impact angle is genuinely good, but the direct competitor collision is a real problem — would need a clearly distinct wedge (e.g., a different modality like voice-driven form-filling specifically) to be worth pursuing.

---

### 5. VoiceQuest — voice-driven narrative game — `Needs Research`, leaning `Future Scope`

**Problem:** N/A in the pain-point sense — this is an entertainment/demo-impact play, not a business problem.

**Target Users:** Hackathon judges / general consumers / game enthusiasts.

**Why It Is Interesting:** Very high Demo Impact and Originality potential (judges can play it themselves live); could use an audio-clue puzzle that plays directly to AssemblyAI's STT strength.

**Technical Complexity:** Medium — mostly prompt/state-machine design, no external data integrations needed.

**Demo Impact:** Very high.

**Feasibility:** Yes, 2 devs, ~1 week for a tight vertical slice.

**Risks:** Weak on the "Business Value" judging criterion — even a great game likely underperforms there relative to the other ideas, and that's one of four explicitly weighted criteria. Also has direct genre neighbors already submitted (a murder-mystery game, an AI radio station).

**APIs Needed:** AssemblyAI Voice Agent API only.

**Recommended Team Split:** Dev A — game state engine + tool calling. Dev B — narrative content/prompts + UI (map/inventory) + audio ambience.

**Why not higher:** Fun and low-risk technically, but the Business Value gap is a real scoring liability given judging is criteria-based, not vibes-based.

---

### 6. CareCheck Companion — voice wellness check-ins for family caregivers — `Needs Research`

**Problem:** Family caregivers can't be present for daily check-ins on elderly or chronic-condition relatives; missed medication or a wellness change can go unnoticed until it becomes a crisis.

**Target Users:** Family caregivers, home-health aides, elderly/chronic-condition patients.

**Why It Is Interesting:** Genuine whitespace (see [research.md](research.md#2-competitor--prior-art-analysis)) — nothing in the current submission list targets home/family caregiving specifically (Heat Warning Agent is industrial, AegisOR is clinical/OR). Strong emotional + Business Value story.

**Technical Complexity:** Medium — structured slot-filling conversation (medication taken? pain scale? mood?) + a caregiver-facing dashboard showing history/alerts (mocked storage, no real backend).

**Demo Impact:** Medium-high — emotionally resonant, but a "check-in call" is less visually dynamic than live tool-driven UI changes (Ideas 1, 2, 4).

**Feasibility:** Yes, 2 devs, ~1–1.5 weeks.

**Risks:** Needs reliable structured extraction (medication names, pain scale) from natural speech — LLM reliability risk. Must stay explicitly framed as a prototype/demo, never implying real medical advice or monitoring — an ethical and credibility risk if oversold in the presentation.

**APIs Needed:** AssemblyAI Voice Agent API with tool calling for structured field extraction.

**Recommended Team Split:** Dev A — voice session + structured extraction/tool schema. Dev B — caregiver dashboard UI + alert logic + presentation polish.

---

## Comparison Summary

| # | Idea | Complexity | Demo Impact | Business Value | Originality risk | Feasibility (2 devs, ~2wks) |
|---|---|---|---|---|---|---|
| 1 | RehearsAI (pitch/interview coach) | Medium | High | High | Low (nearest neighbor is narrow) | Comfortable |
| 2 | Workflow Voice Console | Medium | Medium-High | **Highest** | Medium-High (crowded cluster) | Comfortable |
| 3 | LiveMeetingCoPilot | Medium-High | High (if it works) | Medium-High | Low-Medium | Tight |
| 4 | AccessNav Voice Companion | Medium-High | High | High | **High** (direct collision) | Tight |
| 5 | VoiceQuest (game) | Medium | Very High | **Low** | Medium (genre neighbors exist) | Comfortable |
| 6 | CareCheck Companion | Medium | Medium-High | High | Low (genuine whitespace) | Comfortable |

## Recommendation (proposed, not yet accepted)

> **Superseded 2026-09-25.** The Sep 25 rescan ([research.md](research.md#rescan--2026-09-25-supersedes-the-whitespace-notes-above)) found near-identical entries for Ideas 1, 4 and 6, and the generic version of Idea 2. Also, the deadline is now ~5 days out, not ~14, so the "1–1.5 week" feasibility estimates above no longer fit. The original recommendation is kept below for the record. A new direction is being discussed; see "Notes from Discussions".

**Primary: Idea 1 (RehearsAI).** Best balance across all four judging criteria, lowest execution risk, no meaningful prior-art collision, comfortably buildable frontend-only on the Voice Agent API in the remaining ~14 days.

**Strong alternate: Idea 2 (Workflow Voice Console)** if the team wants to lean into Kissflow-adjacent domain expertise for an even stronger Business Value narrative — but only with a sharply differentiated angle (audit-trail/approval-chain framing), given how crowded that cluster already is.

**Idea 6 (CareCheck)** is the dark-horse pick if the team wants the most original/whitespace positioning over the safest one.

This is a proposal for discussion, not a decision — see [decisions.md](decisions.md) for what's actually been locked in.

## Rejected / Parked Ideas

*(none yet — nothing has been formally rejected; Ideas 4 and 5 lean "Future Scope" above but remain open pending team discussion)*

## Notes from Discussions

- 2026-09-16: Initial batch of 6 ideas generated from hackathon requirements + competitor scan, before any live discussion with the team. Next step is for Thomas (and Developer B, TBD) to react to these and either accept one, request a pivot, or ask for a new batch along a different axis.
- 2026-09-25: Rescanned the submissions board (~150 entries now). Ideas 1, 4 and 6 have near-identical entries (MockMate/Interview Lab, Talkie/Aalto, EverCall). **Recommending they be marked Rejected (Originality)**, pending team confirmation. Two new seeds emerged from the remaining whitespace, both in Thomas's BPM domain. Not yet templated; discussion starting:
  - **Seed A — Voice Approvals Inbox:** a manager clears their pending approval queue by voice (POs, expenses, leave), with context read aloud, policy flags, and approve/reject/ask/delegate.
  - **Seed B — Talk-to-Build Process Designer:** an AI business analyst interviews a process owner and builds a live workflow diagram plus request form while they speak.
