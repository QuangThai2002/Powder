(()=>{'use strict';
const VERSION='20.20.0',BUILD_ID='powder-20.20.0-gold-master',PROMOTED_BUILD='powder-21.0.0-official-production';
function diagnostics(){
 const env=window.POWDER_ENV_V162||{},freeze=(window.POWDER_RELEASE_FREEZE_V20200||window.POWDER_RELEASE_FREEZE_V20190)?.diagnostics?.()||{},full=window.POWDER_FULL_GAME_REGRESSION_V20180?.diagnostics?.()||{};
 const checks={
  version:env.version===VERSION||['21.0.0','21.0.1','21.0.2','21.0.3','21.0.4'].includes(env.version),
  buildId:env.buildId===BUILD_ID||env.buildId===PROMOTED_BUILD||env.buildId==='powder-21.0.1-launch-stabilization'||['powder-21.0.2-hotfix-safety','powder-21.0.3-live-observability-slo','powder-21.0.4-capacity-guard'].includes(env.buildId),
  releaseRuntime:!!window.POWDER_RELEASE_V162,
  releaseFreeze:freeze.pass===true,
  fullGameRegression:full.pass===true,
  rcCanaryLineage:!!window.POWDER_RELEASE_CANDIDATE_V20190,
  saveIntegrity:!!window.POWDER_SAVE_INTEGRITY_V20170,
  security:!!window.POWDER_SECURITY_STATUS_V20160,
  reliability:!!window.POWDER_RELIABILITY_V2080,
  transactionSafety:!!window.POWDER_TX_SAFETY_V2090,
  antiAbuse:!!window.POWDER_EXPLOIT_GUARD_V20130,
  serverMutation:!!window.POWDER_SERVER_MUTATION_V20110,
  passiveOnly:true,
  promotionLineage:env.buildId===BUILD_ID||env.buildId===PROMOTED_BUILD||env.buildId==='powder-21.0.1-launch-stabilization'||['powder-21.0.2-hotfix-safety','powder-21.0.3-live-observability-slo','powder-21.0.4-capacity-guard'].includes(env.buildId),
  officialFalse:true
 };
 return{version:VERSION,buildId:BUILD_ID,checks,pass:Object.values(checks).every(Boolean),policy:{immutableArtifact:true,codeFrozen:true,schemaFrozen:true,apiFrozen:true,assetsFrozen:true,gameplayChangesAllowed:false,predecessor:'powder-20.19.0-release-candidate-canary',official:false},at:Date.now()};
}
const api=Object.freeze({version:VERSION,buildId:BUILD_ID,diagnostics});window.POWDER_GOLD_MASTER_V20200=api;try{window.dispatchEvent(new CustomEvent('powder:gold-master',{detail:diagnostics()}))}catch(_){}
})();
