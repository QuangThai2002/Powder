import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const status=read('js/combat-status-fx-v2145.js'),statusCss=read('css/combat-status-fx-v2145.css');
const leg=read('js/combat-impact-legibility-v2144.js'),seq=read('js/combat-impact-sequence-v2143.js'),role=read('js/combat-role-rhythm-v2142.js'),fx=read('js/combat-fx-fidelity-v2141.js');
const director=read('js/performance-director-v21221.js'),clarity=read('js/combat-action-clarity-v2138.js'),scroll=read('js/page-scroll-recovery-v2137.js'),scene=read('js/player-combat-scene-v1862.js');
const checks={
 version2145:status.includes("const VERSION='21.4.5'"),global2145:status.includes('POWDER_COMBAT_STATUS_FX_V2145'),cssSeparated:status.includes("combat-status-fx-v2145.css?v=2145")&&statusCss.includes('Powder 21.4.5'),
 loaderWired:director.includes('combat-status-fx-v2145.js?v=2145')&&director.includes('activateCombatStatusFx'),snapshotWired:director.includes('combatStatusFx:window.POWDER_COMBAT_STATUS_FX_V2145'),
 dotIdentity:status.includes(".cv7-fx.status-dot")&&status.includes('function statusKind')&&['burn','poison','shock'].every(k=>statusCss.includes(`.${k}`)),
 controlIdentity:status.includes(".cv7-fx.status-control")&&statusCss.includes("data-cfx2145-control='freeze'")&&statusCss.includes("data-cfx2145-control='stun'"),
 cleanseBurst:status.includes(".cv7-fx.cleanse")&&statusCss.includes('.cfx2145-burst.cleanse'),shieldAbsorb:status.includes(".cv7-fx.shield")&&statusCss.includes('.cfx2145-burst.shield-absorb'),
 statusExpire:status.includes(".cv7-fx.status-expire")&&statusCss.includes('.cfx2145-burst.expire'),antiHeal:status.includes("kind==='antiheal'")&&statusCss.includes('GIẢM HỒI MÁU'),
 noPolling:!status.includes('setInterval(')&&!status.includes('MutationObserver'),noBackgroundLoops:!statusCss.includes('infinite'),timerCleanup:status.includes('clearTimers()')&&status.includes("window.addEventListener('pagehide'"),
 noGameplayMutation:['gameplayMutation:false','damageFormulaMutation:false','skillDataMutation:false','serverMutation:false','scrollMutation:false'].every(x=>status.includes(x)),
 prior2144:leg.includes('POWDER_COMBAT_IMPACT_LEGIBILITY_V2144')&&leg.includes('real dead-to-alive revive detection'),prior2143:seq.includes('POWDER_COMBAT_IMPACT_SEQUENCE_V2143'),prior2142:role.includes('POWDER_COMBAT_ROLE_RHYTHM_V2142'),prior2141:fx.includes('POWDER_COMBAT_FX_FIDELITY_V2141'),
 coreFeedbackAvailable:scene.includes("kind:'status-dot'")&&scene.includes("kind:'status-control'")&&scene.includes("kind:'cleanse'")&&scene.includes("kind:'shield'"),clarityPreserved:clarity.includes('hard CC readable'),scrollRecoveryPreserved:scroll.includes("ROOT_CLASS='powder-main-scroll-v2137'")&&!scroll.includes('preventDefault()')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);console.log(JSON.stringify({version:'21.4.5',contract:'combat-status-fx-control-readability',checks,failed,pass:!failed.length},null,2));if(failed.length)process.exit(1);
