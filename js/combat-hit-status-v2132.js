(()=>{'use strict';
if(window.POWDER_COMBAT_HIT_STATUS_V2132)return;
const VERSION='21.3.2',STYLE_ID='powderCombatHitStatus2132',LIVE_ID='powderCombatLive2132';
const state={patches:0,damage:0,crit:0,heal:0,shield:0,cc:0,targets:0,lastMessage:'',lastAt:0};let raf=0,settleTimer=0,lastFx='';
const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
function view(){return qs('#battleView')}function mount(){return qs('.combat-v7-mount',view()||document)}
function installStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.combat-v7-mount .cv7-fx{pointer-events:none;z-index:84;font-variant-numeric:tabular-nums;font-weight:950;letter-spacing:.015em;text-shadow:0 2px 8px rgba(0,0,0,.82)}
.combat-v7-mount .cv7-fx.damage{font-size:clamp(22px,2.3vw,35px)!important;color:#fff0e3!important}
.combat-v7-mount .cv7-fx.crit{font-size:clamp(27px,2.8vw,42px)!important;color:#ffe17a!important;text-shadow:0 2px 8px rgba(0,0,0,.88),0 0 16px rgba(255,210,83,.34)}
.combat-v7-mount .cv7-fx.heal,.combat-v7-mount .cv7-fx.status-heal{font-size:clamp(22px,2.2vw,34px)!important;color:#9ff3ba!important}
.combat-v7-mount .cv7-fx.shield-gain,.combat-v7-mount .cv7-fx.shield{font-size:clamp(21px,2.1vw,32px)!important;color:#aeeaff!important}
.combat-v7-mount .cv7-unit.telegraph-target:not(.dead),.combat-v7-mount .cv7-unit.cv69-locked-target:not(.dead){outline:2px solid rgba(255,205,92,.88);outline-offset:3px;box-shadow:0 0 0 3px rgba(255,205,92,.1),0 12px 32px rgba(0,0,0,.28)!important}
.combat-v7-mount .cv7-unit.telegraph-target:not(.dead)::before,.combat-v7-mount .cv7-unit.cv69-locked-target:not(.dead)::before{content:'MỤC TIÊU';position:absolute;z-index:16;left:50%;top:-9px;transform:translateX(-50%);padding:3px 7px;border-radius:999px;background:#221d10;border:1px solid rgba(255,215,100,.56);color:#ffe594;font-size:8px;font-weight:950;letter-spacing:.12em;pointer-events:none}
.combat-v7-mount .cv7-cc-lock{z-index:17!important;min-width:86px;padding:6px 8px!important;border-width:2px!important;background:rgba(4,12,18,.92)!important;box-shadow:0 8px 20px rgba(0,0,0,.32)}
.combat-v7-mount .cv7-cc-lock b{font-size:11px!important}.combat-v7-mount .cv7-cc-lock small{display:block!important;font-size:8px!important;font-weight:900!important;letter-spacing:.08em}
.combat-v7-mount .cv7-unit.pulse-status-control .cv7-unit-info{border-color:rgba(255,218,91,.78)!important}
.combat-v7-mount .cv7-unit.pulse-heal .cv7-unit-info,.combat-v7-mount .cv7-unit.pulse-status-heal .cv7-unit-info{border-color:rgba(111,235,163,.78)!important}
.combat-v7-mount .cv7-unit.pulse-shield-gain .cv7-unit-info,.combat-v7-mount .cv7-unit.pulse-guarded .cv7-unit-info{border-color:rgba(124,224,255,.82)!important}
.combat-v7-mount .cv7-unit.dead{opacity:.54;filter:saturate(.45)}
.combat-v7-mount .cv7-unit.dead .cv7-art{filter:grayscale(.65) brightness(.7)}
.combat-v7-mount .cv7-statuses>span{border-width:1px;min-height:20px}
html[data-native-fx-cap='low'] .combat-v7-mount .cv7-fx,.combat-v7-mount.cv71-fx-low .cv7-fx{text-shadow:0 2px 6px rgba(0,0,0,.78)}
@media(max-width:620px){.combat-v7-mount .cv7-unit.telegraph-target:not(.dead)::before,.combat-v7-mount .cv7-unit.cv69-locked-target:not(.dead)::before{top:-6px;font-size:7px}.combat-v7-mount .cv7-cc-lock{min-width:72px;padding:4px 6px!important}}
@media(prefers-reduced-motion:reduce){.combat-v7-mount .cv7-unit.targetable:hover,.combat-v7-mount .cv7-unit.targetable:focus-visible{transform:none!important}}
`;document.head.appendChild(s)}
function liveRegion(){let e=document.getElementById(LIVE_ID);if(e)return e;e=document.createElement('div');e.id=LIVE_ID;e.setAttribute('aria-live','polite');e.setAttribute('aria-atomic','true');e.style.cssText='position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';document.body.appendChild(e);return e}
function classify(m){const damage=qsa('.cv7-fx.damage',m),crit=qsa('.cv7-fx.crit',m),heal=qsa('.cv7-fx.heal,.cv7-fx.status-heal',m),shield=qsa('.cv7-fx.shield-gain,.cv7-fx.shield',m),cc=qsa('.cv7-cc-lock',m),targets=qsa('.cv7-unit.telegraph-target,.cv7-unit.cv69-locked-target',m);state.damage=damage.length;state.crit=crit.length;state.heal=heal.length;state.shield=shield.length;state.cc=cc.length;state.targets=targets.length;for(const e of [...damage,...crit,...heal,...shield])e.dataset.hs2132Feedback='core';for(const e of cc)e.dataset.hs2132Cc='1';for(const e of targets)e.dataset.hs2132Target='1';const visible=[...crit,...damage,...heal,...shield,...cc].filter(e=>e.textContent?.trim());const newest=visible.at(-1);if(newest){const id=newest.getAttribute('data-fx-id')||newest.textContent.trim();if(id!==lastFx){lastFx=id;const msg=newest.textContent.trim().replace(/\s+/g,' ');state.lastMessage=msg;liveRegion().textContent=msg}}}
function patch(){raf=0;const v=view(),m=mount();if(!v||v.hidden||!m)return snapshot();installStyle();classify(m);state.patches++;state.lastAt=Date.now();return snapshot()}
function schedule(){if(!raf)raf=requestAnimationFrame(patch)}function settle(){clearTimeout(settleTimer);settleTimer=setTimeout(()=>{settleTimer=0;schedule()},120)}
function onView(e){const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');if(/battle|combat|boss/i.test(v)){schedule();settle()}}
function snapshot(){return{version:VERSION,...state,protectedFeedback:['damage','crit','heal','shield','hard-cc','target'],visualRule:'source/target/core numbers before decoration',performance:'no particles, no new animation loop, event-driven rAF only',gameplayMutation:false}}
function activateNext(){if(window.POWDER_TAMER_DOMAIN_MEMORY_V2133||document.getElementById('powderTamerDomainMemory2133'))return;const s=document.createElement('script');s.id='powderTamerDomainMemory2133';s.src='js/tamer-domain-memory-v2133.js?v=2133';s.async=true;document.head.appendChild(s)}
function boot(){installStyle();activateNext();onView({detail:{view:document.body?.dataset?.activeView||''}})}
window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:rendered',schedule,{passive:true});window.addEventListener('powder:combat-state',schedule,{passive:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(settleTimer)},{once:true});
window.POWDER_COMBAT_HIT_STATUS_V2132={version:VERSION,snapshot,refresh:patch,activateNext};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
