(()=>{'use strict';
if(window.POWDER_PERFORMANCE_DIRECTOR_V21221)return;
const VERSION='22.1.1-combat-identity-hotfix',root=document.documentElement;
const DISABLED_FX=['21.4.1 fx-fidelity','21.4.2 role-rhythm','21.4.3 impact-sequence','21.4.4 impact-legibility','21.4.5 status-fx','21.4.6 camera-hit','21.4.7 ultimate-identity','21.4.8 fx-budget','21.4.9 magic-circle','21.5.0 grand-magic','21.5.1 spell-chain','21.5.2 magic-finish','21.5.3 spell-projectile','21.5.4 elemental-clash','21.5.5 barrier-magic','21.5.6 magic-scene-director','21.5.7 cast-choreography','21.5.8 elemental-field'];
const state={updates:0,recoveryRequests:0,lastAt:0,lastReason:'boot',goalFps:60,currentFps:60,displayHz:60,headroom:1,status:'stable',stableCombatBoots:0};let timer=0,lastMeasure=0;
function hs(){try{return window.POWDER_HIGH_REFRESH_V21217?.snapshot?.()||{}}catch(_){return{}}}
function fb(){try{return window.POWDER_FRAME_BUDGET_V21218?.snapshot?.()||{}}catch(_){return{}}}
function cg(){try{return window.POWDER_COMBAT_REFRESH_GOVERNOR_V21219?.snapshot?.()||{}}catch(_){return{}}}
function sp(){try{return window.POWDER_SCROLL_PIPELINE_V21220?.snapshot?.()||{}}catch(_){return{}}}
function pressure(){return String(window.POWDER_ADAPTIVE_PRESSURE_V21011?.level?.()||root.dataset.resourcePressure||'calm')}
function collect(reason='event'){
  const h=hs(),hz=Math.max(60,Number(h.displayHz)||60),fps=Math.max(1,Number(h.currentFps)||Number(root.dataset.nativeFps)||60),head=fps/hz,p=pressure();
  state.updates++;state.lastAt=Date.now();state.lastReason=reason;state.goalFps=hz;state.currentFps=fps;state.displayHz=hz;state.headroom=Number(head.toFixed(3));state.status=p==='critical'||fps<48?'recovery':head>=.9?'native':fps>=58?'stable':'guard';
  root.dataset.performanceDirector=state.status;root.dataset.performanceGoalFps=String(Math.round(hz));root.dataset.performanceHeadroom=String(state.headroom);root.dataset.combatPipeline='identity-2211';
  try{window.dispatchEvent(new CustomEvent('powder:performance-director',{detail:snapshot()}))}catch(_){}
  return snapshot();
}
function requestRemeasure(reason='recovery'){const now=Date.now();if(document.hidden||now-lastMeasure<1800)return false;lastMeasure=now;state.recoveryRequests++;clearTimeout(timer);timer=setTimeout(()=>{timer=0;try{window.POWDER_HIGH_REFRESH_V21217?.measure?.()}catch(_){}collect(reason)},650);return true}
function addScript(id,src,globalName){if(window[globalName]||document.getElementById(id))return false;const s=document.createElement('script');s.id=id;s.src=src;s.async=true;document.head.appendChild(s);return true}
function activateCombatFoundation(){return addScript('powderCombatFoundation2130','js/combat-foundation-v2130.js?v=2130','POWDER_COMBAT_FOUNDATION_V2130')}
function activateDomainMenuGuard(){return addScript('powderTamerDomainMenuGuard2133','js/tamer-domain-menu-guard-v2133.js?v=2133','POWDER_TAMER_DOMAIN_MENU_GUARD_V2133')}
function activateRuntimeRecovery(){return addScript('powderRuntimeRecovery2136','js/runtime-recovery-v2136.js?v=2136','POWDER_RUNTIME_RECOVERY_V2136')}
function activateCombatActionClarity(){return addScript('powderCombatActionClarity2138','js/combat-action-clarity-v2138.js?v=2138','POWDER_COMBAT_ACTION_CLARITY_V2138')}
function loadCombatRuntimeQaBridge(){return addScript('powderCombatRuntimeQaBridge2140','js/combat-runtime-qa-bridge-v2140.js?v=2211','POWDER_COMBAT_RUNTIME_QA_BRIDGE_V2140')}
function activateCombatRuntimeQaBridge(){
  if(window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140){window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140.recover?.('qa-bridge');loadCombatRuntimeQaBridge();return true}
  let s=document.getElementById('powderDomainExportRecovery2140');if(s){s.addEventListener('load',loadCombatRuntimeQaBridge,{once:true});return true}
  s=document.createElement('script');s.id='powderDomainExportRecovery2140';s.src='js/domain-system-export-recovery-v2140.js?v=2140';s.async=true;s.addEventListener('load',loadCombatRuntimeQaBridge,{once:true});s.addEventListener('error',loadCombatRuntimeQaBridge,{once:true});document.head.appendChild(s);return true;
}
function activateTurnSafety(){return addScript('powderCombatTurnSafety2207','js/combat-turn-safety-v2207.js?v=2211','POWDER_COMBAT_TURN_SAFETY_V2207')}
function activateStableCombatLayout(){return addScript('powderCombatLayout2200','js/combat-layout-v2200.js?v=2211','POWDER_COMBAT_LAYOUT_V2200')}
function activateStablePlayerExperience(){return addScript('powderCombatPlayerExperience2201','js/combat-player-experience-v2201.js?v=2211','POWDER_COMBAT_PLAYER_EXPERIENCE_V2201')}
function activateRealPlayerBaseline(){return addScript('powderCombatRealPlayerBaseline2205','js/combat-real-player-baseline-v2205.js?v=2211','POWDER_COMBAT_REAL_PLAYER_BASELINE_V2205')}
function activateAncientExclusiveAltar(){return addScript('powderCombatExclusiveAltar2206','js/combat-exclusive-altar-v2206.js?v=2211','POWDER_COMBAT_EXCLUSIVE_ALTAR_V2206')}
function activateCombatIdentityBreakthrough(){return addScript('powderCombatIdentityBreakthrough2210','js/combat-identity-breakthrough-v2210.js?v=2211','POWDER_COMBAT_IDENTITY_BREAKTHROUGH_V2210')}
function retiredFx(){return false}
const activateCombatFxFidelity=retiredFx,activateCombatRoleRhythm=retiredFx,activateCombatImpactSequence=retiredFx,activateCombatImpactLegibility=retiredFx,activateCombatStatusFx=retiredFx,activateCombatCameraHit=retiredFx,activateCombatUltimateIdentity=retiredFx,activateCombatFxBudget=retiredFx,activateCombatMagicCircle=retiredFx,activateCombatGrandMagic=retiredFx,activateCombatSpellChain=retiredFx,activateCombatMagicFinish=retiredFx,activateCombatSpellProjectile=retiredFx,activateCombatElementalClash=retiredFx,activateCombatBarrierMagic=retiredFx,activateCombatMagicSceneDirector=retiredFx,activateCombatCastChoreography=retiredFx,activateCombatElementalField=retiredFx;
function boot(){
  collect('boot');
  activateCombatFoundation();activateDomainMenuGuard();activateRuntimeRecovery();activateCombatActionClarity();activateCombatRuntimeQaBridge();activateTurnSafety();
  activateStableCombatLayout();activateStablePlayerExperience();activateRealPlayerBaseline();activateAncientExclusiveAltar();activateCombatIdentityBreakthrough();
  state.stableCombatBoots++;state.lastAt=Date.now();state.lastReason='combat-identity-2211-boot';
}
function snapshot(){return{version:VERSION,...state,pressure:pressure(),highRefresh:hs(),frameBudget:fb(),combatGovernor:cg(),scrollPipeline:sp(),runtimeRecovery:window.POWDER_RUNTIME_RECOVERY_V2136?.snapshot?.()||null,combatActionClarity:window.POWDER_COMBAT_ACTION_CLARITY_V2138?.snapshot?.()||null,domainExportRecovery:window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140?.snapshot?.()||null,combatRuntimeQaBridge:window.POWDER_COMBAT_RUNTIME_QA_BRIDGE_V2140?.snapshot?.()||null,turnSafety:window.POWDER_COMBAT_TURN_SAFETY_V2207?.snapshot?.()||null,layout:window.POWDER_COMBAT_LAYOUT_V2200?.snapshot?.()||null,playerExperience:window.POWDER_COMBAT_PLAYER_EXPERIENCE_V2201?.snapshot?.()||null,realPlayerBaseline:window.POWDER_COMBAT_REAL_PLAYER_BASELINE_V2205?.snapshot?.()||null,ancientExclusiveAltar:window.POWDER_COMBAT_EXCLUSIVE_ALTAR_V2206?.snapshot?.()||null,combatIdentity:window.POWDER_COMBAT_IDENTITY_BREAKTHROUGH_V2210?.snapshot?.()||null,disabledPresentationModules:[...DISABLED_FX],pipeline:'21.4 stable Combat Scene/Core + 22.0.7 finite scheduler + 22.1.1 deduped pooled element/role/skill identity layer',policy:'Legacy post-21.4 decorative chain stays disabled. 22.1.1 dedupes presentation events and keeps support FX on friendly targets; no gameplay, damage, skill-data, server or save mutation.'}}
function onView(){collect('view');requestRemeasure('view-settle')}
function onRelief(){collect('pressure-relief');requestRemeasure('pressure-relief')}
window.addEventListener('powder:high-refresh-profile',()=>collect('high-refresh'),{passive:true});window.addEventListener('powder:frame-budget',()=>collect('frame-budget'),{passive:true});window.addEventListener('powder:combat-refresh-governor',()=>collect('combat-governor'),{passive:true});window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:pressure-relief',onRelief,{passive:true});window.addEventListener('pageshow',()=>{collect('pageshow');requestRemeasure('pageshow')},{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden){collect('visibility');requestRemeasure('visibility')}else{clearTimeout(timer);timer=0}},{passive:true});window.addEventListener('pagehide',()=>{clearTimeout(timer);timer=0},{once:true});
window.POWDER_PERFORMANCE_DIRECTOR_V21221={version:VERSION,snapshot,refresh:()=>collect('manual'),remeasure:()=>requestRemeasure('manual'),activateCombatFoundation,activateDomainMenuGuard,activateRuntimeRecovery,activateCombatActionClarity,activateCombatRuntimeQaBridge,activateTurnSafety,activateStableCombatLayout,activateStablePlayerExperience,activateRealPlayerBaseline,activateAncientExclusiveAltar,activateCombatIdentityBreakthrough,activateCombatFxFidelity,activateCombatRoleRhythm,activateCombatImpactSequence,activateCombatImpactLegibility,activateCombatStatusFx,activateCombatCameraHit,activateCombatUltimateIdentity,activateCombatFxBudget,activateCombatMagicCircle,activateCombatGrandMagic,activateCombatSpellChain,activateCombatMagicFinish,activateCombatSpellProjectile,activateCombatElementalClash,activateCombatBarrierMagic,activateCombatMagicSceneDirector,activateCombatCastChoreography,activateCombatElementalField};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();