import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(process.argv[2]||'.');
const write=process.argv.includes('--write');
const bootPath=path.join(root,'js/boot-loader-v21004.js');
const boot=fs.readFileSync(bootPath,'utf8');
const manifestMatch=boot.match(/const MANIFEST=(\[[\s\S]*?\]);\nconst SCRIPT_ORDER=/);
const orderMatch=boot.match(/const SCRIPT_ORDER=(\[[\s\S]*?\]);\nconst TOTAL_BYTES=/);
if(!manifestMatch||!orderMatch)throw new Error('Boot manifest/script order not found');
const manifest=JSON.parse(manifestMatch[1]);
const order=JSON.parse(orderMatch[1]);
const managed=['js/adaptive-runtime-pressure-v21011.js','js/live-ops-diagnostics-v2020.js'];
function meta(u){const b=fs.readFileSync(path.join(root,u));return{u,s:b.length,r:crypto.createHash('sha256').update(b).digest('hex').slice(0,12),k:'script'}}
for(const u of managed){
  const m=meta(u),i=manifest.findIndex(x=>x.u===u);
  if(i>=0)manifest[i]={...manifest[i],...m};
  else{
    const live=manifest.findIndex(x=>x.u==='js/live-ops-diagnostics-v2020.js');
    manifest.splice(live>=0?live:manifest.length,0,m);
  }
}
const governor='js/adaptive-runtime-pressure-v21011.js',liveops='js/live-ops-diagnostics-v2020.js';
for(let i=order.length-1;i>=0;i--)if(order[i]===governor)order.splice(i,1);
const liveIndex=order.indexOf(liveops);
order.splice(liveIndex>=0?liveIndex:order.length,0,governor);
const manifestJson=JSON.stringify(manifest),orderJson=JSON.stringify(order);
const manifestHash=crypto.createHash('sha256').update(manifestJson).digest('hex').slice(0,16);
let next=boot.replace(/MANIFEST_HASH="[0-9a-f]+"/,`MANIFEST_HASH="${manifestHash}"`)
  .replace(/const MANIFEST=\[[\s\S]*?\];\nconst SCRIPT_ORDER=/,`const MANIFEST=${manifestJson};\nconst SCRIPT_ORDER=`)
  .replace(/const SCRIPT_ORDER=\[[\s\S]*?\];\nconst TOTAL_BYTES=/,`const SCRIPT_ORDER=${orderJson};\nconst TOTAL_BYTES=`);
const details={version:'21.0.11',manifestEntries:manifest.length,scriptOrder:order.length,manifestHash,managed:managed.map(meta),changed:next!==boot};
if(write&&next!==boot)fs.writeFileSync(bootPath,next);
console.log(JSON.stringify(details,null,2));
if(!write&&next!==boot)process.exit(1);
