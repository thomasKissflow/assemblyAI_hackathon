import { describe, it, expect } from 'vitest';
import { laneHeight, layoutLead } from './Rail';

describe('layoutLead', () => {
  it('runs the label right when the lane is clear', () => {
    expect(layoutLead([100], 900)).toEqual({ flip: false, label: 240 });
  });
  it('stops the label short of the dish’s next marker', () => {
    const { flip, label } = layoutLead([40, 260, 500], 900);
    expect(flip).toBe(false);
    expect(40 + 80 + label).toBeLessThanOrEqual(260 - 10);
  });
  it('grows the pill to the left when the next marker or serve line is too close', () => {
    expect(layoutLead([700, 760], 900).flip).toBe(true);
    expect(layoutLead([860], 900).flip).toBe(true);
  });
  it('drops the label entirely when there is no room either side', () => {
    expect(layoutLead([20, 70], 900)).toEqual({ flip: false, label: 0 });
  });
});

describe('laneHeight', () => {
  it('tightens lanes for five or more dishes and loosens them on roomy screens', () => {
    expect(laneHeight(3)).toBeGreaterThan(laneHeight(6));
    expect(laneHeight(3, true)).toBeGreaterThan(laneHeight(3));
  });
});
