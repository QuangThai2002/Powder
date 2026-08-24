(()=>{'use strict';
const VERSION='17.7-player-first-entry';
function scene(){return window.POWDER_BATTLE_PLAYER_V177||null;}
function normalize(stage,source){const s=stage&&typeof stage==='object'?JSON.parse(JSON.stringify(stage)):null;if(!s)return null;s.entrySource=source;return s;}
function startMap(stage){const s=normalize(stage,'map');if(!s||Number(s.islandId)<1||!s.id)return false;return !!scene()?.startEncounter?.(s,'map');}
function startBoss(stage){const s=normalize(stage,'boss');if(!s||s.kind!=='boss'||!s.bossChallengeId)return false;return !!scene()?.startEncounter?.(s,'boss');}
function startEvent(stage){const s=normalize(stage,'event');if(!s||s.eventCombat!==true||!s.eventId)return false;return !!scene()?.startEncounter?.(s,'event');}
function isActive(){return !!scene()?.isActive?.();}
function getState(){return scene()?.getState?.()||null;}
function forfeit(reason='navigation'){return !!scene()?.forfeit?.(reason);}
function getExitCost(){return Math.max(0,Number(scene()?.getExitCost?.()||0));}
window.POWDER_COMBAT_ENTRY_V177=Object.freeze({version:VERSION,startMap,startBoss,startEvent,isActive,getState,forfeit,getExitCost,modes:Object.freeze(['map','boss','event'])});
})();
