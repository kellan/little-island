export type Point = { x: number; z: number };
export type Tree = Point & { id: number; scale: number; kind: number; chopped: boolean };
export type Phase = 'idle' | 'walking' | 'chopping' | 'returning';
export type World = { version: 1; time: number; logs: number; trees: Tree[]; villager: Point & { phase: Phase; target: number | null; progress: number; facing: number; roamGoal?: Point | null; restUntil?: number }; };
export const HOME: Point = { x: -1.4, z: 2.2 };
export const CHOP_TIME = 4.2;
export function elevation(x: number, z: number): number {
  const r = Math.sqrt((x / 15.4) ** 2 + (z / 12.4) ** 2);
  const natural = 1.15 + Math.max(0, 1 - r) * .65 + Math.sin(x * .3) * Math.cos(z * .31) * .22;
  const blend = Math.max(0, Math.min(1, (Math.hypot(x - HOME.x, z - HOME.z) - 2.8) / 1.5));
  return 1.72 + (natural - 1.72) * blend * blend * (3 - 2 * blend);
}
export function random(seed: number) { let s = seed; return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; }; }
export function createWorld(): World {
  const rng = random(841); const trees: Tree[] = [];
  for (let n = 0; n < 400 && trees.length < 37; n++) {
    const x = (rng() - .5) * 25, z = (rng() - .5) * 20;
    if ((x / 12.6) ** 2 + (z / 9.9) ** 2 > 1 || Math.hypot(x - HOME.x, z - HOME.z) < 4.6 || trees.some(t => Math.hypot(t.x - x, t.z - z) < 2)) continue;
    trees.push({ id: trees.length, x, z, scale: .8 + rng() * .55, kind: rng() > .32 ? 0 : 1, chopped: false });
  }
  return { version: 1, time: 0, logs: 0, trees, villager: { ...HOME, phase: 'idle', target: null, progress: 0, facing: 0 } };
}
export function orderChop(world: World, id: number): boolean {
  const tree = world.trees.find(t => t.id === id);
  if (!tree || tree.chopped || world.villager.phase === 'returning') return false;
  Object.assign(world.villager, { target: id, phase: 'walking', progress: 0, roamGoal: null }); return true;
}
export function step(world: World, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, .1); world.time += dt; const v = world.villager;
  const tree = world.trees.find(t => t.id === v.target);
  if (v.phase === 'idle') {
    if (v.roamGoal) {
      const dx = v.roamGoal.x - v.x, dz = v.roamGoal.z - v.z, distance = Math.hypot(dx, dz);
      if (distance < .05) { v.roamGoal = null; v.restUntil = world.time + 3.5; }
      else { const amount = Math.min(distance, dt * .48); v.x += dx / distance * amount; v.z += dz / distance * amount; v.facing = Math.atan2(dx, dz); }
    } else if (world.time > (v.restUntil ?? 4)) {
      const angle = world.time * 1.7; v.roamGoal = { x: HOME.x + Math.sin(angle) * .9, z: HOME.z + Math.cos(angle) * .85 };
    }
  } else if (v.phase === 'walking' || v.phase === 'returning') {
    const destination = v.phase === 'returning' ? HOME : tree;
    if (!destination) { v.phase = 'idle'; return; }
    const dx = destination.x - v.x, dz = destination.z - v.z, dist = Math.hypot(dx, dz);
    const stop = v.phase === 'returning' ? .05 : .85;
    v.facing = Math.atan2(dx, dz);
    if (dist <= stop + .03) {
      if (v.phase === 'returning') { world.logs++; v.phase = 'idle'; v.target = null; v.roamGoal = null; v.restUntil = world.time + 4; }
      else v.phase = 'chopping';
      v.progress = 0;
    } else { const d = Math.min(dt * 2.3, dist - stop); v.x += dx / dist * d; v.z += dz / dist * d; }
  } else if (v.phase === 'chopping') {
    if (!tree || tree.chopped) { v.phase = 'idle'; return; }
    v.progress += dt;
    if (v.progress >= CHOP_TIME) { tree.chopped = true; v.phase = 'returning'; v.progress = 0; }
  }
}
export function serialize(world: World): string { return JSON.stringify(world); }
export function deserialize(raw: string): World | null {
  try {
    const w = JSON.parse(raw) as World;
    if (w.version !== 1 || !Number.isFinite(w.time) || !Number.isInteger(w.logs) || w.logs < 0 || !Array.isArray(w.trees) || w.trees.length > 100 || !w.villager) return null;
    const v = w.villager;
    if (!['idle', 'walking', 'chopping', 'returning'].includes(v.phase) || ![v.x, v.z, v.progress, v.facing].every(Number.isFinite)) return null;
    if (w.trees.some(t => ![t.id, t.x, t.z, t.scale, t.kind].every(Number.isFinite) || typeof t.chopped !== 'boolean')) return null;
    if (v.target !== null && !w.trees.some(t => t.id === v.target)) return null;
    return w;
  } catch { return null; }
}
