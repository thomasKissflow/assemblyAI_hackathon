export interface ClockState {
  kitchenAnchor: number;
  realAnchor: number;
  speed: number;
  paused: boolean;
}

export const createClock = (kitchenStart: number, realNow: number, speed: number): ClockState => ({
  kitchenAnchor: kitchenStart, realAnchor: realNow, speed, paused: false,
});

export const kitchenNow = (c: ClockState, realNow: number): number =>
  c.paused ? c.kitchenAnchor : c.kitchenAnchor + (realNow - c.realAnchor) * c.speed;

const reanchor = (c: ClockState, realNow: number): ClockState => ({ ...c, kitchenAnchor: kitchenNow(c, realNow), realAnchor: realNow });

export const withSpeed = (c: ClockState, speed: number, realNow: number): ClockState => ({ ...reanchor(c, realNow), speed });
export const withPaused = (c: ClockState, paused: boolean, realNow: number): ClockState => ({ ...reanchor(c, realNow), paused });
export const jumpTo = (c: ClockState, kitchenTime: number, realNow: number): ClockState => ({ ...c, kitchenAnchor: kitchenTime, realAnchor: realNow });
