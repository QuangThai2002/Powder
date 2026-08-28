(()=>{'use strict';
if(window.POWDER_COMBAT_ASSET_VFX_V2226)return;
const VERSION='22.2.6',CSS_ID='powderCombatAssetVfx2226Css';
const BASE='assets/combat/vfx/preview/';
const ASSETS=[
  'vfx-elements-a.webp','wind-impact.webp','lightning-impact.webp','lava-impact.webp','storm-impact.webp','ice-impact.webp','poison-impact.webp','light-impact.webp','dark-impact.webp',
  'status-burn.webp','status-freeze.webp','status-stun.webp','status-heal.webp','status-shield.webp'
].map(x=>BASE+x);
const state={mounts:0,syncs:0,syncRequests:0,coalescedSyncs:0,preloaded:0,failed:0,css:false,active:false,lastMountAt:0};
let mount=null,observer=null,bodyObserver=null,preloadPromise=null,syncRaf=0;
const visible=n=>Boolean(n?.isConnected&&!n.closest?.('[hidden]'));
function ensureCss(){
  let l=document.getElementById(CSS_ID);if(l){state.css=true;return l}
  l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';l.href='css/combat-asset-vfx-v2226.css?v=2226-img-img2-r1';
  l.onload=()=>{state.css=true;scheduleSync()};l.onerror=()=>{state.css=false};document.head.appendChild(l);return l;
}
function preloadOne(src){return new Promise(resolve=>{const im=new Image();im.decoding='async';im.onload=()=>{state.preloaded++;resolve(true)};im.onerror=()=>{state.failed++;resolve(false)};im.src=src})}
function preload(){if(preloadPromise)return preloadPromise;preloadPromise=Promise.all(ASSETS.map(preloadOne));return preloadPromise}
function pickMount(){const all=[...document.querySelectorAll('.combat-v7-mount')];return all.find(visible)||all[0]||null}
function cleanup(node){if(!node)return;node.classList.remove('cav226-ready');delete node.dataset.cav226Assets}
function attach(next){
  if(next===mount){syncNow();return}
  observer?.disconnect();cleanup(mount);mount=next;state.active=!!mount?.isConnected;if(!mount)return;
  state.mounts++;state.lastMountAt=Date.now();mount.classList.add('cav226-ready');mount.dataset.cav226Assets='img+img2';
  observer=new MutationObserver(scheduleSync);observer.observe(mount,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});syncNow();
}
function syncNow(){const next=pickMount();if(next!==mount){attach(next);return snapshot()}state.syncs++;state.active=!!mount?.isConnected;if(mount){mount.classList.add('cav226-ready');mount.dataset.cav226Assets='img+img2'}return snapshot()}
function scheduleSync(){
  state.syncRequests++;
  if(syncRaf){state.coalescedSyncs++;return snapshot()}
  syncRaf=requestAnimationFrame(()=>{syncRaf=0;syncNow()});return snapshot();
}
function stop(){
  if(syncRaf){cancelAnimationFrame(syncRaf);syncRaf=0}
  observer?.disconnect();bodyObserver?.disconnect();observer=null;bodyObserver=null;cleanup(mount);mount=null;state.active=false;
}
function snapshot(){return{version:VERSION,...state,active:!!mount?.isConnected,assetCount:ASSETS.length,sourceLibraries:['img','img2'],elements:13,statuses:5,mode:'main-combat-asset-first',syncMode:'raf-coalesced',assets:[...ASSETS]}}
function start(){ensureCss();preload();attach(pickMount());
  window.addEventListener('powder:combat-presentation-sync',scheduleSync,{passive:true});window.addEventListener('powder:resource-pressure',scheduleSync,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSync()},{passive:true});
  bodyObserver=new MutationObserver(scheduleSync);bodyObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('pagehide',stop,{once:true,passive:true});
  document.documentElement.dataset.combatAssetVfx='22.2.6';
}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
window.POWDER_COMBAT_ASSET_VFX_V2226={version:VERSION,snapshot,sync:scheduleSync,preload,assets:[...ASSETS]};
})();
