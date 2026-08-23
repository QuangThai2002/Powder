(()=>{'use strict';
const VERSION='20.14.0',BUILD_ID='powder-21.0.0-official-production';let longTasks=0,longTaskMs=0,lastLongTaskAt=0;
try{if('PerformanceObserver'in window){const po=new PerformanceObserver(list=>{for(const e of list.getEntries()){longTasks=Math.min(100000,longTasks+1);longTaskMs=Math.min(1e9,longTaskMs+Number(e.duration||0));lastLongTaskAt=Date.now()}});po.observe({type:'longtask',buffered:true})}}catch{}
function snapshot(){const mem=performance?.memory||null,rel=window.POWDER_RELIABILITY_V2080?.snapshot?.()||window.POWDER_RELIABILITY_V2080?.diagnostics?.()||null;return{version:VERSION,buildId:BUILD_ID,passiveOnly:true,networkLoadGenerator:false,longTasks,longTaskMs:Number(longTaskMs.toFixed(1)),lastLongTaskAt,heap:mem?{usedMb:Number((mem.usedJSHeapSize/1048576).toFixed(2)),totalMb:Number((mem.totalJSHeapSize/1048576).toFixed(2)),limitMb:Number((mem.jsHeapSizeLimit/1048576).toFixed(2))}:null,reliability:rel,at:Date.now()}}
const api=Object.freeze({version:VERSION,buildId:BUILD_ID,snapshot,diagnostics:snapshot});window.POWDER_LOAD_SOAK_V20140=api;try{window.dispatchEvent(new CustomEvent('powder:load-soak-runtime-ready',{detail:snapshot()}))}catch{}
})();
