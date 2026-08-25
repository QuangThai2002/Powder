(()=>{'use strict';
if(window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140)return;
const VERSION='21.4.0',LAUNCH_VERSION='21.8.6',SKILL_VERSION='21.8.7',ACK_KEY='powder_admin_real_combat_ack_v2186',DIRECT_CLASS='powder-admin-combat-direct-v2186',DIRECT_STYLE_ID='powderAdminCombatDirectStyle2186';
const state={recovered:false,alreadyValid:false,simpleCount:0,expansionCount:0,normalCount:0,specialCount:0,lastAt:0,reason:'boot',combatEntryCompat:false,combatLaunchRequests:0,combatLaunchDeferred:0,combatLaunchSuccess:0,combatLaunchRejected:0,combatLaunchTimeouts:0,combatMountTimeouts:0,combatAutoStarts:0,combatRunningAcks:0,knowledgePlanCompact:false,knowledgeAutoAnswers:0,knowledgeAutoCasts:0,adminDirectPlay:false,skillInspectorRequested:false,lastCombatLaunchError:'',lastAckStatus:'',lastAckAt:0};
let launchTimer=0,launchToken=0,autoStartTimer=0,knowledgeTimer=0,knowledgeToken=0,adminStage=null;
function valid(api){return api&&Object.keys(api.SIMPLE||{}).length===3&&Object.keys(api.EXPANSIONS||{}).length===9}
function loadSkillInspector2187(){
  if(state.skillInspectorRequested)return;state.skillInspectorRequested=true;
  if(!document.querySelector('link[data-powder-skill-inspector="2187"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='css/combat-skill-inspector-v2187.css?v=2187';l.dataset.powderSkillInspector='2187';document.head?.appendChild(l)}
  if(!document.querySelector('script[data-powder-skill-inspector="2187"]')){const s=document.createElement('script');s.src='js/combat-skill-inspector-v2187.js?v=2187';s.async=true;s.dataset.powderSkillInspector='2187';document.head?.appendChild(s)}
}
function currentCombatEntry(){return window.POWDER_BATTLE_PLAYER_V177||null}
function combatNonce(stage){const id=String(stage?.id||'');return id.startsWith('admin-real-')?id.slice('admin-real-'.length):''}
function writeAck(stage,status,error=''){
  const nonce=combatNonce(stage);if(!nonce)return false;
  const payload={version:LAUNCH_VERSION,nonce,status:String(status||''),error:String(error||''),at:Date.now()};
  try{localStorage.setItem(ACK_KEY,JSON.stringify(payload));state.lastAckStatus=payload.status;state.lastAckAt=payload.at;return true}catch(_){return false}
}
function installDirectStyle(){
  if(document.getElementById(DIRECT_STYLE_ID))return;
  const s=document.createElement('style');s.id=DIRECT_STYLE_ID;s.textContent=`html.${DIRECT_CLASS} #battleView .cv7-question,html.${DIRECT_CLASS} #battleView .cv7-combo-choice{opacity:0!important;pointer-events:none!important}html.${DIRECT_CLASS} #battleView .cv7-env-notice:after{content:'ADMIN · DIRECT COMBAT · CÂU HỎI HỌC ĐƯỢC TỰ BỎ QUA';display:inline-flex;margin-left:6px;padding:3px 7px;border:1px solid rgba(118,224,255,.22);border-radius:999px;color:#a8ecff;font-size:8px;font-weight:900;letter-spacing:.06em}`;
  document.head?.appendChild(s)
}
function activateDirectPlay(stage){
  if(!combatNonce(stage))return false;
  adminStage=stage;state.adminDirectPlay=true;installDirectStyle();document.documentElement.classList.add(DIRECT_CLASS);return true
}
function clearDirectPlay(){
  state.adminDirectPlay=false;adminStage=null;document.documentElement.classList.remove(DIRECT_CLASS);clearTimeout(autoStartTimer);clearTimeout(knowledgeTimer);autoStartTimer=0;knowledgeTimer=0;knowledgeToken++
}
function removeLaunchFailure(){document.getElementById('powderCombatLabLaunchFailure2186')?.remove()}
function showLaunchFailure(stage,error){
  if(!combatNonce(stage)||document.getElementById('powderCombatLabLaunchFailure2186'))return;
  const el=document.createElement('div');el.id='powderCombatLabLaunchFailure2186';el.style.cssText='position:fixed;z-index:218600;left:50%;top:18px;transform:translateX(-50%);max-width:min(720px,calc(100vw - 28px));padding:13px 15px;border:1px solid rgba(255,112,132,.42);border-radius:14px;background:rgba(30,8,15,.96);box-shadow:0 18px 46px rgba(0,0,0,.44);color:#fff;font:700 12px/1.45 system-ui,sans-serif';
  el.innerHTML=`<b style="display:block;margin-bottom:4px;color:#ffb6c2">Combat Lab 21.8.6 không thể vào trận</b><span>${String(error||'runtime-error').replace(/[<>]/g,'')}</span><button type="button" style="display:block;margin-top:9px;padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:#35111b;color:#fff;font-weight:800;cursor:pointer">Quay lại Admin</button>`;
  el.querySelector('button').onclick=()=>{try{if(window.opener&&!window.opener.closed){window.opener.focus();window.close();return}}catch(_){}location.href='admin.html#combatlab'};document.body?.appendChild(el)
}
function battleMounted(c){
  if(!c)return false;const s=c.state||{},player=[...(s.team||[]),...(s.reserves||[])],enemy=[...(s.enemies||[]),...(s.enemyReserves||[])];
  const scene=document.querySelector('#battleView:not([hidden]) .combat-v7-mount .cv7-scene');return Boolean(player.length&&enemy.length&&scene)
}
function installAdminKnowledgePlan(c){
  if(!c)return false;const P=Object.getPrototypeOf(c);if(!P||P.__powderAdminActionInfoV2186){state.knowledgePlanCompact=true;return true}
  const old=P.actionInfo;if(typeof old!=='function')return false;
  Object.defineProperty(P,'__powderAdminActionInfoV2186',{value:old,configurable:true});
  P.actionInfo=function(...args){const info=old.apply(this,args);if(!this.__powderAdminRealTestV2140||!info?.plan)return info;return{...info,plan:{...info.plan,base:1,max:1}}};
  state.knowledgePlanCompact=true;return true
}
function armKnowledgeBypass(){
  if(!state.adminDirectPlay)return;const token=++knowledgeToken;clearTimeout(knowledgeTimer);let attempt=0,idle=0;
  const step=()=>{
    if(token!==knowledgeToken||!state.adminDirectPlay)return;
    attempt++;const root=document.querySelector('#battleView:not([hidden]) .combat-v7-mount');
    if(!root){if(attempt<40)knowledgeTimer=setTimeout(step,120);return}
    const answer=root.querySelector('.cv7-question [data-cv7-answer="0"]:not(:disabled)');
    if(answer){state.knowledgeAutoAnswers++;idle=0;answer.click();knowledgeTimer=setTimeout(step,120);return}
    const cast=root.querySelector('.cv7-combo-choice [data-cv7-cast]');
    if(cast){state.knowledgeAutoCasts++;cast.click();return}
    if(root.querySelector('.cv7-question,.cv7-combo-choice')||idle++<8){if(attempt<48)knowledgeTimer=setTimeout(step,120)}
  };
  knowledgeTimer=setTimeout(step,36)
}
function waitAdminRunning(token,stage,c,attempt=0){
  if(token!==launchToken||!state.adminDirectPlay)return;
  const phase=String(c?.state?.phase||'');const scene=document.querySelector('#battleView:not([hidden]) .combat-v7-mount .cv7-scene');
  if(scene&&phase&&phase!=='ready'){state.combatRunningAcks++;state.lastCombatLaunchError='';state.lastAt=Date.now();removeLaunchFailure();writeAck(stage,'running');return}
  if(attempt<50){setTimeout(()=>waitAdminRunning(token,stage,c,attempt+1),120);return}
  state.lastCombatLaunchError='combat-auto-start-timeout';state.lastAt=Date.now();writeAck(stage,'failed',state.lastCombatLaunchError);showLaunchFailure(stage,state.lastCombatLaunchError)
}
function autoStartAdminBattle(token,stage,c){
  if(token!==launchToken)return;
  if(!combatNonce(stage)){writeAck(stage,'mounted');return}
  installAdminKnowledgePlan(c);clearTimeout(autoStartTimer);
  autoStartTimer=setTimeout(async()=>{
    if(token!==launchToken||!state.adminDirectPlay)return;
    const entry=currentCombatEntry();
    try{
      state.combatAutoStarts++;
      if(String(c?.state?.phase||'')==='ready')await entry?.launch?.();
      waitAdminRunning(token,stage,c,0)
    }catch(e){
      state.lastCombatLaunchError=String(e?.message||e||'combat-auto-start-error');state.lastAt=Date.now();writeAck(stage,'failed',state.lastCombatLaunchError);showLaunchFailure(stage,state.lastCombatLaunchError)
    }
  },320)
}
function settleAdminCombat(token,stage,attempt=0){
  if(token!==launchToken)return;
  const c=currentCombatEntry()?.getCore?.();
  if(battleMounted(c)){
    for(const u of [...(c.state?.team||[]),...(c.state?.reserves||[]),...(c.state?.enemies||[]),...(c.state?.enemyReserves||[])]){u.mana=u.maxMana;u.rage=100}
    removeLaunchFailure();writeAck(stage,'mounted');autoStartAdminBattle(token,stage,c);return
  }
  if(attempt<50){setTimeout(()=>settleAdminCombat(token,stage,attempt+1),120);return}
  state.combatMountTimeouts++;state.lastCombatLaunchError='combat-scene-mount-timeout';state.lastAt=Date.now();writeAck(stage,'failed',state.lastCombatLaunchError);showLaunchFailure(stage,state.lastCombatLaunchError)
}
function launchCurrentMap(stage){
  const entry=currentCombatEntry();
  if(!entry?.startEncounter)return null;
  try{return entry.startEncounter(stage,'map')===true}catch(e){state.lastCombatLaunchError=String(e?.message||e||'startEncounter-error');return false}
}
function deferMapLaunch(stage){
  const token=++launchToken;let attempt=0;state.combatLaunchDeferred++;clearTimeout(launchTimer);activateDirectPlay(stage);writeAck(stage,'waiting');
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
  if(old?.startMap&&old?.__powderLaunchRecoveryV2186){state.combatEntryCompat=true;return old}
  if(old?.startMap&&!old?.__powderLaunchRecoveryV2184&&!old?.__powderLaunchRecoveryV2185&&!old?.__powderLaunchRecoveryV2186){return old}
  const compat=old&&typeof old==='object'?{...old}:{};
  compat.__powderLaunchRecoveryV2184=true;compat.__powderLaunchRecoveryV2185=true;compat.__powderLaunchRecoveryV2186=true;
  compat.startMap=stage=>{
    state.combatLaunchRequests++;state.lastAt=Date.now();activateDirectPlay(stage);
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
function snapshot(){return{version:VERSION,launchRecoveryVersion:LAUNCH_VERSION,...state,valid:valid(window.POWDER_DOMAIN_SYSTEM_V15),currentCombatApi:Boolean(currentCombatEntry()?.startEncounter),mechanicsMutation:false,skillInspectorVersion:SKILL_VERSION,policy:'restore canonical Domain API + Admin Combat compatibility + rendered-scene handshake + auto-start + event-bounded learning bypass + event-driven skill inspector loader; no production gameplay formula changes'}}
const launchApi={version:LAUNCH_VERSION,snapshot,installCompat:installCombatEntryCompat,armKnowledgeBypass};
window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140={version:VERSION,recover,installCombatEntryCompat,snapshot};
window.POWDER_COMBAT_LAB_LAUNCH_RECOVERY_V2184=launchApi;
window.POWDER_COMBAT_LAB_LAUNCH_RECOVERY_V2185=launchApi;
window.POWDER_COMBAT_LAB_LAUNCH_RECOVERY_V2186=launchApi;
recover('boot');loadSkillInspector2187();
document.addEventListener('click',e=>{if(!state.adminDirectPlay)return;const b=e.target?.closest?.('[data-cv7-skill],[data-cv7-unit]');if(b)setTimeout(armKnowledgeBypass,0)},true);
window.addEventListener('powder:view-changed',e=>{const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');if(state.adminDirectPlay&&v&&v!=='battle')clearDirectPlay()},{passive:true});
window.addEventListener('pagehide',()=>{clearTimeout(launchTimer);clearTimeout(autoStartTimer);clearTimeout(knowledgeTimer);launchTimer=0;autoStartTimer=0;knowledgeTimer=0;launchToken++;clearDirectPlay()},{once:true});
})();