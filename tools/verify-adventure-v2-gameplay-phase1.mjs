import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const rulesSource=fs.readFileSync(path.join(root,'js/adventure-rules-v1.js'),'utf8');
const academicSource=fs.readFileSync(path.join(root,'js/combat-academic-authority-v1.js'),'utf8');
const progressionSource=fs.readFileSync(path.join(root,'js/adventure-progression-authority-v1.js'),'utf8');
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

function stage(id,number,{tutorial=false}={}){return{id,islandId:1,number,entryPolicy:{minimumTeamSize:tutorial?1:3},growthPolicy:{powExpEnabled:!tutorial},starPolicy:{speedRoundExclusive:10,survivorMinimum:tutorial?null:3,requireAllDeployedSurvive:tutorial}}}
const stages=[stage('1-1',1,{tutorial:true}),stage('1-2',2),stage('1-3',3)];
const island={id:1,stages};
function makeStorage(seed={}){const map=new Map(Object.entries(seed));return{map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null,get length(){return map.size}}}
function makeContext({initialSave,storage:sharedStorage}={}){
 const localStorage=sharedStorage||makeStorage();
 let snapshot=clone(initialSave||{rank:0,owned:{p1:{level:1,powExp:0},p2:{level:1,powExp:0},p3:{level:1,powExp:0},p4:{level:1,powExp:0}},team:['p1','p2','p3'],starterId:'p1',activePowId:'p1',battleMistakes:[],adventure:{islandsUnlocked:1,currentIsland:1,currentStage:1,stageWins:{},stageStars:{},stagePrep:{},totalStars:0},saveMeta:{}});
 const learningEvents=[];
 const context={console,Date,Math,JSON,Set,Map,Number,String,Array,Object,Boolean,RegExp,localStorage};context.globalThis=context;context.window=context;
 context.POWDER_CONFIG={storageKey:'powder-test'};
 context.POWDER_ADVENTURE_DATA={islands:[island],stageById:id=>stages.find(s=>s.id===String(id))||null,islandById:id=>Number(id)===1?island:null};
 context.POWDER_PLAYER_POW_ELIGIBILITY_V1={isPlayerEligible:id=>['p1','p2','p3','p4'].includes(String(id).toLowerCase())};
 context.POWDER_DATA={pows:['p1','p2','p3','p4'].map(id=>({id,maxStars:7}))};
 context.POWDER_ENGINE={recordQuestionResult:(save,q,correct)=>{save.questionProgress=save.questionProgress||{};save.questionProgress[q.id]={correct};learningEvents.push({kind:'engine',id:q.id,correct})}};
 context.POWDER_LEARNING_MASTER_V2={recordQuestionMastery:(save,q,correct)=>{save.learningRecords=(save.learningRecords||0)+1;learningEvents.push({kind:'mastery',id:q.id,correct})},normalizeSave:()=>{},averageMastery:save=>Number(save.learningRecords||0)};
 context.POWDER_GROWTH_V143={combatExp:()=>({primary:12,team:4}),addPowExperience:(_pow,owned,amount)=>{if(!owned)return{gained:0,levels:0,level:0};let gained=Math.max(0,Number(amount)||0),levels=0;owned.powExp=Number(owned.powExp||0)+gained;while(owned.powExp>=20){owned.powExp-=20;owned.level=Number(owned.level||1)+1;levels++}return{gained,levels,level:owned.level}}};
 context.POWDER_PLAYER_STATE_AUTHORITY_V1={loadSnapshot:()=>({ok:true,snapshot:clone(snapshot)}),atomicCommit:next=>{snapshot=clone(next);localStorage.setItem('powder-test',JSON.stringify(snapshot));return{ok:true,snapshot:clone(snapshot)}}};
 vm.createContext(context);vm.runInContext(rulesSource,context,{filename:'adventure-rules-v1.js'});vm.runInContext(academicSource,context,{filename:'combat-academic-authority-v1.js'});vm.runInContext(progressionSource,context,{filename:'adventure-progression-authority-v1.js'});
 return{context,localStorage,learningEvents,getSnapshot:()=>clone(snapshot),setSnapshot:v=>{snapshot=clone(v)}};
}
const q={id:'q1',lessonId:'l1',conceptId:'c1',prompt:'?',answer:'a',options:['a','b']};
let checks=0;const test=(name,fn)=>{fn();checks++;console.log(`PASS ${checks}. ${name}`)};

