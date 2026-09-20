/**
 * The host: browser input, HUD, sound and saving. It owns no game logic.
 * Clicks become commands, ticks come back as events, and the HUD is written
 * from whatever the world says. Deleting this file would leave a working game
 * with no way to see it.
 */
import './style.css';
import {
  advance, alpha, createSimulation, createWorld, deserialize, elapsedSeconds, enqueue,
  jobForSite, openJobs, serialize, tick, type SimEvent,
} from './sim/index.ts';
import { IslandScene } from './scene.ts';
import { activeTheme, wearTheme } from './theme.ts';

const icons = {
  leaf:'<path d="M19 4C9 3 4 7 5 14c5 5 13 1 14-10Z"/><path d="m5 20 8-11"/>',
  wood:'<path d="m6 7 11-2c5 2 5 10 0 12L6 19"/><ellipse cx="6" cy="13" rx="4" ry="6"/><ellipse cx="6" cy="13" rx="1.5" ry="2.5"/>',
  pause:'<path d="M8 5v14M16 5v14"/>', play:'<path d="m8 5 11 7-11 7Z"/>',
  home:'<path d="m3 11 9-8 9 8M6 10v10h12V10M10 20v-6h4v6"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  muted:'<path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3v.1"/>',
  arrow:'<path d="m9 5 7 7-7 7"/>', tree:'<path d="m12 2-7 9h3l-5 6h18l-5-6h3ZM12 17v5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>', reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  // The fork's own mark: a cap with gills under it.
  fungus:'<path d="M4 10a8 5 0 0 1 16 0Z"/><path d="M9 10v6a3 3 0 0 0 6 0v-6"/>',
  swap:'<path d="M4 8h13l-3-3m6 11H7l3 3"/>',
};
const svg=(name:keyof typeof icons)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

const theme=activeTheme(),copy=theme.copy;
document.documentElement.dataset.theme=theme.id;
document.title=copy.documentTitle;
document.querySelector('meta[name=theme-color]')?.setAttribute('content',copy.themeColor);

const SAVE_KEY='little-island-v2';
let restored=null as ReturnType<typeof deserialize>;
try{const saved=localStorage.getItem(SAVE_KEY);if(saved)restored=deserialize(saved);}catch{/* Storage can be unavailable in private browsing. */}
const sim=createSimulation(restored??createWorld());
let paused=false,speed=1,sound=false,audio:AudioContext|undefined;

