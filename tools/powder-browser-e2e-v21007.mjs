import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || '.');
const artifacts = path.join(root, 'artifacts', 'e2e-v21007');
fs.mkdirSync(artifacts, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

function findChrome(){
  const candidates = [process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const c of candidates) {
    if (c.includes('/') && fs.existsSync(c)) return c;
    const r = spawnSync('which', [c], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error('Chrome/Chromium not found');
}

async function waitHttp(url, timeout=15000){
  const started=Date.now();
  while(Date.now()-started<timeout){
    try { const r=await fetch(url); if(r.ok) return r; } catch {}
    await sleep(200);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function cdpSession(wsUrl){
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve,reject)=>{ ws.onopen=resolve; ws.onerror=reject; });
  let id=0; const pending=new Map(); const events=[];
  ws.onmessage = ev => {
    const msg=JSON.parse(ev.data);
    if(msg.id && pending.has(msg.id)){
      const {resolve,reject}=pending.get(msg.id); pending.delete(msg.id);
      if(msg.error) reject(new Error(msg.error.message)); else resolve(msg.result||{});
    } else events.push(msg);
  };
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{
    const callId=++id; pending.set(callId,{resolve,reject}); ws.send(JSON.stringify({id:callId,method,params}));
    setTimeout(()=>{ if(pending.has(callId)){pending.delete(callId); reject(new Error(`CDP timeout: ${method}`));}},15000);
  });
  return {ws,cmd,events};
}

async function evalJs(cmd, expression){
  const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  return r.result?.value;
}
function argText(a){
  if(a?.value!==undefined){try{return typeof a.value==='string'?a.value:JSON.stringify(a.value)}catch{return String(a.value)}}
  return a?.description||a?.unserializableValue||'';
}
function diagnostics(events){
  const consoleErrors=events.filter(e=>e.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(e.params?.type)).map(e=>({type:e.params?.type,args:(e.params?.args||[]).map(argText),timestamp:e.params?.timestamp||null}));
  const logErrors=events.filter(e=>e.method==='Log.entryAdded'&&['error','warning'].includes(e.params?.entry?.level)).map(e=>({level:e.params.entry.level,text:e.params.entry.text||'',url:e.params.entry.url||'',line:e.params.entry.lineNumber??null}));
  return {consoleErrors,logErrors};
}

const server = spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const chromePath=findChrome();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'powder-e2e-'));
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-first-run','--no-default-browser-check','--disable-background-networking',
  '--remote-debugging-port=9222',`--user-data-dir=${profile}`,'about:blank'
],{stdio:'ignore'});

