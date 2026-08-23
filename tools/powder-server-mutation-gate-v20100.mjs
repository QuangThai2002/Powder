import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(process.argv[2]||process.cwd()),read=r=>fs.readFileSync(path.join(root,r),'utf8');
const mig=read('server/supabase/migrations/20260823_20100_server_mutation_integration_reconciliation.sql'),gw=read('server/supabase/functions/powder-mutation-gateway/index.ts'),adm=read('server/supabase/functions/powder-admin-mutation-integration/index.ts'),shared=read('server/supabase/functions/_shared/mutation-gateway-v20100.ts'),rt=read('js/server-mutation-v20100.js'),launch=read('server/supabase/functions/powder-admin-official-launch/index.ts'),adminHtml=read('admin.html');
const clients=['js/secure-economy-v152.js','js/inventory-server-v159.js','js/liveops-v156.js','js/learning-events-v167.js'].map(read);
const checks={
 contractRegistry:/create table if not exists public\.mutation_contracts_v20100/.test(mig)&&((mig.match(/true,false,'/g)||[]).length>=18)&&/until a canonical adapter/.test(mig),
 atomicGateway:/pg_advisory_xact_lock/.test(mig)&&/execute format\('select %s\(\$1,\$2\)'/.test(mig)&&/mutation_effect_receipts_v20100/.test(mig)&&/The EXCEPTION block rolls back all handler-side writes/.test(mig),
 failClosed:/MUTATION_20100_CONTRACT_NOT_READY/.test(mig)&&/MUTATION_20100_HANDLER_MISSING/.test(mig)&&/MUTATION_20100_RELIABILITY_WRITE_BLOCKED/.test(mig)&&/LEGACY_RECEIPT_REQUIRES_RECONCILIATION/.test(mig),
 noBlindReplay:/automaticResourceReplay',false/.test(mig)&&/no resource replay performed/.test(mig)&&/Legacy split-protocol receipts remain manual/.test(mig),
 chaosDrill:/powder_mutation_chaos_drill_v20100/.test(mig)&&/duplicateIdempotent/.test(mig)&&/forcedRollback/.test(mig)&&/atomicEffectMarker/.test(mig),
 serviceRoleOnly:/revoke all on function public\.powder_mutation_execute_v20100/.test(mig)&&/grant execute on function public\.powder_mutation_execute_v20100\(uuid,text,text,text,jsonb\) to service_role/.test(mig),
 playerGateway:/powder_mutation_execute_v20100/.test(gw)&&/getUser\(jwt\)/.test(gw)&&/CONTRACT_NOT_READY/.test(gw)&&/RELIABILITY_BLOCKED/.test(gw),
 adminRecovery:/powder_mutation_reconcile_v20100/.test(adm)&&/powder_mutation_chaos_drill_v20100/.test(adm)&&/role!=='owner'/.test(adm),
 sharedContract:/powder_mutation_execute_v20100/.test(shared)&&/txKey/.test(shared),
 clientRuntime:/retries:0/.test(rt)&&/retrySafe:false/.test(rt)&&/contractNotReady/.test(rt)&&/POWDER_SERVER_MUTATION_V20100/.test(rt),
 clientCoverage:clients.every(s=>/POWDER_SERVER_MUTATION_V20100/.test(s)||/SERVER_MUTATION_V20100/.test(s)),
 adminWiring:/admin-mutation-integration-v20100\.js/.test(adminHtml)&&/data-page="mutation"/.test(adminHtml)&&/mutation20100Root/.test(adminHtml),
 launchHardGate:/powder_official_launch_preflight_v20100/.test(mig)&&/'serverMutationIntegration',mutation_ok/.test(mig)&&/powder_official_launch_preflight_v20100/.test(launch),
 requiredHandlersNotFaked:!['powder-economy','powder-inventory','powder-liveops','powder-learning-events'].some(x=>fs.existsSync(path.join(root,'server/supabase/functions',x)))&&/enabled is not true/.test(mig)
};
const out={version:'20.10.0',checks};out.pass=Object.values(checks).every(Boolean);console.log(JSON.stringify(out,null,2));if(!out.pass)process.exit(1);
