import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const seq=read('js/combat-impact-sequence-v2143.js');
const seqCss=read('css/combat-impact-sequence-v2143.css');
const role=read('js/combat-role-rhythm-v2142.js');
const roleCss=read('css/combat-role-rhythm-v2142.css');
const fx=read('js/combat-fx-fidelity-v2141.js');
const director=read('js/performance-director-v21221.js');
const clarity=read('js/combat-action-clarity-v2138.js');
const scroll=read('js/page-scroll-recovery-v2137.js');
const scene=read('js/player-combat-scene-v1862.js');

const roles=['marksman','knight','mage','tank','enchanter','musician','healer','assassin','fighter'];
const checks={
  version2143:seq.includes("const VERSION='21.4.3'"),
  global2143:seq.includes('POWDER_COMBAT_IMPACT_SEQUENCE_V2143'),
  cssSeparated:seq.includes("CSS_HREF='css/combat-impact-sequence-v2143.css?v=2143'")&&seqCss.includes('Powder 21.4.3'),
  loaderWired:director.includes('combat-impact-sequence-v2143.js?v=2143')&&director.includes('activateCombatImpactSequence'),
  snapshotWired:director.includes('combatImpactSequence:window.POWDER_COMBAT_IMPACT_SEQUENCE_V2143'),
  battleCoreHits:seq.includes('c?.actionInfo?.(u,key)?.ability')&&seq.includes('function nominalHits')&&scene.includes('getCore:()=>battle'),
  rhythmSequence:seq.includes('function scheduleSequence')&&seq.includes('beatGap(key)')&&seqCss.includes('@keyframes cfx2143Beat')&&seqCss.includes('.cfx2143-beat.is-final'),
  lowFxBeatCap:seq.includes("fxCap()==='low'?5:8")&&seq.includes('shown=Math.min(hits,cap)'),
  compressedHitReadable:seq.includes('cfx2143CompressedHits')&&seqCss.includes("data-cfx2143-compressed-hits"),
  supportClassified:seq.includes('function supportType')&&seq.includes("return'heal'")&&seq.includes("return'shield'")&&seq.includes("return'buff'"),
  transientSupportCleanup:seq.includes('function clearSupportMarks')&&seq.includes('clearSupportMarks(m);patchAction(m)'),
  supportRoutesStyled:seqCss.includes("data-cfx2143-support='heal'")&&seqCss.includes("data-cfx2143-support='shield'")&&seqCss.includes("data-cfx2143-support='buff'"),
  actualHealShieldFeedback:seq.includes(".cv7-fx.heal,.cv7-fx.status-heal,.cv7-fx.shield,.cv7-fx.shield-gain,.cv7-fx.guarded")&&seqCss.includes('.cfx2143-support-burst.heal')&&seqCss.includes('.cfx2143-support-burst.shield'),
  ultimateTravelImpact:seq.includes("['ultimate','exclusive'].includes(key)")&&seqCss.includes('.cv7-attack-flow.ultimate .cv7-attack-trace::after')&&seqCss.includes('.cfx2143-finisher.ultimate'),
  bossTelegraph:seq.includes('.cv7-boss-warning,.cv7-boss-mechanic-notice')&&seq.includes('function bossDanger')&&seqCss.includes('BOSS TELEGRAPH'),
  bossExactTarget:seq.includes("cfx2143BossTarget='1'")&&seqCss.includes("data-cfx2143-boss-target='1'"),
  bossMeterOneShot:seqCss.includes('animation:cfx2143BossMeter 1.1s ease-out both')&&!seqCss.includes('infinite alternate'),
  timerCleanup:seq.includes('function clearTimers')&&seq.includes('clearTimers()')&&seq.includes("window.addEventListener('pagehide'"),
  noPolling:!seq.includes('setInterval(')&&!seq.includes('MutationObserver'),
  noGameplayMutation:seq.includes('gameplayMutation:false')&&seq.includes('damageFormulaMutation:false')&&seq.includes('skillDataMutation:false')&&seq.includes('scrollMutation:false'),
  role2142Preserved:role.includes('POWDER_COMBAT_ROLE_RHYTHM_V2142')&&roles.every(r=>role.includes(`'${r}'`))&&roles.every(r=>roleCss.includes(`.cv7-attack-flow.role-${r}`)),
  multiHitBadge2142Preserved:role.includes('cfx2142-combo')&&roleCss.includes('.cfx2142-combo'),
  fidelity2141Preserved:fx.includes('POWDER_COMBAT_FX_FIDELITY_V2141')&&fx.includes('.cv7-cinematic.ultimate::before')&&fx.includes('display:block!important'),
  clarityPreserved:clarity.includes('source-to-target arrow')&&clarity.includes('hard CC readable'),
  scrollRecoveryPreserved:scroll.includes("ROOT_CLASS='powder-main-scroll-v2137'")&&scroll.includes('overflow-y:auto!important')&&scroll.includes('repairModalLock')&&!scroll.includes('preventDefault()'),
  coreBossDataAvailable:scene.includes('ui.bossWarning={')&&scene.includes("evt.type==='boss-mechanic-arm'")&&scene.includes("evt.type==='boss-mechanic-outcome'"),
  coreSupportFeedbackAvailable:scene.includes("kind:'status-heal'")&&scene.includes("kind:'shield'")
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
const report={version:'21.4.3',contract:'combat-impact-sequencing-support-boss-telegraph',checks,failed,pass:failed.length===0};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
