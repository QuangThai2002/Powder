import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=path.resolve(process.argv[2]||process.cwd());
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const failures=[];
const checks=[];
const check=(name,pass,detail='')=>{checks.push({name,pass:!!pass,detail});if(!pass)failures.push(`${name}${detail?`: ${detail}`:''}`)};
const walk=(dir,predicate)=>{const out=[];if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...walk(p,predicate));else if(predicate(p))out.push(p)}return out};

const requiredRoot=['index.html','admin.html','offline.html','privacy.html','terms.html','manifest.webmanifest','service-worker.js','_headers','_redirects','netlify.toml','vercel.json','robots.txt'];
check('required root runtime files',requiredRoot.every(exists),requiredRoot.filter(x=>!exists(x)).join(', '));
const forbidden=['docs','tests','release.json'];
check('legacy non-runtime artifacts removed',forbidden.every(x=>!exists(x)),forbidden.filter(exists).join(', '));

const workflows=exists('.github/workflows')?fs.readdirSync(path.join(root,'.github/workflows')).sort():[];
check('single consolidated workflow',JSON.stringify(workflows)===JSON.stringify(['powder-ci.yml']),workflows.join(', '));
const tools=exists('tools')?fs.readdirSync(path.join(root,'tools')).sort():[];
const expectedTools=['powder-browser-e2e-v21007.mjs','powder-project-gate-v21214.mjs'];
check('tools directory is lean',JSON.stringify(tools)===JSON.stringify(expectedTools),tools.join(', '));

const provenOrphans=[
  'js/learning-daily-study-orchestrator-v2115.js','js/learning-mastery-recovery-v2116.js','js/learning-daily-rotation-runner-v2119.js','js/learning-command-center-v2120.js',
  'js/learning-performance-hardening-v2125.js','js/learning-session-continuity-v2126.js','js/learning-runtime-recovery-v21210.js','js/runtime-clean-presentation-v2129.js',
  'js/admin-official-launch-v2000.js','js/admin-reliability-v169.js','js/admin-security-v2030.js','js/security-status-v2030.js',
  'css/admin-official-launch-v2000.css','css/admin-reliability-v169.css','css/admin-security-v2030.css','css/save-integrity-v20170.css'
];
check('proven runtime orphans stay removed',provenOrphans.every(p=>!exists(p)),provenOrphans.filter(exists).join(', '));

const htmlFiles=['index.html','admin.html','offline.html','privacy.html','terms.html'];
const missingRefs=[];
for(const file of htmlFiles){
  const source=read(file);
  for(const m of source.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)){
    const u=m[1];
    if(!u||/^(?:https?:|data:|mailto:|tel:|#)/i.test(u))continue;
    const clean=u.replace(/^\.\//,'');
    if(!exists(clean))missingRefs.push(`${file} -> ${u}`);
  }
}
check('HTML local references resolve',missingRefs.length===0,missingRefs.slice(0,12).join(' | '));

const jsFiles=[...walk(path.join(root,'js'),p=>p.endsWith('.js')),path.join(root,'service-worker.js'),...walk(path.join(root,'tools'),p=>p.endsWith('.mjs'))];
const badJs=[];
for(const file of jsFiles){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)badJs.push(`${rel(file)}: ${(r.stderr||r.stdout||'syntax error').trim().slice(0,180)}`)}
check('JavaScript syntax',badJs.length===0,badJs.slice(0,8).join(' | '));

const cssFiles=walk(path.join(root,'css'),p=>p.endsWith('.css'));
const badCss=[];
for(const file of cssFiles){const source=fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');let depth=0,broken=false;for(const ch of source){if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth<0){broken=true;break}}}if(broken||depth!==0)badCss.push(rel(file))}
check('CSS brace structure',badCss.length===0,badCss.slice(0,12).join(', '));

const tsFiles=walk(path.join(root,'server/supabase/functions'),p=>p.endsWith('.ts'));
const badTs=[];
for(const file of tsFiles){const r=spawnSync(process.execPath,['--experimental-strip-types','--check',file],{encoding:'utf8'});if(r.status!==0)badTs.push(`${rel(file)}: ${(r.stderr||r.stdout||'syntax error').trim().slice(0,180)}`)}
check('server edge TypeScript syntax',badTs.length===0,badTs.slice(0,8).join(' | '));

const boot=read('js/boot-loader-v21004.js');
const manifestStart=boot.indexOf('const MANIFEST=')+15;
const manifestEnd=boot.indexOf('];\nconst SCRIPT_ORDER',manifestStart)+1;
let manifest=[];
try{manifest=JSON.parse(boot.slice(manifestStart,manifestEnd))}catch(e){failures.push(`boot manifest parse: ${e.message}`)}
const declaredHash=boot.match(/MANIFEST_HASH="([0-9a-f]+)"/)?.[1]||'';
const calculatedHash=crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0,16);
check('Boot Loader identity',boot.includes("const VERSION='21.0.4'")&&declaredHash==='9a3d2db0b19ce1a1'&&calculatedHash===declaredHash,`declared=${declaredHash} calculated=${calculatedHash}`);
const badManifest=[];
for(const item of manifest){const file=path.join(root,item.u);if(!fs.existsSync(file)){badManifest.push(`${item.u}: missing`);continue}const bytes=fs.readFileSync(file);const digest=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);if(bytes.length!==item.s||digest!==item.r)badManifest.push(`${item.u}: ${bytes.length}/${digest} != ${item.s}/${item.r}`)}
check('complete Boot manifest integrity',manifest.length>1000&&badManifest.length===0,`entries=${manifest.length}; ${badManifest.slice(0,6).join(' | ')}`);

