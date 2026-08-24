(()=>{'use strict';
if(window.POWDER_COMBAT_ACTION_CLARITY_V2138)return;
const VERSION='21.3.8',STYLE_ID='powderCombatActionClarity2138',LIVE_ID='powderCombatActionLive2138';
const state={patches:0,actions:0,sources:0,targets:0,current:0,cc:0,impacts:0,lastRoute:'',lastReason:'boot',lastAt:0};
let raf=0,settleTimer=0;
const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
function view(){return qs('#battleView')}function mount(){return qs('.combat-v7-mount',view()||document)}
function installStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.combat-v7-mount{--caf2138-route:#9ae9ff}
.combat-v7-mount[data-caf2138-action='1'] .cv7-field{cursor:progress}
.combat-v7-mount .cv7-unit[data-caf2138-source='1']{z-index:13!important;border-color:rgba(255,226,128,.88)!important;box-shadow:0 0 0 2px rgba(255,226,128,.14),0 14px 34px rgba(0,0,0,.34)!important}
.combat-v7-mount .cv7-unit[data-caf2138-source='1']::after{content:'ĐANG RA CHIÊU';position:absolute;z-index:24;right:7px;top:31px;padding:4px 7px;border:1px solid rgba(255,225,123,.62);border-radius:999px;background:rgba(40,31,9,.94);color:#ffe89a;font-size:7px;font-weight:950;letter-spacing:.11em;pointer-events:none}
.combat-v7-mount .cv7-unit[data-caf2138-current='1']:not([data-caf2138-source='1'])::after{content:'LƯỢT HIỆN TẠI';position:absolute;z-index:23;right:7px;top:31px;padding:4px 7px;border:1px solid rgba(115,226,255,.46);border-radius:999px;background:rgba(7,33,45,.92);color:#c9f7ff;font-size:7px;font-weight:950;letter-spacing:.1em;pointer-events:none}
.combat-v7-mount .cv7-unit[data-caf2138-target='1']:not(.dead){z-index:14!important;border-color:rgba(255,197,83,.96)!important;box-shadow:0 0 0 3px rgba(255,197,83,.13),0 14px 34px rgba(0,0,0,.34)!important}
.combat-v7-mount .cv7-unit[data-caf2138-impact='1'] .cv7-unit-info{border-color:rgba(255,143,105,.82)!important}
.combat-v7-mount .cv7-unit[data-caf2138-cc='1'] .cv7-cc-lock{border-color:rgba(255,215,105,.72)!important;box-shadow:0 0 0 2px rgba(255,215,105,.08),0 8px 20px rgba(0,0,0,.36)!important}
.combat-v7-mount .cv7-attack-flow{--caf2138-route:var(--attack-line,#9ae9ff)}
.combat-v7-mount .cv7-attack-flow::before{content:'';position:absolute;left:-3px;top:50%;width:8px;height:8px;transform:translate(-50%,-50%);border:2px solid var(--caf2138-route);border-radius:50%;background:#06141d}
.combat-v7-mount .cv7-attack-flow::after{content:'';position:absolute;right:-4px;top:50%;transform:translate(70%,-50%);width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:11px solid var(--caf2138-route)}
.combat-v7-mount .cv7-attack-trace{height:4px!important;opacity:.96!important;box-shadow:0 0 10px rgba(152,232,255,.22)}
.combat-v7-mount .cv7-attack-callout{min-width:min(430px,calc(100% - 24px));border-width:2px!important;box-shadow:0 12px 28px rgba(0,0,0,.3)}
.combat-v7-mount .cv7-attack-callout small{font-size:8px!important}.combat-v7-mount .cv7-attack-callout b{font-size:16px!important}.combat-v7-mount .cv7-attack-callout span{font-size:12px!important}
html[data-native-fx-cap='low'] .combat-v7-mount .cv7-attack-trace,.combat-v7-mount.cv71-fx-low .cv7-attack-trace{height:2px!important;box-shadow:none!important;opacity:.82!important}
html[data-native-fx-cap='low'] .combat-v7-mount .cv7-attack-flow::before,html[data-native-fx-cap='low'] .combat-v7-mount .cv7-attack-flow::after{opacity:.78}
@media(max-width:620px){.combat-v7-mount .cv7-unit[data-caf2138-source='1']::after,.combat-v7-mount .cv7-unit[data-caf2138-current='1']:not([data-caf2138-source='1'])::after{top:27px;right:4px;font-size:6px;padding:3px 5px}.combat-v7-mount .cv7-attack-callout{min-width:calc(100% - 14px)}.combat-v7-mount .cv7-attack-trace{height:3px!important}}
@media(prefers-reduced-motion:reduce){.combat-v7-mount[data-caf2138-action='1'] .cv7-field{cursor:default}}
`;document.head.appendChild(s)}
function liveRegion(){let e=document.getElementById(LIVE_ID);if(e)return e;e=document.createElement('div');e.id=LIVE_ID;e.setAttribute('aria-live','polite');e.setAttribute('aria-atomic','true');e.style.cssText='position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';document.body.appendChild(e);return e}
function unitName(el){return el?.querySelector('.cv7-unit-info>b')?.textContent?.trim()||'Pow'}
function clearMarks(m){for(const u of qsa('[data-caf2138-source],[data-caf2138-target],[data-caf2138-current],[data-caf2138-cc],[data-caf2138-impact]',m)){u.removeAttribute('data-caf2138-source');u.removeAttribute('data-caf2138-target');u.removeAttribute('data-caf2138-current');u.removeAttribute('data-caf2138-cc');u.removeAttribute('data-caf2138-impact');u.removeAttribute('aria-current')}}
function mark(m){clearMarks(m);const sources=qsa('.cv7-unit.motion-charge,.cv7-unit.motion-release,.cv7-unit.signature-source',m);const targets=qsa('.cv7-unit.telegraph-target,.cv7-unit.cv69-locked-target',m).filter(u=>!sources.includes(u));const current=qsa('.cv7-unit.current',m).filter(u=>!sources.includes(u));const cc=qsa('.cv7-unit',m).filter(u=>!!u.querySelector('.cv7-cc-lock'));const impacts=qsa('.cv7-unit[class*="pulse-hit-"]',m);
for(const u of sources){u.dataset.caf2138Source='1';u.setAttribute('aria-current','step')}
for(const u of targets)u.dataset.caf2138Target='1';for(const u of current){u.dataset.caf2138Current='1';u.setAttribute('aria-current','true')}for(const u of cc)u.dataset.caf2138Cc='1';for(const u of impacts)u.dataset.caf2138Impact='1';
state.sources=sources.length;state.targets=targets.length;state.current=current.length;state.cc=cc.length;state.impacts=impacts.length;
const callout=m.querySelector('.cv7-attack-callout'),flow=!!m.querySelector('.cv7-attack-flow-layer .cv7-attack-flow'),action=!!(callout||flow||sources.length);m.dataset.caf2138Action=action?'1':'0';m.setAttribute('aria-busy',action?'true':'false');if(action)state.actions++;
if(callout&&sources.length){const ability=callout.querySelector('span')?.textContent?.trim()||'kỹ năng',source=unitName(sources[0]),targetNames=targets.map(unitName).filter(Boolean),route=`${source} dùng ${ability}${targetNames.length?` lên ${targetNames.join(', ')}`:''}`;if(route!==state.lastRoute){state.lastRoute=route;liveRegion().textContent=route}}
for(const u of targets){const label=u.getAttribute('aria-label')||unitName(u);if(!/^Mục tiêu:/i.test(label))u.setAttribute('aria-label',`Mục tiêu: ${label}`)}for(const u of cc){const lock=u.querySelector('.cv7-cc-lock')?.textContent?.trim().replace(/\s+/g,' ');if(lock)u.setAttribute('aria-description',`Trạng thái khống chế: ${lock}`)}
}
function patch(reason='event'){raf=0;const v=view(),m=mount();if(!v||v.hidden||!m)return snapshot();installStyle();mark(m);state.patches++;state.lastReason=reason;state.lastAt=Date.now();return snapshot()}
function schedule(reason='event'){if(!raf)raf=requestAnimationFrame(()=>patch(reason))}function settle(reason='settle',delay=140){clearTimeout(settleTimer);settleTimer=setTimeout(()=>{settleTimer=0;schedule(reason)},delay)}
function onView(e){const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');if(/battle|combat|boss/i.test(v)){schedule('view');settle('view-settle',180)}}
function snapshot(){return{version:VERSION,...state,visualContract:['acting Pow explicit','target explicit','source-to-target arrow','impact readable','hard CC readable'],performance:'event-driven + one coalesced rAF; bounded settle timer; no polling/MutationObserver; low-FX fallback',gameplayMutation:false,scrollMutation:false}}
function boot(){installStyle();onView({detail:{view:document.body?.dataset?.activeView||''}})}
window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:rendered',()=>schedule('rendered'),{passive:true});window.addEventListener('powder:combat-state',()=>schedule('combat-state'),{passive:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(settleTimer)},{once:true});
window.POWDER_COMBAT_ACTION_CLARITY_V2138={version:VERSION,snapshot,refresh:()=>patch('manual')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
