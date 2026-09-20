/**
 * The persistence boundary. `serialize` is trivial because the state is already
 * plain data; `deserialize` is not, because anything can be in localStorage and a
 * malformed world must never reach the rules. Invalid input returns null, and the
 * caller starts a fresh island rather than crashing on tick one.
 */
import { BUILDINGS } from './tuning.ts';
import { ROLES, TOOLS, WARES, type Activity, type Building, type Command, type Job, type Site, type Villager, type WarePile, type World } from './types.ts';

const FORMAT_VERSION = 8;
const MAX_SITES = 400;
const MAX_VILLAGERS = 64;
const MAX_JOBS = 256;
const MAX_PILES = 256;
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
      && ['clock-on', 'work', 'fetch', 'deliver', 'roam'].includes(activity.purpose);
  }
  if (activity.kind === 'work') {
    return typeof activity.task === 'string' && finite(activity.progress, activity.duration) && activity.duration > 0
      && (activity.siteId === null || finite(activity.siteId))
      && (activity.buildingId === null || finite(activity.buildingId));
  }
  return false;
}

function validSite(site: Site): boolean {
  return finite(site.id, site.x, site.z, site.scale, site.variant)
    && ['tree', 'patch', 'bog'].includes(site.kind)
    && counter(site.amount) && counter(site.max) && site.amount <= site.max
    && (site.reservedBy === null || finite(site.reservedBy));
}

function validVillager(villager: Villager): boolean {
  return finite(villager.id, villager.x, villager.z, villager.px, villager.pz, villager.facing, villager.restUntil)
    && typeof villager.name === 'string' && villager.name.length <= 40
    && ROLES.includes(villager.role)
    && (villager.workplace === null || finite(villager.workplace))
    && (villager.tool === null || TOOLS.includes(villager.tool))
    && counter(villager.shiftDay)
    && validActivity(villager.activity)
    && (villager.jobId === null || finite(villager.jobId))
    && (villager.carrying === null
      || (WARES.includes(villager.carrying?.ware) && counter(villager.carrying.amount)));
}

function validJob(job: Job): boolean {
  if (job?.kind === 'supply') {
    return finite(job.id, job.createdTick, job.priority, job.from, job.to) && WARES.includes(job.ware) && counter(job.amount) && job.amount > 0
      && ['queued', 'assigned', 'done', 'cancelled'].includes(job.state)
      && (job.assignee === null || finite(job.assignee))
      && (job.finishedTick === null || finite(job.finishedTick));
  }
  if (job?.kind === 'task') {
    return finite(job.id, job.createdTick, job.priority) && typeof job.task === 'string'
      && (job.siteId === null || finite(job.siteId)) && (job.buildingId === null || finite(job.buildingId))
      && ['queued', 'assigned', 'done', 'cancelled'].includes(job.state)
      && (job.assignee === null || finite(job.assignee))
      && (job.finishedTick === null || finite(job.finishedTick));
  }
  if (job?.kind === 'haul' && !(job.to === null || finite(job.to))) return false;
  const target = job?.kind === 'haul' ? job.pileId : undefined;
  return finite(job.id, job.createdTick, job.priority, target)
    && ['queued', 'assigned', 'done', 'cancelled'].includes(job.state)
    && (job.assignee === null || finite(job.assignee))
    && (job.finishedTick === null || finite(job.finishedTick));
}

function validBuilding(building: Building): boolean {
  return finite(building.id, building.x, building.z, building.radius)
    && building.kind in BUILDINGS
    && counter(building.capacity) && building.capacity > 0
    && (building.workerId === null || finite(building.workerId))
    && TOOLS.includes(building.tool)
    && (building.waiting === null || WARES.includes(building.waiting))
    && !!building.stock && WARES.every(ware => counter(building.stock[ware]));
}

function validPile(pile: WarePile): boolean {
  return finite(pile.id, pile.x, pile.z)
    && (pile.destination === null || finite(pile.destination))
    && WARES.includes(pile.ware)
    && counter(pile.amount) && pile.amount > 0
    && (pile.reservedBy === null || finite(pile.reservedBy));
}

