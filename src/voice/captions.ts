export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

// transcript.agent.delta pieces are whole words, but only some carry a trailing space
// (measured: "serving ", "at ", "8:00", "PM.", "First"), so normalise the spacing here.
export function splitCaption(words: CaptionWord[], elapsedMs: number): { spoken: string; upcoming: string } {
  const spoken: string[] = [];
  const upcoming: string[] = [];
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    (w.startMs <= elapsedMs ? spoken : upcoming).push(text);
  }
  return { spoken: spoken.join(' '), upcoming: upcoming.join(' ') };
}
