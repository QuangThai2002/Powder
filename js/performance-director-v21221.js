(()=>{'use strict';
if(window.POWDER_PERFORMANCE_DIRECTOR_V21221)return;
const VERSION='21.2.21',root=document.documentElement;
const state={updates:0,recoveryRequests:0,lastAt:0,lastReason:'boot',goalFps:60,currentFps:60,displayHz:60,headroom:1,status:'stable'};let timer=0,lastMeasure=0;
function hs(){try{return window.POWDER_HIGH_REFRESH_V21217?.snapshot?.()||{}}catch(_){return{}}}
function fb(){try{return window.POWDER_FRAME_BUDGET_V21218?.snapshot?.()||{}}catch(_){return{}}}
function cg(){try{return window.POWDER_COMBAT_REFRESH_GOVERNOR_V21219?.snapshot?.()||{}}catch(_){return{}}}
function sp(){try{return window.POWDER_SCROLL_PIPELINE_V21220?.snapshot?.()||{}}catch(_){return{}}}
function pressure(){return String(window.POWDER_ADAPTIVE_PRESSURE_V21011?.level?.()||root.dataset.resourcePressure||'calm')}
function collect(reason='event'){const h=hs(),hz=Math.max(60,Number(h.displayHz)||60),fps=Math.max(1,Number(h.currentFps)||Number(root.dataset.nativeFps)||60),head=fps/hz,p=pressure();state.updates++;state.lastAt=Date.now();state.lastReason=reason;state.goalFps=hz;state.currentFps=fps;state.displayHz=hz;state.headroom=Number(head.toFixed(3));state.status=p==='critical'||fps<48?'recovery':head>=.9?'native':fps>=58?'stable':'guard';root.dataset.performanceDirector=state.status;root.dataset.performanceGoalFps=String(Math.round(hz));root.dataset.performanceHeadroom=String(state.headroom);try{window.dispatchEvent(new CustomEvent('powder:performance-director',{detail:snapshot()}))}catch(_){}return snapshot()}
function requestRemeasure(reason='recovery'){const now=Date.now();if(document.hidden||now-lastMeasure<1800)return false;lastMeasure=now;state.recoveryRequests++;clearTimeout(timer);timer=setTimeout(()=>{timer=0;try{window.POWDER_HIGH_REFRESH_V21217?.measure?.()}catch(_){}collect(reason)},650);return true}
function snapshot(){return{version:VERSION,...state,pressure:pressure(),highRefresh:hs(),frameBudget:fb(),combatGovernor:cg(),scrollPipeline:sp(),policy:'60 FPS floor + native refresh ceiling; event-driven recovery; no continuous polling'}}
function onView(){collect('view');requestRemeasure('view-settle')}
function onRelief(){collect('pressure-relief');requestRemeasure('pressure-relief')}
function boot(){collect('boot')}
window.addEventListener('powder:high-refresh-profile',()=>collect('high-refresh'),{passive:true});window.addEventListener('powder:frame-budget',()=>collect('frame-budget'),{passive:true});window.addEventListener('powder:combat-refresh-governor',()=>collect('combat-governor'),{passive:true});window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:pressure-relief',onRelief,{passive:true});window.addEventListener('pageshow',()=>{collect('pageshow');requestRemeasure('pageshow')},{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden){collect('visibility');requestRemeasure('visibility')}else{clearTimeout(timer);timer=0}},{passive:true});window.addEventListener('pagehide',()=>{clearTimeout(timer);timer=0},{once:true});
window.POWDER_PERFORMANCE_DIRECTOR_V21221={version:VERSION,snapshot,refresh:()=>collect('manual'),remeasure:()=>requestRemeasure('manual')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();