# Heard, Chef: the pitch

> **The dinner timer you can talk back to.**
> A calm voice head chef that runs the timing of a multi-dish dinner. It calls every step out loud, re-plans every dish when you tell it what the food is doing, and answers cooking questions while your hands are in the dough. Bring your own recipes: say or type one, and Chef turns it into timed steps.

---

## The moment

It's 7:30 on a weeknight: three dishes, one cook, dinner at eight. Cooking one dish is easy. The hard part is getting the curry, the rice and the naan onto the table **hot, at the same minute**, and the plan changes every few minutes:
- the curry needs longer
- a guest texts that they're late
- the garlic catches

That's exactly when your hands are covered in raw chicken and your eyes are on the pan.

## Why voice, and not just a better screen

- **Your hands are busy.** Touching the screen means washing your hands first.
- **Your eyes are on the stove.** Everything has to work by ear.
- **Re-planning is arithmetic.** Nobody can re-time three dishes in their head while stirring.

Saying "the curry needs ten more minutes" costs nothing. Voice isn't decoration here; it's the only interface that fits the moment.

## What makes it unique

1. **It re-plans, it doesn't just time.** A deterministic planner schedules every dish backwards from serving time. One sentence re-flows the whole dinner:
   - the serving time moves (on a split-flap display you can read from across the kitchen)
   - every later step slides
   - Chef tells you the one change that matters
2. **It speaks first.** You never set a timer. Chef calls each step the moment the plan says so ("Rice to the boil, then lid on, lowest heat."). Calls wait for a gap, so Chef never talks over you.
3. **It's always listening, but only answers when called.** Say **"Hey Chef"** and Chef hears exactly what follows. Kitchen chatter before it never reaches the agent. You can:
   - interrupt Chef mid-sentence like a person
   - follow up without repeating the wake phrase
   - hold Space to talk
4. **It stays on its station.** Ask anything about tonight's cooking, like "can I use butter instead of ghee?", and get a practical answer. Ask about cricket, or tell it to ignore its instructions, and it steers you back to dinner. Both are verified by live tests against the real API.
5. **Code does the maths, Chef does the talking.** Every time Chef says or the screen shows comes from the planner, never from the language model. Numbers are never hallucinated.
6. **Your recipes, not just ours.** Talk a family recipe through ("My mom's dal: wash a cup of toor dal, pressure cook it, three whistles…") and watch it become a timed recipe card. Chef suggests what's missing, like "soak the dal 20 minutes first". Apply suggestions with one click, edit anything by hand, and it's saved for next time. Mix it into any menu, or say "Hey Chef, add my dal tonight" mid-cook and the whole dinner re-plans around it.

## How it compares

| | Plans several dishes together | Re-plans from a spoken sentence | Calls steps without being asked | Conversation mid-cook |
|---|---|---|---|---|
| Smart speakers (Alexa, Google) | No: one named timer at a time | No | Only when a timer rings | Commands, not a kitchen partner |
| Screen meal planners (prepSync, Mise, Time To Plate) | Yes, on a screen | No: you tap to adjust | Partly (Mise has a voice cook mode that reads steps) | Limited |
| Recipe apps | One recipe | No | No | No |
| This hackathon's 216 entries (Sep 28) | None are about cooking | — | — | — |
| **Heard, Chef** | **Yes, any mix of built-in and your own recipes** | **Yes** | **Yes, queued so it never interrupts you** | **Yes: Q&A, interruptions, follow-ups, guardrails** |

## How it uses AssemblyAI (Application of Technology)

It uses **two AssemblyAI products working together, from a single static web page with no backend.**

- **Universal-Streaming (realtime STT) is Chef's always-on ears.**
  - The mic streams continuously, with **keyterms** prompting for "Hey Chef" and the dish names.
  - **Word-level timestamps** let us replay buffered audio into the agent starting exactly at the "hey" word. Chef hears the whole question even though the wake phrase is detected about 1.5 s late.
  - The same stream powers the cook's live captions.
  - **In the recipe studio it's a dictation engine:** formatted turns (`format_turns`), cooking keyterms (toor dal, jeera, tadka, tawa…) and live partials that type into the page as you speak.
