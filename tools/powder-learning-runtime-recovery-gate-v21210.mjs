import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const runtime=read('js/learning-runtime-recovery-v21210.js');
const command=read('js/learning-command-center-v2120.js');
const loader=read('js/runtime-clean-presentation-v2129.js');
const server=read('server/supabase/functions/powder-learning-lesson-v1829/index.ts');
const sw=read('service-worker.js');
const checks=[];
const ok=(name,value)=>{if(!value)throw new Error(`[21.2.10] ${name}`);checks.push(name)};

ok('runtime version',runtime.includes("VERSION='21.2.10'"));
ok('event driven only',!runtime.includes('setInterval(')&&!runtime.includes('MutationObserver')&&!runtime.includes('requestAnimationFrame('));
ok('actual modal visibility guard',runtime.includes('getComputedStyle(el)')&&runtime.includes('getClientRects().length>0')&&runtime.includes("el.getAttribute?.('aria-hidden')==='true'"));
ok('stale scroll styles cleared',runtime.includes("removeProperty('overflow')")&&runtime.includes("removeProperty('touch-action')"));
ok('fast mastery direct read',runtime.includes('save?.learning?.lessonMastery')&&runtime.includes('fastLessonMastery'));
ok('fast mode uses indexed question ids',runtime.includes('questionIdsByLesson')&&runtime.includes("return'srs'")&&runtime.includes("return'replay'"));
ok('due burst cache bounded',runtime.includes('new WeakMap')&&runtime.includes('/250')&&runtime.includes('powder:local-save'));
ok('secure lesson forwards client bank',runtime.includes('candidateQuestionIds')&&runtime.includes('questionIds,candidateQuestionIds'));
ok('secure lesson rejects foreign ids',runtime.includes('serverIds.some(id=>!local.has(id))'));
ok('SRS keeps prior secure path',runtime.includes("String(options.type||'lesson')==='srs')return prior(options)"));
ok('bridge activation retries on view without polling',runtime.includes('bridgeOnView')&&runtime.includes("removeEventListener('powder:view-changed',bridgeOnView)"));
ok('command center no full-save clone',!command.includes('JSON.parse(JSON.stringify(s))'));
ok('command center reuses daily plan',command.includes('plan?.due?.ZH?.due')&&command.includes('plan?.boss')&&command.includes('plan?.daily'));
ok('rotation clone scoped to lesson plans',command.includes('lessonQuestionPlans:JSON.parse(JSON.stringify(plans))'));
ok('post presentation activation',loader.includes('activateLearningRuntimeRecovery21210')&&loader.includes('learning-runtime-recovery-v21210.js?v=21210'));
ok('server accepts candidate intersection',server.includes('candidateQuestionIds')&&server.includes('serverIds.filter(id=>candidateSet.has(id))'));
ok('server preferred core stays eligible',server.includes('preferred.filter(id=>eligibleSet.has(id))'));
ok('server RPC receives intersected pool',server.includes('p_question_ids:{core,pool:eligible}'));
ok('server mismatch is explicit',server.includes("code:'CLIENT_BANK_MISMATCH'"));
ok('server keeps authenticated user check',server.includes('db.auth.getUser(jwt)')&&server.includes("return out({error:'Phiên đăng nhập không hợp lệ.'},401)"));
ok('service worker hotfix build',sw.includes("V='21.2.10-hotfix'")&&sw.includes("BUILD='21210'"));
ok('service worker bypasses stale HTTP cache',sw.includes("init.cache='reload'")&&sw.includes('forceReload:sensitive'));
ok('service worker does not trust build-sensitive preload',sw.includes('if(BUILD_SENSITIVE.test(url.pathname))return null'));
ok('service worker purges prior powder caches',sw.includes("key.startsWith(CACHE_PREFIX)&&!keep.has(key)"));
ok('Combat untouched by runtime',!runtime.includes('POWDER_COMBAT_ENTRY')&&!runtime.includes('combat-core')&&!runtime.includes('combat-mechanics'));
ok('economy/reward formulas untouched',!runtime.includes('powCandies')&&!runtime.includes('coins+=')&&!runtime.includes('knowledge+='));

