import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath='js/learning-session-continuity-v2126.js';
const parentPath='js/learning-performance-hardening-v2125.js';
const src=fs.readFileSync(runtimePath,'utf8');
const parent=fs.readFileSync(parentPath,'utf8');
const checks=[];
const check=(name,ok)=>{if(!ok)throw new Error(`21.2.6 gate failed: ${name}`);checks.push(name)};

check('runtime version',src.includes("VERSION='21.2.6'"));
check('local UI checkpoint key',src.includes('powder_learning_continuity_v2126'));
check('lesson rank/core guard',src.includes('lessonAllowed')&&src.includes('m.Optional'));
check('stale day guard',src.includes('row.day!==dayKey()'));
check('completed lesson expiry',src.includes('done&&dueForLesson'));
check('SRS due expiry',src.includes("row.type==='reviewBatch'")&&src.includes('LM.dueQuestions'));
check('event driven only',!src.includes('MutationObserver')&&!src.includes('setInterval(')&&!src.includes('requestAnimationFrame('));
check('no combat API mutation',!src.includes('POWDER_COMBAT_ENTRY')&&!src.includes('grantBattleRewards'));
check('no economy API mutation',!src.includes('POWDER_SECURE_ECONOMY')&&!src.includes('spendCoins')&&!src.includes('creditCoins'));
check('21.2.5 activation chain',parent.includes('activateSessionContinuity2126')&&parent.includes("js/learning-session-continuity-v2126.js?v=2126"));

const store=new Map();
const save={rank:0,lessonsDone:[],questionProgress:{},learning:{}};
const LM={
 dayKey:()=> '2026-08-24',
 unitMeta:l=>l.learningMeta,
 dueQuestionsForLesson:(s,id)=>[],
 dueQuestions:(s,lang)=>lang==='EN'?[{id:'en-due',lessonId:'en1',language:'EN'}]:[],
 chooseReviewLanguage:()=> 'EN'
};
const D={lessons:[
 {id:'zh1',title:'HSK1 Core',language:'ZH',learningMeta:{Rank:0,Optional:false,Language:'ZH'}},
 {id:'it1',title:'IT Optional',language:'ZH',learningMeta:{Rank:0,Optional:true,Language:'ZH'}},
 {id:'zh2',title:'Future Rank',language:'ZH',learningMeta:{Rank:2,Optional:false,Language:'ZH'}}
]};
const window={POWDER_LEARNING_MASTER_V2:LM,POWDER_DATA:D,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},POWDER_APP:{getSave:()=>save},POWDER_DAILY_STUDY_ORCHESTRATOR_V2115:{dailyPlan:()=>({action:{type:'lesson',lessonId:'zh1',language:'ZH',title:'HSK1 Core'}}),startAction:()=>true}};
window.window=window;
const context={window,console,Date,setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(src,context,{filename:runtimePath});
const api=window.POWDER_LEARNING_SESSION_CONTINUITY_V2126;
check('api exported',api?.version==='21.2.6');
const before=JSON.stringify(save);
const first=api.recommendation(save);
check('daily plan fallback',first?.source==='daily-plan'&&first.lessonId==='zh1');
check('optional lesson rejected',api.markAction({type:'lesson',lessonId:'it1'})===false);
check('future-rank lesson rejected',api.markAction({type:'lesson',lessonId:'zh2'})===false);
check('core lesson checkpoint stored',api.markAction({type:'lesson',lessonId:'zh1'})===true&&api.readCheckpoint()?.lessonId==='zh1');
check('checkpoint resumes before completion',api.recommendation(save)?.source==='checkpoint');
save.lessonsDone=['zh1'];
check('completed lesson checkpoint expires',api.normalizeCheckpoint(save,api.readCheckpoint())===null);
save.lessonsDone=[];
check('SRS checkpoint allowed only when due',api.markAction({type:'reviewBatch',language:'EN'})===true&&api.recommendation(save)?.type==='reviewBatch');
store.set(api.key,JSON.stringify({type:'lesson',lessonId:'zh1',language:'ZH',day:'2026-08-23',at:1}));
check('previous-day checkpoint rejected',api.normalizeCheckpoint(save,api.readCheckpoint())===null);
check('player save remains read only',JSON.stringify(save)===before);
check('reference trio present',api.designReferences?.length===3);

console.log(JSON.stringify({ok:true,version:'21.2.6',checks:checks.length,names:checks},null,2));