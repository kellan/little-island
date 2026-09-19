export type StressAgent = {
  id: number; x: number; z: number; targetX: number; targetZ: number;
  speed: number; trips: number;
};

export type StressWorld = {
  version: 1; seed: number; time: number; completedTrips: number; agents: StressAgent[];
};

function nextRandom(state: { seed: number }): number {
  state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function point(world: StressWorld, agent: StressAgent) {
  const angle = nextRandom(world) * Math.PI * 2;
  const radius = 2 + Math.sqrt(nextRandom(world)) * 17;
  agent.targetX = Math.cos(angle) * radius;
  agent.targetZ = Math.sin(angle) * radius * .72;
}

export function createStressWorld(count: number, seed = 841): StressWorld {
  const world: StressWorld = { version: 1, seed, time: 0, completedTrips: 0, agents: [] };
  for (let id = 0; id < count; id++) {
    const agent: StressAgent = { id, x: 0, z: 0, targetX: 0, targetZ: 0, speed: .8 + nextRandom(world) * 1.7, trips: 0 };
    const angle = nextRandom(world) * Math.PI * 2, radius = Math.sqrt(nextRandom(world)) * 12;
    agent.x = Math.cos(angle) * radius; agent.z = Math.sin(angle) * radius * .72;
    point(world, agent); world.agents.push(agent);
  }
  return world;
}

export function retarget(world: StressWorld): void {
  for (const agent of world.agents) point(world, agent);
}

export function stepStress(world: StressWorld, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, .1); world.time += dt;
  for (const agent of world.agents) {
    const dx = agent.targetX - agent.x, dz = agent.targetZ - agent.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .12) { agent.trips++; world.completedTrips++; point(world, agent); continue; }
    const amount = Math.min(distance, agent.speed * dt);
    agent.x += dx / distance * amount; agent.z += dz / distance * amount;
  }
}

export function serializeStress(world: StressWorld): string { return JSON.stringify(world); }

export function deserializeStress(raw: string): StressWorld {
  const value = JSON.parse(raw) as StressWorld;
  if (value.version !== 1 || !Number.isFinite(value.time) || !Number.isInteger(value.seed) || !Array.isArray(value.agents)) throw new Error('Invalid stress world');
  for (const a of value.agents) if (![a.id,a.x,a.z,a.targetX,a.targetZ,a.speed,a.trips].every(Number.isFinite)) throw new Error('Invalid stress agent');
  return value;
}

export function hashStress(world: StressWorld): string {
  let hash = 2166136261;
  const mix = (n: number) => { hash ^= Math.round(n * 1000); hash = Math.imul(hash, 16777619); };
  mix(world.seed); mix(world.time); mix(world.completedTrips);
  for (const a of world.agents) { mix(a.id); mix(a.x); mix(a.z); mix(a.targetX); mix(a.targetZ); mix(a.trips); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
