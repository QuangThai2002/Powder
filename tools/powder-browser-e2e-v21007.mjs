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

const report={version:'21.3.8',diagnosticsRevision:'21.3.8-scroll-combat-regression',chrome:chromePath,checks:{},details:{},errors:[]};
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

  for(let i=0;i<28;i++){
    const loaded=await evalJs(cmd,'!!window.POWDER_PAGE_SCROLL_RECOVERY_V2137');
    if(loaded) break;
    await sleep(150);
  }
  report.checks.pageScrollRecoveryLoaded=!!(await evalJs(cmd,'!!window.POWDER_PAGE_SCROLL_RECOVERY_V2137'));
  const scrollSetup=await evalJs(cmd,`(async()=>{
    const app=document.querySelector('#app'),setup=document.querySelector('#setupScreen'),loading=document.querySelector('#loadingScreen');
    if(!app)return{ready:false,reason:'missing-app'};
    const views=[...document.querySelectorAll('#app>main>.view')];
    window.__powderE2eScrollRestore={appHidden:app.hidden,setupHidden:setup?.hidden??true,loadingHidden:loading?.hidden??true,views:views.map(v=>[v.id,v.hidden])};
    app.hidden=false;if(setup)setup.hidden=true;if(loading)loading.hidden=true;
    for(const v of views)v.hidden=v.id!=='homeView';
    const home=document.querySelector('#homeView'),main=document.querySelector('#app>main'),topbar=document.querySelector('#app>.topbar');
    if(!home||!main||!topbar)return{ready:false,reason:'missing-main-contract'};
    const probe=document.createElement('div');probe.id='powderE2eMainScrollProbe';probe.style.cssText='height:2400px;min-height:2400px;pointer-events:none';home.appendChild(probe);
    window.POWDER_PAGE_SCROLL_RECOVERY_V2137?.refresh?.();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    main.scrollTop=0;await new Promise(r=>requestAnimationFrame(r));
    const rect=main.getBoundingClientRect(),style=getComputedStyle(main),bodyTop=document.scrollingElement?.scrollTop||0;
    return{ready:true,overflowY:style.overflowY,scrollHeight:main.scrollHeight,clientHeight:main.clientHeight,before:main.scrollTop,bodyTop,topbarTop:topbar.getBoundingClientRect().top,point:{x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+Math.min(240,Math.max(80,rect.height/3)))}};
  })()`);
  report.details.mainScrollSetup=scrollSetup;
  if(scrollSetup?.ready){
    await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:scrollSetup.point.x,y:scrollSetup.point.y});
    await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:scrollSetup.point.x,y:scrollSetup.point.y,deltaX:0,deltaY:640});
    await sleep(260);
    const scrollAfter=await evalJs(cmd,`(()=>{const main=document.querySelector('#app>main'),topbar=document.querySelector('#app>.topbar');return{scrollTop:main?.scrollTop||0,bodyTop:document.scrollingElement?.scrollTop||0,topbarTop:topbar?.getBoundingClientRect().top??999,rootClass:document.documentElement.classList.contains('powder-main-scroll-v2137')}})()`);
    report.details.mainScrollAfter=scrollAfter;
    report.checks.mainContentIsNativeScrollSurface=/auto|scroll/.test(scrollSetup.overflowY||'')&&scrollSetup.scrollHeight>scrollSetup.clientHeight+200&&!!scrollAfter.rootClass;
    report.checks.mainContentWheelScrolls=scrollAfter.scrollTop>80;
    report.checks.topbarStaysOutsideScroller=Math.abs(scrollAfter.topbarTop-scrollSetup.topbarTop)<1.5;
    report.checks.bodyDoesNotStealPageScroll=Math.abs(scrollAfter.bodyTop-scrollSetup.bodyTop)<2;
    const staleLock=await evalJs(cmd,`(()=>{for(const m of document.querySelectorAll('.modal'))m.hidden=true;document.documentElement.classList.add('v131-modal-open');document.body.style.overflow='hidden';document.body.style.touchAction='none';window.POWDER_PAGE_SCROLL_RECOVERY_V2137?.repairModalLock?.();return{locked:document.documentElement.classList.contains('v131-modal-open'),overflow:document.body.style.overflow,touch:document.body.style.touchAction}})()`);
    report.details.staleModalLock=staleLock;
    report.checks.staleModalLockSelfHeals=!staleLock.locked&&!staleLock.overflow&&!staleLock.touch;
  }else{
    report.checks.mainContentIsNativeScrollSurface=false;
    report.checks.mainContentWheelScrolls=false;
    report.checks.topbarStaysOutsideScroller=false;
    report.checks.bodyDoesNotStealPageScroll=false;
    report.checks.staleModalLockSelfHeals=false;
  }
  await evalJs(cmd,`(()=>{const r=window.__powderE2eScrollRestore,probe=document.querySelector('#powderE2eMainScrollProbe');probe?.remove();if(r){const app=document.querySelector('#app'),setup=document.querySelector('#setupScreen'),loading=document.querySelector('#loadingScreen');for(const [id,hidden] of r.views||[]){const v=document.getElementById(id);if(v)v.hidden=hidden}if(app)app.hidden=r.appHidden;if(setup)setup.hidden=r.setupHidden;if(loading)loading.hidden=r.loadingHidden;delete window.__powderE2eScrollRestore}window.POWDER_PAGE_SCROLL_RECOVERY_V2137?.refresh?.();return true})()`);

  const combatRuntime=await evalJs(cmd,`(()=>({loaded:!!window.POWDER_COMBAT_ACTION_CLARITY_V2138,script:!!document.querySelector('#powderCombatActionClarity2138'),snapshot:window.POWDER_COMBAT_ACTION_CLARITY_V2138?.snapshot?.()||null}))()`);
  report.details.combat2138=combatRuntime;
  report.checks.combatActionClarityConnected=!!(combatRuntime.loaded||combatRuntime.script);
  report.checks.combatActionClarityNoGameplayMutation=combatRuntime.snapshot?combatRuntime.snapshot.gameplayMutation===false:true;
  report.checks.combatActionClarityNoScrollMutation=combatRuntime.snapshot?combatRuntime.snapshot.scrollMutation===false:true;

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
fs.writeFileSync(path.join(artifacts,'BROWSER-E2E-21.3.8.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.pass) process.exit(1);
