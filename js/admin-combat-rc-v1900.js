(()=>{'use strict';
const VERSION='21.8.3';
function render(){return window.POWDER_ADMIN_COMBAT_MANUAL_V2183?.mount?.()||false}
function checks(){return [['Manual vs AI Combat Lab',Boolean(window.POWDER_ADMIN_COMBAT_MANUAL_V2183),'21.8.3'],['Old QA widgets disabled',true,'disabled']]}
function loadModernCombatQa(){return false}
function boot(){render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.POWDER_ADMIN_COMBAT_RC_V1900={version:VERSION,render,checks,loadModernCombatQa,policy:'Combat Lab 21.8.3 only launches manual random-team PvE against Tactical AI; legacy QA/telemetry/auto-sim loaders disabled'};
})();