// Tutorial EXP + team policy
{
 const rt=makeContext(),R=rt.context.POWDER_ADVENTURE_RULES_V1;
 test('1-1 với một Starter vào trận được',()=>assert.equal(R.playerTeamEntry('1-1',{owned:{p1:{}},team:['p1'],starterId:'p1'},rt.context.POWDER_PLAYER_POW_ELIGIBILITY_V1).ready,true));
 const before=rt.getSnapshot();
 const one=rt.context.POWDER_COMBAT_ACADEMIC_AUTHORITY_V1.applyOfflineCombatAcademicOutcome({authorityMode:'offline',battleId:'academic-1',battleCreatedAt:1001,stageId:'1-1',snapshot:before,responses:[{powId:'p1',correct:true,question:q}],allowedQuestionPool:[q]});
 test('1-1 trả lời đúng không nhận Pow EXP',()=>{assert.equal(one.ok,true);assert.equal(one.powGrowth.totalExp,0);assert.equal(one.snapshot.owned.p1.powExp,0)});
 const two=rt.context.POWDER_COMBAT_ACADEMIC_AUTHORITY_V1.applyOfflineCombatAcademicOutcome({authorityMode:'offline',battleId:'academic-2',battleCreatedAt:1002,stageId:'1-1',snapshot:rt.getSnapshot(),responses:[{powId:'p1',correct:true,question:q}],allowedQuestionPool:[q]});
 test('1-1 thắng vẫn không có Pow EXP từ Combat Academic',()=>{assert.equal(two.ok,true);assert.equal(two.snapshot.owned.p1.powExp,0);assert.equal(two.snapshot.owned.p1.level,1)});
 for(let i=3;i<=7;i++)rt.context.POWDER_COMBAT_ACADEMIC_AUTHORITY_V1.applyOfflineCombatAcademicOutcome({authorityMode:'offline',battleId:`academic-${i}`,battleCreatedAt:1000+i,stageId:'1-1',snapshot:rt.getSnapshot(),responses:[{powId:'p1',correct:true,question:q}],allowedQuestionPool:[q]});
 test('1-1 replay nhiều lần vẫn không tăng Pow EXP/level',()=>{const s=rt.getSnapshot();assert.equal(s.owned.p1.powExp,0);assert.equal(s.owned.p1.level,1)});
 test('Learning 1-1 vẫn được ghi',()=>{const s=rt.getSnapshot();assert.ok(Number(s.learningRecords)>=7);assert.ok(rt.learningEvents.some(e=>e.kind==='mastery'))});
 const later=rt.context.POWDER_COMBAT_ACADEMIC_AUTHORITY_V1.applyOfflineCombatAcademicOutcome({authorityMode:'offline',battleId:'academic-later',battleCreatedAt:1100,stageId:'1-2',snapshot:rt.getSnapshot(),responses:[{powId:'p1',correct:true,question:q}],allowedQuestionPool:[q]});
 test('Cùng Starter ở màn sau vẫn nhận EXP',()=>{assert.equal(later.ok,true);assert.ok(later.powGrowth.totalExp>0);assert.ok(later.snapshot.owned.p1.powExp>0||later.snapshot.owned.p1.level>1)});
 test('1-2 có 1 Pow bị chặn',()=>assert.equal(R.playerTeamEntry('1-2',{owned:{p1:{}},team:['p1']},rt.context.POWDER_PLAYER_POW_ELIGIBILITY_V1).ready,false));
 test('1-2 có 2 Pow bị chặn',()=>assert.equal(R.playerTeamEntry('1-2',{owned:{p1:{},p2:{}},team:['p1','p2']},rt.context.POWDER_PLAYER_POW_ELIGIBILITY_V1).ready,false));
 test('1-2 có 3 Pow hợp lệ được vào',()=>assert.equal(R.playerTeamEntry('1-2',{owned:{p1:{},p2:{},p3:{}},team:['p1','p2','p3']},rt.context.POWDER_PLAYER_POW_ELIGIBILITY_V1).ready,true));
 test('Màn sau có dưới 3 Pow bị chặn',()=>assert.equal(R.playerTeamEntry('1-3',{owned:{p1:{},p2:{}},team:['p1','p2']},rt.context.POWDER_PLAYER_POW_ELIGIBILITY_V1).ready,false));
 test('Pow chưa sở hữu không được tính',()=>{const g=R.playerTeamEntry('1-2',{owned:{p1:{},p2:{}},team:['p1','p2','p3']},rt.context.POWDER_PLAYER_POW_ELIGIBILITY_V1);assert.equal(g.team.length,2);assert.equal(g.ready,false)});
 test('Pow trùng không được tính hai lần',()=>{const g=R.playerTeamEntry('1-2',{owned:{p1:{},p2:{}},team:['p1','p1','p2']},rt.context.POWDER_PLAYER_POW_ELIGIBILITY_V1);assert.deepEqual([...g.team],['p1','p2']);assert.equal(g.ready,false)});
 test('Request-builder policy không thể hạ minimumTeamSize do caller',()=>{const canonical=R.playerTeamEntry({id:'1-2',entryPolicy:{minimumTeamSize:1}},{owned:{p1:{}},team:['p1']},rt.context.POWDER_PLAYER_POW_ELIGIBILITY_V1);assert.equal(canonical.minimumTeamSize,3);assert.equal(canonical.ready,false)});
}

