import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const root=path.resolve(process.argv[2]||'.');
const updateBaseline=process.argv.includes('--update-baseline');
const outDir=path.join(root,'artifacts','visual-v21008');
const baselinePath=path.join(root,'tests','visual-baseline','v21008','baseline.json');
fs.mkdirSync(outDir,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function findChrome(){
  for(const c of [process.env.CHROME_PATH,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
    if(c.includes('/')&&fs.existsSync(c))return c;
    const r=spawnSync('which',[c],{encoding:'utf8'}); if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  throw new Error('Chrome/Chromium not found');
}
async function waitHttp(url,timeout=15000){const t=Date.now();while(Date.now()-t<timeout){try{const r=await fetch(url);if(r.ok)return r}catch{}await sleep(180)}throw new Error(`Timeout ${url}`)}
async function cdpSession(wsUrl){
  const ws=new WebSocket(wsUrl); await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
  let id=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result||{})}};
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});ws.send(JSON.stringify({id:call,method,params}));setTimeout(()=>{if(pending.has(call)){pending.delete(call);reject(new Error(`CDP timeout ${method}`))}},15000)});
  return{ws,cmd};
}
async function evalJs(cmd,expression){const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});return r.result?.value}
async function waitReady(cmd){for(let i=0;i<100;i++){if(await evalJs(cmd,'document.readyState')==='complete')return;await sleep(120)}}
function walkSize(dir,ext){let n=0;if(!fs.existsSync(dir))return 0;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())n+=walkSize(p,ext);else if(!ext||p.endsWith(ext))n+=fs.statSync(p).size}return n}
function staticMetrics(){
  const boot=fs.readFileSync(path.join(root,'js','boot-loader-v21004.js'),'utf8');
  const ma=boot.indexOf('const MANIFEST=')+15,mb=boot.indexOf('];\nconst SCRIPT_ORDER',ma)+1;
  const manifest=JSON.parse(boot.slice(ma,mb));
  return{
    jsBytes:walkSize(path.join(root,'js'),'.js'),cssBytes:walkSize(path.join(root,'css'),'.css'),
    htmlBytes:['index.html','admin.html','offline.html','privacy.html','terms.html'].reduce((s,f)=>s+fs.statSync(path.join(root,f)).size,0),
    bootBytes:fs.statSync(path.join(root,'js','boot-loader-v21004.js')).size,
    manifestEntries:manifest.length,manifestDeclaredBytes:manifest.reduce((s,x)=>s+(Number(x.s)||0),0)
  };
}
function metricMap(raw){const m={};for(const x of raw.metrics||[])m[x.name]=x.value;return m}
function stableRuntime(m){return{Nodes:m.Nodes||0,JSHeapUsedSize:m.JSHeapUsedSize||0,LayoutCount:m.LayoutCount||0,RecalcStyleCount:m.RecalcStyleCount||0,TaskDuration:m.TaskDuration||0,ScriptDuration:m.ScriptDuration||0,LayoutDuration:m.LayoutDuration||0,RecalcStyleDuration:m.RecalcStyleDuration||0}}
async function fingerprintImage(cmd,url){
  await cmd('Page.navigate',{url});await waitReady(cmd);await sleep(250);
  return await evalJs(cmd,`(async()=>{const img=document.querySelector('img');if(!img)return null;await img.decode();const N=24,c=document.createElement('canvas');c.width=N;c.height=N;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,N,N);const d=x.getImageData(0,0,N,N).data;let qHex='';for(let i=0;i<d.length;i+=4)qHex+=(d[i]>>4).toString(16)+(d[i+1]>>4).toString(16)+(d[i+2]>>4).toString(16);return{n:N,qHex,width:img.naturalWidth,height:img.naturalHeight}})()`);
}
function fingerprintVector(fp){if(!fp)return[];if(Array.isArray(fp.q))return fp.q;if(typeof fp.qHex==='string')return Array.from(fp.qHex,c=>Number.parseInt(c,16));return[]}
function fingerprintHex(fp){if(typeof fp?.qHex==='string')return fp.qHex;if(Array.isArray(fp?.q))return fp.q.map(v=>Number(v).toString(16)).join('');return''}
function baselineFingerprint(spec){const fp=spec?.fingerprint;if(!fp)return null;if(fp.file){const qHex=fs.readFileSync(path.join(root,fp.file),'utf8').trim();return{...fp,qHex}}return fp}
function visualDiff(a,b){
  if(b?.sha256){const h=crypto.createHash('sha256').update(fingerprintHex(a)).digest('hex');return h===b.sha256?{ratio:0,mean:0}:{ratio:1,mean:1}}
  const aq=fingerprintVector(a),bq=fingerprintVector(b);if(!a||!b||a.n!==b.n||aq.length!==bq.length||!aq.length)return{ratio:1,mean:1};let cells=aq.length/3,bad=0,total=0;for(let i=0;i<aq.length;i+=3){const d=Math.abs(aq[i]-bq[i])+Math.abs(aq[i+1]-bq[i+1])+Math.abs(aq[i+2]-bq[i+2]);total+=d;if(d>=7)bad++}return{ratio:bad/cells,mean:total/(cells*45)}
}
const normalize=`(()=>{let s=document.getElementById('visual21008-freeze');if(!s){s=document.createElement('style');s.id='visual21008-freeze';s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';document.head.appendChild(s)}const apply=()=>{const set=(q,t)=>{const e=document.querySelector(q);if(e&&e.textContent!==t)e.textContent=t};set('#bootProgressPct','50%');set('#bootStage','Đang mở thế giới Powder');set('#bootDetail','Chuẩn bị những khu vực bạn sắp khám phá...');set('#bootFiles','Đang hoàn thiện thế giới Powder...');set('#bootTip','Học mỗi ngày để phát triển Pow và mở thêm thử thách mới.');const f=document.querySelector('#bootProgressFill');if(f&&f.style.width!=='50%')f.style.width='50%'};apply();if(!window.__powderVisual21008FreezeObserver){const observer=new MutationObserver(()=>{if(window.__powderVisual21008FreezePending)return;window.__powderVisual21008FreezePending=true;queueMicrotask(()=>{try{apply()}finally{window.__powderVisual21008FreezePending=false}})});for(const q of ['#bootProgressPct','#bootStage','#bootDetail','#bootFiles','#bootTip','#bootProgressFill']){const e=document.querySelector(q);if(e)observer.observe(e,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style']})}window.__powderVisual21008FreezeObserver=observer}return{title:document.title,body:document.body?.innerText?.length||0,nodes:document.querySelectorAll('*').length}})()`;