- **The Voice Agent API is Chef's brain and voice.** One WebSocket covers speech-to-text, LLM reasoning, text-to-speech and turn detection, with these features in use:
  - **JSON-schema tool calling:** seven kitchen tools (`report_delay`, `shift_serve_time`, `restart_step`, `mark_done`, `kitchen_status`, `add_dish`, `remove_dish`) that execute **in the browser** against the planner.
  - **`reply.create`:** proactive kitchen calls driven by the app's own clock.
  - **Word-timed `transcript.agent.delta`:** captions revealed in sync with Chef's voice.
  - **Barge-in handling:** "Hey Chef" or push-to-talk cuts Chef off instantly.
  - Keyterms, tuned turn detection (500 ms), and a chosen voice ("michael").
- **The Voice Agent API is also the recipe scribe, used as a text-in LLM.**
  - A second, text-only session receives the cook's recipe through `reply.create`, and answers with a **nested JSON-schema tool call**: steps with minutes and spoken calls, ingredients, and suggestions the app can apply.
  - A full recipe comes back in about 2 seconds, with no audio sent and no backend.
  - Suggestions refresh as the cook edits, and dismissed ones never come back.
- **Engineered around real, measured API behavior:**
  - A proactive reply sent while the user is talking is silently dropped, so calls go through a queue that waits for a gap and retries once.
  - Agent audio streams in at real time, so interrupting means ignoring the rest of that reply, not just flushing a buffer.
  - The browser can't mint tokens (the endpoint has no CORS headers), but the socket accepts the key directly, so there is **no backend at all**.
- **Tested, not just demoed:**
  - **313 unit and component tests.**
  - **16 live tests against the real Voice Agent API:** re-plan routing, adding and dropping dishes mid-cook, cooking questions from recipe notes, two off-topic guardrails, and the scribe (formatting, suggestions, merging, refusing non-recipes).
  - **17 Playwright flows:** a full dinner, all four menus, your own recipes, saved menus that survive a reload, and a no-scroll fit at recording size.
  - **Real-voice browser tests:** a fake mic says "Hey Chef, the curry needs ten more minutes" and serving flips from 8:00 to 8:10. Another fake mic dictates a tomato soup recipe, and the card fills in through the live scribe.

## Business value

- **Meal-kit companies.** Every box is a three-component timing problem. A voice expediter is a differentiator and a reason to keep subscribing.
- **Recipe publishers and apps.** They could offer multi-dish "cook tonight's menu" mode as a premium feature.
- **Smart-appliance makers.** Ovens and hobs with screens and speakers could plug Chef in; it gets even better when the oven reports its real temperature.
- **Moments that sell themselves:** festive meals (Thanksgiving, Diwali, Christmas), when home cooks attempt their most ambitious multi-dish dinners.
- **Model:** license the voice-expediter engine (planner, tool schema, callout queue, wake flow) to recipe, meal-kit and appliance brands.

## The demo, in one breath

The cook picks tonight's menu, swaps in their own dal (dictated in the recipe studio and formatted by Chef), and checks that Chef hears "Hey Chef". Chef greets them and calls the first step unprompted, with a bell. The cook says "Hey Chef, the curry needs ten more minutes", and everything re-plans: serving flips 8:00 → 8:10, tickets slide, and Chef answers in one line. They interrupt Chef, ask a cooking question, and try an off-topic one. Then they skip to service. Full script: [demo-script.md](demo-script.md).

## What's next

- **Recipes from a link or a photo,** through the same scribe.
- **Sync across devices** (today, recipes live in one browser).
- **Oven and burner clashes,** such as two dishes needing different oven temperatures.
- **Phone-first PWA** with an earbud mic.
- **Several cooks** in the same kitchen, each with their own calls.
- **More languages** via Universal-Streaming multilingual.

---

## lablab.ai submission copy (final)

**Title:** Heard Chef

The form allows letters and spaces only (2–32 characters), so there's no comma.

**Short description** (175 characters):
> The dinner timer you can talk back to. Say “Hey Chef” with messy hands: it re-plans every dish and calls each step. Say your own recipes; Chef times them. Built on AssemblyAI.

