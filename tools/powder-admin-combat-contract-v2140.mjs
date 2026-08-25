import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const lab=read('js/admin-combat-lab-v1882.js');
const bridge=read('js/combat-runtime-qa-bridge-v2140.js');
const domainRecovery=read('js/domain-system-export-recovery-v2140.js');
const director=read('js/performance-director-v21221.js');
const domain=read('js/domain-system-v15.js');
const scroll=read('js/page-scroll-recovery-v2137.js');
const scrollPipeline=read('js/scroll-pipeline-v21220.js');
const rc=read('js/admin-combat-rc-v1900.js');
const css=read('css/admin-combat-lab-v1882.css');
const simpleIds=['crimson','tide','verdant'];
const domainIds=['nine_suns','infinite_strike','frozen_silence','diamond_guard','myriad_poison','rebirth_wood','limitless_void','jackpot_bagua','draw_swords'];
const specialIds=['limitless_void','jackpot_bagua','draw_swords'];
const ticketKey='powder_admin_real_combat_ticket_v2140';
const resultKey='powder_admin_real_combat_result_v2140';
const checks={
  manualLab2183:lab.includes("const VERSION='21.8.3'")&&lab.includes('POWDER_ADMIN_COMBAT_MANUAL_V2183'),
  randomFiveVsFive:lab.includes('rows.slice(0,5)')&&lab.includes('rows.slice(5,10)')&&lab.includes('3 chính + 2 dự bị'),
  manualPlayerVsAi:lab.includes('BẠN ĐIỀU KHIỂN')&&lab.includes('TACTICAL AI')&&lab.includes("scenario:'pve'"),
  legacyQaUiRemoved:['Ma trận kiểm thử','Ép trực quan','Chạy kiểm tra tổng quát','Boss phase','Đo FPS'].every(x=>!lab.includes(x)),
  legacyDynamicLoadersDisabled:rc.includes('function loadModernCombatQa(){return false}')&&!rc.includes('admin-combat-auto-sim-v21610.js')&&!rc.includes('admin-domain-pipeline-v2175.js'),
  oneShotTicket:lab.includes(ticketKey)&&bridge.includes(ticketKey)&&lab.includes('expiresAt:Date.now()+120000')&&bridge.includes('localStorage.removeItem(TICKET_KEY)'),
  resultRoundTrip:lab.includes(resultKey)&&bridge.includes(resultKey),
  actualPlayerCombat:bridge.includes('POWDER_COMBAT_ENTRY_V177')&&bridge.includes('entry.startMap(buildStage(t))')&&bridge.includes('POWDER_BATTLE_PLAYER_V177?.getCore'),
  practiceNoReward:bridge.includes('practiceNoReward:true')&&bridge.includes('rewards:{coins:0,exp:0}'),
  learningIsolated:bridge.includes("a.grantLearningProgress=()=>({adminTest:true,mutated:false})"),
  rewardIsolated:bridge.includes("a.grantBattleRewards=()=>({coins:0,exp:0,adminTest:true})"),
  adventureIsolated:bridge.includes("a.updateAdventure=()=>({adminTest:true,mutated:false})"),
  noServerPvpTicket:!lab.includes('serverCombatSessionId')&&!bridge.includes('SC()?.act')&&!bridge.includes('POWDER_SERVER_COMBAT'),
  noContinuousPolling:!lab.includes('setInterval(')&&!bridge.includes('setInterval(')&&!domainRecovery.includes('setInterval('),
  compactManualLayout:css.includes('.combat2183')&&css.includes('.cl2183-roster')&&css.includes('.cl2183-versus')&&!css.includes('.cl2139-qa-grid'),
  canonical3Simple:simpleIds.every(id=>domain.includes(`${id}:{id:'${id}'`)),
  canonical9Expansion:domainIds.every(id=>domain.includes(`${id}:{id:'${id}'`))&&domain.includes('lockedExpansionCount:9')&&domain.includes('normalExpansionCount:6')&&domain.includes('specialExpansionCount:3'),
  canonicalSpecials:specialIds.every(id=>domain.includes(`${id}:{id:'${id}'`))&&(domain.match(/kind:'special'/g)||[]).length===3,
  playerBridgeWired:director.includes('combat-runtime-qa-bridge-v2140.js?v=2140')&&director.includes('activateCombatRuntimeQaBridge'),
  scrollRecoveryPreserved:scroll.includes("ROOT_CLASS='powder-main-scroll-v2137'")&&scroll.includes('overflow-y:auto!important')&&scroll.includes('repairModalLock'),
  scrollPipelineWired:scrollPipeline.includes('page-scroll-recovery-v2137.js?v=2137'),
  scrollNativeNoWheelHijack:!scroll.includes('preventDefault()')&&!scroll.includes('scrollTop+=')&&!scroll.includes('scrollTop -=')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={version:'21.8.3',contract:'manual-random-team-vs-tactical-ai-real-combat',checks,failed,pass:failed.length===0};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
