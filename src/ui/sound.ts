let ctx: AudioContext | null = null;

export function unlockSound() {
  ctx ??= new AudioContext();
  void ctx.resume();
}

export function playBell() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [freq, peak] of [[1318.5, 0.16], [2637, 0.05], [3951, 0.025]] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.25);
  }
}
