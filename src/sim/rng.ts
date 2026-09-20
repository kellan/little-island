/**
 * The world owns its randomness. Every draw advances `seed` inside the state, so
 * a saved world resumes the exact sequence it was on and replays stay identical.
 */
export function nextRandom(state: { seed: number }): number {
  state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

export function randomRange(state: { seed: number }, min: number, max: number): number {
  return min + nextRandom(state) * (max - min);
}
