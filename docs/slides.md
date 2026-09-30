# Pitch deck: slide content and speaker notes

The designed deck is a private claude.ai artifact: https://claude.ai/artifact/S8dpH3ZpDBguj2eg431Hpr. It exports to PPTX or PDF from its Share menu. This file is the same content as plain text, for editing elsewhere.

Before exporting, fill in `[Team name]` on the cover. The app and repo links are already on the closing slide.

## 1. Cover

- AssemblyAI Voice Agent Hackathon · [Team name]

- *Image: Heard, Chef: three order tickets on the pass, a split-flap clock showing serving at 8:00 PM, and the tagline The dinner timer you can talk back to*

**Notes:** Hi, we're [Team name]. This is Heard Chef, the dinner timer you can talk back to. It's a voice head chef that runs the timing of a whole multi-dish dinner, and you talk to it with your hands in the dough.

## 2. The moment

- 7:30 pm. Three dishes. One cook. Dinner at eight.
- Cooking one dish is easy. Landing three hot at the same minute is hard, and the plan changes while your hands are in raw chicken.
- The curry needs longer
- A guest is running late
- The garlic catches

**Notes:** Picture a weeknight. Chicken curry, jeera rice and garlic naan, dinner at eight. Each dish on its own is easy. The hard part is getting all three onto the table hot at the same minute, and the plan keeps changing: the curry needs longer, a guest texts that they're late, the garlic catches. And that's exactly when your hands are covered in raw chicken and your eyes are on the pan.

## 3. Why voice, and not a better screen

- Hands are busy
- Touching a screen means washing your hands first.
- Eyes are on the stove
- Everything has to work by ear, from across the kitchen.
- Re-planning is maths
- Nobody re-times three dishes in their head while stirring.
- Saying “the curry needs ten more minutes” costs nothing. Voice isn't decoration here; it's the only interface that fits the moment.

**Notes:** Why voice? Three reasons. Your hands are busy, so touching a screen means washing up first. Your eyes are on the stove, so everything has to work by ear. And re-planning is arithmetic: nobody can re-time three dishes in their head while stirring. Saying one sentence costs nothing.

## 4. Meet Heard Chef

- Calls every step out loud, right when it's due
- “Hey Chef” re-plans every dish from one sentence
- Answers cooking questions, and stays on its station
- *Image: The kitchen pass: four dish tickets with countdowns, the serving clock at 8:10 PM after a re-plan, the NOW card and Chef's captions*

**Notes:** Heard Chef is a calm voice head chef. A deterministic planner schedules every dish backwards from serving time, and Chef calls each step out loud the moment it's due, so you never set a timer. When something slips you just say so, "Hey Chef, the curry needs ten more minutes", and the whole dinner re-plans: the split-flap serving clock flips, every later step slides, and Chef tells you the one change that matters. You can also ask cooking questions mid-cook.

## 5. Built for a real kitchen: the edge cases

- Re-plan
- “The curry needs ten more minutes.”
- Serving flips 8:00 → 8:10 and every dish slides.
- Interrupt mid-sentence
- “Hey Chef, wait. Guests are late.”
- Chef stops at once, then moves dinner to 8:25.
- Redo a step
- “I burnt the garlic for the curry.”
- Knows it's the curry and restarts that step.
- Off-topic
- “Who won the cricket last night?”
- “Not my station. Let's get back to dinner.”
- Change the menu mid-cook
- “Drop the naan tonight.”
- The dish leaves the pass and the plan re-flows.
- No voice at all
- +5 min and Done on every ticket
- Plus pause, skip and glance mode for across the room.
- Every case is in the demo video, live against the real API

**Notes:** Kitchens are messy, so we designed for the edge cases, and every one of these is in the demo video, live. You can re-plan with one sentence. You can cut Chef off mid-sentence like a person: "Hey Chef, wait". Chef infers the dish from an ingredient, so "I burnt the garlic for the curry" restarts the curry step. Off-topic questions get steered back to dinner. You can drop or add a dish mid-cook. And with no voice at all, every ticket has +5 min and Done, plus glance mode.

## 6. Your own recipes, said out loud

- Talk it through. Streaming speech-to-text types as you speak.
- Chef's scribe formats it. Timed steps, callouts and ingredients in about two seconds.
- Suggestions you apply in one click. A missing step, a time, an ingredient.
- Saved for next time. Mix it into any menu, or say “Hey Chef, add my dal” mid-cook.
- Recipes and menus stay in the browser: no account, no database
- *Image: The recipe studio: a dictated dal recipe on the left, and on the right the recipe card Chef formatted with three timed steps and ingredients*

**Notes:** Chef isn't limited to our menus. Open the recipe studio and just talk your family recipe through. Universal-Streaming types it as you speak. Chef's scribe, running on the Voice Agent API, turns it into timed steps, the lines Chef will call out, and the ingredients, in about two seconds. It suggests what's missing, and you apply a suggestion with one click. Everything stays editable by hand, and it's saved in the browser for next time.

## 7. Two AssemblyAI products. One static page. No backend.

- The ears
- Universal-Streaming
- Always-on “Hey Chef” with keyterms
- Word timestamps replay the question from “hey”
- Live captions and recipe dictation
- The brain and voice
- Voice Agent API
- 7 JSON-schema tools run in the browser
- reply.create for unprompted calls
- Word-timed captions and barge-in
- A text-in scribe that formats recipes
- In the browser
- Planner and the pass
- Deterministic maths: every time is real
- Tickets, rail, split-flap clocks
- Recipes saved in localStorage
- The socket accepts the API key directly, so there is no token server

