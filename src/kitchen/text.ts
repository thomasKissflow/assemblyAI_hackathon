export const joinList = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
