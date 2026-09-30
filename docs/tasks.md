# Task Board

Owners: **Thomas** (thomas@kissflow.com), **Developer B** (name not yet provided), **Claude Code**.
Deadline: **Sep 30, 8:30 PM IST.** Build plan: [plans/2026-09-28-heard-chef.md](superpowers/plans/2026-09-28-heard-chef.md).

## Backlog

| Task | Owner | Priority | Status |
|---|---|---|---|
| Watch the demo video (`video/out/heard-chef-demo.mp4`, 3:17) and upload it to lablab (MP4, 26 MB) | Thomas | High | Backlog |
| Fill the deck's [Team name] on the cover, then export it as PDF from the deck's Share menu ([slides.md](slides.md)) | Thomas | High | Backlog |
| Hosting note: the key is visible in the built bundle, so use a separate, limited key and rotate it after judging | Thomas | Medium | Backlog |
| Submit on lablab.ai as **"Heard Chef"** (the form allows letters and spaces only). Copy is ready in [pitch.md](pitch.md): short and long description, tags. | Thomas | High | Backlog |
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
| Real voice run with headphones; Thomas: "this is perfect" | Thomas | High | Done (2026-09-29) |
| Calmer pass, fitted to 90% zoom (1600×878) and 1440×790 with no scroll | Claude Code | High | Done (2026-09-29) |
| Menus: 4 built-in plus saved menus; customise tonight's dishes | Claude Code | High | Done (2026-09-29) |
| Recipe studio: type or dictate a recipe; the AI scribe formats it and suggests; saved in the browser | Claude Code | High | Done (2026-09-29) |
| Mid-cook "add the dal" / "drop the naan" voice tools | Claude Code | Medium | Done (2026-09-29) |
| Tests: 309 unit, 16 live, 17 browser flows, plus live studio and dictation flows | Claude Code | High | Done (2026-09-29) |
| Fully live, automated demo video (3:17, 1080p): narrator and cook voiced with AssemblyAI voices, Chef live | Claude Code | High | Done (2026-09-30) |
| Pitch deck (13 slides + notes, claude.ai artifact) and cover image (`docs/cover.png`) | Claude Code | High | Done (2026-09-30) |
| Pushed to https://github.com/thomasKissflow/assemblyAI_hackathon (no keys in history); make sure the repo is public | Claude Code + Thomas | High | Done (2026-09-30) |
| Deployed to Vercel: https://heard-chef-alpha.vercel.app (checked: loads, key present, voice session connects) | Thomas + Claude Code | High | Done (2026-09-30) |
| Fixes found while recording: "Hey Chef" mid-answer now cuts Chef off; fused "heychef" wake; shorter re-plan replies; studio suggestions | Claude Code | High | Done (2026-09-30) |

## Notes on Priority

- **Sep 30:** deploy, push the public repo, fill the deck placeholders, submit (before 8:30 PM IST).

The app is feature-complete for the demo. Resist adding features; spend the time on the video.
