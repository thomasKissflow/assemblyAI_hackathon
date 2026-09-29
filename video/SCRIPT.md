# Heard Chef: the demo video (3:17)

The demo video is automated and fully voiced, and everything in it happens live through the real AssemblyAI APIs:

- **Narrator:** AssemblyAI Voice Agent voice `mary`, rendered with `video/tts.mjs`. The script is sent word for word and checked against the agent's own transcript.
- **Chef:** the app's own live Voice Agent session (`michael`).
- **Cook:** AssemblyAI voice `anna`, pre-rendered and played into the app through a virtual microphone (`video/inpage.js`). Chef really hears it: every "Hey Chef" wake and every re-plan in the video is the real app.

**Recording:**
- One continuous take of the production build (`vite preview`, so no dev-server reloads).
- The screen is captured at 1600×900 CSS pixels with a device scale of 1.2, so the video is 1920×1080. That's the same layout as Chrome at 90% zoom.
- Camera push-ins are CSS transforms on the page, so the text stays sharp.

**Editing (`video/assemble.mjs`):**
- It trims the dead air between a cook's line and Chef's reply, leaving 0.9 s.
- It drops the call barrage when skipping to service, lays the narration over marked quiet moments, and joins the intro, the take and the outro.
- It normalizes loudness to −16 LUFS.

| # | Picture | Sound |
|---|---|---|
| 0 | **Intro card** (`cards/intro.html`) | N1 |
| 1 | The start screen: a sweep of the four menus, then Indian dinner, serve in 45 min | N2 |
| 2 | **Recipe studio.** Talk it through: the cook dictates Mom's dal, the words type in live and the card fills with timed steps. Apply a suggestion, then Save & add to tonight. | N3, C1, N4, N5 |
| 3 | The sound check: "Hey Chef", the ring turns green, and Chef answers "Heard you. Ready when you are." | N6, C2 |
| 4 | Chef greets, and the first call fires by itself (the camera pushes in on the NOW card) | N7 |
| 5 | **The re-plan:** the curry starts, then "the curry needs ten more minutes" (camera on the clock and tickets). Serving goes to 8:10. | C4, N8 |
| 6 | **Edge case: interrupting Chef.** The cook asks for a status, then cuts in mid-answer about late guests. Chef stops, and serving goes to 8:25. | C5a, C5, N9 |
| 7 | **Edge case: redo a step.** "I burnt the garlic for the curry." | C6 |
| 8 | **Edge case: off-topic.** Cricket gets "Not my station." | C7 |
| 9 | **Change the menu mid-cook:** "drop the naan tonight" | C8 |
| 10 | **Without voice:** +5 min on a ticket, then glance mode | N11 |
| 11 | Skip to service: "Service. Everything's ready. Plate up." | N12 |
| 12 | **Outro card** (`cards/outro.html`) | N13 |

The spoken lines are in `video/lines.mjs`.

## Re-making it

```bash
npx vite build && npx vite preview --port 4173 --strictPort   # keep running
AAI_KEY=… node video/render-voices.mjs                           # narration + cook lines → video/out/voice
node video/record-cards.mjs                                       # needs the dev server on :5173
node video/run.mjs video/out/take                                 # one live take (about 5 minutes)
AAI_KEY=… node video/transcribe.mjs video/out/take/audio.wav video/out/take/transcript.json   # after: ffmpeg -i audio.webm -ac 1 -ar 16000 audio.wav
node video/assemble.mjs video/out/take video/out/final.mp4 --intro=6.8 --gap=0.9 --drop=N10
```

The final cut used take 18.
