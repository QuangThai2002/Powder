import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const files={
  skill:read('js/skill-loadout.js'),secure:read('js/secure-learning-v176.js'),srs:read('js/learning-srs-intelligence-v2114.js'),hub:read('js/learning-hub-v149.js'),pressure:read('js/adaptive-runtime-pressure-v21011.js'),presentation:read('js/combat-presentation-v21015.js'),content:read('js/combat-content-ui-v1890.js'),entry:read('js/combat-entry-v177.js'),progression:read('js/progression-unlocks-v1782.js'),domain:read('js/domain-system-v15.js'),regression:read('js/full-game-regression-v20180.js'),sw:read('service-worker.js'),css:read('css/stability-recovery-v21212.css'),index:read('index.html')
};
const unwantedLearning=['learning-daily-study-orchestrator-v2115.js','learning-mastery-recovery-v2116.js','learning-daily-rotation-runner-v2119.js','learning-command-center-v2120.js','learning-performance-hardening-v2125.js','learning-session-continuity-v2126.js','admin-learning-event-control-v2127.js','learning-production-v2128.js','runtime-clean-presentation-v2129.js','learning-runtime-recovery-v21210.js','wheel-input-recovery-v21211.js'];
const simpleIds=['crimson','tide','verdant'];
const expansionIds=['nine_suns','infinite_strike','limitless_void','frozen_silence','diamond_guard','jackpot_bagua','myriad_poison','rebirth_wood','draw_swords'];
const protectedAudio=['assets/audio/combat/user-combat-bgm.mp3','assets/audio/domain/domain-voice-usercut-1.m4a','assets/audio/domain/domain-voice-usercut-2.m4a','assets/audio/domain/domain-voice-usercut-3.m4a','assets/audio/domain/domain-voice-usercut-4.m4a'];
const check=(name,ok,detail='')=>({name,ok:!!ok,detail});
const checks=[
  check('recoveryVersion',files.regression.includes("VERSION='21.2.12'")&&files.sw.includes("BUILD='21212'")),
  check('logoAssetStillReferenced',files.index.includes('assets/ui/powder-logo-project.webp')&&files.css.includes('.brand-logo-only')),
  check('fixedFourSkillRenderer',['basic','skill1','skill2','ultimate'].every(k=>files.skill.includes(`'${k}'`))&&files.skill.includes("renderViews=new Set(['inventory','powdex','gear'])")&&files.skill.includes('decoratePanels')),
  check('v81SkillFallback',files.skill.includes("p.abilities?.basic||k?.skills?.basic")&&files.skill.includes("p.abilities?.skills?.[0]||k?.skills?.skill1")&&files.skill.includes("p.abilities?.skills?.[1]||k?.skills?.skill2")&&files.skill.includes("p.abilities?.ultimate||k?.skills?.ultimate")),
  check('secureLessonAliasCore',files.secure.includes('candidateQuestionIds')&&files.secure.includes('canonicalQuestionId')&&files.secure.includes('activeLessonSessions')&&files.secure.includes('questionAliases')),
  check('learningRuntimeConsolidated',files.srs.includes("runtimePolicy:'logic-only; no stacked Learning dashboard runtimes'")&&!unwantedLearning.some(x=>files.srs.includes(x))),
  check('learningHubNoBackgroundRebuild',files.hub.includes('lessonModalOpen')&&files.hub.includes('dirtyWhileLesson')&&files.hub.includes('event-driven-21.2.12-no-background-rebuild')&&!files.hub.includes("#lessonActionBtn,[data-close=\"lessonModal\"]")),
  check('pressureEventDriven',files.pressure.includes("mode:'event-driven-no-polling'")&&!files.pressure.includes('setInterval(')),
  check('combatPresentationScoped',files.presentation.includes("VERSION='21.2.12-combat-scoped'")&&files.presentation.includes("document.querySelector('#battleView')")&&!files.presentation.includes('observe(document.body')&&files.presentation.includes('scopedObserver:true')),
  check('adventureObserverRemoved',files.content.includes('continuousObserver:false')&&!files.content.includes('new MutationObserver')),
  check('preBattleSingleLaunch',files.entry.includes('combatReadyLaunch21212')&&files.entry.includes('native.hidden=ready')&&files.entry.includes('applyTamerMemory')&&files.entry.includes('native.click()')),
  check('sleepingMemoryDefaults',files.progression.includes('unlockedSimple:[]')&&files.progression.includes('unlockedExpansion:[]')&&files.progression.includes('equippedSimple:null')&&files.progression.includes('equippedExpansion:null')),
  check('rankGateDirection',files.progression.includes('function captureBuildLock(e){if(buildUnlocked())return;')&&!files.progression.includes('function captureBuildLock(e){if(!buildUnlocked())return;')),
  check('domainMemoryPlayerGate',files.progression.includes('__sleepingMemoryGate21212')&&files.progression.includes('syncBattleDomainMenus')&&files.progression.includes('candidate!==m.equippedSimple')&&files.progression.includes('candidate!==m.equippedExpansion')),
  check('canonicalDomainCount',simpleIds.every(x=>files.domain.includes(`${x}:{`))&&expansionIds.every(x=>files.domain.includes(`${x}:{`))&&simpleIds.length===3&&expansionIds.length===9),
  check('preBattleDomainPickerHidden',files.css.includes('#battleView .cv76-tamer-loadout{display:none!important}')),
  check('gearRecoveryLayout',files.css.includes('.eq-command-center')&&files.css.includes('.pow-skill-board')&&files.css.includes('overflow-x:hidden')),
  check('lessonModalScrollRecovery',files.css.includes('#lessonModal .modal-body')&&files.css.includes('overscroll-behavior:contain')),
  check('serviceWorkerNetworkFirstCode',files.sw.includes('if(sensitive){try{const response=await fetchWithRetry')&&files.sw.includes('forceReload:true')&&files.sw.includes('const keep=new Set([SHELL,RUNTIME])')),
  check('oldBootPreloadPurged',files.sw.includes("const PRELOAD=`powder-assets-v21004`")&&files.sw.includes('for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&!keep.has(key))await caches.delete(key)')),
  check('bootOrderSafeRegression',files.regression.includes("classList.contains('powder-boot-complete')")&&files.regression.includes('schedulePostBootAudit')&&files.regression.includes("publish('post-boot')")&&files.regression.includes('1200')),
  check('legacyRegressionCoveragePreserved',files.regression.includes('gacha:')&&files.regression.includes('missingRoleMappings')&&files.regression.includes('cloudSave:')&&files.regression.includes('security:')&&files.regression.includes('gameplayFreeze:')),
  check('behaviorRegressionExpanded',files.regression.includes('learningHubEventDriven')&&files.regression.includes('adventureCombatUiEventDriven')&&files.regression.includes('combatPresentationScoped')&&files.regression.includes('fixedFourSkillRenderer')),
  check('canonicalAudioPresent',protectedAudio.every(p=>fs.existsSync(p)))
];
const failed=checks.filter(x=>!x.ok);
for(const [i,c] of checks.entries())console.log(`${String(i+1).padStart(2,'0')}. ${c.ok?'PASS':'FAIL'} ${c.name}${c.detail?` · ${c.detail}`:''}`);
console.log(`\nPowder 21.2.12 Stability Recovery Gate: ${checks.length-failed.length}/${checks.length} passed.`);
if(failed.length){console.error('Failed:',failed.map(x=>x.name).join(', '));process.exit(1)}