function baseProgressSave(){return{rank:0,owned:{p1:{level:1,powExp:0},p2:{level:1,powExp:0},p3:{level:1,powExp:0}},team:['p1','p2','p3'],starterId:'p1',activePowId:'p1',adventure:{islandsUnlocked:1,currentIsland:1,currentStage:2,stageWins:{'1-1':true},stageStars:{},stagePrep:{},totalStars:0},saveMeta:{}}}
function summary(roundCount,survivors,ids=['p1','p2','p3'],deployed=ids){return{turnCount:99,roundCount,players:ids.map(id=>({powId:id,deployed:deployed.includes(id),survived:survivors.includes(id)}))}}
function applyVictory(rt,{battleId,createdAt,stageId='1-2',roundCount=12,survivors=['p1','p2'],team=['p1','p2','p3'],mastery=0,knowledge=.1}={}){return rt.context.POWDER_ADVENTURE_PROGRESSION_AUTHORITY_V1.applyOfflineAdventureVictory({authorityMode:'offline',result:'victory',battleId,battleCreatedAt:createdAt,stageId,gateMastery:mastery,playerTeam:team,battleSummary:summary(roundCount,survivors,team),learningSummary:{players:[{knowledgeActions:10,knowledgeSum:10*knowledge}]},snapshot:rt.getSnapshot()})}

