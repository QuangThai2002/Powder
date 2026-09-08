(()=>{'use strict';
if(window.POWDER_COMBAT_ARCANE_POLISH_V2160)return;
const VERSION='22.0.4-safe-ui';
const FEATURE_FLAGS=window.POWDER_COMBAT_FEATURE_FLAGS_V1||{};
const DOMAIN_EXPANSION_ENABLED=FEATURE_FLAGS.DOMAIN_EXPANSION_ENABLED===true;
const state={loads:0,lastAt:Date.now(),presentation:'native-scene-only'};
function addScript(id,src,globalName){if(window[globalName]||document.getElementById(id))return null;const s=document.createElement('script');s.id=id;s.src=src;s.async=true;s.addEventListener('load',()=>{state.loads++;state.lastAt=Date.now()},{once:true});document.head.appendChild(s);return s}
function loadDomainEconomy(){addScript('powderCombatDomainTurnEconomy2165','js/combat-domain-turn-economy-v2165.js?v=2165','POWDER_COMBAT_DOMAIN_TURN_ECONOMY_V2165')}
function loadDomainClash(){addScript('powderCombatDomainClash2166','js/combat-domain-clash-v2166.js?v=2166','POWDER_COMBAT_DOMAIN_CLASH_V2166')}
function loadDomainAuthority(){addScript('powderCombatDomainClashAuthority2167','js/combat-domain-clash-authority-v2167.js?v=2167','POWDER_COMBAT_DOMAIN_CLASH_AUTHORITY_V2167')}
function loadDomainLearningEdge(){addScript('powderCombatDomainLearningEdge2168','js/combat-domain-learning-edge-v2168.js?v=2168','POWDER_COMBAT_DOMAIN_LEARNING_EDGE_V2168')}
function loadDomainSupremacy(){addScript('powderCombatDomainSupremacy2169','js/combat-domain-supremacy-v2169.js?v=2169','POWDER_COMBAT_DOMAIN_SUPREMACY_V2169')}
function loadDomainServerAuthority(){addScript('powderCombatDomainServerAuthority2170','js/combat-domain-server-authority-v2170.js?v=2178','POWDER_COMBAT_DOMAIN_SERVER_AUTHORITY_V2178')}
function loadPvpDomainCharge(){addScript('powderPvpDomainCharge2172','js/pvp-domain-charge-v2172.js?v=2172','POWDER_PVP_DOMAIN_CHARGE_V2172')}
function loadTacticalAi(){addScript('powderCombatTacticalAi2179','js/combat-tactical-ai-v2179.js?v=2179','POWDER_COMBAT_TACTICAL_AI_V2179')}
function loadTacticalTeam(){addScript('powderCombatTacticalTeam2180','js/combat-tactical-team-v2180.js?v=2180','POWDER_COMBAT_TACTICAL_TEAM_V2180')}
function loadBossAdaptiveAi(){addScript('powderCombatBossAdaptiveAi2181','js/combat-boss-adaptive-ai-v2181.js?v=2181','POWDER_COMBAT_BOSS_ADAPTIVE_AI_V2181')}
function loadCommandReadability(){addScript('powderCombatCommandReadability2188','js/combat-command-readability-v2188.js?v=2188','POWDER_COMBAT_COMMAND_READABILITY_V2188')}
function loadReserveEntry(){addScript('powderCombatReserveEntry2189','js/combat-reserve-entry-v2189.js?v=2189','POWDER_COMBAT_RESERVE_ENTRY_V2189')}
function loadTargetPreview(){addScript('powderCombatTargetPreview2192','js/combat-target-preview-v2192.js?v=2192','POWDER_COMBAT_TARGET_PREVIEW_V2192')}
function loadTargetNavigation(){addScript('powderCombatTargetNavigation2193','js/combat-target-navigation-v2193.js?v=2193','POWDER_COMBAT_TARGET_NAVIGATION_V2193')}
function loadLayout(){addScript('powderCombatLayout2200','js/combat-layout-v2200.js?v=22012','POWDER_COMBAT_LAYOUT_V2200')}
function loadPlayerExperience(){addScript('powderCombatPlayerExperience2201','js/combat-player-experience-v2201.js?v=22014','POWDER_COMBAT_PLAYER_EXPERIENCE_V2201')}
function refresh(){window.POWDER_COMBAT_LAYOUT_V2200?.refresh?.();window.POWDER_COMBAT_PLAYER_EXPERIENCE_V2201?.refresh?.()}
function snapshot(){return{version:VERSION,...state,domainServerAuthority:(window.POWDER_COMBAT_DOMAIN_SERVER_AUTHORITY_V2178||window.POWDER_COMBAT_DOMAIN_SERVER_AUTHORITY_V2170)?.snapshot?.()||null,pvpDomainCharge:window.POWDER_PVP_DOMAIN_CHARGE_V2172?.snapshot?.()||null,tacticalAi:window.POWDER_COMBAT_TACTICAL_AI_V2179?.snapshot?.()||null,tacticalTeam:window.POWDER_COMBAT_TACTICAL_TEAM_V2180?.snapshot?.()||null,bossAdaptiveAi:window.POWDER_COMBAT_BOSS_ADAPTIVE_AI_V2181?.snapshot?.()||null,commandReadability:window.POWDER_COMBAT_COMMAND_READABILITY_V2188?.snapshot?.()||null,reserveEntry:window.POWDER_COMBAT_RESERVE_ENTRY_V2189?.snapshot?.()||null,targetPreview:window.POWDER_COMBAT_TARGET_PREVIEW_V2192?.snapshot?.()||null,targetNavigation:window.POWDER_COMBAT_TARGET_NAVIGATION_V2193?.snapshot?.()||null,layout2200:window.POWDER_COMBAT_LAYOUT_V2200?.snapshot?.()||null,playerExperience2201:window.POWDER_COMBAT_PLAYER_EXPERIENCE_V2201?.snapshot?.()||null,performance:'native Combat Scene timing; presentation-only overlay',gameplayMutation:'tactical/domain gameplay modules preserved',damageFormulaMutation:false,skillDataMutation:false,serverMutation:false,audioMutation:false,scrollMutation:'single reserved-region layout'}}
window.POWDER_COMBAT_ARCANE_POLISH_V2160={version:VERSION,snapshot,refresh};
if(DOMAIN_EXPANSION_ENABLED){loadDomainEconomy();loadDomainClash();loadDomainAuthority();loadDomainLearningEdge();loadDomainSupremacy();loadDomainServerAuthority();loadPvpDomainCharge()}
loadTacticalAi();loadTacticalTeam();loadBossAdaptiveAi();loadCommandReadability();loadReserveEntry();loadTargetPreview();loadTargetNavigation();loadLayout();loadPlayerExperience();
})();
