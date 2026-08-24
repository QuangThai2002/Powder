import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root=path.resolve(process.argv[2]||'.');
const artifacts=path.join(root,'artifacts','scene-transition-v21012');
fs.mkdirSync(artifacts,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function findChrome(){for(const c of [process.env.CHROME_PATH,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){if(c.includes('/')&&fs.existsSync(c))return c;const r=spawnSync('which',[c],{encoding:'utf8'});if(r.status===0&&r.stdout.trim())return r.stdout.trim()}throw new Error('Chrome/Chromium not found')}
async function waitHttp(url,timeout=15000){const t=Date.now();while(Date.now()-t<timeout){try{const r=await fetch(url);if(r.ok)return r}catch{}await sleep(150)}throw new Error(`Timeout waiting for ${url}`)}
async function cdpSession(wsUrl){const ws=new WebSocket(wsUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const pending=new Map(),events=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result||{})}else events.push(m)};const cmd=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});ws.send(JSON.stringify({id:call,method,params}));setTimeout(()=>{if(!pending.has(call))return;pending.delete(call);reject(new Error(`CDP timeout: ${method}`))},20000)});return{ws,cmd,events}}
async function evalJs(cmd,expression){const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||'Runtime.evaluate failed');return r.result?.value}
function serious(events){return events.filter(e=>e.method==='Runtime.exceptionThrown').map(e=>e.params?.exceptionDetails||{}).map(d=>({text:d.text||'',description:d.exception?.description||'',url:d.url||''})).filter(x=>/(ReferenceError|SyntaxError|TypeError|RangeError|out of memory|allocation failed)/i.test(`${x.text} ${x.description}`))}

