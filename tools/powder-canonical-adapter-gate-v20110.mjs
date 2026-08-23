import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(process.argv[2]||process.cwd()),read=r=>fs.readFileSync(path.join(root,r),'utf8');
const mig=read('server/supabase/migrations/20260823_20110_canonical_mutation_adapters.sql');
const gw=read('server/supabase/functions/powder-mutation-gateway/index.ts');
const adm=read('server/supabase/functions/powder-admin-mutation-integration/index.ts');
const shared=read('server/supabase/functions/_shared/canonical-adapters-v20110.ts');
const rt=read('js/server-mutation-v20110.js');const html=read('admin.html');
const clients=['js/secure-economy-v152.js','js/inventory-server-v159.js','js/liveops-v156.js','js/learning-events-v167.js'].map(read);
const actions=[...shared.matchAll(/\['([^']+)','([^']+)'\]/g)].map(m=>`${m[1]}/${m[2]}`);
const seeded=(mig.match(/\('(?:economy|reward|inventory|mail|event|purchase)','[^']+','legacy_edge_bridge'/g)||[]).length;
const checks={
 version:gw.includes("const VERSION='20.11.0'")&&rt.includes("const VERSION='20.11.0'"),
 routeTables:['mutation_adapter_routes_v20110','mutation_adapter_dispatch_v20110','mutation_adapter_evidence_v20110'].every(x=>mig.includes(x)),
 serverRpcs:['powder_mutation_adapter_route_v20110','powder_mutation_adapter_begin_v20110','powder_mutation_adapter_finish_v20110','powder_mutation_adapter_reconcile_v20110','powder_mutation_adapter_record_evidence_v20110','powder_mutation_adapter_posture_v20110'].every(x=>mig.includes(x)),
 eighteenRoutes:actions.length===18&&new Set(actions).size===18&&seeded===18,
 targetAllowlist:['powder-economy','powder-inventory','powder-liveops','powder-learning-events'].every(x=>gw.includes(`'${x}'`))&&/ALLOWED_TARGETS=new Set\(\[[^\]]+\]\)/.test(gw),
 gatewayDispatch:gw.includes('powder_mutation_adapter_begin_v20110')&&gw.includes('powder_mutation_adapter_finish_v20110')&&gw.includes("route.routeKind==='sql_atomic'")&&gw.includes("route.routeKind!=='legacy_edge_bridge'"),
 ambiguityQuarantine:gw.includes("p_status:'unknown'")&&gw.includes('MUTATION_20110_RESULT_UNKNOWN')&&gw.includes('khóa retry tự động')&&gw.includes('retries:0')===false,
 gatewayOnlyClient:rt.includes("if(m==='legacy')throw")&&!rt.includes('legacySend')&&rt.includes('retries:0')&&rt.includes('retrySafe:false'),
 clientWritesV20110:clients.every(s=>s.includes('POWDER_SERVER_MUTATION_V20110'))&&clients.every(s=>!s.includes('legacySend')),
 economyQueueGateway:clients[0].includes('flushQueue')&&clients[0].includes("await g.mutate({scope,action:item.action,payload,txKey})")&&!clients[0].includes('await raw(item.action'),
 evidenceTriple:mig.includes('idempotency_pass')&&mig.includes('business_atomic_pass')&&mig.includes('direct_write_blocked_pass')&&mig.includes("p_checked_at<now()-interval '24 hours'")&&mig.includes("verified_at>=now()-interval '7 days'"),
 noManualPass:adm.includes("action==='record_adapter_evidence'")&&!adm.includes("action==='mark_pass'")&&!adm.includes("action==='set_verified'")&&adm.includes('isSha'),
 adminWired:html.includes('admin-mutation-integration-v20110.js')&&html.includes('admin-mutation-integration-v20110.css'),
 launchGate:mig.includes('powder_official_launch_preflight_v20110')&&mig.includes("'serverMutationIntegration',coverage_ok")&&mig.includes("'canonicalMutationAdapters',adapter_ok")&&mig.includes('ready:=candidate_ok and coverage_ok and adapter_ok'),
 productionSourcesHonest:['powder-economy','powder-inventory','powder-liveops','powder-learning-events'].every(x=>!fs.existsSync(path.join(root,'server/supabase/functions',x,'index.ts')))
};
const out={version:'20.11.0',routes:actions,checks,pass:Object.values(checks).every(Boolean)};console.log(JSON.stringify(out,null,2));if(!out.pass)process.exit(1);
