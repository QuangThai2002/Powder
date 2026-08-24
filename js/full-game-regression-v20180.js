(()=>{'use strict';
const VERSION='20.18.0',BUILD='powder-20.18.0-full-game-regression-rc1';
const clone=x=>{try{return structuredClone(x)}catch(_){try{return JSON.parse(JSON.stringify(x))}catch{return x}}};
function bool(x){return x===true}
function diagnostics(){
 const D=window.POWDER_DATA||{},W=window.POWDER_WORLD_DATA_V9||{},S=window.POWDER_SKILL_V81||{},L=window.POWDER_LEARNING_MASTER_V2||{},A=window.POWDER_ADVENTURE_DATA||{};
 const pows=D.pows||[],kits=S.pows||{},skills=[];for(const k of Object.values(kits))for(const slot of ['basic','skill1','skill2','ultimate'])if(k?.skills?.[slot]?.id)skills.push(String(k.skills[slot].id));
 const q=L.activeQuestions?.(D.questions||[])||D.questions||[],missingRole=pows.filter(p=>!W.powRoleById?.[p.id]).map(p=>p.id),badQuestions=q.filter(x=>!x?.id||x.answer==null||!Array.isArray(x.options)||x.options.length<2||!x.options.map(String).includes(String(x.answer)));
 const rarities=['common','rare','super_rare','epic','legendary','mythic','ancient'],artifactCounts=Object.fromEntries(rarities.map(r=>[r,(W.artifacts||[]).filter(x=>x.rarity===r).length]));
 const checks={
  app:!!window.POWDER_APP,
  catalog:pows.length===99&&Object.keys(kits).length===99&&skills.length===396&&new Set(skills).size===396,
  ranks:(D.ranks||[]).length===7,
  learning:(D.lessons||[]).length>=70&&q.length>=10000&&badQuestions.length===0,
  adventure:(A.islands||[]).length===12,
  gacha:typeof window.POWDER_APP?.openSummon==='function'||document.getElementById('chestsView')!=null,
  equipment:(W.equipmentSets||[]).length===13&&(W.equipment||[]).length===52&&missingRole.length===0,
  artifacts:(W.artifacts||[]).length===49&&rarities.every(r=>artifactCounts[r]===7)&&!!window.POWDER_ARTIFACT_MODULE,
  pve:!!window.POWDER_COMBAT_ENTRY_V177&&!!window.POWDER_SERVER_COMBAT_V1862,
  pvp:!!window.POWDER_PVP_V1881,
  boss:!!window.POWDER_BOSS_COMBAT_V1861||!!window.POWDER_SERVER_COMBAT_V1862,
  events:!!window.POWDER_LIVEOPS_V156,
  economy:!!window.POWDER_SECURE_ECONOMY_V152&&!!window.POWDER_TX_SAFETY_V2090,
  inventory:!!window.POWDER_INVENTORY_V159&&!!window.POWDER_SERVER_MUTATION_V20110,
  rank:!!window.POWDER_RANK_SYSTEM,
  cloudSave:!!window.POWDER_ONLINE_V150&&!!window.POWDER_SAVE_INTEGRITY_V20170,
  security:!!window.POWDER_SECURITY_STATUS_V20160,
  performance:!!window.POWDER_PERFORMANCE_V1757||!!window.POWDER_PRODUCTION_READINESS_V1910,
  gameplayFreeze:!!window.POWDER_COMBAT_RC_V1900,
 };
 return{version:VERSION,buildId:BUILD,at:Date.now(),pass:Object.values(checks).every(bool),checks,details:{pows:pows.length,kits:Object.keys(kits).length,skills:skills.length,uniqueSkills:new Set(skills).size,ranks:(D.ranks||[]).length,lessons:(D.lessons||[]).length,questions:q.length,badQuestions:badQuestions.slice(0,10).map(x=>x.id||'(missing id)'),islands:(A.islands||[]).length,equipmentSets:(W.equipmentSets||[]).length,equipment:(W.equipment||[]).length,artifacts:(W.artifacts||[]).length,artifactCounts,missingRoleMappings:missingRole}};
}
const api=Object.freeze({version:VERSION,buildId:BUILD,diagnostics,state:()=>clone(diagnostics())});window.POWDER_FULL_GAME_REGRESSION_V20180=api;
try{window.dispatchEvent(new CustomEvent('powder:full-game-regression-ready',{detail:diagnostics()}))}catch(_){ }
})();
