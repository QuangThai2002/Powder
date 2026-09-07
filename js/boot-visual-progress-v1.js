(()=>{'use strict';
if(window.POWDER_BOOT_VISUAL_PROGRESS_V1)return;
const VERSION='1.1.0';
const ESTIMATE_KEY='powder_boot_visual_estimate_ms_v1';
const DEFAULT_MS=5000,MIN_MS=2500,MAX_MS=12000;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let raf=0,last=-1,finished=false,estimate=DEFAULT_MS,lastDuration=0,percentEl=null,fillEl=null,visualPct=null,visualFill=null;
try{const saved=Number(localStorage.getItem(ESTIMATE_KEY));if(Number.isFinite(saved)&&saved>0)estimate=clamp(saved,MIN_MS,MAX_MS)}catch(_){}
function ensureUi(){
 percentEl=document.getElementById('bootProgressPct');
 fillEl=document.getElementById('bootProgressFill');
 if(!percentEl||!fillEl)return false;
 const top=percentEl.parentElement,progress=fillEl.parentElement;
 if(!top||!progress)return false;
 /* Keep the real loader nodes alive for diagnostics, but never render them. */
 percentEl.style.visibility='hidden';
 fillEl.style.visibility='hidden';
 if(getComputedStyle(top).position==='static')top.style.position='relative';
 if(getComputedStyle(progress).position==='static')progress.style.position='relative';
 if(!visualPct||!visualPct.isConnected){
   visualPct=document.createElement('strong');
   visualPct.id='bootVisualProgressPctV1';
   visualPct.className=percentEl.className;
   visualPct.setAttribute('aria-hidden','true');
   Object.assign(visualPct.style,{position:'absolute',right:'0',bottom:'0',visibility:'visible',pointerEvents:'none'});
   top.appendChild(visualPct);
 }
 if(!visualFill||!visualFill.isConnected){
   visualFill=document.createElement('i');
   visualFill.id='bootVisualProgressFillV1';
   visualFill.setAttribute('aria-hidden','true');
   Object.assign(visualFill.style,{position:'absolute',left:'0',top:'0',bottom:'0',height:'100%',width:'0',visibility:'visible',transition:'width .12s linear',pointerEvents:'none'});
   progress.appendChild(visualFill);
 }
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
 if(value!==last){visualPct.textContent=`${value}%`;last=value}
 const width=`${value}%`;
 if(visualFill.style.width!==width)visualFill.style.width=width;
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
