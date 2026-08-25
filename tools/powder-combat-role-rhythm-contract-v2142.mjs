import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const role=read('js/combat-role-rhythm-v2142.js');
const roleCss=read('css/combat-role-rhythm-v2142.css');
const fx=read('js/combat-fx-fidelity-v2141.js');
const director=read('js/performance-director-v21221.js');
const governor=read('js/combat-refresh-governor-v21219.js');
const clarity=read('js/combat-action-clarity-v2138.js');
const scroll=read('js/page-scroll-recovery-v2137.js');
const scene=read('js/player-combat-scene-v1862.js');

const roles=['marksman','knight','mage','tank','enchanter','musician','healer','assassin','fighter'];
const roleSelectors=roles.map(r=>`.cv7-attack-flow.role-${r}`);
const roleMotions=roles.map(r=>`motion-role-${r}`);
const roleUltimate=roles.map(r=>`.cv7-cinematic.ultimate.role-${r}`);
const checks={
  version2142:role.includes("const VERSION='21.4.2'"),
  global2142:role.includes('POWDER_COMBAT_ROLE_RHYTHM_V2142'),
  cssSeparated:role.includes("CSS_HREF='css/combat-role-rhythm-v2142.css?v=2142'")&&roleCss.includes('Powder 21.4.2'),
  allNineRoles:roles.every(r=>role.includes(`'${r}'`))&&roles.length===9,
  nineAttackLanguages:roleSelectors.every(x=>roleCss.includes(x)),
  nineSourceMotions:roleMotions.every(x=>roleCss.includes(x)),
  nineUltimateCompositions:roleUltimate.every(x=>roleCss.includes(x)),
  impactGeometryLocked:roleCss.includes('@keyframes cfx2142ImpactRing')&&roleCss.includes('transform:translate(50%,-50%) scale(1.26)')&&roleCss.includes('display:block!important'),
  multiHitGrouping:role.includes('function groupMultiHit')&&role.includes('cfx2142-combo')&&roleCss.includes('.cfx2142-combo'),
  ccExactUnit:role.includes('cfx2142Cc')&&roleCss.includes("data-cfx2142-cc='freeze'")&&roleCss.includes("data-cfx2142-cc='stun'"),
  skipConfirmation:role.includes("cfx2142Skip='1'")&&roleCss.includes('HÀNH ĐỘNG BỊ KHÓA'),
  compositorSafe:roleCss.includes('.cv7-art-wrap')&&!roleCss.includes('.cv7-art{animation:cfx2142'),
  noPolling:!role.includes('setInterval(')&&!role.includes('MutationObserver'),
  noGameplayMutation:role.includes('gameplayMutation:false')&&role.includes('damageFormulaMutation:false')&&role.includes('scrollMutation:false'),
  loaderWired:director.includes('combat-role-rhythm-v2142.js?v=2142')&&director.includes('activateCombatRoleRhythm'),
  snapshotWired:director.includes('combatRoleRhythm:window.POWDER_COMBAT_ROLE_RHYTHM_V2142'),
  coreProvidesRoleClasses:scene.includes('motion-role-${esc(motion.role')&&scene.includes('role-${esc(m.role'),
  coreProvidesCcLock:scene.includes('cv7-cc-lock')&&scene.includes('MẤT LƯỢT'),
  fidelity2141Preserved:fx.includes('POWDER_COMBAT_FX_FIDELITY_V2141')&&fx.includes('.cv7-cinematic.ultimate::before')&&fx.includes('display:block!important'),
  criticalFxStillProtected:['.cv8-camera-director','.cv7-vfx.impact','.cv7-fx.element-hit','.cv7-attack-hit-ring','.cv7-signature-impact'].every(x=>fx.includes(x)),
  governorCauseStillKnown:governor.includes('.cv7-signature-impact{display:none!important}'),
  clarityPreserved:clarity.includes('source-to-target arrow')&&clarity.includes('hard CC readable'),
  scrollRecoveryPreserved:scroll.includes("ROOT_CLASS='powder-main-scroll-v2137'")&&scroll.includes('overflow-y:auto!important')&&scroll.includes('repairModalLock')&&!scroll.includes('preventDefault()')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
const report={version:'21.4.2',contract:'combat-role-identity-rhythm-multihit-cc',checks,failed,pass:failed.length===0};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
