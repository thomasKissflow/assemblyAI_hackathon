export class PreRoll {
  private chunks: { at: number; data: string }[] = [];
  private readonly keepMs: number;

  constructor(keepMs: number) {
    this.keepMs = keepMs;
  }

  push(at: number, data: string) {
    this.chunks.push({ at, data });
    while (this.chunks.length && this.chunks[0].at < at - this.keepMs) this.chunks.shift();
  }

  since(at: number): string[] {
    return this.chunks.filter(c => c.at >= at).map(c => c.data);
  }

  clear() {
    this.chunks = [];
  }
}
