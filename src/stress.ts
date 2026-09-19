import './stress.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStressWorld, deserializeStress, hashStress, retarget, serializeStress, stepStress, type StressWorld } from './stress-simulation';
document.title = 'Little Island — technical proving ground';

type Settings = { trees:number; agents:number; shadows:boolean; paused:boolean; autoOrbit:boolean };
const query = new URLSearchParams(location.search);
const scenario = query.get('scenario') ?? 'balanced';
const presets: Record<string, Pick<Settings,'trees'|'agents'>> = {
  render:{trees:25000,agents:50}, agents:{trees:1000,agents:1000}, balanced:{trees:10000,agents:500}, soak:{trees:5000,agents:500}
};
const selectedPreset = presets[scenario] ?? presets.balanced;
const clamp=(value:string|null,fallback:number,max:number)=>Math.max(0,Math.min(max,Number(value) || fallback));
const settings:Settings={trees:clamp(query.get('trees'),selectedPreset.trees,50000),agents:clamp(query.get('agents'),selectedPreset.agents,5000),shadows:query.get('shadows')==='1',paused:false,autoOrbit:true};

document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<main class="lab-shell"><canvas id="lab-world"></canvas>
  <header class="lab-header"><div><a href="./">← LITTLE ISLAND</a><span>TECHNICAL PROVING GROUND</span></div><div class="live"><i></i> LIVE BENCHMARK</div></header>
  <section class="lab-intro"><div class="kicker">SCENARIO / ${scenario.toUpperCase()}</div><h1>How much island<br>can a browser hold?</h1><p>Instanced forest, simulation-only workers, picking, deterministic saves, and live frame budgets.</p></section>
  <aside class="lab-panel">
    <div class="panel-head"><span>PRESSURE CONTROLS</span><button id="collapse" aria-label="Collapse panel">−</button></div>
    <label>Trees <output id="tree-out">${settings.trees.toLocaleString()}</output><input id="trees" type="range" min="0" max="50000" step="500" value="${settings.trees}"></label>
    <label>Workers <output id="agent-out">${settings.agents.toLocaleString()}</output><input id="agents" type="range" min="0" max="5000" step="50" value="${settings.agents}"></label>
    <div class="toggles"><button id="pause">Pause</button><button id="burst">Path burst</button><button id="roundtrip">Save ↔ load</button></div>
    <label class="check"><input id="shadows" type="checkbox" ${settings.shadows?'checked':''}><span></span> Dynamic shadows</label>
    <label class="check"><input id="orbit" type="checkbox" checked><span></span> Auto orbit</label>
    <div class="presets"><a href="?lab&scenario=balanced">Balanced</a><a href="?lab&scenario=render">Render cliff</a><a href="?lab&scenario=agents">Agent load</a><a href="?lab&scenario=soak">Soak</a></div>
  </aside>
  <section class="metrics">
    <div class="metric hero"><span>FRAME RATE</span><strong id="fps">—</strong><small>FPS</small><i id="budget"></i></div>
    <div class="metric"><span>P95 FRAME</span><strong id="p95">—</strong><small>MS</small></div>
    <div class="metric"><span>SIMULATION</span><strong id="sim">—</strong><small>MS / TICK</small></div>
    <div class="metric"><span>DRAW CALLS</span><strong id="draws">—</strong><small>PER FRAME</small></div>
    <div class="metric"><span>TRIANGLES</span><strong id="triangles">—</strong><small>PER FRAME</small></div>
    <div class="metric"><span>SAVE / LOAD</span><strong id="save">—</strong><small id="save-size">NOT RUN</small></div>
    <div class="metric"><span>PICK LATENCY</span><strong id="pick">—</strong><small>MS</small></div>
    <div class="metric"><span>STATE HASH</span><strong id="hash">—</strong><small>DETERMINISTIC</small></div>
  </section>
  <div class="lab-note" id="note">Drag to orbit · move across the forest to test picking</div>
