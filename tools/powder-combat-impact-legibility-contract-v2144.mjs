import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const leg=read('js/combat-impact-legibility-v2144.js');
const legCss=read('css/combat-impact-legibility-v2144.css');
const seq=read('js/combat-impact-sequence-v2143.js');
const seqCss=read('css/combat-impact-sequence-v2143.css');
const role=read('js/combat-role-rhythm-v2142.js');
const roleCss=read('css/combat-role-rhythm-v2142.css');
const fx=read('js/combat-fx-fidelity-v2141.js');
const director=read('js/performance-director-v21221.js');
const clarity=read('js/combat-action-clarity-v2138.js');
const scroll=read('js/page-scroll-recovery-v2137.js');
const scene=read('js/player-combat-scene-v1862.js');

const elements=['fire','water','leaf','earth','lightning','wind','ice','poison','steel','lava','storm','light','dark'];
const roles=['marksman','knight','mage','tank','enchanter','musician','healer','assassin','fighter'];
const checks={
  version2144:leg.includes("const VERSION='21.4.4'"),
  global2144:leg.includes('POWDER_COMBAT_IMPACT_LEGIBILITY_V2144'),
  cssSeparated:leg.includes("CSS_HREF='css/combat-impact-legibility-v2144.css?v=2144'")&&legCss.includes('Powder 21.4.4'),
  loaderWired:director.includes('combat-impact-legibility-v2144.js?v=2144')&&director.includes('activateCombatImpactLegibility'),
  snapshotWired:director.includes('combatImpactLegibility:window.POWDER_COMBAT_IMPACT_LEGIBILITY_V2144'),
  aoeCadence:leg.includes('function scheduleAoe')&&leg.includes('flows.length<2||targets.length<2')&&leg.includes('cfx2144-aoe-wave')&&legCss.includes('@keyframes cfx2144Aoe'),
  aoeExactTargetNodes:leg.includes('target=targets[i]')&&leg.includes('impactDelay(flow,i)+i*28'),
  elementIdentity:elements.every(e=>legCss.includes(`.cfx2144-element-impact.el-${e}`))&&leg.includes('function flowElement'),
  elementFinisher:leg.includes("strong=key==='ultimate'||key==='exclusive'")&&legCss.includes('.cfx2144-element-impact.is-finisher')&&legCss.includes('@keyframes cfx2144Finisher'),
  supportLoadOrderSafe:leg.includes('function sameSideSupport')&&leg.includes("targets.every(t=>t.classList.contains(side))")&&leg.includes("flow?.hasAttribute('data-cfx2143-support')"),
  guardFeedback:leg.includes(".cv7-fx.guard")&&leg.includes("kind==='guard'")&&legCss.includes('.cfx2144-guard-intercept')&&scene.includes("evt.type==='guard'"),
  shieldBreakFeedback:leg.includes(".cv7-fx.break")&&leg.includes("kind==='break'")&&legCss.includes('.cfx2144-shield-break')&&scene.includes("evt.type==='break'"),
  koFeedback:leg.includes(".cv7-fx.kill")&&leg.includes("kind==='ko'")&&legCss.includes("content:'HẠ GỤC'")&&scene.includes("evt.type==='kill'"),
  replacementFeedback:leg.includes(".cv7-fx.replace")&&leg.includes("kind==='entry'")&&legCss.includes("content:'VÀO SÂN'")&&scene.includes("evt.type==='replacement'"),
  realReviveDetection:leg.includes('const timers=new Set(),life=new Map()')&&leg.includes('prev===true&&!dead')&&leg.includes("playFeedback(u,'revive')")&&legCss.includes("content:'HỒI SINH'"),
  noFakeReviveEvent:!leg.includes("evt.type==='revive'"),
  transientCleanup:leg.includes('function clearTimers')&&leg.includes('life.clear()')&&leg.includes("window.addEventListener('pagehide'"),
  noPolling:!leg.includes('setInterval(')&&!leg.includes('MutationObserver'),
  noBackgroundLoops:!legCss.includes('infinite'),
  noGameplayMutation:leg.includes('gameplayMutation:false')&&leg.includes('damageFormulaMutation:false')&&leg.includes('skillDataMutation:false')&&leg.includes('serverMutation:false')&&leg.includes('scrollMutation:false'),
  sequence2143Preserved:seq.includes('POWDER_COMBAT_IMPACT_SEQUENCE_V2143')&&seq.includes('function scheduleSequence')&&seqCss.includes('.cfx2143-finisher.ultimate')&&seqCss.includes('animation:cfx2143BossMeter 1.1s ease-out both'),
  role2142Preserved:role.includes('POWDER_COMBAT_ROLE_RHYTHM_V2142')&&roles.every(r=>role.includes(`'${r}'`))&&roles.every(r=>roleCss.includes(`.cv7-attack-flow.role-${r}`)),
  fidelity2141Preserved:fx.includes('POWDER_COMBAT_FX_FIDELITY_V2141')&&fx.includes('.cv7-cinematic.ultimate::before')&&fx.includes('display:block!important'),
  clarityPreserved:clarity.includes('source-to-target arrow')&&clarity.includes('hard CC readable'),
  scrollRecoveryPreserved:scroll.includes("ROOT_CLASS='powder-main-scroll-v2137'")&&scroll.includes('overflow-y:auto!important')&&scroll.includes('repairModalLock')&&!scroll.includes('preventDefault()'),
  coreAoeDataAvailable:scene.includes('targetRefs:targetRefs.map')&&scene.includes("kind:aoe?'impact-aoe':'impact'"),
  coreStateFeedbackAvailable:scene.includes("kind:'guard'")&&scene.includes("kind:'break'")&&scene.includes("kind:'kill'")&&scene.includes("kind:'replace'")
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
const report={version:'21.4.4',contract:'combat-aoe-element-state-legibility',checks,failed,pass:failed.length===0};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
