import { describe, expect, it } from 'vitest';
import { createStressWorld, deserializeStress, hashStress, serializeStress, stepStress } from './stress-simulation';

describe('stress simulation', () => {
  it('is deterministic at benchmark scale', () => {
    const a = createStressWorld(500, 12), b = createStressWorld(500, 12);
    for (let i = 0; i < 1200; i++) { stepStress(a, 1/60); stepStress(b, 1/60); }
    expect(hashStress(a)).toBe(hashStress(b));
  });
  it('round trips without losing the next deterministic state', () => {
    const original = createStressWorld(100, 99);
    for (let i = 0; i < 100; i++) stepStress(original, 1/60);
    const restored = deserializeStress(serializeStress(original));
    stepStress(original, 1/60); stepStress(restored, 1/60);
    expect(hashStress(restored)).toBe(hashStress(original));
  });
});
