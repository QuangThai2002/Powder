(()=>{'use strict';
const VERSION='21.3.6-recovery',root=document.documentElement;
let remote={version:VERSION,mode:'normal',circuitState:'closed',generation:0,cloudWritesAllowed:true,economyWritesAllowed:true,fxMode:'normal',updatedAt:null},lastError='',lastFetchAt=0;
function banner(){let e=document.getElementById('reliability2080Banner');if(!e){e=document.createElement('div');e.id='reliability2080Banner';e.className='reliability2080-banner';e.hidden=true;e.innerHTML='<b></b><span></span>';document.body.appendChild(e)}return e}
function apply(next,reason='local-safe'){
  if(!next||typeof next!=='object')return;remote={...remote,...next};
  const mode=['normal','degraded','read_only','emergency'].includes(String(remote.mode))?String(remote.mode):'normal';
  root.dataset.reliabilityMode=mode;root.dataset.reliabilityCircuit=String(remote.circuitState||'closed');
  root.classList.toggle('reliability-degraded',mode==='degraded');root.classList.toggle('reliability-readonly',mode==='read_only');root.classList.toggle('reliability-emergency',mode==='emergency');
  const e=banner();if(mode==='read_only'||mode==='emergency'){e.hidden=false;e.querySelector('b').textContent=mode==='emergency'?'Powder đang ở chế độ bảo vệ khẩn cấp':'Cloud Save đang tạm chuyển sang chỉ đọc';e.querySelector('span').textContent='Tiến độ cục bộ vẫn được giữ trên thiết bị. Powder sẽ tự đồng bộ lại khi máy chủ ổn định.'}else if(mode==='degraded'){e.hidden=false;e.querySelector('b').textContent='Powder đang giảm tải tạm thời';e.querySelector('span').textContent='Một số hiệu ứng nền được giảm để giữ trải nghiệm ổn định. Gameplay không thay đổi.'}else e.hidden=true;
  try{window.dispatchEvent(new CustomEvent('powder:reliability-mode',{detail:{...remote,reason}}))}catch(_){}
}
async function refresh(){lastFetchAt=Date.now();lastError='';apply(remote,'event-driven-fallback');return remote}
function canCloudWrite(){return remote.cloudWritesAllowed!==false&&remote.mode!=='emergency'}
function canEconomyWrite(){return remote.economyWritesAllowed!==false&&remote.mode!=='emergency'}
function state(){return{...remote,lastError,lastFetchAt,online:navigator.onLine!==false,source:'local-safe-fallback',polling:false}}
function boot(){apply(remote,'boot');window.addEventListener('online',refresh,{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()},{passive:true})}
window.POWDER_RELIABILITY_V2080=Object.freeze({version:VERSION,state,refresh,canCloudWrite,canEconomyWrite});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();