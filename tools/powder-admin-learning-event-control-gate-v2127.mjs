import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('js/admin-learning-event-control-v2127.js','utf8');
const loader=fs.readFileSync('js/admin-network-v1840.js','utf8');
const adminEvents=fs.readFileSync('js/admin-events-v167.js','utf8');
const adminMail=fs.readFileSync('js/admin-liveops-v156.js','utf8');
const playerEvents=fs.readFileSync('js/learning-events-v167.js','utf8');
let n=0;const ok=(name,v)=>{if(!v)throw new Error(`[21.2.7] ${name}`);n++};

ok('runtime version',src.includes("VERSION='21.2.7'"));
ok('hybrid contract requires learning and combat',src.includes("hybrid:{learning:true,combat:true}"));
ok('boss contract requires combat',src.includes("boss:{learning:false,combat:true}"));
ok('save guard blocks invalid draft',src.includes('function guardSave')&&src.includes('stopImmediatePropagation'));
ok('template repair hook exists',src.includes('function afterTemplate')&&src.includes('addCombatMission({silent:true})'));
ok('combat mission uses existing admin controls',src.includes("type.value='event_combat'")&&src.includes("add.click()"));
ok('pending mission protected',src.includes('missionDraftPending')&&src.includes('rewardDraftPending'));
ok('learned-only contract visible',src.includes('Learned-only')&&src.includes('learnedOnly:true'));
ok('event driven only',!src.includes('MutationObserver')&&!src.includes('setInterval(')&&!src.includes('requestAnimationFrame('));
ok('no player combat engine mutation',!src.includes('POWDER_COMBAT_ENTRY')&&!src.includes('player-combat-scene'));
ok('no direct server mutation added',!src.includes('fetch(')&&!src.includes('/functions/v1/'));
ok('admin loader chain',loader.includes('activateAdminLearningEventControl2127')&&loader.includes('js/admin-learning-event-control-v2127.js?v=2127'));
ok('existing event model supports combat mission',adminEvents.includes("event_combat:'Thắng Combat sự kiện'"));
ok('existing event questions locked learned-only',adminEvents.includes('learnedOnly:true'));
ok('existing event rewards stay rich',adminEvents.includes("['items','Vật phẩm']")&&adminEvents.includes("['equipment','Trang bị']")&&adminEvents.includes("['artifacts','Cổ vật']"));
ok('player combat entry requires event_combat mission',playerEvents.includes("m.type==='event_combat'"));
ok('server mail still supports one account',adminMail.includes("<option value=\"user\"")||adminMail.includes("value!=='user'"));
ok('server mail action preserved',adminMail.includes("raw('mail_create'"));
ok('three design references',src.includes('Moodle completion/access')&&src.includes('Open edX prerequisites/exams')&&src.includes('Kolibri learner progress'));

const elements={
 '#event183Type':{value:'hybrid'},
 '#event183MissionList':{textContent:'Hoàn thành gói câu hỏi sự kiện · Hoàn thành bài học'},
 '#event191QuestionEnabled':{checked:true},
 '#event191QuestionCount':{value:'30'},
 '#event191QuestionPass':{value:'70'},
 '#event191QuestionLanguage':{value:'mixed'},
 '#event191QuestionRankMode':{value:'player'}
};
const document={readyState:'loading',querySelector:s=>elements[s]||null,addEventListener:()=>{},createElement:()=>({}),head:{appendChild:()=>{}}};
const window={};window.window=window;
const context={window,document,console,setTimeout,clearTimeout,Promise};vm.createContext(context);vm.runInContext(src,context,{filename:'admin-learning-event-control-v2127.js'});
const api=window.POWDER_ADMIN_LEARNING_EVENT_CONTROL_V2127;
ok('api exported',api?.version==='21.2.7');
let a=api.audit();ok('hybrid without combat blocked',a.ready===false&&a.hasLearning===true&&a.hasCombat===false&&a.blockers.some(x=>x.includes('Combat')));
elements['#event183MissionList'].textContent+=' · Thắng Combat sự kiện';a=api.audit();ok('hybrid with learning plus combat ready',a.ready===true&&a.hasCombat===true&&a.hasLearning===true);
elements['#event183Type'].value='study';elements['#event183MissionList'].textContent='';a=api.audit();ok('study without learning blocked',a.ready===false&&a.blockers.some(x=>x.includes('học tập')));
elements['#event183Type'].value='custom';elements['#event191QuestionEnabled'].checked=false;a=api.audit();ok('custom event remains flexible',a.ready===true);

console.log(`Powder 21.2.7 Admin Learning & Event Control: ${n}/24 checks passed`);