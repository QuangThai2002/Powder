import fs from'node:fs';import path from'node:path';import vm from'node:vm';
const root=path.resolve(process.argv[2]||'.'),src=fs.readFileSync(path.join(root,'js/learning-mastery-recovery-v2116.js'),'utf8'),chain=fs.readFileSync(path.join(root,'js/learning-srs-intelligence-v2114.js'),'utf8'),out={version:'21.1.6',checks:{},details:{}},ok=(k,v,d)=>{out.checks[k]=!!v;if(d!==undefined)out.details[k]=d};
const now=Date.UTC(2026,7,24,13),questions=[
{id:'q1',lessonId:'l1',language:'ZH',prompt:'错题一',learningMeta:{LessonID:'l1',ConceptID:'c1',SkillType:'Grammar',Language:'ZH'}},
{id:'q1v',lessonId:'l1',language:'ZH',prompt:'同概念变体',learningMeta:{LessonID:'l1',ConceptID:'c1',SkillType:'Grammar',Language:'ZH'}},
{id:'q2',lessonId:'l1',language:'ZH',prompt:'阅读错题',learningMeta:{LessonID:'l1',ConceptID:'c2',SkillType:'Reading',Language:'ZH'}},
{id:'q3',lessonId:'l2',language:'EN',prompt:'English error',learningMeta:{LessonID:'l2',ConceptID:'c3',SkillType:'Grammar',Language:'EN'}}];
const lessons=[{id:'l1',title:'Bài Trung bắt buộc',language:'ZH',questions:questions.filter(q=>q.lessonId==='l1')},{id:'l2',title:'Bài Anh bắt buộc',language:'EN',questions:questions.filter(q=>q.lessonId==='l2')}],D={lessons,questions};
const stage1={id:'1-1',islandId:1,number:1,name:'Màn mở đầu',req:{Rank:0,RequiredMastery:80,RequiredLessonIDs:['l1']}},stage2={id:'1-2',islandId:1,number:2,name:'Màn kiểm tra',req:{Rank:0,RequiredMastery:80,RequiredLessonIDs:['l1','l2']}},stage3={id:'1-3',islandId:1,number:3,name:'Màn Rank',req:{Rank:1,RequiredMastery:80,RequiredLessonIDs:['l1']}};
const A={islands:[{id:1,stages:[stage1,stage2,stage3]}],islandById:id=>id===1?{id:1,stages:[stage1,stage2,stage3]}:null};
const save={rank:0,lessonsDone:['l1'],lessonMastery:{l1:58,l2:0},battleMistakes:['q1','q1v','q2'],questionProgress:{q1:{seen:4,wrong:3,mastery:45,streak:0,nextReview:now-60000},q1v:{seen:3,wrong:2,mastery:55,streak:0,nextReview:now-60000},q2:{seen:3,wrong:1,mastery:62,streak:1,nextReview:now+60000},q3:{seen:2,wrong:1,mastery:70,streak:0,nextReview:now-60000}},learning:{recentQuestionIds:['q1v']}};
const LM={normalizeSave:()=>{},lessonMastery:(s,id)=>Number(s.lessonMastery[id]||0),dueQuestionsForLesson:(s,id,t=Date.now())=>questions.filter(q=>q.lessonId===id&&Number(s.questionProgress[q.id]?.seen)>0&&Number(s.questionProgress[q.id]?.nextReview)<=t),questionMeta:q=>q.learningMeta||{},evaluateStage:(s,stage)=>{const req=stage.req,rankOk=Number(s.rank)>=req.Rank,missingLessons=req.RequiredLessonIDs.filter(id=>!s.lessonsDone.includes(id)),masteries=req.RequiredLessonIDs.map(id=>({id,mastery:Number(s.lessonMastery[id]||0)})),weak=masteries.filter(x=>x.mastery<req.RequiredMastery);return{ready:rankOk&&!missingLessons.length&&!weak.length,rankOk,missingLessons,weak,missingConcepts:[],masteries,requirement:{...req}}}};
const progress={currentIsland:1,islandsUnlocked:1,stageWins:{'1-1':true}},ctx={window:{POWDER_LEARNING_MASTER_V2:LM,POWDER_DATA:D,POWDER_ADVENTURE_DATA:A,POWDER_APP:{getAdventure:()=>progress}},Date,Math,Number,String,Array,Object,Set,Map,JSON,Promise,console};ctx.window.window=ctx.window;vm.createContext(ctx);vm.runInContext(src,ctx);const R=ctx.window.POWDER_MASTERY_RECOVERY_V2116;
ok('runtimeAvailable',R?.version==='21.1.6');
const before=JSON.stringify(save),m=R.mistakeRows(save,'l1',now);ok('mistakePriority',m.length===2&&m[0].id==='q1'&&new Set(m.map(x=>x.concept)).size===m.length,m);
ok('readOnlyMistakeAnalysis',JSON.stringify(save)===before);
const rec=R.currentRecovery(save,now);ok('currentStageResolution',rec.stage?.id==='1-2',rec.stage?.id);
ok('missingLessonFirst',rec.actions[0]?.lessonId==='l2'&&rec.actions[0]?.status==='missing',rec.actions);
ok('weakLessonIncluded',rec.actions.some(x=>x.lessonId==='l1'&&x.status==='weak'),rec.actions);
ok('boundedActions',rec.actions.length<=3,rec.actions.length);
ok('readOnlyRecovery',JSON.stringify(save)===before);
save.lessonsDone.push('l2');save.lessonMastery.l1=82;save.lessonMastery.l2=85;const ready=R.stageRecovery(save,stage2,now);ok('readyState',ready.ready===true&&ready.actions.length===0,ready);
const rank=R.stageRecovery(save,stage3,now);ok('rankBlock',rank.rankBlocked===true&&rank.actions[0]?.type==='rank',rank.actions);
ok('noCoreMutation',!/(LM\.evaluateStage|LM\.lessonMastery)\s*=/.test(src));
ok('noContinuousPolling',!src.includes('setInterval')&&!src.includes('MutationObserver')&&!src.includes('requestAnimationFrame')&&!src.includes('setTimeout('));
ok('noHeavyBlur',!src.includes('backdrop-filter'));
ok('noEconomyCombatMutation',!/(knowledge|coins|powCand|damageTarget|executeAction|RequiredMastery)\s*[+\-*/]?=/.test(src));
ok('referenceProjects',Array.isArray(R.designReferences)&&R.designReferences.length===3,R.designReferences);
ok('chainFromSrs',chain.includes('activateMasteryRecovery2116')&&chain.includes('learning-mastery-recovery-v2116.js?v=2116')&&chain.includes('powderMasteryRecoveryRuntime2116'));
out.passed=Object.values(out.checks).every(Boolean);out.totalChecks=Object.keys(out.checks).length;fs.mkdirSync(path.join(root,'artifacts/mastery-recovery-v2116'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/mastery-recovery-v2116/result.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(!out.passed)process.exit(1);
