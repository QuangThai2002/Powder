import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||path.join(here,'..'));
const authorityPath=path.join(root,'js/player-state-authority-v1.js');
const authoritySource=fs.readFileSync(authorityPath,'utf8');
assert.equal(/\bdocument\b|querySelector|\bPhaser\b/.test(authoritySource),false,'authority source must stay DOM/Phaser independent');
const STORAGE_KEY='powder.verify.player';

class FakeStorage{
  constructor(seed={}){this.map=new Map(Object.entries(seed));this.failRule=null;}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){const text=String(value);if(this.failRule?.(key,text)===true)throw new Error(`forced write failure: ${key}`);this.map.set(key,text);}
  removeItem(key){this.map.delete(key);}
  clear(){this.map.clear();}
  key(index){return[...this.map.keys()][index]??null;}
  get length(){return this.map.size;}
  dump(){return Object.fromEntries(this.map);}
}
function baseSave(coins=500,exp=10,wins=2){return{saveVersion:15,coins,exp,wins,saveMeta:{schema:15,lastSavedAt:100,lastReason:'verify'}};}
function boot(storage){const window={POWDER_CONFIG:{storageKey:STORAGE_KEY},localStorage:storage};const context=vm.createContext({window,globalThis:window,console,JSON,Map,Date,Number,String,Array,Object,Math,RegExp,Error});vm.runInContext(authoritySource,context,{filename:'player-state-authority-v1.js'});assert.equal(typeof window.POWDER_PLAYER_STATE_AUTHORITY_V1?.applyOfflineBattleReward,'function','authority API missing');assert.equal('document' in context,false,'authority must not require DOM');return window.POWDER_PLAYER_STATE_AUTHORITY_V1;}
function seedStorage(storage,snapshot){storage.setItem(STORAGE_KEY,JSON.stringify(snapshot));}
function persisted(storage){return JSON.parse(storage.getItem(STORAGE_KEY));}
function assertBalances(actual,coins,exp,wins,label){assert.equal(actual.coins,coins,`${label}: coins`);assert.equal(actual.exp,exp,`${label}: exp`);assert.equal(actual.wins,wins,`${label}: wins`);}
function reward(authority,input){reward.clock+=1;return authority.applyOfflineBattleReward({battleCreatedAt:reward.clock,...input});}
reward.clock=1000;

// 1-5: first claim, duplicate, second battle, EXP/wins, reload.
{
  const storage=new FakeStorage();seedStorage(storage,baseSave());let authority=boot(storage);
  const a=reward(authority,{authorityMode:'offline',snapshot:baseSave(),battleId:'battle-A',rewardId:'reward-A',coins:120,exp:7,wins:1});
  assert.equal(a.ok,true);assert.equal(a.duplicate,false);assert.deepEqual(a.granted,{coins:120,exp:7,wins:1});assertBalances(a.snapshot,620,17,3,'first claim');
  const storedReceipt=authority.readBattleRewardReceipt('battle-A');assert.equal(storedReceipt?.duplicate,true);assert.deepEqual(storedReceipt?.granted,{coins:120,exp:7,wins:1});
  const dup=reward(authority,{authorityMode:'offline',snapshot:a.snapshot,battleId:'battle-A',rewardId:'reward-A',coins:120,exp:7,wins:1});
  assert.equal(dup.ok,true);assert.equal(dup.duplicate,true);assert.deepEqual(dup.granted,{coins:120,exp:7,wins:1});assert.deepEqual(dup.balances,{coins:620,exp:17,wins:3});assertBalances(dup.snapshot,620,17,3,'duplicate');
  const b=reward(authority,{authorityMode:'offline',snapshot:dup.snapshot,battleId:'battle-B',rewardId:'reward-B',coins:120,exp:3,wins:2});
  assert.equal(b.ok,true);assert.equal(b.duplicate,false);assertBalances(b.snapshot,740,20,5,'second battle');
  authority=boot(storage);const reloadDup=reward(authority,{authorityMode:'offline',snapshot:persisted(storage),battleId:'battle-A',rewardId:'reward-A',coins:120,exp:7,wins:1});
  assert.equal(reloadDup.duplicate,true);assertBalances(reloadDup.snapshot,740,20,5,'reload duplicate must preserve current snapshot');
}

