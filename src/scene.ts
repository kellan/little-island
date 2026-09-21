/**
 * Everything Three.js. The scene reads the simulation and never writes to it:
 * given the same world, it draws the same picture. Positions are interpolated
 * between simulation ticks so a 30 Hz world moves smoothly on a 60 Hz screen.
 *
 * Two dressings share this file. The bright island is the default and is drawn
 * exactly as it always was; the goblin fork (docs/GOBLINS.md) swaps the palette
 * and adds what that fork asks for — bog, decay, trees too big to fell, and a
 * settlement that is three sticks and a covered pit. Both read the same world,
 * which is the point: the fork is a visual treatment, not another game.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { disposeObject } from './dispose.ts';
import { HOME, elapsedSeconds, elevation, nextRandom, tuning, type Villager, type World } from './sim/index.ts';
import { activeTheme } from './theme.ts';

const theme = activeTheme(), palette = theme.scene, isGoblin = theme.id === 'goblin';

const mat = (color: string | number, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
const bark = mat(palette.bark), barkLight = mat(palette.barkCut), leaf = palette.leaves.map(color => mat(color));
const seeded = (seed: number) => { const state = { seed }; return () => nextRandom(state); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The goblin fork's decay layer: one cream cap, reused everywhere it grows. */
const capMat = mat('#e7dcbd'), gillMat = mat('#c9b98e'), stalkMat = mat('#d9d2b6'), bracketMat = mat('#cdbd92');
const peatMat = new THREE.MeshStandardMaterial({ color: '#3d4535', roughness: .3, metalness: .08, flatShading: true });
const mossMat = mat('#55693c'), thatchMat = mat('#7a6c43'), plankMat = mat('#6b5b45'), earthMat = mat('#453e31');

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

/** A toadstool: cap, gills, stalk. Small enough to scatter by the dozen. */
function toadstool(parent: THREE.Object3D, x: number, y: number, z: number, size = 1, lean = 0) {
  const stool = new THREE.Group(); stool.position.set(x, y, z); stool.rotation.z = lean; stool.scale.setScalar(size); parent.add(stool);
  mesh(new THREE.CylinderGeometry(.018, .026, .12, 5), stalkMat, stool, 0, .06, 0);
  mesh(new THREE.ConeGeometry(.075, .07, 8), capMat, stool, 0, .145, 0);
  mesh(new THREE.CircleGeometry(.07, 8), gillMat, stool, 0, .108, 0).rotation.x = Math.PI / 2;
  return stool;
}

/** The puppet for one villager. One rig per villager id, built on demand. */
type PersonRig = {
  group: THREE.Group; body: THREE.Group;
  leftLeg: THREE.Group; rightLeg: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group;
  axe: THREE.Group; carried: THREE.Group;
};

export type WorkBadge = { x: number; y: number; progress: number };

export class IslandScene {
  scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; controls: OrbitControls;
  treeGroups = new Map<number, THREE.Group>(); treeCrowns = new Map<number, THREE.Group>(); treeSpent = new Map<number, THREE.Group>(); pickables: THREE.Object3D[] = [];
  rigs = new Map<number, PersonRig>();
  hoverRing: THREE.Mesh; orderRings: THREE.Mesh[] = []; stockpile = new THREE.Group(); lastLogs = -1;
  water: THREE.Mesh; raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2(); world: World;
  dust: THREE.Points; dustPositions = new Float32Array(54); hovered: number | null = null;
  ember: THREE.PointLight | null = null; theme = theme;