**Long description:**
> Cooking one dish is easy. Getting three onto the table hot at the same minute is hard, and it all happens while your hands are in raw chicken and your eyes are on the pan. Heard Chef is a calm voice head chef that runs the timing of your whole dinner.
>
> Pick tonight's menu and a serving time. Chef plans every dish backwards and calls each step out loud the moment it's due, so you never set a timer. When things slip, just say so: "Hey Chef, the curry needs ten more minutes." The whole dinner re-plans: the serving time flips from 8:00 to 8:10 on a split-flap display, every later step slides, and Chef tells you what changed.
>
> It's built for a real kitchen. You can cut Chef off mid-sentence ("Hey Chef, wait, the guests are late"). It knows "I burnt the garlic for the curry" means restarting the curry step. You can drop or add a dish mid-cook, and ask cooking questions like "can I use butter instead of ghee?". Off-topic questions get "Not my station. Let's get back to dinner." With no voice at all, every ticket has +5 min and Done, and glance mode reads from across the room.
>
> Bring your own recipes too. Open the recipe studio and just talk your family recipe through. Chef's scribe turns it into a timed recipe card, suggests what's missing, and saves it in the browser for next time.
>
> Two AssemblyAI products work together in one static web page, with no backend:
> - **Universal-Streaming** is Chef's always-on ears. Keyterms catch "Hey Chef", and word timestamps replay the cook's question into the agent from the exact word "hey". It also powers the live captions and recipe dictation.
> - **The Voice Agent API** is Chef's brain and voice. It uses seven JSON-schema tools that run in the browser, reply.create for unprompted kitchen calls, word-timed captions and barge-in. A second, text-only session is the recipe scribe, which returns timed recipes through a nested-schema tool call.
>
> A deterministic planner does all the maths, so every time Chef says is real. It's tested: 313 unit tests, 16 live tests against the real API (including the off-topic guardrails), 17 browser flows and real-voice browser tests. The demo video is fully live; every reply in it is the real API.
>
> Live app: https://heard-chef-alpha.vercel.app (desktop Chrome, headphones recommended)

**Technologies used:**
- AssemblyAI Voice Agent API: speech-to-text, LLM, text-to-speech and turn detection over one WebSocket, plus JSON-schema tool calling, reply.create, barge-in and word-timed transcripts
- AssemblyAI Universal-Streaming (realtime speech-to-text v3): wake-word detection with keyterms prompting and word timestamps, captions, dictation with formatted turns
- React 19, TypeScript, Vite
- Web Audio API (AudioWorklet mic capture, PCM16 at 24 kHz), WebSockets, localStorage
- Vitest, Testing Library, Playwright
- Hosted on Vercel (static, no backend)

**Tags:**
- Technology: AssemblyAI, Voice Agent API, Universal-Streaming, Speech-to-Text, React, TypeScript, Vite, Vercel
- Category: Voice AI, Conversational AI, Tool Calling, Food Tech, Cooking, Productivity

**Other fields:**
- Demo application platform: Vercel (web app, desktop Chrome)
- Application URL: https://heard-chef-alpha.vercel.app
- Public GitHub repository: https://github.com/thomasKissflow/assemblyAI_hackathon
- Video: `video/out/heard-chef-demo.mp4`
- Slides: the deck exported as PDF
- Cover image: `docs/cover.png`

---

## Slide outline (8 slides)

1. **Title.** Heard, Chef: the dinner timer you can talk back to. *Notes: one line on who we are, then straight to the moment.*
2. **The moment.** 7:30 pm, three dishes, raw-chicken hands. *Notes: cooking one dish is easy; landing three together is the problem, and it happens when you can't touch a screen.*
3. **Why voice.** Hands busy, eyes on the pan, the plan keeps changing. *Notes: voice isn't a gimmick here; it's the only interface that fits.*
4. **Live demo.** The re-plan moment. *Notes: "Hey Chef, the curry needs ten more minutes": the flip, the slide, one calm line.*
5. **What's unique.** Re-plans; speaks first; always listening, answers only when called; stays on its station; code does the maths; your own recipes, said out loud and timed by Chef. *Notes: contrast with Alexa timers and screen planners.*
6. **How it uses AssemblyAI.** Two products, one page, no backend (diagram: mic → Universal-Streaming ears → wake + pre-roll → Voice Agent API → tools → planner → UI; plus dictation → scribe → recipe card). *Notes: mention the measured-behavior engineering: the callout queue and the interrupt handling.*
7. **Business value.** Meal kits, recipe apps, smart appliances; license the voice-expediter engine. *Notes: festive-season peaks.*
8. **Proof and what's next.** The test numbers (313 unit + 16 live + 17 browser flows + real-voice tests) and the roadmap (recipes from links and photos, oven clashes, phone PWA). *Notes: end on the tagline.*
