(()=>{'use strict';
const VERSION='21.2.2',LM=window.POWDER_LEARNING_MASTER_V2,D=window.POWDER_DATA||{};
if(!LM||typeof LM.stageRequirement!=='function'||typeof LM.evaluateStage!=='function')return;
if(window.POWDER_DUNGEON_CURRICULUM_GATE_V2122?.version===VERSION)return;
// Design references: Moodle Restrict access, Open edX prerequisites and Kolibri mastery/progress.
// Powder keeps its canonical RequiredLessonIDs/RequiredConceptIDs/RequiredMastery/Rank/Curriculum contract.
const original={stageRequirement:LM.stageRequirement.bind(LM),evaluateStage:LM.evaluateStage.bind(LM)};
const clone=x=>JSON.parse(JSON.stringify(x)),uniq=a=>[...new Set((a||[]).map(String).filter(Boolean))];
const lesson=id=>(D.lessons||[]).find(l=>String(l?.id||'')===String(id||''))||null;
const lessonMeta=l=>l?(LM.unitMeta?.(l)||l.learningMeta||{}):null;
function auditRequirement(stage){
 const raw=original.stageRequirement(stage)||{},required=uniq(raw.RequiredLessonIDs),concepts=uniq(raw.RequiredConceptIDs),warnings=[],fatal=[];const optional=[],unknown=[],duplicates=[];
 const seen=new Set;for(const id of raw.RequiredLessonIDs||[]){const k=String(id);if(seen.has(k))duplicates.push(k);seen.add(k)}
 for(const id of required){const l=lesson(id);if(!l){unknown.push(id);continue}const m=lessonMeta(l)||{};if(m.Optional===true||String(m.Track||l.track||'core')!=='core')optional.push(id);if(Number(m.Rank||0)>Number(raw.Rank||0))warnings.push({type:'lesson-rank-above-stage',lessonId:id,lessonRank:Number(m.Rank||0),stageRank:Number(raw.Rank||0)})}
 if(unknown.length)fatal.push({type:'unknown-required-lessons',ids:unknown});if(duplicates.length)warnings.push({type:'duplicate-required-lessons',ids:uniq(duplicates)});if(optional.length)warnings.push({type:'optional-support-in-requirement',ids:optional,message:'Bài support/IT xuất hiện trong map nhưng không được phép chặn phó bản chính.'});
 const missingFields=['RequiredLessonIDs','RequiredConceptIDs','RequiredMastery','Rank','Curriculum'].filter(k=>!(k in raw));if(missingFields.length)fatal.push({type:'missing-contract-fields',fields:missingFields});
 if(!Array.isArray(raw.RequiredLessonIDs)||!Array.isArray(raw.RequiredConceptIDs)||!Number.isFinite(Number(raw.RequiredMastery))||!Number.isFinite(Number(raw.Rank))||!String(raw.Curriculum||'').trim())fatal.push({type:'invalid-contract-types'});
 return{stage:Number(stage)||0,ok:fatal.length===0,raw:clone(raw),coreRequiredLessonIDs:required.filter(id=>!optional.includes(id)&&!unknown.includes(id)),requiredConceptIDs:concepts,optionalSupportLessonIDs:optional,unknownLessonIDs:unknown,warnings,fatal};
}
function lessonName(id){const l=lesson(id);return l?.title||String(id)}
function blockerSummary(save,stage,evaluation,audit){const blockers=[];if(!evaluation.rankOk)blockers.push({type:'rank',title:`Cần Rank ${Number(evaluation.requirement?.Rank)||0}`,detail:`Rank hiện tại: ${Number(save?.rank)||0}.`});
 for(const id of evaluation.missingLessons||[])blockers.push({type:'lesson',lessonId:id,title:`Chưa học: ${lessonName(id)}`,detail:'Hoàn thành Learning Unit bắt buộc này trước.'});
 for(const row of evaluation.lowLessons||[]){const id=String(row?.lessonId||row?.id||''),current=Number(row?.mastery??row?.current??evaluation.currentLessonMastery?.[id]??0),need=Number(evaluation.requirement?.RequiredMastery)||0;blockers.push({type:'lesson-mastery',lessonId:id,title:`Mastery ${lessonName(id)}: ${Math.round(current)} / ${need}`,detail:'Ôn đúng bài này để đạt ngưỡng phó bản.'})}
 for(const id of evaluation.missingConcepts||[])blockers.push({type:'concept',conceptId:String(id),title:`Thiếu concept: ${id}`,detail:'Concept này chưa được mở từ các bài đã học.'});
 for(const row of evaluation.lowConcepts||[]){const id=String(row?.conceptId||row?.id||''),current=Number(row?.mastery??row?.current??0),need=Number(evaluation.requirement?.RequiredMastery)||0;blockers.push({type:'concept-mastery',conceptId:id,title:`Mastery concept ${id}: ${Math.round(current)} / ${need}`,detail:'Cần củng cố concept này trước khi vào màn.'})}
 if(audit.fatal.length)blockers.unshift({type:'configuration',title:'Dungeon map có lỗi cấu hình',detail:'Gate đã chặn cấu hình hỏng thay vì bắt người chơi làm điều kiện sai.'});return blockers}
function recommendedAction(save,stage,blockers){const first=blockers.find(b=>b.type!=='configuration');if(!first)return null;const recovery=window.POWDER_MASTERY_RECOVERY_V2116?.currentRecovery?.(save);if(recovery?.stage===Number(stage)&&Array.isArray(recovery.actions)&&recovery.actions.length)return{type:'recovery',action:recovery.actions[0],title:recovery.actions[0]?.title||'Gỡ khóa phó bản'};if(first.lessonId)return{type:'lesson',lessonId:first.lessonId,title:`Mở ${lessonName(first.lessonId)}`};return{type:first.type,title:first.title}}
function safeRequirement(stage){const audit=auditRequirement(stage);return{...audit.raw,CurriculumAudit:audit,CoreRequiredLessonIDs:[...audit.coreRequiredLessonIDs]}}
function safeEvaluate(save,stage){const evaluation=original.evaluateStage(save,stage)||{},audit=auditRequirement(stage),blockers=blockerSummary(save,stage,evaluation,audit),configFatal=audit.fatal.length>0;const ready=!!evaluation.ready&&!configFatal;return{...evaluation,ready,requirement:{...(evaluation.requirement||audit.raw),CurriculumAudit:audit,CoreRequiredLessonIDs:[...audit.coreRequiredLessonIDs]},curriculumAudit:audit,blockers,nextAction:recommendedAction(save,stage,blockers),summary:ready?'Đã đủ điều kiện phó bản.':blockers[0]?.title||'Chưa đủ điều kiện phó bản.',configurationWarnings:audit.warnings}}
function auditStage(save,stage){const before=JSON.stringify(save||{}),result=safeEvaluate(save,stage),after=JSON.stringify(save||{});return{version:VERSION,stage:Number(stage)||0,mutatedSave:before!==after,result,contract:['RequiredLessonIDs','RequiredConceptIDs','RequiredMastery','Rank','Curriculum']}}
LM.stageRequirement=safeRequirement;LM.evaluateStage=safeEvaluate;
window.POWDER_DUNGEON_CURRICULUM_GATE_V2122={version:VERSION,auditRequirement,safeRequirement,safeEvaluate,auditStage,original,designReferences:['Moodle Restrict access','Open edX prerequisites','Kolibri mastery/progress'],rulesPreserved:'Optional/support IT never blocks core dungeon; RequiredLessonIDs/RequiredConceptIDs/RequiredMastery/Rank/Curriculum preserved; Combat/rewards unchanged'};
})();