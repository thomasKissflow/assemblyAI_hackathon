# Demo video script (about 3:00)

**Setup before recording**
- Headphones on, so Chef can't hear itself through the speakers.
- Chrome, maximized, at **90% zoom** (press Cmd and minus once from 100%). The layout is designed for exactly this size, 1600×878 in the browser, so nothing scrolls. `npm run dev` running.
- **Clean recipe book before the final take.** If you rehearsed the recipe studio, delete the rehearsal recipe: **Add a dish**, find it under **Your recipes**, then the trash icon. Otherwise the take saves a second copy.
- Speak naturally, not slowly. Pause for about a second after each line so Chef can answer.
- Speed stays at **30×** (1 kitchen minute = 2 seconds). Press **N** to jump to the next call if a moment drags.
- Do a full dry run first. Then record in one take if you can; the re-plan moment is the one that must land on camera.

---

**0:00 to 0:10: cold open (title card or face to camera)**
> "Three dishes. One cook. Dinner at eight. And my hands are covered in dough."

**0:10 to 0:20: start screen**
- Point the mouse at the hero line and let the teaser flip from 8:00 to 8:10 on screen.
- Sweep over the four menus, then pick **Indian dinner**, then **Serve in 45 min**. The preview shows tonight's first calls.

**0:20 to 0:50: your own recipe, said out loud**
- Click **New recipe**, then **Talk it through**, and say:
> "My mom's dal. Rinse a cup of toor dal and pressure cook it with turmeric for three whistles. Then fry cumin, garlic and chillies in ghee and pour it over."
- Your words type themselves into the box. About a second after you stop, the recipe card fills in: timed steps, what Chef will call, the ingredients.
- Chef suggests something, like *"Soak the dal for 20 minutes first."* Click **Apply**, and the step slots into the card.
- Voice-over: *"Any family recipe, said out loud, timed by Chef."*
- Click **Save & add to tonight**. The dal joins tonight's dishes, and the first calls update.
- The scribe's suggestions vary from run to run. If none has an **Apply** button, press **Format with Chef** again, or just skip that beat.
- Click **Continue with voice**.

**0:50 to 1:00: sound check**
> "Hey Chef."
- The ring turns green: **Heard you.** Click **Start cooking**.

**1:00 to 1:15: Chef speaks first**
- Chef greets you: *"Evening. Chicken curry, jeera rice, garlic naan and your dal, serving at 8:00 PM. First up…"* (the exact first call depends on your dal's timings).
- A few seconds later, with no prompt: the bell, the naan ticket goes to **FIRE**, NEXT UP turns flame orange, and Chef says *"Naan. Mix and knead the dough."*
- Voice-over or on-screen text: *"I never set a timer. Chef calls every step."*

**1:15 to 1:30: a question mid-cook**
> "Hey Chef, how long until the rice goes on?"
- Chef answers from the live plan. Point at the captions.

**1:30 to 1:55: THE moment (the re-plan)**
- Press **N** until the curry has started (its ticket shows FIRE), then say:
> "Hey Chef, the curry needs ten more minutes."
- Serving flips **8:00 → 8:10** with the **+10 min** chip, every ticket flashes its moved steps, and the rail slides.
- Chef: *"Heard. Serving at eight ten now."*
- Voice-over: *"One sentence, and the whole dinner re-plans."*

**1:55 to 2:10: interrupt Chef like a person**
- While Chef is mid-call, say:
> "Hey Chef — wait. Guests are running fifteen minutes late."
- Chef stops at once, then the serve time flips again.

**2:10 to 2:25: cooking question, then off-topic**
> "Hey Chef, can I use butter instead of ghee?"
- A practical answer.
> "Hey Chef, who won the cricket last night?"
- *"Not my station. Let's get back to dinner."*

**2:25 to 2:40: glance and service**
- Press **G**: glance mode, the giant next call, readable from across the kitchen. Press **Esc**.
- Press **N** a few times to skip to the end: *"Service. Everything's ready. Plate up."* The service report appears (served at, re-plans, questions answered, hands washed to touch a screen: 0).

**Optional, if the take is going well: change the menu mid-cook** (before service)
> "Hey Chef, drop the naan tonight."
- The naan ticket leaves the pass, and Chef confirms in one line.

**2:40 to 3:00: how it's built (one slide)**
- Mic → **AssemblyAI Universal-Streaming** (always-on ears, "Hey Chef" by word timestamps, recipe dictation) → **AssemblyAI Voice Agent API** (speech, reasoning, voice, tool calls; plus a text-only scribe that formats recipes) → in-browser planner → the kitchen pass.
- *"No backend. The planner does the maths, Chef does the talking."*
- End card: **Heard, Chef: the dinner timer you can talk back to.**

---

**If something misbehaves while recording**
- **Chef doesn't wake:** say "Hey Chef" a little louder, or hold **Space** and just talk.
- **Chef talks over you:** you're probably not on headphones.
- **A moment is taking too long:** press **N**. The kitchen clock jumps to the next call.
- **The connection drops:** click **Reconnect** in the banner. The kitchen keeps running.
- **The recipe card comes out odd:** fix it by hand (every field is editable), or clear the box and say it again. Nothing is saved until you click Save.
