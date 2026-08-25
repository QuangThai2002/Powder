(()=>{'use strict';
if(window.POWDER_COMBAT_CAMERA_HIT_V2146)return;
const VERSION='21.4.6',CSS_ID='powderCombatCameraHit2146Css',CSS_HREF='css/combat-camera-hit-v2146.css?v=2146';
const state={patches:0,cameraPulses:0,targetHalos:0,critPulses:0,strongPulses:0,lastKey:'',lastRole:'',lastElement:'',lastReason:'boot',lastAt:0};
let raf=0,settle=0;const timers=new Set(),seen=new Set();
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
function mount(){return q('#battleView:not([hidden]) .combat-v7-mount')||q('.combat-v7-mount')}
function ensureCss(){if(document.getElementById(CSS_ID))return;const l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';l.href=CSS_HREF;document.head.appendChild(l)}
function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);try{fn()}catch(_){}},Math.max(0,Number(ms)||0));timers.add(id);return id}
function clearTimers(){for(const id of timers)clearTimeout(id);timers.clear()}
function remember(token){if(!token||seen.has(token))return false;seen.add(token);if(seen.size>256)seen.delete(seen.values().next().value);return true}
function keyOf(f){return ['basic','skill1','skill2','ultimate','exclusive'].find(k=>f?.classList.contains(k))||'basic'}
function roleOf(f){return [...(f?.classList||[])].find(c=>c.startsWith('role-'))?.slice(5)||'marksman'}
function elementOf(f){return [...(f?.classList||[])].find(c=>c.startsWith('el-'))?.slice(3)||'neutral'}
function impactDelay(f){return Math.max(100,Math.min(1800,parseFloat(f?.style?.getPropertyValue('--impact-delay')||'420')||420))}
function intensity(key){return key==='ultimate'?'ultimate':key==='exclusive'?'exclusive':key==='skill2'?'medium':key==='skill1'?'light':'basic'}
function targetEls(m){return qa('.cv7-unit.telegraph-target,.cv7-unit.cv69-locked-target',m)}
function sourceEl(m){return q('.cv7-unit.motion-release,.cv7-unit.motion-charge',m)}
function supportFlow(m,f){if(f?.hasAttribute('data-cfx2143-support'))return true;const src=sourceEl(m),targets=targetEls(m);if(!src||!targets.length)return false;const side=src.classList.contains('enemy')?'enemy':src.classList.contains('player')?'player':'';return !!side&&targets.every(t=>t.classList.contains(side))}
function field(m){return q('.cv7-field',m)}
function addCameraPulse(m,key,role,element,crit=false){const host=field(m);if(!host)return;const el=document.createElement('i'),tone=crit?'crit':intensity(key);el.className=`cfx2146-camera-pulse ${tone} role-${role} el-${element}`;host.appendChild(el);state.cameraPulses++;if(crit)state.critPulses++;if(key==='ultimate'||key==='exclusive')state.strongPulses++;later(()=>el.remove(),key==='ultimate'?720:key==='exclusive'?620:crit?520:430)}
function addTargetHalo(u,key,role,element,dir){if(!u?.isConnected)return;const wrap=q('.cv7-art-wrap',u)||u,el=document.createElement('i');el.className=`cfx2146-hit-halo ${intensity(key)} role-${role} el-${element} dir-${dir}`;wrap.appendChild(el);u.dataset.cfx2146Hit=intensity(key);state.targetHalos++;later(()=>{el.remove();u.removeAttribute('data-cfx2146-hit')},key==='ultimate'?760:key==='exclusive'?680:520)}
function scheduleFlow(m,f,index=0){if(f.dataset.cfx2146Scheduled==='1'||supportFlow(m,f))return;f.dataset.cfx2146Scheduled='1';const key=keyOf(f),role=roleOf(f),element=elementOf(f),targets=targetEls(m),src=sourceEl(m),dir=src?.classList.contains('enemy')?'enemy':'player',delay=impactDelay(f)+Math.min(180,index*24);state.lastKey=key;state.lastRole=role;state.lastElement=element;later(()=>{addCameraPulse(m,key,role,element,false);targets.forEach(t=>addTargetHalo(t,key,role,element,dir))},delay)}
function patchCrit(m){for(const fx of qa('.cv7-fx.crit',m)){const id=fx.dataset.fxId||`${fx.className}:${fx.textContent}`;if(!remember(`crit:${id}`))continue;const f=q('.cv7-attack-flow',m),key=keyOf(f),role=roleOf(f),element=elementOf(f);addCameraPulse(m,key,role,element,true)}}
function patch(reason='event'){raf=0;const m=mount();if(!m)return snapshot();ensureCss();qa('.cv7-attack-flow',m).forEach((f,i)=>scheduleFlow(m,f,i));patchCrit(m);state.patches++;state.lastReason=reason;state.lastAt=Date.now();return snapshot()}
function schedule(reason='event'){if(!raf)raf=requestAnimationFrame(()=>patch(reason))}
function settlePatch(reason='settle',ms=140){clearTimeout(settle);settle=setTimeout(()=>{settle=0;schedule(reason)},ms)}
function onView(e){const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');if(/battle|combat|boss/i.test(v)){schedule('view');settlePatch('view-settle',180)}else seen.clear()}
function snapshot(){return{version:VERSION,...state,css:CSS_HREF,visualContract:['impact-synced camera pulse','directional target halo','crit confirmation pulse','Ultimate/Exclusive stronger finish','support flow exclusion','no Pow-art transform ownership','21.4.5 status FX preserved'],performance:'event-driven + coalesced rAF + bounded one-shot timers; overlay-only camera grammar; no polling/MutationObserver/background loops',gameplayMutation:false,damageFormulaMutation:false,skillDataMutation:false,serverMutation:false,scrollMutation:false}}
window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:rendered',()=>schedule('rendered'),{passive:true});window.addEventListener('powder:combat-state',()=>schedule('combat-state'),{passive:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(settle);clearTimers();seen.clear()},{once:true});
window.POWDER_COMBAT_CAMERA_HIT_V2146={version:VERSION,snapshot,refresh:()=>patch('manual')};ensureCss();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule('dom'),{once:true});else schedule('boot');
})();
