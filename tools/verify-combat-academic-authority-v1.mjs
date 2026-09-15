import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
const source=fs.readFileSync(path.join(root,'js/combat-academic-authority-v1.js'),'utf8');
assert.equal(/\bdocument\b|querySelector|\bPhaser\b/.test(source),false);
const KEY='powder.verify.academic';
class Storage{
  constructor(){this.map=new Map();this.failRule=null}
  getItem(key){return this.map.get(key)??null}
  setItem(key,value){const text=String(value);if(this.failRule?.(key,text))throw Error('forced-journal-failure');this.map.set(key,text)}
  removeItem(key){this.map.delete(key)}
}
function question(id){return{id,lessonId:'lesson-a',language:'ZH',type:'choice',prompt:`Prompt ${id}`,answer:'A',options:['A','B']}}
const questions=[question('q-1'),question('q-2'),question('q-3')];
function save(){return{saveVersion:15,coins:500,rank:0,owned:{'hero-1':{stars:1,level:1,powExp:0},'hero-2':{stars:1,level:1,powExp:0}},team:['hero-1','hero-2'],activePowId:'hero-1',battleMistakes:[],saveMeta:{schema:15,lastSavedAt:100}}}
function boot(storage,initial=save()){
  if(!storage.getItem(KEY))storage.setItem(KEY,JSON.stringify(initial));
  const data={pows:[{id:'hero-1'},{id:'hero-2'}],lessons:[{id:'lesson-a',language:'ZH',rank:0,difficulty:'standard',questions,vocabulary:[]}],questions:questions.map(q=>({...q}))};
  const window={POWDER_CONFIG:{storageKey:KEY},POWDER_DATA:data,localStorage:storage};
  const ctx=vm.createContext({window,globalThis:window,console,JSON,Map,Set,Date,Number,String,Array,Object,Math,RegExp,Error});
  for(const file of ['js/pow-growth-v143.js','js/game-engine.js','js/learning-master-v2.js','js/player-state-authority-v1.js','js/combat-academic-authority-v1.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  let commits=0;const player=window.POWDER_PLAYER_STATE_AUTHORITY_V1,atomic=player.atomicCommit;player.atomicCommit=(...args)=>{commits++;return atomic(...args)};
  return{api:window.POWDER_COMBAT_ACADEMIC_AUTHORITY_V1,player,storage,commits:()=>commits}
}
function persisted(storage){return JSON.parse(storage.getItem(KEY))}
function response(id,correct,powId='hero-1'){return{question:{id},correct,powId}}
function apply(env,id,at,responses,extra={}){return env.api.applyOfflineCombatAcademicOutcome({authorityMode:'offline',snapshot:persisted(env.storage),battleId:id,battleCreatedAt:at,responses,allowedQuestionPool:questions,...extra})}
function unchanged(storage,before){assert.equal(storage.getItem(KEY),before)}

// Actual Engine, Learning Master and Growth modules run in this harness.
{
  const env=boot(new Storage());const a=apply(env,'correct-A',1000,[response('q-1',true)]);
  assert.equal(a.ok,true);assert.equal(a.duplicate,false);assert.equal(env.commits(),1);
  assert.equal(a.applied.correct,1);assert.equal(a.snapshot.questionProgress['q-1'].seen,1);
  assert.equal(a.snapshot.learning.conceptMastery['lesson-a:vocabulary'],85);
  assert.equal(a.snapshot.owned['hero-1'].powExp,12);assert.equal(a.snapshot.owned['hero-2'].powExp,4);
  assert.equal(a.powGrowth.totalExp,16);assert.equal(a.snapshot.powCandy,0);
  const before=env.storage.getItem(KEY),dup=apply(env,'correct-A',1000,[response('q-1',true)]);
  assert.equal(dup.duplicate,true);unchanged(env.storage,before);assert.equal(env.commits(),1);
  const reload=boot(env.storage),again=apply(reload,'correct-A',1000,[response('q-1',true)]);
  assert.equal(again.duplicate,true);assert.equal(reload.commits(),0);assert.equal(again.snapshot.owned['hero-1'].powExp,12);
}
{
  const env=boot(new Storage()),wrong=apply(env,'wrong-A',1000,[response('q-2',false)]);
  assert.equal(wrong.ok,true);assert.equal(wrong.applied.wrong,1);assert.equal(wrong.snapshot.questionProgress['q-2'].wrong,1);
  assert.deepEqual(Array.from(wrong.snapshot.battleMistakes),['q-2']);assert.equal(wrong.snapshot.owned['hero-1'].powExp,0);assert.equal(wrong.powGrowth.totalExp,0);
}
{
  const env=boot(new Storage()),mixed=apply(env,'mixed-A',1000,[response('q-1',true),response('q-2',false),response('q-3',true)]);
  assert.equal(mixed.ok,true);assert.equal(env.commits(),1);assert.deepEqual(JSON.parse(JSON.stringify(mixed.applied)),{responses:3,correct:2,wrong:1});
  assert.equal(mixed.snapshot.owned['hero-1'].powExp,24);assert.equal(mixed.snapshot.owned['hero-2'].powExp,8);
  assert.deepEqual(Array.from(mixed.snapshot.battleMistakes),['q-2']);
}
for(const [label,powId,active,expected] of [['response','hero-2','hero-1','hero-2'],['active','missing','hero-1','hero-1'],['team','missing','missing','hero-1']]){
  const storage=new Storage(),state=save();state.activePowId=active;const env=boot(storage,state),r=apply(env,`${label}-A`,1000,[response('q-1',true,powId)]);
  assert.equal(r.ok,true);assert.equal(r.snapshot.owned[expected].powExp,12);assert.equal(r.snapshot.owned[expected==='hero-1'?'hero-2':'hero-1'].powExp,4);
}
{
  const state=save();state.owned={};const r=apply(boot(new Storage(),state),'no-primary-A',1000,[response('q-1',true)]);
  assert.equal(r.ok,true);assert.equal(r.snapshot.questionProgress['q-1'].seen,1);assert.equal(r.powGrowth.totalExp,0);
}
{
  const state=save();state.owned['hero-1'].powExp=49;const r=apply(boot(new Storage(),state),'level-A',1000,[response('q-1',true)]);
  assert.equal(r.snapshot.owned['hero-1'].level,2);assert.equal(r.snapshot.owned['hero-1'].powExp,11);
  const capped=save();capped.owned['hero-1']={stars:0,level:10,powExp:0};const c=apply(boot(new Storage(),capped),'cap-A',1000,[response('q-1',true)]);
  assert.equal(c.snapshot.owned['hero-1'].level,10);assert.equal(c.snapshot.owned['hero-1'].powExp,0);
}
{
  const storage=new Storage(),env=boot(storage),j=`${KEY}_combat_academic_journal_v1`,t=`${KEY}_combat_academic_tx_v1`;
  storage.failRule=(key,value)=>key===j&&value.includes('"state":"committed"');
  const a=apply(env,'crash-A',1000,[response('q-1',true)]);assert.equal(a.ok,true);assert.equal(a.snapshot.owned['hero-1'].powExp,12);
  assert.ok(storage.getItem(t));const marker=persisted(storage).saveMeta.lastCombatAcademicTx;
  const spent=persisted(storage);spent.coins=420;spent.saveMeta={...spent.saveMeta,lastSavedAt:marker.appliedAt+1,lastReason:'other-save'};
  assert.equal(env.player.atomicCommit(spent).ok,true);
  const reload=boot(storage),dup=apply(reload,'crash-A',1000,[response('q-1',true)]);
  assert.equal(dup.ok,true);assert.equal(dup.duplicate,true);assert.equal(dup.snapshot.coins,420);assert.equal(dup.snapshot.owned['hero-1'].powExp,12);
  assert.equal(reload.api.readCombatAcademicReceipt('crash-A')?.duplicate,true);
  const before=storage.getItem(KEY),blocked=apply(reload,'crash-B',1001,[response('q-2',true)]);
  assert.equal(blocked.reason,'combat-academic-recovery-pending');unchanged(storage,before);
  storage.failRule=null;const recovered=boot(storage);assert.equal(recovered.api.readCombatAcademicReceipt('crash-A')?.duplicate,true);assert.equal(storage.getItem(t),null);
  const b=apply(recovered,'crash-B',1001,[response('q-2',true)]);assert.equal(b.ok,true);assert.equal(b.duplicate,false);assert.equal(b.snapshot.coins,420);
}
{
  const storage=new Storage(),env=boot(storage);apply(env,'old-A',1000,[response('q-1',true)]);
  for(let i=1;i<=70;i++)assert.equal(apply(env,`new-${i}`,1000+i,[response('q-1',true)]).ok,true);
  const records=JSON.parse(storage.getItem(`${KEY}_combat_academic_journal_v1`)).records;assert.equal(records.length,64);assert.equal(records.some(row=>row.battleId==='old-A'),false);
  const before=storage.getItem(KEY),stale=apply(env,'old-A',1000,[response('q-1',true)]);
  assert.equal(stale.duplicate,true);assert.equal(stale.stale,true);unchanged(storage,before);
}
{
  const env=boot(new Storage());assert.equal(apply(env,'B',200,[response('q-1',true)]).ok,true);
  const before=env.storage.getItem(KEY);assert.equal(apply(env,'A',100,[response('q-2',true)]).stale,true);unchanged(env.storage,before);
  assert.equal(apply(env,'collision',200,[response('q-2',true)]).reason,'combat-academic-boundary-collision');unchanged(env.storage,before);
  assert.equal(apply(env,'C',300,[response('q-3',true)]).ok,true);
}
{
  const env=boot(new Storage()),before=env.storage.getItem(KEY);
  for(const at of [undefined,NaN,0]){assert.equal(apply(env,'invalid-time',at,[response('q-1',true)]).reason,'invalid-battle-created-at');unchanged(env.storage,before)}
  assert.equal(apply(env,'unseen',1000,[response('not-allowed',true)]).reason,'academic-question-not-allowed');unchanged(env.storage,before);
  assert.equal(apply(env,'duplicate-q',1000,[response('q-1',true),response('q-1',false)]).reason,'duplicate-academic-question');unchanged(env.storage,before);
  assert.equal(apply(env,'null-response',1000,[null]).ok,false);unchanged(env.storage,before);
  for(const mode of ['online','server','unknown',null]){assert.equal(apply(env,'online',1000,[response('q-1',true)],{authorityMode:mode}).reason,'server-authority-required');unchanged(env.storage,before)}
}
{
  const storage=new Storage();boot(storage);const ram=save();ram.coins=550;
  const env=boot(storage),r=apply(env,'ram-A',1000,[response('q-1',true)],{snapshot:ram});
  assert.equal(r.ok,true);assert.equal(r.snapshot.coins,550);assert.equal(persisted(storage).coins,550);
}
{
  const env=boot(new Storage()),a=apply(env,'fresh-dup-A',1000,[response('q-1',true)]);
  const ram=JSON.parse(JSON.stringify(a.snapshot));ram.coins=600;
  const duplicate=apply(env,'fresh-dup-A',1000,[response('q-1',true)],{snapshot:ram});
  assert.equal(duplicate.duplicate,true);assert.equal(duplicate.snapshot.coins,600);
  assert.equal(persisted(env.storage).coins,500,'duplicate must not commit a second save');
}
{
  const storage=new Storage(),env=boot(storage);storage.setItem(`${KEY}_combat_academic_tx_v1`,'{bad');
  const before=storage.getItem(KEY);assert.equal(apply(env,'ambiguous',1000,[response('q-1',true)]).reason,'combat-academic-recovery-ambiguous');unchanged(storage,before);
}
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),entry=fs.readFileSync(path.join(root,'js/combat-entry-v177.js'),'utf8'),index=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.equal(app.includes('E?.recordQuestionResult?.(P,question,!!correct)'),false,'old Combat writer remains');
assert.ok(app.includes('applyCombatAcademicOutcome:(payload={})=>'));assert.ok(app.includes('combat-academic-batch-required'));
assert.equal(/grantLearningProgress\?\.\(\{powId:response/.test(entry),false,'per-response Combat settlement remains');
assert.ok(entry.includes('allowedQuestionPool:allowed'));assert.ok(entry.includes('battleCreatedAt:request.createdAt'));
assert.ok(index.indexOf('js/player-state-authority-v1.js')<index.indexOf('js/combat-academic-authority-v1.js'));
assert.ok(index.indexOf('js/combat-academic-authority-v1.js')<index.indexOf('js/boot-loader-v21004.js'));
console.log('PASS verify-combat-academic-authority-v1');
