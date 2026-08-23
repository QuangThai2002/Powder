(()=>{'use strict';
const VERSION='18.2.5';
let raf=0,flushes=0,frameRuns=0,batchRuns=0,debounceRuns=0,idleRuns=0;
const frameTasks=new Map(),batchTasks=new Map(),debounces=new Map(),idles=new Map();
function ensureFrame(){if(!raf&&!document.hidden)raf=requestAnimationFrame(flush)}
function flush(){raf=0;flushes++;
  const batches=[...batchTasks.entries()];batchTasks.clear();
  const measured=[];
  for(const [key,job] of batches){try{measured.push([key,job,job.measure?.()])}catch(e){console.warn('[Powder DOM measure]',key,e)}}
  for(const [key,job,value] of measured){try{job.mutate?.(value);batchRuns++}catch(e){console.warn('[Powder DOM mutate]',key,e)}}
  const frames=[...frameTasks.entries()];frameTasks.clear();
  for(const [key,fn] of frames){try{fn();frameRuns++}catch(e){console.warn('[Powder DOM frame]',key,e)}}
  if(frameTasks.size||batchTasks.size)ensureFrame();
}
function frame(key,fn){if(typeof fn!=='function')return;frameTasks.set(String(key),fn);ensureFrame()}
function measureMutate(key,measure,mutate){batchTasks.set(String(key),{measure,mutate});ensureFrame()}
function debounce(key,fn,wait=90){key=String(key);const old=debounces.get(key);if(old)clearTimeout(old);const t=setTimeout(()=>{debounces.delete(key);if(document.hidden)return;debounceRuns++;try{fn()}catch(e){console.warn('[Powder DOM debounce]',key,e)}},Math.max(0,Number(wait)||0));debounces.set(key,t);return t}
function cancelDebounce(key){key=String(key);const t=debounces.get(key);if(t){clearTimeout(t);debounces.delete(key)}}
function idle(key,fn,timeout=900){key=String(key);cancelIdle(key);const run=()=>{idles.delete(key);if(document.hidden)return;idleRuns++;try{fn()}catch(e){console.warn('[Powder DOM idle]',key,e)}};let rec;if(window.requestIdleCallback){const id=requestIdleCallback(run,{timeout:Math.max(100,Number(timeout)||900)});rec={kind:'idle',id}}else{const id=setTimeout(run,Math.min(160,Math.max(0,Number(timeout)||80)));rec={kind:'timeout',id}}idles.set(key,rec);return rec.id}
function cancelIdle(key){key=String(key);const rec=idles.get(key);if(!rec)return;if(rec.kind==='idle'&&window.cancelIdleCallback){try{cancelIdleCallback(rec.id)}catch(_){}}else clearTimeout(rec.id);idles.delete(key)}
function cancelAll(){if(raf){cancelAnimationFrame(raf);raf=0}frameTasks.clear();batchTasks.clear();for(const t of debounces.values())clearTimeout(t);debounces.clear();for(const key of [...idles.keys()])cancelIdle(key)}
function diagnostics(){return{version:VERSION,flushes,frameRuns,batchRuns,debounceRuns,idleRuns,pendingFrames:frameTasks.size,pendingBatches:batchTasks.size,pendingDebounces:debounces.size,pendingIdle:idles.size}}
function visibility(){if(document.hidden){if(raf){cancelAnimationFrame(raf);raf=0}}else if(frameTasks.size||batchTasks.size)ensureFrame()}
document.addEventListener('visibilitychange',visibility,{passive:true});window.addEventListener('pagehide',cancelAll,{once:true});
window.POWDER_DOM_RUNTIME_V1825={version:VERSION,frame,measureMutate,debounce,cancelDebounce,idle,cancelIdle,diagnostics};
})();
