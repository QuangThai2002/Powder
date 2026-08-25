(()=>{'use strict';
if(window.POWDER_COMBAT_STATUS_FX_V2145)return;
const VERSION='21.4.5',CSS_ID='powderCombatStatusFx2145Css',CSS_HREF='css/combat-status-fx-v2145.css?v=2145';
const state={patches:0,dotBursts:0,controlMarks:0,cleanseBursts:0,shieldAbsorbs:0,statusExpires:0,antiHealMarks:0,lastKind:'',lastReason:'boot',lastAt:0};
let raf=0,settle=0;const timers=new Set(),seen=new Set();
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
function mount(){return q('#battleView:not([hidden]) .combat-v7-mount')||q('.combat-v7-mount')}
function ensureCss(){if(document.getElementById(CSS_ID))return;const l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';l.href=CSS_HREF;document.head.appendChild(l)}
function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);try{fn()}catch(_){}},Math.max(0,Number(ms)||0));timers.add(id);return id}
function clearTimers(){for(const id of timers)clearTimeout(id);timers.clear()}
function remember(token){if(!token||seen.has(token))return false;seen.add(token);if(seen.size>256)seen.delete(seen.values().next().value);return true}
function unitFromFx(m,fx){const side=fx.classList.contains('enemy')?'enemy':fx.classList.contains('player')?'player':'',slot=[...fx.classList].find(c=>c.startsWith('slot-'))?.slice(5);return side&&slot!=null?q(`.cv7-unit.${side}.slot-${CSS.escape(String(slot))}`,m):null}
function wrap(u){return q('.cv7-art-wrap',u)||u}
function burst(u,kind,ttl=760){if(!u?.isConnected)return;const el=document.createElement('i');el.className=`cfx2145-burst ${kind}`;wrap(u).appendChild(el);state.lastKind=kind;later(()=>el.remove(),ttl)}
function statusKind(text=''){const t=String(text).toLowerCase();if(/thiêu|burn|fire/.test(t))return'burn';if(/độc|poison|venom/.test(t))return'poison';if(/giật|shock|điện|sét/.test(t))return'shock';if(/đóng băng|freeze|băng/.test(t))return'freeze';if(/choáng|stun/.test(t))return'stun';if(/giảm hồi|anti.?heal|cấm hồi/.test(t))return'antiheal';return'status'}
function patchFx(m){for(const fx of qa('.cv7-fx.status-dot,.cv7-fx.status-control,.cv7-fx.cleanse,.cv7-fx.status-expire,.cv7-fx.shield',m)){const id=fx.dataset.fxId||`${fx.className}:${fx.textContent}`;if(!remember(`fx:${id}`))continue;const u=unitFromFx(m,fx);if(!u)continue;if(fx.classList.contains('status-dot')){burst(u,`dot ${statusKind(fx.textContent)}`,700);state.dotBursts++}else if(fx.classList.contains('status-control')){burst(u,`control ${statusKind(fx.textContent)}`,860);state.controlMarks++}else if(fx.classList.contains('cleanse')){burst(u,'cleanse',820);state.cleanseBursts++}else if(fx.classList.contains('status-expire')){burst(u,'expire',620);state.statusExpires++}else if(fx.classList.contains('shield')){burst(u,'shield-absorb',620);state.shieldAbsorbs++}}}
function markChips(m){for(const u of qa('.cv7-unit',m)){u.removeAttribute('data-cfx2145-control');u.removeAttribute('data-cfx2145-antiheal');let control='',anti=false;for(const chip of qa('.cv7-statuses > *',u)){const kind=statusKind(chip.textContent||chip.getAttribute('title')||'');chip.dataset.cfx2145Status=kind;if(kind==='freeze'||kind==='stun')control=kind;if(kind==='antiheal')anti=true}if(control){u.dataset.cfx2145Control=control;state.controlMarks++}if(anti){u.dataset.cfx2145Antiheal='1';state.antiHealMarks++}}}
function patch(reason='event'){raf=0;const m=mount();if(!m)return snapshot();ensureCss();patchFx(m);markChips(m);state.patches++;state.lastReason=reason;state.lastAt=Date.now();return snapshot()}
function schedule(reason='event'){if(!raf)raf=requestAnimationFrame(()=>patch(reason))}
function settlePatch(reason='settle',ms=150){clearTimeout(settle);settle=setTimeout(()=>{settle=0;schedule(reason)},ms)}
function onView(e){const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');if(/battle|combat|boss/i.test(v)){schedule('view');settlePatch('view-settle',190)}else seen.clear()}
function snapshot(){return{version:VERSION,...state,css:CSS_HREF,visualContract:['DoT tick identity','control exact-unit mark','cleanse burst','shield absorb feedback','status expire fade','anti-heal warning','21.4.4 impact legibility preserved'],performance:'event-driven + coalesced rAF + bounded one-shot timers; no polling/MutationObserver/background loops',gameplayMutation:false,damageFormulaMutation:false,skillDataMutation:false,serverMutation:false,scrollMutation:false}}
window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:rendered',()=>schedule('rendered'),{passive:true});window.addEventListener('powder:combat-state',()=>schedule('combat-state'),{passive:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(settle);clearTimers();seen.clear()},{once:true});
window.POWDER_COMBAT_STATUS_FX_V2145={version:VERSION,snapshot,refresh:()=>patch('manual')};
ensureCss();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule('dom'),{once:true});else schedule('boot');
})();
