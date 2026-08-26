(()=>{'use strict';
if(window.POWDER_COMBAT_REAL_PLAYER_BASELINE_V2205)return;
const VERSION='22.0.5',PARAM='combatTest';
const state={attempts:0,normalizations:0,unitsNormalized:0,lastAt:0,lastReason:'boot',active:false};
const isAdminReal=()=>{try{return Boolean(new URL(location.href).searchParams.get(PARAM))}catch(_){return false}};
const core=()=>{try{return window.POWDER_BATTLE_PLAYER_V177?.getCore?.()||null}catch(_){return null}};
function normalize(reason='scheduled'){
  state.attempts++;state.lastAt=Date.now();state.lastReason=reason;
  if(!isAdminReal())return false;
  const c=core(),s=c?.state;if(!c||!s||s.phase!=='ready'||c.__powderRealBaseline2205)return false;
  const units=[...(s.team||[]),...(s.reserves||[]),...(s.enemies||[]),...(s.enemyReserves||[])];
  let n=0;
  for(const u of units){
    if(!u)continue;
    const maxMana=Math.max(0,Number(u.maxMana)||0);
    u.mana=Math.round(maxMana*.68);
    u.rage=30;
    u.meter=0;
    n++;
  }
  Object.defineProperty(c,'__powderRealBaseline2205',{value:true,configurable:true});
  state.active=true;state.normalizations++;state.unitsNormalized+=n;state.lastAt=Date.now();state.lastReason=reason;
  try{window.dispatchEvent(new CustomEvent('powder:combat-state',{detail:{reason:'real-player-baseline-2205'}}))}catch(_){}
  const bar=document.getElementById('powderAdminRealCombat2140');
  if(bar){const span=bar.querySelector('span');if(span)span.textContent='Combat Core + renderer thật · tài nguyên khởi đầu như người chơi · không Save · không Reward · không Learning';}
  return true;
}
function boundedBoot(){
  if(!isAdminReal())return;
  [180,360,620,980,1450].forEach((ms,i)=>setTimeout(()=>normalize(`boot-${i+1}`),ms));
}
window.addEventListener('powder:view-changed',()=>{if(isAdminReal())setTimeout(()=>normalize('view'),180)},{passive:true});
window.addEventListener('powder:rendered',()=>{if(isAdminReal())setTimeout(()=>normalize('rendered'),0)},{passive:true,once:true});
function snapshot(){return{version:VERSION,...state,policy:'Admin Real Combat mirrors normal player resource start only; no gameplay formula mutation',manaStartRatio:.68,rageStart:30,meterStart:0,adminOnly:true,polling:false}}
window.POWDER_COMBAT_REAL_PLAYER_BASELINE_V2205={version:VERSION,normalize,snapshot};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boundedBoot,{once:true});else boundedBoot();
})();
