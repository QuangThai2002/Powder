(()=>{'use strict';
if(window.POWDER_SCENE_TRANSITION_V21012)return;
const VERSION='21.0.12',root=document.documentElement;
const PRIORITY={high:0,normal:1,low:2};
const backgrounds={home:'assets/backgrounds/bg-home.webp',inventory:'assets/backgrounds/bg-inventory-crystal-sanctuary.webp',gear:'assets/backgrounds/bg-gear-grand-armory.webp',shop:'assets/backgrounds/bg-shop-arcane-market.webp',learn:'assets/backgrounds/bg-learning-arcane-academy.webp',adventure:'assets/backgrounds/bg-adventure-crystal-plaza.webp',boss:'assets/backgrounds/bg-boss-abyss-portal.webp',battle:'assets/backgrounds/bg-battle-legend-cloud-arena.webp',chests:'assets/backgrounds/bg-chests-pow-hatchery.webp',powdex:'assets/backgrounds/bg-powdex-arcane-library.webp',tamer:'assets/backgrounds/bg-tamer-rank-hall.webp'};
const nearby={home:['inventory','gear','learn'],inventory:['gear','powdex','home'],gear:['inventory','shop'],shop:['chests','gear'],learn:['adventure','boss'],adventure:['boss','battle'],boss:['battle','adventure'],battle:['boss','adventure'],chests:['powdex','shop'],powdex:['inventory','chests'],tamer:['home','learn']};
let generation=0,currentView='',pressure=root.dataset.resourcePressure||'calm',pumpHandle=0,assetInFlight=0,taskSeq=0,firstPaintPending=false;
let transitions=0,scheduled=0,executed=0,cancelled=0,coalesced=0,pressureSkips=0,assetQueued=0,assetStarted=0,assetCompleted=0,assetErrors=0,assetAborted=0,firstPaints=0,lastFirstPaintMs=0;
const tasks=[],assetQueue=[],taskKeys=new Map(),assetKeys=new Map(),resident=new Map(),inflight=new Map();
const now=()=>performance.now(),activeView=()=>document.body?.dataset?.activeView||currentView||'';
const pressureBlocked=optional=>optional&&(pressure==='hot'||pressure==='critical');
function cap(){return pressure==='calm'?2:pressure==='warm'?1:0}
function trimResident(){if(resident.size<=72)return;for(const [k] of [...resident.entries()].sort((a,b)=>a[1]-b[1]).slice(0,resident.size-56))resident.delete(k)}
function cancelStale(nextGeneration){
  for(let i=tasks.length-1;i>=0;i--){const t=tasks[i];if(!t.sticky&&t.generation<nextGeneration){tasks.splice(i,1);if(t.key)taskKeys.delete(t.key);cancelled++}}
  for(let i=assetQueue.length-1;i>=0;i--){const a=assetQueue[i];if(!a.sticky&&a.generation<nextGeneration){assetQueue.splice(i,1);assetKeys.delete(a.url);cancelled++}}
  for(const [id,a] of inflight){if(!a.sticky&&a.generation<nextGeneration){try{a.controller.abort('stale-transition')}catch(_){}inflight.delete(id);assetInFlight=Math.max(0,assetInFlight-1);assetKeys.delete(a.url);assetAborted++}}
}
function begin(from,to){
  generation++;transitions++;currentView=String(to||'');cancelStale(generation);firstPaintPending=true;
  const started=now(),token={generation,view:currentView,from:String(from||''),started};
  root.dataset.sceneTransition='pending';root.dataset.sceneGeneration=String(generation);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token.generation!==generation)return;firstPaintPending=false;firstPaints++;lastFirstPaintMs=Math.round((now()-started)*100)/100;root.dataset.sceneTransition='settled';schedulePump()}));
  return token;
}
function validToken(token){return !token||Number(token.generation)===generation}
function schedule(fn,{priority='normal',optional=true,key='',token=null,sticky=false}={}){
  if(typeof fn!=='function'||!validToken(token))return 0;
  const gen=token?.generation??generation;
  if(key&&taskKeys.has(key)){const old=taskKeys.get(key),idx=tasks.findIndex(x=>x.id===old);if(idx>=0){tasks.splice(idx,1);coalesced++}taskKeys.delete(key)}
  const id=++taskSeq,t={id,fn,priority:PRIORITY[priority]??1,optional:optional!==false,key:String(key||''),generation:gen,sticky:!!sticky,created:now()};
  tasks.push(t);if(t.key)taskKeys.set(t.key,id);scheduled++;schedulePump();return id;
}
function nextTask(){tasks.sort((a,b)=>a.priority-b.priority||a.created-b.created);return tasks.shift()||null}
function taskBudget(){if(firstPaintPending)return 0;if(pressure==='critical'||pressure==='hot')return 1.4;if(pressure==='warm')return 3;return 6}
function pump(deadline){pumpHandle=0;if(document.hidden)return;const start=now(),budget=taskBudget();if(budget<=0){schedulePump();return}
  while(tasks.length){if(now()-start>=budget||deadline?.timeRemaining?.()<1)break;const t=nextTask();if(!t)break;if(t.key)taskKeys.delete(t.key);if(!t.sticky&&t.generation!==generation){cancelled++;continue}if(pressureBlocked(t.optional)){pressureSkips++;continue}try{t.fn();executed++}catch(err){console.warn('[Powder 21.0.12 scheduled task]',err)}}
  pumpAssets();if(tasks.length||assetQueue.length)schedulePump();
}
function schedulePump(){if(pumpHandle||document.hidden)return;if(firstPaintPending){pumpHandle=requestAnimationFrame(()=>{pumpHandle=0;schedulePump()});return}if(window.requestIdleCallback)pumpHandle=requestIdleCallback(pump,{timeout:pressure==='calm'?350:180});else pumpHandle=setTimeout(()=>pump(null),pressure==='calm'?24:48)}
function normalizeUrl(url){try{const u=new URL(String(url||''),location.href);if(u.origin!==location.origin)return'';return u.href}catch(_){return''}}
function prefetch(url,{priority='low',view=currentView,key='',token=null,sticky=false}={}){
  const href=normalizeUrl(url);if(!href||!validToken(token))return false;if(resident.has(href)||assetKeys.has(href))return true;
  if(pressureBlocked(true)){pressureSkips++;return false}
  const item={id:++taskSeq,url:href,priority:PRIORITY[priority]??2,generation:token?.generation??generation,view:String(view||''),key:String(key||''),sticky:!!sticky,created:now()};
  assetQueue.push(item);assetKeys.set(href,item.id);assetQueued++;schedulePump();return true;
}
function pumpAssets(){const limit=cap();if(!limit||firstPaintPending||document.hidden)return;assetQueue.sort((a,b)=>a.priority-b.priority||a.created-b.created);
  while(assetInFlight<limit&&assetQueue.length){const a=assetQueue.shift();if(!a){break}if(!a.sticky&&a.generation!==generation){assetKeys.delete(a.url);cancelled++;continue}if(pressureBlocked(true)){assetKeys.delete(a.url);pressureSkips++;continue}
    const controller=new AbortController();assetInFlight++;assetStarted++;inflight.set(a.id,{...a,controller});
    fetch(a.url,{cache:'force-cache',credentials:'same-origin',signal:controller.signal}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);resident.set(a.url,Date.now());trimResident();assetCompleted++}).catch(err=>{if(err?.name==='AbortError'||controller.signal.aborted)assetAborted++;else assetErrors++}).finally(()=>{inflight.delete(a.id);assetInFlight=Math.max(0,assetInFlight-1);assetKeys.delete(a.url);schedulePump()})
  }
}
function warmNearby(view,token){if(pressure!=='calm'||!validToken(token))return;const views=nearby[view]||[];for(const [i,v] of views.slice(0,2).entries()){const u=backgrounds[v];if(u)prefetch(u,{priority:i?'low':'normal',view,key:`bg:${v}`,token})}}
function afterView({token=null,view='',preload=null,polish=null}={}){if(!validToken(token))return false;const v=String(view||currentView||'');
  schedule(()=>{try{polish?.()}finally{window.dispatchEvent(new CustomEvent('powder:scene-first-maintenance',{detail:{view:v,generation:token?.generation??generation}}))}},{priority:'normal',optional:true,key:`polish:${v}`,token});
  schedule(()=>preload?.(),{priority:'low',optional:true,key:`preload:${v}`,token});
  schedule(()=>warmNearby(v,token),{priority:'low',optional:true,key:`nearby:${v}`,token});return true}
