(()=>{'use strict';
const VERSION='20.16.0',BUILD='powder-21.0.0-official-production';
const snapshot=()=>Object.freeze({version:VERSION,buildId:BUILD,passive:true,networkTraffic:false,adminSecurity:{centralGuard:true,tokenStorage:'session-only',criticalActionsRequireMfa:true,serverAuthoritative:true},note:'Player runtime only exposes build security capability. Authorization is enforced server-side.'});
window.POWDER_SECURITY_STATUS_V20160=Object.freeze({version:VERSION,buildId:BUILD,snapshot});
})();
