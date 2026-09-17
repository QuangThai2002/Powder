import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
const rulesSource=fs.readFileSync(path.join(root,'js/adventure-rules-v1.js'),'utf8');
const authoritySource=fs.readFileSync(path.join(root,'js/adventure-progression-authority-v1.js'),'utf8');
for(const source of [rulesSource,authoritySource])assert.equal(/\bdocument\b|querySelector|\bPhaser\b/.test(source),false,'Adventure authority must be DOM independent');
const KEY='powder.verify.adventure';
class Storage{
  constructor(){this.map=new Map();this.failRule=null}
  getItem(key){return this.map.get(key)??null}
  setItem(key,value){const text=String(value);if(this.failRule?.(key,text))throw Error('forced-journal-failure');this.map.set(key,text)}
  removeItem(key){this.map.delete(key)}
}
function state(){return{coins:500,saveMeta:{schema:15,lastSavedAt:100},adventure:{currentIsland:1,currentStage:1,islandsUnlocked:1,stageStars:{},stageWins:{},stagePrep:{},totalStars:0}}}
function boot(storage,initial=state()){
  if(!storage.getItem(KEY))storage.setItem(KEY,JSON.stringify(initial));
  const window={POWDER_CONFIG:{storageKey:KEY},localStorage:storage};
  const context=vm.createContext({window,globalThis:window,console,JSON,Map,Set,Date,Number,String,Array,Object,Math,RegExp,Error});
  for(const file of ['js/adventure-data.js','js/player-state-authority-v1.js','js/adventure-rules-v1.js','js/adventure-progression-authority-v1.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  const player=window.POWDER_PLAYER_STATE_AUTHORITY_V1,atomic=player.atomicCommit;let commits=0;
  player.atomicCommit=(...args)=>{commits++;return atomic(...args)};
  return{api:window.POWDER_ADVENTURE_PROGRESSION_AUTHORITY_V1,rules:window.POWDER_ADVENTURE_RULES_V1,data:window.POWDER_ADVENTURE_DATA,player,storage,commits:()=>commits}
}
function persisted(storage){return JSON.parse(storage.getItem(KEY))}
function summary(correct=0,total=1,roundCount=12,survivors=['hero-1'],deployed=['hero-1']){const ids=['hero-1','hero-2','hero-3'];return{roundCount,players:ids.map(id=>({powId:id,deployed:deployed.includes(id),survived:survivors.includes(id),knowledgeActions:id==='hero-1'?total:0,knowledgeSum:id==='hero-1'?correct:0}))}}
function apply(env,battleId,at,stageId='1-1',mastery=100,combat=summary(),extra={}){const playerTeam=stageId==='1-1'?['hero-1']:['hero-1','hero-2','hero-3'];return env.api.applyOfflineAdventureVictory({authorityMode:'offline',snapshot:persisted(env.storage),battleId,battleCreatedAt:at,stageId,gateMastery:mastery,playerTeam,battleSummary:combat,learningSummary:{players:[{knowledgeActions:1,knowledgeSum:0}]},result:'victory',...extra})}
function unchanged(storage,before){assert.equal(storage.getItem(KEY),before)}
function unlockedState(stage,env){const next=state();next.adventure.islandsUnlocked=stage.islandId;next.adventure.currentIsland=stage.islandId;next.adventure.currentStage=stage.number;
  if(stage.number>1)next.adventure.stageWins[`${stage.islandId}-${stage.number-1}`]=true;return next}

{
  const env=boot(new Storage()),rules=env.rules,progress=state().adventure;
  assert.equal(rules.islandUnlocked(1,progress),true);assert.equal(rules.islandUnlocked(2,progress),false);
  assert.equal(rules.stageUnlocked('1-1',progress),true);assert.equal(rules.stageUnlocked('1-2',progress),false);
  assert.equal(rules.isFreeCombatOnboarding('1-1'),true);assert.equal(rules.isFreeCombatOnboarding('1-2'),false);
  assert.equal(rules.nextStage('1-1').id,'1-2');assert.equal(rules.areaCompleted('1-1'),false);
  const a=apply(env,'opening-A',1000,'1-1',100,summary(1,1,9,['hero-1'],['hero-1']));
  assert.equal(a.ok,true);assert.equal(a.duplicate,false);assert.equal(env.commits(),1);
  assert.equal(a.snapshot.adventure.stageWins['1-1'],true);assert.equal(a.snapshot.adventure.stageStars['1-1'],3);
  assert.equal(a.snapshot.adventure.currentIsland,1);assert.equal(a.snapshot.adventure.currentStage,2);
  assert.equal(a.nextStageId,'1-2');assert.equal(a.nextStageProgressionUnlocked,true);assert.equal(rules.stageUnlocked('1-2',a.snapshot.adventure),true);
  assert.equal(a.snapshot.adventure.totalStars,3);assert.equal(a.snapshot.coins,500);
  const before=env.storage.getItem(KEY),dup=apply(env,'opening-A',1000);assert.equal(dup.duplicate,true);unchanged(env.storage,before);assert.equal(env.commits(),1);
  const reload=boot(env.storage),again=apply(reload,'opening-A',1000);assert.equal(again.duplicate,true);assert.equal(reload.commits(),0);
  const replay=apply(env,'opening-B',1001,'1-1',0,summary(0,1,12,[],['hero-1']));assert.equal(replay.ok,true);assert.equal(replay.duplicate,false);
  assert.equal(replay.starsAwarded,1);assert.equal(replay.stageStars,3,'best stars must never decrease');
}
{
  const env=boot(new Storage());const one=apply(env,'one-star',1000,'1-1',0,summary(0,1,12,[],['hero-1']));assert.equal(one.starsAwarded,1);
  const two=apply(env,'two-star',1001,'1-1',90,summary(0,1,9,[],['hero-1']));assert.equal(two.starsAwarded,2);
  const three=apply(env,'three-star',1002,'1-1',0,summary(0,1,9,['hero-1'],['hero-1']));assert.equal(three.starsAwarded,3);
  assert.equal(three.snapshot.adventure.stageStars['1-1'],3);
}
{
  const seed=state();seed.adventure.stageWins['1-1']=true;const env=boot(new Storage(),seed),mid=apply(env,'middle-A',1000,'1-2',100);
  assert.equal(mid.ok,true);assert.equal(mid.nextStageId,'1-3');assert.equal(mid.snapshot.adventure.stageWins['1-2'],true);
  const invalid=apply(env,'locked-A',1001,'2-2',100);assert.equal(invalid.reason,'adventure-stage-locked');
}
{
  const probe=boot(new Storage()),last=probe.data.islandById(1).stages.at(-1),next=probe.rules.nextStage(last);
  const env=boot(new Storage(),unlockedState(last,probe));const a=apply(env,'island-final',1000,last.id,100);
  assert.equal(a.ok,true);assert.equal(a.nextStageId,next.id);assert.equal(a.snapshot.adventure.islandsUnlocked,2);
  assert.equal(a.snapshot.adventure.currentIsland,2);assert.equal(a.snapshot.adventure.currentStage,1);assert.equal(a.nextStageProgressionUnlocked,true);
}
{
  const probe=boot(new Storage()),last=probe.data.islands.at(-1).stages.at(-1),env=boot(new Storage(),unlockedState(last,probe));
  const a=apply(env,'game-final',1000,last.id,100);assert.equal(a.ok,true);assert.equal(a.nextStageId,null);assert.equal(a.areaCompleted,true);
  assert.equal(a.snapshot.adventure.currentIsland,last.islandId);assert.equal(a.snapshot.adventure.currentStage,last.number);
}
{
  const storage=new Storage(),env=boot(storage),journal=`${KEY}_adventure_progression_journal_v1`,tx=`${KEY}_adventure_progression_tx_v1`;
  storage.failRule=(key,value)=>key===journal&&value.includes('"state":"committed"');
  const a=apply(env,'crash-A',1000);assert.equal(a.ok,true);assert.equal(persisted(storage).adventure.stageWins['1-1'],true);
  const marker=persisted(storage).saveMeta.lastAdventureProgressionTx;assert.equal(marker.battleId,'crash-A');assert.ok(storage.getItem(tx));
  const later=persisted(storage);later.coins=420;later.saveMeta={...later.saveMeta,lastSavedAt:marker.appliedAt+1,lastReason:'later-save'};assert.equal(env.player.atomicCommit(later).ok,true);
  const reload=boot(storage),dup=apply(reload,'crash-A',1000);assert.equal(dup.duplicate,true);assert.equal(dup.snapshot.coins,420);
  const before=storage.getItem(KEY),blocked=apply(reload,'crash-B',1001);assert.equal(blocked.reason,'adventure-progression-recovery-pending');unchanged(storage,before);
  storage.failRule=null;const ready=boot(storage);assert.equal(ready.player.loadSnapshot().ok,true);assert.ok(storage.getItem(tx));
  const b=apply(ready,'crash-B',1001);assert.equal(b.ok,true);assert.equal(b.duplicate,false);assert.equal(storage.getItem(tx),null);
}
{
  const env=boot(new Storage());apply(env,'old-A',1000);
  for(let i=1;i<=70;i++)assert.equal(apply(env,`new-${i}`,1000+i).ok,true);
  const records=JSON.parse(env.storage.getItem(`${KEY}_adventure_progression_journal_v1`)).records;
  assert.equal(records.length,64);assert.equal(records.some(row=>row.battleId==='old-A'),false);
  const before=env.storage.getItem(KEY),stale=apply(env,'old-A',1000);assert.equal(stale.duplicate,true);assert.equal(stale.stale,true);unchanged(env.storage,before);
}
{
  const env=boot(new Storage());assert.equal(apply(env,'B',200).ok,true);const before=env.storage.getItem(KEY);
  assert.equal(apply(env,'A',100).stale,true);unchanged(env.storage,before);
  assert.equal(apply(env,'B',200).duplicate,true);unchanged(env.storage,before);
  assert.equal(apply(env,'collision',200).reason,'adventure-progression-boundary-collision');unchanged(env.storage,before);
  assert.equal(apply(env,'C',300).ok,true);
}
{
  const env=boot(new Storage()),before=env.storage.getItem(KEY);
  for(const at of [undefined,NaN,0]){assert.equal(apply(env,'bad-time',at).reason,'invalid-battle-created-at');unchanged(env.storage,before)}
  assert.equal(apply(env,'bad-stage',1000,'not-a-stage').reason,'invalid-adventure-stage');unchanged(env.storage,before);
  assert.equal(apply(env,'defeat',1000,'1-1',100,summary(),{result:'defeat'}).reason,'victory-only-progression');unchanged(env.storage,before);
  for(const mode of ['online','server','unknown',null]){assert.equal(apply(env,'online',1000,'1-1',100,summary(),{authorityMode:mode}).reason,'server-authority-required');unchanged(env.storage,before)}
}
{
  const env=boot(new Storage()),ram=state();ram.coins=550;
  const a=apply(env,'ram-A',1000,'1-1',100,summary(),{snapshot:ram});assert.equal(a.ok,true);assert.equal(a.snapshot.coins,550);
  assert.equal(persisted(env.storage).coins,550);
  const unsaved=JSON.parse(JSON.stringify(a.snapshot));unsaved.coins=600;
  const duplicate=apply(env,'ram-A',1000,'1-1',100,summary(),{snapshot:unsaved});assert.equal(duplicate.snapshot.coins,600);
  assert.equal(persisted(env.storage).coins,550);
}
{
  const env=boot(new Storage());env.storage.setItem(`${KEY}_adventure_progression_tx_v1`,'{broken');
  const before=env.storage.getItem(KEY);assert.equal(apply(env,'ambiguous',1000).reason,'adventure-progression-recovery-ambiguous');unchanged(env.storage,before);
}
const map=fs.readFileSync(path.join(root,'js/adventure-map.js'),'utf8'),entry=fs.readFileSync(path.join(root,'js/combat-entry-v177.js'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),index=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(map.includes('return RULES.stageUnlocked(stage,p)'));assert.ok(map.includes('return RULES.nextStage(stage)'));
assert.equal(/function onBattleFinished\([^\n]+saveProgress\(\{stageStars/.test(map),false,'Combat victory writer remains in map');
assert.ok(map.includes('app()?.applyAdventureBattleOutcome?.('));assert.ok(entry.includes('applyAdventureBattleOutcome?.({battleId:result.value.battleId'));
assert.ok(app.includes('applyAdventureBattleOutcome:(payload={})=>'));
assert.ok(index.indexOf('js/player-state-authority-v1.js')<index.indexOf('js/adventure-rules-v1.js'));
assert.ok(index.indexOf('js/adventure-rules-v1.js')<index.indexOf('js/adventure-progression-authority-v1.js'));
assert.ok(index.indexOf('js/adventure-progression-authority-v1.js')<index.indexOf('js/boot-loader-v21004.js'));
console.log('PASS verify-adventure-progression-authority-v1');
