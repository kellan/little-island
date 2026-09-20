/**
 * Little Island's simulation. Nothing in here imports Three.js or touches the DOM;
 * the whole module runs headless in a test, a worker, or a future server.
 *
 * Host loop:
 *   const sim = createSimulation();
 *   enqueue(sim, { kind: 'order-harvest', treeId });
 *   for (const event of advance(sim, dt)) { ...react... }
 */
export * from './types.ts';
export { PHASES, RULES, defineRule } from './rules.ts';
export type { CompiledRule, Rule, RuleContext, RulePhase, RuleTrace } from './rules.ts';
export { advance, alpha, createSimulation, enqueue, tick, tickTimes } from './engine.ts';
export type { Simulation } from './engine.ts';
export { serialize, deserialize } from './serialize.ts';
export { HOME, distance, elevation, onLand } from './terrain.ts';
export { nextRandom } from './rng.ts';
export {
  activeJobs, addVillager, createWorld, elapsedSeconds, findJob, findTree, findVillager,
  hashWorld, idleVillagers, jobForTree, openJobs, secondsToTicks, standingTrees,
} from './world.ts';
export * as tuning from './tuning.ts';