**Notes:** Under the hood, two AssemblyAI products work together from a single static page. Universal-Streaming is Chef's always-on ears: keyterms catch "Hey Chef", and word-level timestamps let us replay the cook's question into the agent from the exact word "hey", even though the wake phrase is detected about a second and a half late. The Voice Agent API is the brain and the voice: seven JSON-schema tool calls run in the browser against the planner, reply.create drives unprompted kitchen calls, and word-timed transcripts drive captions. A second, text-only session is the recipe scribe. The planner does all the maths, so Chef never makes up a time.

## 8. Engineered around measured API behaviour

- What we measured
- What we built
- A proactive reply sent while the cook is talking is silently dropped
- A callout queue that waits for a gap and retries once
- The wake phrase is heard about 1.5 s after it's said
- Word timestamps replay the question into the agent from “hey”
- The agent only notices a barge-in once its reply ends (about 5 s)
- A fresh “Hey Chef” silences Chef locally, at once
- The browser can't mint session tokens (no CORS)
- The WebSocket takes the key directly: no backend
- No LLM Gateway access on our key
- The Voice Agent API as a text-in scribe: about 2 s per recipe
- Probes and numbers: docs/research.md §8 in the repo

**Notes:** This is the part we're proudest of technically. We probed the real API and built around what we measured. A proactive reply sent while the user is talking is silently dropped, so calls go through a queue that waits for a gap. The wake phrase is detected about a second and a half late, so word timestamps replay the question from "hey". The agent's own barge-in only notices speech after its reply finishes, so "Hey Chef" silences Chef locally, at once. Browsers can't mint tokens, but the socket takes the key directly, so there's no backend. And with no LLM Gateway access, we used the Voice Agent API itself as a text-in scribe.

## 9. How it compares

- Plans several dishes together
- Re-plans from a spoken sentence
- Calls steps unprompted
- Talks with you mid-cook
- Smart speakers
- No: one named timer at a time
- No
- Only when a timer rings
- Commands, not a partner
- Screen meal planners
- Yes, on a screen
- No: you tap to adjust
- Partly
- Limited
- Recipe apps
- One recipe
- No
- No
- No
- Yes, including your own recipes
- Yes
- Yes, never over you
- Yes: questions, interruptions, guardrails
- Of 216 hackathon entries we scanned on Sep 28, none were about cooking

**Notes:** How does it compare? Smart speakers run one named timer at a time and wait for commands. Screen meal planners can plan several dishes, but you tap to adjust. Recipe apps handle one recipe. Heard Chef plans the whole dinner, including your own recipes, re-plans from a spoken sentence, calls every step without being asked, and actually talks with you: questions, interruptions and guardrails.

## 10. Who it's for, and who pays

- Meal-kit companies
- Every box is a three-dish timing problem. A voice expediter is a reason to keep subscribing.
- Recipe publishers and apps
- A premium “cook tonight's menu” mode on top of the recipes they already have.
- Smart-appliance makers
- Ovens and hobs with speakers plug Chef in. Real oven temperatures make it sharper.
- Model: license the voice-expediter engine (planner, tool schema, callout queue, wake flow). Festive dinners like Diwali, Thanksgiving and Christmas sell it on their own.

**Notes:** Who pays? Meal-kit companies: every box is a three-component timing problem, and a voice expediter is a reason to keep subscribing. Recipe publishers and apps could offer a premium "cook tonight's menu" mode. And smart-appliance makers could plug Chef into ovens and hobs that already have speakers. The model is licensing the engine: the planner, the tool schema, the callout queue and the wake flow. And festive meals, like Diwali, Thanksgiving and Christmas, are the moments when home cooks attempt their most ambitious dinners.

## 11. Tested, not just demoed

- 313
- unit and component tests
- live tests against the real AssemblyAI API
- browser flows, from a full dinner to your own recipes
- scripted replies in the demo: every answer is live
- Real-voice browser tests too: a fake mic says “Hey Chef, the curry needs ten more minutes” and serving flips to 8:10; another dictates a recipe and the card fills in.
- The guardrail cases (cricket, “ignore your instructions”) are live tests, not just prompts

**Notes:** It's tested, not just demoed: over three hundred unit and component tests, sixteen live tests against the real AssemblyAI API, including the off-topic guardrails and the recipe scribe, and seventeen browser flows. There are real-voice browser tests where a fake microphone says "Hey Chef, the curry needs ten more minutes" and the serving time flips. And the demo video is fully live: every one of Chef's replies came from the real API.

## 12. What's next

- Recipes from a link or a photo, through the same scribe
- Oven and hob clashes (two temperatures, one oven)
- A phone-first app with an earbud mic
- More languages with Universal-Streaming multilingual
- Several cooks in one kitchen, each with their own calls
- *Image: Glance mode: the next call shown full screen in large type, readable from across the kitchen*

**Notes:** What's next: recipes from a link or a photo through the same scribe, oven and hob clashes when two dishes need different temperatures, a phone-first app with an earbud mic, more languages with Universal-Streaming multilingual, and several cooks in the same kitchen.

## 13. Service. Everything's ready.

- Heard, Chef.
- The dinner timer you can talk back to.
- Try it: heard-chef-alpha.vercel.app
- Code: github.com/thomasKissflow/assemblyAI_hackathon
- Built on AssemblyAI Universal-Streaming and the Voice Agent API
- *Image: The service report: served at 8:25 PM, with the number of re-plans, calls made and questions answered*

**Notes:** That's Heard Chef: the dinner timer you can talk back to. Try it at the app link, and the code is on GitHub. It's built entirely on AssemblyAI, Universal-Streaming for the ears and the Voice Agent API for the brain, the voice and the scribe, with no backend. Thank you.
