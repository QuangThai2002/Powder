(()=>{'use strict';
const VERSION='21.1.5',LM=window.POWDER_LEARNING_MASTER_V2,D=window.POWDER_DATA,SRS=window.POWDER_SRS_INTELLIGENCE_V2114||null,DOC=typeof document==='object'?document:null;
if(!LM||!D||typeof LM.todaySummary!=='function'||typeof LM.dailyBossStatus!=='function')return;
if(window.POWDER_DAILY_STUDY_ORCHESTRATOR_V2115?.version===VERSION)return;
// Design references: Anki review queue prioritization, Moodle activity completion,
// and Kolibri learner progress. Powder keeps its own canonical 4 ZH / 2 EN daily
// requirement, rewards, SRS intervals, rank curriculum and Boss rules unchanged.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0)),esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const difficultyWeight={easy:0,standard:1,hard:2,deep:3};
function normalize(save){LM.normalizeSave?.(save);return save}
function unitMeta(lesson){return LM.unitMeta?.(lesson)||lesson?.learningMeta||{Rank:Number(lesson?.rank)||0,Language:lesson?.language||'ZH',Difficulty:lesson?.difficulty||'standard',Optional:!!lesson?.optional,Core:!lesson?.optional}}
function dueList(save,language,now=Date.now()){normalize(save);const rows=SRS?.rankDueQuestions?.(save,language,now)||LM.dueQuestions?.(save,language,now)||[];return Array.isArray(rows)?rows:[]}
function dueStats(save,language,now=Date.now()){
 const due=dueList(save,language,now),intel=SRS?.reviewUrgency?.(save,language,now);let urgency=Number(intel?.urgency)||0;
 if(!urgency&&due.length){const top=due.slice(0,8),sum=top.reduce((a,q)=>{const st=save?.questionProgress?.[q.id]||{},over=Math.max(0,now-Number(st.nextReview||now))/60000,mastery=clamp(st.mastery,0,100);return a+Math.min(36,Math.log2(1+over/5)*6)+(100-mastery)*.4},0);urgency=Math.round((sum/Math.max(1,top.length)+Math.min(24,due.length*2))*10)/10}
 return{language,due:due.length,urgency,questions:due};
}
function weakDimensions(save){normalize(save);const src=save?.learning?.academicDimensionMastery||{},labels={meaning:'Từ vựng / nghĩa',hanzi:'Hán tự',grammar:'Ngữ pháp',reading:'Đọc hiểu',writing:'Viết',context:'Ngữ cảnh',vocabulary:'Từ vựng'};const out=[];for(const lang of ['ZH','EN'])for(const [dimension,value] of Object.entries(src[lang]||{})){const v=clamp(value,0,100);out.push({language:lang,dimension,label:labels[dimension]||dimension,mastery:v,weakness:100-v})}return out.sort((a,b)=>b.weakness-a.weakness||a.language.localeCompare(b.language)||a.dimension.localeCompare(b.dimension))}
function dailySrsDone(daily,language){return (daily?.units||[]).some(x=>x?.language===language&&x?.mode==='srs'&&!x?.lessonId)}
function lessonCandidates(save,language,{includeDone=false,dueOnly=false}={}){
 normalize(save);const rank=Number(save?.rank)||0,done=new Set(save?.lessonsDone||[]),rows=[];
 for(let index=0;index<(D.lessons||[]).length;index++){
  const lesson=D.lessons[index],m=unitMeta(lesson);if((m.Language||lesson.language)!==language||m.Optional||Number(m.Rank)>rank)continue;
  const isDone=done.has(lesson.id);if(!includeDone&&isDone)continue;if(includeDone&&!isDone)continue;
  let due=0;if(dueOnly){due=Number(LM.dueQuestionsForLesson?.(save,lesson.id)?.length)||0;if(!due)continue}
  rows.push({lesson,meta:m,index,due,isDone,rankGap:Math.max(0,rank-Number(m.Rank||0))});
 }
 rows.sort((a,b)=>a.rankGap-b.rankGap||(dueOnly?b.due-a.due:0)||(difficultyWeight[a.meta.Difficulty]||0)-(difficultyWeight[b.meta.Difficulty]||0)||a.index-b.index);return rows;
}
function excluded(exclude,id){return exclude.has(id)||exclude.has(`lesson:${id}`)}
function nextLesson(save,language,exclude=new Set()){return lessonCandidates(save,language).find(x=>!excluded(exclude,x.lesson.id))?.lesson||null}
function dueLesson(save,language,exclude=new Set()){return lessonCandidates(save,language,{includeDone:true,dueOnly:true}).find(x=>!excluded(exclude,x.lesson.id))?.lesson||null}
function langPriority(save,daily,stats){
 const need={ZH:Math.max(0,Number(daily?.needZh||4)-Number(daily?.zh||0)),EN:Math.max(0,Number(daily?.needEn||2)-Number(daily?.en||0))};
 const target={ZH:Number(daily?.needZh||4)||4,EN:Number(daily?.needEn||2)||2};const score=lang=>need[lang]<=0?-1e9:(need[lang]/target[lang])*90+(stats[lang]?.urgency||0)+(stats[lang]?.due?18:0)+(lang==='ZH'?1:0);return score('EN')>score('ZH')?'EN':'ZH';
}
function actionForLanguage(save,daily,stats,language){
 if((stats[language]?.due||0)>0&&!dailySrsDone(daily,language))return{type:'reviewBatch',language,title:`Ôn SRS ${language==='ZH'?'Tiếng Trung':'English'}`,detail:`${stats[language].due} câu đến hạn · ưu tiên câu yếu và quá hạn`,unitPotential:1};
 const lesson=nextLesson(save,language);if(lesson)return{type:'lesson',language,lessonId:lesson.id,title:lesson.title||'Bài học tiếp theo',detail:'Learning Unit mới đúng chương trình hiện tại',unitPotential:1};
 const due=dueLesson(save,language);if(due)return{type:'lesson',language,lessonId:due.id,title:`Ôn lại: ${due.title||due.id}`,detail:'Bài đã học có câu SRS đến hạn',unitPotential:1};
 return{type:'none',language,title:'Chưa có Learning Unit phù hợp',detail:'Cần thêm nội dung đã học hoặc bài mới trong rank hiện tại',unitPotential:0};
}
function knowledgeAction(save){
 const rank=Number(save?.rank)||0,done=new Set(save?.lessonsDone||[]),rows=[];for(let i=0;i<(D.lessons||[]).length;i++){const l=D.lessons[i],m=unitMeta(l);if(m.Optional||Number(m.Rank)>rank||done.has(l.id))continue;rows.push({l,m,i,exact:Number(m.Rank)===rank?1:0,reward:Number(m.Reward?.knowledge)||0})}
 rows.sort((a,b)=>b.exact-a.exact||b.reward-a.reward||(difficultyWeight[b.m.Difficulty]||0)-(difficultyWeight[a.m.Difficulty]||0)||a.i-b.i);const top=rows[0];if(top)return{type:'lesson',language:top.l.language,lessonId:top.l.id,title:top.l.title||'Bài học tiếp theo',detail:`Ưu tiên kiếm Knowledge · ${top.reward||'có'} Knowledge khi đạt điều kiện thưởng`,unitPotential:0};
 const weak=weakDimensions(save)[0];return{type:'focus',language:weak?.language||'ZH',title:'Củng cố điểm yếu',detail:weak?`${weak.label} ${weak.mastery}%`:'Không còn bài mới phù hợp trong rank hiện tại',unitPotential:0};
}
function dailyPlan(save,now=Date.now()){
 normalize(save);const daily=LM.todaySummary(save),boss=LM.dailyBossStatus(save,Number(save?.rank)||0),stats={ZH:dueStats(save,'ZH',now),EN:dueStats(save,'EN',now)},needZh=Math.max(0,Number(daily.needZh||4)-Number(daily.zh||0)),needEn=Math.max(0,Number(daily.needEn||2)-Number(daily.en||0));let action;
 if(needZh||needEn){const first=langPriority(save,daily,stats);action=actionForLanguage(save,daily,stats,first);if(action.type==='none'){const other=first==='ZH'?'EN':'ZH';action=actionForLanguage(save,daily,stats,other)}}
 else if(!boss.ready&&Number(boss.knowledge||0)<Number(boss.cost||0))action=knowledgeAction(save);
 else if(boss.ready&&!boss.paid)action={type:'boss',title:'Daily Boss đã sẵn sàng',detail:`Đủ 6 Learning Unit và ${boss.cost} Knowledge`,unitPotential:0};
 else{const weak=weakDimensions(save)[0];action=weak?{type:'focus',language:weak.language,title:`Củng cố ${weak.label}`,detail:`${weak.language==='ZH'?'Tiếng Trung':'English'} · mastery ${weak.mastery}%`,unitPotential:0}:{type:'complete',title:'Mục tiêu hôm nay đã hoàn tất',detail:'Có thể học thêm hoặc chơi tự do',unitPotential:0}}
 return{version:VERSION,now,daily,boss,due:{ZH:{due:stats.ZH.due,urgency:stats.ZH.urgency},EN:{due:stats.EN.due,urgency:stats.EN.urgency}},need:{ZH:needZh,EN:needEn,total:Math.max(0,Number(daily.needTotal||6)-Number(daily.total||0))},weakest:weakDimensions(save)[0]||null,action};
}
function sessionBlueprint(save,now=Date.now()){
 normalize(save);const plan=dailyPlan(save,now),daily=plan.daily,stats={ZH:dueStats(save,'ZH',now),EN:dueStats(save,'EN',now)},steps=[],used=new Set,remaining={ZH:plan.need.ZH,EN:plan.need.EN};
 const add=(x)=>{if(!x||steps.length>=6)return false;const key=x.lessonId?`lesson:${x.lessonId}`:`${x.type}:${x.language||''}`;if(used.has(key))return false;used.add(key);steps.push({...x,step:steps.length+1});return true};
 for(const lang of ['ZH','EN'])if(remaining[lang]>0&&(stats[lang]?.due||0)>0&&!dailySrsDone(daily,lang)){if(add({type:'reviewBatch',language:lang,title:`Ôn SRS ${lang==='ZH'?'Tiếng Trung':'English'}`,detail:`${stats[lang].due} câu đến hạn`,unitPotential:1}))remaining[lang]--}
 for(const lang of ['ZH','EN'])while(remaining[lang]>0&&steps.length<6){const lesson=nextLesson(save,lang,used);if(lesson){add({type:'lesson',language:lang,lessonId:lesson.id,title:lesson.title||lesson.id,detail:'Bài mới',unitPotential:1});remaining[lang]--;continue}const due=dueLesson(save,lang,used);if(due){add({type:'lesson',language:lang,lessonId:due.id,title:`Ôn lại: ${due.title||due.id}`,detail:'Bài có SRS đến hạn',unitPotential:1});remaining[lang]--;continue}break}
 if(!remaining.ZH&&!remaining.EN&&steps.length<6){const boss=LM.dailyBossStatus(save,Number(save?.rank)||0);if(boss.ready&&!boss.paid)add({type:'boss',title:'Daily Boss',detail:`Sẵn sàng · phí ${boss.cost} Knowledge`,unitPotential:0});else if(!boss.ready&&Number(boss.knowledge||0)<Number(boss.cost||0))add(knowledgeAction(save))}
 return{version:VERSION,steps:steps.slice(0,6),remaining,projected:{ZH:Number(daily.zh||0)+Math.max(0,plan.need.ZH-remaining.ZH),EN:Number(daily.en||0)+Math.max(0,plan.need.EN-remaining.EN)},boss:plan.boss};
}
function injectStyle(){if(!DOC||DOC.getElementById('powderDailyPlanStyle2115'))return;const s=DOC.createElement('style');s.id='powderDailyPlanStyle2115';s.textContent=`#learningDailyPlan2115{margin:12px 0 16px;padding:14px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(8,12,24,.7)}#learningDailyPlan2115 .ldp-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}#learningDailyPlan2115 .ldp-head h3{margin:2px 0 4px;font-size:18px}#learningDailyPlan2115 .ldp-head p{margin:0;opacity:.82}#learningDailyPlan2115 .ldp-progress{display:grid;grid-template-columns:repeat(3,minmax(86px,1fr));gap:8px;margin-top:12px}#learningDailyPlan2115 .ldp-stat{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.07)}#learningDailyPlan2115 .ldp-stat b{display:block;font-size:15px}#learningDailyPlan2115 .ldp-stat small{opacity:.72}#learningDailyPlan2115 .ldp-next{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:10px;border-radius:12px;background:rgba(255,255,255,.055)}#learningDailyPlan2115 .ldp-next span{display:grid;gap:2px}#learningDailyPlan2115 .ldp-next small{opacity:.72}#learningDailyPlan2115 button{min-height:44px}@media(max-width:640px){#learningDailyPlan2115 .ldp-progress{grid-template-columns:1fr 1fr}#learningDailyPlan2115 .ldp-next{align-items:stretch;flex-direction:column}}`;DOC.head?.appendChild(s)}
function actionButton(action){if(!action||['none','focus','complete'].includes(action.type))return'';const label=action.type==='reviewBatch'?'Ôn ngay':action.type==='lesson'?'Học ngay':'Mở Phiêu lưu';return`<button class="btn primary" type="button" data-ldp2115-action="${esc(action.type)}" ${action.language?`data-ldp2115-lang="${esc(action.language)}"`:''} ${action.lessonId?`data-ldp2115-lesson="${esc(action.lessonId)}"`:''}>${label}</button>`}
let lastSig='';
function render(){if(!DOC)return;const learn=DOC.querySelector('#learnView'),save=window.POWDER_APP?.getSave?.();if(!learn||!save)return;injectStyle();let host=DOC.querySelector('#learningDailyPlan2115');if(!host){host=DOC.createElement('section');host.id='learningDailyPlan2115';const coach=DOC.querySelector('#learningCoachV149'),summary=DOC.querySelector('#learningSummary');if(coach?.parentNode)coach.parentNode.insertBefore(host,coach);else summary?.insertAdjacentElement('afterend',host);if(!host.isConnected)learn.prepend(host)}const p=dailyPlan(save),a=p.action,sig=JSON.stringify([p.daily.total,p.daily.zh,p.daily.en,p.boss.ready,p.boss.paid,p.boss.knowledge,p.boss.cost,p.due.ZH.due,p.due.EN.due,a.type,a.language,a.lessonId,p.weakest?.dimension,p.weakest?.mastery]);if(sig===lastSig)return;lastSig=sig;host.innerHTML=`<div class="ldp-head"><div><small>KẾ HOẠCH HÔM NAY · 21.1.5</small><h3>${esc(a.title)}</h3><p>${esc(a.detail)}</p></div>${actionButton(a)}</div><div class="ldp-progress"><div class="ldp-stat"><b>${p.daily.zh}/${p.daily.needZh||4} Trung</b><small>Còn ${p.need.ZH} unit</small></div><div class="ldp-stat"><b>${p.daily.en}/${p.daily.needEn||2} Anh</b><small>Còn ${p.need.EN} unit</small></div><div class="ldp-stat"><b>${Number(p.boss.knowledge||0)}/${Number(p.boss.cost||0)} Knowledge</b><small>${p.boss.ready?'Boss sẵn sàng':'Điều kiện Boss'}</small></div></div><div class="ldp-next"><span><b>SRS đến hạn: ${p.due.ZH.due} Trung · ${p.due.EN.due} Anh</b><small>${p.weakest?`Điểm yếu nhất: ${p.weakest.language==='ZH'?'Trung':'Anh'} · ${esc(p.weakest.label)} ${p.weakest.mastery}%`:'Chưa đủ dữ liệu mastery'}</small></span></div>`;host.querySelector('[data-ldp2115-action]')?.addEventListener('click',e=>startAction({type:e.currentTarget.dataset.ldp2115Action,language:e.currentTarget.dataset.ldp2115Lang||null,lessonId:e.currentTarget.dataset.ldp2115Lesson||null}))}
function startAction(action){if(!action)return false;if(action.type==='reviewBatch'){window.POWDER_REVIEW_LANGUAGE_V149=action.language||null;const b=DOC?.querySelector('#reviewDueBtn');if(b){b.click();return true}}if(action.type==='lesson'&&action.lessonId){window.POWDER_APP?.openLessonFromDungeon?.(action.lessonId);return true}if(action.type==='boss'){const b=DOC?.querySelector('[data-view="adventure"],[data-nav="adventure"],#navAdventure,#adventureTab');if(b){b.click();return true}}return false}
let queued=false;function queueRender(){if(queued)return;queued=true;Promise.resolve().then(()=>{queued=false;render()})}
function boot(){if(!DOC)return;render();DOC.addEventListener('powder:local-save',queueRender);DOC.addEventListener('click',e=>{if(e.target?.closest?.('#lessonActionBtn,#reviewDueBtn,[data-close="lessonModal"]'))queueRender()},true)}
window.POWDER_DAILY_STUDY_ORCHESTRATOR_V2115={version:VERSION,dailyPlan,sessionBlueprint,dueStats,weakDimensions,render,startAction,designReferences:['Anki review queue','Moodle activity completion','Kolibri learner progress'],rulesPreserved:'4 ZH / 2 EN daily units; canonical rewards, SRS intervals, rank curriculum and Boss rules unchanged'};
if(DOC){if(DOC.readyState==='loading')DOC.addEventListener('DOMContentLoaded',boot,{once:true});else boot()}
})();
