import { describe, it, expect } from 'vitest';
import { ChunkAccumulator, base64ToFloat, floatTo16, int16ToBase64 } from './pcm';

describe('pcm', () => {
  it('converts floats to clipped 16-bit samples', () => {
    expect(Array.from(floatTo16(new Float32Array([0, 1, -1, 2, -2])))).toEqual([0, 32767, -32768, 32767, -32768]);
  });
  it('round-trips through base64', () => {
    const src = new Float32Array([0, 0.5, -0.5, 0.25]);
    const back = base64ToFloat(int16ToBase64(floatTo16(src)));
    back.forEach((v, i) => expect(v).toBeCloseTo(src[i], 3));
  });
  it('emits fixed-size chunks and keeps the remainder', () => {
    const acc = new ChunkAccumulator(4);
    expect(acc.push(new Float32Array(3))).toHaveLength(0);
    const out = acc.push(new Float32Array(3));
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(4);
    expect(acc.push(new Float32Array(2))).toHaveLength(1);
  });
});
