(()=>{'use strict';
if(window.POWDER_ADAPTIVE_PRESSURE_V21011)return;
const VERSION='21.0.11';
const root=document.documentElement;
const LEVELS=['calm','warm','hot','critical'];
const longTasks=[];
const pausedAnimations=new Set();
let level='calm',score=0,lastRaw=0,lastSample=0,lastAction=0,reliefRuns=0,resumeRuns=0,observer=null,timer=0,forcedLevel=null,lastSnapshot=null;
const now=()=>performance.now();
const activeView=()=>document.body?.dataset?.activeView||'';
const criticalScene=()=>{
  const v=String(activeView()).toLowerCase();
  const summon=document.getElementById('summonModal');
  return /battle|boss|combat/.test(v)||!!(summon&&!summon.hidden);
};
const imageRuntime=()=>window.POWDER_IMAGE_RUNTIME_V1826||null;
const lifecycle=()=>window.POWDER_RUNTIME_LIFECYCLE_V1826||null;
const domRuntime=()=>window.POWDER_DOM_RUNTIME_V1825||null;

function trimLongTasks(t=now()){
  while(longTasks.length&&t-longTasks[0].at>12000)longTasks.shift();
  if(longTasks.length>120)longTasks.splice(0,longTasks.length-120);
}
function longTaskStats(){
  const t=now();trimLongTasks(t);
  let total=0,max=0;
  for(const x of longTasks){total+=x.duration;max=Math.max(max,x.duration)}
  return{count:longTasks.length,totalMs:Math.round(total),maxMs:Math.round(max)};
}
function heapStats(){
  const m=performance?.memory;
  if(!m?.usedJSHeapSize||!m?.jsHeapSizeLimit)return{usedMB:null,limitMB:null,ratio:null};
  return{
    usedMB:Math.round(m.usedJSHeapSize/1048576*10)/10,
    limitMB:Math.round(m.jsHeapSizeLimit/1048576),
    ratio:Math.round((m.usedJSHeapSize/m.jsHeapSizeLimit)*1000)/1000
  };
}
function collect(){
  const img=imageRuntime()?.diagnostics?.()||{};
  const dom=domRuntime()?.diagnostics?.()||{};
  const heap=heapStats(),lt=longTaskStats();
  const nodes=document.getElementsByTagName('*').length;
  const fps=Math.max(1,Number(window.POWDER_PERFORMANCE_V1757?.fps?.()||root.dataset.fps||60)||60);
  const pendingDom=(Number(dom.pendingFrames)||0)+(Number(dom.pendingBatches)||0)+(Number(dom.pendingDebounces)||0)+(Number(dom.pendingIdle)||0);
  return{
    at:Date.now(),fps,heap,longTasks:lt,nodes,
    image:{decodeQueued:Number(img.decodeQueued)||0,decodeInFlight:Number(img.decodeInFlight)||0,hiddenHeavy:Number(img.hiddenHeavy)||0,evicted:Number(img.evicted)||0},
    dom:{pending:pendingDom,flushes:Number(dom.flushes)||0},
    view:activeView(),criticalScene:criticalScene(),
    device:{memory:Number(navigator.deviceMemory)||null,cores:Number(navigator.hardwareConcurrency)||null}
  };
}
function rawScore(s){
  let n=0;
  if(s.fps<40)n+=48;else if(s.fps<48)n+=32;else if(s.fps<54)n+=16;else if(s.fps<58)n+=6;
  if(s.heap.ratio!=null){if(s.heap.ratio>.86)n+=38;else if(s.heap.ratio>.74)n+=24;else if(s.heap.ratio>.62)n+=12}
  if(s.longTasks.totalMs>900)n+=34;else if(s.longTasks.totalMs>500)n+=24;else if(s.longTasks.totalMs>220)n+=12;
  if(s.longTasks.maxMs>180)n+=18;else if(s.longTasks.maxMs>100)n+=10;
  if(s.image.decodeQueued>14)n+=24;else if(s.image.decodeQueued>7)n+=14;else if(s.image.decodeQueued>3)n+=6;
  if(s.nodes>18000)n+=24;else if(s.nodes>12000)n+=14;else if(s.nodes>8000)n+=6;
  if(s.dom.pending>16)n+=18;else if(s.dom.pending>8)n+=10;else if(s.dom.pending>3)n+=4;
  if((s.device.memory&&s.device.memory<=4)||(s.device.cores&&s.device.cores<=4))n+=6;
  return Math.max(0,Math.min(100,n));
}
function targetLevel(v,current){
  if(forcedLevel&&LEVELS.includes(forcedLevel))return forcedLevel;
  if(current==='critical'&&v>=52)return'critical';
  if(current==='hot'&&v>=30)return v>=64?'critical':'hot';
  if(current==='warm'&&v>=12)return v>=64?'critical':v>=38?'hot':'warm';
  if(v>=64)return'critical';
  if(v>=38)return'hot';
  if(v>=18)return'warm';
  return'calm';
}
function shouldKeepAnimation(a){
  const el=a?.effect?.target;
  if(!el||!el.isConnected)return true;
  if(el.closest?.('[data-pressure-keep="1"],#battleView,#summonModal,.battle-arena,.cv7-battle-shell,.powball-stage,.loading-screen'))return true;
  const t=a.effect?.getTiming?.()||{};
  return t.iterations!==Infinity;
}
function pauseDecorative(){
  if(!document.getAnimations)return 0;
  let n=0;
  for(const a of document.getAnimations()){
    if(a.playState!=='running'||shouldKeepAnimation(a))continue;
    try{a.pause();pausedAnimations.add(a);n++}catch(_){}
    if(n>=24)break;
  }
  return n;
}
function resumeDecorative(){
  if(!pausedAnimations.size)return 0;
  let n=0;
  for(const a of [...pausedAnimations]){
    pausedAnimations.delete(a);
    if(!a?.effect?.target?.isConnected)continue;
    try{if(a.playState==='paused')a.play();n++}catch(_){}
    if(n>=10)break;
  }
  if(pausedAnimations.size)requestAnimationFrame(resumeDecorative);
  if(n)resumeRuns++;
  return n;
}
function demoteHiddenImages(){
  let n=0;
  for(const img of document.querySelectorAll('.view[hidden] img,.modal[hidden] img')){
    try{img.loading='lazy';img.fetchPriority='low';img.decoding='async';if(img.style.willChange)img.style.willChange='auto';n++}catch(_){}
    if(n>=96)break;
  }
  return n;
}
function requestRelief(next,snapshot){
  if(next==='calm')return;
  const run=()=>{
    if(document.hidden)return;
    const img=imageRuntime(),life=lifecycle();
    let evicted=0,paused=0,demoted=0;
    if(next==='warm'){
      evicted=img?.evictHidden?.(16)||0;
    }else if(next==='hot'){
      demoted=demoteHiddenImages();
      evicted=img?.evictHidden?.(48)||0;
      life?.sweep?.();
      paused=pauseDecorative();
    }else{
      demoted=demoteHiddenImages();
      evicted=img?.evictHidden?.(criticalScene()?56:80)||0;
      life?.cleanup?.();
      life?.sweep?.();
      paused=pauseDecorative();
    }
    reliefRuns++;
    lastAction=Date.now();
    try{window.dispatchEvent(new CustomEvent('powder:pressure-relief',{detail:{level:next,evicted,paused,demoted,criticalScene:snapshot.criticalScene}}))}catch(_){}
  };
  if(window.requestIdleCallback)requestIdleCallback(run,{timeout:next==='critical'?220:500});
  else setTimeout(run,next==='critical'?0:40);
}
function apply(next,snapshot){
  if(!LEVELS.includes(next))next='calm';
  const changed=next!==level;
  level=next;
  root.dataset.resourcePressure=level;
  root.dataset.resourcePressureScore=String(Math.round(score));
  root.dataset.resourcePressurePriority=snapshot.criticalScene?'combat':'normal';
  root.classList.toggle('pressure-warm',level==='warm');
  root.classList.toggle('pressure-hot',level==='hot');
  root.classList.toggle('pressure-critical',level==='critical');
  if(level==='calm')resumeDecorative();else requestRelief(level,snapshot);
  if(changed){
    try{window.dispatchEvent(new CustomEvent('powder:resource-pressure',{detail:{level,score:Math.round(score),snapshot,combatProtected:snapshot.criticalScene}}))}catch(_){}
  }
}
function evaluate(immediate=false){
  if(document.hidden&&!immediate)return lastSnapshot;
  const s=collect(),raw=rawScore(s);
  lastRaw=raw;score=immediate?raw:(score*.58+raw*.42);
  const next=targetLevel(score,level);
  apply(next,s);
  lastSample=Date.now();
  lastSnapshot={...s,rawScore:raw,score:Math.round(score),level,forcedLevel,reliefRuns,resumeRuns,lastAction};
  return lastSnapshot;
}
function schedule(delay){
  clearTimeout(timer);
  if(document.hidden)return;
  const v=activeView();
  timer=setTimeout(()=>{evaluate();schedule()},delay??(/battle|boss|combat/i.test(v)?3200:5200));
}
function visibility(){
  if(document.hidden){clearTimeout(timer);timer=0;pauseDecorative();return}
  evaluate(true);schedule(700);
}
function installLongTaskObserver(){
  if(!window.PerformanceObserver)return;
  try{
    observer=new PerformanceObserver(list=>{
      const t=now();
      for(const e of list.getEntries())longTasks.push({at:t,duration:Number(e.duration)||0});
      trimLongTasks(t);
      if(longTasks.some(x=>x.duration>=180))setTimeout(()=>evaluate(true),0);
    });
    observer.observe({entryTypes:['longtask']});
  }catch(_){observer=null}
}
function onView(){
  const img=imageRuntime();
  const active=document.querySelector('.view:not([hidden]),#setupScreen:not([hidden])');
  if(active)img?.prioritize?.(active);
  evaluate(true);
  schedule(/battle|boss|combat/i.test(activeView())?2400:4200);
}
function diagnostics(){return lastSnapshot||evaluate(true)}
function setDebugPressure(next=null){
  forcedLevel=LEVELS.includes(next)?next:null;
  if(forcedLevel){
    const s=collect();score={calm:0,warm:24,hot:46,critical:76}[forcedLevel];apply(forcedLevel,s);lastSnapshot={...s,rawScore:rawScore(s),score:Math.round(score),level,forcedLevel,reliefRuns,resumeRuns,lastAction};
  }else evaluate(true);
  return diagnostics();
}
function teardown(){
  clearTimeout(timer);timer=0;
  try{observer?.disconnect?.()}catch(_){}
  observer=null;resumeDecorative();
}
function boot(){
  installLongTaskObserver();
  document.addEventListener('visibilitychange',visibility,{passive:true});
  window.addEventListener('powder:view-changed',onView,{passive:true});
  window.addEventListener('pagehide',teardown,{once:true});
  evaluate(true);schedule(1600);
}
window.POWDER_ADAPTIVE_PRESSURE_V21011={version:VERSION,levels:LEVELS.slice(),snapshot:diagnostics,evaluate:()=>evaluate(true),setDebugPressure,level:()=>level,score:()=>Math.round(score)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();