// 6: failed primary write rolls back and leaves no pending claim that can resurrect reward.
{
  const storage=new FakeStorage();seedStorage(storage,baseSave());const authority=boot(storage);let failed=false;
  storage.failRule=(key,value)=>{if(!failed&&key===STORAGE_KEY){try{if(JSON.parse(value).coins===620){failed=true;return true;}}catch{}}return false;};
  const result=reward(authority,{authorityMode:'offline',snapshot:baseSave(),battleId:'battle-fail',coins:120,exp:5,wins:1});
  assert.equal(result.ok,false);storage.failRule=null;assertBalances(persisted(storage),500,10,2,'failed write rollback');
  const reloaded=boot(storage);const retry=reward(reloaded,{authorityMode:'offline',snapshot:persisted(storage),battleId:'battle-fail',coins:120,exp:5,wins:1});
  assert.equal(retry.ok,true);assert.equal(retry.duplicate,false);assertBalances(retry.snapshot,620,15,3,'retry after failed write');
}

// 7: crash window after player save but before journal committed; reload reconciles without double reward.
{
  const storage=new FakeStorage();seedStorage(storage,baseSave());const authority=boot(storage);const journalKey=`${STORAGE_KEY}_combat_reward_journal_v1`;
  storage.failRule=(key,value)=>key===journalKey&&value.includes('"state":"committed"');
  const first=reward(authority,{authorityMode:'offline',snapshot:baseSave(),battleId:'battle-crash',rewardId:'reward-crash',coins:120,exp:4,wins:1});
  assert.equal(first.ok,true);assertBalances(persisted(storage),620,14,3,'crash-window player save');assert.ok(storage.getItem(`${STORAGE_KEY}_combat_reward_tx_v1`),'transaction marker must survive simulated crash');
  assert.equal(persisted(storage).saveMeta.lastBattleRewardTx.battleId,'battle-crash');
  storage.failRule=null;const reloaded=boot(storage);const loaded=reloaded.loadSnapshot();assertBalances(loaded.snapshot,620,14,3,'reconciled snapshot');assert.equal(storage.getItem(`${STORAGE_KEY}_combat_reward_tx_v1`),null,'transaction marker should clear after reconciliation');
  const duplicate=reward(reloaded,{authorityMode:'offline',snapshot:loaded.snapshot,battleId:'battle-crash',rewardId:'reward-crash',coins:120,exp:4,wins:1});
  assert.equal(duplicate.duplicate,true);assertBalances(duplicate.snapshot,620,14,3,'crash duplicate prevention');
}

// Spending after an applied reward cannot erase its transaction identity.
{
  const storage=new FakeStorage();seedStorage(storage,baseSave());let authority=boot(storage);
  const journalKey=`${STORAGE_KEY}_combat_reward_journal_v1`,txKey=`${STORAGE_KEY}_combat_reward_tx_v1`;
  storage.failRule=(key,value)=>key===journalKey&&value.includes('"state":"committed"');
  const a=reward(authority,{authorityMode:'offline',snapshot:baseSave(),battleId:'battle-spend-A',coins:120,exp:0,wins:0});
  assert.equal(a.ok,true);assertBalances(persisted(storage),620,10,2,'reward before spend');
  const marker=persisted(storage).saveMeta.lastBattleRewardTx;
  assert.equal(marker.battleId,'battle-spend-A');assert.ok(marker.transactionId);
  const spent=persisted(storage);spent.coins=420;spent.saveMeta={...spent.saveMeta,lastSavedAt:marker.appliedAt+1,lastReason:'coin-spend'};
  assert.equal(authority.atomicCommit(spent).ok,true);assertBalances(persisted(storage),420,10,2,'spend after reward');
  authority=boot(storage);const loaded=authority.loadSnapshot();assertBalances(loaded.snapshot,420,10,2,'reload after spend');
  assert.equal(loaded.snapshot.saveMeta.lastBattleRewardTx.transactionId,marker.transactionId);
  assert.ok(storage.getItem(txKey),'unresolved technical transaction must survive journal failure');
  const receipt=authority.readBattleRewardReceipt('battle-spend-A');assert.equal(receipt?.duplicate,true);assertBalances(receipt.snapshot,420,10,2,'reconstructed receipt');
  const duplicate=reward(authority,{authorityMode:'offline',snapshot:loaded.snapshot,battleId:'battle-spend-A',coins:120});
  assert.equal(duplicate.ok,true);assert.equal(duplicate.duplicate,true);assertBalances(duplicate.snapshot,420,10,2,'duplicate after spend');
  const blocked=reward(authority,{authorityMode:'offline',snapshot:loaded.snapshot,battleId:'battle-spend-B',coins:25});
  assert.equal(blocked.ok,false);assert.equal(blocked.reason,'battle-reward-recovery-pending');assertBalances(persisted(storage),420,10,2,'different battle blocked');
  assert.equal(persisted(storage).saveMeta.lastBattleRewardTx.transactionId,marker.transactionId,'unresolved marker must not be overwritten');
  storage.failRule=null;authority=boot(storage);const reconciled=authority.loadSnapshot();
  assert.equal(storage.getItem(txKey),null);assert.equal(authority.readBattleRewardReceipt('battle-spend-A')?.duplicate,true);
  const b=reward(authority,{authorityMode:'offline',snapshot:reconciled.snapshot,battleId:'battle-spend-B',coins:25});
  assert.equal(b.ok,true);assert.equal(b.duplicate,false);assertBalances(b.snapshot,445,10,2,'different battle after recovery');
  assert.equal(b.snapshot.saveMeta.lastBattleRewardTx.battleId,'battle-spend-B');
}

