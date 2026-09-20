/**
 * Everything Three.js. The scene reads the simulation and never writes to it:
 * given the same world, it draws the same picture. Positions are interpolated
 * between simulation ticks so a 30 Hz world moves smoothly on a 60 Hz screen.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HOME, elapsedSeconds, elevation, nextRandom, tuning, type Villager, type World } from './sim/index.ts';

const mat = (color: string | number, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
const bark = mat('#845335'), barkLight = mat('#c58d58'), leaf = [mat('#72933f'), mat('#8aab4b'), mat('#4f7e48'), mat('#a6b95b')];
const seeded = (seed: number) => { const state = { seed }; return () => nextRandom(state); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
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
  treeGroups = new Map<number, THREE.Group>(); treeCrowns = new Map<number, THREE.Group>(); pickables: THREE.Object3D[] = [];
  rigs = new Map<number, PersonRig>();
  hoverRing: THREE.Mesh; orderRings: THREE.Mesh[] = []; stockpile = new THREE.Group(); lastLogs = -1;
  water: THREE.Mesh; raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2(); world: World;
  dust: THREE.Points; dustPositions = new Float32Array(54); hovered: number | null = null;

  constructor(canvas: HTMLCanvasElement, world: World) {
    this.world = world; this.scene.background = new THREE.Color('#b9d4ca'); this.scene.fog = new THREE.Fog('#b9d4ca', 65, 160);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(37, 1, .1, 220); this.camera.position.set(29, 30, 37);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.target.set(0, 1, 0); this.controls.enableDamping = true; this.controls.dampingFactor = .055; this.controls.minDistance = 9; this.controls.maxDistance = 65; this.controls.maxPolarAngle = Math.PI * .43; this.controls.minPolarAngle = .2; this.controls.enablePan = true; this.controls.maxTargetRadius = 12;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.scene.add(new THREE.HemisphereLight('#fff7dd', '#7e9d86', 1.7));
    const sun = new THREE.DirectionalLight('#fff0c4', 2.8); sun.position.set(-22, 36, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: .5, far: 90 }); sun.shadow.normalBias = .03; sun.shadow.bias = -.0002; sun.shadow.radius = 4; this.scene.add(sun);
    this.water = mesh(new THREE.PlaneGeometry(400, 400, 1, 1), new THREE.MeshStandardMaterial({ color: '#84b9ad', roughness: .34, metalness: .07 }), this.scene, 0, -.15, 0); this.water.rotation.x = -Math.PI / 2; this.water.receiveShadow = false;
    this.buildIsland(); this.buildTrees(); this.scene.add(this.stockpile);
    this.hoverRing = this.buildRing('#fffbe8', .95, .77, .87);
    // Marked-for-felling rings read as a warm amber, darker than the grass rather than lighter.
    this.orderRings = Array.from({ length: tuning.MAX_JOBS_PER_VILLAGER }, () => this.buildRing('#c8802c', .95, .72, .86));
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3)); this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#e3bc77', size: .11, transparent: true, opacity: .8 })); this.scene.add(this.dust);
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
      pos.push(x, y, z); color.set(r >= rings - 1 ? '#d9c991' : r === rings - 2 ? '#b6bc73' : '#a3b968'); color.multiplyScalar(.94 + rng() * .12); colors.push(color.r, color.g, color.b);
      if (r < rings) { const k = r * segments + i, n = r * segments + (i + 1) % segments; indices.push(k, n, k + segments, n, n + segments, k + segments); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals();
    // Top triangles are wound counterclockwise as seen from above.
    const landMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.FrontSide }); mesh(g, landMat, this.scene);
    // Quiet shore ribbons, delicate enough to leave the island silhouette readable.
    for (let k = 0; k < 3; k++) {
      const points: THREE.Vector3[] = []; for (let i = 0; i <= segments; i++) { const a = i / segments * Math.PI * 2, ir = 1 + .035 * Math.sin(a * 5) + .025 * Math.sin(a * 9); points.push(new THREE.Vector3(Math.cos(a) * (15.6 + k * .38) * ir, -.10 + k * .005, Math.sin(a) * (12.6 + k * .38) * ir)); }
      const ribbon = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#e1eee1', transparent: true, opacity: .25 - k * .055 })); this.scene.add(ribbon);
    }
    const clearing = mesh(new THREE.CircleGeometry(2.45, 48), mat('#c1bc83'), this.scene, HOME.x, elevation(HOME.x, HOME.z) + .025, HOME.z); clearing.rotation.x = -Math.PI / 2; clearing.scale.y = .83;
    for (let i = 0; i < 155; i++) {
      const x = (rng() - .5) * 29, z = (rng() - .5) * 22; if ((x / 14) ** 2 + (z / 11) ** 2 > .9 || Math.hypot(x - HOME.x, z - HOME.z) < 3) continue;
      const group = new THREE.Group(); group.position.set(x, elevation(x, z), z); this.scene.add(group);
      if (i % 7 === 0) { const rock = mesh(new THREE.DodecahedronGeometry(.23 + rng() * .3, 0), mat(i % 2 ? '#aaa994' : '#c4bca1'), group, 0, .14, 0); rock.scale.set(1, .55, .8); rock.rotation.set(rng(), rng(), 0); }
      else for (let j = 0; j < 3; j++) { const grass = mesh(new THREE.ConeGeometry(.06, .28 + rng() * .18, 3), mat(i % 3 ? '#869c4c' : '#c7c981'), group, (rng() - .5) * .24, .13, (rng() - .5) * .24); grass.rotation.z = (rng() - .5) * .55; }
      if (i % 8 === 0) for (let j = 0; j < 3; j++) mesh(new THREE.IcosahedronGeometry(.065, 0), mat('#f3dc9a'), group, (rng() - .5) * .45, .32, (rng() - .5) * .45);
    }
    const post = mesh(new THREE.CylinderGeometry(.045, .055, .68, 6), bark, this.scene, HOME.x + 1.85, elevation(HOME.x + 1.85, HOME.z) + .34, HOME.z - .6);
    mesh(new THREE.BoxGeometry(.52, .22, .055), mat('#e9d7a4'), post, .16, .2, 0).rotation.z = -.12;
  }

  buildTrees() {
    for (const t of this.world.trees) {
      const group = new THREE.Group(); group.position.set(t.x, elevation(t.x, t.z), t.z); group.scale.setScalar(t.scale); group.userData.treeId = t.id; this.scene.add(group); this.treeGroups.set(t.id, group);
      const stump = mesh(new THREE.CylinderGeometry(.17, .23, .25, 7), bark, group, 0, .125, 0); mesh(new THREE.CircleGeometry(.16, 7), barkLight, stump, 0, .127, 0).rotation.x = -Math.PI / 2;
      const crown = new THREE.Group(); group.add(crown); this.treeCrowns.set(t.id, crown);
      mesh(new THREE.CylinderGeometry(.12, .2, 1.7, 7), bark, crown, 0, .9, 0);
      if (t.kind === 0) { for (let j = 0; j < 3; j++) { const c = mesh(new THREE.ConeGeometry(1.04 - j * .2, 1.7 - j * .22, 7), leaf[(t.id + j) % 3], crown, 0, 1.7 + j * .66, 0); c.rotation.y = j * .6; } }
      else { for (let j = 0; j < 4; j++) { const c = mesh(new THREE.IcosahedronGeometry(.97, 1), leaf[(t.id + j) % 4], crown, Math.sin(j * 2.2) * .43, 2.05 + (j === 3 ? .57 : 0), Math.cos(j * 2.2) * .4); c.scale.y = 1.08; } }
      group.traverse(o => { if (o instanceof THREE.Mesh) { o.userData.treeId = t.id; this.pickables.push(o); } }); crown.visible = t.state === 'standing';
    }
  }

  buildPerson(): PersonRig {
    const skin = mat('#e5b47c'), shirt = mat('#cf744c'), pants = mat('#3e625c'), shoe = mat('#664d36'), hat = mat('#eed494');
    const rig: PersonRig = { group: new THREE.Group(), body: new THREE.Group(), leftLeg: new THREE.Group(), rightLeg: new THREE.Group(), leftArm: new THREE.Group(), rightArm: new THREE.Group(), axe: new THREE.Group(), carried: new THREE.Group() };
    rig.group.add(rig.body); rig.body.position.y = .62;
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
    rig.group.add(rig.carried); const log = mesh(new THREE.CylinderGeometry(.14, .16, .95, 8), bark, rig.carried, 0, .84, .38); log.rotation.z = Math.PI / 2;
    for (const x of [-.48, .48]) { const end = mesh(new THREE.CircleGeometry(.132, 8), barkLight, rig.carried, x, .84, .38); end.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; }
    rig.carried.visible = false; this.scene.add(rig.group); return rig;
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
    const hit = this.raycaster.intersectObjects(this.pickables).find(h => this.world.trees.find(t => t.id === h.object.userData.treeId)?.state === 'standing');
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
      const moving = activity.kind === 'travel', swinging = activity.kind === 'harvest', carrying = !!villager.carrying;
      const at = this.placeOf(villager, alpha);
      rig.group.position.set(at.x, elevation(at.x, at.z), at.z); rig.group.rotation.y = villager.facing;
      const pace = moving ? activity.speed / tuning.WALK_SPEED : 0;
      rig.body.position.y = .62 + (moving ? Math.sin(time * 15 * pace) * .035 : Math.sin(realTime * 2) * .015);
      rig.body.rotation.z = moving ? Math.sin(time * 7.5 * pace) * .035 : 0;
      rig.leftLeg.rotation.x = moving ? Math.sin(time * 15 * pace) * .55 : 0; rig.rightLeg.rotation.x = -rig.leftLeg.rotation.x;
      rig.leftArm.rotation.x = carrying ? -1.15 : moving ? -Math.sin(time * 15 * pace) * .5 : 0;
      rig.rightArm.rotation.x = swinging ? -1.2 + Math.sin(time * 9) * 1.2 : carrying ? -1.15 : moving ? Math.sin(time * 15 * pace) * .5 : 0;
      rig.axe.visible = !carrying; rig.carried.visible = carrying;
      if (activity.kind === 'harvest') { chopping.add(activity.treeId); const tree = world.trees.find(t => t.id === activity.treeId); if (tree) chopTarget = tree; }
    }

    for (const tree of world.trees) {
      const crown = this.treeCrowns.get(tree.id); if (!crown) continue;
      crown.visible = tree.state === 'standing';
      crown.rotation.z = Math.sin(realTime * 1.3 + tree.id) * .009;
      if (chopping.has(tree.id)) crown.rotation.z += Math.max(0, Math.sin(time * 9)) * .025;
    }

    // A ring on every tree with an order against it, plus one under the cursor.
    const ordered = world.jobs.flatMap(job => job.kind === 'harvest' && (job.state === 'queued' || job.state === 'assigned') ? [job.treeId] : []);
    this.orderRings.forEach((ring, index) => {
      const tree = index < ordered.length ? world.trees.find(t => t.id === ordered[index]) : undefined;
      ring.visible = !!tree && tree.state === 'standing';
      if (tree) { ring.position.set(tree.x, elevation(tree.x, tree.z) + .04, tree.z); ring.scale.setScalar(1 + Math.sin(realTime * 4 + index) * .04); }
    });
    const hover = this.hovered === null ? undefined : world.trees.find(t => t.id === this.hovered);
    this.hoverRing.visible = !!hover && hover.state === 'standing';
    if (hover) { this.hoverRing.position.set(hover.x, elevation(hover.x, hover.z) + .05, hover.z); this.hoverRing.scale.setScalar(1.06 + Math.sin(realTime * 4) * .04); }

    this.dust.visible = !!chopTarget;
    if (chopTarget) {
      for (let i = 0; i < 18; i++) {
        const age = (time * 1.6 + i / 18) % 1, angle = i * 2.4;
        this.dustPositions[i * 3] = chopTarget.x + Math.sin(angle) * age * .8;
        this.dustPositions[i * 3 + 1] = elevation(chopTarget.x, chopTarget.z) + .6 + age * .5 - age * age;
        this.dustPositions[i * 3 + 2] = chopTarget.z + Math.cos(angle) * age * .8;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    const logs = world.stockpile.stock.timber;
    if (this.lastLogs !== logs) {
      this.lastLogs = logs; this.stockpile.clear();
      for (let i = 0; i < Math.min(logs, 40); i++) {
        const x = HOME.x + 1 + (i % 4) * .31, y = elevation(HOME.x + 1, HOME.z) + .16 + Math.floor(i / 8) * .27, z = HOME.z + .45 + Math.floor(i % 8 / 4) * 1.1;
        const log = mesh(new THREE.CylinderGeometry(.14, .15, .95, 8), bark, this.stockpile, x, y, z); log.rotation.x = Math.PI / 2;
        for (const sign of [-1, 1]) { const end = mesh(new THREE.CircleGeometry(.13, 8), barkLight, this.stockpile, x, y, z + sign * .48); end.rotation.y = sign < 0 ? Math.PI : 0; }
      }
    }

    this.controls.update(); this.renderer.render(this.scene, this.camera);
  }

  /** Screen position and progress of the villager currently swinging an axe. */
  workBadge(alpha = 1): WorkBadge | null {
    const villager = this.world.villagers.find(v => v.activity.kind === 'harvest');
    if (!villager || villager.activity.kind !== 'harvest') return null;
    const at = this.placeOf(villager, alpha);
    const point = new THREE.Vector3(at.x, elevation(at.x, at.z) + 1.8, at.z).project(this.camera);
    return { x: (point.x * .5 + .5) * innerWidth, y: (-.5 * point.y + .5) * innerHeight, progress: Math.min(1, villager.activity.progress / villager.activity.duration) };
  }
}
