import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(process.argv[2]||'.'),write=process.argv.includes('--write');
const bootPath=path.join(root,'js/boot-loader-v21004.js'),boot=fs.readFileSync(bootPath,'utf8');
const manifestMatch=boot.match(/const MANIFEST=(\[[\s\S]*?\]);\nconst SCRIPT_ORDER=/),orderMatch=boot.match(/const SCRIPT_ORDER=(\[[\s\S]*?\]);\nconst TOTAL_BYTES=/);
if(!manifestMatch||!orderMatch)throw new Error('Boot manifest/script order not found');
const manifest=JSON.parse(manifestMatch[1]),order=JSON.parse(orderMatch[1]);
const scene='js/scene-transition-runtime-v21012.js',app='js/app.js',adaptive='js/adaptive-runtime-pressure-v21011.js',liveops='js/live-ops-diagnostics-v2020.js';
const managed=[scene,app,adaptive,liveops];
function meta(u){const b=fs.readFileSync(path.join(root,u));return{u,s:b.length,r:crypto.createHash('sha256').update(b).digest('hex').slice(0,12),k:'script'}}
for(let i=manifest.length-1;i>=0;i--)if(manifest[i].u===scene)manifest.splice(i,1);
for(const u of [app,adaptive,liveops]){const i=manifest.findIndex(x=>x.u===u);if(i<0)throw new Error(`Managed manifest entry missing: ${u}`);manifest[i]={...manifest[i],...meta(u)}}
const appManifestIndex=manifest.findIndex(x=>x.u===app);manifest.splice(appManifestIndex,0,meta(scene));
for(let i=order.length-1;i>=0;i--)if(order[i]===scene)order.splice(i,1);
const appOrderIndex=order.indexOf(app);if(appOrderIndex<0)throw new Error('app.js missing from SCRIPT_ORDER');order.splice(appOrderIndex,0,scene);
for(let i=order.length-1;i>=0;i--)if(order[i]===adaptive&&i>order.indexOf(liveops))order.splice(i,1);
if(!order.includes(adaptive)){const live=order.indexOf(liveops);order.splice(live>=0?live:order.length,0,adaptive)}
const manifestJson=JSON.stringify(manifest),orderJson=JSON.stringify(order),manifestHash=crypto.createHash('sha256').update(manifestJson).digest('hex').slice(0,16);
let next=boot.replace(/MANIFEST_HASH="[0-9a-f]+"/,`MANIFEST_HASH="${manifestHash}"`).replace(/const MANIFEST=\[[\s\S]*?\];\nconst SCRIPT_ORDER=/,`const MANIFEST=${manifestJson};\nconst SCRIPT_ORDER=`).replace(/const SCRIPT_ORDER=\[[\s\S]*?\];\nconst TOTAL_BYTES=/,`const SCRIPT_ORDER=${orderJson};\nconst TOTAL_BYTES=`);
const details={version:'21.0.12',manifestEntries:manifest.length,scriptOrder:order.length,manifestHash,sceneBeforeApp:order.indexOf(scene)===order.indexOf(app)-1,adaptiveBeforeLiveOps:order.indexOf(adaptive)<order.indexOf(liveops),managed:managed.map(meta),changed:next!==boot};
if(write&&next!==boot)fs.writeFileSync(bootPath,next);console.log(JSON.stringify(details,null,2));if(!write&&next!==boot)process.exit(1);
