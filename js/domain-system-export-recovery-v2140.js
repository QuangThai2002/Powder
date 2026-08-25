(()=>{'use strict';
if(window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140)return;
const VERSION='21.4.0';
const state={recovered:false,alreadyValid:false,simpleCount:0,expansionCount:0,normalCount:0,specialCount:0,lastAt:0,reason:'boot'};
function valid(api){return api&&Object.keys(api.SIMPLE||{}).length===3&&Object.keys(api.EXPANSIONS||{}).length===9}
function recover(reason='manual'){
  state.reason=reason;state.lastAt=Date.now();
  const existing=window.POWDER_DOMAIN_SYSTEM_V15;
  if(valid(existing)){state.alreadyValid=true;state.simpleCount=Object.keys(existing.SIMPLE).length;state.expansionCount=Object.keys(existing.EXPANSIONS).length;state.normalCount=Object.values(existing.EXPANSIONS).filter(x=>x?.kind==='normal').length;state.specialCount=Object.values(existing.EXPANSIONS).filter(x=>x?.kind==='special').length;return existing}
  const C=window.POWDER_COMBAT_CORE_V7,S=C?.TAMER_SIMPLE||{},E=C?.TAMER_EXPANSIONS||{};
  const simpleIds=Object.keys(S),expansionIds=Object.keys(E),normal=expansionIds.filter(id=>E[id]?.kind==='normal'),special=expansionIds.filter(id=>E[id]?.kind==='special');
  state.simpleCount=simpleIds.length;state.expansionCount=expansionIds.length;state.normalCount=normal.length;state.specialCount=special.length;
  if(simpleIds.length!==3||expansionIds.length!==9||normal.length!==6||special.length!==3)return null;
  const api={version:'15.0.0+recovery-21.4.0',SIMPLE:S,EXPANSIONS:E,LEVELS:C.DOMAIN_LEVELS||{},BRANCH:C.DOMAIN_BRANCHES||{},SWORDS:C.DOMAIN_SWORDS||[],PVP_CAP:C.PVP_DOMAIN_DIRECT_CAP||{},pvpCap:()=>Infinity,lockedSimpleCount:3,lockedExpansionCount:9,normalExpansionCount:6,specialExpansionCount:3,lockedExpansionIds:[...expansionIds],serverVerifiedOnline:['limitless_void','draw_swords','jackpot_bagua'],recoveredExport:true,policy:{simpleModes:['pve','pvp'],expansionModes:['pvp'],durationUnit:'action',source:'Combat Core patched by signed domain-system-v15.js; export recovered post-boot only'}};
  window.POWDER_DOMAIN_SYSTEM_V15=api;window.POWDER_DOMAIN_SYSTEM_V14=api;window.POWDER_DOMAIN_SYSTEM_V13=api;state.recovered=true;
  try{window.dispatchEvent(new CustomEvent('powder:domain-api-recovered',{detail:snapshot()}))}catch(_){}
  return api;
}
function snapshot(){return{version:VERSION,...state,valid:valid(window.POWDER_DOMAIN_SYSTEM_V15),mechanicsMutation:false,policy:'restore missing canonical Domain API export from already-patched Combat Core; no gameplay formula changes'}}
window.POWDER_DOMAIN_EXPORT_RECOVERY_V2140={version:VERSION,recover,snapshot};
recover('boot');
})();
