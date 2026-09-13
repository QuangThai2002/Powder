(()=>{'use strict';
const flags=Object.freeze({
  PVP_ENABLED:false,
  DOMAIN_EXPANSION_ENABLED:false,
  SIMPLE_DOMAIN_ENABLED:true
});
globalThis.POWDER_COMBAT_FEATURE_FLAGS_V1=flags;
/* Player UI gate must initialize before boot-loader assigns POWDER_DATA so canonical visibility is snapshotted before runtime star mutations. This does not change combat flags or gameplay data. */
try{
  if(typeof document!=='undefined'&&!globalThis.POWDER_PLAYER_VISIBILITY){
    if(document.readyState==='loading')document.write('<script src="js/player-visibility-final-gate.js?v=final-gate-1"><\/script>');
    else{const s=document.createElement('script');s.src='js/player-visibility-final-gate.js?v=final-gate-1';s.async=false;document.head.appendChild(s)}
  }
}catch(err){console.error('[Powder player visibility gate]',err)}
})();
