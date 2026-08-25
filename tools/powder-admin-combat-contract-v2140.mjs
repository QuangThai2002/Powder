import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const lab=read('js/admin-combat-lab-v1882.js');
const launcher=read('js/admin-combat-real-launcher-v2140.js');
const bridge=read('js/combat-runtime-qa-bridge-v2140.js');
const director=read('js/performance-director-v21221.js');
const adminLoader=read('js/admin-capacity-guard-v21004.js');
const domain=read('js/domain-system-v15.js');
const scroll=read('js/page-scroll-recovery-v2137.js');
const scrollPipeline=read('js/scroll-pipeline-v21220.js');
const css=read('css/admin-combat-lab-v1882.css');

const simpleIds=['crimson','tide','verdant'];
const domainIds=['nine_suns','infinite_strike','frozen_silence','diamond_guard','myriad_poison','rebirth_wood','limitless_void','jackpot_bagua','draw_swords'];
const specialIds=['limitless_void','jackpot_bagua','draw_swords'];
const oldTokens=['cl177','Packet / AI / Boss Diagnostics','cl1882-legacy'];
const ticketKey='powder_admin_real_combat_ticket_v2140';
const resultKey='powder_admin_real_combat_result_v2140';

const checks={
  lab2139Preserved:lab.includes("const VERSION='21.3.9'")&&lab.includes('P.length===99')&&lab.includes('roles.size>=9')&&lab.includes('skills>=396'),
  legacyCombatToolsStayRemoved:oldTokens.every(token=>!lab.includes(token))&&!css.includes('.cl1882-'),
  realLauncher2140:launcher.includes("const VERSION='21.4.0'")&&launcher.includes('POWDER_ADMIN_COMBAT_REAL_LAUNCHER_V2140'),
  realBridge2140:bridge.includes("const VERSION='21.4.0'")&&bridge.includes('POWDER_COMBAT_RUNTIME_QA_BRIDGE_V2140'),
  oneShotTicket:launcher.includes(ticketKey)&&bridge.includes(ticketKey)&&launcher.includes('expiresAt:Date.now()+60000')&&bridge.includes('localStorage.removeItem(TICKET_KEY)'),
  resultRoundTrip:launcher.includes(resultKey)&&bridge.includes(resultKey)&&launcher.includes("window.addEventListener('storage'"),
  actualPlayerCombat:bridge.includes('POWDER_COMBAT_ENTRY_V177')&&bridge.includes('entry.startMap(buildStage(t))')&&bridge.includes('POWDER_BATTLE_PLAYER_V177?.getCore'),
  practiceNoReward:bridge.includes('practiceNoReward:true')&&bridge.includes('rewards:{coins:0,exp:0}'),
  learningIsolated:bridge.includes("a.grantLearningProgress=()=>({adminTest:true,mutated:false})"),
  rewardIsolated:bridge.includes("a.grantBattleRewards=()=>({coins:0,exp:0,adminTest:true})"),
  adventureIsolated:bridge.includes("a.updateAdventure=()=>({adminTest:true,mutated:false})"),
  appRestored:bridge.includes('function restoreApp()')&&bridge.includes('for(const [k,v] of Object.entries(originalApp))a[k]=v'),
  noServerPvpTicket:!launcher.includes('serverCombatSessionId')&&!bridge.includes('SC()?.act')&&!bridge.includes('POWDER_SERVER_COMBAT'),
  noContinuousPolling:!launcher.includes('setInterval(')&&!bridge.includes('setInterval('),
  performanceCaptured:bridge.includes('getPerformance?.()')&&launcher.includes('perf.fps'),
  canonical3Simple:simpleIds.every(id=>domain.includes(`${id}:`))&&domain.includes('lockedSimpleCount:3'),
  canonical9Expansion:domainIds.every(id=>domain.includes(`${id}:`))&&domain.includes('lockedExpansionCount:9')&&domain.includes('normalExpansionCount:6')&&domain.includes('specialExpansionCount:3'),
  canonicalSpecials:specialIds.every(id=>bridge.includes(id)||launcher.includes(id)),
  canonicalDomainEvents:bridge.includes("e?.type==='domain-simple'")&&bridge.includes("e?.type==='domain-expansion'")&&bridge.includes("type:'tamer-expansion'"),
  actionDurationUi:bridge.includes("lab.textContent='HÀNH ĐỘNG'")&&bridge.includes('durationActions'),
  playerLoaderWired:director.includes('combat-runtime-qa-bridge-v2140.js?v=2140')&&director.includes('activateCombatRuntimeQaBridge'),
  adminLoaderWired:adminLoader.includes('admin-combat-real-launcher-v2140.js?v=2140'),
  scrollRecoveryPreserved:scroll.includes("ROOT_CLASS='powder-main-scroll-v2137'")&&scroll.includes('overflow-y:auto!important')&&scroll.includes('repairModalLock'),
  scrollPipelineWired:scrollPipeline.includes('page-scroll-recovery-v2137.js?v=2137'),
  scrollNativeNoWheelHijack:!scroll.includes('preventDefault()')&&!scroll.includes('scrollTop+=')&&!scroll.includes('scrollTop -=')
};

const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={version:'21.4.0',contract:'admin-real-combat-runtime-and-scroll-regression',checks,failed,pass:failed.length===0};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
