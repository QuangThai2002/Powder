(()=>{'use strict';
const VERSION='21.1.4',LM=window.POWDER_LEARNING_MASTER_V2,E=window.POWDER_ENGINE,D=window.POWDER_DATA;
if(!LM||!E||!D||typeof LM.dueQuestions!=='function'||typeof E.selectQuestions!=='function')return;
if(window.POWDER_SRS_INTELLIGENCE_V2114?.version===VERSION)return;
// Design references: Anki FSRS, Open Spaced Repetition FSRS/DSR and RemNote FSRS.
// Powder keeps its canonical 5m/3h/1d/3d/7d/14d/30d schedule. This layer only
// prioritizes already-due reviews and never changes rewards, Boss quotas or Combat rules.
const original={dueQuestions:LM.dueQuestions.bind(LM),chooseReviewLanguage:typeof LM.chooseReviewLanguage==='function'?LM.chooseReviewLanguage.bind(LM):null,selectQuestions:E.selectQuestions.bind(E)};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0)),clone=x=>JSON.parse(JSON.stringify(x));
const qid=q=>String(q?.id||''),langOf=q=>q?.language==='EN'?'EN':'ZH';
function qstate(save,q){return save?.questionProgress?.[qid(q)]||null}
function meta(q){const a=q?.academicMeta||{},l=q?.learningMeta||{};return{concept:String(a.sourceUnitId||l.ConceptID||qid(q)),lesson:String(q?.lessonId||a.sourceLessonId||l.LessonID||''),family:String(a.family||l.SkillType||q?.type||'General'),dimension:String(a.dimension||l.SkillType||'').toLowerCase()}}
function dimensionMastery(save,q){const m=meta(q),lang=langOf(q),raw=save?.learning?.academicDimensionMastery?.[lang]?.[m.dimension];return Number.isFinite(Number(raw))?clamp(raw,0,100):50}
function recentPenalty(save,id){const rows=Array.isArray(save?.learning?.recentQuestionIds)?save.learning.recentQuestionIds:[],at=rows.lastIndexOf(id);if(at<0)return 0;const distance=rows.length-1-at;return distance>=24?0:Math.max(0,24-distance)}
function priority(save,q,now=Date.now()){
 const s=qstate(save,q);if(!s||Number(s.seen)<=0||Number(s.nextReview||0)>now)return-1e9;
 const overdueMinutes=Math.max(0,(now-Number(s.nextReview||0))/60000),overdue=Math.min(38,Math.log2(1+overdueMinutes/5)*7);
 const mastery=clamp(s.mastery,0,100),weak=(100-mastery)*.44,seen=Math.max(1,Number(s.seen)||1),lapse=clamp((Number(s.wrong)||0)/seen,0,1)*20+Math.min(10,(Number(s.wrong)||0)*1.5);
 const dimWeak=(100-dimensionMastery(save,q))*.14,forgotten=Number(s.streak||0)===0&&Number(s.wrong||0)>0?8:0,recent=recentPenalty(save,qid(q));
 return overdue+weak+lapse+dimWeak+forgotten-recent;
}
function rankDueQuestions(save,language=null,now=Date.now()){
 const canonical=original.dueQuestions(save,language,now)||[];
 return canonical.map((q,i)=>({q,i,score:priority(save,q,now)})).sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.q);
}
function selectReview(save,questions,count=8,now=Date.now()){
 const n=Math.max(0,Math.min(Number(count)||0,(questions||[]).length));if(!n)return[];
 const seen=new Set,ranked=[];for(const q of questions||[]){const id=qid(q);if(!id||seen.has(id))continue;seen.add(id);ranked.push({q,score:priority(save,q,now)})}ranked.sort((a,b)=>b.score-a.score||qid(a.q).localeCompare(qid(b.q)));
 const out=[],used=new Set,concepts=new Map,lessons=new Map,families=new Map;
 const take=(row,{conceptCap=2,lessonCap=3,familyCap=3}={})=>{const q=row?.q,id=qid(q);if(!id||used.has(id))return false;const m=meta(q);if((concepts.get(m.concept)||0)>=conceptCap||(lessons.get(m.lesson)||0)>=lessonCap||(families.get(m.family)||0)>=familyCap)return false;used.add(id);concepts.set(m.concept,(concepts.get(m.concept)||0)+1);lessons.set(m.lesson,(lessons.get(m.lesson)||0)+1);families.set(m.family,(families.get(m.family)||0)+1);out.push(clone(q));return true};
 for(const row of ranked){if(out.length>=n)break;take(row)}
 if(out.length<n)for(const row of ranked){if(out.length>=n)break;take(row,{conceptCap:2,lessonCap:4,familyCap:5})}
 if(out.length<n)for(const row of ranked){if(out.length>=n)break;const id=qid(row.q);if(!used.has(id)){used.add(id);out.push(clone(row.q))}}
 return out.slice(0,n);
}
function isDueOnly(save,questions,now=Date.now()){return Array.isArray(questions)&&questions.length>0&&questions.every(q=>{const s=qstate(save,q);return !!s&&Number(s.seen)>0&&Number(s.nextReview||0)<=now})}
function reviewUrgency(save,language,now=Date.now()){const due=rankDueQuestions(save,language,now),top=due.slice(0,Math.min(8,due.length)),avg=top.length?top.reduce((a,q)=>a+Math.max(0,priority(save,q,now)),0)/top.length:0;return{language,due:due.length,urgency:Math.round((avg+Math.min(30,due.length*2))*10)/10,topScore:top.length?Math.round(priority(save,top[0],now)*10)/10:0}}
function chooseReviewLanguage(save,now=Date.now()){
 const zh=reviewUrgency(save,'ZH',now),en=reviewUrgency(save,'EN',now);if(!zh.due&&!en.due)return original.chooseReviewLanguage?original.chooseReviewLanguage(save):'ZH';if(!zh.due)return'EN';if(!en.due)return'ZH';
 const daily=typeof LM.todaySummary==='function'?LM.todaySummary(save):{zh:0,en:0},zhDef=Math.max(0,4-(Number(daily?.zh)||0))/4,enDef=Math.max(0,2-(Number(daily?.en)||0))/2;
 const zhScore=zh.urgency+zhDef*80,enScore=en.urgency+enDef*80;if(Math.abs(zhScore-enScore)<.001)return zh.due>=en.due?'ZH':'EN';return zhScore>enScore?'ZH':'EN';
}
function patchedSelectQuestions(save,questions,count,options={}){const now=Number(options?.now)||Date.now(),n=Math.max(0,Number(count)||0);if(n>0&&n<=8&&isDueOnly(save,questions,now))return selectReview(save,questions,n,now);return original.selectQuestions(save,questions,count,options)}
function audit(save,now=Date.now()){const zh=reviewUrgency(save,'ZH',now),en=reviewUrgency(save,'EN',now),language=chooseReviewLanguage(save,now),due=rankDueQuestions(save,language,now),sample=selectReview(save,due,Math.min(8,due.length),now);return{version:VERSION,canonicalIntervals:[...(D.learningConfig?.intervalsMinutes||[])],language,ZH:zh,EN:en,sample:sample.map(q=>{const m=meta(q),s=qstate(save,q)||{};return{id:qid(q),lesson:m.lesson,concept:m.concept,family:m.family,score:Math.round(priority(save,q,now)*10)/10,mastery:Number(s.mastery)||0,wrong:Number(s.wrong)||0,nextReview:Number(s.nextReview)||0}})}}
function activateDailyStudy2115(){if(typeof document!=='object'||window.POWDER_DAILY_STUDY_ORCHESTRATOR_V2115||document.getElementById('powderDailyStudyRuntime2115'))return false;const s=document.createElement('script');s.id='powderDailyStudyRuntime2115';s.src='js/learning-daily-study-orchestrator-v2115.js?v=2115';s.async=true;document.head.appendChild(s);return true}
function activateMasteryRecovery2116(){if(typeof document!=='object'||window.POWDER_MASTERY_RECOVERY_V2116||document.getElementById('powderMasteryRecoveryRuntime2116'))return false;const s=document.createElement('script');s.id='powderMasteryRecoveryRuntime2116';s.src='js/learning-mastery-recovery-v2116.js?v=2116';s.async=true;document.head.appendChild(s);return true}
function activateAdaptiveQuestionMix2117(){if(typeof document!=='object'||window.POWDER_ADAPTIVE_QUESTION_MIX_V2117||document.getElementById('powderAdaptiveQuestionMixRuntime2117'))return false;const s=document.createElement('script');s.id='powderAdaptiveQuestionMixRuntime2117';s.src='js/learning-adaptive-question-mix-v2117.js?v=2117';s.async=true;document.head.appendChild(s);return true}
LM.dueQuestions=rankDueQuestions;LM.chooseReviewLanguage=chooseReviewLanguage;LM.srs={...(LM.srs||{}),intelligenceVersion:VERSION,priority:'overdue + weakness + lapse + dimension weakness - recent repetition',eligibility:'canonical due set unchanged'};E.selectQuestions=patchedSelectQuestions;
window.POWDER_SRS_INTELLIGENCE_V2114={version:VERSION,priority,rankDueQuestions,selectReview,chooseReviewLanguage,reviewUrgency,audit,original,activateDailyStudy2115,activateMasteryRecovery2116,activateAdaptiveQuestionMix2117};
activateDailyStudy2115();
activateMasteryRecovery2116();
activateAdaptiveQuestionMix2117();
})();