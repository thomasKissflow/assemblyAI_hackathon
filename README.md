# Heard, Chef

**The dinner timer you can talk back to.** A calm voice head chef that runs the timing of a multi-dish dinner:
- it calls every step out loud, right when it's due
- say **"Hey Chef"** mid-cook and it answers, or re-plans every dish when something slips

Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon).

![Heard, Chef mid re-plan: serving moved to 8:10, every dish re-flowed](docs/screenshot.png)

## Why

Cooking one dish is easy. Landing three dishes hot at the same minute is hard, and it happens when your hands are in raw chicken and your eyes are on the pan. You can't touch a screen then, and you can't re-time three dishes in your head while stirring. So you just say it: *"Hey Chef, the curry needs ten more minutes."* The whole dinner re-plans, and Chef tells you what changed.

More in [docs/pitch.md](docs/pitch.md) (what's unique, how it compares, business value) and [docs/demo-script.md](docs/demo-script.md).

## How it uses AssemblyAI

Two AssemblyAI products work together from one static page. **There is no backend.**

| | Role | Features used |
|---|---|---|
| **Universal-Streaming** (realtime STT, v3) | Chef's always-on ears | Detects "Hey Chef" with keyterms prompting. Word-level timestamps drive an exact pre-roll replay starting at the "hey" word. Also powers the cook's live captions. |
| **Voice Agent API** | Chef's brain and voice | Speech-to-text, LLM, TTS and turn detection over one WebSocket. JSON-schema tool calls run in the browser. `reply.create` sends proactive kitchen calls. Word-timed `transcript.agent.delta` drives captions synced to the voice. Barge-in, keyterms, and the "michael" voice. |

A deterministic planner in the browser does all the timing maths. Chef changes the plan only through five tools (`report_delay`, `shift_serve_time`, `restart_step`, `mark_done`, `kitchen_status`) and reads back the planner's summary, so the times you hear are never made up.

## Quick start

```bash
npm install
cp .env.example .env.local   # then put your AssemblyAI key in it
npm run dev                  # open http://localhost:5173
```

- Use **Chrome** and **headphones**, so Chef can't hear itself through your speakers.
- Pick a menu, pass the "Hey Chef" sound check, and start cooking.
- **No key or mic?** Choose **Cook without voice** on the start screen. The whole kitchen runs from the keyboard.
- Demo speed is 30×, so 1 kitchen minute is 2 seconds. Switch to 1× in the top bar for a real dinner.

| Key | Action |
|---|---|
| hold `Space` | Talk to Chef without saying the wake phrase |
| `N` | Jump to the next call (at the end, jumps to service) |
| `P` | Pause or resume the kitchen clock |
| `S` | Cycle speed: 1× · 10× · 30× |
| `G` / `Esc` | Glance mode: giant next call for across the kitchen |
| `M` | Mute the mic |

## Tests

```bash
npm test                                                               # 84 unit + component tests
AAI_KEY=$(grep VITE_ASSEMBLYAI_API_KEY .env.local | cut -d= -f2) npm run test:e2e   # 7 live tests: routing, cooking Q&A, guardrails
npm run test:ui                                                        # Playwright: a full dinner at 3 screen sizes
npm run test:voice                                                     # real voice: a fake mic says "Hey Chef, the curry needs ten more minutes"
```

The live and voice tests call the real AssemblyAI API and use macOS `say` to synthesize speech.

## Architecture

```
Browser (Vite + React + TypeScript, static)
├─ kitchen/  recipes · planner (pure, tested) · virtual clock · store
├─ voice/    mic → AudioWorklet → PCM16 24 kHz ─┬─► Universal-Streaming: wake phrase, captions
│                                               └─► Voice Agent API (only after "Hey Chef"; silence otherwise)
│            tool.call → planner → UI updates at once → tool.result → Chef reads the summary
│            clock tick → step due → bell + on-screen call + callout queue → reply.create
└─ ui/       split-flap clocks · dish tickets · the rail · NEXT UP · captions · Heard log · voice bar
```

Full design: [docs/superpowers/specs/2026-09-28-heard-chef-design.md](docs/superpowers/specs/2026-09-28-heard-chef-design.md). The measured API behavior it's built around is in [docs/research.md §8](docs/research.md).

**About the key.** The browser can't mint AssemblyAI session tokens because that endpoint has no CORS support, but the WebSocket accepts the API key directly. That's what makes a backend unnecessary.
- The key comes from `.env.local`, which is gitignored and never committed. Vite inlines it at build time, so **a deployed build exposes it**. Use a limited key and rotate it.
- If AssemblyAI stops accepting raw keys, the fallback is a same-origin rewrite to `/v1/token`: hosting config only, no code.

**Privacy.** While a session is live, mic audio streams to AssemblyAI so the wake phrase can be detected. Chef's agent only hears what follows "Hey Chef". The app stores nothing; it all lives in the browser tab.

## Project docs

This repo was built docs-first. See [docs/team-handoff.md](docs/team-handoff.md) for the latest status, and [docs/decisions.md](docs/decisions.md) for why things are the way they are.

## Credits

- Dish photos from [Unsplash](https://unsplash.com/license):
  - chicken curry by [Sushmita Chatterjee](https://unsplash.com/@sheclicks)
  - jeera rice by [Zoshua Colah](https://unsplash.com/@zoshuacolah)
  - garlic naan by [Rashpal Singh](https://unsplash.com/@rashpalsingh)
  - roast potatoes by [Markus Winkler](https://unsplash.com/@markuswinkler)
  - salmon by [Karyna Panchenko](https://unsplash.com/@karyna_panchenko)
  - green beans by [Bob Bowie](https://unsplash.com/@connave)
- Icons: [Lucide](https://lucide.dev) (ISC).
- Font: [Archivo](https://fonts.google.com/specimen/Archivo) (OFL).
- Speech, reasoning and voice: [AssemblyAI](https://www.assemblyai.com).

MIT licensed. See [LICENSE](LICENSE).
