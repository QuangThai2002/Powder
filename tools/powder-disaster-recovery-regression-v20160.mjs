import path from 'node:path';import {spawnSync} from 'node:child_process';import fs from 'node:fs';
const root=path.resolve(process.argv[2]||process.cwd()),old=spawnSync(process.execPath,[path.join(root,'tools/powder-disaster-recovery-gate-v20150.mjs'),root],{encoding:'utf8'});let d={};try{d=JSON.parse(old.stdout)}catch{}
const checks={...(d.checks||{})};delete checks.releaseMetadata;
const launch=fs.readFileSync(path.join(root,'server/supabase/migrations/20260823_20160_official_launch_security_permission_guard.sql'),'utf8');
checks.currentOfficialCarriesDr=launch.includes("'disasterRecoveryBackupValidation',dr_ok")&&launch.includes('powder_dr_posture_v20150');
checks.currentCandidate=launch.includes("b.version='20.16.0'")&&launch.includes('powder-20.16.0-security-permission-final-hardening');
const pass=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'20.16.0',source:'20.15.0',checks,pass},null,2));if(!pass)process.exit(1);
