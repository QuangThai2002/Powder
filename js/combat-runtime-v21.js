(()=>{'use strict';
const modules=new Map();
const LIMITS=Object.freeze({moduleEvents:160,securityAudit:96,securityChecksums:32,networkHistory:96,balanceRows:1200,metaRows:40});
const RAGE_POINTS=Object.freeze({version:'rage-points-v1',ready:4,max:8,actionGain:2,ultimateCost:4,exclusiveCost:4,overflowRate:.5});
let activeCore=null;

function stable(value,depth=0){if(depth>7)return '"[depth]"';if(value===null||value===undefined)return JSON.stringify(value??null);if(typeof value==='number'||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);if(Array.isArray(value))return '['+value.slice(0,64).map(x=>stable(x,depth+1)).join(',')+']';if(value instanceof Map)return stable([...value.entries()],depth+1);if(typeof value==='object'){const keys=Object.keys(value).sort().slice(0,96);return '{'+keys.map(k=>JSON.stringify(k)+':'+stable(value[k],depth+1)).join(',')+'}';}return JSON.stringify(String(value));}
function hashText(text){let h=2166136261>>>0;for(let i=0;i<String(text).length;i++){h^=String(text).charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');}
function hash(value){return hashText(stable(value));}
function compactResourceMap(u){if(!(u?.resources instanceof Map))return[];return [...u.resources.entries()].slice(0,16).map(([id,r])=>[id,Number(r?.current)||0,Number(r?.max)||0]);}
function compactUnit(u){return{id:u?.id||'',powId:u?.powId||'',side:u?.side||'',hp:Math.round(Number(u?.hp)||0),maxHp:Math.round(Number(u?.maxHp)||0),shield:Math.round(Number(u?.shield)||0),ragePoints:sanitizeRage(u?.ragePoints),meter:Math.round((Number(u?.meter)||0)*1000)/1000,defeated:Boolean(u?.defeated),statuses:Object.keys(u?.statuses||{}).sort(),custom:Object.keys(u?.customStatuses||{}).sort(),resources:compactResourceMap(u)};}
function compactCore(core){if(!core)return null;return{seed:Number(core.seed)||0,serial:Number(core.serial)||0,mode:core.mode||'',phase:core.state?.phase||'',round:Number(core.state?.round)||0,turn:Number(core.state?.turnCount)||0,currentId:core.state?.current?.id||null,result:core.state?.result||null,resourceSystem:RAGE_POINTS.version,units:(core.allRosterUnits||core.allUnits||[]).slice(0,10).map(compactUnit)};}
function coreHash(core){return hash(compactCore(core));}
function register(name,api){if(!name||!api)return api;modules.set(String(name),api);return api;}
function get(name){return modules.get(String(name));}
function list(){return [...modules.keys()];}
async function batched(total,worker,{chunk=4,onProgress}={}){total=Math.max(0,Number(total)||0);chunk=Math.max(1,Number(chunk)||1);for(let i=0;i<total;i++){await worker(i);onProgress?.(i+1,total);if((i+1)%chunk===0)await new Promise(resolve=>(typeof requestAnimationFrame==='function'?requestAnimationFrame(()=>resolve()):setTimeout(resolve,0)));}}

function sanitizeRage(value){return Math.min(RAGE_POINTS.max,Math.max(0,Math.floor(Number.isFinite(Number(value))?Number(value):0)));}
function applyRawRageGain(current,rawGain){
  const previous=sanitizeRage(current),raw=Math.max(0,Math.floor(Number(rawGain)||0));
  const room=Math.max(0,RAGE_POINTS.ready-previous),normalRaw=Math.min(room,raw),overflowRaw=Math.max(0,raw-normalRaw),overflowEffective=Math.floor(overflowRaw*RAGE_POINTS.overflowRate);
  const next=sanitizeRage(previous+normalRaw+overflowEffective);
  return{previous,rawGain:raw,normalRaw,overflowRaw,overflowEffective,effectiveGain:next-previous,next};
}
function markerStates(value){
  const points=sanitizeRage(value),red=Math.max(0,points-RAGE_POINTS.ready),blue=Math.max(0,points-red*2),empty=Math.max(0,4-blue-red);
  return[...Array(blue).fill('blue'),...Array(red).fill('red'),...Array(empty).fill('empty')].slice(0,4);
}
function legacyRageValue(points){const p=sanitizeRage(points);return p>=RAGE_POINTS.ready?100:p*25;}
function syncLegacyUnit(unit){
  if(!unit)return unit;
  unit.ragePoints=sanitizeRage(unit.ragePoints);
  // Compatibility only. Legacy consumers may still read these fields, but they
  // are no longer authoritative and Mana is permanently disabled.
  unit.mana=0;unit.maxMana=0;unit.rage=legacyRageValue(unit.ragePoints);
  return unit;
}
function recoveryPoints(row){
  if(Number.isFinite(Number(row?.ragePoints)))return sanitizeRage(row.ragePoints);
  const legacy=Math.max(0,Number(row?.rage)||0);
  return sanitizeRage(Math.round(legacy/25));
}
function normalizeCore(core,{fresh=false,packet=null}={}){
  if(!core)return core;
  activeCore=core;API.activeCore=core;
  const rows=new Map((packet?.runtime?.units||[]).map(row=>[row?.id,row]));
  for(const unit of core.allRosterUnits||core.allUnits||[]){
    if(fresh)unit.ragePoints=0;
    else if(rows.has(unit.id))unit.ragePoints=recoveryPoints(rows.get(unit.id));
    else if(!Number.isFinite(Number(unit.ragePoints)))unit.ragePoints=recoveryPoints(unit);
    syncLegacyUnit(unit);
  }
  scheduleUiPatch();
  return core;
}
function rageGainForKey(key){return key==='basic'||key==='skill1'||key==='skill2'?RAGE_POINTS.actionGain:0;}
function rageCostForKey(key){return key==='ultimate'?RAGE_POINTS.ultimateCost:key==='exclusive'?RAGE_POINTS.exclusiveCost:0;}
function findUnit(id){return(activeCore?.allRosterUnits||activeCore?.allUnits||[]).find(unit=>unit?.id===id)||null;}

const patchedCoreApis=new WeakSet();
function installUnifiedRage(coreApi){
  if(!coreApi||typeof coreApi!=='object'||typeof coreApi.BattleCore!=='function'||patchedCoreApis.has(coreApi))return coreApi;
  patchedCoreApis.add(coreApi);
  const OriginalBattleCore=coreApi.BattleCore,proto=OriginalBattleCore.prototype;
  const originalAbilityCost=proto.abilityCost;
  const originalCanUse=proto.canUse;
  const originalActionInfo=proto.actionInfo;
  const originalExecuteAction=proto.executeAction;
  const originalGrantMana=proto.grantMana;
  const originalProcessMechanicEvent=proto.processMechanicEvent;
  const originalAiAbilityScore=proto.aiAbilityScore;
  const originalIntegrationRecoverySnapshot=proto.integrationRecoverySnapshot;
  const originalReplaySnapshot=proto.replaySnapshot;

  proto.abilityCost=function(unit,key){
    if(key==='basic'||key==='skill1'||key==='skill2'||key==='ultimate'||key==='exclusive')return 0;
    return typeof originalAbilityCost==='function'?originalAbilityCost.call(this,unit,key):0;
  };
  proto.canUse=function(unit,key){
    if(!unit||unit.defeated||this.state?.finished)return false;
    if(!Number.isFinite(Number(unit.ragePoints)))unit.ragePoints=recoveryPoints(unit);
    const cost=rageCostForKey(key);
    if(cost>0&&sanitizeRage(unit.ragePoints)<cost)return false;
    const legacyRage=unit.rage;
    if(cost>0)unit.rage=100;
    try{return typeof originalCanUse==='function'?Boolean(originalCanUse.call(this,unit,key)):true;}
    finally{unit.rage=legacyRage;}
  };
  proto.actionInfo=function(unit,key){
    const info=typeof originalActionInfo==='function'?originalActionInfo.call(this,unit,key):{key,ability:this.ability?.(unit,key),available:this.canUse(unit,key)};
    return{...info,cost:0,resourceSystem:RAGE_POINTS.version,ragePoints:sanitizeRage(unit?.ragePoints),rageCost:rageCostForKey(key),rageGain:rageGainForKey(key),rageReady:RAGE_POINTS.ready,rageMax:RAGE_POINTS.max};
  };
  proto.grantMana=function(unit){
    // TURN_REGEN, BASIC_REGEN and KILL_REWARD were the only Core callers.
    // Unified Rage deliberately removes all three automatic Mana sources.
    if(unit){unit.mana=0;unit.maxMana=0;}
    return 0;
  };
  proto.processMechanicEvent=function(event,payload={},units=null){
    if(payload&&typeof payload==='object'&&payload.requiresMana){payload={...payload,requiresMana:false,cost:0,resourceSystem:RAGE_POINTS.version};}
    return typeof originalProcessMechanicEvent==='function'?originalProcessMechanicEvent.call(this,event,payload,units):[];
  };
  proto.executeAction=function(attacker,key,requestedTargetId,knowledge={baseWrong:0,extraCorrect:0}){
    if(attacker&&!Number.isFinite(Number(attacker.ragePoints)))attacker.ragePoints=recoveryPoints(attacker);
    const before=sanitizeRage(attacker?.ragePoints),spent=rageCostForKey(key);
    if(spent>0&&before<spent)throw new Error(`${attacker?.name||'Pow'} cần ${spent} Nộ để dùng ${key}.`);
    let result;
    try{result=originalExecuteAction.call(this,attacker,key,requestedTargetId,knowledge);}
    catch(error){if(attacker){attacker.ragePoints=before;syncLegacyUnit(attacker);}throw error;}
    if(attacker){
      const afterSpend=Math.max(0,before-spent),gain=applyRawRageGain(afterSpend,rageGainForKey(key));
      attacker.ragePoints=gain.next;
      for(const unit of this.allRosterUnits||this.allUnits||[])syncLegacyUnit(unit);
      this.pushEvent?.('rage',{sourceId:attacker.id,targetId:attacker.id,before,after:gain.next,max:RAGE_POINTS.max,spent,amount:gain.effectiveGain,delta:gain.next-before,reason:key,rawGain:gain.rawGain});
    }
    scheduleUiPatch();
    return result;
  };
  proto.aiAbilityScore=function(unit,key){
    const mana=unit?.mana,maxMana=unit?.maxMana;
    if(unit){unit.mana=100;unit.maxMana=100;}
    try{return typeof originalAiAbilityScore==='function'?originalAiAbilityScore.call(this,unit,key):0;}
    finally{if(unit){unit.mana=mana;unit.maxMana=maxMana;}}
  };
  proto.integrationRecoverySnapshot=function(){
    const packet=originalIntegrationRecoverySnapshot.call(this);
    packet.resourceSystem=RAGE_POINTS.version;
    for(const row of packet?.runtime?.units||[]){const unit=(this.allRosterUnits||[]).find(u=>u.id===row.id);row.ragePoints=sanitizeRage(unit?.ragePoints);row.mana=0;row.maxMana=0;row.rage=legacyRageValue(row.ragePoints);}
    return packet;
  };
  proto.replaySnapshot=function(){
    const packet=originalReplaySnapshot.call(this);packet.resourceSystem=RAGE_POINTS.version;
    const byId=new Map((this.allRosterUnits||[]).map(u=>[u.id,u]));
    for(const side of ['player','enemy'])for(const row of packet?.finalState?.[side]||[]){const unit=byId.get(row.id);row.ragePoints=sanitizeRage(unit?.ragePoints);}
    return packet;
  };

  function UnifiedBattleCore(options){const core=new OriginalBattleCore(options);return normalizeCore(core,{fresh:true});}
  UnifiedBattleCore.prototype=OriginalBattleCore.prototype;
  try{Object.setPrototypeOf(UnifiedBattleCore,OriginalBattleCore);}catch(_){/* old browser fallback */}
  coreApi.BattleCore=UnifiedBattleCore;

  const restoreBattleRecovery=coreApi.restoreBattleRecovery;
  if(typeof restoreBattleRecovery==='function')coreApi.restoreBattleRecovery=function(packet){return normalizeCore(restoreBattleRecovery.call(coreApi,packet),{packet});};
  const restoreRecovery=coreApi.restoreRecovery;
  if(typeof restoreRecovery==='function')coreApi.restoreRecovery=function(packet){return normalizeCore(restoreRecovery.call(coreApi,packet),{packet});};

  coreApi.manaCost=()=>0;
  coreApi.RAGE_POINTS=RAGE_POINTS;
  coreApi.resourceSystem=RAGE_POINTS.version;
  coreApi.MANA_DISABLED=true;
  coreApi.applyRawRageGain=applyRawRageGain;
  coreApi.rageMarkerStates=markerStates;
  coreApi.syncLegacyRageUnit=syncLegacyUnit;
  register('unified-rage',coreApi);
  return coreApi;
}

function installCoreExportInterceptor(){
  const key='POWDER_COMBAT_CORE_V7';
  const existing=window[key];
  let value=existing?installUnifiedRage(existing):existing;
  try{
    Object.defineProperty(window,key,{configurable:true,enumerable:true,get(){return value;},set(next){value=installUnifiedRage(next);}});
  }catch(_){if(existing)window[key]=installUnifiedRage(existing);}
}

let uiPatchQueued=false;
function ensureUiStyles(){
  if(typeof document==='undefined'||document.getElementById('powder-rage-points-style'))return;
  const style=document.createElement('style');style.id='powder-rage-points-style';style.textContent=`
    .combat-v7-session .cv7-bars>i.mana,.combat-v7-session .cv7-bars>i.rage{display:none!important}
    .combat-v7-session .cv7-values>span:nth-child(2){display:none!important}
    .combat-v7-session .cv24-rage-markers{display:flex;gap:5px;align-items:center;justify-content:center;margin-top:5px;min-height:12px}
    .combat-v7-session .cv24-rage-marker{width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:1px solid rgba(220,236,244,.34);background:rgba(56,76,88,.48);box-shadow:none}
    .combat-v7-session .cv24-rage-marker.blue{background:#52c8ff;border-color:#a6e8ff;box-shadow:0 0 7px rgba(82,200,255,.55)}
    .combat-v7-session .cv24-rage-marker.red{background:#ff5f67;border-color:#ffc0c3;box-shadow:0 0 8px rgba(255,95,103,.62)}
    .combat-v7-session .cv7-values>span:nth-child(3){font-weight:800;letter-spacing:.03em}
  `;document.head?.appendChild(style);
}
function patchUnitUi(el){
  const unit=findUnit(el?.dataset?.cv7Unit);if(!unit)return;
  const points=sanitizeRage(unit.ragePoints),states=markerStates(points),sig=states.join('|');
  const bars=el.querySelector('.cv7-bars');
  if(bars){let markers=el.querySelector('.cv24-rage-markers');if(!markers){markers=document.createElement('div');markers.className='cv24-rage-markers';bars.insertAdjacentElement('afterend',markers);}
    if(markers.dataset.rageSig!==sig){markers.dataset.rageSig=sig;markers.title=`Nộ ${points}`;markers.innerHTML=states.map(state=>`<i class="cv24-rage-marker ${state}"></i>`).join('');}}
  const vals=el.querySelectorAll('.cv7-values span');if(vals[2]&&vals[2].textContent!==`NỘ ${points}`)vals[2].textContent=`NỘ ${points}`;
}
function patchSkillUi(button,current){
  const key=button?.dataset?.cv7Skill;if(!key)return;
  const points=sanitizeRage(current?.ragePoints),cost=rageCostForKey(key),gain=rageGainForKey(key);
  const metas=button.querySelectorAll('.cv73-skill-meta em');
  const resourceLabel=cost?`TỐN ${cost} NỘ`:`+${gain} NỘ`;
  if(metas[0]&&metas[0].textContent!==resourceLabel)metas[0].textContent=resourceLabel;
  const stateDetail=button.querySelector('.cv69-skill-state i');if(stateDetail&&cost&&points<cost&&stateDetail.textContent!==`${points}/${cost}`)stateDetail.textContent=`${points}/${cost}`;
  const fill=button.querySelector('.cv69-skill-resource i');if(fill)fill.style.width=cost?`${Math.min(100,Math.round(points/cost*100))}%`:'100%';
}
function patchCommandUi(command){
  const current=activeCore?.state?.current;if(!current)return;
  const em=command.querySelector('.cv7-active em');
  if(em){let text=String(em.textContent||'');text=text.replace(/Mana\s+\d+\/\d+\s*·\s*/i,'').replace(/Nộ\s+\d+(?:\/100)?/i,`Nộ ${sanitizeRage(current.ragePoints)}`);if(em.textContent!==text)em.textContent=text;}
  for(const button of command.querySelectorAll('.cv7-skill[data-cv7-skill]'))patchSkillUi(button,current);
}
function patchCombatUi(){
  uiPatchQueued=false;if(typeof document==='undefined'||!document.documentElement.classList.contains('combat-v7-session'))return;
  ensureUiStyles();for(const el of document.querySelectorAll('.cv7-unit[data-cv7-unit]'))patchUnitUi(el);for(const command of document.querySelectorAll('.cv7-command'))patchCommandUi(command);
}
function scheduleUiPatch(){if(uiPatchQueued||typeof document==='undefined')return;uiPatchQueued=true;(typeof requestAnimationFrame==='function'?requestAnimationFrame:setTimeout)(patchCombatUi);}
function startUiBridge(){
  if(typeof document==='undefined')return;ensureUiStyles();const start=()=>{try{new MutationObserver(scheduleUiPatch).observe(document.documentElement,{childList:true,subtree:true});}catch(_){/* no observer */}scheduleUiPatch();};
  if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
}

const API={version:'24.0-rage-points',LIMITS,RAGE_POINTS,stable,hashText,hash,compactUnit,compactCore,coreHash,register,get,list,batched,sanitizeRage,applyRawRageGain,rageMarkerStates:markerStates,installUnifiedRage,activeCore};
window.POWDER_COMBAT_RUNTIME_V21=API;register('runtime',API);installCoreExportInterceptor();startUiBridge();
})();