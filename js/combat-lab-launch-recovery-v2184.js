(()=>{'use strict';
if(window.POWDER_COMBAT_LAB_LAUNCH_RECOVERY_V2184)return;
const VERSION='21.8.4',PARAM='combatTest',MAX_ATTEMPTS=60,STEP_MS=200;
const state={intent:false,attempts:0,ready:false,compatInstalled:false,launchCalls:0,launchSuccess:0,lastError:'',lastAt:0};
let timer=0,done=false;
function hasIntent(){try{return Boolean(new URL(location.href).searchParams.get(PARAM))}catch(_){return false}}
function current(){return window.POWDER_BATTLE_PLAYER_V177||null}
function prerequisites(){return Boolean(window.POWDER_APP&&current()?.startEncounter)}
function installCompat(){
  const existing=window.POWDER_COMBAT_ENTRY_V177;
  if(existing?.__powderLaunchRecoveryV2184&&typeof existing.startMap==='function'){state.compatInstalled=true;return existing}
  const compat=existing&&typeof existing==='object'?{...existing}:{};
  compat.__powderLaunchRecoveryV2184=true;
  compat.startMap=function(stage){
    state.launchCalls++;state.lastAt=Date.now();
    const api=current();
    if(!api?.startEncounter){state.lastError='combat-runtime-not-ready';return false}
    try{
      const ok=api.startEncounter(stage,'map')===true;
      if(ok){state.launchSuccess++;state.lastError=''}else state.lastError='startEncounter-rejected-stage';
      return ok;
    }catch(e){state.lastError=String(e?.message||e||'startEncounter-error');return false}
  };
  window.POWDER_COMBAT_ENTRY_V177=compat;state.compatInstalled=true;return compat
}
function removeError(){document.getElementById('powderCombatLaunchError2184')?.remove()}
function showError(){
  if(document.getElementById('powderCombatLaunchError2184'))return;
  const el=document.createElement('div');el.id='powderCombatLaunchError2184';
  el.style.cssText='position:fixed;z-index:218400;left:50%;top:18px;transform:translateX(-50%);max-width:min(680px,calc(100vw - 28px));padding:12px 15px;border:1px solid rgba(255,120,120,.45);border-radius:14px;background:rgba(31,9,14,.96);box-shadow:0 16px 42px rgba(0,0,0,.42);color:#fff;font:700 12px/1.45 system-ui,sans-serif';
  el.textContent='Combat Lab chưa thể khởi động Combat runtime. Hãy đóng tab này, Ctrl+F5 trang Admin rồi thử Bắt đầu trận lại.';
  document.body?.appendChild(el)
}
function finish(cb,ok){
  if(done)return;done=true;clearTimeout(timer);timer=0;state.ready=ok;state.lastAt=Date.now();
  if(ok){removeError();installCompat()}else showError();
  try{cb?.(ok)}catch(e){console.warn('[Combat Lab 21.8.4]',e)}
}
function whenReady(cb){
  state.intent=hasIntent();installCompat();
  if(!state.intent){finish(cb,true);return}
  const step=()=>{
    state.attempts++;state.lastAt=Date.now();installCompat();
    if(prerequisites()){finish(cb,true);return}
    if(state.attempts>=MAX_ATTEMPTS){state.lastError='runtime-ready-timeout';finish(cb,false);return}
    timer=setTimeout(step,STEP_MS)
  };
  step()
}
function snapshot(){return{version:VERSION,...state,hasIntent:hasIntent(),prerequisitesReady:prerequisites(),currentApi:Boolean(current()?.startEncounter),legacyCompat:Boolean(window.POWDER_COMBAT_ENTRY_V177?.startMap),boundedWaitMs:MAX_ATTEMPTS*STEP_MS,policy:'Admin Combat Lab compatibility only; current startEncounter(map); bounded readiness wait; no save/reward/learning/PvP mutation'}}
window.POWDER_COMBAT_LAB_LAUNCH_RECOVERY_V2184={version:VERSION,whenReady,installCompat,snapshot};
installCompat();
})();
