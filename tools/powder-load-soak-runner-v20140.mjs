#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const VERSION='20.14.0',SCHEMA='powder-load-soak-evidence-v20140',RUNNER_REVISION='v20140.1';
const BASE=(process.env.POWDER_URL||'https://pxejydhqfzidnheudgnn.supabase.co').replace(/\/$/,'');
const KEY=process.env.POWDER_ANON_KEY||'';
const TOKENS=String(process.env.POWDER_ACCESS_TOKENS||process.env.POWDER_ACCESS_TOKEN||'').split(',').map(x=>x.trim()).filter(Boolean);
const EVIDENCE_TOKEN=process.env.POWDER_LOAD_EVIDENCE_TOKEN||'';
const CHANNEL=process.env.POWDER_CHANNEL==='staging'?'staging':'production';
const BUILD=process.env.POWDER_BUILD_ID||'powder-20.14.0-production-load-soak-testing';
const ALLOW_RELIABILITY_DRILL=process.env.POWDER_ALLOW_RELIABILITY_DRILL==='1';
const argv=process.argv.slice(2),profile=String(argv[0]||'self-test').toLowerCase();
const flags=new Set(argv.slice(1));
const arg=(name,fallback)=>{const i=argv.indexOf(name);return i>=0&&argv[i+1]!=null?argv[i+1]:fallback};
const defaults={load:{duration:900,vus:100},soak:{duration:14400,vus:50},overload:{duration:300,vus:150}};
const duration=Math.max(5,Number(arg('--duration',defaults[profile]?.duration||15))||15);
const vus=Math.max(1,Math.min(500,Number(arg('--vus',defaults[profile]?.vus||5))||5));
const metricEvery=Math.max(5,Math.min(60,Number(arg('--metrics-every',15))||15));
const submit=flags.has('--submit');
const runId=`ls20140-${profile}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

const SCENARIOS=[
 {name:'login',method:'GET',path:'/auth/v1/user',body:null},
 {name:'cloudSave',method:'POST',path:'/functions/v1/powder-cloud',body:{action:'load'}},
 {name:'economy',method:'POST',path:'/functions/v1/powder-economy',body:{action:'state',clientVersion:VERSION}},
 {name:'pvp',method:'POST',path:'/functions/v1/powder-pvp',body:{action:'state',clientVersion:VERSION}},
 {name:'event',method:'POST',path:'/functions/v1/powder-learning-events',body:{action:'state',clientVersion:VERSION}},
 {name:'sandboxWrite',method:'POST',path:'/functions/v1/powder-load-soak-metrics',body:{action:'sandbox_increment'}}
];
const scenarioSha256=crypto.createHash('sha256').update(JSON.stringify(SCENARIOS.map(({name,method,path})=>({name,method,path})))).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const percentile=(a,p)=>{if(!a.length)return 0;const x=[...a].sort((m,n)=>m-n),i=Math.min(x.length-1,Math.max(0,Math.ceil(p*x.length)-1));return x[i]};
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const round=(v,d=2)=>Number(n(v).toFixed(d));
function parseReliability(x){const r=x?.reliability||{};return{healthy:r?.healthy===true,mode:String(r?.state?.mode||''),circuit:String(r?.state?.circuit_state||'')}}
function reconIssues(x){return x?.reconciliation?.issues||{}}
function obsSaveConflicts(x){return n(x?.observability?.saveConflicts)}
function integrityDelta(start,end,sandboxAck,sandboxTotal){const a=reconIssues(start),b=reconIssues(end);return{transactionDuplicates:Math.max(0,n(b.duplicateEffect)-n(a.duplicateEffect)),unexplainedDeltas:Math.max(0,n(b.unexplainedDelta)-n(a.unexplainedDelta)),orphanEffects:Math.max(0,n(b.orphanEffect)-n(a.orphanEffect)),unresolvedSaveConflicts:Math.max(0,obsSaveConflicts(end)-obsSaveConflicts(start)),sandboxLostWrites:Math.max(0,sandboxAck-sandboxTotal)}}
function canonicalForHash(report){const x=structuredClone(report);delete x.evidenceSha256;return JSON.stringify(x)}

async function metrics(action='snapshot',extra={}){const r=await fetch(BASE+'/functions/v1/powder-load-soak-metrics',{method:'POST',headers:{apikey:KEY,'x-powder-load-evidence-token':EVIDENCE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({action,channel:CHANNEL,buildId:BUILD,...extra})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`metrics HTTP ${r.status}`);return d}
async function sandboxState(cleanup=false){return metrics('sandbox_state',{runId,cleanup})}
async function watchdog(){return metrics('watchdog',{confirmOverloadDrill:true})}
async function sendScenario(i){const s=SCENARIOS[i%SCENARIOS.length],token=TOKENS[i%TOKENS.length];if(s.name==='sandboxWrite')return sendSandbox(i);const headers={apikey:KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json','x-powder-version':VERSION,'x-powder-device':`load-soak-${runId}-${i%TOKENS.length}`};const t0=performance.now();try{const r=await fetch(BASE+s.path,{method:s.method,headers,body:s.body?JSON.stringify(s.body):undefined});const ms=performance.now()-t0;let msg='';if(!r.ok)try{msg=String((await r.json())?.error||'').slice(0,180)}catch{}return{name:s.name,ok:r.ok,status:r.status,ms,error:msg}}catch(e){return{name:s.name,ok:false,status:'network',ms:performance.now()-t0,error:String(e?.message||e).slice(0,180)}}}
async function sendSandbox(i){const t0=performance.now();try{const d=await metrics('sandbox_increment',{runId,slot:i%32});return{name:'sandboxWrite',ok:d?.sandbox?.ok===true,status:200,ms:performance.now()-t0,error:''}}catch(e){return{name:'sandboxWrite',ok:false,status:'network',ms:performance.now()-t0,error:String(e?.message||e).slice(0,180)}}}

async function selfTest(){const start={reconciliation:{issues:{duplicateEffect:2,unexplainedDelta:1,orphanEffect:0}},observability:{saveConflicts:4}},end={reconciliation:{issues:{duplicateEffect:2,unexplainedDelta:1,orphanEffect:0}},observability:{saveConflicts:4}};const integ=integrityDelta(start,end,100,100),sample={schema:SCHEMA,version:VERSION,profile:'load',channel:'production',buildId:BUILD,runnerRevision:RUNNER_REVISION,scenarioSha256,startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),durationSeconds:900,totalRequests:10000,peakVUs:100,scenarioCounts:{login:1500,cloudSave:1500,economy:1500,pvp:1500,event:1500,sandboxWrite:2500},metrics:{errorRate:0,p50Ms:100,p95Ms:500,p99Ms:800,throughputRps:12},serverMetrics:{source:'powder-load-soak-metrics-v20140',sourceRevision:'self-test',maxDbPoolPct:50,memoryStartMb:100,memoryEndMb:102,memoryGrowthPct:2},integrity:integ,degrade:{activated:false,recovered:false,recoverySeconds:0,finalMode:'normal',finalCircuit:'closed'}};sample.evidenceSha256=crypto.createHash('sha256').update(canonicalForHash(sample)).digest('hex');const checks={scenarioCount:SCENARIOS.length===6,scenarioHash:/^[0-9a-f]{64}$/.test(scenarioSha256),integrityZero:Object.values(integ).every(v=>v===0),evidenceHash:/^[0-9a-f]{64}$/.test(sample.evidenceSha256),safeReads:SCENARIOS.filter(x=>!['sandboxWrite'].includes(x.name)).every(x=>x.body?.action!=='save'&&x.body?.action!=='claim'&&x.body?.action!=='buy'),build:sample.buildId.includes('20.14.0')};const out={version:VERSION,pass:Object.values(checks).every(Boolean),checks,sample};console.log(JSON.stringify(out,null,2));process.exit(out.pass?0:1)}
if(profile==='self-test'||flags.has('--self-test'))await selfTest();
if(!['load','soak','overload'].includes(profile)){console.error('Usage: node tools/powder-load-soak-runner-v20140.mjs load|soak|overload [--duration SEC] [--vus N] [--submit]');process.exit(2)}
if(!KEY||TOKENS.length<5||EVIDENCE_TOKEN.length<24){console.error('Required: POWDER_ANON_KEY, at least 5 comma-separated POWDER_ACCESS_TOKENS test accounts, POWDER_LOAD_EVIDENCE_TOKEN (>=24 chars).');process.exit(2)}
if(profile==='overload'&&!ALLOW_RELIABILITY_DRILL){console.error('Overload profile requires POWDER_ALLOW_RELIABILITY_DRILL=1 because it may drive Reliability Watchdog into degraded/read_only and recovery.');process.exit(2)}

const samples=[],counts=Object.fromEntries(SCENARIOS.map(x=>[x.name,0])),status={},errors=[];let total=0,failed=0,sandboxAck=0,next=0,stop=false;const startMetrics=await metrics(),metricSamples=[startMetrics],modes=[parseReliability(startMetrics)];
await sandboxState(true).catch(()=>null);
const startedAt=new Date().toISOString(),startedMs=Date.now();
const metricTimer=setInterval(async()=>{try{const m=await metrics();metricSamples.push(m);modes.push(parseReliability(m));if(profile==='overload')await watchdog()}catch(e){errors.push({scenario:'metrics',error:String(e?.message||e).slice(0,180)})}},metricEvery*1000);
async function worker(){while(!stop){const i=next++;const r=await sendScenario(i);total++;counts[r.name]=(counts[r.name]||0)+1;status[String(r.status)]=(status[String(r.status)]||0)+1;if(samples.length<200000)samples.push(r.ms);else if(Math.random()<0.005)samples[Math.floor(Math.random()*samples.length)]=r.ms;if(!r.ok){failed++;if(errors.length<30)errors.push({scenario:r.name,status:r.status,error:r.error})}else if(r.name==='sandboxWrite')sandboxAck++;}}
const workers=Array.from({length:vus},worker);while(Date.now()-startedMs<duration*1000)await sleep(250);stop=true;await Promise.all(workers);clearInterval(metricTimer);
let endMetrics=await metrics();metricSamples.push(endMetrics);modes.push(parseReliability(endMetrics));
let degrade={activated:modes.some(x=>['degraded','read_only','emergency'].includes(x.mode)||['half_open','open'].includes(x.circuit)),recovered:false,recoverySeconds:0,finalMode:parseReliability(endMetrics).mode,finalCircuit:parseReliability(endMetrics).circuit};
if(profile==='overload'){
 const recoveryStart=Date.now(),limit=600000;while(Date.now()-recoveryStart<limit){await sleep(10000);try{await watchdog();endMetrics=await metrics();metricSamples.push(endMetrics);const rr=parseReliability(endMetrics);modes.push(rr);if(rr.mode==='normal'&&rr.circuit==='closed'){degrade.recovered=true;degrade.recoverySeconds=Math.round((Date.now()-recoveryStart)/1000);break}}catch{}}
 degrade.finalMode=parseReliability(endMetrics).mode;degrade.finalCircuit=parseReliability(endMetrics).circuit;
}
const sand=await sandboxState(false).catch(()=>({sandbox:{total:-1}})),sandboxTotal=n(sand?.sandbox?.total);await sandboxState(true).catch(()=>null);
const completedAt=new Date().toISOString(),durationSeconds=Math.round((Date.now()-startedMs)/1000),dbPcts=metricSamples.map(x=>n(x?.db?.dbPoolPct)).filter(x=>x>0),mem=metricSamples.map(x=>n(x?.memory?.rssMb)).filter(x=>x>0),memStart=n(startMetrics?.memory?.rssMb),memEnd=n(endMetrics?.memory?.rssMb),memoryGrowthPct=memStart>0?round(Math.max(0,(memEnd-memStart)/memStart*100)):null;
const report={schema:SCHEMA,version:VERSION,profile,channel:CHANNEL,buildId:BUILD,runnerRevision:RUNNER_REVISION,scenarioSha256,startedAt,completedAt,durationSeconds,totalRequests:total,peakVUs:vus,scenarioCounts:counts,metrics:{success:total-failed,errors:failed,errorRate:total?round(failed/total,6):1,p50Ms:round(percentile(samples,.50)),p95Ms:round(percentile(samples,.95)),p99Ms:round(percentile(samples,.99)),maxMs:round(Math.max(...samples,0)),throughputRps:round(total/Math.max(durationSeconds,1))},serverMetrics:{source:String(endMetrics?.source||'powder-load-soak-metrics-v20140'),sourceRevision:String(endMetrics?.sourceRevision||''),maxDbPoolPct:dbPcts.length?round(Math.max(...dbPcts)):null,memoryStartMb:memStart||null,memoryEndMb:memEnd||null,memoryMaxMb:mem.length?round(Math.max(...mem)):null,memoryGrowthPct},integrity:integrityDelta(startMetrics,endMetrics,sandboxAck,sandboxTotal),degrade,sandbox:{acknowledgedWrites:sandboxAck,finalTotal:sandboxTotal,lostWrites:Math.max(0,sandboxAck-sandboxTotal)},status,sampleErrors:errors.slice(0,30)};
report.evidenceSha256=crypto.createHash('sha256').update(canonicalForHash(report)).digest('hex');
const file=`POWDER-LOAD-SOAK-${profile.toUpperCase()}-20.14.0-${Date.now()}.json`;await fs.writeFile(file,JSON.stringify(report,null,2));
let submitResult=null;if(submit){const r=await fetch(BASE+'/functions/v1/powder-load-soak-evidence',{method:'POST',headers:{apikey:KEY,'x-powder-load-evidence-token':EVIDENCE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({report})});submitResult=await r.json().catch(()=>({}));if(!r.ok){console.error(JSON.stringify(submitResult,null,2));process.exitCode=1}}
console.log(JSON.stringify({report,submitResult,file},null,2));
