(()=>{'use strict';
const root=typeof window!=='undefined'?window:globalThis;
const data=()=>root.POWDER_ADVENTURE_DATA;
function island(value){return data()?.islandById?.(typeof value==='object'?value?.id:value)||null}
function stage(value){return data()?.stageById?.(typeof value==='object'?value?.id:value)||null}
function islandUnlocked(value,progress={}){const current=island(value);return !!current&&Number(current.id)<=Number(progress.islandsUnlocked||1)}
function stageUnlocked(value,progress={}){const current=stage(value);if(!current||!islandUnlocked(current.islandId,progress))return false;if(current.number===1)return true;return !!progress.stageWins?.[`${current.islandId}-${current.number-1}`]}
function stageDone(value,progress={}){const current=stage(value);return !!current&&!!progress.stageWins?.[current.id]}
function isFreeCombatOnboarding(value){const current=stage(value);return current?.id==='1-1'&&current.islandId===1&&current.number===1}
function minimumTeamSize(value){const current=stage(value),minimum=Number(current?.entryPolicy?.minimumTeamSize);return Number.isInteger(minimum)&&minimum>=1&&minimum<=5?minimum:0}
function powExpEnabled(value){const current=stage(value);return !!current&&current.growthPolicy?.powExpEnabled!==false}
function starPolicy(value){const current=stage(value);if(!current)return null;const raw=current.starPolicy&&typeof current.starPolicy==='object'?current.starPolicy:{},speed=Number(raw.speedRoundExclusive),survivor=Number(raw.survivorMinimum);return{speedRoundExclusive:Number.isInteger(speed)&&speed>0?speed:10,survivorMinimum:Number.isInteger(survivor)&&survivor>0?survivor:null,requireAllDeployedSurvive:raw.requireAllDeployedSurvive===true}}
function playerTeamEntry(value,save={},eligibilityApi=root.POWDER_PLAYER_POW_ELIGIBILITY_V1){const current=stage(value),minimum=minimumTeamSize(current);if(!current||!minimum)return{ready:false,minimumTeamSize:0,team:[],reason:'invalid-stage-policy'};const owned=save?.owned&&typeof save.owned==='object'?save.owned:{},eligible=id=>!!owned[id]&&eligibilityApi?.isPlayerEligible?.(id)===true,seen=new Set(),team=[];for(const raw of Array.isArray(save?.team)?save.team:[]){const id=String(raw||'').trim().toLowerCase();if(!id||seen.has(id)||!eligible(id))continue;seen.add(id);team.push(id);if(team.length>=5)break}const starter=String(save?.starterId||'').trim().toLowerCase();if(!team.length&&starter&&!seen.has(starter)&&eligible(starter))team.push(starter);return{ready:team.length>=minimum,minimumTeamSize:minimum,team,reason:team.length>=minimum?'':'minimum-team-size'}}
function nextStage(value){const current=stage(value);if(!current)return null;const next=island(current.islandId)?.stages.find(item=>item.number===current.number+1);return next||island(current.islandId+1)?.stages?.[0]||null}
function areaCompleted(value){return !!stage(value)&&!nextStage(value)}
function currentSuggested(progress={}){const ci=Math.min(12,Math.max(1,Number(progress.currentIsland)||1)),current=island(ci)||data()?.islands?.[0];return current?.stages.find(item=>stageUnlocked(item,progress)&&!stageDone(item,progress))||current?.stages?.at(-1)||null}
root.POWDER_ADVENTURE_RULES_V1={version:'1.1.0-phase1',islandUnlocked,stageUnlocked,stageDone,isFreeCombatOnboarding,minimumTeamSize,powExpEnabled,starPolicy,playerTeamEntry,nextStage,areaCompleted,currentSuggested};
})();
