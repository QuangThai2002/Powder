import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || '.');
const artifacts = path.join(root, 'artifacts', 'soak-v21010');
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
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {}
    await sleep(180);
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
    } else {
      events.push(message);
    }
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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'Runtime.evaluate failed');
  return r.result?.value;
}

function metricMap(raw) {
  const out = {};
  for (const m of raw.metrics || []) out[m.name] = m.value;
  return out;
}

function pickMetrics(raw) {
  const m = metricMap(raw);
  return {
    Nodes: m.Nodes || 0,
    JSHeapUsedSize: m.JSHeapUsedSize || 0,
    LayoutCount: m.LayoutCount || 0,
    RecalcStyleCount: m.RecalcStyleCount || 0,
    TaskDuration: m.TaskDuration || 0,
    ScriptDuration: m.ScriptDuration || 0
  };
}

function seriousExceptions(events) {
  return events
    .filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => e.params?.exceptionDetails || {})
    .map(d => ({
      text: d.text || '',
      description: d.exception?.description || '',
      url: d.url || '',
      line: d.lineNumber ?? null,
      column: d.columnNumber ?? null
    }))
    .filter(x => /(ReferenceError|SyntaxError|TypeError|RangeError|out of memory|allocation failed)/i.test(`${x.text} ${x.description}`));
}

const server = spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chromePath = findChrome();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'powder-soak-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--remote-debugging-port=9226', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });

const report = {
  version: '21.0.10',
  purpose: 'Long-session DOM/heap/runtime cleanup regression gate',
  chrome: chromePath,
  checks: {},
  details: { rounds: [] },
  errors: []
};

