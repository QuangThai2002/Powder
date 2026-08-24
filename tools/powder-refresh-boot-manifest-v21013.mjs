import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(process.argv[2]||'.'),write=process.argv.includes('--write'),bootPath=path.join(root,'js/boot-loader-v21004.js'),boot=fs.readFileSync(bootPath,'utf8');
const manifestMatch=boot.match(/const MANIFEST=(\[[\s\S]*?\]);\nconst SCRIPT_ORDER=/),orderMatch=boot.match(/const SCRIPT_ORDER=(\[[\s\S]*?\]);\nconst TOTAL_BYTES=/);
if(!manifestMatch||!orderMatch)throw new Error('Boot manifest/script order not found');
const manifest=JSON.parse(manifestMatch[1]),order=JSON.parse(orderMatch[1]),interaction='js/interaction-response-v21013.js',liveops='js/live-ops-diagnostics-v2020.js',app='js/app.js';
const managed=[interaction,liveops];
function meta(u){const b=fs.readFileSync(path.join(root,u));return{u,s:b.length,r:crypto.createHash('sha256').update(b).digest('hex').slice(0,12),k:'script'}}
for(const u of managed){const m=meta(u),i=manifest.findIndex(x=>x.u===u);if(i>=0)manifest[i]={...manifest[i],...m};else{const appIndex=manifest.findIndex(x=>x.u===app),liveIndex=manifest.findIndex(x=>x.u===liveops),at=u===interaction?(appIndex>=0?appIndex:manifest.length):(liveIndex>=0?liveIndex:manifest.length);manifest.splice(at,0,m)}}
for(let i=order.length-1;i>=0;i--)if(order[i]===interaction)order.splice(i,1);const appIndex=order.indexOf(app);order.splice(appIndex>=0?appIndex:order.length,0,interaction);
const manifestJson=JSON.stringify(manifest),orderJson=JSON.stringify(order),manifestHash=crypto.createHash('sha256').update(manifestJson).digest('hex').slice(0,16);
let next=boot.replace(/MANIFEST_HASH="[0-9a-f]+"/,`MANIFEST_HASH="${manifestHash}"`).replace(/const MANIFEST=\[[\s\S]*?\];\nconst SCRIPT_ORDER=/,`const MANIFEST=${manifestJson};\nconst SCRIPT_ORDER=`).replace(/const SCRIPT_ORDER=\[[\s\S]*?\];\nconst TOTAL_BYTES=/,`const SCRIPT_ORDER=${orderJson};\nconst TOTAL_BYTES=`);
const sceneIndex=order.indexOf('js/scene-transition-runtime-v21012.js'),interactionIndex=order.indexOf(interaction),finalAppIndex=order.indexOf(app),details={version:'21.0.13',manifestEntries:manifest.length,scriptOrder:order.length,manifestHash,managed:managed.map(meta),sceneIndex,interactionIndex,appIndex:finalAppIndex,changed:next!==boot};
if(manifest.length!==1279||order.length!==124||sceneIndex<0||interactionIndex!==finalAppIndex-1||sceneIndex!==interactionIndex-1)throw new Error(`Unexpected 21.0.13 boot shape: ${JSON.stringify(details)}`);
if(write&&next!==boot)fs.writeFileSync(bootPath,next);console.log(JSON.stringify(details,null,2));if(!write&&next!==boot)process.exit(1);