const chromePath=findChrome(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'powder-vp-'));
const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-debugging-port=9224',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const report={version:'21.0.8',updateBaseline,static:staticMetrics(),screens:{},runtime:{},checks:{},errors:[]};
try{
  await waitHttp('http://127.0.0.1:4173/index.html');const list=await(await waitHttp('http://127.0.0.1:9224/json/list')).json();const page=list.find(x=>x.type==='page');if(!page)throw new Error('No Chrome page');
  const{ws,cmd}=await cdpSession(page.webSocketDebuggerUrl);await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Performance.enable');await cmd('HeapProfiler.enable');
  async function snap(name,url,width,height,wait=3500){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await cmd('Page.navigate',{url});await waitReady(cmd);await sleep(wait);const dom=await evalJs(cmd,normalize);await sleep(150);await cmd('HeapProfiler.collectGarbage');await sleep(80);const perf=stableRuntime(metricMap(await cmd('Performance.getMetrics')));const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const file=path.join(outDir,`${name}.png`);fs.writeFileSync(file,Buffer.from(shot.data,'base64'));const fp=await fingerprintImage(cmd,`http://127.0.0.1:4173/artifacts/visual-v21008/${name}.png`);report.screens[name]={fingerprint:fp,dom};report.runtime[name]=perf;
  }
  await snap('index-desktop','http://127.0.0.1:4173/index.html',1440,1000,5000);
  await snap('index-mobile','http://127.0.0.1:4173/index.html',390,844,3500);
  await snap('admin-desktop','http://127.0.0.1:4173/admin.html',1440,1000,2200);
  ws.close();
} catch(e){report.errors.push(String(e?.stack||e))} finally{server.kill('SIGTERM');chrome.kill('SIGTERM');try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}

if(updateBaseline){
  const screens={};
  for(const[name,v]of Object.entries(report.screens)){const rel=`tests/visual-baseline/v21008/${name}.qhex`;fs.writeFileSync(path.join(root,rel),fingerprintHex(v.fingerprint)+'\n');screens[name]={fingerprint:{n:v.fingerprint.n,file:rel,width:v.fingerprint.width,height:v.fingerprint.height}}}
  const baseline={version:'21.0.8',generatedFromRuntime:'21.0.9-deterministic-loader-gc-external-fingerprint',static:report.static,screens,runtime:report.runtime,thresholds:{visualRatio:{'index-desktop':0.12,'index-mobile':0.14,'admin-desktop':0.10},visualMean:0.055,jsGrowthRatio:1.03,cssGrowthRatio:1.03,manifestGrowthRatio:1.03}};
  fs.mkdirSync(path.dirname(baselinePath),{recursive:true});fs.writeFileSync(baselinePath,JSON.stringify(baseline,null,2)+'\n');report.checks.baselineGenerated=report.errors.length===0;
}else{
  if(!fs.existsSync(baselinePath)){report.errors.push('Missing visual/performance baseline');}
  else{
    const b=JSON.parse(fs.readFileSync(baselinePath,'utf8')),headroom=131072;
    const check=(k,v)=>report.checks[k]=!!v;
    check('staticJsBudget',report.static.jsBytes<=b.static.jsBytes*(b.thresholds.jsGrowthRatio||1.03)+headroom);
    check('staticCssBudget',report.static.cssBytes<=b.static.cssBytes*(b.thresholds.cssGrowthRatio||1.03)+headroom);
    check('manifestBudget',report.static.manifestDeclaredBytes<=b.static.manifestDeclaredBytes*(b.thresholds.manifestGrowthRatio||1.03)+2097152);
    check('manifestEntryBudget',report.static.manifestEntries<=b.static.manifestEntries+20);
    check('bootSizeBudget',report.static.bootBytes<=b.static.bootBytes*1.08+32768);
    for(const[name,s]of Object.entries(report.screens)){const bf=baselineFingerprint(b.screens?.[name]);const d=visualDiff(s.fingerprint,bf);s.diff=d;check(`visual:${name}`,d.ratio<=(b.thresholds.visualRatio?.[name]??0.12)&&d.mean<=(b.thresholds.visualMean??0.055));const r=report.runtime[name],br=b.runtime?.[name]||{};check(`nodes:${name}`,r.Nodes<=(br.Nodes||r.Nodes)*1.15+150);check(`heap:${name}`,r.JSHeapUsedSize<=(br.JSHeapUsedSize||r.JSHeapUsedSize)*1.40+8388608);check(`layout:${name}`,r.LayoutCount<=(br.LayoutCount||r.LayoutCount)*2+25);check(`style:${name}`,r.RecalcStyleCount<=(br.RecalcStyleCount||r.RecalcStyleCount)*2+25)}
  }
}
report.pass=report.errors.length===0&&Object.values(report.checks).every(Boolean);fs.writeFileSync(path.join(outDir,'VISUAL-PERFORMANCE-GATE-21.0.8.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exit(1);
