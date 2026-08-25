(()=>{'use strict';
if(window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140)return;
const VERSION='21.4.0',LAUNCH_VERSION='21.8.4';
const state={recovered:false,alreadyValid:false,simpleCount:0,expansionCount:0,normalCount:0,specialCount:0,lastAt:0,reason:'boot',combatEntryCompat:false,combatLaunchRequests:0,combatLaunchDeferred:0,combatLaunchSuccess:0,combatLaunchRejected:0,combatLaunchTimeouts:0,lastCombatLaunchError:''};
let launchTimer=0,launchToken=0;
function valid(api){return api&&Object.keys(api.SIMPLE||{}).length===3&&Object.keys(api.EXPANSIONS||{}).length===9}
function currentCombatEntry(){return window.POWDER_BATTLE_PLAYER_V177||null}
function settleAdminCombat(token,attempt=0){
  if(token!==launchToken)return;
  const c=currentCombatEntry()?.getCore?.();
  if(c){for(const u of [...(c.state?.team||[]),...(c.state?.reserves||[]),...(c.state?.enemies||[]),...(c.state?.enemyReserves||[])]){u.mana=u.maxMana;u.rage=100}return}
  if(attempt<24)setTimeout(()=>settleAdminCombat(token,attempt+1),120)
}
function launchCurrentMap(stage){
  const entry=currentCombatEntry();
  if(!entry?.startEncounter)return null;
  try{return entry.startEncounter(stage,'map')===true}catch(e){state.lastCombatLaunchError=String(e?.message||e||'startEncounter-error');return false}
}
function deferMapLaunch(stage){
  const token=++launchToken;let attempt=0;state.combatLaunchDeferred++;clearTimeout(launchTimer);
  const step=()=>{
    if(token!==launchToken)return;
    attempt++;const result=launchCurrentMap(stage);
    if(result===true){state.combatLaunchSuccess++;state.lastCombatLaunchError='';state.lastAt=Date.now();settleAdminCombat(token);return}
    if(result===false){state.combatLaunchRejected++;state.lastCombatLaunchError=state.lastCombatLaunchError||'startEncounter-rejected-stage';state.lastAt=Date.now();return}
    if(attempt>=60){state.combatLaunchTimeouts++;state.lastCombatLaunchError='combat-runtime-ready-timeout';state.lastAt=Date.now();return}
    launchTimer=setTimeout(step,200)
  };
  launchTimer=setTimeout(step,0)
}
function installCombatEntryCompat(){
  const old=window.POWDER_COMBAT_ENTRY_V177;
  if(old?.startMap&&old?.__powderLaunchRecoveryV2184){state.combatEntryCompat=true;return old}
  if(old?.startMap&&!old?.__powderLaunchRecoveryV2184){return old}
  const compat=old&&typeof old==='object'?{...old}:{};
  compat.__powderLaunchRecoveryV2184=true;
  compat.startMap=stage=>{
    state.combatLaunchRequests++;state.lastAt=Date.now();
    if(!stage?.id||Number(stage?.islandId)<1){state.combatLaunchRejected++;state.lastCombatLaunchError='invalid-map-stage';return false}
    const result=launchCurrentMap(stage);
    if(result===true){state.combatLaunchSuccess++;state.lastCombatLaunchError='';settleAdminCombat(++launchToken);return true}
    if(result===false){state.combatLaunchRejected++;state.lastCombatLaunchError=state.lastCombatLaunchError||'startEncounter-rejected-stage';return false}
    state.lastCombatLaunchError='combat-runtime-not-ready';deferMapLaunch(stage);return true
  };
  window.POWDER_COMBAT_ENTRY_V177=compat;state.combatEntryCompat=true;return compat
}
function recover(reason='manual'){
  state.reason=reason;state.lastAt=Date.now();installCombatEntryCompat();
  const existing=window.POWDER_DOMAIN_SYSTEM_V15;
  if(valid(existing)){state.alreadyValid=true;state.simpleCount=Object.keys(existing.SIMPLE).length;state.expansionCount=Object.keys(existing.EXPANSIONS).length;state.normalCount=Object.values(existing.EXPANSIONS).filter(x=>x?.kind==='normal').length;state.specialCount=Object.values(existing.EXPANSIONS).filter(x=>x?.kind==='special').length;return existing}
  const C=window.POWDER_COMBAT_CORE_V7,S=C?.TAMER_SIMPLE||{},E=C?.TAMER_EXPANSIONS||{};
  const simpleIds=Object.keys(S),expansionIds=Object.keys(E),normal=expansionIds.filter(id=>E[id]?.kind==='normal'),special=expansionIds.filter(id=>E[id]?.kind==='special');
  state.simpleCount=simpleIds.length;state.expansionCount=expansionIds.length;state.normalCount=normal.length;state.specialCount=special.length;
  if(simpleIds.length!==3||expansionIds.length!==9||normal.length!==6||special.length!==3)return null;
  const api={version:'15.0.0+recovery-21.4.0',SIMPLE:S,EXPANSIONS:E,LEVELS:C.DOMAIN_LEVELS||{},BRANCH:C.DOMAIN_BRANCHES||{},SWORDS:C.DOMAIN_SWORDS||[],PVP_CAP:C.PVP_DOMAIN_DIRECT_CAP||{},pvpCap:()=>Infinity,lockedSimpleCount:3,lockedExpansionCount:9,normalExpansionCount:6,specialExpansionCount:3,lockedExpansionIds:[...expansionIds],serverVerifiedOnline:['limitless_void','draw_swords','jackpot_bagua'],recoveredExport:true,policy:{simpleModes:['pve','pvp'],expansionModes:['pvp'],durationUnit:'action',source:'Combat Core patched by signed domain-system-v15.js; export recovered post-boot only'}};
  window.POWDER_DOMAIN_SYSTEM_V15=api;window.POWDER_DOMAIN_SYSTEM_V14=api;window.POWDER_DOMAIN_SYSTEM_V13=api;state.recovered=true;
  try{window.dispatchEvent(new CustomEvent('powder:domain-api-recovered',{detail:snapshot()}))}catch(_){}
  return api;
}
function snapshot(){return{version:VERSION,launchRecoveryVersion:LAUNCH_VERSION,...state,valid:valid(window.POWDER_DOMAIN_SYSTEM_V15),currentCombatApi:Boolean(currentCombatEntry()?.startEncounter),mechanicsMutation:false,policy:'restore missing canonical Domain API export + legacy Admin Combat startMap compatibility; bounded deferred launch; no gameplay formula changes'}}
window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140={version:VERSION,recover,installCombatEntryCompat,snapshot};
window.POWDER_COMBAT_LAB_LAUNCH_RECOVERY_V2184={version:LAUNCH_VERSION,snapshot,installCompat:installCombatEntryCompat};
recover('boot');
window.addEventListener('pagehide',()=>{clearTimeout(launchTimer);launchTimer=0;launchToken++},{once:true});
})();
