(()=>{'use strict';
const VERSION='20.8.0',POLL=60000,root=document.documentElement;
let remote={version:VERSION,mode:'normal',circuitState:'closed',generation:0,cloudWritesAllowed:true,economyWritesAllowed:true,fxMode:'normal',updatedAt:null},lastError='',timer=0,lastFetchAt=0;
const CFG=()=>window.POWDER_ONLINE_CONFIG||{};
function server(){let local={};try{local=JSON.parse(localStorage.getItem('powder_online_server_v150')||'{}')||{}}catch(_){}return{url:String(local.url||CFG().supabaseUrl||'').replace(/\/$/,''),key:String(local.key||CFG().supabasePublishableKey||'')}}
function valid(){const c=server();return /^https:\/\/.+\.supabase\.co$/i.test(c.url)&&c.key.length>20}
function banner(){let e=document.getElementById('reliability2080Banner');if(!e){e=document.createElement('div');e.id='reliability2080Banner';e.className='reliability2080-banner';e.hidden=true;e.innerHTML='<b></b><span></span>';document.body.appendChild(e)}return e}
function apply(next,reason='remote'){
  if(!next||typeof next!=='object')return;remote={...remote,...next};
  const mode=['normal','degraded','read_only','emergency'].includes(String(remote.mode))?String(remote.mode):'normal';
  root.dataset.reliabilityMode=mode;root.dataset.reliabilityCircuit=String(remote.circuitState||'closed');
  root.classList.toggle('reliability-degraded',mode==='degraded');root.classList.toggle('reliability-readonly',mode==='read_only');root.classList.toggle('reliability-emergency',mode==='emergency');
  const e=banner();if(mode==='read_only'||mode==='emergency'){
    e.hidden=false;e.querySelector('b').textContent=mode==='emergency'?'Powder đang ở chế độ bảo vệ khẩn cấp':'Cloud Save đang tạm chuyển sang chỉ đọc';
    e.querySelector('span').textContent='Tiến độ cục bộ vẫn được giữ trên thiết bị. Powder sẽ tự đồng bộ lại khi máy chủ ổn định.';
  }else if(mode==='degraded'){
    e.hidden=false;e.querySelector('b').textContent='Powder đang giảm tải tạm thời';e.querySelector('span').textContent='Một số hiệu ứng nền được giảm để giữ trải nghiệm ổn định. Gameplay không thay đổi.';
  }else e.hidden=true;
  try{window.dispatchEvent(new CustomEvent('powder:reliability-mode',{detail:{...remote,reason}}))}catch(_){}
}
async function refresh(){
  lastFetchAt=Date.now();if(!valid())return remote;
  const c=server(),ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),8000);
  try{
    const r=await fetch(c.url+'/rest/v1/rpc/powder_reliability_public_status_v2080',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:ctl.signal});
    const d=await r.json().catch(()=>null);if(!r.ok||!d)throw new Error(d?.message||d?.error||`HTTP ${r.status}`);lastError='';apply(d,'server');return remote;
  }catch(e){lastError=String(e?.message||e);return remote}finally{clearTimeout(tm)}
}
function canCloudWrite(){return remote.cloudWritesAllowed!==false&&remote.mode!=='emergency'}
function canEconomyWrite(){return remote.economyWritesAllowed!==false&&remote.mode!=='emergency'}
function state(){return{...remote,lastError,lastFetchAt,online:navigator.onLine!==false}}
function boot(){apply(remote,'boot');lastFetchAt=Date.now();window.addEventListener('online',()=>apply(remote,'online'),{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply(remote,'visible')},{passive:true})}
window.POWDER_RELIABILITY_V2080=Object.freeze({version:VERSION,state,refresh,canCloudWrite,canEconomyWrite});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
