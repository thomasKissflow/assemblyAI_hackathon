import type { CaptionWord } from './captions';

export interface CaptionSnapshot {
  chefWords: CaptionWord[];
  chefStart: number | null;
  chefLive: boolean;
  you: string;
  youLive: boolean;
}

export class CaptionFeed {
  private snap: CaptionSnapshot = { chefWords: [], chefStart: null, chefLive: false, you: '', youLive: false };
  private readonly subs = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  };

  getSnapshot = () => this.snap;

  private set(patch: Partial<CaptionSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.subs.forEach(fn => fn());
  }

  chefBegin() {
    this.set({ chefWords: [], chefStart: null, chefLive: true });
  }

  chefStartAt(audioTime: number) {
    if (this.snap.chefStart === null) this.set({ chefStart: audioTime });
  }

  chefWord(word: CaptionWord) {
    this.set({ chefWords: [...this.snap.chefWords, word] });
  }

  chefEnd() {
    if (this.snap.chefLive) this.set({ chefLive: false });
  }

  you(text: string, live: boolean) {
    if (text !== this.snap.you || live !== this.snap.youLive) this.set({ you: text, youLive: live });
  }
}
