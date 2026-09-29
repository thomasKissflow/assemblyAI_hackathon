export interface SttWord {
  start: number;
  end: number;
  text: string;
}
export interface WakeHit {
  at: number;
  question: string;
}

const PREFIXES = new Set(['hey', 'hi', 'okay', 'ok', 'yo', 'oi', 'hello']);
const NAMES = new Set(['chef', 'chefs', "chef's"]);
const SOUNDALIKES = new Set(['shef', 'jeff', 'chevy', 'sheff']);
// Speech-to-text sometimes runs a quick "hey chef" together into one word.
const FUSED = new Set(['heychef', 'heyef', 'heyshef', 'haychef']);
const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');

export function findWake(words: SttWord[]): WakeHit | null {
  for (let i = 0; i < words.length; i++) {
    const w = norm(words[i].text);
    const prefixed = i > 0 && PREFIXES.has(norm(words[i - 1].text));
    if ((NAMES.has(w) || SOUNDALIKES.has(w)) && prefixed) {
      return { at: words[i - 1].start, question: words.slice(i + 1).map(x => x.text).join(' ') };
    }
    if (NAMES.has(w) && i === 0) return { at: words[0].start, question: words.slice(1).map(x => x.text).join(' ') };
    if (FUSED.has(w)) return { at: words[i].start, question: words.slice(i + 1).map(x => x.text).join(' ') };
  }
  return null;
}

// Built from the same word sets as findWake, longest first, so every wake phrase it accepts is stripped whole.
const anyOf = (words: Iterable<string>) => [...words].sort((a, b) => b.length - a.length).join('|');
const LEADING_WAKE = new RegExp(`^\\s*(?:(?:${anyOf(FUSED)})|(?:(?:${anyOf(PREFIXES)})[\\s,]+)?(?:${anyOf([...NAMES, ...SOUNDALIKES])}))\\b[\\s,.!?]*`, 'i');

export const stripWake = (text: string) => text.replace(LEADING_WAKE, '');