  constructor(canvas: HTMLCanvasElement, world: World) {
    this.world = world; this.scene.background = new THREE.Color(palette.background); this.scene.fog = new THREE.Fog(palette.background, palette.fog[0], palette.fog[1]);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = palette.exposure;
    this.camera = new THREE.PerspectiveCamera(37, 1, .1, 220); this.camera.position.set(29, 30, 37);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.target.set(0, 1, 0); this.controls.enableDamping = true; this.controls.dampingFactor = .055; this.controls.minDistance = 9; this.controls.maxDistance = 65; this.controls.maxPolarAngle = Math.PI * .43; this.controls.minPolarAngle = .2; this.controls.enablePan = true; this.controls.maxTargetRadius = 12;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.scene.add(new THREE.HemisphereLight(palette.sky, palette.ground, palette.ambient));
    const sun = new THREE.DirectionalLight(palette.sun.color, palette.sun.intensity); sun.position.set(...palette.sun.at); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: .5, far: 90 }); sun.shadow.normalBias = .03; sun.shadow.bias = -.0002; sun.shadow.radius = 4; this.scene.add(sun);
    this.water = mesh(new THREE.PlaneGeometry(400, 400, 1, 1), new THREE.MeshStandardMaterial({ color: palette.water.color, roughness: palette.water.roughness, metalness: palette.water.metalness }), this.scene, 0, -.15, 0); this.water.rotation.x = -Math.PI / 2; this.water.receiveShadow = false;
    this.buildIsland(); this.buildTrees(); this.scene.add(this.stockpile);
    if (isGoblin) { this.buildBog(); this.buildCamp(); }
    this.hoverRing = this.buildRing(palette.hoverRing, .95, .77, .87);
    // Marked-for-felling rings read as a warm amber, darker than the grass rather than lighter.
    this.orderRings = Array.from({ length: tuning.MAX_JOBS_PER_VILLAGER }, () => this.buildRing(palette.orderRing, .95, .72, .86));
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3)); this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: palette.motes.color, size: palette.motes.size, transparent: true, opacity: .8 })); this.scene.add(this.dust);
    if (innerWidth < 650) { this.camera.position.set(34, 40, 48); this.controls.target.set(0, 1, 0); this.controls.maxDistance = 85; }
    this.resize(); window.addEventListener('resize', () => this.resize());
  }

  resize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.fov = w / h < .8 ? 52 : 37; this.camera.updateProjectionMatrix(); }

  buildRing(color: string, opacity: number, inner = .77, outer = .84) {
    const ring = mesh(new THREE.RingGeometry(inner, outer, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }), this.scene);
    ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.castShadow = false; ring.receiveShadow = false; return ring;
  }

  buildIsland() {
    const rng = seeded(60), segments = 76, rings = 13, pos: number[] = [], colors: number[] = [], indices: number[] = [];
    const color = new THREE.Color();
    for (let r = 0; r <= rings; r++) for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, radius = r / rings, irregular = 1 + .035 * Math.sin(a * 5) + .025 * Math.sin(a * 9);
      const x = Math.cos(a) * 15.4 * radius * irregular, z = Math.sin(a) * 12.4 * radius * irregular;
      const y = r === rings ? .12 : r === rings - 1 ? .76 : elevation(x, z);
      pos.push(x, y, z); color.set(palette.land[r === rings ? 0 : r === rings - 1 ? 1 : r === rings - 2 ? 2 : 3]); color.multiplyScalar(.94 + rng() * .12); colors.push(color.r, color.g, color.b);
      if (r < rings) { const k = r * segments + i, n = r * segments + (i + 1) % segments; indices.push(k, n, k + segments, n, n + segments, k + segments); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals();
    // Top triangles are wound counterclockwise as seen from above.
    const landMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.FrontSide }); mesh(g, landMat, this.scene);
    // Quiet shore ribbons, delicate enough to leave the island silhouette readable.
    for (let k = 0; k < 3; k++) {
      const points: THREE.Vector3[] = []; for (let i = 0; i <= segments; i++) { const a = i / segments * Math.PI * 2, ir = 1 + .035 * Math.sin(a * 5) + .025 * Math.sin(a * 9); points.push(new THREE.Vector3(Math.cos(a) * (15.6 + k * .38) * ir, -.10 + k * .005, Math.sin(a) * (12.6 + k * .38) * ir)); }
      const ribbon = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: palette.shoreline, transparent: true, opacity: .25 - k * .055 })); this.scene.add(ribbon);
    }
    const clearing = mesh(new THREE.CircleGeometry(2.45, 48), mat(palette.clearing), this.scene, HOME.x, elevation(HOME.x, HOME.z) + .025, HOME.z); clearing.rotation.x = -Math.PI / 2; clearing.scale.y = .83;
    for (let i = 0; i < 155; i++) {
      const x = (rng() - .5) * 29, z = (rng() - .5) * 22; if ((x / 14) ** 2 + (z / 11) ** 2 > .9 || Math.hypot(x - HOME.x, z - HOME.z) < 3) continue;
      const group = new THREE.Group(); group.position.set(x, elevation(x, z), z); this.scene.add(group);
      if (i % 7 === 0) { const rock = mesh(new THREE.DodecahedronGeometry(.23 + rng() * .3, 0), mat(i % 2 ? palette.rock[0] : palette.rock[1]), group, 0, .14, 0); rock.scale.set(1, .55, .8); rock.rotation.set(rng(), rng(), 0); }
      else for (let j = 0; j < 3; j++) { const grass = mesh(new THREE.ConeGeometry(.06, .28 + rng() * .18, 3), mat(i % 3 ? palette.tuft[0] : palette.tuft[1]), group, (rng() - .5) * .24, .13, (rng() - .5) * .24); grass.rotation.z = (rng() - .5) * .55; }
      if (i % 8 === 0) for (let j = 0; j < 3; j++) mesh(new THREE.IcosahedronGeometry(.065, 0), mat(palette.bloom), group, (rng() - .5) * .45, .32, (rng() - .5) * .45);
      // The decay layer, scattered: a stick already down, and something eating it.
      if (isGoblin && i % 5 === 0) {
        const stick = mesh(new THREE.CylinderGeometry(.045, .06, .7 + rng() * .6, 5), bark, group, (rng() - .5) * .5, .06, (rng() - .5) * .5);
        stick.rotation.set(Math.PI / 2, 0, rng() * 3.1); stick.rotation.z = rng() * 3.1;
        for (let j = 0; j < 2; j++) toadstool(group, (rng() - .5) * .6, .04, (rng() - .5) * .6, .7 + rng() * .5, (rng() - .5) * .3);
      }
      if (isGoblin && i % 11 === 0) { const hummock = mesh(new THREE.IcosahedronGeometry(.4 + rng() * .25, 0), mossMat, group, 0, .05, 0); hummock.scale.y = .42; hummock.rotation.y = rng(); }
    }
    const post = mesh(new THREE.CylinderGeometry(.045, .055, .68, 6), bark, this.scene, HOME.x + 1.85, elevation(HOME.x + 1.85, HOME.z) + .34, HOME.z - .6);
    mesh(new THREE.BoxGeometry(.52, .22, .055), mat(palette.sign), post, .16, .2, 0).rotation.z = -.12;
  }

  /**
   * The bog, and the fungus. The simulation already seeds patch and bog sites the
   * bright island never draws; the goblin fork is exactly the treatment that wants
   * them on screen, so here they are: peat pools with reeds, and mushroom beds.
   */
  buildBog() {
    const rng = seeded(97);
    for (const site of this.world.sites) {
      const ground = elevation(site.x, site.z);
      if (site.kind === 'bog') {
        const group = new THREE.Group(); group.position.set(site.x, ground, site.z); this.scene.add(group);
        // A dark still pool on a paler wet bank, so it reads as water and not as shadow.
        const bank = mesh(new THREE.CircleGeometry(1.95 * site.scale, 22), mat('#625d3f'), group, 0, .015, 0);
        bank.rotation.x = -Math.PI / 2; bank.scale.y = .8; bank.castShadow = false;
        const pool = mesh(new THREE.CircleGeometry(1.55 * site.scale, 22), peatMat, group, 0, .025, 0);
        pool.rotation.x = -Math.PI / 2; pool.scale.y = .78; pool.castShadow = false;
        for (let i = 0; i < 12; i++) {
          const a = rng() * Math.PI * 2, r = (1.3 + rng() * .55) * site.scale;
          const reed = mesh(new THREE.ConeGeometry(.035, .6 + rng() * .55, 3), mossMat, group, Math.cos(a) * r, .22, Math.sin(a) * r * .8);
          reed.rotation.z = (rng() - .5) * .5; reed.rotation.x = (rng() - .5) * .3;
        }
        for (let i = 0; i < 3; i++) { const stone = mesh(new THREE.DodecahedronGeometry(.13 + rng() * .1, 0), mat(palette.rock[0]), group, (rng() - .5) * 2.1, .06, (rng() - .5) * 1.6); stone.scale.y = .5; }
      }
      if (site.kind === 'patch') {
        // A fungus bed: the food ladder's bottom rung, and a reason to look down.
        const group = new THREE.Group(); group.position.set(site.x, ground, site.z); group.scale.setScalar(site.scale); this.scene.add(group);
        const litter = mesh(new THREE.CircleGeometry(.85, 14), mat('#463c2e'), group, 0, .015, 0); litter.rotation.x = -Math.PI / 2; litter.scale.y = .8; litter.castShadow = false;
        const log = mesh(new THREE.CylinderGeometry(.13, .15, 1.3, 6), bark, group, 0, .13, .1); log.rotation.set(Math.PI / 2, 0, .4);
        for (let i = 0; i < 7; i++) { const a = rng() * Math.PI * 2, r = rng() * .7; toadstool(group, Math.cos(a) * r, .02, Math.sin(a) * r * .85, .8 + rng() * .7, (rng() - .5) * .35); }
        for (let i = 0; i < 3; i++) { const shelf = mesh(new THREE.CylinderGeometry(.09, .075, .03, 7, 1, false, 0, Math.PI), bracketMat, group, -.1 + i * .1, .2 + i * .06, .2); shelf.rotation.set(0, i * 1.2, .1); }
      }
    }
  }

  /**
   * A goblin settlement: small, weak, and pleased with itself. A covered pit
   * rather than a granary, a lean-to of three sticks, a drying rack, and an
   * ember under a pot — the warmest light on a cold island, which is the whole
   * argument of the fork in one prop.
   */
  buildCamp() {
    const at = (dx: number, dz: number) => ({ x: HOME.x + dx, z: HOME.z + dz, y: elevation(HOME.x + dx, HOME.z + dz) });
    // The clamp: goblins dig, so the store goes under a mound of earth and turf.
    const pit = at(-1.75, -.35), pitGroup = new THREE.Group(); pitGroup.position.set(pit.x, pit.y, pit.z); this.scene.add(pitGroup);
    const mound = mesh(new THREE.SphereGeometry(.85, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), earthMat, pitGroup, 0, 0, 0); mound.scale.set(1, .52, .78);
    const turf = mesh(new THREE.SphereGeometry(.86, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2.4), mossMat, pitGroup, 0, .01, 0); turf.scale.set(1, .5, .78);
    const door = mesh(new THREE.BoxGeometry(.46, .42, .06), plankMat, pitGroup, 0, .21, .66); door.rotation.x = -.22;
    mesh(new THREE.CylinderGeometry(.03, .03, .5, 5), bark, pitGroup, 0, .21, .69).rotation.z = Math.PI / 2;

    // The lean-to. Three poles and a bit of thatch is the whole house.
    const shelter = at(-1.35, 1.5), lean = new THREE.Group(); lean.position.set(shelter.x, shelter.y, shelter.z); lean.rotation.y = .4; this.scene.add(lean);
    for (const sx of [-.62, .62]) { const pole = mesh(new THREE.CylinderGeometry(.045, .055, 1.05, 5), bark, lean, sx, .52, -.3); pole.rotation.x = .28; }
    for (const sx of [-.62, .62]) mesh(new THREE.CylinderGeometry(.04, .05, .52, 5), bark, lean, sx, .26, .55);
    const roof = mesh(new THREE.BoxGeometry(1.2, .07, .95), thatchMat, lean, 0, .72, .1); roof.rotation.x = .5;
    mesh(new THREE.BoxGeometry(1.15, .46, .06), plankMat, lean, 0, .34, -.46).rotation.x = .28;

    // A drying rack, because a patient economy keeps things rather than eating them.
    const rack = at(.55, -1.65), rackGroup = new THREE.Group(); rackGroup.position.set(rack.x, rack.y, rack.z); rackGroup.rotation.y = -.5; this.scene.add(rackGroup);
    for (const sx of [-.7, .7]) mesh(new THREE.CylinderGeometry(.04, .05, 1.1, 5), bark, rackGroup, sx, .55, 0);
    mesh(new THREE.CylinderGeometry(.033, .033, 1.5, 5), bark, rackGroup, 0, 1.02, 0).rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const strip = mesh(new THREE.BoxGeometry(.11, .3, .025), i % 2 ? capMat : mat('#b98a5c'), rackGroup, -.58 + i * .23, .84, 0); strip.rotation.z = (i % 3 - 1) * .08; }

    // Hurdles: woven hazel, and the only way to point a pig. Two panels is enough to say it.
    for (const [hx, hz, turn] of [[-2.55, 1.15, .75], [-2.15, -1.75, -.5]] as const) {
      const spot = at(hx, hz), fence = new THREE.Group(); fence.position.set(spot.x, spot.y, spot.z); fence.rotation.y = turn; this.scene.add(fence);
      for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(.028, .032, .62, 4), bark, fence, -.4 + i * .2, .31, 0);
      for (let j = 0; j < 3; j++) mesh(new THREE.CylinderGeometry(.022, .022, .95, 4), barkLight, fence, 0, .16 + j * .16, 0).rotation.z = Math.PI / 2;
    }

    // The fire. Small, and the brightest thing for miles. Kept clear of HOME itself,
    // which is where the goblin stands to hand a log over.
    const fire = at(-.6, -1.3), hearth = new THREE.Group(); hearth.position.set(fire.x, fire.y, fire.z); this.scene.add(hearth);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const stone = mesh(new THREE.DodecahedronGeometry(.11, 0), mat(palette.rock[1]), hearth, Math.cos(a) * .34, .05, Math.sin(a) * .34); stone.scale.y = .6; }
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const pole = mesh(new THREE.CylinderGeometry(.028, .032, 1.15, 4), bark, hearth, Math.cos(a) * .3, .55, Math.sin(a) * .3); pole.rotation.set(Math.cos(a) * -.28, 0, Math.sin(a) * .28); }
    const pot = mesh(new THREE.SphereGeometry(.22, 10, 7, 0, Math.PI * 2, 0, Math.PI * .62), mat('#3a3a38', .6), hearth, 0, .5, 0); pot.rotation.x = Math.PI;
    mesh(new THREE.IcosahedronGeometry(.16, 0), new THREE.MeshBasicMaterial({ color: '#e08a3c' }), hearth, 0, .07, 0).scale.y = .5;
    this.ember = new THREE.PointLight('#ffab4d', 2.1, 6, 2);
    this.ember.position.set(fire.x, fire.y + .55, fire.z); this.scene.add(this.ember);
  }

  buildTrees() {
    for (const t of this.world.sites) {
      if (t.kind !== 'tree') continue; // Patches and bogs get their own dressing, and only in the fork.
      const group = new THREE.Group(); group.position.set(t.x, elevation(t.x, t.z), t.z); group.scale.setScalar(t.scale); group.userData.treeId = t.id; this.scene.add(group); this.treeGroups.set(t.id, group);
      const stump = mesh(new THREE.CylinderGeometry(.17, .23, .25, 7), bark, group, 0, .125, 0); mesh(new THREE.CircleGeometry(.16, 7), barkLight, stump, 0, .127, 0).rotation.x = -Math.PI / 2;
      const crown = new THREE.Group(); group.add(crown); this.treeCrowns.set(t.id, crown);
      if (isGoblin) this.buildGoblinTree(t.id, t.variant, group, crown); else this.buildIslandTree(t.id, t.variant, crown);
      group.traverse(o => { if (o instanceof THREE.Mesh) { o.userData.treeId = t.id; this.pickables.push(o); } }); crown.visible = t.amount > 0;
      if (isGoblin) this.buildSpentCrop(t.id, group);
    }
  }

  buildIslandTree(id: number, variant: number, crown: THREE.Group) {
    mesh(new THREE.CylinderGeometry(.12, .2, 1.7, 7), bark, crown, 0, .9, 0);
    if (variant === 0) { for (let j = 0; j < 3; j++) { const c = mesh(new THREE.ConeGeometry(1.04 - j * .2, 1.7 - j * .22, 7), leaf[(id + j) % 3], crown, 0, 1.7 + j * .66, 0); c.rotation.y = j * .6; } }
    else { for (let j = 0; j < 4; j++) { const c = mesh(new THREE.IcosahedronGeometry(.97, 1), leaf[(id + j) % 4], crown, Math.sin(j * 2.2) * .43, 2.05 + (j === 3 ? .57 : 0), Math.cos(j * 2.2) * .4); c.scale.y = 1.08; } }
  }

  /**
   * Pillar 1 says goblins cannot fell a great tree, so the trees are drawn as the
   * thing they cannot: tall, dark, bare a long way up, and carrying somebody
   * else's crop. Brackets climb the trunk and toadstools ring the foot, so a tree
   * reads as a place to find food before it reads as timber.
   */
  buildGoblinTree(id: number, variant: number, group: THREE.Group, crown: THREE.Group) {
    const rng = seeded(id * 31 + 7);
    // Twice the island tree's height and no wider: the mass goes into a long bare
    // trunk, so the forest looms without closing over the ground you play on.
    mesh(new THREE.CylinderGeometry(.1, .23, 3.7, 7), bark, crown, 0, 1.9, 0);
    if (variant === 0) { for (let j = 0; j < 4; j++) { const c = mesh(new THREE.ConeGeometry(.88 - j * .19, 1.55 - j * .18, 7), leaf[(id + j) % 3], crown, 0, 3.55 + j * .6, 0); c.rotation.y = j * .6; } }
    else { for (let j = 0; j < 4; j++) { const c = mesh(new THREE.IcosahedronGeometry(.82, 1), leaf[(id + j) % 4], crown, Math.sin(j * 2.2) * .4, 4.05 + (j === 3 ? .5 : 0), Math.cos(j * 2.2) * .37); c.scale.y = 1.05; } }
    // Shelf fungus, climbing the wet side of the trunk.
    for (let j = 0; j < 4; j++) {
      const a = rng() * Math.PI * 2, y = .55 + j * .62 + rng() * .35;
      const shelf = mesh(new THREE.CylinderGeometry(.1, .075, .03, 7, 1, false, 0, Math.PI), bracketMat, crown, Math.cos(a) * .16, y, Math.sin(a) * .16);
      shelf.rotation.set(.12, -a, 0);
    }
    // The skirt at the foot stays on after the crown goes: decay does not need the tree.
    const rot = new THREE.Group(); group.add(rot);
    for (let j = 0; j < 5; j++) { const a = rng() * Math.PI * 2, r = .35 + rng() * .4; toadstool(rot, Math.cos(a) * r, .03, Math.sin(a) * r, .75 + rng() * .6, (rng() - .5) * .4); }
    mesh(new THREE.IcosahedronGeometry(.4, 0), mossMat, rot, .14, .04, .2).scale.y = .3;
  }

  /**
   * What moves in once the tree is down. The fork's flagship chain is fungus grown
   * on spent wood, so a worked-out stump should look like the start of the next
   * crop rather than like a hole in the scenery. Built after the tree has handed
   * its meshes to the picker, so a hidden mushroom can never steal a click.
   */
  buildSpentCrop(id: number, group: THREE.Group) {
    const rng = seeded(id * 17 + 3), spent = new THREE.Group();
    group.add(spent); spent.visible = false; this.treeSpent.set(id, spent);
    for (let j = 0; j < 4; j++) { const a = rng() * Math.PI * 2; const shelf = mesh(new THREE.CylinderGeometry(.17, .13, .04, 7, 1, false, 0, Math.PI), bracketMat, spent, Math.cos(a) * .2, .1 + j * .05, Math.sin(a) * .2); shelf.rotation.set(.14, -a, 0); }
    for (let j = 0; j < 4; j++) { const a = rng() * Math.PI * 2, r = .1 + rng() * .12; toadstool(spent, Math.cos(a) * r, .24, Math.sin(a) * r, .8 + rng() * .5, (rng() - .5) * .5); }
    mesh(new THREE.IcosahedronGeometry(.19, 0), mossMat, spent, -.06, .22, .05).scale.y = .35;
  }

  buildPerson(): PersonRig {
    const rig: PersonRig = { group: new THREE.Group(), body: new THREE.Group(), leftLeg: new THREE.Group(), rightLeg: new THREE.Group(), leftArm: new THREE.Group(), rightArm: new THREE.Group(), axe: new THREE.Group(), carried: new THREE.Group() };
    rig.group.add(rig.body); rig.body.position.y = .62;
    if (isGoblin) this.dressGoblin(rig); else this.dressVillager(rig);
    rig.group.add(rig.carried);
    const long = isGoblin ? 1.75 : .95, thick = isGoblin ? .2 : .16, hoist = isGoblin ? .82 : .84, out = isGoblin ? -.05 : .38;
    const log = mesh(new THREE.CylinderGeometry(thick * .88, thick, long, 8), bark, rig.carried, 0, hoist, out); log.rotation.z = Math.PI / 2;
    for (const x of [-long / 2, long / 2]) { const end = mesh(new THREE.CircleGeometry(thick * .83, 8), barkLight, rig.carried, x, hoist, out); end.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; }
    // Never quite balanced: the load sits across her at a slight angle and stays
    // level while she bends under it, because `carried` hangs off the unpitched group.
    if (isGoblin) rig.carried.rotation.set(0, .2, .07);
    rig.carried.visible = false; this.scene.add(rig.group); return rig;
  }

  dressVillager(rig: PersonRig) {
    const skin = mat('#e5b47c'), shirt = mat('#cf744c'), pants = mat('#3e625c'), shoe = mat('#664d36'), hat = mat('#eed494');
    const torso = mesh(new THREE.CylinderGeometry(.19, .24, .43, 7), shirt, rig.body, 0, .16, 0); torso.scale.z = .78;
    mesh(new THREE.SphereGeometry(.215, 10, 8), skin, rig.body, 0, .55, 0);
    mesh(new THREE.CylinderGeometry(.3, .32, .055, 10), hat, rig.body, 0, .715, 0); mesh(new THREE.CylinderGeometry(.17, .21, .19, 8), hat, rig.body, 0, .81, 0); mesh(new THREE.CylinderGeometry(.202, .21, .04, 8), mat('#8c7441'), rig.body, 0, .735, 0);
    mesh(new THREE.SphereGeometry(.055, 6, 4), skin, rig.body, 0, .54, .205);
    for (const x of [-.08, .08]) mesh(new THREE.SphereGeometry(.016, 5, 4), mat('#453b31'), rig.body, x, .592, .188);
    rig.leftLeg.position.set(-.11, .46, 0); rig.rightLeg.position.set(.11, .46, 0); rig.group.add(rig.leftLeg, rig.rightLeg);
    for (const leg of [rig.leftLeg, rig.rightLeg]) { mesh(new THREE.CylinderGeometry(.073, .07, .31, 6), pants, leg, 0, -.13, 0); mesh(new THREE.BoxGeometry(.14, .12, .23), shoe, leg, 0, -.31, .04); }
    rig.leftArm.position.set(-.23, .32, 0); rig.rightArm.position.set(.23, .32, 0); rig.body.add(rig.leftArm, rig.rightArm);
    for (const arm of [rig.leftArm, rig.rightArm]) { mesh(new THREE.CylinderGeometry(.078, .065, .28, 6), shirt, arm, 0, -.1, 0); mesh(new THREE.SphereGeometry(.073, 7, 5), skin, arm, 0, -.255, 0); }
    rig.rightArm.add(rig.axe); rig.axe.position.set(0, -.26, .07); mesh(new THREE.CylinderGeometry(.027, .027, .5, 5), bark, rig.axe, 0, 0, .16).rotation.x = Math.PI / 2; mesh(new THREE.BoxGeometry(.24, .15, .055), mat('#8c9992'), rig.axe, .07, 0, .38);
  }

  /**
   * A goblin: shorter, wider, long in the arm, and patched. The silhouette does
   * the work — ears and a hood where the straw hat was, bare feet, and a wedge
   * and mallet instead of an axe, because a goblin takes a tree apart rather
   * than knocking it down.
   */
  dressGoblin(rig: PersonRig) {
    const skin = mat('#8ea364'), tunic = mat('#8f4c2e'), patch = mat('#6d6a3c'), hood = mat('#47563b'), belt = mat('#4a3a2c');
    rig.group.scale.setScalar(.82); rig.body.position.y = .56;
    const torso = mesh(new THREE.CylinderGeometry(.23, .27, .4, 7), tunic, rig.body, 0, .14, 0); torso.scale.z = .82;
    mesh(new THREE.BoxGeometry(.13, .12, .02), patch, rig.body, .11, .16, .215);
    mesh(new THREE.CylinderGeometry(.275, .28, .05, 8), belt, rig.body, 0, -.05, 0);
    mesh(new THREE.SphereGeometry(.235, 10, 8), skin, rig.body, 0, .47, 0);
    // Ears and a pushed-back hood. The island is played from above, so nothing may
    // sit on top of the head: the silhouette from up there has to be all ears.
    for (const side of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(.08, .46, 5), skin, rig.body, side * .22, .53, -.04); ear.rotation.set(-.3, 0, side * 1.22); }
    const cowl = mesh(new THREE.ConeGeometry(.21, .26, 8), hood, rig.body, 0, .58, -.19); cowl.rotation.x = -.85;
    mesh(new THREE.CylinderGeometry(.26, .29, .09, 9), hood, rig.body, 0, .32, -.02);
    const nose = mesh(new THREE.ConeGeometry(.06, .21, 6), skin, rig.body, 0, .46, .2); nose.rotation.x = 1.75;
    for (const x of [-.095, .095]) { mesh(new THREE.SphereGeometry(.044, 6, 5), mat('#f0d489'), rig.body, x, .55, .175); mesh(new THREE.SphereGeometry(.019, 5, 4), mat('#2c2a22'), rig.body, x, .55, .208); }
    // Short legs, bare feet, splayed wide: weak, but planted.
    rig.leftLeg.position.set(-.13, .38, 0); rig.rightLeg.position.set(.13, .38, 0); rig.group.add(rig.leftLeg, rig.rightLeg);
    for (const leg of [rig.leftLeg, rig.rightLeg]) { mesh(new THREE.CylinderGeometry(.085, .08, .25, 6), mat('#5e6a44'), leg, 0, -.11, 0); mesh(new THREE.BoxGeometry(.17, .1, .26), skin, leg, 0, -.26, .05); }
    // Long arms. They reach most of the way to the ground, and that is the joke.
    rig.leftArm.position.set(-.27, .28, 0); rig.rightArm.position.set(.27, .28, 0); rig.body.add(rig.leftArm, rig.rightArm);
    for (const arm of [rig.leftArm, rig.rightArm]) { mesh(new THREE.CylinderGeometry(.075, .062, .38, 6), tunic, arm, 0, -.15, 0); mesh(new THREE.SphereGeometry(.088, 7, 5), skin, arm, 0, -.35, 0); }
    // A creel on her back: unfussy, and never comes home empty.
    const creel = mesh(new THREE.CylinderGeometry(.13, .11, .24, 8), mat('#a08a58'), rig.body, 0, .14, -.27); creel.rotation.x = .18;
    toadstool(rig.body, .04, .25, -.25, .7, .25); toadstool(rig.body, -.05, .27, -.3, .55, -.3);
    // Wedge and mallet, one in each hand.
    rig.rightArm.add(rig.axe); rig.axe.position.set(0, -.36, .05);
    mesh(new THREE.CylinderGeometry(.03, .034, .3, 5), bark, rig.axe, 0, 0, .09).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(.068, .075, .16, 7), mat('#7d6a4c'), rig.axe, 0, 0, .26).rotation.x = Math.PI / 2;
    mesh(new THREE.ConeGeometry(.06, .22, 4), mat('#9aa196'), rig.leftArm, 0, -.4, .06).rotation.x = 1.5;
  }

  rigFor(villager: Villager): PersonRig {
    let rig = this.rigs.get(villager.id);
    if (!rig) { rig = this.buildPerson(); this.rigs.set(villager.id, rig); }
    return rig;
  }

  /** Where a villager is right now, between the last tick and the next one. */
  placeOf(villager: Villager, alpha: number) {
    return { x: lerp(villager.px, villager.x, alpha), z: lerp(villager.pz, villager.z, alpha) };
  }

  pick(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables).find(h => { const site = this.world.sites.find(other => other.id === h.object.userData.treeId); return site?.kind === 'tree' && site.amount > 0; });
    return hit ? hit.object.userData.treeId as number : null;
  }

  focusVillager() {
    const villager = this.world.villagers[0]; if (!villager) return;
    this.controls.target.set(villager.x, elevation(villager.x, villager.z), villager.z);
    this.camera.position.set(villager.x + 4, 13, villager.z + 5); this.controls.update();
  }

  resetCamera() { if (innerWidth < 650) this.camera.position.set(34, 40, 48); else this.camera.position.set(29, 30, 37); this.controls.target.set(0, 1, 0); this.controls.update(); }

  update(realTime: number, alpha = 1) {
    const world = this.world, time = elapsedSeconds(world) + alpha * tuning.TICK_SECONDS;
    const chopping = new Set<number>();
    let chopTarget: { x: number; z: number } | null = null;

    for (const villager of world.villagers) {
      const rig = this.rigFor(villager), activity = villager.activity;
      const moving = activity.kind === 'travel', swinging = activity.kind === 'work' && activity.siteId !== null, carrying = !!villager.carrying;
      const at = this.placeOf(villager, alpha);
      rig.group.position.set(at.x, elevation(at.x, at.z), at.z); rig.group.rotation.y = villager.facing;
      const pace = moving ? activity.speed / tuning.WALK_SPEED : 0;
      rig.body.position.y = (isGoblin ? .56 : .62) + (moving ? Math.sin(time * 15 * pace) * .035 : Math.sin(realTime * 2) * .015);
      rig.body.rotation.z = moving ? Math.sin(time * 7.5 * pace) * .035 : 0;
      // An awkward load, not a heavy one: under a log a goblin is bent over it and weaving.
      rig.body.rotation.x = isGoblin && carrying ? .24 + Math.sin(time * 7.5 * Math.max(pace, .4)) * .05 : 0;
      if (isGoblin && carrying) rig.body.rotation.z += Math.sin(time * 3.7 * Math.max(pace, .4)) * .07;
      rig.leftLeg.rotation.x = moving ? Math.sin(time * 15 * pace) * .55 : 0; rig.rightLeg.rotation.x = -rig.leftLeg.rotation.x;
      rig.leftArm.rotation.x = carrying ? -1.15 : moving ? -Math.sin(time * 15 * pace) * .5 : 0;
      rig.rightArm.rotation.x = swinging ? -1.2 + Math.sin(time * 9) * 1.2 : carrying ? -1.15 : moving ? Math.sin(time * 15 * pace) * .5 : 0;
      rig.axe.visible = !carrying; rig.carried.visible = carrying;
      if (activity.kind === 'work' && activity.siteId !== null) { chopping.add(activity.siteId); const site = world.sites.find(s => s.id === activity.siteId); if (site) chopTarget = site; }
    }

    for (const site of world.sites) {
      const crown = this.treeCrowns.get(site.id); if (!crown) continue;
      crown.visible = site.amount > 0;
      const spent = this.treeSpent.get(site.id); if (spent) spent.visible = site.amount === 0;
      crown.rotation.z = Math.sin(realTime * 1.3 + site.id) * .009;
      if (chopping.has(site.id)) crown.rotation.z += Math.max(0, Math.sin(time * 9)) * .025;
    }

    // A ring on every tree with an order against it, plus one under the cursor.
    const ordered = world.jobs.flatMap(job => job.kind === 'task' && job.siteId !== null && (job.state === 'queued' || job.state === 'assigned') ? [job.siteId] : []);
    this.orderRings.forEach((ring, index) => {
      const tree = index < ordered.length ? world.sites.find(site => site.id === ordered[index]) : undefined;
      ring.visible = !!tree && tree.amount > 0;
      if (tree) { ring.position.set(tree.x, elevation(tree.x, tree.z) + .04, tree.z); ring.scale.setScalar(1 + Math.sin(realTime * 4 + index) * .04); }
    });
    const hover = this.hovered === null ? undefined : world.sites.find(site => site.id === this.hovered);
    this.hoverRing.visible = !!hover && hover.amount > 0;
    if (hover) { this.hoverRing.position.set(hover.x, elevation(hover.x, hover.z) + .05, hover.z); this.hoverRing.scale.setScalar(1.06 + Math.sin(realTime * 4) * .04); }

    if (this.ember) this.ember.intensity = 2.1 + Math.sin(realTime * 2.7) * .3 + Math.sin(realTime * 7.1) * .14;

    this.dust.visible = !!chopTarget;
    if (chopTarget) {
      // Woodchips fly; spores hang about and go up. Same points, different weather.
      const rise = isGoblin ? .9 : .5, spread = isGoblin ? .55 : .8, drift = isGoblin ? .8 : 1.6;
      for (let i = 0; i < 18; i++) {
        const age = (time * drift + i / 18) % 1, angle = i * 2.4;
        this.dustPositions[i * 3] = chopTarget.x + Math.sin(angle) * age * spread;
        this.dustPositions[i * 3 + 1] = elevation(chopTarget.x, chopTarget.z) + .6 + age * rise - (isGoblin ? 0 : age * age);
        this.dustPositions[i * 3 + 2] = chopTarget.z + Math.cos(angle) * age * spread;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    const logs = world.stockpile.stock.log;
    if (this.lastLogs !== logs) {
      this.lastLogs = logs;
      // Geometry is built fresh each time the pile changes; the old meshes have to go
      // back to the GPU or the island leaks a little every delivery. Materials are shared.
      for (const log of [...this.stockpile.children]) disposeObject(log, { keepMaterials: true });
      this.stockpile.clear();
      for (let i = 0; i < Math.min(logs, 40); i++) {
        const x = HOME.x + 1 + (i % 4) * .31, y = elevation(HOME.x + 1, HOME.z) + .16 + Math.floor(i / 8) * .27, z = HOME.z + .45 + Math.floor(i % 8 / 4) * 1.1;
        const log = mesh(new THREE.CylinderGeometry(.14, .15, .95, 8), bark, this.stockpile, x, y, z); log.rotation.x = Math.PI / 2;
        for (const sign of [-1, 1]) { const end = mesh(new THREE.CircleGeometry(.13, 8), barkLight, this.stockpile, x, y, z + sign * .48); end.rotation.y = sign < 0 ? Math.PI : 0; }
        // A well-run larder, not a garbage dump: the stack is kept off the wet ground.
        if (isGoblin && i < 8) mesh(new THREE.CylinderGeometry(.05, .05, 1.15, 5), barkLight, this.stockpile, x, y - .19, z).rotation.x = Math.PI / 2;
      }
    }

    this.controls.update(); this.renderer.render(this.scene, this.camera);
  }

  /** Screen position and progress of the villager currently swinging an axe. */
  workBadge(alpha = 1): WorkBadge | null {
    const villager = this.world.villagers.find(v => v.activity.kind === 'work');
    if (!villager || villager.activity.kind !== 'work') return null;
    const at = this.placeOf(villager, alpha);
    const point = new THREE.Vector3(at.x, elevation(at.x, at.z) + 1.8, at.z).project(this.camera);
    return { x: (point.x * .5 + .5) * innerWidth, y: (-.5 * point.y + .5) * innerHeight, progress: Math.min(1, villager.activity.progress / villager.activity.duration) };
  }
}
