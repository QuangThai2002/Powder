(()=>{'use strict';
if(window.POWDER_BOOT_VISUAL_PROGRESS_V1)return;
const VERSION='1.0.2';
const ESTIMATE_KEY='powder_boot_visual_estimate_ms_v1';
const DEFAULT_MS=5000,MIN_MS=2500,MAX_MS=12000;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let raf=0,last=-1,finished=false,estimate=DEFAULT_MS,lastDuration=0,percentEl=null,fillEl=null;
try{const saved=Number(localStorage.getItem(ESTIMATE_KEY));if(Number.isFinite(saved)&&saved>0)estimate=clamp(saved,MIN_MS,MAX_MS)}catch(_){}
function ensureUi(){
 percentEl=document.getElementById('bootProgressPct');
 fillEl=document.getElementById('bootProgressFill');
 if(!percentEl||!fillEl)return false;
 percentEl.style.removeProperty('position');
 percentEl.style.removeProperty('color');
 percentEl.querySelector?.('#bootVisualProgressPctV1')?.remove();
 fillEl.style.transition='width .12s linear';
 return true;
}
function saveEstimate(actual){
 if(!Number.isFinite(actual)||actual<500)return;
 const next=clamp(Math.round(estimate*.65+actual*.35),MIN_MS,MAX_MS);
 try{localStorage.setItem(ESTIMATE_KEY,String(next))}catch(_){}
 estimate=next;
}
function paint(value){
 if(!ensureUi())return;
 value=clamp(Math.round(value),0,100);
 if(value!==last){percentEl.textContent=`${value}%`;last=value}
 const width=`${value}%`;
 if(fillEl.style.width!==width)fillEl.style.width=width;
}
function tick(){
 if(finished)return;
 const complete=document.documentElement.classList.contains('powder-boot-complete');
 const screen=document.getElementById('loadingScreen');
 if(complete){
   finished=true;
   const actual=performance.now();
   lastDuration=Math.round(actual);
   paint(100);
   saveEstimate(actual);
   return;
 }
 if(screen?.hidden){finished=true;return}
 const elapsed=Math.max(0,performance.now());
 const visual=Math.min(99,(elapsed/estimate)*100);
 paint(visual);
 raf=requestAnimationFrame(tick);
}
function start(){if(raf||finished)return;ensureUi();raf=requestAnimationFrame(tick)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.POWDER_BOOT_VISUAL_PROGRESS_V1={version:VERSION,get estimateMs(){return Math.round(estimate)},get lastDurationMs(){return lastDuration},start};
})();
