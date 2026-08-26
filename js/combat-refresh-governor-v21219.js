(()=>{'use strict';
if(window.POWDER_COMBAT_REFRESH_GOVERNOR_V21219)return;
const VERSION='21.2.19',root=document.documentElement,STYLE_ID='powderCombatRefreshStyle21219';
const state={cap:'high',displayHz:60,currentFps:60,ratio:1,pressure:'calm',updates:0,lastAt:0};let timer=0,followTimer=0;
function high(){try{return window.POWDER_HIGH_REFRESH_V21217?.snapshot?.()||{}}catch(_){return{}}}
function pressure(){return String(window.POWDER_ADAPTIVE_PRESSURE_V21011?.level?.()||root.dataset.resourcePressure||'calm')}
function style(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
html[data-native-fx-cap="medium"] .combat-v7-mount .cv7-vfx-ripple,html[data-native-fx-cap="medium"] .combat-v7-mount .cv7-vfx-frag,html[data-native-fx-cap="medium"] .combat-v7-mount .cv7-vfx-spark{display:none!important}
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx-ripple,html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx-frag,html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx-spark,html[data-native-fx-cap="low"] .combat-v7-mount .cv8-camera-director,html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx.impact,html[data-native-fx-cap="low"] .combat-v7-mount .cv7-fx.element-hit,html[data-native-fx-cap="low"] .combat-v7-mount .cv7-attack-hit-ring,html[data-native-fx-cap="low"] .combat-v7-mount .cv7-signature-impact{display:none!important}
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-fx{animation-duration:.5s!important}
`;document.head.appendChild(s)}
function choose(hz,fps,p){const ratio=fps/Math.max(60,hz);if(p==='critical'||fps<48)return'low';if(p==='hot'||fps<54)return'medium';if(hz>=180&&ratio<.58)return'medium';if(hz>=120&&ratio<.68)return'medium';return'high'}
function apply(reason='event'){const h=high(),hz=Math.max(60,Number(h.displayHz)||60),fps=Math.max(1,Number(h.currentFps)||Number(root.dataset.nativeFps)||60),p=pressure(),cap=choose(hz,fps,p);state.cap=cap;state.displayHz=hz;state.currentFps=fps;state.ratio=Number((fps/hz).toFixed(3));state.pressure=p;state.updates++;state.lastAt=Date.now();root.dataset.nativeFxCap=cap;root.dataset.nativeFxRatio=String(state.ratio);try{window.dispatchEvent(new CustomEvent('powder:combat-refresh-governor',{detail:{...state,reason}}))}catch(_){}return snapshot()}
function clearTimers(){clearTimeout(timer);clearTimeout(followTimer);timer=followTimer=0}
function schedule(reason='battle-settle',delay=420){clearTimeout(timer);timer=setTimeout(()=>{timer=0;if(!document.hidden)apply(reason)},delay)}
function onView(e){clearTimers();apply('view');const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');if(/battle|boss|combat/i.test(v)){schedule('battle-settle',500);followTimer=setTimeout(()=>{followTimer=0;if(!document.hidden)apply('battle-followup')},1800)}}
function snapshot(){return{version:VERSION,...state,preservedFeedback:['damage','heal','shield','stun','freeze','skip-turn','core hit reaction','22.1 element-role-skill identity'],policy:'degrade decorative combat FX only when native refresh headroom is insufficient'}}
function activateNext(){if(window.POWDER_SCROLL_PIPELINE_V21220||document.getElementById('powderScrollPipeline21220'))return;const s=document.createElement('script');s.id='powderScrollPipeline21220';s.src='js/scroll-pipeline-v21220.js?v=2210';s.async=true;document.head.appendChild(s)}
function boot(){style();apply('boot');activateNext()}
window.addEventListener('powder:high-refresh-profile',()=>apply('high-refresh'),{passive:true});window.addEventListener('powder:frame-budget',()=>apply('frame-budget'),{passive:true});window.addEventListener('powder:resource-pressure',()=>apply('pressure'),{passive:true});window.addEventListener('powder:view-changed',onView,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimers();else apply('visibility')},{passive:true});window.addEventListener('pagehide',clearTimers,{once:true});
window.POWDER_COMBAT_REFRESH_GOVERNOR_V21219={version:VERSION,snapshot,refresh:()=>apply('manual')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();