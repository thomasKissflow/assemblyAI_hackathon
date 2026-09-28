export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

export function splitCaption(words: CaptionWord[], elapsedMs: number): { spoken: string; upcoming: string } {
  let spoken = '';
  let upcoming = '';
  for (const w of words) {
    if (w.startMs <= elapsedMs) spoken += w.text;
    else upcoming += w.text;
  }
  return { spoken: spoken.trimEnd(), upcoming: upcoming.trim() };
}
