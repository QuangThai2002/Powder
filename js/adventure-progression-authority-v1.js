(()=>{'use strict';
const root=typeof window!=='undefined'?window:globalThis,LIMIT=64;
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function baseKey(){return String(root.POWDER_CONFIG?.storageKey||'').trim()}
function storage(){try{return root.localStorage||null}catch{return null}}
function read(key){try{return storage()?.getItem(key)||null}catch{return null}}
function write(key,value){try{const s=storage(),text=JSON.stringify(value);if(!s)return false;s.setItem(key,text);return s.getItem(key)===text}catch{return false}}
function remove(key){try{storage()?.removeItem(key)}catch{}}
function parse(raw){try{const value=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}}
const journalKey=base=>`${base}_adventure_progression_journal_v1`,txKey=base=>`${base}_adventure_progression_tx_v1`;
function journal(base){const records=parse(read(journalKey(base)))?.records;return Array.isArray(records)?records.filter(row=>row&&typeof row==='object').slice(-LIMIT):[]}
function saveJournal(base,records){return write(journalKey(base),{version:1,records:records.slice(-LIMIT)})}
function receipt(record,snapshot,duplicate=false,stale=false){return{ok:true,duplicate,stale,battleId:record.battleId,stageId:record.stageId,progressionApplied:!!record.progressionApplied,starsAwarded:record.starsAwarded||0,stageStars:record.stageStars||0,knowledgeAccuracy:record.knowledgeAccuracy||0,gateMastery:record.gateMastery??0,nextStageId:record.nextStageId||null,nextStageExists:!!record.nextStageId,nextStageProgressionUnlocked:!!record.nextStageProgressionUnlocked,areaCompleted:!!record.areaCompleted,appliedAt:record.appliedAt||0,snapshot:clone(snapshot)}}
function hasApplied(snapshot,tx){const marker=snapshot?.saveMeta?.lastAdventureProgressionTx;return marker?.version===1&&marker.battleId===tx?.battleId&&marker.transactionId===tx?.transactionId}
function reconcile(base,snapshot){const raw=read(txKey(base));if(!raw)return null;const tx=parse(raw);if(!tx?.battleId||!tx.transactionId)return{state:'ambiguous',tx};const records=journal(base),committed=records.find(row=>row.battleId===tx.battleId&&row.state==='committed');if(committed){remove(txKey(base));return{state:'committed',record:committed}}
if(!hasApplied(snapshot,tx))return{state:'ambiguous',tx};const record={...tx,state:'committed'};
if(saveJournal(base,[...records.filter(row=>row.battleId!==tx.battleId),record])){remove(txKey(base));return{state:'committed',record}}
return{state:'applied-pending',record}}
function boundary(snapshot){return snapshot?.saveMeta?.adventureProgressionBoundary||null}
function validCreatedAt(value){return Number.isSafeInteger(value)&&value>0}
function knowledgeAccuracy(summary){const players=Array.isArray(summary?.players)?summary.players:[],actions=players.reduce((sum,row)=>sum+(Number(row?.knowledgeActions)||0),0);return actions?players.reduce((sum,row)=>sum+(Number(row?.knowledgeSum)||0),0)/actions:0}
function staleReceipt(battleId,stageId,snapshot){return receipt({battleId,stageId,progressionApplied:false},snapshot,true,true)}
function applyOfflineAdventureVictory(input={}){
if(input.authorityMode!=='offline')return{ok:false,reason:'server-authority-required'};
if(input.result&&input.result!=='victory')return{ok:false,reason:'victory-only-progression'};
const base=baseKey(),id=String(input.battleId||'').trim(),createdAt=input.battleCreatedAt,stageId=String(input.stageId||'').trim();
if(!base||!storage())return{ok:false,reason:'adventure-storage-unavailable'};
if(!/^[A-Za-z0-9._:-]{1,160}$/.test(id))return{ok:false,reason:'invalid-battle-id'};
const stage=root.POWDER_ADVENTURE_DATA?.stageById?.(stageId),rules=root.POWDER_ADVENTURE_RULES_V1,player=root.POWDER_PLAYER_STATE_AUTHORITY_V1;
if(!stage)return{ok:false,reason:'invalid-adventure-stage'};
if(typeof rules?.nextStage!=='function'||typeof player?.loadSnapshot!=='function'||typeof player?.atomicCommit!=='function')return{ok:false,reason:'adventure-dependency-unavailable'};
const loaded=player.loadSnapshot({storageKey:base});if(!loaded?.ok)return{ok:false,reason:loaded?.reason||'player-load-failed'};
const persisted=loaded.snapshot,provided=input.snapshot&&typeof input.snapshot==='object'?clone(input.snapshot):null;
const diskAhead=Number(boundary(persisted)?.battleCreatedAt||0)>Number(boundary(provided)?.battleCreatedAt||0),source=provided&&!diskAhead?provided:clone(persisted);
source.saveMeta={...(persisted.saveMeta||{}),...(source.saveMeta||{})};
const recovery=reconcile(base,persisted);if(recovery?.state==='ambiguous')return{ok:false,reason:'adventure-progression-recovery-ambiguous'};
if(recovery?.record?.battleId===id)return receipt(recovery.record,source,true);
if(recovery?.state==='applied-pending')return{ok:false,reason:'adventure-progression-recovery-pending'};
if(!validCreatedAt(createdAt))return{ok:false,reason:'invalid-battle-created-at'};
const committed=journal(base).find(row=>row.battleId===id&&row.state==='committed');if(committed)return receipt(committed,source,true);
const high=boundary(source),persistedHigh=boundary(persisted),latest=Number(persistedHigh?.battleCreatedAt||0)>Number(high?.battleCreatedAt||0)?persistedHigh:high;
if(latest&&validCreatedAt(latest.battleCreatedAt)){
  if(createdAt<latest.battleCreatedAt||createdAt===latest.battleCreatedAt&&latest.battleId===id)return staleReceipt(id,stageId,source);
  if(createdAt===latest.battleCreatedAt)return{ok:false,reason:'adventure-progression-boundary-collision'};
}
if(!rules.stageUnlocked(stage,source.adventure||{}))return{ok:false,reason:'adventure-stage-locked'};
const mastery=Number(input.gateMastery);if(!Number.isFinite(mastery)||mastery<0||mastery>100)return{ok:false,reason:'invalid-gate-mastery'};
const next=clone(source),progress=next.adventure&&typeof next.adventure==='object'?next.adventure:{};
progress.stageWins={...(progress.stageWins||{}),[stage.id]:true};
const knowledge=knowledgeAccuracy(input.battleSummary),stars=Math.min(3,1+(mastery>=90?1:0)+(knowledge>=.95?1:0));
progress.stageStars={...(progress.stageStars||{}),[stage.id]:Math.max(Number(progress.stageStars?.[stage.id])||0,stars)};
const following=rules.nextStage(stage);let islandsUnlocked=Number(progress.islandsUnlocked)||1,currentIsland=stage.islandId,currentStage=stage.number;
if(following){currentIsland=following.islandId;currentStage=following.number;if(following.islandId>stage.islandId)islandsUnlocked=Math.max(islandsUnlocked,following.islandId)}
progress.islandsUnlocked=islandsUnlocked;progress.currentIsland=currentIsland;progress.currentStage=currentStage;
progress.lastStage=stage.id;progress.lastBattleKnowledge=knowledge;
progress.totalStars=Object.values(progress.stageStars).reduce((sum,value)=>sum+Math.max(0,Math.min(3,Math.floor(Number(value)||0))),0);
next.adventure=progress;
const appliedAt=Date.now(),transactionId=`adventure-progression:${id}:${appliedAt}:${Math.random().toString(36).slice(2)}`;
next.saveMeta={...(next.saveMeta||{}),lastSavedAt:appliedAt,lastReason:'adventure-progression-authority',lastAdventureProgressionTx:{version:1,battleId:id,transactionId,appliedAt},adventureProgressionBoundary:{version:1,battleCreatedAt:createdAt,battleId:id,settledAt:appliedAt}};
const record={version:1,battleId:id,battleCreatedAt:createdAt,transactionId,stageId:stage.id,progressionApplied:true,starsAwarded:stars,stageStars:progress.stageStars[stage.id],knowledgeAccuracy:knowledge,gateMastery:mastery,nextStageId:following?.id||null,nextStageProgressionUnlocked:!!following&&rules.stageUnlocked(following,progress),areaCompleted:rules.areaCompleted(stage),appliedAt,state:'pending'};
if(!write(txKey(base),record))return{ok:false,reason:'adventure-transaction-write-failed'};
if(!saveJournal(base,[...journal(base).filter(row=>row.battleId!==id),record])){remove(txKey(base));return{ok:false,reason:'adventure-journal-pending-write-failed'}}
const commit=player.atomicCommit(next,{storageKey:base});if(!commit?.ok){saveJournal(base,journal(base).filter(row=>row.battleId!==id));remove(txKey(base));return{ok:false,reason:commit?.reason||'adventure-player-save-failed'}}
const committedRecord={...record,state:'committed'};if(saveJournal(base,[...journal(base).filter(row=>row.battleId!==id),committedRecord]))remove(txKey(base));
return receipt(committedRecord,commit.snapshot,false)
}
root.POWDER_ADVENTURE_PROGRESSION_AUTHORITY_V1={version:'1.0.0',applyOfflineAdventureVictory};
})();