/* Every word on screen comes from the theme: the fork's HUD grumbles where the island's reassures. */
const mark=theme.id==='goblin'?'fungus':'leaf';
const row=([term,detail]:[string,string])=>`<div><dt>${term}</dt><dd>${detail}</dd></div>`;
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<canvas id="world" aria-label="${copy.canvasAria}"></canvas>
<div class="vignette"></div>
<header class="topbar"><a class="brand" href="#" aria-label="${copy.brandAria}"><span class="brand-mark">${svg(mark)}</span><span>${copy.brand}<small>${copy.brandSub}</small></span></a><div class="top-right"><div class="day"><span class="sun">✳</span><span>${copy.day}<small>${copy.daySub}</small></span></div><span class="divider"></span><div class="resource">${svg('wood')}<strong id="log-count">0</strong><span>${copy.ware}</span></div><button class="icon-button" id="help" title="How to play" aria-label="How to play">${svg('help')}</button></div></header>
<aside class="chapter"><div class="objective" id="objective"><span class="objective-icon">${svg('tree')}</span><div><strong>${copy.objectiveTitle}</strong><span id="objective-text">${copy.objectiveStart}</span></div></div></aside>
<div id="tooltip" class="tree-tooltip" hidden>${svg('tree')}<span id="tooltip-text">${copy.tooltipSelect}</span></div>
<div id="work-progress" class="work-progress" hidden><span>${copy.workLabel}</span><div><i></i></div></div>
<div class="toast" id="toast" role="status"></div>
<footer class="bottom"><div class="villager-card"><div class="portrait">${svg(mark)}</div><div><div class="villager-name">${copy.villager} <span>${copy.villagerRole}</span></div><div class="villager-status"><i id="status-dot"></i><span id="status">${copy.status.idle}</span></div></div><span class="card-divider"></span><button class="focus-button" id="focus" title="${copy.findVillager}" aria-label="${copy.findVillager}">${svg('home')}</button></div><div class="hint" id="hint"><span class="mouse-icon"></span><span>${copy.hint}</span></div><div class="controls"><button class="icon-button" id="pause" title="Pause simulation" aria-label="Pause simulation">${svg('pause')}</button><button class="speed" id="speed" title="Change simulation speed">1×</button><span class="divider"></span><button class="icon-button" id="sound" title="Enable gentle sound effects" aria-label="Enable sound effects">${svg('muted')}</button><button class="icon-button" id="theme" title="${copy.switchLabel}" aria-label="${copy.switchLabel}">${svg('swap')}</button><button class="icon-button" id="reset" title="Start a fresh island" aria-label="Start a fresh island">${svg('reset')}</button></div></footer>
<div class="camera-hint"><span>${copy.cameraHint[0]}</span><i>·</i><span>${copy.cameraHint[1]}</span><i>·</i><span>${copy.cameraHint[2]}</span></div>
<dialog id="help-dialog"><button class="dialog-close icon-button" aria-label="Close help">${svg('close')}</button><span class="dialog-leaf">${svg(mark)}</span><div class="eyebrow">${copy.help.eyebrow}</div><h2>${copy.help.heading}</h2><p>${copy.help.body}</p><dl>${copy.help.rows.map(row).join('')}</dl><p class="save-note">${copy.help.save}</p><button id="start" class="primary">${copy.help.start} ${svg('arrow')}</button></dialog>
<dialog id="reset-dialog"><div class="eyebrow">${copy.reset.eyebrow}</div><h2>${copy.reset.heading}</h2><p>${copy.reset.body}</p><div class="dialog-actions"><button class="secondary" id="cancel-reset">${copy.reset.keep}</button><button class="primary" id="confirm-reset">${copy.reset.confirm}</button></div></dialog>`;

const $=<T extends HTMLElement>(q:string)=>document.querySelector<T>(q)!;
const view=new IslandScene($<HTMLCanvasElement>('#world'),sim.world);

let toastTimer=0;
function toast(message:string){$('#toast').textContent=message;$('#toast').classList.add('visible');window.clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function note(freq:number,duration=.12){if(!sound)return;audio??=new AudioContext();void audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(freq,audio.currentTime);gain.gain.setValueAtTime(.055,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+duration);}
function save(){try{localStorage.setItem(SAVE_KEY,serialize(sim.world));}catch{/* The current session still works without storage. */}}

/* Input becomes commands. Nothing here changes the world directly. */
let down={x:0,y:0};const canvas=$<HTMLCanvasElement>('#world');
canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
canvas.addEventListener('pointermove',event=>{
  if(event.buttons)return;
  const id=view.pick(event.clientX,event.clientY);view.hovered=id;canvas.style.cursor=id===null?'grab':'pointer';
  const tip=$('#tooltip');tip.hidden=id===null;
  if(id!==null){$('#tooltip-text').textContent=jobForSite(sim.world,id)?copy.tooltipCancel:copy.tooltipSelect;tip.style.left=`${Math.min(innerWidth-190,event.clientX+18)}px`;tip.style.top=`${event.clientY-44}px`;}
});
canvas.addEventListener('pointerleave',()=>{$('#tooltip').hidden=true;view.hovered=null;});
canvas.addEventListener('pointerup',event=>{
  if(event.button!==0||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;
  const treeId=view.pick(event.clientX,event.clientY);if(treeId===null)return;
  enqueue(sim,jobForSite(sim.world,treeId)?{kind:'cancel-fell',siteId:treeId}:{kind:'order-fell',siteId:treeId});
});

function setPause(){paused=!paused;$('#pause').innerHTML=svg(paused?'play':'pause');$('#pause').setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');$('#pause').title=paused?'Resume simulation':'Pause simulation';$('#pause').classList.toggle('active',paused);}
$('#pause').onclick=setPause;$('#speed').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('#speed').textContent=`${speed}×`;};
$('#sound').onclick=()=>{sound=!sound;$('#sound').innerHTML=svg(sound?'sound':'muted');$('#sound').setAttribute('aria-label',sound?'Mute sound effects':'Enable sound effects');$('#sound').title=sound?'Mute sound effects':'Enable sound effects';note(523,.2);};
$('#theme').onclick=()=>wearTheme(copy.switchTo);
$('#focus').onclick=()=>view.focusVillager();$('.brand').onclick=e=>{e.preventDefault();view.resetCamera();};
const help=$<HTMLDialogElement>('#help-dialog'),reset=$<HTMLDialogElement>('#reset-dialog');
$('#help').onclick=()=>help.showModal();$('.dialog-close').onclick=()=>help.close();$('#start').onclick=()=>help.close();
$('#reset').onclick=()=>reset.showModal();$('#cancel-reset').onclick=()=>reset.close();
$('#confirm-reset').onclick=()=>{sim.world=createWorld();sim.accumulator=0;view.world=sim.world;view.hovered=null;view.lastLogs=-1;save();reset.close();toast(copy.toastFresh);};
window.addEventListener('keydown',event=>{if(event.code==='Space'&&!help.open&&!reset.open&&!(event.target instanceof HTMLButtonElement)){event.preventDefault();setPause();}if(event.key==='Escape'){$('#tooltip').hidden=true;}});
window.addEventListener('pagehide',save);setInterval(save,5000);

const REJECTIONS=copy.rejections;

/* Events, not state diffs, drive sound and messages. */
function react(events:SimEvent[]){
  for(const event of events){
    if(event.kind==='order-queued'){note(440);if(paused)toast(copy.toastPaused);}
    else if(event.kind==='order-cancelled'){note(392,.1);toast(copy.toastCancelled);}
    else if(event.kind==='order-rejected')toast(REJECTIONS[event.reason]);
    else if(event.kind==='work-stroke')note(150,.05);
    else if(event.kind==='site-spent')note(196,.22);
    else if(event.kind==='ware-delivered'){note(659,.25);toast(event.total===1?copy.toastFirst:copy.toastMore(event.total));save();}
  }
}

function describe():string{
  const villager=sim.world.villagers[0];
  if(paused)return copy.status.paused;
  if(villager.carrying)return copy.status.carrying;
  if(villager.activity.kind==='work')return copy.status.working;
  if(villager.activity.kind==='travel')return villager.activity.purpose==='roam'?copy.status.roaming:copy.status.walking;
  return copy.status.idle;
}

let previous=performance.now();
function frame(now:number){
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  // While paused the world still accepts orders, so markers appear the moment you click.
  react(paused?(sim.world.inbox.length?tick(sim.world):[]):advance(sim,dt*speed));
  view.update(now/1000,paused?1:alpha(sim));

  const world=sim.world,logs=world.stockpile.stock.log,waiting=openJobs(world).length,busy=world.villagers[0].jobId!==null;
  $('#log-count').textContent=String(logs);
  $('#status').textContent=describe();
  $('#status-dot').classList.toggle('working',busy);
  $('#objective-text').textContent=waiting>0?copy.objectiveWaiting(waiting)
    :logs>0?copy.objectiveStock(logs)
    :busy?copy.objectiveBusy:copy.objectiveStart;
  $('#hint').classList.toggle('done',busy||logs>0);
  const badge=view.workBadge(paused?1:alpha(sim)),progress=$('#work-progress');
  progress.hidden=!badge;
  if(badge){progress.style.transform=`translate(${badge.x}px, ${badge.y}px) translate(-50%,-100%)`;$<HTMLElement>('#work-progress i').style.width=`${badge.progress*100}%`;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// A hand-hold for playtesting from the console or a browser test.
Object.assign(window,{island:{sim,view,elapsedSeconds,theme}});