try {
  await waitHttp('http://127.0.0.1:4173/index.html');
  const version = await waitHttp('http://127.0.0.1:9226/json/version');
  report.details.chromeVersion = (await version.json()).Browser;
  const pages = await (await waitHttp('http://127.0.0.1:9226/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  if (!page) throw new Error('No Chrome page target');

  const { ws, cmd, events } = await cdpSession(page.webSocketDebuggerUrl);
  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Log.enable');
  await cmd('Performance.enable');
  await cmd('HeapProfiler.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: 'http://127.0.0.1:4173/index.html' });

  for (let i = 0; i < 160; i++) {
    const ready = await evalJs(cmd, `(()=>({
      state:document.readyState,
      lifecycle:!!window.POWDER_RUNTIME_LIFECYCLE_V1826,
      image:!!window.POWDER_IMAGE_RUNTIME_V1826,
      performance:!!window.POWDER_PERFORMANCE_V1757,
      views:document.querySelectorAll('.view').length
    }))()`);
    if (ready.state === 'complete' && ready.lifecycle && ready.image && ready.performance && ready.views >= 4) break;
    await sleep(150);
  }

  const capabilities = await evalJs(cmd, `(()=>({
    lifecycle:!!window.POWDER_RUNTIME_LIFECYCLE_V1826,
    image:!!window.POWDER_IMAGE_RUNTIME_V1826,
    performance:!!window.POWDER_PERFORMANCE_V1757,
    views:[...document.querySelectorAll('.view')].map(v=>v.id).filter(Boolean),
    activeView:document.body?.dataset?.activeView||'',
    hidden:document.hidden
  }))()`);
  report.details.capabilities = capabilities;
  report.checks.lifecycleRuntimeAvailable = capabilities.lifecycle;
  report.checks.imageRuntimeAvailable = capabilities.image;
  report.checks.performanceRuntimeAvailable = capabilities.performance;
  report.checks.viewCoverage = capabilities.views.length >= 4;

  if (!Object.values(report.checks).every(Boolean)) throw new Error('Required Powder runtime APIs were not ready for soak test');

  const savedState = await evalJs(cmd, `(()=>({
    bodyActive:document.body?.dataset?.activeView||'',
    views:[...document.querySelectorAll('.view')].map(v=>({id:v.id,hidden:v.hidden})),
    setup:document.querySelector('#setupScreen')?document.querySelector('#setupScreen').hidden:null
  }))()`);
  report.details.savedState = savedState;

  await cmd('HeapProfiler.collectGarbage');
  await sleep(180);
  const baselineMetrics = pickMetrics(await cmd('Performance.getMetrics'));
  const baselineDiag = await evalJs(cmd, `(()=>({
    lifecycle:window.POWDER_RUNTIME_LIFECYCLE_V1826?.diagnostics?.()||null,
    image:window.POWDER_IMAGE_RUNTIME_V1826?.diagnostics?.()||null,
    transient:document.querySelectorAll('.fx-ripple,.view-vfx-enter.is-orphan,[data-vfx-transient="true"]').length,
    nodes:document.querySelectorAll('*').length
  }))()`);
  report.details.baseline = { metrics: baselineMetrics, diagnostics: baselineDiag };

  const viewIds = capabilities.views.slice(0, 12);
  const rounds = 5;
  for (let round = 0; round < rounds; round++) {
    const step = await evalJs(cmd, `(async()=>{
      const ids=${JSON.stringify(viewIds)};
      const lifecycle=window.POWDER_RUNTIME_LIFECYCLE_V1826;
      const images=window.POWDER_IMAGE_RUNTIME_V1826;
      let touched=0;
      for(const id of ids){
        const view=document.getElementById(id);if(!view)continue;
        document.body.dataset.activeView=id;
        window.dispatchEvent(new CustomEvent('powder:view-changed',{detail:{view:id,source:'soak-v21010'}}));
        images?.prioritize?.(view);
        const transient=document.createElement('i');
        transient.dataset.vfxTransient='true';
        transient.hidden=true;
        document.body.appendChild(transient);
        lifecycle?.sweep?.();
        images?.evictHidden?.(24);
        touched++;
        await new Promise(r=>setTimeout(r,24));
      }
      lifecycle?.cleanup?.();
      lifecycle?.sweep?.();
      images?.evictHidden?.(48);
      await new Promise(r=>setTimeout(r,80));
      return{touched,transient:document.querySelectorAll('.fx-ripple,.view-vfx-enter.is-orphan,[data-vfx-transient="true"]').length,lifecycle:lifecycle?.diagnostics?.()||null,image:images?.diagnostics?.()||null};
    })()`);
    await cmd('HeapProfiler.collectGarbage');
    await sleep(180);
    const metrics = pickMetrics(await cmd('Performance.getMetrics'));
    report.details.rounds.push({ round: round + 1, step, metrics });
  }

  await evalJs(cmd, `(()=>{
    const saved=${JSON.stringify(savedState)};
    for(const item of saved.views||[]){const v=document.getElementById(item.id);if(v)v.hidden=!!item.hidden}
    if(document.body)document.body.dataset.activeView=saved.bodyActive||'';
    const setup=document.querySelector('#setupScreen');if(setup&&saved.setup!==null)setup.hidden=!!saved.setup;
    window.POWDER_RUNTIME_LIFECYCLE_V1826?.cleanup?.();
    window.POWDER_RUNTIME_LIFECYCLE_V1826?.sweep?.();
    return true;
  })()`);
  await cmd('HeapProfiler.collectGarbage');
  await sleep(220);

  const finalMetrics = pickMetrics(await cmd('Performance.getMetrics'));
  const finalState = await evalJs(cmd, `(()=>({
    activeView:document.body?.dataset?.activeView||'',
    views:[...document.querySelectorAll('.view')].map(v=>({id:v.id,hidden:v.hidden})),
    setup:document.querySelector('#setupScreen')?document.querySelector('#setupScreen').hidden:null,
    transient:document.querySelectorAll('.fx-ripple,.view-vfx-enter.is-orphan,[data-vfx-transient="true"]').length,
    lifecycle:window.POWDER_RUNTIME_LIFECYCLE_V1826?.diagnostics?.()||null,
    image:window.POWDER_IMAGE_RUNTIME_V1826?.diagnostics?.()||null,
    nodes:document.querySelectorAll('*').length
  }))()`);
  report.details.final = { metrics: finalMetrics, state: finalState };

  const heapAllowance = Math.min(baselineMetrics.JSHeapUsedSize * 1.18, baselineMetrics.JSHeapUsedSize + 8 * 1024 * 1024);
  const nodeAllowance = Math.min(baselineMetrics.Nodes * 1.08, baselineMetrics.Nodes + 600);
  const lateHeapSpreadAllowance = 3 * 1024 * 1024;
  const roundHeaps = report.details.rounds.map(x => x.metrics.JSHeapUsedSize);
  const lastThree = roundHeaps.slice(-3);
  const lateHeapSpread = lastThree.length ? Math.max(...lastThree) - Math.min(...lastThree) : Infinity;
  const savedHidden = new Map((savedState.views || []).map(x => [x.id, !!x.hidden]));
  const finalHidden = new Map((finalState.views || []).map(x => [x.id, !!x.hidden]));
  const viewStateRestored = savedHidden.size === finalHidden.size && [...savedHidden].every(([id, hidden]) => finalHidden.get(id) === hidden);

  report.details.budgets = {
    heapAllowance,
    nodeAllowance,
    lateHeapSpreadAllowance,
    baselineHeap: baselineMetrics.JSHeapUsedSize,
    finalHeap: finalMetrics.JSHeapUsedSize,
    heapGrowthRatio: baselineMetrics.JSHeapUsedSize ? finalMetrics.JSHeapUsedSize / baselineMetrics.JSHeapUsedSize : null,
    baselineNodes: baselineMetrics.Nodes,
    finalNodes: finalMetrics.Nodes,
    nodeGrowthRatio: baselineMetrics.Nodes ? finalMetrics.Nodes / baselineMetrics.Nodes : null,
    lateHeapSpread
  };

  report.checks.allRoundsExecuted = report.details.rounds.length === rounds && report.details.rounds.every(x => x.step?.touched >= 4);
  report.checks.transientsPurged = report.details.rounds.every(x => x.step?.transient === 0) && finalState.transient === 0;
  report.checks.heapReturnsWithinBudget = finalMetrics.JSHeapUsedSize <= heapAllowance;
  report.checks.nodesReturnWithinBudget = finalMetrics.Nodes <= nodeAllowance;
  report.checks.lateHeapStabilizes = lateHeapSpread <= lateHeapSpreadAllowance;
  report.checks.stateRestored = finalState.activeView === (savedState.bodyActive || '') && finalState.setup === savedState.setup && viewStateRestored;
  report.details.seriousRuntimeExceptions = seriousExceptions(events);
  report.checks.noSeriousRuntimeException = report.details.seriousRuntimeExceptions.length === 0;

  const shot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(artifacts, 'soak-final.png'), Buffer.from(shot.data, 'base64'));
  ws.close();
} catch (error) {
  report.errors.push(String(error?.stack || error));
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}

report.pass = report.errors.length === 0 && Object.values(report.checks).every(Boolean);
fs.writeFileSync(path.join(artifacts, 'LONG-SESSION-SOAK-21.0.10.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exit(1);
