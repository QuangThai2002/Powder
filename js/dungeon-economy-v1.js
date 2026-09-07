(()=>{'use strict';
const VERSION='1.0.0',DEFAULT_STAMINA=100,MAX_ATTEMPTS=32;
const clone=value=>{try{return value==null?null:JSON.parse(JSON.stringify(value));}catch{return null;}};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const integer=(value,fallback=0)=>Math.max(0,Math.floor(Number.isFinite(Number(value))?Number(value):fallback));
const trimObject=(value,limit,timeKey)=>Object.fromEntries(Object.entries(object(value)).sort((a,b)=>Number(a[1]?.[timeKey]||0)-Number(b[1]?.[timeKey]||0)).slice(-limit));
function rewardBundle(value){
 const raw=object(value),candy=object(raw.powCandy);
 return{coins:integer(raw.coins),exp:integer(raw.exp),powCandy:{common:integer(candy.common),rare:integer(candy.rare),legendary:integer(candy.legendary)}};
}
function economy(stage){
 const raw=object(stage?.economy),ratio=Number(raw.defeatStaminaRatio);
 return{staminaCost:integer(raw.staminaCost),firstAttemptStaminaCost:raw.firstAttemptStaminaCost==null?null:integer(raw.firstAttemptStaminaCost),defeatStaminaRatio:Number.isFinite(ratio)?Math.max(0,Math.min(1,ratio)):.5,firstClearRewards:rewardBundle(raw.firstClearRewards),repeatRewards:rewardBundle(raw.repeatRewards)};
}
function progressEntry(value){const raw=object(value);return{cleared:raw.cleared===true,firstClearClaimed:raw.firstClearClaimed===true,clearCount:integer(raw.clearCount),attemptCount:integer(raw.attemptCount)};}
function normalizeAdventure(value){
 const out={...object(clone(value))},rawStamina=object(out.dungeonStamina),max=Math.max(1,integer(rawStamina.max,DEFAULT_STAMINA));
 out.version=Math.max(2,integer(out.version,2));
 out.dungeonStamina={current:Math.min(max,integer(rawStamina.current,max)),max};
 out.dungeonProgress=Object.fromEntries(Object.entries(object(out.dungeonProgress)).map(([id,row])=>[String(id),progressEntry(row)]));
 out.dungeonAttempts=trimObject(out.dungeonAttempts,MAX_ATTEMPTS,'startedAt');
 out.dungeonSettlements=object(out.dungeonSettlements);
 return out;
}
function academicMode(stage){return Number(stage?.number)===1?'free-combat':'learning-gated';}
function attemptPreview(stage,adventure){
 const state=normalizeAdventure(adventure),stageId=String(stage?.id||''),progress=progressEntry(state.dungeonProgress[stageId]),config=economy(stage),firstAttempt=progress.attemptCount===0;
 const staminaCost=firstAttempt&&config.firstAttemptStaminaCost!=null?config.firstAttemptStaminaCost:config.staminaCost;
 return{ok:!!stageId,stageId,academicMode:academicMode(stage),firstAttempt,firstClear:!progress.firstClearClaimed,staminaCost,staminaCurrent:state.dungeonStamina.current,staminaMax:state.dungeonStamina.max,canStart:!!stageId&&state.dungeonStamina.current>=staminaCost,reward:progress.firstClearClaimed?config.repeatRewards:config.firstClearRewards,rewardKind:progress.firstClearClaimed?'repeat':'first-clear'};
}
function beginAttempt(stage,adventure,battleId){
 const state=normalizeAdventure(adventure),id=String(battleId||''),preview=attemptPreview(stage,state);
 if(!/^c2-[a-z0-9]+$/i.test(id)||!preview.ok)return{ok:false,reason:'invalid-attempt'};
 if(state.dungeonSettlements[id])return{ok:false,reason:'already-settled'};
 if(state.dungeonAttempts[id])return{ok:true,duplicate:true,adventure:state,attempt:clone(state.dungeonAttempts[id])};
 if(!preview.canStart)return{ok:false,reason:'insufficient-stamina',preview};
 const row=progressEntry(state.dungeonProgress[preview.stageId]);
 state.dungeonStamina.current-=preview.staminaCost;
 state.dungeonProgress[preview.stageId]={...row,attemptCount:row.attemptCount+1};
 const attempt={battleId:id,stageId:preview.stageId,academicMode:preview.academicMode,chargedStamina:preview.staminaCost,economy:economy(stage),startedAt:Date.now()};
 state.dungeonAttempts[id]=attempt;
 state.dungeonAttempts=trimObject(state.dungeonAttempts,MAX_ATTEMPTS,'startedAt');
 return{ok:true,duplicate:false,adventure:state,attempt:clone(attempt),preview};
}
function cancelAttempt(adventure,battleId){
 const state=normalizeAdventure(adventure),id=String(battleId||''),attempt=state.dungeonAttempts[id];
 if(!attempt)return{ok:true,duplicate:true,adventure:state};
 const row=progressEntry(state.dungeonProgress[attempt.stageId]);
 state.dungeonStamina.current=Math.min(state.dungeonStamina.max,state.dungeonStamina.current+integer(attempt.chargedStamina));
 state.dungeonProgress[attempt.stageId]={...row,attemptCount:Math.max(0,row.attemptCount-1)};
 delete state.dungeonAttempts[id];
 return{ok:true,duplicate:false,adventure:state};
}
function settleAttempt(adventure,battleId,result){
 const state=normalizeAdventure(adventure),id=String(battleId||''),prior=state.dungeonSettlements[id];
 if(prior)return{ok:true,duplicate:true,adventure:state,receipt:clone(prior),reward:rewardBundle(prior.reward)};
 const attempt=state.dungeonAttempts[id];
 if(!attempt)return{ok:false,reason:'attempt-not-found'};
 const won=String(result||'').toLowerCase()==='victory',defeated=String(result||'').toLowerCase()==='defeat',config=economy({economy:attempt.economy}),row=progressEntry(state.dungeonProgress[attempt.stageId]);
 let reward=rewardBundle({}),claimId='',staminaSpent=integer(attempt.chargedStamina);
 if(won){
  const firstClear=!row.firstClearClaimed;
  reward=firstClear?config.firstClearRewards:config.repeatRewards;
  claimId=firstClear?`dungeon:first-clear:${attempt.stageId}`:`dungeon:repeat:${id}`;
  state.dungeonProgress[attempt.stageId]={...row,cleared:true,firstClearClaimed:true,clearCount:row.clearCount+1};
 }else{
  staminaSpent=defeated?Math.floor(integer(attempt.chargedStamina)*config.defeatStaminaRatio):0;
  state.dungeonStamina.current=Math.min(state.dungeonStamina.max,state.dungeonStamina.current+integer(attempt.chargedStamina)-staminaSpent);
 }
 delete state.dungeonAttempts[id];
 const receipt={battleId:id,stageId:attempt.stageId,result:String(result||''),claimId,reward:clone(reward),staminaSpent,settledAt:Date.now()};
 state.dungeonSettlements[id]=receipt;
 return{ok:true,duplicate:false,adventure:state,receipt:clone(receipt),reward:clone(reward)};
}
window.POWDER_DUNGEON_ECONOMY_V1=Object.freeze({version:VERSION,normalizeAdventure,academicMode,economy,attemptPreview,beginAttempt,cancelAttempt,settleAttempt,rewardBundle});
})();