function scheduleMaintenance({view='',preload=null,polish=null}={}){const v=String(view||activeView());
  schedule(()=>polish?.(),{priority:'low',optional:true,key:`maintenance:polish:${v}`});schedule(()=>preload?.(),{priority:'low',optional:true,key:`maintenance:preload:${v}`});return true}
function onPressure(e){pressure=String(e?.detail?.level||root.dataset.resourcePressure||'calm');if(pressure==='hot'||pressure==='critical'){for(let i=assetQueue.length-1;i>=0;i--){assetKeys.delete(assetQueue[i].url);assetQueue.splice(i,1);pressureSkips++}}schedulePump()}
function onVisibility(){if(document.hidden){if(pumpHandle){try{cancelIdleCallback?.(pumpHandle)}catch(_){}clearTimeout(pumpHandle);try{cancelAnimationFrame(pumpHandle)}catch(_){}pumpHandle=0}}else schedulePump()}
function diagnostics(){return{version:VERSION,generation,currentView:activeView(),pressure,firstPaintPending,transitions,scheduled,executed,cancelled,coalesced,pressureSkips,taskQueued:tasks.length,assetQueued:assetQueue.length,assetInFlight,assetStarted,assetCompleted,assetErrors,assetAborted,resident:resident.size,firstPaints,lastFirstPaintMs}}
function debugReset(){for(const [,a] of inflight)try{a.controller.abort('debug-reset')}catch(_){}inflight.clear();assetInFlight=0;tasks.length=0;assetQueue.length=0;taskKeys.clear();assetKeys.clear();return diagnostics()}
window.addEventListener('powder:resource-pressure',onPressure,{passive:true});document.addEventListener('visibilitychange',onVisibility,{passive:true});
window.POWDER_SCENE_TRANSITION_V21012={version:VERSION,begin,afterView,scheduleMaintenance,schedule,prefetch,snapshot:diagnostics,debugReset};
})();
