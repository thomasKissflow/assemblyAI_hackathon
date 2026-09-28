# Demo video script (about 2:30)

**Setup before recording**
- Headphones on, so Chef can't hear itself through the speakers.
- Chrome window at **1440×900**, and `npm run dev` running.
- Speak naturally, not slowly. Pause for about a second after each line so Chef can answer.
- Speed stays at **30×** (1 kitchen minute = 2 seconds). Press **N** to jump to the next call if a moment drags.
- Do a full dry run first. Then record in one take if you can; the re-plan moment is the one that must land on camera.

---

**0:00 to 0:10: cold open (title card or face to camera)**
> "Three dishes. One cook. Dinner at eight. And my hands are covered in dough."

**0:10 to 0:25: start screen**
- Point the mouse at the hero line and let the teaser flip from 8:00 to 8:10 on screen.
- Pick **Indian dinner**, then **Serve in 45 min**. The preview shows tonight's first calls.
- Click **Continue with voice**.

**0:25 to 0:35: sound check**
> "Hey Chef."
- The ring turns green: **Heard you.** Click **Start cooking**.

**0:35 to 0:50: Chef speaks first**
- Chef greets you: *"Evening. Chicken curry, jeera rice and garlic naan, serving at 8:00 PM. First up, the garlic naan at 7:22 PM."*
- A few seconds later, with no prompt: the bell, the naan ticket goes to **FIRE**, NEXT UP turns flame orange, and Chef says *"Naan. Mix and knead the dough."*
- Voice-over or on-screen text: *"I never set a timer. Chef calls every step."*

**0:50 to 1:05: a question mid-cook**
> "Hey Chef, how long until the rice goes on?"
- Chef answers from the live plan. Point at the captions.

**1:05 to 1:30: THE moment (the re-plan)**
- Press **N** until the curry has started (its ticket shows FIRE), then say:
> "Hey Chef, the curry needs ten more minutes."
- Serving flips **8:00 → 8:10** with the **+10 min** chip, every ticket flashes its moved steps, and the rail slides.
- Chef: *"Heard. Serving at eight ten now."*
- Voice-over: *"One sentence, and the whole dinner re-plans."*

**1:30 to 1:45: interrupt Chef like a person**
- While Chef is mid-call, say:
> "Hey Chef — wait. Guests are running fifteen minutes late."
- Chef stops at once, then the serve time flips again.

**1:45 to 2:00: cooking question, then off-topic**
> "Hey Chef, can I use butter instead of ghee?"
- A practical answer.
> "Hey Chef, who won the cricket last night?"
- *"Not my station. Let's get back to dinner."*

**2:00 to 2:15: glance and service**
- Press **G**: glance mode, the giant next call, readable from across the kitchen. Press **Esc**.
- Press **N** a few times to skip to the end: *"Service. Everything's ready. Plate up."* The service report appears (served at, re-plans, questions answered, hands washed to touch a screen: 0).

**2:15 to 2:30: how it's built (one slide)**
- Mic → **AssemblyAI Universal-Streaming** (always-on ears, "Hey Chef" by word timestamps) → **AssemblyAI Voice Agent API** (speech, reasoning, voice, tool calls) → in-browser planner → the kitchen pass.
- *"No backend. The planner does the maths, Chef does the talking."*
- End card: **Heard, Chef: the dinner timer you can talk back to.**

---

**If something misbehaves while recording**
- **Chef doesn't wake:** say "Hey Chef" a little louder, or hold **Space** and just talk.
- **Chef talks over you:** you're probably not on headphones.
- **A moment is taking too long:** press **N**. The kitchen clock jumps to the next call.
- **The connection drops:** click **Reconnect** in the banner. The kitchen keeps running.
