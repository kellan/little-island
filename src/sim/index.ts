/**
 * Little Island's simulation. Nothing in here imports Three.js or touches the DOM;
 * the whole module runs headless in a test, a worker, or a future server.
 *
 * Host loop:
 *   const sim = createSimulation();
 *   enqueue(sim, { kind: 'order-fell', treeId });
 *   for (const event of advance(sim, dt)) { ...react... }
 */
export * from './types.ts';
export { HAULING, LUMBERJACK, PHASES, RULEBOOKS, RULES, SETTLEMENT, defineRule } from './rules.ts';
export type { CompiledRule, Rule, RuleContext, RulePhase, RuleTrace, Rulebook } from './rules.ts';
export { advance, alpha, createSimulation, enqueue, tick, tickTimes } from './engine.ts';
export type { Simulation, TickOptions } from './engine.ts';
export { serialize, deserialize } from './serialize.ts';
export { HOME, distance, elevation, onLand } from './terrain.ts';
export { nextRandom } from './rng.ts';
export {
  activeJobs, addBuilding, addVillager, createWorld, dropWare, elapsedSeconds, findBuilding,
  findJob, findPile, findTree, findVillager, hasRoom, hashWorld, heldIn, hire, idleVillagers, jobForTree,
  loosePiles, openJobs, secondsToTicks, standingTrees, totalWare, workplaceOf,
} from './world.ts';
export * as tuning from './tuning.ts';
