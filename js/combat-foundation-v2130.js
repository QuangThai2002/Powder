(()=>{'use strict';
if(window.POWDER_COMBAT_FOUNDATION_V2130)return;
const VERSION='21.3.0',root=document.documentElement,STYLE_ID='powderCombatFoundationStyle2130';
const state={patches:0,readyPatches:0,commandAudits:0,lastAt:0,lastView:'',lastReason:'boot',skillSlots:0,launchButtons:0,domainPickersHidden:0};
let raf=0,settleTimer=0;
const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
function battleView(){return qs('#battleView')}
function scene(){return qs('.combat-v7-mount',battleView()||document)}
function style(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.combat-v7-mount .cv76-tamer-loadout,.combat-v7-mount .cv76-domain-list,.combat-v7-mount .cv76-domain-ref{display:none!important}
.combat-v7-mount .cv76-prep-main{grid-template-columns:minmax(0,1fr)!important}
.combat-v7-mount .cv76-prebattle{max-width:min(1120px,calc(100% - 28px));margin-inline:auto}
.combat-v7-mount .cv76-prebattle>header{align-items:center}
.combat-v7-mount .cv76-prep-rule b{font-size:0}.combat-v7-mount .cv76-prep-rule b::after{content:'ĐỘI HÌNH 3 + 2';font-size:12px}
.combat-v7-mount .cv76-prep-rule span{font-size:0}.combat-v7-mount .cv76-prep-rule span::after{content:'3 Pow chính · 2 Pow dự bị';font-size:11px}
.combat-v7-mount[data-cf2130-ready='1'] .cv7-center-mark{z-index:65}
.combat-v7-mount[data-cf2130-ready='1'] .cv7-center-mark [data-cv7-launch]{min-width:min(360px,86vw);min-height:58px;padding:12px 24px;border-width:2px;font-weight:950;letter-spacing:.04em;box-shadow:0 12px 34px rgba(0,0,0,.32)}
.combat-v7-mount[data-cf2130-ready='1'] .cv7-center-mark [data-cv7-launch] small{display:block;margin-top:4px;opacity:.8;font-size:11px;font-weight:700;letter-spacing:0}
.combat-v7-mount[data-cf2130-targeting='1'] .cv7-unit:not(.dead){cursor:crosshair}
.combat-v7-mount .cv73-command-v2 .cv7-skills{grid-template-columns:repeat(4,minmax(0,1fr))}
@media(max-width:900px){.combat-v7-mount .cv73-command-v2 .cv7-skills{grid-template-columns:repeat(2,minmax(0,1fr))}.combat-v7-mount .cv76-prebattle{max-width:calc(100% - 16px)}}
`;document.head.appendChild(s)}
function isReady(m){return !!m?.querySelector('.cv76-prebattle')||!!m?.querySelector('[data-cv7-launch]')}
function auditSkills(m){const dock=m?.querySelector('.cv73-command-v2');if(!dock){state.skillSlots=0;return}const labels=['basic','skill1','skill2','ultimate'];let found=0;for(const key of labels){const button=dock.querySelector(`[data-cv7-skill="${key}"]`)||dock.querySelector(`[data-cv7-action="${key}"]`);if(button){button.dataset.cf2130CoreSkill=key;found++}}state.skillSlots=found;state.commandAudits++;dock.dataset.cf2130SkillContract=found===4?'complete':'incomplete'}
function patch(reason='event'){
  raf=0;const view=battleView(),m=scene();if(!view||view.hidden||!m)return snapshot();
  state.patches++;state.lastAt=Date.now();state.lastReason=reason;state.lastView='battle';
  const ready=isReady(m);m.dataset.cf2130Ready=ready?'1':'0';m.dataset.cf2130Targeting=m.querySelector('.cv73-command-v2.is-targeting')?'1':'0';
  if(ready){state.readyPatches++;const pre=m.querySelector('.cv76-prebattle');if(pre){pre.dataset.cf2130Formation='3-main-2-reserve';const active=pre.querySelectorAll('.cv76-active-row button').length,reserve=pre.querySelectorAll('.cv76-reserve-row button').length;pre.dataset.cf2130Active=String(active);pre.dataset.cf2130Reserve=String(reserve)}
    const launches=qsa('[data-cv7-launch]',m);state.launchButtons=launches.length;for(const b of launches){b.dataset.cf2130PrimaryLaunch='1';const small=b.querySelector('small');if(small)small.textContent='Xác nhận 3 Pow chính · 2 Pow dự bị'}
  }else state.launchButtons=0;
  const badDomain=qsa('.cv76-tamer-loadout,.cv76-domain-list,.cv76-domain-ref',m);state.domainPickersHidden=badDomain.length;for(const el of badDomain)el.setAttribute('aria-hidden','true');
  auditSkills(m);return snapshot();
}
function schedule(reason='event'){if(raf)return;raf=requestAnimationFrame(()=>patch(reason))}
function settle(reason='settle',delay=180){clearTimeout(settleTimer);settleTimer=setTimeout(()=>{settleTimer=0;schedule(reason)},delay)}
function onView(e){const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');state.lastView=v;if(/battle|boss|combat/i.test(v)){schedule('view');settle('view-settle',220)}}
function onRendered(){const view=battleView();if(view&&!view.hidden)schedule('rendered')}
function snapshot(){return{version:VERSION,...state,formation:{main:3,reserve:2},coreSkills:['basic','skill1','skill2','ultimate'],domainPolicy:'pre-battle picker hidden; domain ownership/equip belongs to Tamer',performancePolicy:'event-driven + single coalesced rAF; no polling',gameplayMutation:false}}
function boot(){style();onView({detail:{view:document.body?.dataset?.activeView||''}})}
window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:rendered',onRendered,{passive:true});window.addEventListener('powder:combat-state',()=>schedule('combat-state'),{passive:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(settleTimer)},{once:true});
window.POWDER_COMBAT_FOUNDATION_V2130={version:VERSION,snapshot,refresh:()=>patch('manual')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
