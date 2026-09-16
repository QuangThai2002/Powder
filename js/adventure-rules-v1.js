(()=>{'use strict';
const root=typeof window!=='undefined'?window:globalThis;
const data=()=>root.POWDER_ADVENTURE_DATA;
function island(value){return data()?.islandById?.(typeof value==='object'?value?.id:value)||null}
function stage(value){return data()?.stageById?.(typeof value==='object'?value?.id:value)||null}
function islandUnlocked(value,progress={}){const current=island(value);return !!current&&Number(current.id)<=Number(progress.islandsUnlocked||1)}
function stageUnlocked(value,progress={}){const current=stage(value);if(!current||!islandUnlocked(current.islandId,progress))return false;if(current.number===1)return true;return !!progress.stageWins?.[`${current.islandId}-${current.number-1}`]}
function stageDone(value,progress={}){const current=stage(value);return !!current&&!!progress.stageWins?.[current.id]}
function isFreeCombatOnboarding(value){const current=stage(value);return current?.id==='1-1'&&current.islandId===1&&current.number===1}
function nextStage(value){const current=stage(value);if(!current)return null;const next=island(current.islandId)?.stages.find(item=>item.number===current.number+1);return next||island(current.islandId+1)?.stages?.[0]||null}
function areaCompleted(value){return !!stage(value)&&!nextStage(value)}
function currentSuggested(progress={}){const ci=Math.min(12,Math.max(1,Number(progress.currentIsland)||1)),current=island(ci)||data()?.islands?.[0];return current?.stages.find(item=>stageUnlocked(item,progress)&&!stageDone(item,progress))||current?.stages?.at(-1)||null}
root.POWDER_ADVENTURE_RULES_V1={version:'1.0.0',islandUnlocked,stageUnlocked,stageDone,isFreeCombatOnboarding,nextStage,areaCompleted,currentSuggested};
})();