// Pre-marker prototype transactions remain ambiguous; arithmetic balances never authorize replay.
{
  const storage=new FakeStorage();seedStorage(storage,baseSave(620));const authority=boot(storage);
  storage.setItem(`${STORAGE_KEY}_combat_reward_tx_v1`,JSON.stringify({battleId:'legacy-A',transactionId:'legacy-tx',after:{coins:620},granted:{coins:120}}));
  const result=reward(authority,{authorityMode:'offline',snapshot:persisted(storage),battleId:'legacy-A',coins:120});
  assert.equal(result.ok,false);assert.equal(result.reason,'battle-reward-recovery-ambiguous');assertBalances(persisted(storage),620,10,2,'legacy ambiguity');
  assert.ok(storage.getItem(`${STORAGE_KEY}_combat_reward_tx_v1`));
  storage.setItem(`${STORAGE_KEY}_combat_reward_tx_v1`,'{broken');
  const corrupt=reward(authority,{authorityMode:'offline',snapshot:persisted(storage),battleId:'legacy-B',coins:1});
  assert.equal(corrupt.ok,false);assert.equal(corrupt.reason,'battle-reward-recovery-ambiguous');
  assert.equal(storage.getItem(`${STORAGE_KEY}_combat_reward_tx_v1`),'{broken');
}

// 8: all non-offline authority modes fail closed.
{
  const storage=new FakeStorage();seedStorage(storage,baseSave());const authority=boot(storage);
  for(const authorityMode of ['online','server','unknown',null,undefined]){const before=storage.getItem(STORAGE_KEY);const r=reward(authority,{authorityMode,snapshot:baseSave(),battleId:'guard-test',coins:120,exp:5,wins:1});assert.equal(r.ok,false);assert.equal(r.reason,'server-authority-required');assert.equal(storage.getItem(STORAGE_KEY),before);}
  assert.equal(reward(authority,{authorityMode:'offline',snapshot:baseSave(),battleId:'bad id!',coins:1}).reason,'invalid-battle-id');
}

// 9: Main memory freshness wins over older persisted state.
{
  const storage=new FakeStorage();seedStorage(storage,baseSave(500,10,2));const authority=boot(storage);const ram=baseSave(550,25,4);ram.saveMeta.lastSavedAt=200;
  const result=reward(authority,{authorityMode:'offline',snapshot:ram,battleId:'battle-freshness',coins:120,exp:5,wins:1});
  assertBalances(result.snapshot,670,30,5,'main freshness');assertBalances(persisted(storage),670,30,5,'persisted freshness');
}

