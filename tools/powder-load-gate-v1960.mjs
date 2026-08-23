#!/usr/bin/env node
import {writeFile} from 'node:fs/promises';
const VERSION='19.6.0',BASE=(process.env.POWDER_URL||'https://pxejydhqfzidnheudgnn.supabase.co').replace(/\/$/,'');
const KEY=process.env.POWDER_ANON_KEY||'';
const TOKENS=String(process.env.POWDER_ACCESS_TOKENS||process.env.POWDER_ACCESS_TOKEN||'').split(',').map(x=>x.trim()).filter(Boolean);
const mode=String(process.argv[2]||'pvp_state');
const requests=Math.max(20,Math.min(500,Number(process.argv[3]||200)));
const concurrency=Math.max(1,Math.min(20,Number(process.argv[4]||10)));
if(!KEY||!TOKENS.length){console.error('Set POWDER_ANON_KEY and POWDER_ACCESS_TOKENS (comma-separated).');process.exit(2)}
if(!['pvp_state','cloud_load'].includes(mode)){console.error('Mode: pvp_state | cloud_load');process.exit(2)}
const endpoint=mode==='pvp_state'?'/functions/v1/powder-pvp':'/functions/v1/powder-cloud';
const body=mode==='pvp_state'?{action:'state'}:{action:'load'};
const lat=[],status={},errs=[];let next=0;
const percentile=(a,p)=>{if(!a.length)return 0;const x=[...a].sort((m,n)=>m-n),i=Math.min(x.length-1,Math.max(0,Math.ceil(p*x.length)-1));return x[i]};
async function one(i){const token=TOKENS[i%TOKENS.length],t0=performance.now();try{const r=await fetch(BASE+endpoint,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json','x-powder-version':VERSION,'x-powder-device':`load-gate-${i%TOKENS.length}`},body:JSON.stringify(body)});const ms=performance.now()-t0;lat.push(ms);status[r.status]=(status[r.status]||0)+1;if(!r.ok){let msg='';try{msg=(await r.json())?.error||''}catch{}errs.push({status:r.status,message:String(msg).slice(0,180)})}}catch(e){lat.push(performance.now()-t0);status.network=(status.network||0)+1;errs.push({status:'network',message:String(e?.message||e).slice(0,180)})}}
async function worker(){while(true){const i=next++;if(i>=requests)return;await one(i)}}
const started=new Date().toISOString(),t0=performance.now();await Promise.all(Array.from({length:concurrency},worker));const durationMs=Math.round(performance.now()-t0),errorCount=errs.length;
const report={schema:'powder-load-gate-v1960',version:VERSION,mode,target:BASE,startedAt:started,completedAt:new Date().toISOString(),requests,concurrency,tokenCount:TOKENS.length,status,metrics:{success:requests-errorCount,errors:errorCount,errorRate:errorCount/requests,p50:Number(percentile(lat,.5).toFixed(2)),p95:Number(percentile(lat,.95).toFixed(2)),p99:Number(percentile(lat,.99).toFixed(2)),max:Number(Math.max(...lat,0).toFixed(2)),durationMs,throughputRps:Number((requests/(durationMs/1000||1)).toFixed(2))},sampleErrors:errs.slice(0,12)};
const file=`powder-load-${mode}-v1960-${Date.now()}.json`;await writeFile(file,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.error(`\nSaved ${file}`);
process.exit(errorCount?1:0);