const canonicalAudio=['assets/audio/combat/user-combat-bgm.mp3','assets/audio/domain/domain-voice-usercut-1.m4a','assets/audio/domain/domain-voice-usercut-2.m4a','assets/audio/domain/domain-voice-usercut-3.m4a','assets/audio/domain/domain-voice-usercut-4.m4a'];
check('canonical combat audio protected',canonicalAudio.every(p=>exists(p)&&manifest.some(x=>x.u===p)),canonicalAudio.filter(p=>!exists(p)||!manifest.some(x=>x.u===p)).join(', '));

const index=read('index.html');
check('post-boot Learning runtime remains connected',index.includes('learning-srs-intelligence-v2114.js')&&exists('js/learning-srs-intelligence-v2114.js'),'SRS loader missing');
check('logo asset remains connected',index.includes('assets/ui/powder-logo-project.webp')&&exists('assets/ui/powder-logo-project.webp'),'Powder logo missing');
check('Service Worker remains present and versioned',/const V='[^']+'/.test(read('service-worker.js')),'Service Worker version marker missing');
const adminBootstrap=read('js/admin-capacity-guard-v21004.js');
check('Admin Learning/Event control is connected',exists('js/admin-learning-event-control-v2127.js')&&adminBootstrap.includes('admin-learning-event-control-v2127.js')&&adminBootstrap.includes('POWDER_ADMIN_LEARNING_EVENT_CONTROL_V2127'),'Admin event contract loader missing');

const liveOps=read('js/live-ops-diagnostics-v2020.js');
const highRefresh=exists('js/high-refresh-runtime-v21217.js')?read('js/high-refresh-runtime-v21217.js'):'';
check('High Refresh runtime is connected post-boot',!!highRefresh&&liveOps.includes('high-refresh-runtime-v21217.js?v=21217')&&liveOps.includes('POWDER_HIGH_REFRESH_V21217'),'21.2.17 loader missing');
check('60 FPS is baseline, not a render cap',highRefresh.includes('BASELINE_FPS=60')&&highRefresh.includes('uncapped:true')&&highRefresh.includes("maxFps:'native-refresh'")&&highRefresh.includes('requestAnimationFrame/native display cadence; no artificial 60/120 FPS cap'),'uncapped/native-refresh contract missing');
check('High Refresh sampling stays bounded and event-driven',highRefresh.includes('SAMPLE_FRAMES=96')&&highRefresh.includes('MAX_SAMPLE_MS=2400')&&!highRefresh.includes('setInterval(')&&highRefresh.includes("'powder:view-changed'")&&highRefresh.includes("'visibilitychange'"),'sampling policy regressed');
check('High Refresh stays outside signed Boot manifest',!manifest.some(x=>x.u==='js/high-refresh-runtime-v21217.js'),'high-refresh runtime must remain post-boot');

const result={version:'21.2.17',checks:checks.length,passed:checks.filter(x=>x.pass).length,failed:failures.length,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exit(1);