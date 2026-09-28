# Task Board

Owners: **Thomas** (thomas@kissflow.com), **Developer B** (name not yet provided), **Claude Code**.
Deadline: **Sep 30, 8:30 PM IST.** Build plan: [plans/2026-09-28-heard-chef.md](superpowers/plans/2026-09-28-heard-chef.md).

## Backlog

| Task | Owner | Priority | Status |
|---|---|---|---|
| Real voice run with headphones: cook a pretend dinner, interrupt Chef, ask a cooking and an off-topic question. Note anything that feels off. | Thomas | High | Backlog (first thing Sep 29) |
| Tune the prompt, voice or timings from that run (tell Claude Code what felt off) | Thomas + Claude Code | High | Backlog |
| Listen to the "michael" voice and confirm it (auditions are in the session scratchpad; the other 10 are listed in the docs) | Thomas | Medium | Backlog |
| Record the demo video, following [demo-script.md](demo-script.md) | Thomas | High | Backlog |
| Slide deck (8 slides, outline in [pitch.md](pitch.md)) and cover image (use `docs/screenshot.png` as a base) | Developer B / Thomas | High | Backlog |
| Push the public GitHub repo; confirm `.env.local` is not in it (`git ls-files .env.local` prints nothing) | Thomas | High | Backlog |
| Decide on hosting for the "Application URL" (a static build on Vercel or Netlify; the key would be visible in the bundle, so use a limited key) | Thomas | Medium | Backlog |
| Submit on lablab.ai. Copy is ready in [pitch.md](pitch.md): title, short and long description, tags. | Thomas | High | Backlog |
| After judging: rotate the AssemblyAI API key | Thomas | Medium | Backlog |
| Confirm Developer B's name and role for the docs | Thomas | Low | Backlog |

## In Progress

| Task | Owner | Priority | Status |
|---|---|---|---|
| *(nothing; the overnight build is done)* | | | |

## Blocked

*(none)*

## Completed

| Task | Owner | Priority | Status |
|---|---|---|---|
| Extract the hackathon requirements, judging criteria, timeline and submission requirements | Claude Code | High | Done (2026-09-16) |
| Research the Voice Agent API vs Realtime STT, including browser auth | Claude Code | High | Done (2026-09-16) |
| Competitor/prior-art scans (~45 → ~150 → 216 entries) | Claude Code | High | Done (2026-09-16, 09-25, 09-28) |
| Verify the no-backend connection (raw key on the WebSocket, in the browser and in Node) | Claude Code | High | Done (2026-09-28) |
| Multi-agent brainstorm (24 ideas → 8 ranked → 3 skeptics) and pick Heard, Chef | Claude Code + Thomas | High | Done (2026-09-28) |
| Design discovery, PRODUCT.md, spec v2 and plan v2 | Claude Code + Thomas | High | Done (2026-09-28) |
| Plan T1–T4: planner, clock, store, voice core, "Hey Chef" ears, voice runtime, plus 7 live agent tests | Claude Code (build workflow: implementer + reviewer per task) | High | Done (2026-09-29) |
| Plan T5: kitchen-pass UI with Impeccable (all 8 wow moments) | Claude Code | High | Done (2026-09-29) |
| Plan T6: component tests, Playwright flows at 3 viewports, and the real-voice fake-mic test | Claude Code | High | Done (2026-09-29) |
| Plan T7: isolated Impeccable critique + audit, then fixes (see decisions.md) | Claude Code | High | Done (2026-09-29) |
| Plan T8: pitch, lablab copy, slide outline, demo script, README and hero screenshot | Claude Code | High | Done (2026-09-29) |

## Notes on Priority

- **Sep 29:** your voice run and any tuning, then the video.
- **Sep 30:** slides, repo, optional hosting, and the submission.

The app is feature-complete for the demo. Resist adding features; spend the time on the video.
