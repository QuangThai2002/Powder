import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import vm from 'node:vm';
const root=process.cwd(),entry=fs.readFileSync(path.join(root,'js/combat-entry-v177.js'),'utf8'),controller=fs.readFileSync(path.join(root,'js/combat-result-controller-v1.js'),'utf8'),html=fs.readFileSync(path.join(root,'combat2.html'),'utf8');const checks=[];const check=(name,fn)=>{fn();checks.push(name)};
check('victory reward claim is explicit and separate from return',()=>{assert.match(controller,/XÁC NHẬN & NHẬN QUÀ/);assert.match(controller,/primary\.textContent='VỀ PHIÊU LƯU'/);assert.doesNotMatch(controller,/XÁC NHẬN & VỀ PHIÊU LƯU|TIẾP TỤC MÀN TIẾP THEO|TIẾP TỤC MÀN \$\{/)});
check('unclaimed reward lists values and exposes claim action',()=>{assert.match(controller,/received\?receipt\.rewardGranted:request\.rewardContext/);assert.match(controller,/claimButton\.id='pfr-claim'/);assert.match(controller,/win&&!received/)});
check('received reward removes claim action',()=>assert.match(controller,/if\(win&&!received\).*claimActions\.append\(claimButton\)/));
check('no nextReadiness',()=>assert.doesNotMatch(controller,/function nextReadiness/));
check('no next-stage progression lookup in result',()=>assert.doesNotMatch(controller,/progression\?\.nextStageId/));
check('settlement order',()=>{const a=controller.indexOf('academic.applyOfflineCombatAcademicOutcome({'),b=controller.indexOf('player.applyOfflineBattleReward({'),c=controller.indexOf('progress.applyOfflineAdventureVictory({'),d=controller.indexOf('saveReceipt(receipt)');assert.ok(a>=0&&a<b&&b<c&&c<d)});
check('receipt acknowledgement fields',()=>{assert.match(controller,/acknowledged:false,acknowledgedAt:null/);assert.match(controller,/acknowledged:true,acknowledgedAt:Date\.now\(\)/)});
check('ack before clear',()=>{const f=controller.slice(controller.indexOf('async function returnAfterSettlement'),controller.indexOf('async function confirmVictory'));assert.ok(f.indexOf('acknowledge()')<f.indexOf('clearBattleTransient()'))});
check('failure holds result',()=>{assert.match(controller,/Không thể xác nhận phần thưởng lúc này\.\\nKết quả trận đấu đã được giữ lại\./);assert.match(controller,/failed_retryable/)});
check('defeat retry return labels',()=>{assert.match(controller,/THỬ LẠI/);assert.match(controller,/VỀ PHIÊU LƯU/)});
check('defeat receipt has no reward progression',()=>assert.match(controller,/rewardGranted:\{coins:0,exp:0,wins:0\},progressionApplied:false/));
check('retry fresh identity',()=>{assert.match(controller,/Math\.max\(Date\.now\(\),Number\(request\.createdAt\|\|0\)\+1\)/);assert.match(controller,/next\.value\.battleId===request\.battleId/)});
check('normal PVE offline default',()=>{assert.match(entry,/function verifiedPveServerAuthority/);assert.match(entry,/return verified\?'server':'offline'/);const body=entry.slice(entry.indexOf('function runtimePveAuthorityMode'),entry.indexOf('function playerTeam'));assert.doesNotMatch(body,/hasSession|hasAccount/)});
check('main final ack reconcile only',()=>{assert.match(entry,/finalReceipt\.acknowledged===true/);assert.match(entry,/pendingAcknowledgement:true/);assert.match(entry,/clearPveTransient\(result\.value\.battleId\)/)});
check('legacy PVE authority guard explicit',()=>{const body=entry.slice(entry.indexOf('async function settleReturnedResult'),entry.indexOf('function scheduleSettlement'));assert.match(body,/\['server','online'\]\.includes\(String\(request\.value\.sourceContext\?\.authorityMode/)});
check('combat2 stays lightweight',()=>assert.doesNotMatch(html,/<script[^>]+app\.js/i));
check('controller cloud sync durable marker',()=>assert.match(controller,/powder_online_pending_sync_v150/));
check('controller requires active request result',()=>assert.match(controller,/if\(!req\?\.ok\|\|!battle\?\.ok/));
check('acknowledged controller never renders',()=>assert.match(controller,/if\(receipt\?\.acknowledged===true\)\{clearBattleTransient\(\);goAdventure\(\);return true\}/));

class FakeElement{
 constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.textContent='';this.className='';this.id='';this.disabled=false}
 append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node)}}
 appendChild(node){this.append(node);return node}
 remove(){if(!this.parentNode)return;this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null}
 setAttribute(){}
}
class FakeStorage{
 constructor(seed={}){this.map=new Map(Object.entries(seed))}
 getItem(key){return this.map.has(key)?this.map.get(key):null}
 setItem(key,value){this.map.set(key,String(value))}
 removeItem(key){this.map.delete(key)}
}
function findById(node,id){if(node.id===id)return node;for(const child of node.children||[]){const match=findById(child,id);if(match)return match}return null}
function allText(node){return [node.textContent,...(node.children||[]).map(allText)].filter(Boolean).join(' ')}
function renderVictory(receiptRecord=null){
 const battleId='c2-ui-reward',request={battleId,battleMode:'pve',sourceContext:{stageId:'1-1',authorityMode:'offline'},academicContext:{stageId:'1-1'},rewardContext:{coins:120,exp:35},playerTeam:['hero-1'],createdAt:1000},result={battleId,battleMode:'pve',result:'victory',battleSummary:{turnCount:4,durationMs:9000,players:[]},academicOutcome:{responses:[]}},seed={};
 if(receiptRecord)seed['powder.combat2.final.receipts.v1']=JSON.stringify({version:1,records:[receiptRecord]});
 const document={body:new FakeElement('body'),createElement:tag=>new FakeElement(tag)},localStorage=new FakeStorage(seed),sessionStorage=new FakeStorage(),window={document,localStorage,sessionStorage,location:{href:'http://localhost/combat2.html',assign:()=>{}},POWDER_COMBAT2_HANDOFF:{readBattleRequest:()=>({ok:true,value:request}),readBattleResult:()=>({ok:true,value:result})},POWDER_ADVENTURE_DATA:{stageById:id=>({id})},POWDER_COMBAT_RESULT_PRESENTATION_V2:{playerResultRows:()=>[]}};
 window.window=window;window.URL=URL;const context=vm.createContext({window,document,localStorage,sessionStorage,URL,console,JSON,Date,Number,String,Array,Object,Math,Set,Map});vm.runInContext(controller,context,{filename:'combat-result-controller-v1.js'});assert.equal(window.POWDER_COMBAT_RESULT_CONTROLLER_V1.present(),true);return document.body;
}
check('unclaimed victory renders reward values and claim button',()=>{const body=renderVictory(),text=allText(body);assert.match(text,/Chưa nhận phần thưởng/);assert.match(text,/120 Coin · 35 EXP/);assert.ok(findById(body,'pfr-claim'));assert.equal(findById(body,'pfr-confirm'),null)});
check('received victory renders confirmation without claim button',()=>{const body=renderVictory({version:1,battleId:'c2-ui-reward',state:'completed',result:'victory',rewardGranted:{coins:120,exp:35,wins:1},acknowledged:false}),text=allText(body);assert.match(text,/✓ Đã nhận phần thưởng/);assert.equal(findById(body,'pfr-claim'),null);assert.ok(findById(body,'pfr-confirm'))});
console.log('verify-combat-result-final-flow-v1: PASS',checks.length,'checks');
