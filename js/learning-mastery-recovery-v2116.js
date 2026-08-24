(()=>{'use strict';
const VERSION='21.1.6',LM=window.POWDER_LEARNING_MASTER_V2,D=window.POWDER_DATA,A=window.POWDER_ADVENTURE_DATA||null,DOC=typeof document==='object'?document:null;
if(!LM||!D||typeof LM.evaluateStage!=='function'||typeof LM.lessonMastery!=='function')return;
if(window.POWDER_MASTERY_RECOVERY_V2116?.version===VERSION)return;
// Design references: Anki relearning/review separation, Moodle completion criteria,
// and Kolibri learner-progress remediation. Powder never changes canonical mastery,
// rewards, SRS intervals, Rank gates, Dungeon requirements or Combat rules here.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function normalize(save){LM.normalizeSave?.(save);return save}
function lessonById(id){return (D.lessons||[]).find(x=>x?.id===id)||null}
function questionMeta(q){const a=q?.academicMeta||{},l=q?.learningMeta||LM.questionMeta?.(q)||{};return{lessonId:String(q?.lessonId||a.sourceLessonId||l.LessonID||''),concept:String(a.sourceUnitId||l.ConceptID||q?.id||''),skill:String(a.dimension||l.SkillType||q?.type||'General'),language:q?.language||l.Language||'ZH'}}
function lessonQuestions(lessonId){const out=[],seen=new Set,add=q=>{if(!q?.id||seen.has(q.id))return;const m=questionMeta(q);if(m.lessonId!==lessonId&&q.lessonId!==lessonId)return;seen.add(q.id);out.push(q)};for(const q of D.questions||[])add(q);for(const q of lessonById(lessonId)?.questions||[])add({...q,lessonId:q.lessonId||lessonId});return out}
function mistakeRows(save,lessonId,now=Date.now()){
 normalize(save);const battle=new Set(Array.isArray(save?.battleMistakes)?save.battleMistakes:[]),recent=new Set((save?.learning?.recentQuestionIds||[]).slice(-24)),rows=[];
 for(const q of lessonQuestions(lessonId)){const st=save?.questionProgress?.[q.id]||{},wrong=Number(st.wrong)||0,seen=Number(st.seen)||0;if(!wrong&&!battle.has(q.id))continue;const m=questionMeta(q),mastery=clamp(st.mastery,0,100),due=seen>0&&Number(st.nextReview||Infinity)<=now,score=(battle.has(q.id)?24:0)+wrong*8+(100-mastery)*.35+(due?12:0)+(Number(st.streak||0)===0?5:0)-(recent.has(q.id)?5:0);rows.push({id:q.id,prompt:String(q.prompt||''),lessonId,language:m.language,concept:m.concept,skill:m.skill,mastery,wrong,due,score})}
 rows.sort((a,b)=>b.score-a.score||b.wrong-a.wrong||a.id.localeCompare(b.id));const out=[],concepts=new Set;for(const r of rows){const key=r.concept||r.id;if(concepts.has(key))continue;concepts.add(key);out.push(r);if(out.length>=3)break}return out
}
function actionForLesson(save,lessonId,requiredMastery,status,now=Date.now()){
 const lesson=lessonById(lessonId),mastery=clamp(LM.lessonMastery(save,lessonId),0,100),due=Number(LM.dueQuestionsForLesson?.(save,lessonId,now)?.length)||0,mistakes=mistakeRows(save,lessonId,now),language=lesson?.language||mistakes[0]?.language||'ZH',deficit=Math.max(0,Number(requiredMastery||0)-mastery),mode=status==='missing'?'first':due>0?'srs':'replay';
 return{type:'lesson',status,mode,lessonId,language,title:lesson?.title||lessonId,mastery,requiredMastery:Number(requiredMastery)||0,deficit,due,mistakes,detail:status==='missing'?'Chưa hoàn thành Learning Unit bắt buộc':`Mastery còn thiếu ${deficit} điểm${due?` · ${due} câu SRS đến hạn`:''}`}
}
function stageRecovery(save,stage,now=Date.now()){
 normalize(save);if(!stage)return{version:VERSION,stage:null,ready:true,actions:[],reason:'no-stage'};const gate=LM.evaluateStage(save,stage),req=gate?.requirement||{},required=Number(req.RequiredMastery)||0;
 if(gate?.ready)return{version:VERSION,stage,gate,ready:true,rankBlocked:false,actions:[],summary:'Đã đủ điều kiện học thuật cho màn này'};
 if(gate?.rankOk===false)return{version:VERSION,stage,gate,ready:false,rankBlocked:true,actions:[{type:'rank',requiredRank:Number(req.Rank)||0,title:'Rank học thuật chưa đủ',detail:`Cần Rank ${Number(req.Rank)||0} trước khi vào màn`}],summary:'Cần nâng Rank học thuật'};
 const missing=new Set(gate?.missingLessons||[]),rows=[];
 for(const id of missing)rows.push(actionForLesson(save,id,required,'missing',now));
 for(const w of gate?.weak||[]){if(!w?.id||missing.has(w.id))continue;rows.push(actionForLesson(save,w.id,required,'weak',now))}
 rows.sort((a,b)=>(a.status==='missing'?0:1)-(b.status==='missing'?0:1)||b.deficit-a.deficit||b.mistakes.length-a.mistakes.length||a.lessonId.localeCompare(b.lessonId));
 return{version:VERSION,stage,gate,ready:false,rankBlocked:false,actions:rows.slice(0,3),summary:rows.length?`${rows.length} Learning Unit cần củng cố`:'Còn concept hoặc điều kiện học thuật chưa đạt'};
}
function currentStage(progress){
 if(!A||!Array.isArray(A.islands)||!progress)return null;const wins=progress.stageWins||{},maxIsland=Math.max(1,Number(progress.islandsUnlocked||progress.currentIsland||1)),start=Math.max(1,Math.min(maxIsland,Number(progress.currentIsland)||1));
 for(let islandId=start;islandId<=maxIsland;islandId++){const island=A.islandById?.(islandId)||A.islands.find(x=>Number(x.id)===islandId);if(!island)continue;for(const stage of island.stages||[]){const unlocked=Number(stage.number)===1||!!wins[`${stage.islandId}-${Number(stage.number)-1}`];if(unlocked&&!wins[stage.id])return stage}}
 const island=A.islandById?.(start)||A.islands.find(x=>Number(x.id)===start);return island?.stages?.find(s=>!wins[s.id])||null
}
function currentRecovery(save,now=Date.now()){const progress=window.POWDER_APP?.getAdventure?.()||null,stage=currentStage(progress);return stageRecovery(save,stage,now)}
function injectStyle(){if(!DOC||DOC.getElementById('powderMasteryRecoveryStyle2116'))return;const s=DOC.createElement('style');s.id='powderMasteryRecoveryStyle2116';s.textContent=`#learningMasteryRecovery2116{margin:0 0 16px;padding:14px;border:1px solid rgba(255,255,255,.13);border-radius:16px;background:rgba(8,12,24,.68)}#learningMasteryRecovery2116 .mr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}#learningMasteryRecovery2116 h3{margin:2px 0 4px;font-size:18px}#learningMasteryRecovery2116 p{margin:0;opacity:.8}#learningMasteryRecovery2116 .mr-actions{display:grid;gap:8px;margin-top:12px}#learningMasteryRecovery2116 .mr-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;border-radius:12px;background:rgba(255,255,255,.055)}#learningMasteryRecovery2116 .mr-row span{display:grid;gap:2px}#learningMasteryRecovery2116 .mr-row small{opacity:.72}#learningMasteryRecovery2116 button{min-height:44px}@media(max-width:640px){#learningMasteryRecovery2116 .mr-row{align-items:stretch;flex-direction:column}}`;DOC.head?.appendChild(s)}
function startAction(action){if(!action||action.type!=='lesson'||!action.lessonId)return false;window.POWDER_APP?.openLessonFromDungeon?.(action.lessonId);return true}
let lastSig='';function render(){
 if(!DOC)return;const learn=DOC.querySelector('#learnView'),save=window.POWDER_APP?.getSave?.();if(!learn||!save)return;injectStyle();let host=DOC.querySelector('#learningMasteryRecovery2116');if(!host){host=DOC.createElement('section');host.id='learningMasteryRecovery2116';const daily=DOC.querySelector('#learningDailyPlan2115'),coach=DOC.querySelector('#learningCoachV149');if(daily?.parentNode)daily.insertAdjacentElement('afterend',host);else if(coach?.parentNode)coach.parentNode.insertBefore(host,coach);else learn.prepend(host)}
 const r=currentRecovery(save),stage=r.stage;if(!stage){host.hidden=true;return}host.hidden=false;const sig=JSON.stringify([stage.id,r.ready,r.rankBlocked,...r.actions.map(a=>[a.lessonId,a.status,a.mastery,a.requiredMastery,a.due,a.mistakes.map(m=>m.id)])]);if(sig===lastSig)return;lastSig=sig;
 if(r.ready){host.innerHTML=`<div class="mr-head"><div><small>MASTERY RECOVERY · 21.1.6</small><h3>✓ ${esc(stage.name||stage.id)} đã đủ điều kiện</h3><p>Mastery và Learning Unit cho màn tiếp theo đã sẵn sàng.</p></div></div>`;return}
 const rows=r.actions.map((a,i)=>a.type==='rank'?`<div class="mr-row"><span><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></span></div>`:`<div class="mr-row"><span><b>${i+1}. ${esc(a.title)}</b><small>${a.status==='missing'?'Chưa học':`Mastery ${a.mastery}% / ${a.requiredMastery}%`} · ${a.due} câu đến hạn${a.mistakes.length?` · ${a.mistakes.length} lỗi ưu tiên`:''}</small></span><button class="btn secondary" type="button" data-mr2116-lesson="${esc(a.lessonId)}">Ôn bài này</button></div>`).join('');
 host.innerHTML=`<div class="mr-head"><div><small>GỠ KHÓA PHÓ BẢN · 21.1.6</small><h3>${esc(stage.name||stage.id)}</h3><p>${esc(r.summary)}</p></div></div><div class="mr-actions">${rows||'<div class="mr-row"><span><b>Cần củng cố concept</b><small>Tiếp tục các Learning Unit bắt buộc của màn này.</small></span></div>'}</div>`;
 host.querySelectorAll('[data-mr2116-lesson]').forEach(b=>b.addEventListener('click',()=>startAction({type:'lesson',lessonId:b.dataset.mr2116Lesson})))
}
let queued=false;function queueRender(){if(queued)return;queued=true;Promise.resolve().then(()=>{queued=false;render()})}
function boot(){if(!DOC)return;render();DOC.addEventListener('powder:local-save',queueRender);DOC.addEventListener('click',e=>{if(e.target?.closest?.('#lessonActionBtn,[data-close="lessonModal"],[data-adv-go-learn]'))queueRender()},true)}
window.POWDER_MASTERY_RECOVERY_V2116={version:VERSION,questionMeta,mistakeRows,actionForLesson,stageRecovery,currentStage,currentRecovery,render,startAction,designReferences:['Anki relearning/review separation','Moodle completion criteria','Kolibri learner progress'],rulesPreserved:'Canonical mastery, rewards, SRS intervals, Rank gates, Dungeon requirements and Combat rules unchanged'};
if(DOC){if(DOC.readyState==='loading')DOC.addEventListener('DOMContentLoaded',boot,{once:true});else boot()}
})();