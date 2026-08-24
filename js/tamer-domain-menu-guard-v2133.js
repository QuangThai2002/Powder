(()=>{'use strict';
if(window.POWDER_TAMER_DOMAIN_MENU_GUARD_V2133)return;
const VERSION='21.3.3-menu-guard';
const state={patches:0,menuClicks:0,simpleChecks:0,expansionChecks:0,lastAt:0};let raf=0;
function memory(){try{return window.POWDER_TAMER_DOMAIN_MEMORY_V2133?.snapshot?.()||{}}catch(_){return{}}}
function core(){try{return window.POWDER_BATTLE_PLAYER_V177?.getCore?.()||null}catch(_){return null}}
function patch(reason='event'){
  raf=0;const mount=document.querySelector('#battleView:not([hidden]) .combat-v7-mount');if(!mount)return false;
  const m=memory(),c=core(),simple=m.equippedSimple||null,exp=m.equippedExpansion||null,level=Math.max(1,Math.min(3,Number(m.simpleLevels?.[simple])||1));
  const simpleButtons=[...mount.querySelectorAll('.simple-pop [data-cv7-tamer-simple]')],expButtons=[...mount.querySelectorAll('.expansion-pop [data-cv7-domain]')];
  for(const b of simpleButtons){const on=!!simple&&b.dataset.cv7TamerSimple===simple;b.toggleAttribute('data-td2133-equipped',on);if(on){const allowed=!!c?.canUseTamerSimple?.('player',simple,level);b.disabled=!allowed;state.simpleChecks++}}
  for(const b of expButtons){const on=!!exp&&b.dataset.cv7Domain===exp;b.toggleAttribute('data-td2133-equipped',on);if(on){const allowed=!!c?.canExpandDomain?.('player',exp);b.disabled=!allowed;state.expansionChecks++}}
  const simpleToggle=mount.querySelector('[data-cv7-tamer-menu="simple"]'),expToggle=mount.querySelector('[data-cv7-tamer-menu="expansion"]');
  if(simpleToggle&&!simple)simpleToggle.disabled=true;if(expToggle&&!exp)expToggle.disabled=true;
  state.patches++;state.lastAt=Date.now();return true;
}
function schedule(reason='event'){if(raf)return;raf=requestAnimationFrame(()=>patch(reason))}
function onClick(e){const b=e.target?.closest?.('[data-cv7-tamer-menu]');if(!b)return;state.menuClicks++;schedule('menu-click')}
function snapshot(){return{version:VERSION,...state,policy:'menu visibility follows equipped memory; enable state always delegated back to Combat Core validators',noGameplayBypass:true,performance:'capture click + coalesced rAF; no polling/observer'}}
document.addEventListener('click',onClick,true);window.addEventListener('powder:combat-state',()=>schedule('combat-state'),{passive:true});window.addEventListener('powder:tamer-domain-memory',()=>schedule('memory-change'),{passive:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);document.removeEventListener('click',onClick,true)},{once:true});
window.POWDER_TAMER_DOMAIN_MENU_GUARD_V2133={version:VERSION,snapshot,refresh:()=>patch('manual')};
})();