function validCommand(command: Command): boolean {
  if (command?.kind === 'cancel-all') return true;
  return (command?.kind === 'order-fell' || command?.kind === 'cancel-fell') && finite(command.siteId);
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
  if (!Array.isArray(world.sites) || world.sites.length > MAX_SITES || !world.sites.every(validSite)) return null;
  if (!counter(world.nextSiteId)) return null;
  if (!Array.isArray(world.villagers) || world.villagers.length === 0 || world.villagers.length > MAX_VILLAGERS || !world.villagers.every(validVillager)) return null;
  if (!Array.isArray(world.jobs) || world.jobs.length > MAX_JOBS || !world.jobs.every(validJob)) return null;
  if (!Array.isArray(world.piles) || world.piles.length > MAX_PILES || !world.piles.every(validPile)) return null;
  if (!counter(world.nextPileId) || !counter(world.nextBuildingId) || !counter(world.day) || world.day < 1) return null;
  if (!Array.isArray(world.buildings) || world.buildings.length > 64 || !world.buildings.every(validBuilding)) return null;
  if (!Array.isArray(world.inbox) || world.inbox.length > MAX_INBOX || !world.inbox.every(validCommand)) return null;
  if (!world.stockpile || !finite(world.stockpile.x, world.stockpile.z)) return null;
  if (!world.stockpile.stock || !WARES.every(ware => counter(world.stockpile.stock[ware]))) return null;
  if (!world.stats || !counter(world.stats.treesFelled) || !counter(world.stats.logsDelivered) || !counter(world.stats.ordersQueued)) return null;

  // Referential integrity: a dangling id would send a rule looking for something that is not there.
  const buildingIds = new Set(world.buildings.map(building => building.id));
  const siteIds = new Set(world.sites.map(site => site.id));
  const villagerIds = new Set(world.villagers.map(villager => villager.id));
  const jobIds = new Set(world.jobs.map(job => job.id));
  const pileIds = new Set(world.piles.map(pile => pile.id));
  if (siteIds.size !== world.sites.length || villagerIds.size !== world.villagers.length) return null;
  if (jobIds.size !== world.jobs.length || pileIds.size !== world.piles.length) return null;
  if (world.sites.some(site => site.reservedBy !== null && !villagerIds.has(site.reservedBy))) return null;
  if (world.piles.some(pile => pile.reservedBy !== null && !villagerIds.has(pile.reservedBy))) return null;
  if (world.piles.some(pile => pile.destination !== null && !buildingIds.has(pile.destination))) return null;
  if (new Set(world.buildings.map(building => building.id)).size !== world.buildings.length) return null;
  if (world.buildings.some(building => building.workerId !== null && !villagerIds.has(building.workerId))) return null;
  if (world.villagers.some(villager => villager.workplace !== null && !buildingIds.has(villager.workplace))) return null;
  // Only live jobs must point at something: a finished haul names a pile that has
  // been picked up, which is history rather than a dangling reference.
  const liveJobs = world.jobs.filter(job => job.state === 'queued' || job.state === 'assigned');
  // A haul already in somebody's arms has no pile left to name, which is fine.
  const carrying = new Set(world.villagers.filter(villager => villager.carrying).map(villager => villager.id));
  const targetExists = (job: Job) => job.kind === 'task'
      ? (job.siteId === null || siteIds.has(job.siteId)) && (job.buildingId === null || buildingIds.has(job.buildingId))
    : job.kind === 'haul' ? pileIds.has(job.pileId) || (job.assignee !== null && carrying.has(job.assignee))
    : buildingIds.has(job.from) && buildingIds.has(job.to);
  if (liveJobs.some(job => !targetExists(job))) return null;
  if (world.jobs.some(job => job.assignee !== null && !villagerIds.has(job.assignee))) return null;
  if (world.villagers.some(villager => villager.jobId !== null && !jobIds.has(villager.jobId))) return null;
  if (world.villagers.some(v => v.activity.kind === 'work' && v.activity.siteId !== null && !siteIds.has(v.activity.siteId))) return null;
  if (world.villagers.some(v => v.activity.kind === 'work' && v.activity.buildingId !== null && !buildingIds.has(v.activity.buildingId))) return null;
  return world;
}
