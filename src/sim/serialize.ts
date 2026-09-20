/**
 * The persistence boundary. `serialize` is trivial because the state is already
 * plain data; `deserialize` is not, because anything can be in localStorage and a
 * malformed world must never reach the rules. Invalid input returns null, and the
 * caller starts a fresh island rather than crashing on tick one.
 */
import type { Activity, Command, Job, Tree, Villager, World } from './types.ts';

const FORMAT_VERSION = 2;
const MAX_TREES = 400;
const MAX_VILLAGERS = 64;
const MAX_JOBS = 128;
const MAX_INBOX = 64;

export function serialize(world: World): string {
  return JSON.stringify(world);
}

const finite = (...values: unknown[]) => values.every(value => typeof value === 'number' && Number.isFinite(value));
const counter = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function validActivity(activity: Activity | undefined): boolean {
  if (!activity || typeof activity !== 'object') return false;
  if (activity.kind === 'idle') return true;
  if (activity.kind === 'travel') {
    return !!activity.to && finite(activity.to.x, activity.to.z, activity.stopWithin, activity.speed)
      && ['harvest', 'deliver', 'roam'].includes(activity.purpose);
  }
  if (activity.kind === 'harvest') return finite(activity.treeId, activity.progress, activity.duration) && activity.duration > 0;
  return false;
}

function validTree(tree: Tree): boolean {
  return finite(tree.id, tree.x, tree.z, tree.scale)
    && (tree.kind === 0 || tree.kind === 1)
    && (tree.state === 'standing' || tree.state === 'felled')
    && (tree.reservedBy === null || finite(tree.reservedBy));
}

function validVillager(villager: Villager): boolean {
  return finite(villager.id, villager.x, villager.z, villager.px, villager.pz, villager.facing, villager.restUntil)
    && typeof villager.name === 'string' && villager.name.length <= 40
    && validActivity(villager.activity)
    && (villager.jobId === null || finite(villager.jobId))
    && (villager.carrying === null
      || (villager.carrying?.resource === 'timber' && counter(villager.carrying.amount)));
}

function validJob(job: Job): boolean {
  return finite(job.id, job.treeId, job.createdTick)
    && job.kind === 'harvest'
    && ['queued', 'assigned', 'done', 'cancelled'].includes(job.state)
    && (job.assignee === null || finite(job.assignee))
    && (job.finishedTick === null || finite(job.finishedTick));
}

function validCommand(command: Command): boolean {
  if (command?.kind === 'cancel-all') return true;
  return (command?.kind === 'order-harvest' || command?.kind === 'cancel-harvest') && finite(command.treeId);
}

/** Parse a saved world, or return null if it is not one we can safely run. */
export function deserialize(raw: string): World | null {
  let world: World;
  try {
    world = JSON.parse(raw) as World;
  } catch {
    return null;
  }
  if (!world || typeof world !== 'object' || world.version !== FORMAT_VERSION) return null;
  if (!counter(world.tick) || !counter(world.seed) || !counter(world.nextJobId) || !counter(world.nextVillagerId)) return null;
  if (!Array.isArray(world.trees) || world.trees.length > MAX_TREES || !world.trees.every(validTree)) return null;
  if (!Array.isArray(world.villagers) || world.villagers.length === 0 || world.villagers.length > MAX_VILLAGERS || !world.villagers.every(validVillager)) return null;
  if (!Array.isArray(world.jobs) || world.jobs.length > MAX_JOBS || !world.jobs.every(validJob)) return null;
  if (!Array.isArray(world.inbox) || world.inbox.length > MAX_INBOX || !world.inbox.every(validCommand)) return null;
  if (!world.stockpile || !finite(world.stockpile.x, world.stockpile.z) || !counter(world.stockpile.stock?.timber)) return null;
  if (!world.stats || !counter(world.stats.treesFelled) || !counter(world.stats.logsDelivered) || !counter(world.stats.ordersQueued)) return null;

  // Referential integrity: a dangling id would send a rule looking for something that is not there.
  const treeIds = new Set(world.trees.map(tree => tree.id));
  const villagerIds = new Set(world.villagers.map(villager => villager.id));
  const jobIds = new Set(world.jobs.map(job => job.id));
  if (treeIds.size !== world.trees.length || villagerIds.size !== world.villagers.length || jobIds.size !== world.jobs.length) return null;
  if (world.trees.some(tree => tree.reservedBy !== null && !villagerIds.has(tree.reservedBy))) return null;
  if (world.jobs.some(job => !treeIds.has(job.treeId) || (job.assignee !== null && !villagerIds.has(job.assignee)))) return null;
  if (world.villagers.some(villager => villager.jobId !== null && !jobIds.has(villager.jobId))) return null;
  if (world.villagers.some(v => v.activity.kind === 'harvest' && !treeIds.has(v.activity.treeId))) return null;
  return world;
}
