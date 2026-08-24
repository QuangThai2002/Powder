import fs from'node:fs';
const f='js/onboarding-v146.js';
let s=fs.readFileSync(f,'utf8');
const old="const hole=maskAround(r,8);focus.hidden=false;focus.style.left=`${hole.left}px`;focus.style.top=`${hole.top}px`;focus.style.width=`${hole.width}px`;focus.style.height=`${hole.height}px`;";
const next="const pad=8,hole=maskAround(r,pad);focus.hidden=false;focus.style.left=`${r.left-pad}px`;focus.style.top=`${r.top-pad}px`;focus.style.width=`${Math.max(0,r.width+pad*2)}px`;focus.style.height=`${Math.max(0,r.height+pad*2)}px`;";
if(s.includes(old))s=s.replace(old,next);else if(!s.includes(next))throw new Error('Onboarding spotlight anchor missing');
fs.writeFileSync(f,s);
console.log(JSON.stringify({version:'21.1.3',patched:true},null,2));
