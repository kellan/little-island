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
export { HAULING, PHASES, RULEBOOKS, RULES, SETTLEMENT, VILLAGE, defineRule } from './rules.ts';
export type { CompiledRule, Rule, RuleContext, RulePhase, RuleTrace, Rulebook } from './rules.ts';
export { advance, alpha, createSimulation, enqueue, tick, tickTimes } from './engine.ts';
export type { Simulation, TickOptions } from './engine.ts';
export { serialize, deserialize } from './serialize.ts';
export { assertSound, census, checkWorld, ledger } from './invariants.ts';
export type { Violation } from './invariants.ts';
export { HOME, distance, elevation, onLand } from './terrain.ts';
export { nextRandom } from './rng.ts';
export {
  activeJobs, addBuilding, addSite, addVillager, availableSite, createWorld, dropWare,
  elapsedSeconds, findBuilding, findJob, findPile, findSite, findVillager, hasRoom, hashWorld,
  heldIn, hire, idleVillagers, jobForSite, liveSites, loosePiles, openJobs, roomForYield,
  secondsToTicks, shortOf, spare, standingTrees, taskIsReady, tasksFor, totalWare, wantsOf,
  workplaceOf,
} from './world.ts';
export * as tuning from './tuning.ts';
