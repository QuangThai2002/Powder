(()=>{'use strict';
if(window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140)return;
const VERSION='21.4.0',LAUNCH_VERSION='21.8.5',ACK_KEY='powder_admin_real_combat_ack_v2185';
const state={recovered:false,alreadyValid:false,simpleCount:0,expansionCount:0,normalCount:0,specialCount:0,lastAt:0,reason:'boot',combatEntryCompat:false,combatLaunchRequests:0,combatLaunchDeferred:0,combatLaunchSuccess:0,combatLaunchRejected:0,combatLaunchTimeouts:0,combatMountTimeouts:0,lastCombatLaunchError:'',lastAckStatus:'',lastAckAt:0};
let launchTimer=0,launchToken=0;
function valid(api){return api&&Object.keys(api.SIMPLE||{}).length===3&&Object.keys(api.EXPANSIONS||{}).length===9}
function currentCombatEntry(){return window.POWDER_BATTLE_PLAYER_V177||null}
function combatNonce(stage){const id=String(stage?.id||'');return id.startsWith('admin-real-')?id.slice('admin-real-'.length):''}
function writeAck(stage,status,error=''){
  const nonce=combatNonce(stage);if(!nonce)return false;
  const payload={version:LAUNCH_VERSION,nonce,status:String(status||''),error:String(error||''),at:Date.now()};
  try{localStorage.setItem(ACK_KEY,JSON.stringify(payload));state.lastAckStatus=payload.status;state.lastAckAt=payload.at;return true}catch(_){return false}
}
function removeLaunchFailure(){document.getElementById('powderCombatLabLaunchFailure2185')?.remove()}
function showLaunchFailure(stage,error){
  if(!combatNonce(stage)||document.getElementById('powderCombatLabLaunchFailure2185'))return;
  const el=document.createElement('div');el.id='powderCombatLabLaunchFailure2185';el.style.cssText='position:fixed;z-index:218500;left:50%;top:18px;transform:translateX(-50%);max-width:min(720px,calc(100vw - 28px));padding:13px 15px;border:1px solid rgba(255,112,132,.42);border-radius:14px;background:rgba(30,8,15,.96);box-shadow:0 18px 46px rgba(0,0,0,.44);color:#fff;font:700 12px/1.45 system-ui,sans-serif';
  el.innerHTML=`<b style="display:block;margin-bottom:4px;color:#ffb6c2">Combat Lab 21.8.5 không thể dựng trận</b><span>${String(error||'runtime-error').replace(/[<>]/g,'')}</span><button type="button" style="display:block;margin-top:9px;padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:#35111b;color:#fff;font-weight:800;cursor:pointer">Quay lại Admin</button>`;
  el.querySelector('button').onclick=()=>{try{if(window.opener&&!window.opener.closed){window.opener.focus();window.close();return}}catch(_){}location.href='admin.html#combatlab'};document.body?.appendChild(el)
}
function settleAdminCombat(token,stage,attempt=0){
  if(token!==launchToken)return;
  const c=currentCombatEntry()?.getCore?.();
  if(c){for(const u of [...(c.state?.team||[]),...(c.state?.reserves||[]),...(c.state?.enemies||[]),...(c.state?.enemyReserves||[])]){u.mana=u.maxMana;u.rage=100}removeLaunchFailure();writeAck(stage,'mounted');return}
  if(attempt<50){setTimeout(()=>settleAdminCombat(token,stage,attempt+1),120);return}
  state.combatMountTimeouts++;state.lastCombatLaunchError='combat-core-mount-timeout';state.lastAt=Date.now();writeAck(stage,'failed',state.lastCombatLaunchError);showLaunchFailure(stage,state.lastCombatLaunchError)
}
function launchCurrentMap(stage){
  const entry=currentCombatEntry();
  if(!entry?.startEncounter)return null;
  try{return entry.startEncounter(stage,'map')===true}catch(e){state.lastCombatLaunchError=String(e?.message||e||'startEncounter-error');return false}
}
function deferMapLaunch(stage){
  const token=++launchToken;let attempt=0;state.combatLaunchDeferred++;clearTimeout(launchTimer);writeAck(stage,'waiting');
  const step=()=>{
    if(token!==launchToken)return;
    attempt++;const result=launchCurrentMap(stage);
    if(result===true){state.combatLaunchSuccess++;state.lastCombatLaunchError='';state.lastAt=Date.now();writeAck(stage,'accepted');settleAdminCombat(token,stage);return}
    if(result===false){state.combatLaunchRejected++;state.lastCombatLaunchError=state.lastCombatLaunchError||'startEncounter-rejected-stage';state.lastAt=Date.now();writeAck(stage,'failed',state.lastCombatLaunchError);showLaunchFailure(stage,state.lastCombatLaunchError);return}
    if(attempt>=60){state.combatLaunchTimeouts++;state.lastCombatLaunchError='combat-runtime-ready-timeout';state.lastAt=Date.now();writeAck(stage,'failed',state.lastCombatLaunchError);showLaunchFailure(stage,state.lastCombatLaunchError);return}
    launchTimer=setTimeout(step,200)
  };
  launchTimer=setTimeout(step,0)
}
function installCombatEntryCompat(){
  const old=window.POWDER_COMBAT_ENTRY_V177;
  if(old?.startMap&&old?.__powderLaunchRecoveryV2185){state.combatEntryCompat=true;return old}
  if(old?.startMap&&!old?.__powderLaunchRecoveryV2184&&!old?.__powderLaunchRecoveryV2185){return old}
  const compat=old&&typeof old==='object'?{...old}:{};
  compat.__powderLaunchRecoveryV2184=true;compat.__powderLaunchRecoveryV2185=true;
  compat.startMap=stage=>{
    state.combatLaunchRequests++;state.lastAt=Date.now();
    if(!stage?.id||Number(stage?.islandId)<1){state.combatLaunchRejected++;state.lastCombatLaunchError='invalid-map-stage';writeAck(stage,'failed',state.lastCombatLaunchError);return false}
    const result=launchCurrentMap(stage);
    if(result===true){state.combatLaunchSuccess++;state.lastCombatLaunchError='';writeAck(stage,'accepted');settleAdminCombat(++launchToken,stage);return true}
    if(result===false){state.combatLaunchRejected++;state.lastCombatLaunchError=state.lastCombatLaunchError||'startEncounter-rejected-stage';writeAck(stage,'failed',state.lastCombatLaunchError);showLaunchFailure(stage,state.lastCombatLaunchError);return false}
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
function snapshot(){return{version:VERSION,launchRecoveryVersion:LAUNCH_VERSION,...state,valid:valid(window.POWDER_DOMAIN_SYSTEM_V15),currentCombatApi:Boolean(currentCombatEntry()?.startEncounter),mechanicsMutation:false,policy:'restore missing canonical Domain API export + Admin Combat startMap compatibility + nonce mount handshake; bounded deferred launch; no gameplay formula changes'}}
window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140={version:VERSION,recover,installCombatEntryCompat,snapshot};
window.POWDER_COMBAT_LAB_LAUNCH_RECOVERY_V2184={version:LAUNCH_VERSION,snapshot,installCompat:installCombatEntryCompat};
window.POWDER_COMBAT_LAB_LAUNCH_RECOVERY_V2185={version:LAUNCH_VERSION,snapshot,installCompat:installCombatEntryCompat};
recover('boot');
window.addEventListener('pagehide',()=>{clearTimeout(launchTimer);launchTimer=0;launchToken++},{once:true});
})();