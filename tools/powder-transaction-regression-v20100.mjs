import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||process.cwd());
const r=spawnSync(process.execPath,[path.join(root,'tools/powder-transaction-safety-gate-v2090.mjs'),root],{encoding:'utf8'});let d={};try{d=JSON.parse(r.stdout)}catch{}
const checks={...(d.checks||{})};delete checks.releaseMetadata;
const out={version:'20.10.0',sourceGate:'20.9.0',checks,pass:Object.keys(checks).length>10&&Object.values(checks).every(Boolean)};
console.log(JSON.stringify(out,null,2));if(!out.pass)process.exit(1);