// Star V2 behavior
{
 let rt=makeContext({initialSave:baseProgressSave()});
 test('Thua không cộng sao',()=>{const before=rt.getSnapshot();const r=rt.context.POWDER_ADVENTURE_PROGRESSION_AUTHORITY_V1.applyOfflineAdventureVictory({authorityMode:'offline',result:'defeat',battleId:'star-defeat',battleCreatedAt:2000,stageId:'1-2',gateMastery:100,playerTeam:['p1','p2','p3'],battleSummary:summary(1,['p1','p2','p3']),snapshot:before});assert.equal(r.ok,false);assert.deepEqual(rt.getSnapshot().adventure.stageStars,{})});
 rt=makeContext({initialSave:baseProgressSave()});let r=applyVictory(rt,{battleId:'star-1',createdAt:2001,roundCount:12,survivors:['p1','p2']});
 test('Thắng 12 vòng 2 sống = 1 sao',()=>assert.equal(r.starsAwarded,1));
 rt=makeContext({initialSave:baseProgressSave()});r=applyVictory(rt,{battleId:'star-2',createdAt:2002,roundCount:9,survivors:['p1','p2']});
 test('Thắng 9 vòng 2 sống = 2 sao',()=>assert.equal(r.starsAwarded,2));
 rt=makeContext({initialSave:baseProgressSave()});r=applyVictory(rt,{battleId:'star-10',createdAt:2003,roundCount:10,survivors:['p1','p2','p3']});
 test('Đúng 10 vòng không có sao tốc độ',()=>{assert.equal(r.starsAwarded,2);assert.equal(r.roundCount,10)});
 rt=makeContext({initialSave:baseProgressSave()});r=applyVictory(rt,{battleId:'star-3',createdAt:2004,roundCount:9,survivors:['p1','p2','p3']});
 test('Thắng 9 vòng 3 sống = 3 sao',()=>assert.equal(r.starsAwarded,3));
 const tutorialSave=baseProgressSave();tutorialSave.adventure={islandsUnlocked:1,currentIsland:1,currentStage:1,stageWins:{},stageStars:{},stagePrep:{},totalStars:0};rt=makeContext({initialSave:tutorialSave});r=applyVictory(rt,{battleId:'star-tutorial',createdAt:2005,stageId:'1-1',roundCount:9,survivors:['p1'],team:['p1']});
 test('1-1 một Pow sống đạt sao sống sót',()=>{assert.equal(r.starsAwarded,3);assert.equal(r.deployedPlayerPow,1);assert.equal(r.survivingPlayerPow,1)});
 rt=makeContext({initialSave:baseProgressSave()});const high=applyVictory(rt,{battleId:'star-best-high',createdAt:2006,roundCount:9,survivors:['p1','p2','p3']});const low=applyVictory(rt,{battleId:'star-best-low',createdAt:2007,roundCount:12,survivors:['p1']});
 test('Đánh lại không làm giảm best stars',()=>{assert.equal(high.stageStars,3);assert.equal(low.starsAwarded,1);assert.equal(low.stageStars,3)});
 const a=makeContext({initialSave:baseProgressSave()}),b=makeContext({initialSave:baseProgressSave()});const ma=applyVictory(a,{battleId:'star-mastery-a',createdAt:2008,roundCount:9,survivors:['p1','p2'],mastery:0}),mb=applyVictory(b,{battleId:'star-mastery-b',createdAt:2008,roundCount:9,survivors:['p1','p2'],mastery:100});
 test('Mastery không thay đổi sao',()=>assert.equal(ma.starsAwarded,mb.starsAwarded));
 const c=makeContext({initialSave:baseProgressSave()}),d=makeContext({initialSave:baseProgressSave()});const ka=applyVictory(c,{battleId:'star-knowledge-a',createdAt:2009,roundCount:9,survivors:['p1','p2'],knowledge:0}),kb=applyVictory(d,{battleId:'star-knowledge-b',createdAt:2009,roundCount:9,survivors:['p1','p2'],knowledge:1});
 test('Knowledge Accuracy không thay đổi sao',()=>assert.equal(ka.starsAwarded,kb.starsAwarded));
 const shared=makeStorage();rt=makeContext({initialSave:baseProgressSave(),storage:shared});applyVictory(rt,{battleId:'star-reload',createdAt:2010,roundCount:9,survivors:['p1','p2','p3']});const persisted=rt.getSnapshot(),reloaded=makeContext({initialSave:persisted,storage:shared});
 test('Reload giữ stars',()=>assert.equal(reloaded.getSnapshot().adventure.stageStars['1-2'],3));
 rt=makeContext({initialSave:baseProgressSave()});const first=applyVictory(rt,{battleId:'star-dupe',createdAt:2011,roundCount:9,survivors:['p1','p2','p3']});const duplicate=applyVictory(rt,{battleId:'star-dupe',createdAt:2011,roundCount:12,survivors:['p1']});
 test('Duplicate battleId không cộng tiến trình lần nữa',()=>{assert.equal(first.duplicate,false);assert.equal(duplicate.duplicate,true);assert.equal(rt.getSnapshot().adventure.stageStars['1-2'],3)});
}

