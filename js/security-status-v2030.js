(()=>{'use strict';
const VERSION=String(window.POWDER_CONFIG?.appVersion||window.POWDER_ENV_V162?.version||'20.4.0');
const BUILD=String(window.POWDER_ENV_V162?.buildId||'powder-20.4.0-disaster-recovery-backup-integrity');
function snapshot(){return{version:VERSION,buildId:BUILD,at:new Date().toISOString(),clientOnly:true,guards:{antiCheat:!!window.POWDER_ANTI_CHEAT_V176,secureEconomy:!!window.POWDER_SECURE_ECONOMY_V152,serverCombat:!!window.POWDER_SERVER_COMBAT_V1862,pvpOnline:!!window.POWDER_PVP_ONLINE_V1881,productionRelease:!!window.POWDER_RELEASE_V162},note:'Client status only. Authoritative Security Posture is evaluated server-side.'}}
window.POWDER_SECURITY_STATUS_V2030=Object.freeze({version:VERSION,buildId:BUILD,snapshot});
})();