// Behavioral VM checks for the hot paths.
const classSet=new Set(['v131-modal-open']);
const classList={contains:x=>classSet.has(x),toggle:(x,on)=>{if(on)classSet.add(x);else classSet.delete(x);return on}};
const bodyStyle={removed:[],removeProperty(k){this.removed.push(k)}};
let modals=[];
const listeners={};
const document={
 readyState:'loading',
 documentElement:{classList},
 body:{style:bodyStyle},
 querySelectorAll:s=>s==='.modal'?modals:[],
 addEventListener:(name,fn)=>{listeners[name]=fn}
};
const learning={lessonMastery:{l1:82,l2:64}};
const save={rank:0,lessonsDone:['l1','l2'],learning,questionProgress:{q1:{seen:1,nextReview:0},q2:{seen:1,nextReview:9999999999999}}};
let dueCalls=0,srsCalls=0;
const LM={
 lessonMastery:()=>999,
 lessonMode:()=> 'fallback',
 averageMastery:()=>999,
 dueQuestions:(_s,lang)=>{dueCalls++;return lang==='ZH'?[{id:'due'}]:[]},
 unitMeta:l=>l.learningMeta||{}
};
const D={lessons:[
 {id:'l1',learningMeta:{Rank:0,Optional:false,Track:'core'},questions:[{id:'q1'}]},
 {id:'l2',learningMeta:{Rank:0,Optional:false,Track:'core'},questions:[{id:'q2'}]}
]};
const priorStart=async o=>{srsCalls++;return{sessionId:'srs',questionIds:o.questionIds||[]}};
const window={
 POWDER_DATA:D,POWDER_LEARNING_MASTER_V2:LM,
 POWDER_SECURE_LEARNING_V176:{start:priorStart},
 POWDER_ONLINE_V150:{accessToken:()=> 'token'},
 POWDER_SERVER_CONFIG:{url:'https://example.supabase.co',anonKey:'anon'},
 addEventListener(){},removeEventListener(){},dispatchEvent(){},window:null
};window.window=window;
let fetchBody=null;
const fetch=async(_url,init)=>{fetchBody=JSON.parse(init.body);return{ok:true,json:async()=>({ok:true,result:{sessionId:'lesson',questionIds:['q1']}})}};
const context={window,document,console,Promise,Date,WeakMap,Map,Set,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},getComputedStyle:el=>el.style||{display:'block',visibility:'visible',opacity:'1'},fetch};
vm.createContext(context);vm.runInContext(runtime,context,{filename:'learning-runtime-recovery-v21210.js'});
const api=window.POWDER_LEARNING_RUNTIME_RECOVERY_V21210;
ok('api exported',api?.version==='21.2.10');
ok('fast mastery behavior',api.fastLessonMastery(save,'l1')===82);
ok('fast average behavior',api.fastAverageMastery(save)===73);
ok('finished due lesson becomes SRS',api.fastLessonMode(save,'l1')==='srs');
ok('finished non-due lesson becomes replay',api.fastLessonMode(save,'l2')==='replay');
ok('unfinished lesson becomes first',api.fastLessonMode({...save,lessonsDone:['l1']},'l2')==='first');
const d1=api.cachedDueQuestions(save,'ZH',1000),d2=api.cachedDueQuestions(save,'ZH',1000);ok('due cache coalesces',dueCalls===1&&d1===d2);
modals=[];api.repairScrollLock();ok('stale modal lock removed',!classSet.has('v131-modal-open')&&bodyStyle.removed.includes('overflow')&&bodyStyle.removed.includes('touch-action'));
const visibleModal={hidden:false,isConnected:true,getAttribute:()=>null,getClientRects:()=>[{}],style:{display:'grid',visibility:'visible',opacity:'1'}};modals=[visibleModal];api.repairScrollLock();ok('visible modal keeps scroll lock',classSet.has('v131-modal-open'));
api.installSecureLearningBridge();const srs=await window.POWDER_SECURE_LEARNING_V176.start({type:'srs',questionIds:['q1']});ok('SRS delegates original',srs.sessionId==='srs'&&srsCalls===1);
const lesson=await window.POWDER_SECURE_LEARNING_V176.start({type:'lesson',lessonId:'l1',language:'ZH',level:'standard',questionIds:['q1'],candidateQuestionIds:['q1','q2']});ok('lesson bridge starts secure server session',lesson.sessionId==='lesson'&&fetchBody?.candidateQuestionIds?.length===2&&fetchBody?.questionIds?.[0]==='q1');

console.log(`Powder 21.2.10 Learning Runtime Recovery: ${checks.length}/${checks.length} checks passed`);
