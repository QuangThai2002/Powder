(()=>{'use strict';
// Legacy compatibility shim. 20.7.0 removed client-entered stage health.
function bind(){if(window.POWDER_ADMIN_OFFICIAL_LAUNCH_V2070)window.POWDER_ADMIN_OFFICIAL_LAUNCH_V2000=window.POWDER_ADMIN_OFFICIAL_LAUNCH_V2070}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,2200),{once:true});else setTimeout(bind,2200);
})();
