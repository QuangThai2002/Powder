(()=>{'use strict';
const VERSION='21.2.12-player-entry-recovery';
function scene(){return window.POWDER_BATTLE_PLAYER_V177||null}
function normalize(stage,source){const s=stage&&typeof stage==='object'?JSON.parse(JSON.stringify(stage)):null;if(!s)return null;s.entrySource=source;return s}
function applyTamerMemory(){try{return !!window.POWDER_PROGRESSION_GATE_V1782?.applyDomainLoadout?.(scene()?.getCore?.())}catch(_){return false}}
function ensureLaunchButton(){let b=document.getElementById('combatReadyLaunch21212');if(b)return b;b=document.createElement('button');b.id='combatReadyLaunch21212';b.type='button';b.hidden=true;b.innerHTML='BẮT ĐẦU TRẬN<small>3 Pow xuất trận · 2 Pow dự bị</small>';b.onclick=()=>{const native=document.querySelector('#battleView [data-cv7-launch]');if(!native)return;b.disabled=true;applyTamerMemory();native.click();b.hidden=true;b.disabled=false};document.body.appendChild(b);return b}
function syncReadyLaunch(){const b=ensureLaunchButton(),native=document.querySelector('#battleView [data-cv7-launch]'),battle=scene()?.getCore?.(),ready=!!native&&(!battle?.state?.phase||battle.state.phase==='ready');if(native)native.hidden=ready;b.hidden=!ready;return ready}
function afterEntry(ok){if(!ok)return false;applyTamerMemory();Promise.resolve().then(syncReadyLaunch);setTimeout(syncReadyLaunch,80);return true}
function startMap(stage){const s=normalize(stage,'map');if(!s||Number(s.islandId)<1||!s.id)return false;return afterEntry(!!scene()?.startEncounter?.(s,'map'))}
function startBoss(stage){const s=normalize(stage,'boss');if(!s||s.kind!=='boss'||!s.bossChallengeId)return false;return afterEntry(!!scene()?.startEncounter?.(s,'boss'))}
function startEvent(stage){const s=normalize(stage,'event');if(!s||s.eventCombat!==true||!s.eventId)return false;return afterEntry(!!scene()?.startEncounter?.(s,'event'))}
function isActive(){return !!scene()?.isActive?.()}
function getState(){return scene()?.getState?.()||null}
function forfeit(reason='navigation'){const b=document.getElementById('combatReadyLaunch21212');if(b)b.hidden=true;return !!scene()?.forfeit?.(reason)}
function getExitCost(){return Math.max(0,Number(scene()?.getExitCost?.()||0))}
window.POWDER_COMBAT_ENTRY_V177=Object.freeze({version:VERSION,startMap,startBoss,startEvent,isActive,getState,forfeit,getExitCost,syncReadyLaunch,applyTamerMemory,modes:Object.freeze(['map','boss','event'])});
})();
