import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || '.');
const artifacts = path.join(root, 'artifacts', 'pressure-v21011');
fs.mkdirSync(artifacts, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function findChrome() {
  for (const candidate of [process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const r = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error('Chrome/Chromium not found');
}
async function waitHttp(url, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { const r = await fetch(url); if (r.ok) return r; } catch {}
    await sleep(150);
  }
  throw new Error(`Timeout waiting for ${url}`);
}
async function cdpSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const p = pending.get(message.id);
      pending.delete(message.id);
      message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result || {});
    } else events.push(message);
  };
  const cmd = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    ws.send(JSON.stringify({ id: callId, method, params }));
    setTimeout(() => {
      if (!pending.has(callId)) return;
      pending.delete(callId);
      reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
  });
  return { ws, cmd, events };
}
async function evalJs(cmd, expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || r.exceptionDetails.exception?.description || 'Runtime.evaluate failed');
  return r.result?.value;
}
function seriousExceptions(events) {
  return events.filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => e.params?.exceptionDetails || {})
    .map(d => ({ text: d.text || '', description: d.exception?.description || '', url: d.url || '' }))
    .filter(x => /(ReferenceError|SyntaxError|TypeError|RangeError|out of memory|allocation failed)/i.test(`${x.text} ${x.description}`));
}

const server = spawn('python3', ['-m', 'http.server', '4174', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chromePath = findChrome();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'powder-pressure-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--remote-debugging-port=9227', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });

const report = {
  version: '21.0.11',
  purpose: 'Adaptive resource-pressure behavior and combat-priority regression gate',
  chrome: chromePath,
  checks: {},
  details: {},
  errors: []
};

