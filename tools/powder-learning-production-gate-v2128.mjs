import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const report={version:'21.2.8',passed:[],failed:[],invariants:[]};
const assert=(name,value)=>{if(!value)throw new Error(`[21.2.8] ${name}`);report.invariants.push(name)};

const gates=[
 ['Question Engine 21.1.2','tools/powder-learning-question-engine-gate-v2112.mjs'],
 ['Academic Content 21.1.3','tools/powder-academic-content-gate-v2113.mjs'],
 ['SRS Intelligence 21.1.4','tools/powder-srs-intelligence-gate-v2114.mjs'],
 ['Daily Study 21.1.5','tools/powder-daily-study-orchestrator-gate-v2115.mjs'],
 ['Mastery Recovery 21.1.6','tools/powder-mastery-recovery-gate-v2116.mjs'],
 ['Adaptive Question Mix 21.1.7','tools/powder-adaptive-question-mix-gate-v2117.mjs'],
 ['Explanation Coverage 21.1.8','tools/powder-explanation-coverage-gate-v2118.mjs'],
 ['Daily Rotation 21.1.9','tools/powder-daily-rotation-runner-gate-v2119.mjs'],
 ['Learning Command Center 21.2.0','tools/powder-learning-command-center-gate-v2120.mjs'],
 ['Daily Boss 21.2.1','tools/powder-daily-boss-intelligence-gate-v2121.mjs'],
 ['Dungeon Curriculum 21.2.2','tools/powder-dungeon-curriculum-gate-v2122.mjs'],
 ['Rank Promotion 21.2.3','tools/powder-rank-promotion-exam-gate-v2123.mjs'],
 ['Learning Performance 21.2.5','tools/powder-learning-performance-gate-v2125.mjs'],
 ['Session Continuity 21.2.6','tools/powder-learning-session-continuity-gate-v2126.mjs'],
 ['Admin Learning Event 21.2.7','tools/powder-admin-learning-event-control-gate-v2127.mjs']
];

for(const [name,file] of gates){
 if(!exists(file)){report.failed.push({name,file,error:'missing gate'});continue}
 const r=spawnSync(process.execPath,[file,root],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(r.status===0)report.passed.push({name,file,stdout:String(r.stdout||'').trim().slice(-900)});
 else report.failed.push({name,file,status:r.status,stdout:String(r.stdout||'').trim().slice(-1200),stderr:String(r.stderr||'').trim().slice(-1800)});
}

const boot=read('js/boot-loader-v21004.js');
const index=read('index.html');
const srs=read('js/learning-srs-intelligence-v2114.js');
const perf=read('js/learning-performance-hardening-v2125.js');
const adminNet=read('js/admin-network-v1840.js');
const hub=read('js/learning-hub-v149.js');
const dungeon=read('js/learning-dungeon-curriculum-gate-v2122.js');
const promotion=read('js/learning-rank-promotion-exam-v2123.js');
const continuity=read('js/learning-session-continuity-v2126.js');
const adminControl=read('js/admin-learning-event-control-v2127.js');

assert('frozen boot version',boot.includes("VERSION='21.0.4'"));
assert('frozen boot manifest hash',boot.includes('MANIFEST_HASH="9a3d2db0b19ce1a1"'));
assert('SRS post-boot bridge retained',index.includes('powderSrsIntelligenceLoader2114')&&index.includes('learning-srs-intelligence-v2114.js?v=2114'));
assert('Learning Performance loads after SRS',srs.includes('activateLearningPerformance2125')&&srs.includes('learning-performance-hardening-v2125.js?v=2125'));
assert('Session Continuity loads after Performance',perf.includes('activateSessionContinuity2126')&&perf.includes('learning-session-continuity-v2126.js?v=2126'));
assert('Admin Event Control loads from Admin network layer',adminNet.includes('activateAdminLearningEventControl2127')&&adminNet.includes('admin-learning-event-control-v2127.js?v=2127'));
assert('legacy Learning Hub continuous observer removed',!hub.includes('MutationObserver'));
assert('legacy Learning Hub render loop removed',!hub.includes('requestAnimationFrame('));
assert('Dungeon optional curriculum remains non-blocking',dungeon.includes('optionalSupportLessonIDs')&&dungeon.includes('Optional/support IT never blocks core dungeon'));
assert('Promotion runtime remains learned/core filtered',promotion.includes('lessonsDone')&&promotion.includes('Optional')&&promotion.includes('Rank'));
assert('Session checkpoint does not mutate player save',continuity.includes('mutatesPlayerSave:false')&&!continuity.includes('applyCloudBundle'));
assert('Admin Hybrid contract remains Learning plus Combat',adminControl.includes("hybrid:{learning:true,combat:true}"));
assert('Admin layer does not call player Combat engine',!adminControl.includes('POWDER_COMBAT_ENTRY'));

const modernLearning=[
 'js/learning-daily-study-orchestrator-v2115.js',
 'js/learning-mastery-recovery-v2116.js',
 'js/learning-adaptive-question-mix-v2117.js',
 'js/learning-explanation-coverage-v2118.js',
 'js/learning-daily-rotation-runner-v2119.js',
 'js/learning-command-center-v2120.js',
 'js/learning-daily-boss-intelligence-v2121.js',
 'js/learning-dungeon-curriculum-gate-v2122.js',
 'js/learning-rank-promotion-exam-v2123.js',
 'js/learning-performance-hardening-v2125.js',
 'js/learning-session-continuity-v2126.js',
 'js/admin-learning-event-control-v2127.js'
];
for(const file of modernLearning){
 const src=read(file);
 assert(`${file} no interval polling`,!src.includes('setInterval('));
 assert(`${file} no continuous MutationObserver`,!src.includes('MutationObserver'));
}

if(report.failed.length){console.error(JSON.stringify(report,null,2));process.exit(1)}

const finalGate='tools/powder-final-gate-v21004.mjs';
if(!exists(finalGate)){report.failed.push({name:'Final Gate 21.0.4',file:finalGate,error:'missing gate'});console.error(JSON.stringify(report,null,2));process.exit(1)}
const final=spawnSync(process.execPath,[finalGate,root],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
if(final.status!==0){report.failed.push({name:'Final Gate 21.0.4',file:finalGate,status:final.status,stdout:String(final.stdout||'').trim().slice(-1200),stderr:String(final.stderr||'').trim().slice(-1800)});console.error(JSON.stringify(report,null,2));process.exit(1)}
report.passed.push({name:'Final Gate 21.0.4',file:finalGate,stdout:String(final.stdout||'').trim().slice(-900)});
report.summary={featureGates:report.passed.length,invariants:report.invariants.length,combatTouched:false,bootTouched:false,readyForCombatBoundary:true};
console.log(JSON.stringify(report,null,2));