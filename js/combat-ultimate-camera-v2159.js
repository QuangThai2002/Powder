(()=>{'use strict';
if(window.POWDER_COMBAT_ULTIMATE_CAMERA_V2159)return;
const VERSION='22.0.4-retired';
function loadNext(){if(window.POWDER_COMBAT_ARCANE_POLISH_V2160||document.getElementById('powderCombatArcanePolish2160'))return;const s=document.createElement('script');s.id='powderCombatArcanePolish2160';s.src='js/combat-arcane-polish-v2160.js?v=22014';s.async=true;document.head.appendChild(s)}
function snapshot(){return{version:VERSION,retired:true,reason:'native Combat Scene camera director is authoritative; duplicate ultimate overlay removed',gameplayMutation:false}}
window.POWDER_COMBAT_ULTIMATE_CAMERA_V2159={version:VERSION,snapshot};loadNext();
})();
