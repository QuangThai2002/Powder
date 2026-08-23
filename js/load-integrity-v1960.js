(()=>{'use strict';
const VERSION='19.6.0',BUILD_ID='powder-19.6.0-production-load-integrity-gate';
const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch{return v}};
function localGate(){
 const rc=window.POWDER_COMBAT_RC_V1900?.diagnostics?.()||null;
 const pr=(window.POWDER_PRODUCTION_READINESS_V1940||window.POWDER_PRODUCTION_READINESS_V1930||window.POWDER_PRODUCTION_READINESS_V1920||window.POWDER_PRODUCTION_READINESS_V1910)?.diagnostics?.()||null;
 const release=window.POWDER_RELEASE_V162?.manifest?.()||{};
 const rollout=window.POWDER_RELEASE_V162?.rollout?.()||{};
 const checks={
  boot:!!window.POWDER_BOOT_V1960,
  combatRc:!!rc?.gates?.pass,
  readiness:pr?.pass===true,
  pvp:!!window.POWDER_PVP_V1881,
  serverCombat:!!window.POWDER_SERVER_COMBAT_V1862,
  cloudRuntime:!!window.POWDER_ONLINE_V150,
  safeRollout:!!window.POWDER_SAFE_ROLLOUT_V1950,
  actionGuard:!!window.POWDER_COMBAT_RC_V1900,
  identity:!!window.POWDER_COMBAT_IDENTITY_V1881,
  domain:!!window.POWDER_DOMAIN_SYSTEM_V15
 };
 return{version:VERSION,buildId:BUILD_ID,checks,pass:Object.values(checks).every(Boolean),release:{currentVersion:release.currentVersion||'',rolloutPercent:Number(rollout.percent??release.rolloutPercent??100),emergencyMode:String(release.emergencyMode||'normal')},at:Date.now()};
}
function summary(){return clone(localGate())}
const api=Object.freeze({version:VERSION,buildId:BUILD_ID,summary,localGate});
window.POWDER_LOAD_INTEGRITY_V1960=api;
try{window.dispatchEvent(new CustomEvent('powder:load-integrity-ready',{detail:summary()}))}catch(_){ }
})();
