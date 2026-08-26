(()=>{'use strict';
if(window.POWDER_COMBAT_PLAYER_EXPERIENCE_V2201)return;
const VERSION='22.0.5-stable-baseline',CSS_ID='powderCombatPlayerExperience2201Css',CSS_HREF='css/combat-player-stable-v2205.css?v=2205';
const state={patches:0,skillLayouts:0,lastAt:0,active:false,timerGovernor:false,audioOverride:false,legacyPruning:false};
let raf=0;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
function style(){let l=document.getElementById(CSS_ID);if(!l){l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';document.head.appendChild(l)}if(!String(l.href).includes('combat-player-stable-v2205.css')||!String(l.href).includes('v=2205'))l.href=CSS_HREF}
function mount(){return q('#battleView:not([hidden]) .combat-v7-mount .cv7-scene')?.closest('.combat-v7-mount')||null}
function skillLayout(m){for(const dock of qa('.cv7-command',m)){const skills=qa('.cv7-skill[data-cv7-skill]',dock);if(!skills.length)continue;const count=Math.max(1,skills.length);if(dock.style.getPropertyValue('--px2201-skill-count')!==String(count)){dock.style.setProperty('--px2201-skill-count',String(count));state.skillLayouts++}}}
function patch(){raf=0;style();const m=mount();state.active=Boolean(m);document.documentElement.classList.toggle('px2201-player-combat',Boolean(m));if(!m)return false;m.dataset.px2201='stable-baseline';skillLayout(m);state.patches++;state.lastAt=Date.now();return true}
function schedule(){if(!raf)raf=requestAnimationFrame(patch)}
['powder:rendered','powder:combat-state','powder:combat-action','powder:view-changed','resize'].forEach(e=>window.addEventListener(e,schedule,{passive:true}));
window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);document.documentElement.classList.remove('px2201-player-combat')},{once:true});
function snapshot(){return{version:VERSION,...state,css:CSS_HREF,presentation:'single stable player layout over native Combat Scene',timing:'NATIVE — window.setTimeout is never replaced',audio:'NATIVE — POWDER_COMBAT_AUDIO is never muted or replaced',domMutation:'no action/FX nodes removed',performance:'event-driven + requestAnimationFrame only',gameplayMutation:false,damageFormulaMutation:false,skillDataMutation:false,serverMutation:false,saveMutation:false}}
window.POWDER_COMBAT_PLAYER_EXPERIENCE_V2201={version:VERSION,refresh:schedule,snapshot};style();schedule();
})();
