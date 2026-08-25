import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fx=read('js/combat-fx-fidelity-v2141.js');
const director=read('js/performance-director-v21221.js');
const governor=read('js/combat-refresh-governor-v21219.js');
const clarity=read('js/combat-action-clarity-v2138.js');
const scroll=read('js/page-scroll-recovery-v2137.js');

const requiredCritical=['.cv8-camera-director','.cv7-vfx.impact','.cv7-fx.element-hit','.cv7-attack-hit-ring','.cv7-signature-impact'];
const palette=['el-fire','el-water','el-leaf','el-lightning','el-ice','el-poison','el-light','el-dark'];
const checks={
  version2141:fx.includes("const VERSION='21.4.1'"),
  global2141:fx.includes('POWDER_COMBAT_FX_FIDELITY_V2141'),
  loaderWired:director.includes('combat-fx-fidelity-v2141.js?v=2141')&&director.includes('activateCombatFxFidelity'),
  snapshotWired:director.includes('combatFxFidelity:window.POWDER_COMBAT_FX_FIDELITY_V2141'),
  criticalFxRestored:requiredCritical.every(x=>fx.includes(x))&&fx.includes('display:block!important'),
  stable60KeepsHigh:fx.includes("fps>=58)next='high'")&&fx.includes("pressure!=='critical'")&&fx.includes("pressure!=='hot'"),
  lowOnlySimplifies:fx.includes('.cv8-camera-vignette')&&fx.includes('.cv7-vfx-ripple')&&fx.includes('display:none!important'),
  ultimateV2:fx.includes('.cv7-cinematic.ultimate::before')&&fx.includes('.cv7-cinematic.ultimate::after')&&fx.includes('@keyframes ult2141Art')&&fx.includes('@keyframes ult2141Panel'),
  ultimateReleaseWeight:fx.includes('.cv7-attack-flow.ultimate .cv7-attack-trace')&&fx.includes('height:7px!important'),
  exclusiveReleaseWeight:fx.includes('.cv7-attack-flow.exclusive .cv7-attack-trace')&&fx.includes('height:6px!important'),
  skillHierarchy:fx.includes('.cv7-attack-flow.skill2')&&fx.includes('.cv7-attack-flow.skill1')&&fx.includes('.cv7-attack-flow.basic'),
  ultimateHitReaction:fx.includes('.cv7-unit.pulse-hit-ultimate .cv7-art')&&fx.includes('@keyframes ult2141Hit'),
  elementPalette:palette.every(x=>fx.includes(x)),
  reducedMotion:fx.includes('@media(prefers-reduced-motion:reduce)'),
  noPolling:!fx.includes('setInterval(')&&!fx.includes('MutationObserver'),
  noGameplayMutation:fx.includes('gameplayMutation:false')&&fx.includes('formulaMutation:false')&&fx.includes('scrollMutation:false'),
  oldGovernorCauseDocumented:governor.includes('.cv7-signature-impact{display:none!important}')&&governor.includes("if(hz>=120&&ratio<.68)return'medium'"),
  clarityPreserved:clarity.includes('source-to-target arrow')&&clarity.includes('hard CC readable'),
  scrollRecoveryPreserved:scroll.includes("ROOT_CLASS='powder-main-scroll-v2137'")&&scroll.includes('overflow-y:auto!important')&&scroll.includes('repairModalLock')&&!scroll.includes('preventDefault()')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
const report={version:'21.4.1',contract:'combat-fx-fidelity-ultimate-v2',checks,failed,pass:failed.length===0};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
