import type { Vec2 } from './types.ts';

/** The clearing: where logs come home. Shared by the simulation and the renderer. */
export const HOME: Vec2 = { x: -1.4, z: 2.2 };

/**
 * Ground height at a point. One function for feet, props and the mesh, so nothing
 * ever floats or sinks. Flattened near HOME so the clearing reads as a clearing.
 */
export function elevation(x: number, z: number): number {
  const r = Math.sqrt((x / 15.4) ** 2 + (z / 12.4) ** 2);
  const natural = 1.15 + Math.max(0, 1 - r) * .65 + Math.sin(x * .3) * Math.cos(z * .31) * .22;
  const blend = Math.max(0, Math.min(1, (Math.hypot(x - HOME.x, z - HOME.z) - 2.8) / 1.5));
  return 1.72 + (natural - 1.72) * blend * blend * (3 - 2 * blend);
}

/** Flat-plane distance. Walking cost ignores height on an island this gentle. */
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** True while the point is on the walkable mainland, not the beach ring or the sea. */
export function onLand(x: number, z: number): boolean {
  return (x / 12.6) ** 2 + (z / 9.9) ** 2 <= 1;
}