const server=spawn('python3',['-m','http.server','4175','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const chromePath=findChrome(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'powder-scene-'));
const chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=9228',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const report={version:'21.0.12',purpose:'Scene transition scheduling, stale-work cancellation and pressure-aware asset residency gate',chrome:chromePath,checks:{},details:{},errors:[]};
try{
  await waitHttp('http://127.0.0.1:4175/index.html');
  const vr=await waitHttp('http://127.0.0.1:9228/json/version');report.details.chromeVersion=(await vr.json()).Browser;
  const pages=await(await waitHttp('http://127.0.0.1:9228/json/list')).json(),page=pages.find(x=>x.type==='page');if(!page)throw new Error('No Chrome page target');
  const{ws,cmd,events}=await cdpSession(page.webSocketDebuggerUrl);await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Log.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await cmd('Page.navigate',{url:'http://127.0.0.1:4175/index.html'});
  let ready=null;for(let i=0;i<200;i++){ready=await evalJs(cmd,`(()=>({state:document.readyState,scene:!!window.POWDER_SCENE_TRANSITION_V21012,governor:!!window.POWDER_ADAPTIVE_PRESSURE_V21011,app:!!window.POWDER_APP,image:!!window.POWDER_IMAGE_RUNTIME_V1826}))()`);if(ready.state==='complete'&&ready.scene&&ready.governor&&ready.app&&ready.image)break;await sleep(150)}
  report.details.ready=ready;report.checks.runtimeAvailable=!!(ready?.scene&&ready?.governor&&ready?.app&&ready?.image);if(!report.checks.runtimeAvailable)throw new Error('21.0.12 runtime dependencies not ready');
  const baseline=await evalJs(cmd,`(()=>({scene:window.POWDER_SCENE_TRANSITION_V21012.snapshot(),view:document.body?.dataset?.activeView||'',pressure:window.POWDER_ADAPTIVE_PRESSURE_V21011.level()}))()`);report.details.baseline=baseline;

  const viewTest=await evalJs(cmd,`(()=>{window.POWDER_APP.showView('powdex');return{view:document.body.dataset.activeView,transition:window.POWDER_SCENE_TRANSITION_V21012.snapshot()}})()`);await sleep(450);
  const viewSettled=await evalJs(cmd,`(()=>({view:document.body.dataset.activeView,transition:document.documentElement.dataset.sceneTransition,snapshot:window.POWDER_SCENE_TRANSITION_V21012.snapshot()}))()`);
  report.details.viewTest={immediate:viewTest,settled:viewSettled};report.checks.realViewTransition=viewTest.view==='powdex'&&viewSettled.view==='powdex'&&viewSettled.transition==='settled'&&viewSettled.snapshot.firstPaints>baseline.scene.firstPaints;

  const cancellation=await evalJs(cmd,`(()=>{const s=window.POWDER_SCENE_TRANSITION_V21012;s.debugReset();window.__sceneGateStale=0;window.__sceneGateFresh=0;const a=s.begin('powdex','inventory');s.schedule(()=>window.__sceneGateStale++,{priority:'low',optional:true,key:'gate-stale',token:a});const b=s.begin('inventory','settings');s.schedule(()=>window.__sceneGateFresh++,{priority:'high',optional:false,key:'gate-fresh',token:b});return{a:a.generation,b:b.generation,before:s.snapshot()}})()`);await sleep(500);
  const cancellationAfter=await evalJs(cmd,`(()=>({stale:window.__sceneGateStale,fresh:window.__sceneGateFresh,snapshot:window.POWDER_SCENE_TRANSITION_V21012.snapshot()}))()`);report.details.cancellation={...cancellation,after:cancellationAfter};report.checks.staleWorkCancelled=cancellationAfter.stale===0&&cancellationAfter.fresh===1&&cancellationAfter.snapshot.cancelled>=1;

  await evalJs(cmd,`window.POWDER_ADAPTIVE_PRESSURE_V21011.setDebugPressure('hot')`);await sleep(300);
  const hot=await evalJs(cmd,`(()=>{const s=window.POWDER_SCENE_TRANSITION_V21012,b=s.snapshot(),accepted=s.prefetch('assets/backgrounds/bg-tamer-rank-hall.webp?gate21012=hot',{priority:'low',view:'tamer'}),a=s.snapshot();return{accepted,before:b,after:a}})()`);report.details.hot=hot;report.checks.hotSuppressesOptionalPrefetch=hot.after.pressure==='hot'&&hot.accepted===false&&hot.after.pressureSkips>hot.before.pressureSkips&&hot.after.assetQueued===hot.before.assetQueued;

  await evalJs(cmd,`window.POWDER_ADAPTIVE_PRESSURE_V21011.setDebugPressure('calm')`);await sleep(300);
  const dedupe=await evalJs(cmd,`(()=>{const s=window.POWDER_SCENE_TRANSITION_V21012,b=s.snapshot();const token=s.begin('settings','powdex');const a=s.prefetch('assets/backgrounds/bg-inventory-crystal-sanctuary.webp?gate21012=dedupe',{priority:'normal',view:'inventory',token});const c=s.prefetch('assets/backgrounds/bg-inventory-crystal-sanctuary.webp?gate21012=dedupe',{priority:'normal',view:'inventory',token});return{a,c,before:b,queued:s.snapshot()}})()`);await sleep(900);
  const calmAfter=await evalJs(cmd,`window.POWDER_SCENE_TRANSITION_V21012.snapshot()`);report.details.calm={dedupe,after:calmAfter};report.checks.prefetchDeduplicated=dedupe.a===true&&dedupe.c===true&&dedupe.queued.assetQueued-dedupe.before.assetQueued===1;report.checks.calmProcessesResidency=calmAfter.pressure==='calm'&&calmAfter.assetCompleted>=dedupe.before.assetCompleted+1&&calmAfter.assetErrors===dedupe.before.assetErrors;

  const rapid=await evalJs(cmd,`(()=>{const s=window.POWDER_SCENE_TRANSITION_V21012,b=s.snapshot();window.POWDER_APP.showView('powdex');window.POWDER_APP.showView('inventory');window.POWDER_APP.showView('settings');return{view:document.body.dataset.activeView,before:b,after:s.snapshot()}})()`);await sleep(500);const rapidAfter=await evalJs(cmd,`(()=>({view:document.body.dataset.activeView,scene:document.documentElement.dataset.sceneTransition,snapshot:window.POWDER_SCENE_TRANSITION_V21012.snapshot()}))()`);report.details.rapid={...rapid,settled:rapidAfter};report.checks.rapidNavigationSettlesLatest=rapid.view==='settings'&&rapidAfter.view==='settings'&&rapidAfter.scene==='settled'&&rapidAfter.snapshot.generation>=rapid.before.generation+3;

  await evalJs(cmd,`(()=>{delete window.__sceneGateStale;delete window.__sceneGateFresh;window.POWDER_ADAPTIVE_PRESSURE_V21011.setDebugPressure(null);return true})()`);await sleep(250);
  const finalState=await evalJs(cmd,`(()=>({scene:window.POWDER_SCENE_TRANSITION_V21012.snapshot(),pressure:window.POWDER_ADAPTIVE_PRESSURE_V21011.snapshot(),synthetic:('__sceneGateStale'in window)||('__sceneGateFresh'in window)}))()`);report.details.final=finalState;report.checks.cleanupComplete=finalState.synthetic===false;
  report.details.seriousRuntimeExceptions=serious(events);report.checks.noSeriousRuntimeException=report.details.seriousRuntimeExceptions.length===0;
  const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(artifacts,'scene-transition-final.png'),Buffer.from(shot.data,'base64'));ws.close();
}catch(error){report.errors.push(String(error?.stack||error))}finally{server.kill('SIGTERM');chrome.kill('SIGTERM');try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
report.pass=report.errors.length===0&&Object.values(report.checks).every(Boolean);fs.writeFileSync(path.join(artifacts,'SCENE-TRANSITION-GATE-21.0.12.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));if(!report.pass)process.exit(1);
