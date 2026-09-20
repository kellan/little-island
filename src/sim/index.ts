/**
 * Little Island's simulation. Nothing in here imports Three.js or touches the DOM;
 * the whole module runs headless in a test, a worker, or a future server.
 *
 * Host loop:
 *   const sim = createSimulation();
 *   enqueue(sim, { kind: 'order-harvest', treeId });
 *   for (const event of advance(sim, dt)) { ...react... }
 */
export * from './types';
export { PHASES, RULES, defineRule } from './rules';
export type { CompiledRule, Rule, RuleContext, RulePhase } from './rules';
export { advance, alpha, createSimulation, enqueue, tick, tickTimes } from './engine';
export type { Simulation } from './engine';
export { serialize, deserialize } from './serialize';
export { HOME, distance, elevation, onLand } from './terrain';
export { nextRandom } from './rng';
export {
  activeJobs, addVillager, createWorld, elapsedSeconds, findJob, findTree, findVillager,
  hashWorld, idleVillagers, jobForTree, openJobs, secondsToTicks, standingTrees,
} from './world';
export * as tuning from './tuning';
