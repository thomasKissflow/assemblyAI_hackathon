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
- 2026-09-28: Thomas: **Seeds A and B → `Rejected`** (too close to Kissflow). **Ideas 1–6 → `Rejected`**: 1, 4 and 6 collided on Originality, 2 is Kissflow-adjacent, 3 is crowded and too risky for the time left, 5 is weak on Business Value. New filter: *a use case where a voice agent is actually useful.* Rescanned the board (216 entries now) and ran a multi-agent brainstorm (4 generator lenses → head-judge ranking against all 216 → 3 skeptics: voice-gimmick, originality, build-tonight). Results go in the 2026-09-28 batch below.

---

## Candidate Ideas (2026-09-28 batch: "where voice is actually useful")

Generated by a multi-agent brainstorm: 4 lenses (hands/eyes busy, can't type or read, high-stakes moments, play/social) produced 24 ideas. A head judge merged them, checked each against all 216 submissions and scored the survivors 1–5 on five axes. Three skeptics then reviewed the top 8: *voice-gimmick*, *originality* (including products outside the hackathon) and *build-tonight* (which ran real probes against the API). Full raw output: `brainstorm-result.json` in the session scratchpad. Status for all: `Needs Research` until Thomas picks.

| # | Idea | Voice | Orig. | Biz | Demo/UI | Build | Total | Gimmick? | Collision? | Build tonight? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Heard, Chef** | 5 | 4 | 4 | 5 | 4 | 22 | strong | ok | strong |
| 2 | **Buzzkill** | 5 | 5 | 3 | 5 | 4 | 22 | ok | strong | strong |
| 3 | **Hush** | 5 | 4 | 4 | 4 | 5 | 22 | strong | weak | ok |
| 4 | **Sideline** | 5 | 4 | 4 | 4 | 5 | 22 | ok | ok | ok |
| 5 | **Woodshed** | 5 | 5 | 4 | 4 | 3 | 21 | ok | ok | weak |
| 6 | **Crit** | 4 | 5 | 4 | 4 | 4 | 21 | weak | ok | weak |
| 7 | **Purl** | 5 | 4 | 3 | 4 | 5 | 21 | weak | ok | weak |
| 8 | **Groundwork** | 5 | 4 | 4 | 3 | 5 | 21 | weak | ok | weak |

### B1. Heard, Chef — `Accepted` (2026-09-28, see decisions.md)

**One-liner:** A kitchen expediter you talk to with raw-chicken hands. Name the dishes and when you eat, and it plans every dish backward on one live timeline. When something slips it re-plans out loud, and it calls "fire the beans now" without being asked.

**Problem / the moment:** 6:40 pm, dinner for six at 7:30. The cook's hands are in raw chicken and their eyes are on a smoking pan. The oven runs 15 degrees cold, there are three recipes in three browser tabs and one kitchen timer. No single recipe is hard. The hard part is getting four dishes to the table hot at the same minute.

**Why voice (not tapping):** Touching the screen means washing raw-chicken hands first, and the cook's eyes have to stay on the pan. The plan changes every few minutes ("potatoes need 10 more", "the oven's only at 180"), and re-planning is arithmetic nobody can do while basting. Saying "potatoes are in" costs nothing. Tapping it costs a hand wash.

**Demo moment:** The judge says "Salmon, roast potatoes and green beans, we eat at 7:30, one oven." Lanes draw backward from 7:30 and an oven-temperature clash is flagged. "Potatoes are in" starts a countdown ring. "Ugh, the oven's running cold" slides every later block to the right, the serve clock moves to 7:38, and the agent says "Pushing dinner 8 minutes, hold the beans." On demo speed (1 min = 5 s) a timer fires and the agent speaks unprompted: "Fire the beans now."

**Frontend showcase:** - A kitchen 'rail' timeline styled as expediter tickets, not a project-management Gantt chart.
- One lane per dish, plus resource lanes for the oven, two burners and 'your hands'.
- A sweeping NOW line, and blocks that animate when the plan changes.
- Stacked countdown rings, and a huge NEXT UP card readable from 3 m away.
- A red glow on resource clashes (two dishes needing different oven temperatures).
- A Serve-at clock that visibly moves.
- A full-screen red safety card with fixed text for "the pan's on fire".

Application of Technology: when a timer fires, the browser sends reply.create, so the proactive callouts come from real app state. Barge-in lets "wait, what?" cut the agent off.

**Client-side tools:** `plan_meal(dishes[], serve_time, constraints{ovens, burners}) -> backward schedule + resource conflicts from a hard-coded recipe library with real durations`; `start_step(dish, step_id)`; `complete_step(dish, step_id)`; `report_delay(dish, minutes, reason) -> reflowed plan + new serve time`; `set_serve_time(time)`; `start_timer(label, seconds, dish)`; `adjust_timer(label, delta_seconds)`; `what_next() -> next due actions across all dishes`; `emergency(type: grease_fire|burn|cut) -> fixed, pre-written safety text`; `(client-initiated) reply.create with 'Announce: fire the beans now' when a timer fires`

**Business value:** Likely buyers:
- Recipe subscriptions (NYT Cooking, Samsung Food).
- Meal-kit companies (HelloFresh). Every box is a three-component timing problem.
- Smart-oven and appliance makers (Samsung, LG, Whirlpool) that want a voice layer that knows what's in the oven.

Seasonal peaks (Thanksgiving, Diwali, Christmas) give it natural marketing moments. The product is timing across several dishes. It is not 'read me the recipe', which smart speakers already do.

**Nearest submission / prior art:** #27 BenchMate reads protocol steps aloud and runs timers hands-free at a lab bench, so the 'steps + timers' mechanism overlaps. The pitch has to open on what's different: backward scheduling of several dishes over a shared oven and burners, live re-planning and proactive callouts. None of the 216 is about cooking. #73 VoiceWaiter is restaurant ordering.

**Ranker notes:** Ranked #1 as the best all-rounder. Everyone recognises the moment, a judge can start it with one sentence, it shows a visible Application-of-Technology beat (unprompted callouts via reply.create), and it has credible buyers.

Risks and what to do about them:
- Voice cooking help is a familiar category (Alexa timers), so the pitch must open on the re-plan.
- The scheduler must be deterministic JS, never LLM math: a simple backward list scheduler with resource locks over 6-8 hard-coded recipes.
- A demo-speed clock is required.
- A proactive reply.create can collide with the user talking. Queue it until the user is silent.

Tonight's spike: confirm reply.create and its exact event shape, since this repo has only verified open → session.updated. Style the timeline as kitchen tickets so it doesn't read as workflow software (the Kissflow filter).

- *Sharpened angle (voice-gimmick skeptic):* You never set a timer. You say what the food is doing ('potatoes need ten more'), and it re-plans every dish and calls each fire out loud, because your eyes are on the pan and your hands are in raw chicken. Voice output (the unprompted call) is the core, and voice input is how you report slips.
- *Sharpened angle (collision skeptic):* The kitchen timer you can complain to. Say 'the oven's running cold' or 'they're 20 minutes late' and it re-plans every dish out loud, then calls 'fire the beans' on its own. The re-plan is the product. The schedule is table stakes.
- *Sharpened angle (build-tonight skeptic):* Lead with the callout, not the planner. Screen planners (prepSync, SousSmart) already schedule backward and flag oven clashes. Heard, Chef is the expediter that speaks first: 'fire the beans now', triggered by app state through reply.create, while your hands are in raw chicken.

### B2. Buzzkill — `Needs Research`

**One-liner:** A referee for forbidden-word party games. It hears every word the clue-giver says, buzzes the instant a banned word slips out, catches the right guess and keeps score, so nobody has to sit out as card-watcher.

**Problem / the moment:** Friday night: six friends, two teams, one card. The clue-giver talks fast and waves their hands. A rival leans over their shoulder watching for banned words, someone runs a phone timer and someone else keeps score on a napkin. Every other round ends in "you said slice!" / "I said slight!". The laptop sits on the coffee table facing the room.

**Why voice (not tapping):** The whole game is fast, overlapping speech, with nothing to type or tap. The card-watcher job exists only because a human has to listen for slips, and that person misses things, argues and doesn't get to play. Only a voice agent can be an impartial listener that never looks away.

**Demo moment:** The judge clicks Play vs AI. The card is PIZZA, with cheese, slice, Italy, pepperoni and dough banned. The judge says "It's round, you order it on Friday nights, it's covered in chee—" and it buzzes mid-word. The screen flashes red, the card shakes, 'cheese' lights up red in the live transcript, and the host quips "Cheese! Slip." Next card, GUITAR: "six strings, you strum it" gets "Guitar!" from the agent, confetti and +1. Then they swap roles: the agent describes and the judge guesses. It takes thirty seconds and needs no instructions.

**Frontend showcase:** - A big flippable card showing the target word and its five banned words.
- A live transcript ticker where banned words turn red as they're spoken.
- A buzz shakes the card, flashes the screen red and plays a buzzer sound.
- A correct guess flips the card with confetti.
- A circular round timer and a two-team scoreboard with animated counters.
- An end-of-round blooper reel that quotes each slip word for word.

Application of Technology:
- The browser decides the buzz from partial user transcripts, so it fires mid-sentence instead of waiting for the LLM.
- Each new card calls session.update to set that card's target and banned words as keyterms.
- reply.create makes the host react out loud after a buzz.
- The agent's own transcript is checked too, so an AI self-slip becomes a comedy beat.

**Client-side tools:** `next_card(deck, difficulty: easy|medium|hard) -> {word, forbidden[]} (client also pushes keyterms via session.update)`; `buzz(forbidden_word, heard_phrase) (normally fired locally from partial-transcript matching; the LLM can also call it for variants like 'cheesy')`; `mark_correct(guess, team)`; `skip_card(reason)`; `start_round(team, seconds)`; `update_score(team, delta, reason)`; `add_cards(theme, cards[{word, forbidden[]}]) (LLM generates themed decks, e.g. 'Bollywood', 'cricket')`; `show_round_recap() -> blooper reel of slips with the exact words heard`

**Business value:** Party games are a proven paid category: Jackbox party packs, and Warner Bros.' Heads Up!. Taboo is a Hasbro trademark, so this ships under its own name with its own decks. Revenue options:
- Premium themed deck packs.
- Licensing the 'AI referee' engine to smart-TV and party-game publishers and to Discord Activities.
- Bar and venue game nights.

The engine carries over to any banned-word or say-the-word game.

**Nearest submission / prior art:** #143 Voice Case, a single-player murder mystery narrated by an AI game master. Overlap is low: Buzzkill is a multiplayer party game where the AI referees and guesses. None of the 216 is a word game or a referee.

**Ranker notes:** Best live-judging experience, the highest originality, and the sharpest Application-of-Technology story (partial transcripts + per-card keyterms). Its business case is the weakest of the top four, so pitch it as an AI referee engine for party-game publishers.

Make-or-break spike tonight: check that the Voice Agent API streams partial user transcripts, and how quickly. The brainstormer's event name, transcript.user.delta, has not been verified. If partials only arrive at the end of a turn, open a second browser WebSocket to Realtime STT (~150 ms partials) just for buzz detection.

Other risks:
- There is no speaker identification, so ship 'Play vs AI' as the headline mode.
- Match whole words with light stemming only, to avoid 'slight'/'slice' false buzzes.

- *Sharpened angle (voice-gimmick skeptic):* The only opponent that hears the slip: a one-on-one forbidden-word game where the AI both plays and referees, buzzing mid-word from partial transcripts. Be honest that this clears 'voice is necessary' but not 'practically useful'. The one practical reframe (word-retrieval practice after aphasia) falls into speech-therapy and tutoring territory and isn't recommended.
- *Sharpened angle (collision skeptic):* Game night's impartial ears: it hears the banned word mid-syllable and buzzes before anyone at the table can argue. It is a referee that plays neither side, not an AI that plays Taboo.
- *Sharpened angle (build-tonight skeptic):* The first party game where the AI is both a teammate and an impartial referee. The judge describes and the AI guesses, then they swap, and a banned word gets buzzed within a second. Pitch it as a referee engine that party-game publishers and smart-TV makers can license, with Buzzkill as the proof.

### B3. Hush — `Needs Research`

**One-liner:** A baby log you whisper to at 3 a.m. with a baby in one arm. Say "left side, starting", "wet diaper" or "which side next?" and a dim red 24-hour ring fills in. In the morning it gives your partner a spoken handoff.

**Problem / the moment:** 3:10 a.m. in a dark nursery. The parent is in the armchair with one arm cradling a feeding baby and the other holding the bottle or supporting her head. The lights stay off so she stays drowsy. The pediatrician wants feeds, diapers and sleep tracked, and the partner on the 6 a.m. shift will ask when she last ate. The parent can't remember whether it was 1:00 or 1:40, or which side.

**Why voice (not tapping):** Both hands are holding the baby. Unlocking a phone throws white light that wakes both baby and parent, and tapping tiny timer buttons one-handed while half-asleep is exactly how feeds go unlogged or get logged wrong. A whisper is the only free channel, and "which side do I start on?" is a question, not a button.

**Demo moment:** The page opens in near-black red night mode, with a day of seeded feeds, sleeps and diapers on a 24-hour ring. The judge whispers "starting a feed, left side": a glowing arc starts growing next to a big dim timer. "Switch to right" recolours the arc. "She's done, and a wet diaper" closes the arc and drops a marker. "When did she last eat, and which side next?" gets a soft "Ended 3:24, 18 minutes, finished on the right, so start left" while that arc pulses. The judge flips to Morning and says "brief my partner": a 20-second spoken handoff plays and a handoff card appears.

**Frontend showcase:** - A low-luminance red/amber UI with no blue light, and a whisper-level waveform.
- A large radial 24-hour clock: sleep arcs, feed arcs coloured by side, dots sized by ml for bottles, and diaper glyphs.
- A live 'last fed 2h 14m ago' counter, a next-side indicator and daily totals.
- A shaded next-nap band, labelled as a generic guide.
- Morning mode flips to a light dashboard with the handoff card.

Application of Technology:
- Keyterm biasing on left, right, wet, dirty and the baby's name.
- session.update switches between the night prompt (ultra-short replies) and the morning prompt (full briefing).
- A Web Audio gain node keeps the agent's voice quiet.

**Client-side tools:** `start_feed(side: left|right|bottle, amount_ml?)`; `switch_side(side)`; `end_feed()`; `log_diaper(kind: wet|dirty|both, note?)`; `start_sleep(start_time?) / end_sleep(end_time?)`; `correct_last_entry(field, value)`; `undo_last()`; `query_log(kind: last_feed|next_side|totals_today|awake_since|night_summary) -> deterministic answer from the log`; `predict_next_window() -> generic age-based wake window, labelled as a guide`; `set_mode(night|morning) -> palette swap + session.update of prompt and volume`; `build_handoff(since_time) -> handoff card data`

**Business value:** Baby tracking is an established paid category (Huckleberry, Nara Baby, Baby Tracker) that earns from subscriptions and sleep coaching, and logging at night is its weak spot. The voice layer could be licensed to those apps, or to nursery-camera makers (Nanit, Owlet) that already have a mic in the room. Lactation consultants and pediatricians already ask parents for feed logs. Verify the brainstormer's '5+ million families' figure before quoting it.

**Nearest submission / prior art:** Nothing close. The loose neighbours are #172 Liora (a voice log of belongings), #42 Recall (a memory agent) and #53 PackCheck (voice logging with corrections). Medications are deliberately out of scope to stay clear of the adherence cluster (#116 Tell, #65 SilverLine, #215 EverCall).

**Ranker notes:** The most feasible idea in the top four (an SVG ring plus a deterministic log), with the purest 'only voice works' moment. Whispering to a laptop is also a memorable judge action.

Risks:
- Universal-3 Pro on whispered speech is untested. Test it in the first hour, and fall back to pitching a 'quiet voice' if needed.
- Replies must stay very short and quiet.
- The agent must refuse medical and feeding-amount advice.
- Judges without kids will feel it less. The seeded ring has to look lived-in, and the video should carry the real nursery moment.
- Before the pitch, check whether the big baby-tracker apps already offer voice logging. If they do, lead on the whisper, the dark UI and the deterministic 'which side next' answers.

- *Sharpened angle (voice-gimmick skeptic):* For the moments your hands are literally full of baby, the changing table and the 3 a.m. bottle: say what happened, ask 'which side do I start on?', and the phone never lights up. Logging is a side effect. The agent answers the question a sleep-deprived brain can't.
- *Sharpened angle (collision skeptic):* A night-shift handover for new parents. Whisper what happens at 3 a.m., and at 6 a.m. your partner asks 'how was the night?' and hears the whole story. Only worth building if the handover conversation, not the 'log a wet diaper' command, is the headline.
- *Sharpened angle (build-tonight skeptic):* Alexa can already log a diaper. Hush answers the 3 a.m. questions ('which side, how long ago, when did she last sleep') in a whisper, with no screen light, and hands the night over to your partner at 6 a.m. with a spoken briefing. The question-answering and the handoff are the product; logging is plumbing.

### B4. Sideline — `Needs Research`

**One-liner:** A voice bench manager for volunteer youth-sports coaches. Call subs, goals and knocks out loud without looking away from the kids. It tracks every child's minutes and warns you before anyone drops below fair playing time.

**Problem / the moment:** Saturday-morning under-9 soccer. A parent volunteer stands on the sideline with a clipboard, water bottles and a ball, 12 kids on the team and 7 on the field. The league's 'Everyone Plays' rule wants every child on for at least half the game, the parents in the stands are counting, and the coach is trying to actually watch the match.

**Why voice (not tapping):** The coach's eyes have to stay on the field for safety and coaching, and their hands are full. A tap-based stats app means looking down and missing plays. The coach is already shouting "Theo, you're in for Sam!", so the spoken call becomes the data with no extra effort.

**Demo moment:** The roster is preloaded. The judge says "Starting five: Maya, Leo, Ava, Sam, Jo. Kick off." Jersey tokens slide onto an animated pitch and the demo-speed clock runs. "Goal Ava, assist Leo!" sets off a burst on Ava's token. "Theo in for Sam" swaps the tokens and the minute bars update. At the period break the agent speaks up unprompted: "Priya is at 4 minutes, under half. Put her in for Leo?" "Yes." At the final whistle a per-child minutes report appears, with a message ready for the parents' WhatsApp group.

**Frontend showcase:** - A top-down animated pitch with jersey tokens that swap on every sub, plus a period clock.
- A playing-time bar for each child, with a 50% target line that turns green once met.
- An event timeline of goals, saves, knocks and 'great effort' shout-outs.
- A suggested rotation for the next period.
- An end-of-game card with fair-play stats, ready to paste.

Application of Technology:
- Keyterm biasing on roster names that generic speech-to-text mangles (Siobhan, Aarav).
- A client-initiated reply.create at period breaks gives proactive fairness nudges. This corrects the brainstormer's note that the agent can only speak after the user does.

**Client-side tools:** `set_roster(players[])`; `set_lineup(on_field[], bench[])`; `clock(action: start|pause|next_period)`; `substitute(player_in, player_out) -> updated minutes + fairness warnings`; `log_event(type: goal|assist|save|injury|shout_out, player, note)`; `get_playing_time()`; `plan_rotation(period) -> deterministic rotation that meets the minimum`; `end_game_summary()`; `(client-initiated) reply.create at period breaks when a child is under target`

**Business value:** Buyers are youth-sports team apps (TeamSnap, GameChanger, SportsEngine) and leagues with playing-time rules; AYSO's 'Everyone Plays' calls for at least half of each game. There are millions of volunteer coaches, and playing time is a top source of friction with parents. It fits as a freemium feature or a league-wide licence, and the minutes report doubles as evidence when a parent complains.

**Nearest submission / prior art:** None of the 216 is about sport. The closest mechanism is #76 CrewVoice, which turns a spoken report into time records for construction payroll, and #161 Uh-Huh shares the busy-hands angle. Overlap is low.

**Ranker notes:** Very buildable, with a clear buyer and a moment every parent-coach knows. Originality is 4, not 5, because the mechanism (voice turned into structured records) is the most crowded pattern among the 216 (DockVoice, PackCheck, Recount, CrewVoice, RECEBE). The novelty is the domain plus the fairness engine.

What to do:
- Preload the roster so judges only have to say "Theo in for Sam".
- A demo-speed clock is required.
- Real sidelines are loud and windy, so pitch an earbud mic and lean on keyterm biasing.
- It ranks below Hush because the visual is a notch less striking and judges have to speak made-up names.

- *Sharpened angle (voice-gimmick skeptic):* Target sports with on-the-fly changes, where the coach truly cannot look down: ice-hockey line changes every 45-60 seconds, futsal and youth basketball rolling subs. It tracks every kid's ice or floor time from the calls the coach already shouts, and warns before anyone falls short. If it stays soccer, frame it as the minutes ledger that ends the parking-lot argument, built from what the coach already shouts.
- *Sharpened angle (collision skeptic):* The coach's conscience with open ears: it hears the subs you already shout, and it speaks up before any kid sits too long. Fair-play apps exist; one you never have to look down at doesn't.
- *Sharpened angle (build-tonight skeptic):* The playing-time tracker you run by shouting the subs you already shout. There are plenty of fair-play apps, and every one of them makes you look down at your phone. Sideline never does, and it warns you before any kid falls under half.

### B5. Woodshed — `Needs Research`

**One-liner:** A practice room you run without letting go of your instrument. Say "metronome 80 in 6/8, count me in", "ladder 70 to 100 by 5", "clean" or "tune me", and the metronome, tempo ladder, tuner and practice log respond while you play.

**Problem / the moment:** A weeknight in a bedroom. An adult learner has a guitar strapped on, a pick in one hand and the other hand on the fretboard (or a violin under the chin). The metronome app on the laptop needs a reach and a poke every time they want 5 bpm slower. They lose their place every 40 seconds, and the practice diary their teacher asked for stays empty.

**Why voice (not tapping):** Both hands, and for strings and wind the whole body, are committed to the instrument, and every reach for the trackpad breaks posture and the repetition loop that practice depends on. Deliberate practice is a constant stream of small setting changes ("again, slower, faster"), and musicians already mutter these aloud. The practice log also fills itself from what they say.

**Demo moment:** The judge says "Metronome at 80 in 6/8, count me in." A beat ring pulses with an accented one and the agent counts in. "Show me F-sharp minor on guitar" draws the barre chord. "Speed ladder from 70 to 100 by 5, two clean passes each" builds a staircase, and two "clean"s step it up to 75 with a chime as the tempo shifts. "Tune me" opens a needle tuner; the judge hums and the needle swings. "Log it: bridge still sloppy" drops a card onto a practice-streak calendar.

**Frontend showcase:** - A beat ring with accent flashes and a tempo dial, scheduled with Web Audio lookahead so the timing is sample-accurate.
- An animated tempo staircase that climbs on each clean pass.
- Chord and scale diagrams for fretboard, keyboard and ukulele.
- A big needle tuner: autocorrelation pitch detection on the same mic stream, via an AnalyserNode.
- A focus timer, a streak heatmap and a per-piece tempo chart ('Blackbird: 60 to 84 bpm this week').

Application of Technology:
- Keyterms for musical vocabulary that speech-to-text garbles ('C add nine', 'F sharp minor', 'six eight').
- Echo cancellation, plus ducking the metronome while the agent talks.
- A mid-session session.update makes the agent terse while the user plays.

**Client-side tools:** `set_metronome(bpm, time_signature, subdivision: quarter|eighth|triplet, accent_first)`; `count_in(bars)`; `start_speed_ladder(start_bpm, target_bpm, step, clean_passes_needed)`; `mark_pass(clean)`; `show_chord(name, instrument: guitar|ukulele|piano)`; `show_scale(root, mode)`; `tuner(on)`; `start_focus_timer(minutes, focus)`; `log_practice(piece, section, bpm, note)`; `session_summary() -> sections drilled, tempo gained, time spent`

**Business value:** Music learning is a subscription market (Yousician/GuitarTuna, Simply Piano, Fender Play, Ultimate Guitar). Woodshed could be licensed to those apps as a hands-free practice mode, or sold with a teacher tier: teachers assign tempo ladders and get a voice-generated practice log as proof that students practised. Verify the company-reported user figures before quoting them.

**Nearest submission / prior art:** None of the 216 is about music. The structural cousin is #27 BenchMate (hands-free timers and logs at a lab bench), and #52 Playhead (an interruptible audiobook) is the only other playback-control idea. It is not tutoring: the agent runs the practice tools and doesn't teach.

**Ranker notes:** Highest originality of the 21-point group, and a large market. Feasibility is 3 because of one make-or-break issue: the laptop's own metronome clicks, plus a real instrument, go into the same mic and can trigger false turns and cut the agent off.

Tonight:
- Use getUserMedia with echoCancellation, duck or pause the metronome while the agent speaks, and keep replies terse.
- Offer a spacebar or foot-pedal push-to-talk fallback.
- Use Web Audio lookahead scheduling, not setInterval.
- The tuner lets judges hum, which gives them something to do without an instrument.

Scope: drop bar-looping over rendered notation (alphaTab) from the MVP and add it only if there is time.

- *Sharpened angle (voice-gimmick skeptic):* Practise by verdict: you say 'clean' or 'again, slower', and the tempo ladder moves on your judgement, not a bar count, while the log writes itself from what you mutter. A stronger alternative to verify: a slow-down looper for learning songs by ear ('loop 1:12 to 1:20 at 75 percent', 'again', 'bit faster'). That task means constant trackpad reaches in Anytune- or Transcribe!-style tools, and it gives a waveform-and-loop-region UI (check whether Moises has voice control).
- *Sharpened angle (collision skeptic):* A speed trainer you climb without letting go of the guitar. The tempo steps up only when you say the pass was clean, and Woodshed remembers which bar keeps breaking. Not 'a voice-controlled metronome'.
- *Sharpened angle (build-tonight skeptic):* The tempo ladder you climb without letting go of the guitar: say 'clean' and it steps up 5 bpm, and your practice log writes itself from what you mutter. Sell teacher-assigned ladders plus proof-of-practice logs to music-lesson apps.

### B6. Crit — `Needs Research`

**One-liner:** A hands-free combat table for Dungeon Masters. Narrate as usual ("Borin hits goblin two for nine", "goblin one is poisoned") and the initiative order, HP bars, conditions, dice and SRD rules lookups update themselves.

**Problem / the moment:** Saturday afternoon D&D. The DM sits behind a cardboard screen with dice in one hand and a goblin miniature in the other, doing the goblin's voice, with initiative on a sticky note and HP on scrap paper. A player asks "does poisoned give disadvantage on saves?" and five people wait while the DM flips through the rulebook.

**Why voice (not tapping):** The DM's hands are on dice and minis, their eyes are on the players, and they are mid-performance. Everything a tracker needs, the DM already says out loud. Typing into a combat tracker breaks the scene and makes five people wait, while voice captures narration that is already happening.

**Demo moment:** On-screen prompt chips guide judges who don't play. The judge says "Start a fight: Aria the wizard, Borin the fighter, three goblins." Goblin tokens appear with SRD stat blocks (AC 15, HP 7), dice tumble, and the initiative ribbon sorts itself. "Borin hits goblin two for nine": the HP bar drains, a -9 floats up, and the goblin tips over with a skull and leaves the ribbon. "Goblin one is poisoned, does that give disadvantage on saves?" A poisoned badge appears and an SRD 5.1 rules card answers: no, only attack rolls and ability checks. "Next turn" advances the ribbon.

**Frontend showcase:** - An initiative ribbon of portrait tokens that slide into order and advance each turn.
- HP bars with floating damage numbers; defeated foes grey out with a skull.
- Condition badges that count down by round, and a round counter.
- Dice animations driven by browser randomness, not the LLM.
- SRD rules cards with attribution.
- A 'player view' toggle for a second screen that hides monster HP.

Application of Technology:
- Tool calls feed a deterministic encounter engine, so the LLM never invents HP or rolls.
- Keyterms are set per encounter for invented names and monster names ('Thalendriel', 'bugbear').
- A quiet mode acts silently and speaks only when addressed as 'Crit'.

**Client-side tools:** `start_encounter(combatants[{name, side: party|foe, hp, ac, init_bonus}])`; `spawn_monster(srd_name, count) -> stat block from bundled SRD 5.1 JSON`; `roll(expression, label) -> animated dice, browser RNG`; `roll_initiative()`; `apply_damage(target, amount, damage_type)`; `heal(target, amount)`; `set_condition(target, condition: SRD enum, rounds?, remove?)`; `next_turn()`; `lookup_rule(topic) -> SRD 5.1 excerpt card`; `end_encounter() -> recap (damage dealt, knockouts, rounds)`

**Business value:** Tabletop RPG tools are a real market: Hasbro bought D&D Beyond for $146.3M in 2022. SRD 5.1 has been CC-BY-4.0 since January 2023, so the core rules, monsters and conditions can ship legally with attribution. Revenue options:
- A DM subscription.
- A voice layer licensed to virtual tabletops (D&D Beyond, Roll20, Foundry VTT, Demiplane).
- Game stores running organised play.

**Nearest submission / prior art:** #143 Voice Case, where the AI is the game master narrating a mystery. Crit is the opposite: a human runs the game and the agent keeps the books. The closest mechanism is #151 Second Chair, a listener in a multi-person room that stays silent unless addressed by name; Crit's quiet mode uses the same pattern in an unrelated domain. Overlap is low.

**Ranker notes:** Rich visuals and a well-known market. Voice necessity is 4 because DMs can type between turns and an always-on mic at a table hears the players.

What to do:
- Mitigate the table chatter with the quiet-mode prompt, address-by-name, and an optional hold-spacebar gate.
- Judges who don't play D&D need a preloaded encounter and prompt chips, or the demo stalls.
- Bundle a hand-picked SRD subset (~15 monsters, all conditions) with attribution, and no non-SRD content.
- Keep HP and dice math in code.

- *Sharpened angle (voice-gimmick skeptic):* A clerk addressed by name: 'Crit, goblin two takes nine' updates a player-facing TV, and 'Crit, does poisoned affect saves?' reads the SRD verbatim. Even framed that way, voice is a convenience over typing for a DM who is mid-performance, not a necessity. It doesn't meet the user's 'actually useful' bar.
- *Sharpened angle (collision skeptic):* The rules lawyer that never interrupts. Narrate the fight as usual, and Crit keeps HP and initiative and calls the concentration saves, condition expiries and death saves the table always forgets.
- *Sharpened angle (build-tonight skeptic):* A voice rules lawyer for the table. 'Does poisoned affect saves?' gets an answer in two seconds with the SRD 5.1 text quoted on a card, while it silently keeps HP and turns. Still weaker than the top three, because voice bookkeeping already exists.

### B7. Purl — `Needs Research`

**One-liner:** A row counter and pattern reader for knitters. Say "row done" without putting the needles down and it advances the chart, reads the next row aloud and tracks repeats. If your stitch count is off, it points to the row where it went wrong before you have to rip back.

**Problem / the moment:** Evening on the sofa, halfway through a cabled hat: 96 live stitches, a needle in each hand, yarn tensioned over a finger. The pattern PDF is on a laptop across the coffee table, with a clicker counter on a string. Every row the knitter lets go, clicks, squints at row 23 of a dense chart and finds their place again. Lose count once and it's an hour of ripping back.

**Why voice (not tapping):** Both hands hold the needles and the yarn tension, and letting go risks dropping stitches. Eyes have to stay on the stitches, not a tiny chart across the room. Knitters already mutter 'k2, p2' to themselves, so "row done" and "what's next?" cost nothing, and hearing the row read aloud keeps their eyes on the work.

**Demo moment:** A seeded hat pattern with a coloured chart. The judge asks "Where am I?" and hears "Row 13 of 40, 96 stitches." "Row done": the current-row band slides up, the counter ticks, the swatch preview grows a row, and the agent reads "Row 14: knit 2, purl 2, cable 4 front, repeat." "What's a cable four front?" pops up an animated stitch card. "I've got 94 stitches, not 96": the app checks the expected counts row by row, highlights the decrease in row 12 as the likely culprit, and the agent explains the fix. "Frog back two rows" rewinds the chart.

**Frontend showcase:** - A full knitting chart grid with symbol cells and a glowing current-row band.
- A knitted swatch or garment preview that grows row by row.
- A giant row counter and a 'Repeat 3 of 4' tracker, readable from the couch.
- Expected-vs-reported stitch-count badges.
- Animated stitch-glossary and fix-it cards (dropped stitch, wrong count).
- Row-triggered reminders ('start the decreases'), and a rail for markers and notes.

Application of Technology: keyterm biasing for knitting jargon (k2tog, ssk, yarn over, purlwise, frog, tink), with an on/off toggle to show the difference.

**Client-side tools:** `load_pattern(pattern_id)`; `get_position()`; `advance_row(n = 1)`; `go_to_row(row)`; `frog_rows(n)`; `read_row(row) -> instruction text from the encoded pattern`; `explain_stitch(abbrev) -> glossary card`; `check_stitch_count(reported) -> expected count + most likely error rows (deterministic)`; `set_repeat_progress(section, count)`; `set_reminder(at_row, text)`; `show_fix(problem: dropped_stitch|wrong_count|twisted_stitch)`; `add_note(row, text)`

**Business value:** Ravelry had about 9 million registered users by 2020. Independent designers sell PDF patterns on Ravelry and Etsy, and row-tracking apps like knitCompanion already charge for pattern tracking. Purl could be a pattern-player subscription, or a 'voice-ready pattern' format that designers and yarn brands ship with paid patterns. It extends to crochet and cross-stitch.

**Nearest submission / prior art:** #27 BenchMate reads protocol steps aloud and keeps counts at a lab bench: the same 'read next step, keep count' mechanism in an entirely different domain. None of the 216 is about crafts.

**Ranker notes:** Charming and very buildable: an SVG chart grid and one hand-encoded JSON pattern, with no PDF parsing.

Risks:
- The audience is niche and many judges won't knit, so the video must show real hands knitting.
- Judges may read it as 'a row counter with voice'. The deterministic stitch-count diagnosis is the feature that answers that.
- The keyterm on/off toggle is a clean Application-of-Technology beat.

- *Sharpened angle (voice-gimmick skeptic):* A pattern you can question with needles in both hands ('when do the decreases start?', 'how many repeats left?', 'what's ssk?') that reads lace rows one repeat at a time, so your eyes never leave the stitches. Counting is the clicker's job; answering is the agent's. Even so, the audience is niche and it sits close to BenchMate.
- *Sharpened angle (collision skeptic):* A knitting debugger. Say your stitch count is off and it tells you which row went wrong and how to fix it, and you never put the needles down. The row counter is just plumbing.
- *Sharpened angle (build-tonight skeptic):* An eyes-on-stitches chart reader. It reads the next row stitch by stitch ('knit two, yarn over, slip slip knit… next') so you never look up at the PDF. Voice row counters already exist; being read to while your hands keep knitting is the new part.

### B8. Groundwork — `Needs Research`

**One-liner:** A calm voice that talks you down from a panic attack with your eyes closed. It paces your breathing, walks you through 5-4-3-2-1 grounding in your own words, and slows down the moment you say "I still can't breathe".

**Problem / the moment:** A bathroom stall at work before a presentation, or 2 a.m. in bed. Heart racing, hands shaking, tunnel vision, text swimming on the screen. The person knows the techniques (a long exhale, 5-4-3-2-1 grounding) but can't recall or carry them out alone mid-attack. They press one big button or a keyboard shortcut.

**Why voice (not tapping):** Mid-attack, fine motor control and reading comprehension both drop, so typing to a chatbot or reading a list of steps fails, and the usual advice is to close your eyes. Naming what you see out loud is itself the grounding technique, so speech is the treatment, not just the input. A voice that adapts when you cut in with "it's getting worse" beats a recording, and "I'm freaking out" is easier to say than to type.

**Demo moment:** The judge presses "I'm panicking" (or picks the gentler 'pre-presentation nerves' path). The screen dims and a slow voice says "I'm here. Breathe out with me." The orb paces 4 in, 6 out with soft chimes. "Zero to ten, how strong?" "Eight" plots the first point. "Tell me five things you can see." "Laptop, coffee cup, window, a plant, my phone": five tiles float into the See ring in the judge's own words. The judge cuts in with "I still can't breathe". Barge-in stops the agent mid-sentence, it switches to a longer-exhale pattern and the orb visibly slows. The end card reads: "You came down from 8 to 3 in 6 minutes. What helped: long exhales, naming objects."

**Frontend showcase:** - A breathing orb timed by the browser, not by TTS, with audio cues.
- Concentric 5-4-3-2-1 sense rings that fill with glowing tiles in the user's own words.
- A 0-10 distress line that falls across the session.
- A low-light, high-contrast theme.
- An end card, and a 'my plan for next time' saved locally.
- A crisis-resources panel that appears only when a deterministic keyword rule fires, never via the prompt.

Application of Technology:
- Barge-in is essential: "I can't" must cut the agent off instantly.
- session.update slows the voice and shortens replies as distress rises.

**Client-side tools:** `start_breathing(pattern, inhale_s, hold_s, exhale_s, hold2_s, cycles)`; `stop_breathing()`; `log_distress(level_0_10)`; `grounding_prompt(sense, count)`; `add_sense_item(sense: see|touch|hear|smell|taste, text)`; `show_crisis_resources(region) (also fired by a client-side keyword rule, never left to the prompt)`; `save_coping_plan(what_helped[])`; `end_session_summary()`

**Business value:** About 28% of US adults report at least one panic attack in their lifetime (Kessler et al. 2006, NCS-R). Buyers:
- Employer mental-health benefits and EAPs.
- Wellness apps (Calm, Headspace), as an acute-moment voice mode.
- University counselling centres and telehealth platforms, for use between sessions.

Positioned as self-help, not treatment.

**Nearest submission / prior art:** None of the 216 covers in-the-moment mental health. #171 LoudEnough (talk a problem through and leave with a message) and #215 EverCall (a post-call wellbeing radar for elderly parents) are different moments. Visual caution: #190 ARIA already uses a 'living, breathing orb' as its generic voice visual, so here the orb must read as a pacing instrument, and the sense rings and distress chart should carry the UI.

**Ranker notes:** The strongest 'only voice works' argument in the set, but the riskiest in front of judges.

Risks:
- Safety: fixed, scripted techniques only, no diagnosis, keyword-triggered helplines, no storage and a clear disclaimer.
- Judges may be uncomfortable role-playing a panic attack, so ship the 'nerves' path.
- Guided breathing is familiar from Calm and Headspace, so originality rests on the adaptive conversation and barge-in.

Ranked 8th over SideOut (20) on business value. Swap them if the user wants a lighter tone.

- *Sharpened angle (voice-gimmick skeptic):* Early-labour contraction coach. During a contraction you can't tap a timer and your eyes are shut, and your partner's hands are busy on your back. You say 'here's one' and 'it's over'. It times each contraction, paces your breathing through it with the orb, charts frequency and length, and flags when you reach the 5-1-1 pattern your midwife gave you. Talking is normal in that room, both people's hands are busy, and it's lighter for judges than role-playing panic. The caveat: it's health-adjacent, so frame it as a timer applying the care team's own rule, never as advice.
- *Sharpened angle (collision skeptic):* It hears you calming down. A voice paces your breathing and grounds you in your own words, and it adjusts to how fast and breathless you actually sound, not to a script.
- *Sharpened angle (build-tonight skeptic):* Ninety seconds before you walk on stage: a voice-only, eyes-closed reset for pre-performance nerves. The sense rings fill with your own words and the distress line falls. Keep panic support as the extended use case and out of the live judge demo.

### Dropped by the head judge (2026-09-28)

- **SideOut**: Scored 20 and missed the top 8 (voice 5, originality 4, business 3, demo 3, feasibility 5). The voice need is real: the device is 5 m away, a paddle is in hand and the players are out of breath. None of the 216 does sports scoring; #161 Uh-Huh only shares the one-word-answer pattern. But the visual is lighter than the finalists', judges who don't play pickleball won't feel the three-number call, and Sideline already fills the sports slot. It's the best swap-in if you want something lighter than Groundwork.
- **Nightglass**: Scored 19 (voice 3, originality 5, business 3, demo 5, feasibility 3). It fails filter 1 at the margin: AR sky apps in red night mode already answer 'what's that star?' when you point the phone, so voice isn't clearly better than the incumbent. Judges indoors can't check the real sky, and a star catalog, projection and camera sweeps are heavy for one night.
- **Sit Happens**: Scored 19 (voice 5, originality 5, business 3, demo 3, feasibility 3). It has the best insight in the set: cue and marker words are already spoken, so reps and response time come for free. But the Voice Agent API will treat every 'Sit.' and 'Yes!' as a turn and try to reply, so it needs a silent mode or a second Realtime STT socket. Response times measured from partial-transcript arrival jitter by roughly 100-300 ms, and the demo is a judge role-playing an invisible dog. Worth keeping as a wildcard.
- **Unroll**: Scored 19 (voice 5, originality 4, business 4, demo 3, feasibility 3). Judges at a laptop won't be in downward dog, so the core moment doesn't land live. 'My wrist hurts' drifts toward rehab and medical advice (#30 constancia), and a stick figure that animates convincingly between poses is a big one-night risk.
- **Tell-a-Picture**: Scored 19 (voice 4, originality 3, business 3, demo 5, feasibility 4). Judges are adults, so the pre-reader claim can't be proven in the demo, and speech recognition on young children is unproven. It sits next to the voice-directed builder cluster (#126 Voxfolio, #214 STICK, #64 NovelOS), it brings kid-safety constraints, and it invites the critique that toddlers can just tap stickers.
- **Allen**: Scored 18 (voice 5, originality 3, business 4, demo 4, feasibility 2). A hands-free step-by-step manual is the crowded procedure-guide pattern (#27 BenchMate, #98 WalkAround, #196 FieldSense, #206 Relay). With no camera, the agent can't see the mistake it is meant to catch, and a three.js assembly animation is too much for one night.
- **Dark Square**: Scored 18 (voice 4, originality 4, business 2, demo 4, feasibility 4). Blindfold play is a self-imposed constraint, so voice necessity rests on a niche training use. Voice move entry already exists outside the hackathon (the Lichess voice beta), and the business case is narrow.
- **Last Seen**: Fails the crowded-cluster filter. Capturing a structured description under stress for responders is the emergency-intake pattern (#72 Kwik 112, #41 AIRA, #209 VoiceMed, #39 Tumani SOS). Plausibility is also weak, since a panicking parent runs to staff rather than opening an app, and it is grim for judges to role-play.
- **Red to Red**: Fails the crowded-cluster filter. A guided procedure that waits for per-step confirmation is the BenchMate/WalkAround/FieldSense/Relay pattern (#27, #98, #196, #206), and the roadside-breakdown moment overlaps #39 Tumani and #169 ClaimVoice. Liability for mechanical advice and a role-played demo add risk.
- **Before It Fades**: Fails the crowded-cluster filter: it is a memory and journaling agent (#42 Recall, #172 Liora, #113 Lia), and #64 NovelOS already turns spoken narrative into an entity map. It has the weakest business case, and wide-awake judges make the groggy half-asleep moment feel staged.
- **Are We There Yet**: Weak business case (the brainstormer's own caveat). The car and route have to be simulated at a laptop, the core (20 Questions) is generic LLM chat, and telling several kids apart without speaker identification is shaky. The in-car, multi-passenger angle overlaps #32 Backseat, and the entertainment angle overlaps #181 Radio Universe.
