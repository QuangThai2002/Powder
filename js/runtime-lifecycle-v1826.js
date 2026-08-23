(()=>{'use strict';
const VERSION='18.2.6';
let cleanupTimer=0,idleHandle=0,cleanups=0,removed=0,mediaPaused=0,gpuHintsCleared=0,lastView='',lastSweep=0,modalObserver=null;
const $=s=>document.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],DOM=()=>window.POWDER_DOM_RUNTIME_V1825,IMG=()=>window.POWDER_IMAGE_RUNTIME_V1826;
const now=()=>Date.now();
function clearSchedule(){clearTimeout(cleanupTimer);cleanupTimer=0;const d=DOM();if(d){d.cancelIdle?.('runtime-lifecycle');idleHandle=0;return}if(idleHandle&&window.cancelIdleCallback){try{cancelIdleCallback(idleHandle)}catch(_){}idleHandle=0}}
function clearTransient(root=document){let n=0;root.querySelectorAll?.('.fx-ripple,.view-vfx-enter.is-orphan,[data-vfx-transient="true"]').forEach(x=>{x.remove();n++});removed+=n;return n}
function pauseHiddenMedia(){let n=0;$$('.view[hidden] audio,.view[hidden] video,.modal[hidden] audio,.modal[hidden] video').forEach(el=>{try{if(!el.paused){el.pause();n++}}catch(_){}});mediaPaused+=n;return n}
function demoteHiddenGpuHints(){let n=0;$$('.view[hidden] [style*="will-change"],.modal[hidden] [style*="will-change"]').forEach(el=>{if(el.closest('#battleView,#summonModal'))return;try{if(el.style.willChange&&el.style.willChange!=='auto'){el.style.willChange='auto';n++}}catch(_){}});gpuHintsCleared+=n;return n}
function cleanupHeavyModals(){
  const pow=$('#powModal'),body=$('#powModalBody');
  if(pow?.hidden&&body?.childElementCount){body.replaceChildren();delete body.dataset.enhancedPowId;cleanups++}
  const summon=$('#summonModal');
  if(summon?.hidden){const seq=$('#summonSequence'),reveal=$('#summonReveal'),art=$('#summonArt'),stars=$('#summonStars');if(seq?.childElementCount){seq.replaceChildren();cleanups++}if(reveal?.childElementCount){reveal.replaceChildren();cleanups++}if(art?.childElementCount)art.replaceChildren();if(stars?.childElementCount)stars.replaceChildren();window.POWBALL_SYSTEM?.suspendAudio?.(5000)}
  if(document.hidden){try{speechSynthesis?.cancel?.()}catch(_){}}
  clearTransient();pauseHiddenMedia();demoteHiddenGpuHints();IMG()?.evictHidden?.(document.hidden?64:32);lastSweep=now();
}
function sweepLongSession(){
  if(document.hidden){cleanupHeavyModals();return}
  const active=document.querySelector('.view:not([hidden])');
  document.documentElement.dataset.runtimeView=document.body?.dataset?.activeView||lastView||'';
  // 18.2.6: image priority/decode/texture eviction is owned by the dedicated image runtime.
  if(active)IMG()?.prioritize?.(active);
  clearTransient();pauseHiddenMedia();demoteHiddenGpuHints();IMG()?.evictHidden?.(document.hidden?64:32);lastSweep=now();
}
function scheduleCleanup(delay=700){clearSchedule();cleanupTimer=setTimeout(()=>{cleanupTimer=0;const run=()=>{idleHandle=0;cleanupHeavyModals();sweepLongSession()};const d=DOM();if(d){idleHandle=d.idle?.('runtime-lifecycle',run,900)||0}else if(window.requestIdleCallback)idleHandle=requestIdleCallback(run,{timeout:900});else run()},delay)}
function onView(e){lastView=e?.detail?.view||document.body?.dataset?.activeView||'';document.documentElement.dataset.runtimeView=lastView;scheduleCleanup(350)}
function onModalMutation(records){let closed=false;for(const r of records){if(r.target?.hidden)closed=true}if(closed)scheduleCleanup(300);else clearSchedule()}
function installModalObserver(){if(!window.MutationObserver)return;modalObserver=new MutationObserver(onModalMutation);$$('.modal').forEach(el=>modalObserver.observe(el,{attributes:true,attributeFilter:['hidden']}))}
function diagnostics(){return{version:VERSION,activeView:document.body?.dataset?.activeView||lastView,cleanupRuns:cleanups,transientRemoved:removed,mediaPaused,gpuHintsCleared,lastSweep,openModals:$$('.modal:not([hidden])').length,hiddenViews:$$('.view[hidden]').length,hiddenImages:$$('.view[hidden] img').length,powBallAudio:window.POWBALL_SYSTEM?.audioState?.()||'unknown',domRuntime:DOM()?.diagnostics?.()||null,imageRuntime:IMG()?.diagnostics?.()||null}}
function visibility(){if(document.hidden){clearSchedule();try{speechSynthesis?.cancel?.()}catch(_){}window.POWBALL_SYSTEM?.suspendAudio?.();cleanupHeavyModals()}else scheduleCleanup(350)}
function teardown(){clearSchedule();try{modalObserver?.disconnect?.()}catch(_){}modalObserver=null;try{window.POWBALL_SYSTEM?.suspendAudio?.()}catch(_){}cleanupHeavyModals()}
function boot(){installModalObserver();window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('pagehide',teardown,{once:true});document.addEventListener('visibilitychange',visibility,{passive:true});window.addEventListener('online',()=>scheduleCleanup(700),{passive:true});lastView=document.body?.dataset?.activeView||'';window.POWDER_RUNTIME_LIFECYCLE_V1826={diagnostics,cleanup:cleanupHeavyModals,sweep:sweepLongSession};window.POWDER_RUNTIME_LIFECYCLE_V1825=window.POWDER_RUNTIME_LIFECYCLE_V1826;window.POWDER_RUNTIME_LIFECYCLE_V1824=window.POWDER_RUNTIME_LIFECYCLE_V1826;window.POWDER_RUNTIME_LIFECYCLE_V1823=window.POWDER_RUNTIME_LIFECYCLE_V1826;scheduleCleanup(1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
