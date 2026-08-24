(()=>{'use strict';
if(window.POWDER_COMBAT_UI_READABILITY_V2131)return;
const VERSION='21.3.1',STYLE_ID='powderCombatUiReadability2131';
const state={patches:0,units:0,skills:0,targetPrompts:0,lastAt:0,lastReason:'boot'};let raf=0,settleTimer=0;
const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
function view(){return qs('#battleView')}function mount(){return qs('.combat-v7-mount',view()||document)}
function installStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.combat-v7-mount{--cui2131-line:rgba(164,232,255,.22);--cui2131-panel:rgba(5,20,29,.94);--cui2131-gold:#ffe08a}
.combat-v7-mount .cv7-field{isolation:isolate}
.combat-v7-mount .cv7-enemies>div,.combat-v7-mount .cv7-players>div:not(.cv7-reserves){gap:clamp(10px,1.4vw,20px)}
.combat-v7-mount .cv7-unit{min-width:0;overflow:visible;transition:border-color .12s ease,box-shadow .12s ease,opacity .12s ease!important}
.combat-v7-mount .cv7-unit.current{z-index:8;border-color:rgba(255,224,138,.82)!important;box-shadow:0 0 0 2px rgba(255,224,138,.14),0 10px 28px rgba(0,0,0,.26)!important}
.combat-v7-mount .cv7-unit.targetable{z-index:9;border-color:rgba(110,227,255,.86)!important;box-shadow:0 0 0 2px rgba(110,227,255,.17),0 12px 30px rgba(0,0,0,.3)!important}
.combat-v7-mount .cv7-unit.targetable:hover,.combat-v7-mount .cv7-unit.targetable:focus-visible{transform:translateY(-3px);outline:2px solid rgba(118,235,255,.88);outline-offset:3px}
.combat-v7-mount .cv7-art-wrap{min-height:clamp(145px,18vw,235px);display:grid;place-items:end center}
.combat-v7-mount .cv7-art{max-height:clamp(155px,21vw,255px);max-width:94%;object-fit:contain}
.combat-v7-mount .cv7-unit-info{position:relative;z-index:4;padding:9px 10px 10px;border-radius:12px;background:linear-gradient(180deg,rgba(8,27,37,.91),rgba(4,17,25,.97));border:1px solid var(--cui2131-line)}
.combat-v7-mount .cv7-unit-info>b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:clamp(12px,1.15vw,16px)}
.combat-v7-mount .cv7-bars{display:grid;gap:4px;margin-top:7px}
.combat-v7-mount .cv7-bars>i{position:relative;display:block;height:8px!important;overflow:hidden;border-radius:999px;background:rgba(0,0,0,.48)}
.combat-v7-mount .cv7-bars>i.hp{height:11px!important}
.combat-v7-mount .cv7-values{display:grid;grid-template-columns:minmax(0,1.5fr) auto auto;gap:6px;margin-top:6px;align-items:center}
.combat-v7-mount .cv7-values span{font-size:clamp(9px,.82vw,12px);white-space:nowrap}
.combat-v7-mount .cv7-statuses{min-height:23px;margin-top:5px}
.combat-v7-mount .cv7-turn-order{z-index:42;max-width:min(980px,calc(100% - 20px));padding:7px 9px;border:1px solid var(--cui2131-line);border-radius:14px;background:rgba(4,18,27,.9);box-shadow:0 8px 24px rgba(0,0,0,.2)}
.combat-v7-mount .cv7-turn-order>span{min-width:70px}.combat-v7-mount .cv7-turn-order>span.now{border-color:rgba(255,224,138,.72);background:rgba(255,224,138,.09)}
.combat-v7-mount .cv7-command.cv73-command-v2{z-index:55;border:1px solid rgba(143,225,255,.24);background:linear-gradient(180deg,rgba(6,25,35,.97),rgba(3,14,21,.98));box-shadow:0 -12px 34px rgba(0,0,0,.28)}
.combat-v7-mount .cv73-command-v2 .cv7-skills{gap:9px}
.combat-v7-mount .cv73-command-v2 .cv7-skill{min-height:108px;display:grid;grid-template-columns:44px minmax(0,1fr);align-items:start;gap:8px;padding:10px;border:1px solid rgba(145,224,255,.16);border-radius:14px;background:linear-gradient(180deg,rgba(19,55,68,.96),rgba(7,29,39,.98));text-align:left}
.combat-v7-mount .cv73-command-v2 .cv7-skill:hover:not(:disabled),.combat-v7-mount .cv73-command-v2 .cv7-skill:focus-visible{border-color:rgba(127,228,255,.62);transform:translateY(-2px)}
.combat-v7-mount .cv73-command-v2 .cv7-skill.ult{border-color:rgba(255,216,105,.34);background:linear-gradient(180deg,rgba(79,57,22,.93),rgba(38,28,13,.98))}
.combat-v7-mount .cv73-command-v2 .cv7-skill-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:11px;background:rgba(255,255,255,.055);overflow:hidden}
.combat-v7-mount .cv73-command-v2 .cv7-skill-icon img{width:100%;height:100%;object-fit:cover}
.combat-v7-mount .cv73-skill-copy b{font-size:clamp(11px,1vw,14px);line-height:1.25}.combat-v7-mount .cv73-skill-copy p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:4px 0 0;font-size:10px;line-height:1.35;opacity:.8}
.combat-v7-mount .cf2131-target-prompt{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:9px;min-height:38px;margin-bottom:4px;border:1px solid rgba(107,228,255,.28);border-radius:11px;background:rgba(61,180,215,.09);color:#dffaff;font-weight:900;letter-spacing:.08em}
.combat-v7-mount .cf2131-target-prompt i{width:9px;height:9px;border-radius:50%;background:#75e9ff;box-shadow:0 0 12px rgba(117,233,255,.72)}
.combat-v7-mount .cv7-reserves{border:1px solid rgba(145,224,255,.13);border-radius:12px;background:rgba(3,17,25,.66)}
@media(max-width:900px){.combat-v7-mount .cv7-values{grid-template-columns:1fr 1fr}.combat-v7-mount .cv7-values span:first-child{grid-column:1/-1}.combat-v7-mount .cv73-command-v2 .cv7-skill{min-height:94px}.combat-v7-mount .cv7-art{max-height:190px}}
@media(max-width:620px){.combat-v7-mount .cv7-art-wrap{min-height:124px}.combat-v7-mount .cv7-art{max-height:150px}.combat-v7-mount .cv73-command-v2 .cv7-skill{grid-template-columns:36px minmax(0,1fr);padding:8px}.combat-v7-mount .cv73-command-v2 .cv7-skill-icon{width:36px;height:36px}.combat-v7-mount .cv73-skill-copy p{display:none}}
`;document.head.appendChild(s)}
function enhanceUnits(m){const units=qsa('[data-cv7-unit]',m);for(const u of units){const name=u.querySelector('.cv7-unit-info>b')?.textContent?.trim()||'Pow';const hp=u.querySelector('.cv7-values span')?.textContent?.trim()||'';const target=u.classList.contains('targetable');u.setAttribute('aria-label',`${target?'Chọn mục tiêu ':''}${name}${hp?` · HP ${hp}`:''}`);u.dataset.cui2131='1'}state.units=units.length}
function enhanceSkills(m){const skills=qsa('.cv73-command-v2 [data-cv7-skill]',m);for(const b of skills){const slot=b.dataset.cv7Skill||'',name=b.querySelector('.cv73-skill-copy b')?.textContent?.trim()||'',cost=b.querySelector('.cv73-skill-meta em')?.textContent?.trim()||'';b.dataset.cui2131Slot=slot;b.setAttribute('aria-label',`${slot==='basic'?'Đòn cơ bản':slot==='skill1'?'Kỹ năng 1':slot==='skill2'?'Kỹ năng 2':slot==='ultimate'?'Tối thượng':slot==='exclusive'?'Độc quyền':slot}: ${name}${cost?` · ${cost}`:''}`)}state.skills=skills.length}
function targetPrompt(m){const dock=m.querySelector('.cv73-command-v2');if(!dock)return;let p=dock.querySelector('.cf2131-target-prompt');const targeting=dock.classList.contains('is-targeting');if(targeting&&!p){p=document.createElement('div');p.className='cf2131-target-prompt';p.innerHTML='<i></i><span>CHỌN MỤC TIÊU</span><small>Pow có viền sáng là mục tiêu hợp lệ</small>';dock.prepend(p);state.targetPrompts++}else if(!targeting&&p)p.remove()}
function patch(reason='event'){raf=0;const v=view(),m=mount();if(!v||v.hidden||!m)return snapshot();installStyle();enhanceUnits(m);enhanceSkills(m);targetPrompt(m);state.patches++;state.lastAt=Date.now();state.lastReason=reason;return snapshot()}
function schedule(reason='event'){if(!raf)raf=requestAnimationFrame(()=>patch(reason))}
function settle(reason='settle'){clearTimeout(settleTimer);settleTimer=setTimeout(()=>{settleTimer=0;schedule(reason)},160)}
function onView(e){const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');if(/battle|combat|boss/i.test(v)){schedule('view');settle('view-settle')}}
function snapshot(){return{version:VERSION,...state,principles:['Pow first','HP/Mana/Rage readable','turn order visible','four core skills stable','target state explicit'],gameplayMutation:false,performance:'event-driven; single coalesced rAF; no polling'}}
function boot(){installStyle();onView({detail:{view:document.body?.dataset?.activeView||''}})}
window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:rendered',()=>schedule('rendered'),{passive:true});window.addEventListener('powder:combat-state',()=>schedule('combat-state'),{passive:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(settleTimer)},{once:true});
window.POWDER_COMBAT_UI_READABILITY_V2131={version:VERSION,snapshot,refresh:()=>patch('manual')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
