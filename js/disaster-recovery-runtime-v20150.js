(()=>{'use strict';
const VERSION='20.15.0',BUILD='powder-21.0.0-official-production';
function state(){let legacy=null;try{legacy=window.POWDER_RECOVERY_V2040?.summary?.()||null}catch(_){}return{version:VERSION,buildId:BUILD,passive:true,automaticRestore:false,productionWrites:false,legacyRecovery:legacy,checkedAt:Date.now()}}
const api=Object.freeze({version:VERSION,buildId:BUILD,state});window.POWDER_DISASTER_RECOVERY_V20150=api;
})();
