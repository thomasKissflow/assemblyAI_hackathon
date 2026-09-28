export function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function shortDuration(ms: number): string {
  if (ms < 60_000) return mmss(ms);
  return `${Math.ceil(ms / 60_000)} min`;
}
