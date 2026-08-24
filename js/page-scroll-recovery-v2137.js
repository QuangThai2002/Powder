(()=>{'use strict';
if(window.POWDER_PAGE_SCROLL_RECOVERY_V2137)return;
const VERSION='21.3.7',STYLE_ID='powderPageScrollRecoveryStyle2137',ROOT_CLASS='powder-main-scroll-v2137';
const state={installed:false,active:false,repairs:0,viewChanges:0,wheelEvents:0,lastAt:0};
const root=document.documentElement;
function visible(el){if(!el||el.hidden||!el.isConnected||el.getAttribute?.('aria-hidden')==='true')return false;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;return el.getClientRects().length>0}
function fullscreen(){return root.classList.contains('powder-fullscreen')||root.classList.contains('powder-combat-fullscreen')||!!document.fullscreenElement}
function appReady(){const app=document.getElementById('app');return !!app&&!app.hidden&&visible(app)}
function main(){return document.querySelector('#app:not([hidden]) > main')}
function installStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
html.${ROOT_CLASS},html.${ROOT_CLASS} body{height:100%;max-height:100%;overflow:hidden!important}
html.${ROOT_CLASS} #app:not([hidden]){height:100dvh;max-height:100dvh;min-height:0!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;padding-bottom:0!important;overflow:hidden!important}
html.${ROOT_CLASS} #app:not([hidden])>.topbar{grid-row:1;min-width:0}
html.${ROOT_CLASS} #app:not([hidden])>main{grid-row:2;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior-y:contain!important;scrollbar-gutter:stable;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-bottom:64px}
html.${ROOT_CLASS} #app:not([hidden])>main>.view:not([hidden]){min-height:min-content}
@media(max-width:760px){html.${ROOT_CLASS} #app:not([hidden])>main{padding-bottom:40px;scrollbar-gutter:auto}}
`;document.head.appendChild(s)}
function repairModalLock(){const open=[...document.querySelectorAll('.modal')].some(visible),had=root.classList.contains('v131-modal-open');root.classList.toggle('v131-modal-open',open);if(!open&&had){document.body?.style.removeProperty('overflow');document.body?.style.removeProperty('touch-action');state.repairs++;state.lastAt=Date.now()}return open}
function sync(reason='sync'){installStyle();repairModalLock();const active=appReady()&&!fullscreen();root.classList.toggle(ROOT_CLASS,active);state.active=active;state.installed=true;state.lastAt=Date.now();return{reason,active,main:!!main()}}
function resetMainScroll(){const m=main();if(!m)return;requestAnimationFrame(()=>{m.scrollTop=0})}
function onView(){state.viewChanges++;sync('view');resetMainScroll()}
function onWheel(e){state.wheelEvents++;const m=main();if(!m||!root.classList.contains(ROOT_CLASS))return;if(e.defaultPrevented||e.ctrlKey||e.metaKey)return;const t=e.target?.nodeType===1?e.target:e.target?.parentElement;if(!t||!m.contains(t))return;let n=t;while(n&&n!==m){const cs=getComputedStyle(n),oy=cs.overflowY;if((oy==='auto'||oy==='scroll'||oy==='overlay')&&n.scrollHeight>n.clientHeight+2)return;n=n.parentElement}/* Native main scrolling owns the event. Never preventDefault here. */}
function observe(){if(!window.MutationObserver)return;const mo=new MutationObserver(()=>sync('mutation'));mo.observe(root,{attributes:true,attributeFilter:['class']});const app=document.getElementById('app');if(app)mo.observe(app,{attributes:true,attributeFilter:['hidden']});document.querySelectorAll('.modal').forEach(el=>mo.observe(el,{attributes:true,attributeFilter:['hidden','aria-hidden','style','class']}))}
function snapshot(){const m=main();return{version:VERSION,...state,rootClass:root.classList.contains(ROOT_CLASS),scrollTop:m?.scrollTop||0,scrollHeight:m?.scrollHeight||0,clientHeight:m?.clientHeight||0,policy:'topbar stays fixed; #app > main is the single native page scroll surface; nested scroll areas and combat/fullscreen keep native ownership'}}
function boot(){sync('boot');observe();window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:rendered',()=>sync('rendered'),{passive:true});window.addEventListener('pageshow',()=>sync('pageshow'),{passive:true});window.addEventListener('resize',()=>sync('resize'),{passive:true});window.addEventListener('wheel',onWheel,{capture:true,passive:true});window.addEventListener('fullscreenchange',()=>sync('fullscreen'),{passive:true});}
window.POWDER_PAGE_SCROLL_RECOVERY_V2137={version:VERSION,snapshot,refresh:()=>sync('manual'),repairModalLock};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();