{
 const rt=makeContext({initialSave:baseProgressSave()}),r=rt.context.POWDER_ADVENTURE_PROGRESSION_AUTHORITY_V1.applyOfflineAdventureVictory({authorityMode:'offline',result:'victory',battleId:'star-reserve-not-deployed',battleCreatedAt:2012,stageId:'1-2',gateMastery:100,playerTeam:['p1','p2','p3','p4'],battleSummary:summary(9,['p1','p2','p4'],['p1','p2','p3','p4'],['p1','p2','p3']),learningSummary:{players:[]},snapshot:rt.getSnapshot()});
test('Dự bị chưa từng deploy không được tính cho sao sống sót',()=>{assert.equal(r.deployedPlayerPow,3);assert.equal(r.survivingPlayerPow,2);assert.equal(r.starsAwarded,2)});
}

assert.equal(checks,25);
let wiringChecks=0;
if(!process.argv.includes('--behavior-only')){
 const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
 const data=read('js/adventure-data.js'),map=read('js/adventure-map.js'),entry=read('js/combat-entry-v177.js'),controller=read('js/combat-result-controller-v1.js'),scene=read('src/game/combat2/scenes/BattleScene.ts');
 const wire=(name,fn)=>{fn();wiringChecks++;console.log(`PASS W${wiringChecks}. ${name}`)};
 wire('canonical stage policies are present',()=>{assert.match(data,/growthPolicy:\{powExpEnabled:!tutorial\}/);assert.match(data,/entryPolicy:\{minimumTeamSize:tutorial\?1:3\}/);assert.match(data,/speedRoundExclusive:10/)});
 wire('Adventure UI shows Star V2 objectives',()=>{assert.match(map,/Hoàn thành dưới 10 lượt/);assert.match(map,/Ít nhất 3 Pow còn sống/);assert.match(map,/Toàn bộ Pow xuất trận còn sống/);assert.doesNotMatch(map,/★ Mastery ≥ 90%|★ Kiến thức Combat ≥ 95%/)});
 wire('Adventure UI blocks insufficient team',()=>{assert.match(map,/Không đủ Pow xuất trận\./);assert.match(map,/Xin vui lòng ra trận với ít nhất \$\{teamGate\.minimumTeamSize\} Pow\./);assert.match(map,/reason:'minimum-team-size'/)});
 wire('request builder independently enforces canonical minimum team',()=>{assert.match(entry,/function pveTeamEntry/);assert.match(entry,/POWDER_ADVENTURE_DATA\?\.stageById/);assert.match(entry,/if\(!teamGate\.ok\)return\{ok:false,errors:teamGate\.errors\}/)});
 wire('academic settlement passes trusted request stage identity',()=>{assert.match(entry,/academic-stage-context-mismatch/);assert.match(entry,/stageId,responses:sanitized/);assert.match(controller,/academic-stage-context-mismatch/);assert.match(controller,/battleCreatedAt:request\.createdAt,stageId,responses/)});
 wire('progression receives real BattleSummary and request playerTeam',()=>{assert.match(entry,/battleSummary:result\.value\.battleSummary/);assert.match(entry,/playerTeam:request\.value\.playerTeam/);assert.match(controller,/battleSummary:result\.battleSummary/);assert.match(controller,/playerTeam:request\.playerTeam/)});
 wire('Combat telemetry distinguishes round and deployed survivor state',()=>{assert.match(scene,/roundCount: this\.combatState\.round/);assert.match(scene,/deployed: this\.deployedPlayerUnits\.has\(unit\.instanceId\)/);assert.match(scene,/this\.deployedPlayerUnits\.add\(promoted\.instanceId\)/)});
}
console.log(`PASS verify-adventure-v2-gameplay-phase1: ${checks} behavioral checks${wiringChecks?` + ${wiringChecks} wiring checks`:''}`);
