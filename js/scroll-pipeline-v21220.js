(()=>{'use strict';
if(window.POWDER_SCROLL_PIPELINE_V21220)return;
const VERSION='21.2.20',root=document.documentElement,STYLE_ID='powderScrollPipelineStyle21220';
const state={scrollEvents:0,bursts:0,rafWrites:0,lastAt:0,active:false};let raf=0,stopTimer=0;
function style(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.lesson-grid>.lesson-card,.pow-grid>.pow-card,.inventory-pow-grid>.inventory-pow-card,.rank-grid>.rank-item,.soc154-friend-grid>.soc154-user,.soc154-stack>.soc154-user{content-visibility:auto;contain-intrinsic-size:auto 280px}
html.powder-scroll-active .view:not(#battleView):not(#chestsView) .panel,html.powder-scroll-active .view:not(#battleView):not(#chestsView) .lesson-card,html.powder-scroll-active .view:not(#battleView):not(#chestsView) .pow-card,html.powder-scroll-active .view:not(#battleView):not(#chestsView) .inventory-pow-card,html.powder-scroll-active .view:not(#battleView):not(#chestsView) .rank-item{transition-duration:0s!important;animation-play-state:paused!important}
html.powder-scroll-active .view:not(#battleView):not(#chestsView) .panel:hover,html.powder-scroll-active .view:not(#battleView):not(#chestsView) .lesson-card:hover,html.powder-scroll-active .view:not(#battleView):not(#chestsView) .pow-card:hover{transform:none!important}
html.powder-scroll-active .view:not(#battleView):not(#chestsView) .panel::before,html.powder-scroll-active .view:not(#battleView):not(#chestsView) .panel::after{animation-play-state:paused!important}
`;document.head.appendChild(s)}
function writeActive(){raf=0;state.rafWrites++;if(!state.active){state.active=true;state.bursts++;root.classList.add('powder-scroll-active')}clearTimeout(stopTimer);stopTimer=setTimeout(()=>{stopTimer=0;state.active=false;root.classList.remove('powder-scroll-active')},120)}
function onScroll(){state.scrollEvents++;state.lastAt=Date.now();if(!raf)raf=requestAnimationFrame(writeActive)}
function snapshot(){return{version:VERSION,...state,pendingRaf:!!raf,pendingStop:!!stopTimer,policy:'passive scroll input; one coalesced rAF write; pause decorative non-combat motion during scroll'}}
function activatePageScrollRecovery(){if(window.POWDER_PAGE_SCROLL_RECOVERY_V2137||document.getElementById('powderPageScrollRecovery2137'))return;const s=document.createElement('script');s.id='powderPageScrollRecovery2137';s.src='js/page-scroll-recovery-v2137.js?v=2137';s.async=true;document.head.appendChild(s)}
function activateNext(){if(window.POWDER_PERFORMANCE_DIRECTOR_V21221||document.getElementById('powderPerformanceDirector21221'))return;const s=document.createElement('script');s.id='powderPerformanceDirector21221';s.src='js/performance-director-v21221.js?v=21221';s.async=true;document.head.appendChild(s)}
function boot(){style();activatePageScrollRecovery();activateNext()}
window.addEventListener('scroll',onScroll,{passive:true,capture:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(stopTimer);root.classList.remove('powder-scroll-active')},{once:true});
window.POWDER_SCROLL_PIPELINE_V21220={version:VERSION,snapshot};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();