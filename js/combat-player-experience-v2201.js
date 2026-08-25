(()=>{'use strict';
if(window.POWDER_COMBAT_PLAYER_EXPERIENCE_V2201)return;
const VERSION='22.0.1',CSS_ID='powderCombatPlayerExperience2201Css',CSS_HREF='css/combat-player-experience-v2201.css?v=2201';
const LEGACY_DECOR='.cfx2151-echo,.cfx2151-spell-trail,.cfx2153-spell-projectile,.cfx2154-clash-ring,.cfx2155-barrier-magic,.cfx2156-aura,.cfx2157-cast-pose,.cfx2157-release-mark,.cfx2158-elemental-field,.cfx2159-spell-camera,.cfx2160-afterglow,.cfx2162-signature-seal';
const state={patches:0,pruned:0,skillLayouts:0,lastAt:0,active:false};let raf=0;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
function style(){let l=document.getElementById(CSS_ID);if(!l){l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';document.head.appendChild(l)}if(!String(l.href).includes('v=2201'))l.href=CSS_HREF}
function mount(){return q('#battleView:not([hidden]) .combat-v7-mount .cv7-scene')?.closest('.combat-v7-mount')||null}
function prune(m){if(!m)return;for(const n of qa(LEGACY_DECOR,m)){n.remove();state.pruned++}}
function skillLayout(m){for(const dock of qa('.cv7-command',m)){const skills=qa('.cv7-skill[data-cv7-skill]',dock);if(!skills.length)continue;const count=Math.max(1,skills.length);if(dock.style.getPropertyValue('--px2201-skill-count')!==String(count)){dock.style.setProperty('--px2201-skill-count',String(count));state.skillLayouts++}}}
function patch(){raf=0;style();const m=mount();state.active=Boolean(m);document.documentElement.classList.toggle('px2201-player-combat',Boolean(m));if(!m)return false;m.dataset.px2201='1';prune(m);skillLayout(m);state.patches++;state.lastAt=Date.now();return true}
function schedule(){if(!raf)raf=requestAnimationFrame(patch)}
['powder:rendered','powder:combat-state','powder:combat-action','powder:view-changed','powder:performance-tier','resize'].forEach(e=>window.addEventListener(e,schedule,{passive:true}));
document.addEventListener('pointerover',e=>{if(e.target?.closest?.('#battleView:not([hidden]) .cv7-skill[data-cv7-skill]'))schedule()},{passive:true,capture:true});
window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);document.documentElement.classList.remove('px2201-player-combat')},{once:true});
function snapshot(){return{version:VERSION,...state,css:CSS_HREF,presentation:'single native scene pipeline; legacy 21.5.x decorative stack suppressed',skillUi:'icon + name only; one detailed inspector',audio:'source CombatAudio engine is authoritative',performance:'event-driven + rAF only; no interval or continuous observer',gameplayMutation:false,damageFormulaMutation:false,skillDataMutation:false,serverMutation:false,saveMutation:false}}
window.POWDER_COMBAT_PLAYER_EXPERIENCE_V2201={version:VERSION,refresh:schedule,snapshot};style();schedule();
})();