(()=>{'use strict';
const root=typeof window!=='undefined'?window:globalThis,LIMIT=64;
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function key(){return String(root.POWDER_CONFIG?.storageKey||'').trim()}
function storage(){try{return root.localStorage||null}catch{return null}}
function read(name){try{return storage()?.getItem(name)||null}catch{return null}}
function write(name,value){try{const s=storage(),text=JSON.stringify(value);if(!s)return false;s.setItem(name,text);return s.getItem(name)===text}catch{return false}}
function remove(name){try{storage()?.removeItem(name)}catch{}}
function parsed(raw){try{const value=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}}
function journalKey(base){return `${base}_combat_academic_journal_v1`}
function txKey(base){return `${base}_combat_academic_tx_v1`}
function journal(base){const records=parsed(read(journalKey(base)))?.records;return Array.isArray(records)?records.filter(row=>row&&typeof row==='object').slice(-LIMIT):[]}
function saveJournal(base,records){return write(journalKey(base),{version:1,records:records.slice(-LIMIT)})}
function receipt(record,snapshot,duplicate=false,stale=false){return{ok:true,duplicate,stale,battleId:record.battleId,battleCreatedAt:record.battleCreatedAt,applied:clone(record.applied)||{responses:0,correct:0,wrong:0},powGrowth:clone(record.powGrowth)||{totalExp:0,byPow:{}},appliedAt:record.appliedAt||0,snapshot:clone(snapshot)}}
function hasApplied(snapshot,tx){const marker=snapshot?.saveMeta?.lastCombatAcademicTx;return marker?.version===1&&marker.battleId===tx?.battleId&&marker.transactionId===tx?.transactionId}
function reconcile(base,snapshot){const raw=read(txKey(base));if(!raw)return null;const tx=parsed(raw);if(!tx?.battleId||!tx.transactionId)return{state:'ambiguous',tx};const records=journal(base),committed=records.find(row=>row.battleId===tx.battleId&&row.state==='committed');if(committed){remove(txKey(base));return{state:'committed',record:committed}}
if(!hasApplied(snapshot,tx))return{state:'ambiguous',tx};
const record={...tx,state:'committed'};if(saveJournal(base,[...records.filter(row=>row.battleId!==tx.battleId),record])){remove(txKey(base));return{state:'committed',record}}
return{state:'applied-pending',record}}
function validCreatedAt(value){return Number.isSafeInteger(value)&&value>0}
function boundary(snapshot){return snapshot?.saveMeta?.combatAcademicBoundary||null}
function staleReceipt(battleId,battleCreatedAt,snapshot){return receipt({battleId,battleCreatedAt,applied:{responses:0,correct:0,wrong:0},powGrowth:{totalExp:0,byPow:{}}},snapshot,true,true)}
function validateResponses(responses,allowed){if(!Array.isArray(responses)||!responses.length||!Array.isArray(allowed)||!allowed.length)return{ok:false,reason:'invalid-academic-responses'};const pool=new Map();for(const raw of allowed){const id=String(raw?.id||'').trim();if(id&&raw&&typeof raw==='object'&&!pool.has(id))pool.set(id,clone(raw))}const seen=new Set(),out=[];for(const raw of responses){const id=String(raw?.question?.id||'').trim();if(!id||!pool.has(id))return{ok:false,reason:'academic-question-not-allowed'};if(seen.has(id))return{ok:false,reason:'duplicate-academic-question'};if(typeof raw?.correct!=='boolean'||typeof raw?.powId!=='string'||raw.powId.length>160)return{ok:false,reason:'invalid-academic-response'};seen.add(id);out.push({powId:raw.powId.trim(),correct:raw.correct,question:pool.get(id)})}return{ok:true,responses:out}}
function applyOfflineCombatAcademicOutcome(input={}){
if(input.authorityMode!=='offline')return{ok:false,reason:'server-authority-required'};
const base=key(),battleId=String(input.battleId||'').trim(),createdAt=input.battleCreatedAt;
if(!base||!storage())return{ok:false,reason:'academic-storage-unavailable'};
if(!/^[A-Za-z0-9._:-]{1,160}$/.test(battleId))return{ok:false,reason:'invalid-battle-id'};
const player=root.POWDER_PLAYER_STATE_AUTHORITY_V1,engine=root.POWDER_ENGINE,learning=root.POWDER_LEARNING_MASTER_V2,growth=root.POWDER_GROWTH_V143,data=root.POWDER_DATA;
if(typeof player?.loadSnapshot!=='function'||typeof player?.atomicCommit!=='function'||typeof engine?.recordQuestionResult!=='function'||typeof learning?.recordQuestionMastery!=='function'||typeof growth?.combatExp!=='function'||typeof growth?.addPowExperience!=='function'||!Array.isArray(data?.pows))return{ok:false,reason:'academic-dependency-unavailable'};
const loaded=player.loadSnapshot({storageKey:base});if(!loaded?.ok)return{ok:false,reason:loaded?.reason||'player-load-failed'};
const persisted=loaded.snapshot,provided=input.snapshot&&typeof input.snapshot==='object'?clone(input.snapshot):null;
const diskBoundary=boundary(persisted),ramBoundary=boundary(provided);
const diskAhead=Number(diskBoundary?.battleCreatedAt||0)>Number(ramBoundary?.battleCreatedAt||0);
const source=provided&&!diskAhead?provided:clone(persisted);
source.saveMeta={...(persisted.saveMeta||{}),...(source.saveMeta||{})};
const recovery=reconcile(base,persisted);
if(recovery?.state==='ambiguous')return{ok:false,reason:'combat-academic-recovery-ambiguous'};
if(recovery?.record?.battleId===battleId)return receipt(recovery.record,source,true);
if(recovery?.state==='applied-pending')return{ok:false,reason:'combat-academic-recovery-pending'};
if(!validCreatedAt(createdAt))return{ok:false,reason:'invalid-battle-created-at'};
const committed=journal(base).find(row=>row.battleId===battleId&&row.state==='committed');if(committed)return receipt(committed,source,true);
const high=boundary(source),persistedHigh=boundary(persisted),latest=Number(persistedHigh?.battleCreatedAt||0)>Number(high?.battleCreatedAt||0)?persistedHigh:high;
if(latest&&validCreatedAt(latest.battleCreatedAt)){
  if(createdAt<latest.battleCreatedAt||createdAt===latest.battleCreatedAt&&latest.battleId===battleId)return staleReceipt(battleId,createdAt,source);
  if(createdAt===latest.battleCreatedAt)return{ok:false,reason:'combat-academic-boundary-collision'};
}
const checked=validateResponses(input.responses,input.allowedQuestionPool);if(!checked.ok)return checked;
const next=clone(source),owned=next.owned&&typeof next.owned==='object'?next.owned:{},known=new Map(data.pows.map(pow=>[pow.id,pow]));
next.battleMistakes=Array.isArray(next.battleMistakes)?next.battleMistakes:[];
const applied={responses:checked.responses.length,correct:0,wrong:0},powGrowth={totalExp:0,byPow:{}};
function grow(id,amount){const result=growth.addPowExperience(known.get(id),owned[id],amount);if(!result.gained&&!result.levels)return;const row=powGrowth.byPow[id]||{gained:0,levels:0,level:result.level};row.gained+=result.gained;row.levels+=result.levels;row.level=result.level;powGrowth.byPow[id]=row;powGrowth.totalExp+=result.gained}
for(const response of checked.responses){const q=response.question;engine.recordQuestionResult(next,q,response.correct);learning.recordQuestionMastery(next,q,response.correct);if(!response.correct){applied.wrong++;next.battleMistakes.push(q.id);continue}applied.correct++;const primary=owned[response.powId]?response.powId:(owned[next.activePowId]?next.activePowId:(next.team||[]).find(id=>owned[id]));if(!primary||!known.has(primary))continue;const gain=growth.combatExp(next.rank);grow(primary,gain.primary);for(const id of next.team||[])if(id!==primary&&owned[id])grow(id,gain.team)}
learning.normalizeSave?.(next);next.mastery=learning.averageMastery?.(next)||0;
const appliedAt=Date.now(),transactionId=`combat-academic:${battleId}:${appliedAt}:${Math.random().toString(36).slice(2)}`;
next.saveMeta={...(next.saveMeta||{}),lastSavedAt:appliedAt,lastReason:'combat-academic-authority',lastCombatAcademicTx:{version:1,battleId,transactionId,appliedAt},combatAcademicBoundary:{version:1,battleCreatedAt:createdAt,battleId,settledAt:appliedAt}};
const record={version:1,transactionId,battleId,battleCreatedAt:createdAt,applied,powGrowth,appliedAt,state:'pending'};
if(!write(txKey(base),record))return{ok:false,reason:'academic-transaction-write-failed'};
if(!saveJournal(base,[...journal(base).filter(row=>row.battleId!==battleId),record])){remove(txKey(base));return{ok:false,reason:'academic-journal-pending-write-failed'}}
const commit=player.atomicCommit(next,{storageKey:base});if(!commit?.ok){const rows=journal(base);saveJournal(base,rows.filter(row=>row.battleId!==battleId));remove(txKey(base));return{ok:false,reason:commit?.reason||'academic-player-save-failed'}}
const committedRecord={...record,state:'committed'};if(saveJournal(base,[...journal(base).filter(row=>row.battleId!==battleId),committedRecord]))remove(txKey(base));
return receipt(committedRecord,commit.snapshot,false)
}
function readCombatAcademicReceipt(battleId){const base=key(),loaded=root.POWDER_PLAYER_STATE_AUTHORITY_V1?.loadSnapshot?.({storageKey:base});if(!base||!loaded?.ok)return null;const recovery=reconcile(base,loaded.snapshot),record=journal(base).find(row=>row.battleId===battleId&&row.state==='committed')||(recovery?.record?.battleId===battleId?recovery.record:null);return record?receipt(record,loaded.snapshot,true):null}
root.POWDER_COMBAT_ACADEMIC_AUTHORITY_V1={version:'1.0.0',applyOfflineCombatAcademicOutcome,readCombatAcademicReceipt};
})();
