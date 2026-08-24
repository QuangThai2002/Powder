(()=>{'use strict';
const VERSION='21.2.12',BUILD='powder-21.2.12-stability-recovery';
const clone=x=>{try{return structuredClone(x)}catch(_){try{return JSON.parse(JSON.stringify(x))}catch{return x}}},bool=x=>x===true;
function diagnostics(){
 const D=window.POWDER_DATA||{},W=window.POWDER_WORLD_DATA_V9||{},S=window.POWDER_SKILL_V81||{},L=window.POWDER_LEARNING_MASTER_V2||{},A=window.POWDER_ADVENTURE_DATA||{},Core=window.POWDER_COMBAT_CORE_V7||{},pows=D.pows||[],kits=S.pows||{},skills=[];
 for(const k of Object.values(kits))for(const slot of ['basic','skill1','skill2','ultimate'])if(k?.skills?.[slot]?.id)skills.push(String(k.skills[slot].id));
 const bootComplete=document.documentElement.classList.contains('powder-boot-complete'),q=L.activeQuestions?.(D.questions||[])||D.questions||[],badQuestions=q.filter(x=>!x?.id||x.answer==null||!Array.isArray(x.options)||x.options.length<2||!x.options.map(String).includes(String(x.answer))),rarities=['common','rare','super_rare','epic','legendary','mythic','ancient'],artifactCounts=Object.fromEntries(rarities.map(r=>[r,(W.artifacts||[]).filter(x=>x.rarity===r).length])),missingRole=pows.filter(p=>!W.powRoleById?.[p.id]).map(p=>p.id),skillApi=window.POWDER_SKILL_LOADOUT,domainApi=window.POWDER_PROGRESSION_GATE_V1782,domainCore=Core.BattleCore?.prototype,gearBoard=document.querySelector('#gearView .pow-skill-board'),requiredSlots=['basic','skill1','skill2','ultimate'],combatPresentation=window.POWDER_COMBAT_PRESENTATION_V21015?.snapshot?.()||{},combatContent=window.POWDER_COMBAT_CONTENT_UI_V1890,learningHub=window.POWDER_LEARNING_HUB_V149,srs=window.POWDER_SRS_INTELLIGENCE_V2114,pressure=window.POWDER_ADAPTIVE_PRESSURE_V21011,saveIntegrity=window.POWDER_SAVE_INTEGRITY_V20170,security=window.POWDER_SECURITY_STATUS_V20160;
 const gearSlots=gearBoard?[...gearBoard.querySelectorAll('.pow-skill-slot')].map(x=>[...x.classList].find(c=>c.startsWith('slot-kind-'))):[];
 const checks={
  app:!!window.POWDER_APP,
  catalog:pows.length===99&&Object.keys(kits).length===99&&skills.length===396&&new Set(skills).size===396,
  fixedFourSkillRenderer:requiredSlots.every(k=>skillApi?.slots?.includes?.(k)),
  gearSkillBoard:!gearBoard||gearBoard.childElementCount===0||requiredSlots.every(k=>gearBoard.querySelector(`.slot-kind-${k}`)),
  ranks:(D.ranks||[]).length===7,
  learning:(D.lessons||[]).length>=70&&q.length>=10000&&badQuestions.length===0,
  learningRuntimeConsolidated:!bootComplete||!!srs&&(String(srs.runtimePolicy||'').includes('logic-only')&&!window.POWDER_LEARNING_RUNTIME_RECOVERY_V21210),
  learningHubEventDriven:String(learningHub?.mode||'').includes('no-background-rebuild'),
  secureLearningCore:typeof window.POWDER_SECURE_LEARNING_V176?.canonicalQuestionId==='function'&&typeof window.POWDER_SECURE_LEARNING_V176?.activeLessonSessions==='function',
  adventure:(A.islands||[]).length===12,
  adventureCombatUiEventDriven:combatContent?.continuousObserver===false,
  gacha:typeof window.POWDER_APP?.openSummon==='function'||document.getElementById('chestsView')!=null,
  equipment:(W.equipmentSets||[]).length===13&&(W.equipment||[]).length===52&&missingRole.length===0,
  artifacts:(W.artifacts||[]).length===49&&rarities.every(r=>artifactCounts[r]===7)&&!!window.POWDER_ARTIFACT_MODULE,
  domains:Object.keys(Core.TAMER_SIMPLE||{}).length===3&&Object.keys(Core.TAMER_EXPANSIONS||{}).length===9&&!!domainApi?.domainMemory&&!!domainCore?.__sleepingMemoryGate21212,
  domainMemoryInTamer:typeof domainApi?.renderDomainMemories==='function'&&typeof domainApi?.unlockDomain==='function'&&typeof domainApi?.equipDomain==='function'&&typeof domainApi?.syncBattleDomainMenus==='function',
  pve:!!window.POWDER_COMBAT_ENTRY_V177&&!!window.POWDER_SERVER_COMBAT_V1862,
  combatEntryRecovery:String(window.POWDER_COMBAT_ENTRY_V177?.version||'').includes('21.2.12'),
  combatPresentationScoped:String(window.POWDER_COMBAT_PRESENTATION_V21015?.version||'').includes('21.2.12')&&combatPresentation.scopedObserver===true,
  pvp:!!window.POWDER_PVP_V1881,
  boss:!!window.POWDER_BOSS_COMBAT_V1861||!!window.POWDER_SERVER_COMBAT_V1862,
  events:!!window.POWDER_LIVEOPS_V156,
  economy:!!window.POWDER_SECURE_ECONOMY_V152&&!!window.POWDER_TX_SAFETY_V2090,
  inventory:!!window.POWDER_INVENTORY_V159&&!!window.POWDER_SERVER_MUTATION_V20110,
  rank:!!window.POWDER_RANK_SYSTEM,
  cloudSave:!!window.POWDER_ONLINE_V150&&(!bootComplete||!!saveIntegrity),
  security:!bootComplete||!!security,
  performance:(!bootComplete||!!pressure&&String(pressure.mode||'').includes('event-driven'))&&(!!window.POWDER_PERFORMANCE_V1757||!!window.POWDER_PRODUCTION_READINESS_V1910),
  gameplayFreeze:!!window.POWDER_COMBAT_RC_V1900,
  recoveryCss:!!document.getElementById('powderStabilityRecovery21212'),
  logo:!!document.querySelector('#brandBtn img[src*="powder-logo-project.webp"]')
 };
 return{version:VERSION,buildId:BUILD,at:Date.now(),bootComplete,pass:Object.values(checks).every(bool),checks,details:{pows:pows.length,kits:Object.keys(kits).length,skills:skills.length,uniqueSkills:new Set(skills).size,lessons:(D.lessons||[]).length,questions:q.length,badQuestions:badQuestions.slice(0,10).map(x=>x.id||'(missing id)'),islands:(A.islands||[]).length,equipmentSets:(W.equipmentSets||[]).length,equipment:(W.equipment||[]).length,missingRoleMappings:missingRole,artifacts:(W.artifacts||[]).length,artifactCounts,gearSlots,domainSimple:Object.keys(Core.TAMER_SIMPLE||{}),domainExpansion:Object.keys(Core.TAMER_EXPANSIONS||{}),learningRuntimePolicy:srs?.runtimePolicy||'pending-post-boot',learningHubMode:learningHub?.mode||'',pressureMode:pressure?.mode||'pending-core-tail',combatPresentationVersion:window.POWDER_COMBAT_PRESENTATION_V21015?.version||'',combatContentVersion:combatContent?.version||'',saveIntegrityLoaded:!!saveIntegrity,securityLoaded:!!security}}
}
function publish(reason='manual'){const report=diagnostics();try{window.dispatchEvent(new CustomEvent('powder:full-game-regression-ready',{detail:{...report,reason}}))}catch(_){}return report}
function schedulePostBootAudit(){const run=()=>setTimeout(()=>publish('post-boot'),1200);if(document.documentElement.classList.contains('powder-boot-complete'))return run();if(typeof MutationObserver!=='function')return;const o=new MutationObserver(()=>{if(!document.documentElement.classList.contains('powder-boot-complete'))return;o.disconnect();run()});o.observe(document.documentElement,{attributes:true,attributeFilter:['class']})}
const api=Object.freeze({version:VERSION,buildId:BUILD,diagnostics,publish,state:()=>clone(diagnostics())});window.POWDER_FULL_GAME_REGRESSION_V20180=api;publish('initial-core');schedulePostBootAudit();
})();