try {
  await waitHttp('http://127.0.0.1:4174/index.html');
  const version = await waitHttp('http://127.0.0.1:9227/json/version');
  report.details.chromeVersion = (await version.json()).Browser;
  const pages = await (await waitHttp('http://127.0.0.1:9227/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  if (!page) throw new Error('No Chrome page target');
  const { ws, cmd, events } = await cdpSession(page.webSocketDebuggerUrl);
  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Log.enable');
  await cmd('Performance.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: 'http://127.0.0.1:4174/index.html' });

  let ready = null;
  for (let i = 0; i < 180; i++) {
    ready = await evalJs(cmd, `(()=>({
      state:document.readyState,
      governor:!!window.POWDER_ADAPTIVE_PRESSURE_V21011,
      image:!!window.POWDER_IMAGE_RUNTIME_V1826,
      lifecycle:!!window.POWDER_RUNTIME_LIFECYCLE_V1826,
      performance:!!window.POWDER_PERFORMANCE_V1757,
      app:!!window.POWDER_APP
    }))()`);
    if (ready.state === 'complete' && ready.governor && ready.image && ready.lifecycle && ready.performance) break;
    await sleep(150);
  }
  report.details.ready = ready;
  report.checks.governorAvailable = !!ready?.governor;
  report.checks.runtimeDependenciesAvailable = !!(ready?.image && ready?.lifecycle && ready?.performance);
  if (!report.checks.governorAvailable || !report.checks.runtimeDependenciesAvailable) throw new Error('Adaptive pressure runtime did not become ready');

  const baseline = await evalJs(cmd, `(()=>({
    snapshot:window.POWDER_ADAPTIVE_PRESSURE_V21011.snapshot(),
    activeView:document.body?.dataset?.activeView||'',
    rootPressure:document.documentElement.dataset.resourcePressure||null
  }))()`);
  report.details.baseline = baseline;

  const setup = await evalJs(cmd, `(()=>{
    const normal=document.createElement('i');
    normal.id='pressureGateNormal';
    normal.style.cssText='position:fixed;left:-20px;top:-20px;width:1px;height:1px';
    document.body.appendChild(normal);
    const keep=document.createElement('i');
    keep.id='pressureGateKeep';
    keep.dataset.pressureKeep='1';
    keep.style.cssText='position:fixed;left:-20px;top:-20px;width:1px;height:1px';
    document.body.appendChild(keep);
    window.__pressureNormalAnim=normal.animate([{opacity:.9},{opacity:1}],{duration:1200,iterations:Infinity});
    window.__pressureKeepAnim=keep.animate([{opacity:.9},{opacity:1}],{duration:1200,iterations:Infinity});
    return {
      normal:window.__pressureNormalAnim.playState,
      keep:window.__pressureKeepAnim.playState,
      activeView:document.body?.dataset?.activeView||''
    };
  })()`);
  report.details.syntheticSetup = setup;

  await evalJs(cmd, `window.POWDER_ADAPTIVE_PRESSURE_V21011.setDebugPressure('hot')`);
  await sleep(900);
  const hot = await evalJs(cmd, `(()=>({
    level:window.POWDER_ADAPTIVE_PRESSURE_V21011.level(),
    snapshot:window.POWDER_ADAPTIVE_PRESSURE_V21011.snapshot(),
    root:document.documentElement.dataset.resourcePressure,
    classHot:document.documentElement.classList.contains('pressure-hot'),
    normal:window.__pressureNormalAnim?.playState||null,
    keep:window.__pressureKeepAnim?.playState||null
  }))()`);
  report.details.hot = hot;
  report.checks.hotStateApplied = hot.level === 'hot' && hot.root === 'hot' && hot.classHot === true;
  report.checks.decorativeAnimationPaused = hot.normal === 'paused';
  report.checks.keepAnimationProtected = hot.keep === 'running';

  const savedView = baseline.activeView || '';
  await evalJs(cmd, `(()=>{document.body.dataset.activeView='battle';window.POWDER_ADAPTIVE_PRESSURE_V21011.setDebugPressure('critical');return true})()`);
  await sleep(900);
  const critical = await evalJs(cmd, `(()=>({
    level:window.POWDER_ADAPTIVE_PRESSURE_V21011.level(),
    snapshot:window.POWDER_ADAPTIVE_PRESSURE_V21011.snapshot(),
    priority:document.documentElement.dataset.resourcePressurePriority||'',
    keep:window.__pressureKeepAnim?.playState||null
  }))()`);
  report.details.critical = critical;
  report.checks.criticalStateApplied = critical.level === 'critical';
  report.checks.combatPriorityProtected = critical.snapshot?.criticalScene === true && critical.priority === 'combat' && critical.keep === 'running';

  await evalJs(cmd, `(()=>{document.body.dataset.activeView=${JSON.stringify(savedView)};window.POWDER_ADAPTIVE_PRESSURE_V21011.setDebugPressure('calm');return true})()`);
  await sleep(650);
  const calm = await evalJs(cmd, `(()=>({
    level:window.POWDER_ADAPTIVE_PRESSURE_V21011.level(),
    normal:window.__pressureNormalAnim?.playState||null,
    keep:window.__pressureKeepAnim?.playState||null,
    snapshot:window.POWDER_ADAPTIVE_PRESSURE_V21011.snapshot()
  }))()`);
  report.details.calm = calm;
  report.checks.recoveryResumesGovernorPausedAnimation = calm.level === 'calm' && calm.normal === 'running' && calm.keep === 'running';

  await evalJs(cmd, `(()=>{
    window.__pressureNormalAnim?.cancel();window.__pressureKeepAnim?.cancel();
    document.getElementById('pressureGateNormal')?.remove();
    document.getElementById('pressureGateKeep')?.remove();
    delete window.__pressureNormalAnim;delete window.__pressureKeepAnim;
    window.POWDER_ADAPTIVE_PRESSURE_V21011.setDebugPressure(null);
    return true;
  })()`);
  await sleep(250);

  const finalState = await evalJs(cmd, `(()=>({
    activeView:document.body?.dataset?.activeView||'',
    pressure:window.POWDER_ADAPTIVE_PRESSURE_V21011.snapshot(),
    syntheticLeft:!!document.querySelector('#pressureGateNormal,#pressureGateKeep')
  }))()`);
  report.details.final = finalState;
  report.checks.stateRestored = finalState.activeView === savedView && finalState.syntheticLeft === false;
  report.details.seriousRuntimeExceptions = seriousExceptions(events);
  report.checks.noSeriousRuntimeException = report.details.seriousRuntimeExceptions.length === 0;

  const shot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(artifacts, 'pressure-final.png'), Buffer.from(shot.data, 'base64'));
  ws.close();
} catch (error) {
  report.errors.push(String(error?.stack || error));
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}

report.pass = report.errors.length === 0 && Object.values(report.checks).every(Boolean);
fs.writeFileSync(path.join(artifacts, 'ADAPTIVE-PRESSURE-GATE-21.0.11.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exit(1);