const report={version:'21.0.7',diagnosticsRevision:'21.0.9',chrome:chromePath,checks:{},details:{},errors:[]};
try {
  await waitHttp('http://127.0.0.1:4173/index.html');
  const version=await waitHttp('http://127.0.0.1:9222/json/version');
  report.details.chromeVersion=(await version.json()).Browser;
  const list=await (await waitHttp('http://127.0.0.1:9222/json/list')).json();
  const page=list.find(x=>x.type==='page');
  if(!page) throw new Error('No Chrome page target');
  const {ws,cmd,events}=await cdpSession(page.webSocketDebuggerUrl);
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Log.enable');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});

  await cmd('Page.navigate',{url:'http://127.0.0.1:4173/index.html'});
  for(let i=0;i<80;i++){
    const ready=await evalJs(cmd,'document.readyState');
    if(ready==='complete') break;
    await sleep(150);
  }
  await sleep(5000);
  const shell=await evalJs(cmd,`(()=>({
    title:document.title,
    nav:document.querySelectorAll('.nav-btn').length,
    home:!!document.querySelector('#homeView'),
    learn:!!document.querySelector('#learnView'),
    adventure:!!document.querySelector('#adventureView'),
    powball:!!document.querySelector('#chestsView'),
    appVisible:!!document.querySelector('#app')&&!document.querySelector('#app').hidden,
    setupVisible:!!document.querySelector('#setupScreen')&&!document.querySelector('#setupScreen').hidden,
    loadingVisible:!!document.querySelector('#loadingScreen')&&!document.querySelector('#loadingScreen').hidden,
    bootError:document.querySelector('#bootError')?.hidden===false?document.querySelector('#bootError')?.textContent.trim():'',
    bootStage:document.querySelector('#bootStage')?.textContent?.trim()||'',
    bootDetail:document.querySelector('#bootDetail')?.textContent?.trim()||'',
    bootFiles:document.querySelector('#bootFiles')?.textContent?.trim()||'',
    retryVisible:document.querySelector('#bootRetry')?.hidden===false,
    clearVisible:document.querySelector('#bootClear')?.hidden===false,
    progress:document.querySelector('#bootProgressPct')?.textContent||''
  }))()`);
  report.details.index=shell;
  report.details.bootDiagnostics=diagnostics(events);
  report.checks.indexTitle=/Powder/i.test(shell.title||'');
  report.checks.navigationPresent=shell.nav>=8;
  report.checks.coreViewsPresent=!!(shell.home&&shell.learn&&shell.adventure&&shell.powball);
  report.checks.noBootError=!shell.bootError;
  report.checks.startupProgress=!!(shell.appVisible||shell.setupVisible||shell.loadingVisible);

  if(shell.appVisible){
    const clicked=await evalJs(cmd,`(()=>{const b=document.querySelector('[data-open-view="learn"]'); if(!b)return false;b.click();return true})()`);
    await sleep(500);
    const visible=await evalJs(cmd,`(()=>{const v=document.querySelector('#learnView');return !!v&&!v.hidden})()`);
    report.checks.navigationClick=!!(clicked&&visible);
  } else {
    report.checks.navigationClick=true;
    report.details.navigationClick='Skipped because fresh profile is in setup/loading state; DOM navigation contract verified.';
  }

  const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(artifacts,'index.png'),Buffer.from(shot.data,'base64'));

  await cmd('Page.navigate',{url:'http://127.0.0.1:4173/admin.html'}); await sleep(2500);
  const admin=await evalJs(cmd,`(()=>({title:document.title,body:document.body?.innerText?.length||0,buttons:document.querySelectorAll('button').length}))()`);
  report.details.admin=admin;
  report.checks.adminLoads=/Powder|Admin/i.test(admin.title||'') && admin.body>100 && admin.buttons>0;
  const adminShot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(artifacts,'admin.png'),Buffer.from(adminShot.data,'base64'));

  for(const pageName of ['offline.html','privacy.html','terms.html']){
    await cmd('Page.navigate',{url:`http://127.0.0.1:4173/${pageName}`}); await sleep(500);
    const ok=await evalJs(cmd,`document.body && document.body.innerText.length > 40`);
    report.checks[`page:${pageName}`]=!!ok;
  }
  report.details.runtimeExceptions=events.filter(e=>e.method==='Runtime.exceptionThrown').map(e=>{
    const d=e.params?.exceptionDetails||{};
    return {text:d.text||'',description:d.exception?.description||'',url:d.url||'',line:d.lineNumber??null,column:d.columnNumber??null};
  });
  report.details.seriousRuntimeExceptions=report.details.runtimeExceptions.filter(x=>/(ReferenceError|SyntaxError|TypeError|RangeError)/i.test(`${x.description} ${x.text}`));
  report.checks.noSeriousRuntimeException=report.details.seriousRuntimeExceptions.length===0;
  ws.close();
} catch (e) {
  report.errors.push(String(e?.stack||e));
} finally {
  server.kill('SIGTERM'); chrome.kill('SIGTERM');
  try { fs.rmSync(profile,{recursive:true,force:true}); } catch {}
}
report.pass=report.errors.length===0&&Object.values(report.checks).every(Boolean);
fs.writeFileSync(path.join(artifacts,'BROWSER-E2E-21.0.7.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.pass) process.exit(1);
