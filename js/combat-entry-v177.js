(()=>{'use strict';
const VERSION='17.7-player-first-entry';
const HANDOFF_VERSION=1,REQUEST_KEY='powder.combat2.handoff.request.v1',RESULT_KEY='powder.combat2.handoff.result.v1',SETTLED_KEY='powder.combat2.handoff.settled.v1',RECEIPT_KEY='powder.combat2.handoff.receipt.v1';
const BATTLE_MODES=new Set(['pve','pvp','boss','daily_boss','dungeon','event']),RESULT_VALUES=new Set(['victory','defeat','draw','cancel']);
let lastEntryResult={ok:false,reason:'not-started',errors:[]};
let settlementRunning=false;
function clone(value){try{return value==null?null:JSON.parse(JSON.stringify(value));}catch{return null;}}
function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function ids(value){return Array.isArray(value)?[...new Set(value.map(id=>String(id||'').trim().toLowerCase()).filter(Boolean))].slice(0,5):[]}
function read(key,scope='sessionStorage'){try{const raw=window[scope]?.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;}}
function write(key,value,scope='sessionStorage'){try{window[scope]?.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function remove(key,scope='sessionStorage'){try{window[scope]?.removeItem(key);}catch{}}
function battleId(){const id=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID().replace(/-/g,''):`${Date.now()}${Math.random().toString(36).slice(2)}`;return `c2-${id}`;}
function validateBattleRequest(raw){const input=obj(raw),battleIdValue=String(input.battleId||'').trim(),battleMode=String(input.battleMode||'').toLowerCase(),playerTeam=ids(input.playerTeam),enemyTeam=ids(input.enemyTeam),errors=[];if(!/^c2-[a-z0-9]+$/i.test(battleIdValue))errors.push('battleId không hợp lệ');if(!BATTLE_MODES.has(battleMode))errors.push('battleMode không được hỗ trợ');if(!playerTeam.length)errors.push('đội người chơi trống');if(!enemyTeam.length)errors.push('đội đối thủ trống');if(battleMode==='boss'&&!String(obj(input.bossContext).bossChallengeId||'').trim())errors.push('bossContext không hợp lệ');if(errors.length)return{ok:false,errors};const formation=obj(input.formation);return{ok:true,value:{version:HANDOFF_VERSION,battleId:battleIdValue,battleMode,sourceContext:clone(obj(input.sourceContext))||{},returnContext:clone(obj(input.returnContext))||{},playerTeam,formation:{active:ids(formation.active).filter(id=>playerTeam.includes(id)).slice(0,3),reserve:ids(formation.reserve).filter(id=>playerTeam.includes(id)).slice(0,2)},enemyTeam,enemyConfig:clone(obj(input.enemyConfig))||{},battleRules:clone(obj(input.battleRules))||{},rosterContext:clone(obj(input.rosterContext))||{},bossContext:clone(obj(input.bossContext))||{},academicContext:clone(obj(input.academicContext))||{},rewardContext:clone(obj(input.rewardContext))||{},seed:input.seed==null?null:String(input.seed),createdAt:Number(input.createdAt)||Date.now()}};}
function createBattleRequest(input={}){return validateBattleRequest({...obj(input),battleId:input.battleId||battleId(),createdAt:Date.now()});}
function storeBattleRequest(request){const checked=validateBattleRequest(request);if(!checked.ok)return checked;if(!write(REQUEST_KEY,checked.value))return{ok:false,errors:['không thể lưu BattleRequest']};remove(RESULT_KEY);return checked;}
function readBattleRequest(){const value=read(REQUEST_KEY);return value?validateBattleRequest(value):{ok:false,errors:['không có BattleRequest']};}
function validateBattleResult(raw,request){const input=obj(raw),result=String(input.result||'').toLowerCase(),errors=[];if(!request||input.battleId!==request.battleId)errors.push('BattleResult không khớp BattleRequest');if(!RESULT_VALUES.has(result))errors.push('kết quả trận không hợp lệ');if(String(input.battleMode||'')!==String(request?.battleMode||''))errors.push('battleMode không khớp');if(errors.length)return{ok:false,errors};return{ok:true,value:{version:HANDOFF_VERSION,battleId:request.battleId,battleMode:request.battleMode,result,survivingState:clone(obj(input.survivingState))||{},battleSummary:clone(obj(input.battleSummary))||{},rewardOutcome:clone(obj(input.rewardOutcome))||{},academicOutcome:clone(obj(input.academicOutcome))||{},progressionOutcome:clone(obj(input.progressionOutcome))||{},bossOutcome:clone(obj(input.bossOutcome))||{},returnContext:clone(obj(input.returnContext))||request.returnContext,finishedAt:Number(input.finishedAt)||Date.now()}};}
function publishBattleResult(result){const request=readBattleRequest();if(!request.ok)return request;const checked=validateBattleResult(result,request.value);if(!checked.ok)return checked;return write(RESULT_KEY,checked.value)?checked:{ok:false,errors:['không thể lưu BattleResult']};}
function readBattleResult(){const request=readBattleRequest(),value=read(RESULT_KEY);return request.ok&&value?validateBattleResult(value,request.value):{ok:false,errors:['không có BattleResult']};}
function settledIds(){const values=read(SETTLED_KEY,'localStorage');return Array.isArray(values)?values.map(String).filter(Boolean).slice(-32):[];}
function markSettled(id){const prior=settledIds();return prior.includes(id)?false:write(SETTLED_KEY,[...prior,id].slice(-32),'localStorage');}
function onCombat2Page(){return /(?:^|\/)combat2\.html$/i.test(window.location.pathname);}
function restoreContext(context){const target=obj(context),view=String(target.view||'home');window.POWDER_APP?.showView?.(view);if(view==='adventure')window.POWDER_ADVENTURE?.restoreCombatContext?.(target);}
function continueBattleResult(result,settled=true){if(settled){remove(RESULT_KEY);remove(REQUEST_KEY);remove(RECEIPT_KEY);}restoreContext(result?.returnContext);return{ok:true};}
function showSettledBattleResult(result,receipt=null,errorCode=''){
  if(typeof document?.getElementById!=='function'||typeof document?.createElement!=='function')return;
  let overlay=document.getElementById('combat2SettlementResult');
  if(!overlay){overlay=document.createElement('section');overlay.id='combat2SettlementResult';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.style.cssText='position:fixed;inset:0;z-index:3000;display:grid;place-items:center;background:rgba(3,14,24,.87);padding:20px';document.body.appendChild(overlay);}
  overlay.replaceChildren();
  const panel=document.createElement('div');panel.style.cssText='width:min(620px,100%);max-height:90vh;overflow:auto;padding:28px;border:2px solid #83d9dc;border-radius:22px;background:#102736;color:#edf9fa;box-shadow:0 24px 70px #0009';
  const add=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;node.style.margin='0 0 14px';panel.appendChild(node);return node;};
  add('h2',result.result==='victory'?'CHIẾN THẮNG':'THẤT BẠI');
  const summary=obj(result.battleSummary),players=Array.isArray(summary.players)?summary.players:[];
  const duration=typeof summary.durationMs==='number'&&Number.isFinite(summary.durationMs)?`${Math.round(summary.durationMs/1000)} giây`:'không ghi nhận';
  add('p',`${Math.max(0,Number(summary.turnCount)||0)} lượt · ${duration}`);
  if(players.length){
    const total=players.reduce((acc,raw)=>{const row=obj(raw);acc.dealt+=Math.max(0,Number(row.damageDealt)||0);acc.taken+=Math.max(0,Number(row.damageTaken)||0);acc.healed+=Math.max(0,Number(row.healingDone)||0);acc.shield+=Math.max(0,Number(row.shieldDone)||0);acc.absorbed+=Math.max(0,Number(row.shieldAbsorbed)||0);return acc;},{dealt:0,taken:0,healed:0,shield:0,absorbed:0});
    add('p',`Sát thương trực tiếp ${total.dealt} · Nhận ${total.taken} · Hồi ${total.healed} · Khiên ${total.shield} · Hấp thụ ${total.absorbed}`);
    add('p',players.map(raw=>{const row=obj(raw);return `${String(row.powId||'Pow')}: ${row.survived?'còn sống':'bị hạ'} · sát thương ${Math.max(0,Number(row.damageDealt)||0)}`;}).join('\n')).style.whiteSpace='pre-line';
  }
  if(errorCode){add('h3','Phần thưởng chưa đồng bộ');add('p',`Trận đấu đã hoàn thành nhưng phần thưởng chưa thể đồng bộ. [${errorCode}]`);}
  else if(result.result==='victory'){
    const granted=obj(receipt?.granted);
    add('h3','Nhận được');add('p',`${Math.max(0,Number(granted.coins)||0)} Military Coin · ${Math.max(0,Number(granted.exp)||0)} EXP gameplay`);
  }else add('p','Không có phần thưởng khi thất bại.');
  const button=document.createElement('button');button.type='button';button.textContent='Tiếp tục';button.style.cssText='padding:12px 25px;border:1px solid #9be9dc;border-radius:12px;background:#237b65;color:white;font-weight:bold;cursor:pointer';
  button.onclick=()=>{overlay.remove();continueBattleResult(result,!errorCode);};
  panel.appendChild(button);overlay.appendChild(panel);button.focus();
}
async function settleAcademicOutcome(request,result){
  if(request?.battleMode!=='pve'||request?.academicContext?.requiresActionQuestions!==true)return{ok:true,applied:0};
  const responses=Array.isArray(result?.academicOutcome?.responses)?result.academicOutcome.responses:[];
  if(!responses.length)return{ok:true,applied:0};
  const allowed=new Set((Array.isArray(request.academicContext.allowedQuestionPool)?request.academicContext.allowedQuestionPool:[]).map(q=>String(q?.id||'')).filter(Boolean));
  const sanitized=[];
  for(const raw of responses){
    const response=obj(raw),question=obj(response.question),id=String(question.id||'').trim();
    if(!id||!allowed.has(id))return{ok:false,reason:'academic-question-not-allowed'};
    sanitized.push({powId:String(response.powId||'').trim(),correct:response.correct===true,question});
  }
  const safety=window.POWDER_TX_SAFETY_V2090;
  if(typeof safety?.mutate!=='function')return{ok:false,reason:'academic-idempotency-unavailable'};
  try{return await safety.mutate({
    scope:'learning',
    operation:'combat2-academic-outcome',
    payload:{battleId:result.battleId,responses:sanitized},
    dedupeKey:`combat2-academic:${result.battleId}`,
    stable:true,
    txKey:`combat2-academic:${result.battleId}`,
    send:async()=>{
      for(const response of sanitized){
        const value=window.POWDER_APP?.grantLearningProgress?.({powId:response.powId,correct:response.correct,source:'combat',question:response.question});
        if(value?.ok===false&&value?.serverProtected!==true)throw new Error('academic-authority-rejected');
      }
      return{ok:true,applied:sanitized.length};
    }
  });}catch{return{ok:false,reason:'academic-authority-rejected'};}
}
async function settleReturnedResult(){
  if(onCombat2Page())return{ok:false,reason:'combat2-page'};
  if(settlementRunning)return{ok:false,reason:'settlement-in-progress'};
  settlementRunning=true;
  try{
  const request=readBattleRequest(),result=readBattleResult();
  if(!request.ok||!result.ok)return{ok:false,reason:'missing-result'};
  if(settledIds().includes(result.value.battleId)){const receipt=read(RECEIPT_KEY);showSettledBattleResult(result.value,receipt?.battleId===result.value.battleId?receipt:null,receipt?.battleId===result.value.battleId?'':'COMBAT_REWARD_RECEIPT_MISSING');return{ok:true,duplicate:true};}
  if(result.value.battleMode==='pve'&&(window.POWDER_ONLINE_V150?.hasSession?.()||window.POWDER_SECURE_ECONOMY_V152?.hasAccount?.())){
    showSettledBattleResult(result.value,null,'COMBAT_REWARD_ONLINE_AUTHORITY_UNAVAILABLE');
    return{ok:false,reason:'online-reward-authority-unavailable'};
  }
  const academicResult=await settleAcademicOutcome(request.value,result.value);
  if(!academicResult?.ok){showSettledBattleResult(result.value,null,'COMBAT_ACADEMIC_SETTLEMENT_FAILED');return academicResult;}
  let rewardResult={ok:true,granted:{coins:0,exp:0,wins:0}};
  if(result.value.battleMode==='boss'){
    const boss=obj(request.value.bossContext),stage=obj(request.value.sourceContext).stage,safety=window.POWDER_TX_SAFETY_V2090;
    if(typeof safety?.mutate!=='function'||typeof window.POWDER_APP?.onBossCombatFinished!=='function'){showSettledBattleResult(result.value,null,'COMBAT_BOSS_SETTLEMENT_UNAVAILABLE');return{ok:false,reason:'boss-settlement-unavailable'};}
    try{rewardResult=await safety.mutate({scope:'reward',operation:'combat2-boss-settlement',payload:{battleId:result.value.battleId,bossChallengeId:String(boss.bossChallengeId||''),result:result.value.result},dedupeKey:`combat2-boss:${result.value.battleId}`,stable:true,txKey:`combat2-boss:${result.value.battleId}`,send:async()=>{const value=window.POWDER_APP.onBossCombatFinished({id:String(boss.bossChallengeId||''),win:result.value.result==='victory',stage:clone(stage),summary:result.value.academicOutcome?.summary||{players:[]}});if(value?.ok===false)return Promise.reject(new Error('boss-authority-rejected'));return value||{ok:true};}});}catch{showSettledBattleResult(result.value,null,'COMBAT_BOSS_SETTLEMENT_FAILED');return{ok:false,reason:'boss-authority-rejected'};}
  }else if(result.value.battleMode==='pve'&&result.value.result==='victory'){
    const reward=obj(request.value.rewardContext),safety=window.POWDER_TX_SAFETY_V2090;
    if(typeof safety?.mutate!=='function'){showSettledBattleResult(result.value,null,'COMBAT_REWARD_TX_UNAVAILABLE');return{ok:false,reason:'reward-idempotency-unavailable'};}
    try{rewardResult=await safety.mutate({scope:'reward',operation:'combat2-pve-reward',payload:{battleId:result.value.battleId,rewardId:String(reward.rewardId||''),coins:Math.max(0,Number(reward.coins)||0),exp:Math.max(0,Number(reward.exp)||0),wins:Math.max(0,Number(reward.wins)||1)},dedupeKey:`combat2:${result.value.battleId}`,stable:true,txKey:`combat2:${result.value.battleId}`,send:async()=>{const before=window.POWDER_APP?.getSave?.()||{},value=window.POWDER_APP?.grantBattleRewards?.({coins:Math.max(0,Number(reward.coins)||0),exp:Math.max(0,Number(reward.exp)||0),wins:Math.max(0,Number(reward.wins)||1)});if(value?.ok!==true||value?.serverProtected===true)throw new Error('reward-authority-rejected');const after=window.POWDER_APP?.getSave?.()||{};return{ok:true,granted:{coins:Math.max(0,Number(after.coins||0)-Number(before.coins||0)),exp:Math.max(0,Number(after.exp||0)-Number(before.exp||0)),wins:Math.max(0,Number(after.wins||0)-Number(before.wins||0))}};}});}catch{showSettledBattleResult(result.value,null,'COMBAT_REWARD_SETTLEMENT_FAILED');return{ok:false,reason:'reward-authority-rejected'};}
    if(rewardResult?.ok!==true||!rewardResult.granted){showSettledBattleResult(result.value,null,'COMBAT_REWARD_RECEIPT_INVALID');return{ok:false,reason:'reward-receipt-invalid'};}
    const stage=request.value.sourceContext?.stage;
    if(stage)window.POWDER_ADVENTURE?.onBattleFinished?.({stage,win:true,summary:result.value.academicOutcome?.summary||{players:[]},reward:rewardResult});
  }
  const bossGrant=result.value.battleMode==='boss'&&result.value.result==='victory'?obj(rewardResult.reward):{};
  const granted=rewardResult.granted||{coins:Math.max(0,Number(bossGrant.coins)||0),exp:Math.max(0,Number(bossGrant.exp)||0),wins:0};
  if(!write(RECEIPT_KEY,{battleId:result.value.battleId,granted})){showSettledBattleResult(result.value,null,'COMBAT_RECEIPT_STORAGE_FAILED');return{ok:false,reason:'receipt-write-failed'};}
  if(!markSettled(result.value.battleId)){showSettledBattleResult(result.value,null,'COMBAT_SETTLEMENT_STORAGE_FAILED');return{ok:false,reason:'settlement-write-failed'};}
  showSettledBattleResult(result.value,read(RECEIPT_KEY));return{ok:true,duplicate:false,rewardOutcome:granted};
  }finally{settlementRunning=false;}
}
function scheduleSettlement(){if(onCombat2Page())return;let attempts=0;const run=()=>{attempts+=1;const ready=window.POWDER_APP&&window.POWDER_ADVENTURE&&typeof window.POWDER_TX_SAFETY_V2090?.mutate==='function'&&window.POWDER_SECURE_ECONOMY_V152;if(ready){void settleReturnedResult();return;}if(attempts<120){window.setTimeout(run,100);return;}const result=readBattleResult();if(result.ok)showSettledBattleResult(result.value,null,'COMBAT_SETTLEMENT_RUNTIME_NOT_READY');};window.setTimeout(run,120);}
function launchCombat2(request){const stored=storeBattleRequest(request);if(!stored.ok)return stored;try{const url=new URL('combat2.html',window.location.href);url.searchParams.set('battle',stored.value.battleId);window.location.assign(url);return{ok:true,value:stored.value};}catch{remove(REQUEST_KEY);return{ok:false,errors:['không thể mở Combat2']};}}
function returnToMain(result){const published=publishBattleResult(result);if(!published.ok)return published;try{window.location.assign(new URL('./',window.location.href));return published;}catch{return{ok:false,errors:['không thể quay về Main']};}}
function playerTeam(){const save=window.POWDER_APP?.getSave?.()||{},policy=eligibility(),known=new Set((window.POWDER_DATA?.pows||[]).filter(pow=>policy?.isPlayerEligible?.(pow)).map(pow=>String(pow?.id||'').toLowerCase())),team=ids(save.team).filter(id=>known.has(id));if(!team.length&&save.starterId&&known.has(String(save.starterId).toLowerCase()))team.push(String(save.starterId).toLowerCase());return team;}
function academicQuestionSnapshot(stage,gate){const requiredLessons=new Set(ids(gate?.requirement?.RequiredLessonIDs)),requiredConcepts=new Set(ids(gate?.requirement?.RequiredConceptIDs)),source=window.POWDER_APP?.getCombatQuestionPool?.({stage,mode:'pve'}),out=[],seen=new Set();for(const raw of Array.isArray(source)?source:[]){const q=obj(raw),id=String(q.id||'').trim(),lessonId=String(q.lessonId||'').trim(),conceptId=String(q.conceptId||q.learningMeta?.ConceptID||'').trim(),prompt=String(q.prompt||'').trim(),answer=String(q.answer||'').trim(),options=[...new Set((Array.isArray(q.options)?q.options:[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,4);if(!id||seen.has(id)||!lessonId||!conceptId||!prompt||!answer||options.length<2||!options.includes(answer))continue;if(requiredLessons.size&&!requiredLessons.has(lessonId))continue;if(requiredConcepts.size&&!requiredConcepts.has(conceptId))continue;seen.add(id);out.push({id,lessonId,conceptId,language:String(q.language||'ZH').toUpperCase(),prompt,answer,options,explain:String(q.explain||'').trim()});if(out.length>=24)break;}return out;}
function resolveLearningGate(stage,provided){return provided&&typeof provided==='object'?provided:window.POWDER_ADVENTURE?.learningGate?.(stage)||window.POWDER_APP?.getDungeonLearningGate?.(stage)||{};}
function createPvePilotRequest(stage,options={}){stage=playerStage(stage);if(!stage)return{ok:false,errors:['player eligibility không hợp lệ']};const player=playerTeam(),enemy=ids(stage?.enemyIds).slice(0,Math.max(1,Math.min(5,Number(stage?.enemyCount)||3))),gate=resolveLearningGate(stage,options?.learningGate),save=window.POWDER_APP?.getSave?.()||{},questions=academicQuestionSnapshot(stage,gate),roster=window.POWDER_COMBAT2_BOSS_BOOTSTRAP?.buildPve?.(stage,{playerIds:player,enemyIds:enemy,save});return createBattleRequest({battleMode:'pve',sourceContext:{kind:'adventure',stage:clone(stage),stageId:String(stage?.id||'')},returnContext:{view:'adventure',stageId:String(stage?.id||''),islandId:Number(stage?.islandId)||1},playerTeam:player,formation:{active:player.slice(0,3),reserve:player.slice(3,5)},enemyTeam:enemy,enemyConfig:{stageId:String(stage?.id||''),kind:String(stage?.kind||'normal')},battleRules:{stageScale:Number(stage?.scale)||1,initiative:Number(stage?.initiative)||0,learningActionScale:true},rosterContext:roster||{},academicContext:{authority:'main-learning',stageId:String(stage?.id||''),rank:Number(gate?.requirement?.Rank)||0,islandId:Number(stage?.islandId)||0,curriculum:clone(gate?.requirement?.Curriculum)||{},learnedLessonIds:ids(save.lessonsDone),requiredLessonIds:Array.isArray(gate?.requirement?.RequiredLessonIDs)?[...gate.requirement.RequiredLessonIDs]:[],requiredConceptIds:Array.isArray(gate?.requirement?.RequiredConceptIDs)?[...gate.requirement.RequiredConceptIDs]:[],requiredMastery:Number(gate?.requirement?.RequiredMastery)||0,srs:{mode:'due-first',at:Date.now()},allowedQuestionPool:questions,requiresActionQuestions:true,gateReady:gate?.ready!==false,onboardingCombat:gate?.onboardingCombat===true},rewardContext:{rewardId:`pve:${String(stage?.id||'')}`,coins:Math.max(0,Number(stage?.rewards?.coins)||0),exp:Math.max(0,Number(stage?.rewards?.exp)||0),wins:1}});}
function pvePilotErrors(request){const errors=[...(Array.isArray(request?.errors)?request.errors:[])],value=request?.value,roster=value?.rosterContext,academic=value?.academicContext;if(!request?.ok)return errors.length?errors:['BattleRequest không hợp lệ'];if(!Array.isArray(roster?.playerRoster)||!roster.playerRoster.length)errors.push('đội người chơi trống');if(!Array.isArray(roster?.enemyRoster)||!roster.enemyRoster.length)errors.push('đội đối thủ trống');if(academic?.gateReady===false)errors.push('chưa đủ điều kiện học thuật');if(academic?.requiresActionQuestions!==true)errors.push('thiếu câu hỏi hành động học thuật');if(!Array.isArray(academic?.allowedQuestionPool)||!academic.allowedQuestionPool.length)errors.push('không có câu hỏi học thuật hợp lệ');if(typeof window.POWDER_APP?.grantLearningProgress!=='function')errors.push('thiếu quyền ghi kết quả học thuật');if(typeof window.POWDER_TX_SAFETY_V2090?.mutate!=='function')errors.push('thiếu lớp giao dịch an toàn');return[...new Set(errors)];}
function canRunPvePilot(request){return pvePilotErrors(request).length===0;}
function bossConfig(type){const config=window.POWDER_BOSS_ENCOUNTER_V1860?.encounter?.(type);return clone(config)||null;}
function createBossPilotRequest(stage){const raw=stage;stage=playerStage(stage);if(!stage||(raw?.serverCombatSessionId&&eligibility()?.containsHiddenPow?.(raw.enemyIds)))return{ok:false,errors:['Boss server trả về Pow không hợp lệ cho player mode']};const player=playerTeam(),challengeId=String(stage?.bossChallengeId||'').toLowerCase(),enemy=ids(stage?.enemyIds).slice(0,1),config=bossConfig(challengeId),save=window.POWDER_APP?.getSave?.()||{},bootstrap=window.POWDER_COMBAT2_BOSS_BOOTSTRAP?.build?.(stage,{playerIds:player,enemyIds:enemy,save});return createBattleRequest({battleMode:'boss',sourceContext:{kind:'boss',stage:clone(stage),stageId:String(stage?.id||''),bossChallengeId:challengeId},returnContext:{view:'boss',bossChallengeId:challengeId},playerTeam:player,formation:{active:player.slice(0,3),reserve:player.slice(3,5)},enemyTeam:enemy,enemyConfig:{bossId:enemy[0]||null,difficulty:String(stage?.difficultyLabel||'BOSS')},battleRules:{stageScale:Number(stage?.scale)||1,initiative:Number(stage?.initiative)||0},bossContext:{bossChallengeId:challengeId,bossType:challengeId,bossId:enemy[0]||null,rank:Number(save.rank)||0,difficulty:String(stage?.difficultyLabel||'BOSS'),phaseConfig:config,bootstrap,rewardContext:{claimId:String(stage?.id||challengeId),rewardEligible:stage?.rewardEligibleServer!==false},cooldownContext:{challengeId}},academicContext:{authority:'boss-qualified-main',requiresActionQuestions:false},rewardContext:{rewardId:`boss:${challengeId}`}});}
function canRunBossPilot(request){const bootstrap=request?.value?.bossContext?.bootstrap;return !!request?.ok&&request.value.battleMode==='boss'&&!!request.value.bossContext?.phaseConfig&&Array.isArray(bootstrap?.playerRoster)&&bootstrap.playerRoster.length>0&&Array.isArray(bootstrap?.enemyRoster)&&bootstrap.enemyRoster.length>0&&typeof window.POWDER_APP?.onBossCombatFinished==='function'&&typeof window.POWDER_TX_SAFETY_V2090?.mutate==='function'&&!window.POWDER_ONLINE_V150?.hasSession?.()&&!request.value.sourceContext?.stage?.serverCombatSessionId;}
function scene(){return window.POWDER_BATTLE_PLAYER_V177||null;}
function normalize(stage,source){const s=stage&&typeof stage==='object'?JSON.parse(JSON.stringify(stage)):null;if(!s)return null;s.entrySource=source;return s;}
function startMap(stage,options={}){const s=normalize(stage,'map');if(!s||Number(s.islandId)<1||!s.id){lastEntryResult={ok:false,reason:'invalid-stage',errors:['stage không hợp lệ']};return options?.structured?lastEntryResult:false;}const pilot=createPvePilotRequest(s,options);const errors=pvePilotErrors(pilot);if(errors.length){lastEntryResult={ok:false,reason:errors.includes('chưa đủ điều kiện học thuật')?'academic-gate':'pve-entry-not-ready',errors};return options?.structured?lastEntryResult:false;}const launched=launchCombat2(pilot.value);lastEntryResult=launched.ok?{ok:true,reason:'launched',value:launched.value}:{ok:false,reason:'launch-failed',errors:launched.errors||['không thể mở Combat2']};return options?.structured?lastEntryResult:launched.ok;}
function startBoss(stage){const s=normalize(stage,'boss');if(!s||s.kind!=='boss'||!s.bossChallengeId)return false;const pilot=createBossPilotRequest(s);if(!canRunBossPilot(pilot))return false;return launchCombat2(pilot.value).ok;}
function startEvent(stage){const s=normalize(stage,'event');if(!s||s.eventCombat!==true||!s.eventId)return false;return !!scene()?.startEncounter?.(s,'event');}
function isActive(){return !!scene()?.isActive?.();}
function getState(){return scene()?.getState?.()||null;}
function forfeit(reason='navigation'){return !!scene()?.forfeit?.(reason);}
function getExitCost(){return Math.max(0,Number(scene()?.getExitCost?.()||0));}
function eligibility(){return window.POWDER_PLAYER_POW_ELIGIBILITY_V1||null;}
function playerStage(stage){return eligibility()?.sanitizeStage?.(stage)||null;}
if(window.__POWDER_APP_BOOTED__)scheduleSettlement();
else window.addEventListener('powder:app-booted',scheduleSettlement,{once:true});
window.POWDER_COMBAT2_HANDOFF=Object.freeze({version:HANDOFF_VERSION,createBattleRequest,validateBattleRequest,storeBattleRequest,readBattleResult,readBattleRequest,publishBattleResult,returnToMain,settleReturnedResult,continueBattleResult,launchCombat2});
window.POWDER_COMBAT_ENTRY_V177=Object.freeze({version:VERSION,startMap,startBoss,startEvent,isActive,getState,forfeit,getExitCost,createPvePilotRequest,createBossPilotRequest,canRunPvePilot,canRunBossPilot,launchCombat2,getLastEntryResult:()=>clone(lastEntryResult),combat2Cutover:Object.freeze({pve:true,boss:true,legacyFallback:false}),modes:Object.freeze(['map','boss','event'])});
})();
