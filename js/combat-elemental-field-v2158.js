(()=>{'use strict';
if(window.POWDER_COMBAT_ELEMENTAL_FIELD_V2158)return;
const VERSION='22.0.4-retired';
function loadNext(){if(window.POWDER_COMBAT_ULTIMATE_CAMERA_V2159||document.getElementById('powderCombatUltimateCamera2159'))return;const s=document.createElement('script');s.id='powderCombatUltimateCamera2159';s.src='js/combat-ultimate-camera-v2159.js?v=22014';s.async=true;document.head.appendChild(s)}
function snapshot(){return{version:VERSION,retired:true,reason:'native Combat Scene owns heavy-skill presentation; duplicate elemental field removed',gameplayMutation:false}}
window.POWDER_COMBAT_ELEMENTAL_FIELD_V2158={version:VERSION,snapshot};loadNext();
})();
