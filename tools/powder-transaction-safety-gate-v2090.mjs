import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(process.argv[2]||process.cwd()),read=r=>fs.readFileSync(path.join(root,r),'utf8');
const out={version:'20.9.0',checks:{},details:{}},ok=(k,v,d)=>{out.checks[k]=!!v;if(d!==undefined)out.details[k]=d};
const rel=JSON.parse(read('release.json')),
 mig=read('server/supabase/migrations/20260823_2090_data_integrity_transaction_safety.sql'),
 rt=read('js/transaction-safety-v2090.js'),
 eco=read('js/secure-economy-v152.js'),inv=read('js/inventory-server-v159.js'),live=read('js/liveops-v156.js'),learn=read('js/learning-events-v167.js'),
 helper=read('server/supabase/functions/_shared/transaction-safety-v2090.ts'),edge=read('server/supabase/functions/powder-admin-transactions/index.ts'),admin=read('js/admin-transaction-safety-v2090.js'),html=read('admin.html'),launchAdmin=read('js/admin-official-launch-v2080.js'),guide=read('server/supabase/TRANSACTION-SAFETY-INTEGRATION-20.9.0.md');
ok('releaseMetadata',rel.version==='20.9.0'&&rel.buildId==='powder-20.9.0-data-integrity-transaction-safety'&&rel.official===false,rel);
ok('receiptSchema',/transaction_receipts_v2090/.test(mig)&&/primary key \(user_id, scope, tx_key\)/.test(mig)&&/request_sha256/.test(mig)&&/attempt_count/.test(mig));
ok('serviceRoleOnly',/revoke all on table public\.transaction_receipts_v2090 from anon,authenticated/.test(mig)&&/grant select,insert,update,delete on table public\.transaction_receipts_v2090 to service_role/.test(mig)&&/revoke all on function public\.powder_transaction_begin_v2090[\s\S]*from public,anon,authenticated/.test(mig));
ok('requestBinding',/powder_transaction_hash_v2090/.test(mig)&&/r\.request_sha256<>req_hash or r\.operation<>op/.test(mig)&&/TX_2090_KEY_REUSE_MISMATCH/.test(mig)&&/key_reuse_mismatch/.test(mig));
ok('leaseConcurrency',/pg_advisory_xact_lock/.test(mig)&&/lease_expires_at>now\(\)/.test(mig)&&/inFlight/.test(mig)&&/lease_reclaimed/.test(mig)&&/TX_2090_LEASE_MISMATCH/.test(mig));
ok('reliabilityWriteGuard',/powder_reliability_can_write_v2080/.test(mig)&&/TX_2090_RELIABILITY_WRITE_BLOCKED/.test(mig)&&/canEconomyWrite/.test(rt));
ok('idempotentCommit',/r\.status='committed'[\s\S]*idempotent/.test(mig)&&/powder_transaction_commit_v2090/.test(mig)&&/committed_at=now\(\)/.test(mig));
ok('staleRecoveryNoReplay',/powder_transaction_reconcile_scan_v2090/.test(mig)&&/STALE_PENDING_REQUIRES_AUTHORITATIVE_CHECK/.test(mig)&&/automaticReplay',false/.test(mig)&&!/powder_transaction_reconcile_scan_v2090[\s\S]{0,4000}(wallet|inventory_items|mail_rewards|grant_reward)/i.test(mig));
ok('ownerManualResolution',/if\(action==='resolve'\)[\s\S]*need\(\['owner'\]\)/.test(edge)&&/powder_transaction_resolve_v2090/.test(edge)&&/Resolution cần ghi chú/.test(edge));
ok('clientJournal',/powder_tx_journal_v2090/.test(rt)&&/status==='pending'/.test(rt)&&/entry\.status='committed'/.test(rt)&&/powder:transaction-uncertain/.test(rt)&&/findReusable/.test(rt));
ok('stableVsPendingSemantics',/stable:isStable/.test(rt)&&/entry\.status==='committed'&&isStable/.test(rt)&&/x\.status==='pending'/.test(rt)&&/entry\.status='pending'/.test(rt));
ok('economyIntegration',/POWDER_TX_SAFETY_V2090/.test(eco)&&/T\.mutate/.test(eco)&&/stable:true/.test(eco)&&/txKey/.test(eco));
ok('inventoryIntegration',/POWDER_TX_SAFETY_V2090/.test(inv)&&/T\.mutate/.test(inv)&&/txKey/.test(inv));
ok('rewardIntegration',/POWDER_TX_SAFETY_V2090/.test(live)&&/mail:/.test(live)&&/daily-login:/.test(live)&&/mutate\('claim_mail'[\s\S]*true/.test(live)&&/mutate\('claim_daily'[\s\S]*true/.test(live));
ok('eventIntegration',/POWDER_TX_SAFETY_V2090/.test(learn)&&/mission:/.test(learn)&&/completion:/.test(learn)&&/shop:/.test(learn)&&/mutate\('claim_mission'[\s\S]*true/.test(learn)&&/mutate\('buy'[\s\S]*false/.test(learn));
ok('sharedServerContract',/beginTransaction/.test(helper)&&/withTransaction/.test(helper)&&/powder_transaction_commit_v2090/.test(helper)&&/powder_transaction_fail_v2090/.test(helper));
ok('adminWiring',html.includes('admin-transaction-safety-v2090.js')&&html.includes('admin-transaction-safety-v2090.css')&&/powder-admin-transactions/.test(admin)&&/Scan stale/.test(admin));
ok('launchHardGate',/transaction_ok/.test(mig)&&/'transactionIntegrity',transaction_ok/.test(mig)&&/ready:=candidate_ok[\s\S]*transaction_ok/.test(mig)&&/transactionIntegrity:c\.transactionIntegrity/.test(launchAdmin));
ok('integrationBoundaryDocumented',/remote Edge Function source is not present/i.test(guide)&&/must adopt/i.test(guide),{businessEdgesPresent:['powder-economy','powder-inventory','powder-liveops','powder-learning-events'].filter(x=>fs.existsSync(path.join(root,'server/supabase/functions',x)))});
out.pass=Object.values(out.checks).every(Boolean);console.log(JSON.stringify(out,null,2));if(!out.pass)process.exit(1);