// 10: journal bounded to 64 records.
{
  const storage=new FakeStorage();let snapshot=baseSave();seedStorage(storage,snapshot);const authority=boot(storage);
  for(let i=0;i<70;i++){const r=reward(authority,{authorityMode:'offline',snapshot,battleId:`battle-overflow-${i}`,coins:1,exp:0,wins:0});assert.equal(r.ok,true);snapshot=r.snapshot;}
  const journal=JSON.parse(storage.getItem(`${STORAGE_KEY}_combat_reward_journal_v1`));assert.equal(journal.records.length,64);assert.equal(journal.records[0].battleId,'battle-overflow-6');assert.equal(journal.records.at(-1).battleId,'battle-overflow-69');
}

// Final retention hardening: receipt eviction cannot resurrect an old reward.
{
  const storage=new FakeStorage();let snapshot=baseSave();seedStorage(storage,snapshot);const authority=boot(storage);
  const a=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:'battle-evict-A',rewardId:'reward-A',battleCreatedAt:1000,coins:100,exp:0,wins:0});
  assert.equal(a.ok,true);assertBalances(a.snapshot,600,10,2,'eviction A');snapshot=a.snapshot;
  for(let i=1;i<=70;i++){const r=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:`battle-evict-${i}`,battleCreatedAt:1000+i,coins:1,exp:0,wins:0});assert.equal(r.ok,true);snapshot=r.snapshot;}
  const journal=JSON.parse(storage.getItem(`${STORAGE_KEY}_combat_reward_journal_v1`));assert.ok(journal.records.length<=64);assert.equal(journal.records.some(x=>x.battleId==='battle-evict-A'),false,'A receipt must be evicted');
  assertBalances(snapshot,670,10,2,'after 70 newer battles');const replay=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:'battle-evict-A',battleCreatedAt:1000,coins:100});
  assert.equal(replay.ok,true);assert.equal(replay.duplicate,true);assert.equal(replay.stale,true);assert.equal(replay.reason,'battle-reward-stale-settled');assert.equal(replay.granted.coins,0);assert.equal(replay.granted.exp,0);assert.equal(replay.granted.wins,0);assertBalances(replay.snapshot,670,10,2,'evicted A replay');assertBalances(persisted(storage),670,10,2,'evicted A persisted');
}

// Boundary ordering: older is stale, newer settles.
{
  const storage=new FakeStorage();let snapshot=baseSave();seedStorage(storage,snapshot);const authority=boot(storage);
  const b=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:'boundary-B',battleCreatedAt:200,coins:20});assert.equal(b.ok,true);snapshot=b.snapshot;
  const a=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:'boundary-A',battleCreatedAt:100,coins:100});assert.equal(a.ok,true);assert.equal(a.stale,true);assertBalances(a.snapshot,520,10,2,'older A stale');
  const c=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:'boundary-C',battleCreatedAt:300,coins:30});assert.equal(c.ok,true);assert.equal(c.duplicate,false);assertBalances(c.snapshot,550,10,2,'newer C settles');
}

// Equal boundary timestamp with same id is stale duplicate even without an exact journal receipt.
{
  const storage=new FakeStorage();const snapshot=baseSave();snapshot.saveMeta.battleRewardBoundary={version:1,battleCreatedAt:500,battleId:'boundary-X',settledAt:600};seedStorage(storage,snapshot);const authority=boot(storage);
  const same=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:'boundary-X',battleCreatedAt:500,coins:100});assert.equal(same.ok,true);assert.equal(same.duplicate,true);assert.equal(same.stale,true);assertBalances(same.snapshot,500,10,2,'equal same id');
}

// Equal boundary timestamp with a different id fails closed.
{
  const storage=new FakeStorage();const snapshot=baseSave();snapshot.saveMeta.battleRewardBoundary={version:1,battleCreatedAt:500,battleId:'boundary-X',settledAt:600};seedStorage(storage,snapshot);const authority=boot(storage);
  const collision=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:'boundary-Y',battleCreatedAt:500,coins:100});assert.equal(collision.ok,false);assert.equal(collision.reason,'battle-reward-boundary-collision');assertBalances(persisted(storage),500,10,2,'boundary collision');
}