</main>`.replaceAll('\n+','\n');

const $=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const canvas=$<HTMLCanvasElement>('#lab-world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene3=new THREE.Scene();scene3.background=new THREE.Color('#abcac1');scene3.fog=new THREE.Fog('#abcac1',45,110);
const camera=new THREE.PerspectiveCamera(42,1,.1,180);camera.position.set(27,27,33);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,0);controls.enableDamping=true;controls.dampingFactor=.06;controls.maxPolarAngle=Math.PI*.47;controls.minDistance=8;controls.maxDistance=75;
scene3.add(new THREE.HemisphereLight('#fff8df','#668b79',2.2));
const sun=new THREE.DirectionalLight('#ffe7b2',2.5);sun.position.set(-18,30,22);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25});scene3.add(sun);
const water=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshStandardMaterial({color:'#76afa5',roughness:.45,metalness:.04}));water.rotation.x=-Math.PI/2;water.position.y=-.36;scene3.add(water);
const island=new THREE.Mesh(new THREE.CylinderGeometry(21,22,.7,96),new THREE.MeshStandardMaterial({color:'#9faf64',roughness:1,flatShading:true}));island.scale.z=.74;island.position.y=-.05;island.receiveShadow=true;scene3.add(island);

let world:StressWorld=createStressWorld(settings.agents);let forest=new THREE.Group(),workers=new THREE.Group();scene3.add(forest,workers);
let trunks:THREE.InstancedMesh|null=null,crowns:THREE.InstancedMesh|null=null,people:THREE.InstancedMesh|null=null;
const dummy=new THREE.Object3D(),rng=(seed:number)=>{let s=seed;return()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296)};
function disposeGroup(group:THREE.Group){group.traverse(object=>{if(!(object instanceof THREE.Mesh))return;object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials)material.dispose();});}
function rebuildForest(){scene3.remove(forest);disposeGroup(forest);forest.clear();forest=new THREE.Group();scene3.add(forest);const random=rng(73);
  trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.16,1.25,5),new THREE.MeshStandardMaterial({color:'#795139',roughness:1,flatShading:true}),settings.trees);
  crowns=new THREE.InstancedMesh(new THREE.ConeGeometry(.68,1.65,6),new THREE.MeshStandardMaterial({color:'#638a47',roughness:1,flatShading:true}),settings.trees);
  for(let i=0;i<settings.trees;i++){const a=random()*Math.PI*2,r=2.6+Math.sqrt(random())*17.5,x=Math.cos(a)*r,z=Math.sin(a)*r*.72,s=.6+random()*.75;
    dummy.position.set(x,.6*s,z);dummy.scale.setScalar(s);dummy.rotation.set(0,random()*Math.PI,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    dummy.position.y=1.65*s;dummy.rotation.y+=.4;dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);}
  for(const mesh of [trunks,crowns]){mesh.castShadow=settings.shadows;mesh.receiveShadow=settings.shadows;forest.add(mesh);} }
function rebuildWorkers(){scene3.remove(workers);disposeGroup(workers);workers.clear();workers=new THREE.Group();scene3.add(workers);world=createStressWorld(settings.agents);
  people=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.12,.34,2,5),new THREE.MeshStandardMaterial({color:'#de7e52',roughness:1}),settings.agents);people.castShadow=settings.shadows;workers.add(people);updateWorkers();}
function updateWorkers(){if(!people)return;for(let i=0;i<world.agents.length;i++){const a=world.agents[i];dummy.position.set(a.x,.55,a.z);dummy.scale.setScalar(i%11===0?1.18:1);dummy.rotation.set(0,Math.atan2(a.targetX-a.x,a.targetZ-a.z),0);dummy.updateMatrix();people.setMatrixAt(i,dummy.matrix);}people.instanceMatrix.needsUpdate=true;}
function shadows(){renderer.shadowMap.enabled=settings.shadows;sun.castShadow=settings.shadows;rebuildForest();if(people)people.castShadow=settings.shadows;}
rebuildForest();rebuildWorkers();shadows();

function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}resize();addEventListener('resize',resize);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pickMs=0;
canvas.addEventListener('pointermove',event=>{if(event.buttons||!crowns)return;const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);const start=performance.now();raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(crowns,false)[0];pickMs=performance.now()-start;canvas.style.cursor=hit?'crosshair':'grab';});

const frames:number[]=[],simSamples:number[]=[];let last=performance.now(),metricAt=last,saveLabel='—',saveSize='NOT RUN',soakRoundTrips=0;
function roundTrip(){const start=performance.now(),before=hashStress(world),raw=serializeStress(world);const restored=deserializeStress(raw);const after=hashStress(restored);world=restored;const elapsed=performance.now()-start;saveLabel=`${elapsed.toFixed(1)}`;saveSize=`${(raw.length/1024).toFixed(1)} KB · ${before===after?'EXACT':'MISMATCH'}`;soakRoundTrips++;}
function updateMetrics(now:number){const recent=[...frames].sort((a,b)=>a-b),p95=recent[Math.floor(recent.length*.95)]??0,avg=frames.reduce((a,b)=>a+b,0)/Math.max(1,frames.length);
  $('#fps').textContent=(1000/avg).toFixed(0);$('#p95').textContent=p95.toFixed(1);$('#sim').textContent=(simSamples.reduce((a,b)=>a+b,0)/Math.max(1,simSamples.length)).toFixed(2);
  $('#draws').textContent=renderer.info.render.calls.toLocaleString();$('#triangles').textContent=renderer.info.render.triangles.toLocaleString();$('#save').textContent=saveLabel;$('#save-size').textContent=saveSize;$('#pick').textContent=pickMs.toFixed(2);$('#hash').textContent=hashStress(world);
  const budget=$('#budget');budget.className=avg<=16.7?'good':avg<=33?'warn':'bad';budget.title=avg<=16.7?'Within 60 FPS budget':avg<=33?'Within 30 FPS budget':'Over frame budget';
  frames.length=0;simSamples.length=0;metricAt=now;}
function frame(now:number){const dt=Math.min((now-last)/1000,.1);last=now;frames.push(dt*1000);if(!settings.paused){const start=performance.now();stepStress(world,dt);simSamples.push(performance.now()-start);updateWorkers();}
  if(settings.autoOrbit){const angle=now*.000045;camera.position.x=Math.cos(angle)*42;camera.position.z=Math.sin(angle)*42;camera.position.y=27;controls.target.set(0,0,0);}controls.update();renderer.render(scene3,camera);
  if(now-metricAt>1000)updateMetrics(now);if(scenario==='soak'&&Math.floor(world.time)%10===0&&world.time>soakRoundTrips*10)roundTrip();requestAnimationFrame(frame);}requestAnimationFrame(frame);

function bindRange(id:string,key:'trees'|'agents',rebuild:()=>void){const input=$<HTMLInputElement>(`#${id}`),out=$<HTMLOutputElement>(`#${id==='trees'?'tree-out':'agent-out'}`);input.oninput=()=>{settings[key]=Number(input.value);out.value=settings[key].toLocaleString()};input.onchange=rebuild;}
bindRange('trees','trees',rebuildForest);bindRange('agents','agents',rebuildWorkers);
$('#pause').onclick=()=>{settings.paused=!settings.paused;$('#pause').textContent=settings.paused?'Resume':'Pause'};$('#burst').onclick=()=>{const start=performance.now();retarget(world);$('#note').textContent=`Retargeted ${world.agents.length.toLocaleString()} workers in ${(performance.now()-start).toFixed(2)} ms`};$('#roundtrip').onclick=roundTrip;
$<HTMLInputElement>('#shadows').onchange=e=>{settings.shadows=(e.target as HTMLInputElement).checked;shadows()};$<HTMLInputElement>('#orbit').onchange=e=>settings.autoOrbit=(e.target as HTMLInputElement).checked;
$('#collapse').onclick=()=>document.body.classList.toggle('panel-closed');