// Brand-new reward claims without a canonical BattleRequest.createdAt fail closed.
{
  const storage=new FakeStorage();const snapshot=baseSave();seedStorage(storage,snapshot);const authority=boot(storage);
  for(const battleCreatedAt of [undefined,NaN,0]){const r=authority.applyOfflineBattleReward({authorityMode:'offline',snapshot,battleId:`missing-created-at-${String(battleCreatedAt)}`,battleCreatedAt,coins:100});assert.equal(r.ok,false);assert.equal(r.reason,'invalid-battle-created-at');assertBalances(persisted(storage),500,10,2,'missing createdAt');}
}

// 11-14: source-level integration guards (when run from repository root).
const appPath=path.join(root,'js/app.js'),entryPath=path.join(root,'js/combat-entry-v177.js'),loaderPath=path.join(root,'js/boot-loader-v21004.js'),indexPath=path.join(root,'index.html');
for(const file of [appPath,entryPath,loaderPath,indexPath])assert.ok(fs.existsSync(file),`integration source missing: ${path.relative(root,file)}`);
const app=fs.readFileSync(appPath,'utf8'),entry=fs.readFileSync(entryPath,'utf8'),loader=fs.readFileSync(loaderPath,'utf8'),index=fs.readFileSync(indexPath,'utf8');
assert.ok(app.includes('POWDER_PLAYER_STATE_AUTHORITY_V1'),'Main must delegate to shared player-state authority');
const grantStart=app.indexOf('grantBattleRewards:');assert.ok(grantStart>=0,'grantBattleRewards export missing');const grantEnd=app.indexOf(',claimJourneyMilestone',grantStart);assert.ok(grantEnd>grantStart,'grantBattleRewards boundary missing');const grantBody=app.slice(grantStart,grantEnd);
assert.ok(grantBody.includes('applyOfflineBattleReward'),'grantBattleRewards must call authority.applyOfflineBattleReward');
assert.ok(grantBody.includes('snapshot:P'),'grantBattleRewards must pass current P');
assert.ok(grantBody.includes('P=result.snapshot'),'Main must sync P from authority result');
assert.ok(!/P\.(?:coins|exp|wins)\s*(?:\+\+|--|[+\-*/]?=)/.test(grantBody),'direct battle reward mutation remains in Main');
assert.ok(app.includes('atomicCommit')&&app.includes('loadSnapshot'),'Main storage wrappers must delegate shared authority');
assert.ok(entry.includes('battleId:{value:result.value.battleId'),'current PVE settlement caller must plumb battleId');
assert.ok(entry.includes("rewardId:{value:String(reward.rewardId||'')"),'current PVE settlement caller must plumb rewardId');
assert.ok(entry.includes('enumerable:false'),'battle identity plumbing must preserve the legacy enumerable reward payload shape');
assert.ok(entry.includes('battleCreatedAt:{value:request.value.createdAt'),'current PVE settlement caller must plumb BattleRequest.createdAt');
assert.ok(grantBody.includes('battleCreatedAt=0'),'Main grantBattleRewards must accept battleCreatedAt');
assert.ok(grantBody.includes('battleCreatedAt,coins,exp,wins'),'Main must pass battleCreatedAt into the shared authority');
assert.ok(authoritySource.includes('battleRewardBoundary'),'authority must persist the battle reward high-watermark');
assert.ok(authoritySource.includes('JOURNAL_LIMIT=64'),'recent exact receipt journal must remain bounded at 64');
assert.equal(authoritySource.includes('result.finishedAt'),false,'boundary must not use BattleResult.finishedAt');
assert.equal(/now.coinss*>=|now.exps*>=|now.winss*>=/.test(authoritySource),false,'balance arithmetic must not return as transaction identity');
const authorityIndex=index.indexOf('js/player-state-authority-v1.js'),bootIndex=index.indexOf('js/boot-loader-v21004.js'),appIndex=loader.indexOf('js/app.js');assert.ok(authorityIndex>=0&&bootIndex>=0&&authorityIndex<bootIndex&&appIndex>=0,'authority must load before the boot loader can execute app.js');
assert.equal(app.includes("P.coins=Math.max(0,P.coins+coins);P.exp=Math.max(0,P.exp+Math.floor(Number(exp)||0));P.wins=Math.max(0,P.wins+Math.floor(Number(wins)||0));"),false,'legacy generic battle writer remains');

console.log('PASS verify-player-state-authority-v1');
