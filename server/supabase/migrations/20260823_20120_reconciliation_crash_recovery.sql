-- Powder 20.12.0 — Reconciliation & Crash Recovery
-- Fail-closed control plane for Economy / Inventory / Mail / Reward transaction reconciliation.
-- This migration never guesses or replays player resources. Production business handlers must
-- emit normalized Resource Effect Ledger records so every committed mutation has explainable deltas.

create extension if not exists pgcrypto;

create table if not exists public.resource_effect_ledger_v20120 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scope text not null,
  tx_key text not null,
  action text not null,
  effect_key text not null,
  resource_type text not null check (resource_type in ('currency','inventory','mail','reward','pow','progress','entitlement','other')),
  resource_key text not null,
  delta_numeric numeric,
  before_state jsonb,
  after_state jsonb,
  request_sha256 text not null default '',
  result_sha256 text not null default '',
  effect_sha256 text not null check (effect_sha256 ~ '^[0-9a-f]{64}$'),
  source text not null default 'canonical_handler' check (source in ('canonical_handler','legacy_bridge','atomic_handler','reconciliation_import','drill')),
  status text not null default 'observed' check (status in ('observed','verified','disputed','quarantined','repaired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,scope,tx_key,effect_key),
  check (scope in ('economy','inventory','reward','mail','event','purchase','support')),
  check (length(tx_key) between 1 and 180),
  check (effect_key ~ '^[A-Za-z0-9:._-]{1,180}$'),
  check (length(resource_key) between 1 and 220),
  check (request_sha256='' or request_sha256 ~ '^[0-9a-f]{64}$'),
  check (result_sha256='' or result_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists resource_effect_ledger_v20120_tx_idx on public.resource_effect_ledger_v20120(user_id,scope,tx_key,created_at);
create index if not exists resource_effect_ledger_v20120_resource_idx on public.resource_effect_ledger_v20120(resource_type,resource_key,created_at desc);

create table if not exists public.reconciliation_runs_v20120 (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'system',
  scan_limit integer not null default 200,
  scanned integer not null default 0,
  orphan_receipts integer not null default 0,
  orphan_dispatch integer not null default 0,
  orphan_effects integer not null default 0,
  duplicate_effects integer not null default 0,
  unexplained_deltas integer not null default 0,
  status_mismatches integer not null default 0,
  hash_mismatches integer not null default 0,
  stale_or_ambiguous integer not null default 0,
  recovery_open integer not null default 0,
  open_cases integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reconciliation_cases_v20120 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scope text not null,
  tx_key text not null,
  action text not null default '',
  anomaly_type text not null check (anomaly_type in (
    'orphan_receipt','orphan_dispatch','orphan_effect','duplicate_effect','unexplained_delta',
    'status_mismatch','hash_mismatch','stale_or_ambiguous','recovery_open'
  )),
  severity text not null default 'high' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','investigating','repair_proposed','repair_approved','resolved','dismissed')),
  occurrence_count integer not null default 1,
  evidence jsonb not null default '{}'::jsonb,
  evidence_sha256 text not null default '',
  repair_kind text not null default '',
  repair_plan jsonb not null default '{}'::jsonb,
  proposed_by text not null default '',
  proposed_at timestamptz,
  approved_by text not null default '',
  approved_at timestamptz,
  resolved_by text not null default '',
  resolved_at timestamptz,
  resolution_note text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,scope,tx_key,anomaly_type),
  check (scope in ('economy','inventory','reward','mail','event','purchase','support','unknown')),
  check (evidence_sha256='' or evidence_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists reconciliation_cases_v20120_status_idx on public.reconciliation_cases_v20120(status,severity,last_seen_at desc);
create index if not exists reconciliation_cases_v20120_tx_idx on public.reconciliation_cases_v20120(user_id,scope,tx_key);

create table if not exists public.reconciliation_repair_audit_v20120 (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.reconciliation_cases_v20120(id) on delete cascade,
  action text not null check (action in ('propose','approve','apply','quarantine','resolve','dismiss','reject')),
  repair_kind text not null default '',
  actor text not null,
  evidence_sha256 text not null default '',
  before_state jsonb,
  after_state jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (evidence_sha256='' or evidence_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists reconciliation_repair_audit_v20120_case_idx on public.reconciliation_repair_audit_v20120(case_id,created_at);

create table if not exists public.reconciliation_drills_v20120 (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'system',
  status text not null check (status in ('pass','fail','blocked')),
  checks jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.resource_effect_ledger_v20120 enable row level security;
alter table public.reconciliation_runs_v20120 enable row level security;
alter table public.reconciliation_cases_v20120 enable row level security;
alter table public.reconciliation_repair_audit_v20120 enable row level security;
alter table public.reconciliation_drills_v20120 enable row level security;
revoke all on table public.resource_effect_ledger_v20120 from anon,authenticated;
revoke all on table public.reconciliation_runs_v20120 from anon,authenticated;
revoke all on table public.reconciliation_cases_v20120 from anon,authenticated;
revoke all on table public.reconciliation_repair_audit_v20120 from anon,authenticated;
revoke all on table public.reconciliation_drills_v20120 from anon,authenticated;
grant select,insert,update,delete on table public.resource_effect_ledger_v20120 to service_role;
grant select,insert,update,delete on table public.reconciliation_runs_v20120 to service_role;
grant select,insert,update,delete on table public.reconciliation_cases_v20120 to service_role;
grant select,insert,update,delete on table public.reconciliation_repair_audit_v20120 to service_role;
grant select,insert,update,delete on table public.reconciliation_drills_v20120 to service_role;

create or replace function public.powder_reconciliation_sha_v20120(p_value jsonb)
returns text language sql immutable as $function$
  select encode(digest(coalesce(p_value,'{}'::jsonb)::text,'sha256'),'hex');
$function$;

-- Resource effects are idempotent by effect_key. A repeated effect may only be accepted when
-- its normalized hash is identical; otherwise the transaction is quarantined as a key mismatch.
create or replace function public.powder_resource_effect_record_v20120(
  p_user uuid,p_scope text,p_tx_key text,p_action text,p_effect_key text,p_resource_type text,p_resource_key text,
  p_delta_numeric numeric default null,p_before_state jsonb default null,p_after_state jsonb default null,
  p_request_sha256 text default '',p_result_sha256 text default '',p_source text default 'canonical_handler',p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare sc text:=lower(trim(coalesce(p_scope,'')));k text:=trim(coalesce(p_tx_key,''));act text:=lower(trim(coalesce(p_action,'')));ek text:=trim(coalesce(p_effect_key,''));rt text:=lower(trim(coalesce(p_resource_type,'')));rk text:=trim(coalesce(p_resource_key,''));src text:=lower(trim(coalesce(p_source,'canonical_handler')));h text;old public.resource_effect_ledger_v20120;rid uuid;
begin
 if p_user is null then raise exception 'RECON_20120_USER_REQUIRED'; end if;
 if sc not in ('economy','inventory','reward','mail','event','purchase','support') then raise exception 'RECON_20120_SCOPE_INVALID'; end if;
 if length(k)<1 or length(k)>180 then raise exception 'RECON_20120_TX_KEY_INVALID'; end if;
 if act !~ '^[a-z0-9_]{2,80}$' then raise exception 'RECON_20120_ACTION_INVALID'; end if;
 if ek !~ '^[A-Za-z0-9:._-]{1,180}$' then raise exception 'RECON_20120_EFFECT_KEY_INVALID'; end if;
 if rt not in ('currency','inventory','mail','reward','pow','progress','entitlement','other') then raise exception 'RECON_20120_RESOURCE_TYPE_INVALID'; end if;
 if rk='' or length(rk)>220 then raise exception 'RECON_20120_RESOURCE_KEY_INVALID'; end if;
 if coalesce(p_request_sha256,'')<>'' and p_request_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'RECON_20120_REQUEST_HASH_INVALID'; end if;
 if coalesce(p_result_sha256,'')<>'' and p_result_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'RECON_20120_RESULT_HASH_INVALID'; end if;
 if src not in ('canonical_handler','legacy_bridge','atomic_handler','reconciliation_import','drill') then raise exception 'RECON_20120_SOURCE_INVALID'; end if;
 h:=public.powder_reconciliation_sha_v20120(jsonb_build_object('user',p_user,'scope',sc,'txKey',k,'action',act,'effectKey',ek,'resourceType',rt,'resourceKey',rk,'delta',p_delta_numeric,'before',p_before_state,'after',p_after_state,'requestSha256',coalesce(p_request_sha256,''),'resultSha256',coalesce(p_result_sha256,'')));
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||'|'||sc||'|'||k||'|'||ek,0));
 select * into old from public.resource_effect_ledger_v20120 where user_id=p_user and scope=sc and tx_key=k and effect_key=ek for update;
 if old.id is not null then
   if old.effect_sha256<>h then raise exception 'RECON_20120_EFFECT_KEY_MISMATCH'; end if;
   return jsonb_build_object('ok',true,'version','20.12.0','idempotent',true,'effectId',old.id,'effectSha256',old.effect_sha256);
 end if;
 insert into public.resource_effect_ledger_v20120(user_id,scope,tx_key,action,effect_key,resource_type,resource_key,delta_numeric,before_state,after_state,request_sha256,result_sha256,effect_sha256,source,metadata)
 values(p_user,sc,k,act,ek,rt,rk,p_delta_numeric,p_before_state,p_after_state,coalesce(p_request_sha256,''),coalesce(p_result_sha256,''),h,src,coalesce(p_metadata,'{}'::jsonb)) returning id into rid;
 return jsonb_build_object('ok',true,'version','20.12.0','idempotent',false,'effectId',rid,'effectSha256',h);
end $function$;

create or replace function public.powder_reconciliation_open_case_v20120(
  p_user uuid,p_scope text,p_tx_key text,p_action text,p_type text,p_severity text,p_evidence jsonb
) returns uuid language plpgsql security definer set search_path=public as $function$
declare cid uuid;ev jsonb:=coalesce(p_evidence,'{}'::jsonb);esh text:=public.powder_reconciliation_sha_v20120(ev);begin
 insert into public.reconciliation_cases_v20120(user_id,scope,tx_key,action,anomaly_type,severity,status,evidence,evidence_sha256)
 values(p_user,coalesce(nullif(lower(trim(p_scope)),''),'unknown'),coalesce(p_tx_key,''),coalesce(p_action,''),p_type,p_severity,'open',ev,esh)
 on conflict(user_id,scope,tx_key,anomaly_type) do update set action=excluded.action,severity=excluded.severity,
   status=case when public.reconciliation_cases_v20120.status in ('resolved','dismissed') then 'open' else public.reconciliation_cases_v20120.status end,
   occurrence_count=public.reconciliation_cases_v20120.occurrence_count+1,evidence=excluded.evidence,evidence_sha256=excluded.evidence_sha256,last_seen_at=now(),updated_at=now(),
   repair_kind=case when public.reconciliation_cases_v20120.status in ('resolved','dismissed') then '' else public.reconciliation_cases_v20120.repair_kind end,
   repair_plan=case when public.reconciliation_cases_v20120.status in ('resolved','dismissed') then '{}'::jsonb else public.reconciliation_cases_v20120.repair_plan end,
   proposed_by=case when public.reconciliation_cases_v20120.status in ('resolved','dismissed') then '' else public.reconciliation_cases_v20120.proposed_by end,
   proposed_at=case when public.reconciliation_cases_v20120.status in ('resolved','dismissed') then null else public.reconciliation_cases_v20120.proposed_at end,
   approved_by=case when public.reconciliation_cases_v20120.status in ('resolved','dismissed') then '' else public.reconciliation_cases_v20120.approved_by end,
   approved_at=case when public.reconciliation_cases_v20120.status in ('resolved','dismissed') then null else public.reconciliation_cases_v20120.approved_at end
 returning id into cid;
 return cid;
end $function$;

-- Reconciliation scans only evidence owned by this project. It does not invent wallet/inventory state
-- for legacy Edge functions whose authoritative tables are not part of the artifact.
create or replace function public.powder_reconciliation_scan_v20120(p_limit integer default 200,p_actor text default 'system')
returns jsonb language plpgsql security definer set search_path=public as $function$
declare lim int:=greatest(1,least(1000,coalesce(p_limit,200)));rid uuid:=gen_random_uuid();n_or int:=0;n_od int:=0;n_oe int:=0;n_dupe int:=0;n_un int:=0;n_sm int:=0;n_hm int:=0;n_stale int:=0;n_rec int:=0;n_open int:=0;rec record;
begin
 begin perform public.powder_mutation_adapter_reconcile_v20110(lim,p_actor); exception when others then null; end;
 begin perform public.powder_mutation_reconcile_v20100(lim,p_actor); exception when others then null; end;

 -- Stale/ambiguous canonical bridge dispatches.
 for rec in select d.user_id,d.scope,d.tx_key,d.action,d.status,d.request_sha256,d.result_sha256,d.target_edge,d.updated_at
   from public.mutation_adapter_dispatch_v20110 d
   where d.status in ('unknown','investigating') or (d.status='pending' and d.updated_at<now()-interval '90 seconds')
   order by d.updated_at asc limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,rec.action,'stale_or_ambiguous','critical',to_jsonb(rec)); n_stale:=n_stale+1;
 end loop;

 -- Successful bridge writes without normalized resource effects are unexplained. This is the key 20.12 contract.
 for rec in select d.user_id,d.scope,d.tx_key,d.action,d.request_sha256,d.result_sha256,d.target_edge,d.completed_at
   from public.mutation_adapter_dispatch_v20110 d
   where d.status='succeeded' and d.created_at>=now()-interval '7 days'
     and not exists(select 1 from public.resource_effect_ledger_v20120 e where e.user_id=d.user_id and e.scope=d.scope and e.tx_key=d.tx_key)
   order by d.completed_at desc nulls last limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,rec.action,'unexplained_delta','high',to_jsonb(rec)); n_un:=n_un+1;
 end loop;

 -- Atomic receipt/effect status mismatches.
 for rec in select r.user_id,r.scope,r.tx_key,r.operation as action,r.status,r.request_sha256,r.atomic_group_id
   from public.transaction_receipts_v2090 r left join public.mutation_effect_receipts_v20100 e on e.user_id=r.user_id and e.scope=r.scope and e.tx_key=r.tx_key
   where r.executor='atomic_gateway_v20100' and r.status='committed' and e.tx_key is null
   order by r.updated_at desc limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,rec.action,'orphan_receipt','critical',to_jsonb(rec)); n_or:=n_or+1;
 end loop;
 for rec in select e.user_id,e.scope,e.tx_key,e.action,r.status as receipt_status,e.request_sha256,e.result_sha256,e.atomic_group_id
   from public.mutation_effect_receipts_v20100 e left join public.transaction_receipts_v2090 r on r.user_id=e.user_id and r.scope=e.scope and r.tx_key=e.tx_key
   where r.user_id is null or r.status<>'committed'
   order by e.committed_at desc limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,rec.action,'status_mismatch','critical',to_jsonb(rec)); n_sm:=n_sm+1;
 end loop;

 -- Resource effects must have a transport/atomic proof and matching request hash where available.
 for rec in select e.user_id,e.scope,e.tx_key,e.action,e.effect_key,e.effect_sha256,e.request_sha256,e.result_sha256
   from public.resource_effect_ledger_v20120 e
   where e.source<>'drill' and not exists(select 1 from public.mutation_adapter_dispatch_v20110 d where d.user_id=e.user_id and d.scope=e.scope and d.tx_key=e.tx_key)
     and not exists(select 1 from public.transaction_receipts_v2090 r where r.user_id=e.user_id and r.scope=e.scope and r.tx_key=e.tx_key)
   order by e.created_at desc limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,rec.action,'orphan_effect','critical',to_jsonb(rec)); n_oe:=n_oe+1;
 end loop;
 for rec in select e.user_id,e.scope,e.tx_key,e.action,e.effect_key,e.request_sha256,d.request_sha256 as dispatch_sha,r.request_sha256 as receipt_sha
   from public.resource_effect_ledger_v20120 e
   left join public.mutation_adapter_dispatch_v20110 d on d.user_id=e.user_id and d.scope=e.scope and d.tx_key=e.tx_key
   left join public.transaction_receipts_v2090 r on r.user_id=e.user_id and r.scope=e.scope and r.tx_key=e.tx_key
   where e.source<>'drill' and e.request_sha256<>'' and ((d.request_sha256 is not null and d.request_sha256<>e.request_sha256) or (r.request_sha256 is not null and r.request_sha256<>e.request_sha256))
   order by e.created_at desc limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,rec.action,'hash_mismatch','critical',to_jsonb(rec)); n_hm:=n_hm+1;
 end loop;

 -- Duplicate normalized resource effects in one transaction are never auto-merged.
 for rec in select user_id,scope,tx_key,min(action) as action,resource_type,resource_key,count(*) as duplicate_count,jsonb_agg(effect_key order by effect_key) as effect_keys
   from public.resource_effect_ledger_v20120 where source<>'drill'
   group by user_id,scope,tx_key,resource_type,resource_key having count(*)>1
   order by count(*) desc limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,rec.action,'duplicate_effect','critical',to_jsonb(rec)); n_dupe:=n_dupe+1;
 end loop;

 -- Legacy recovery queue remains explicit/manual. No automatic resource replay.
 for rec in select q.user_id,q.scope,q.tx_key,r.operation as action,q.status,q.reason,q.created_at
   from public.transaction_recovery_queue_v2090 q left join public.transaction_receipts_v2090 r on r.user_id=q.user_id and r.scope=q.scope and r.tx_key=q.tx_key
   where q.status in ('queued','investigating') order by q.created_at asc limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,coalesce(rec.action,''),'recovery_open','high',to_jsonb(rec)); n_rec:=n_rec+1;
 end loop;

 -- Orphan dispatch means a succeeded bridge dispatch whose route definition no longer exists/enabled.
 for rec in select d.user_id,d.scope,d.tx_key,d.action,d.status,d.target_edge,d.created_at
   from public.mutation_adapter_dispatch_v20110 d left join public.mutation_adapter_routes_v20110 a on a.scope=d.scope and a.action=d.action and a.enabled=true
   where a.scope is null and d.status in ('pending','succeeded','unknown','investigating') order by d.created_at desc limit lim
 loop
   perform public.powder_reconciliation_open_case_v20120(rec.user_id,rec.scope,rec.tx_key,rec.action,'orphan_dispatch','high',to_jsonb(rec)); n_od:=n_od+1;
 end loop;

 select count(*) into n_open from public.reconciliation_cases_v20120 where status in ('open','investigating','repair_proposed','repair_approved');
 insert into public.reconciliation_runs_v20120(id,actor,scan_limit,scanned,orphan_receipts,orphan_dispatch,orphan_effects,duplicate_effects,unexplained_deltas,status_mismatches,hash_mismatches,stale_or_ambiguous,recovery_open,open_cases,details)
 values(rid,left(coalesce(p_actor,'system'),160),lim,n_or+n_od+n_oe+n_dupe+n_un+n_sm+n_hm+n_stale+n_rec,n_or,n_od,n_oe,n_dupe,n_un,n_sm,n_hm,n_stale,n_rec,n_open,
 jsonb_build_object('automaticResourceReplay',false,'resourceRepairSupported',false,'evidenceModel','receipt+dispatch+atomic-effect+resource-effect-ledger'));
 return jsonb_build_object('ok',true,'version','20.12.0','runId',rid,'scanned',n_or+n_od+n_oe+n_dupe+n_un+n_sm+n_hm+n_stale+n_rec,
  'issues',jsonb_build_object('orphanReceipt',n_or,'orphanDispatch',n_od,'orphanEffect',n_oe,'duplicateEffect',n_dupe,'unexplainedDelta',n_un,'statusMismatch',n_sm,'hashMismatch',n_hm,'staleOrAmbiguous',n_stale,'recoveryOpen',n_rec,'openCases',n_open),
  'automaticResourceReplay',false,'at',now());
end $function$;

create or replace function public.powder_reconciliation_posture_v20120()
returns jsonb language plpgsql security definer set search_path=public stable as $function$
declare orphan_receipt int:=0;orphan_dispatch int:=0;orphan_effect int:=0;duplicate_effect int:=0;unexplained int:=0;status_mismatch int:=0;hash_mismatch int:=0;stale int:=0;recovery_open int:=0;repair_pending int:=0;high_open int:=0;last_run timestamptz;last_drill timestamptz;drill_status text;ready boolean:=false;
begin
 select count(*) into orphan_receipt from public.transaction_receipts_v2090 r left join public.mutation_effect_receipts_v20100 e on e.user_id=r.user_id and e.scope=r.scope and e.tx_key=r.tx_key where r.executor='atomic_gateway_v20100' and r.status='committed' and e.tx_key is null;
 select count(*) into orphan_dispatch from public.mutation_adapter_dispatch_v20110 d left join public.mutation_adapter_routes_v20110 a on a.scope=d.scope and a.action=d.action and a.enabled=true where a.scope is null and d.status in ('pending','succeeded','unknown','investigating');
 select count(*) into orphan_effect from public.resource_effect_ledger_v20120 e where e.source<>'drill' and not exists(select 1 from public.mutation_adapter_dispatch_v20110 d where d.user_id=e.user_id and d.scope=e.scope and d.tx_key=e.tx_key) and not exists(select 1 from public.transaction_receipts_v2090 r where r.user_id=e.user_id and r.scope=e.scope and r.tx_key=e.tx_key);
 select count(*) into duplicate_effect from (select 1 from public.resource_effect_ledger_v20120 where source<>'drill' group by user_id,scope,tx_key,resource_type,resource_key having count(*)>1) x;
 select count(*) into unexplained from public.mutation_adapter_dispatch_v20110 d where d.status='succeeded' and d.created_at>=now()-interval '7 days' and not exists(select 1 from public.resource_effect_ledger_v20120 e where e.user_id=d.user_id and e.scope=d.scope and e.tx_key=d.tx_key);
 select count(*) into status_mismatch from public.mutation_effect_receipts_v20100 e left join public.transaction_receipts_v2090 r on r.user_id=e.user_id and r.scope=e.scope and r.tx_key=e.tx_key where r.user_id is null or r.status<>'committed';
 select count(*) into hash_mismatch from public.resource_effect_ledger_v20120 e left join public.mutation_adapter_dispatch_v20110 d on d.user_id=e.user_id and d.scope=e.scope and d.tx_key=e.tx_key left join public.transaction_receipts_v2090 r on r.user_id=e.user_id and r.scope=e.scope and r.tx_key=e.tx_key where e.source<>'drill' and e.request_sha256<>'' and ((d.request_sha256 is not null and d.request_sha256<>e.request_sha256) or (r.request_sha256 is not null and r.request_sha256<>e.request_sha256));
 select count(*) into stale from public.mutation_adapter_dispatch_v20110 where status in ('unknown','investigating') or (status='pending' and updated_at<now()-interval '90 seconds');
 select count(*) into recovery_open from public.transaction_recovery_queue_v2090 where status in ('queued','investigating');
 select count(*) into repair_pending from public.reconciliation_cases_v20120 where status in ('repair_proposed','repair_approved');
 select count(*) into high_open from public.reconciliation_cases_v20120 where status in ('open','investigating','repair_proposed','repair_approved') and severity in ('high','critical');
 select created_at into last_run from public.reconciliation_runs_v20120 order by created_at desc limit 1;
 select created_at,status into last_drill,drill_status from public.reconciliation_drills_v20120 order by created_at desc limit 1;
 ready:=orphan_receipt=0 and orphan_dispatch=0 and orphan_effect=0 and duplicate_effect=0 and unexplained=0 and status_mismatch=0 and hash_mismatch=0 and stale=0 and recovery_open=0 and repair_pending=0 and high_open=0
   and coalesce(last_run>=now()-interval '24 hours',false) and drill_status='pass' and coalesce(last_drill>=now()-interval '7 days',false);
 return jsonb_build_object('version','20.12.0','ready',ready,'checkedAt',now(),
  'issues',jsonb_build_object('orphanReceipt',orphan_receipt,'orphanDispatch',orphan_dispatch,'orphanEffect',orphan_effect,'duplicateEffect',duplicate_effect,'unexplainedDelta',unexplained,'statusMismatch',status_mismatch,'hashMismatch',hash_mismatch,'staleOrAmbiguous',stale,'recoveryOpen',recovery_open,'repairPending',repair_pending,'highCriticalOpen',high_open),
  'freshness',jsonb_build_object('lastRun',last_run,'runFresh24h',coalesce(last_run>=now()-interval '24 hours',false),'lastDrill',last_drill,'drillStatus',coalesce(drill_status,'none'),'drillFresh7d',coalesce(last_drill>=now()-interval '7 days',false)),
  'guards',jsonb_build_object('automaticResourceReplay',false,'blindResourceRepair',false,'resourceEffectLedgerRequired',true,'repairAuditTrail',true));
end $function$;

create or replace function public.powder_reconciliation_propose_repair_v20120(p_case uuid,p_kind text,p_note text,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c public.reconciliation_cases_v20120;k text:=lower(trim(coalesce(p_kind,'')));note text:=left(trim(coalesce(p_note,'')),1200);begin
 if k not in ('quarantine','mark_committed_from_proof','mark_not_committed_from_proof','resolve_from_proof','dismiss_false_positive') then raise exception 'RECON_20120_REPAIR_KIND_DENIED'; end if;
 if length(note)<8 then raise exception 'RECON_20120_REPAIR_NOTE_REQUIRED'; end if;
 select * into c from public.reconciliation_cases_v20120 where id=p_case for update;if c.id is null then raise exception 'RECON_20120_CASE_NOT_FOUND';end if;
 if c.status in ('resolved','dismissed') then raise exception 'RECON_20120_CASE_CLOSED';end if;
 update public.reconciliation_cases_v20120 set status='repair_proposed',repair_kind=k,repair_plan=jsonb_build_object('kind',k,'note',note,'evidenceSha256',c.evidence_sha256,'automaticResourceReplay',false),proposed_by=left(coalesce(p_actor,'system'),160),proposed_at=now(),approved_by='',approved_at=null,updated_at=now() where id=c.id;
 insert into public.reconciliation_repair_audit_v20120(case_id,action,repair_kind,actor,evidence_sha256,before_state,note) values(c.id,'propose',k,left(coalesce(p_actor,'system'),160),c.evidence_sha256,to_jsonb(c),note);
 return jsonb_build_object('ok',true,'caseId',c.id,'status','repair_proposed','repairKind',k,'resourceMutation',false);
end $function$;

create or replace function public.powder_reconciliation_approve_repair_v20120(p_case uuid,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c public.reconciliation_cases_v20120;begin
 select * into c from public.reconciliation_cases_v20120 where id=p_case for update;if c.id is null then raise exception 'RECON_20120_CASE_NOT_FOUND';end if;
 if c.status<>'repair_proposed' or c.repair_kind='' then raise exception 'RECON_20120_REPAIR_NOT_PROPOSED';end if;
 update public.reconciliation_cases_v20120 set status='repair_approved',approved_by=left(coalesce(p_actor,'system'),160),approved_at=now(),updated_at=now() where id=c.id;
 insert into public.reconciliation_repair_audit_v20120(case_id,action,repair_kind,actor,evidence_sha256,before_state,note) values(c.id,'approve',c.repair_kind,left(coalesce(p_actor,'system'),160),c.evidence_sha256,to_jsonb(c),'Repair approved; apply still re-validates proof.');
 return jsonb_build_object('ok',true,'caseId',c.id,'status','repair_approved','repairKind',c.repair_kind);
end $function$;

-- Apply is deliberately limited to control-plane status repair. It never changes coins, items, rewards or mail payloads.
create or replace function public.powder_reconciliation_apply_repair_v20120(p_case uuid,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c public.reconciliation_cases_v20120;before jsonb;after jsonb;proof_effect boolean:=false;proof_atomic boolean:=false;begin
 select * into c from public.reconciliation_cases_v20120 where id=p_case for update;if c.id is null then raise exception 'RECON_20120_CASE_NOT_FOUND';end if;
 if c.status<>'repair_approved' then raise exception 'RECON_20120_REPAIR_NOT_APPROVED';end if;before:=to_jsonb(c);
 select exists(select 1 from public.resource_effect_ledger_v20120 where user_id=c.user_id and scope=c.scope and tx_key=c.tx_key and status in ('observed','verified','repaired')) into proof_effect;
 select exists(select 1 from public.mutation_effect_receipts_v20100 where user_id=c.user_id and scope=c.scope and tx_key=c.tx_key) into proof_atomic;
 if c.repair_kind='mark_committed_from_proof' then
   if not (proof_effect or proof_atomic) then raise exception 'RECON_20120_COMMIT_PROOF_MISSING';end if;
   update public.transaction_receipts_v2090 set status='committed',error_code='',error_message='',lease_token=null,lease_expires_at=null,committed_at=coalesce(committed_at,now()),updated_at=now() where user_id=c.user_id and scope=c.scope and tx_key=c.tx_key;
   update public.transaction_recovery_queue_v2090 set status='resolved_committed',resolved_at=now(),updated_at=now(),resolved_by=left(coalesce(p_actor,'system'),160),resolution_note='20.12 repair: commit proven by immutable effect evidence; no resource replay.' where user_id=c.user_id and scope=c.scope and tx_key=c.tx_key and status in ('queued','investigating');
 elsif c.repair_kind='mark_not_committed_from_proof' then
   if proof_effect or proof_atomic then raise exception 'RECON_20120_NOT_COMMITTED_PROOF_CONFLICT';end if;
   update public.transaction_receipts_v2090 set status='failed',error_code='RECON_20120_PROVEN_NOT_COMMITTED',error_message='No committed effect proof; safe retry must use same txKey.',lease_token=null,lease_expires_at=null,updated_at=now() where user_id=c.user_id and scope=c.scope and tx_key=c.tx_key and status<>'committed';
   update public.transaction_recovery_queue_v2090 set status='resolved_not_committed',resolved_at=now(),updated_at=now(),resolved_by=left(coalesce(p_actor,'system'),160),resolution_note='20.12 repair: no effect evidence; no resource replay.' where user_id=c.user_id and scope=c.scope and tx_key=c.tx_key and status in ('queued','investigating');
 elsif c.repair_kind='quarantine' then
   update public.mutation_adapter_dispatch_v20110 set status='investigating',error_code='RECON_20120_QUARANTINED',error_message='Quarantined by 20.12 reconciliation.',updated_at=now() where user_id=c.user_id and scope=c.scope and tx_key=c.tx_key and status not in ('succeeded','resolved');
   update public.transaction_recovery_queue_v2090 set status='investigating',updated_at=now() where user_id=c.user_id and scope=c.scope and tx_key=c.tx_key and status='queued';
 elsif c.repair_kind='dismiss_false_positive' then
   update public.reconciliation_cases_v20120 set status='dismissed',resolved_by=left(coalesce(p_actor,'system'),160),resolved_at=now(),resolution_note='Dismissed with evidence; no resource mutation.',updated_at=now() where id=c.id;
   select to_jsonb(x) into after from public.reconciliation_cases_v20120 x where x.id=c.id;
   insert into public.reconciliation_repair_audit_v20120(case_id,action,repair_kind,actor,evidence_sha256,before_state,after_state,note) values(c.id,'dismiss',c.repair_kind,left(coalesce(p_actor,'system'),160),c.evidence_sha256,before,after,'False positive dismissed; no resource mutation.');
   return jsonb_build_object('ok',true,'caseId',c.id,'status','dismissed','resourceMutation',false);
 elsif c.repair_kind<>'resolve_from_proof' then raise exception 'RECON_20120_REPAIR_KIND_DENIED'; end if;
 if c.repair_kind<>'dismiss_false_positive' then update public.reconciliation_cases_v20120 set status='resolved',resolved_by=left(coalesce(p_actor,'system'),160),resolved_at=now(),resolution_note='20.12 control-plane repair applied from recorded evidence. No player resource replay.',updated_at=now() where id=c.id;end if;
 select to_jsonb(x) into after from public.reconciliation_cases_v20120 x where x.id=c.id;
 insert into public.reconciliation_repair_audit_v20120(case_id,action,repair_kind,actor,evidence_sha256,before_state,after_state,note) values(c.id,'apply',c.repair_kind,left(coalesce(p_actor,'system'),160),c.evidence_sha256,before,after,'Control-plane repair only; automaticResourceReplay=false.');
 return jsonb_build_object('ok',true,'caseId',c.id,'status','resolved','repairKind',c.repair_kind,'resourceMutation',false,'automaticResourceReplay',false);
end $function$;

create or replace function public.powder_reconciliation_drill_v20120(p_actor text default 'system')
returns jsonb language plpgsql security definer set search_path=public as $function$
declare u uuid:=gen_random_uuid();k text:='recon-drill-'||replace(gen_random_uuid()::text,'-','');r1 jsonb;r2 jsonb;idem boolean:=false;mismatch_blocked boolean:=false;atomic jsonb:='{}'::jsonb;atomic_pass boolean:=false;status text:='fail';did uuid:=gen_random_uuid();begin
 begin
  r1:=public.powder_resource_effect_record_v20120(u,'support',k,'recon_probe','currency:probe','currency','probe',1,jsonb_build_object('v',0),jsonb_build_object('v',1),'','', 'drill',jsonb_build_object('drill',true));
  r2:=public.powder_resource_effect_record_v20120(u,'support',k,'recon_probe','currency:probe','currency','probe',1,jsonb_build_object('v',0),jsonb_build_object('v',1),'','', 'drill',jsonb_build_object('drill',true));
  idem:=coalesce((r2->>'idempotent')::boolean,false);
  begin
   perform public.powder_resource_effect_record_v20120(u,'support',k,'recon_probe','currency:probe','currency','probe',2,jsonb_build_object('v',0),jsonb_build_object('v',2),'','', 'drill',jsonb_build_object('drill',true));
  exception when others then mismatch_blocked:=position('EFFECT_KEY_MISMATCH' in sqlerrm)>0; end;
  begin atomic:=public.powder_mutation_chaos_drill_v20100(p_actor); exception when others then atomic:=jsonb_build_object('status','blocked','error',sqlerrm); end;
  atomic_pass:=coalesce(atomic->>'status','')='pass';
 exception when others then
  atomic:=jsonb_build_object('status','fail','error',sqlerrm);
 end;
 delete from public.resource_effect_ledger_v20120 where user_id=u and scope='support' and tx_key=k;
 status:=case when idem and mismatch_blocked and atomic_pass then 'pass' else 'fail' end;
 insert into public.reconciliation_drills_v20120(id,actor,status,checks,details) values(did,left(coalesce(p_actor,'system'),160),status,jsonb_build_object('effectIdempotent',idem,'effectMismatchBlocked',mismatch_blocked,'atomicRollbackDrill',atomic_pass),jsonb_build_object('atomic',atomic,'automaticResourceReplay',false));
 return jsonb_build_object('ok',status='pass','version','20.12.0','drillId',did,'status',status,'checks',jsonb_build_object('effectIdempotent',idem,'effectMismatchBlocked',mismatch_blocked,'atomicRollbackDrill',atomic_pass),'automaticResourceReplay',false,'at',now());
end $function$;

-- Official Launch 20.12: 20.11 adapter gate + fresh/clean reconciliation are both hard gates.
create or replace function public.powder_official_launch_preflight_v20120(
 p_channel text default 'production',p_build text default 'powder-20.12.0-reconciliation-crash-recovery',p_manifest_hash text default ''
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;base jsonb:='{}'::jsonb;b public.release_builds;rec jsonb:='{}'::jsonb;adp jsonb:='{}'::jsonb;checks jsonb:='{}'::jsonb;candidate_ok boolean:=false;adapter_ok boolean:=false;recon_ok boolean:=false;ready boolean:=false;begin
 begin base:=public.powder_official_launch_preflight_v20110(c,p_build,p_manifest_hash); exception when others then base:=jsonb_build_object('ready',false,'checks','{}'::jsonb,'error',sqlerrm); end;
 select * into b from public.release_builds where channel=c and build_id=p_build limit 1;
 begin adp:=public.powder_mutation_adapter_posture_v20110(); exception when others then adp:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin rec:=public.powder_reconciliation_posture_v20120(); exception when others then rec:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 candidate_ok:=b.build_id is not null and b.version='20.12.0' and b.status in ('candidate','active') and b.checksum~'^[0-9a-fA-F]{64}$';
 adapter_ok:=coalesce((adp->>'ready')::boolean,false);recon_ok:=coalesce((rec->>'ready')::boolean,false);
 checks:=coalesce(base->'checks','{}'::jsonb)||jsonb_build_object('candidate',candidate_ok,'canonicalMutationAdapters',adapter_ok,'reconciliationClean',recon_ok);
 ready:=candidate_ok and adapter_ok and recon_ok
  and coalesce((checks->>'integrity')::boolean,false) and coalesce((checks->>'securityPosture')::boolean,false)
  and coalesce((checks->>'recovery')::boolean,false) and coalesce((checks->>'transactionIntegrity')::boolean,false)
  and coalesce((checks->>'serverMutationIntegration')::boolean,false) and coalesce((checks->>'canonicalMutationAdapters')::boolean,false)
  and coalesce((checks->>'realPilot')::boolean,false) and coalesce((checks->>'rolloutNormal')::boolean,false)
  and coalesce((checks->>'evidence4of4')::boolean,false) and coalesce((checks->>'liveOpsIncidents')::boolean,false)
  and coalesce((checks->>'observabilityArmed')::boolean,false) and coalesce((checks->>'reliabilityNormal')::boolean,false)
  and coalesce((checks->>'rollbackPinned')::boolean,false) and coalesce((checks->>'authorizationArmed')::boolean,false)
  and coalesce((checks->>'changeWindowOpen')::boolean,false) and coalesce((checks->>'reconciliationClean')::boolean,false);
 return (base-'version'-'ready'-'checks'-'candidate')||jsonb_build_object('version','20.12.0','ready',ready,'checks',checks,'candidate',case when b.build_id is null then null else to_jsonb(b) end,'canonicalAdapters',adp,'reconciliation',rec,'checkedAt',now());
end $function$;

create or replace function public.powder_official_activate_canary_v20120(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;target public.release_builds;auth public.official_release_authorization_v2070;nowts timestamptz:=now();begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20120:'||c,0));pf:=public.powder_official_launch_preflight_v20120(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20120_PREFLIGHT_NOT_READY';end if;
 select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into target from public.release_builds where channel=c and build_id=p_build for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;
 if target.version<>'20.12.0' then raise exception 'OFFICIAL_20120_CANDIDATE_INVALID';end if;if ch.build_id=p_build then raise exception 'OFFICIAL_20120_ALREADY_ACTIVE';end if;if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_20120_AUTH_NOT_ARMED';end if;if auth.rollback_target_build<>ch.build_id or ro.rollback_target_build<>ch.build_id then raise exception 'OFFICIAL_20120_ROLLBACK_TARGET_DRIFT';end if;
 update public.release_builds set status='rolled_back' where channel=c and build_id=ch.build_id;update public.release_builds set status='active',activated_at=nowts where channel=c and build_id=p_build;update public.release_channels set current_version=target.version,build_id=target.build_id,asset_epoch=coalesce(asset_epoch,0)+1,updated_at=nowts,updated_by=p_admin where channel=c;update public.release_rollout_v1950 set rollout_percent=5,emergency_mode='normal',emergency_message='',updated_at=nowts,updated_by=p_admin where channel=c;delete from public.official_rollout_server_evidence_v2070 where channel=c and build_id=p_build;
 insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_canary_5_v20120',target.version,target.build_id,ch.current_version,jsonb_build_object('manifestHash',p_manifest_hash,'rollbackTarget',auth.rollback_target_build,'authorizationRevision',auth.revision,'reconciliation','20.12.0','automaticResourceReplay',false),p_admin,nowts);
 return jsonb_build_object('ok',true,'channel',c,'version',target.version,'buildId',target.build_id,'rolloutPercent',5,'previousBuildId',ch.build_id,'at',nowts);
end $function$;

create or replace function public.powder_official_advance_rollout_v20120(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;cur smallint;nxt smallint;nowts timestamptz:=now();begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20120:'||c,0));pf:=public.powder_official_launch_preflight_v20120(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20120_PREFLIGHT_NOT_READY';end if;
 select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;if ch.build_id<>p_build or ch.current_version<>'20.12.0' then raise exception 'OFFICIAL_20120_BUILD_NOT_ACTIVE';end if;if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_20120_AUTH_WINDOW_CLOSED';end if;cur:=ro.rollout_percent;nxt:=case cur when 5 then 20 when 20 then 50 when 50 then 100 else null end;if nxt is null then raise exception 'OFFICIAL_20120_STAGE_NOT_ADVANCEABLE';end if;
 if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=cur and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_20120_SERVER_HEALTH_NOT_PASSED';end if;
 update public.release_rollout_v1950 set rollout_percent=nxt,updated_at=nowts,updated_by=p_admin where channel=c;insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_rollout_'||nxt::text||'_v20120',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('fromPercent',cur,'toPercent',nxt,'manifestHash',p_manifest_hash,'healthSource','server-observability+transaction-integrity+canonical-adapters+reconciliation'),p_admin,nowts);return jsonb_build_object('ok',true,'channel',c,'buildId',p_build,'fromPercent',cur,'rolloutPercent',nxt,'at',nowts);
end $function$;

create or replace function public.powder_official_finalize_live_v20120(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;nowts timestamptz:=now();begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20120:'||c,0));pf:=public.powder_official_launch_preflight_v20120(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20120_PREFLIGHT_NOT_READY';end if;select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;if ch.build_id<>p_build or ch.current_version<>'20.12.0' then raise exception 'OFFICIAL_20120_BUILD_NOT_ACTIVE';end if;if ro.rollout_percent<>100 then raise exception 'OFFICIAL_20120_ROLLOUT_NOT_100';end if;if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=100 and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_20120_FINAL_HEALTH_NOT_PASSED';end if;
 update public.launch_config_v170 set launch_status='live',content_frozen=true,registration_open=true,updated_by=p_admin,updated_at=nowts where id=1;update public.official_release_authorization_v2070 set status='consumed',consumed_at=nowts,updated_at=nowts,updated_by=p_admin where channel=c and build_id=p_build;insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_live_v20120',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('rolloutPercent',100,'manifestHash',p_manifest_hash,'authorizationRevision',auth.revision,'healthSource','server-observability+transaction-integrity+canonical-adapters+reconciliation'),p_admin,nowts);return jsonb_build_object('ok',true,'official',true,'channel',c,'version',ch.current_version,'buildId',ch.build_id,'rolloutPercent',100,'at',nowts);
end $function$;

revoke all on function public.powder_reconciliation_sha_v20120(jsonb) from public,anon,authenticated;
revoke all on function public.powder_resource_effect_record_v20120(uuid,text,text,text,text,text,text,numeric,jsonb,jsonb,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.powder_reconciliation_open_case_v20120(uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.powder_reconciliation_scan_v20120(integer,text) from public,anon,authenticated;
revoke all on function public.powder_reconciliation_posture_v20120() from public,anon,authenticated;
revoke all on function public.powder_reconciliation_propose_repair_v20120(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_reconciliation_approve_repair_v20120(uuid,text) from public,anon,authenticated;
revoke all on function public.powder_reconciliation_apply_repair_v20120(uuid,text) from public,anon,authenticated;
revoke all on function public.powder_reconciliation_drill_v20120(text) from public,anon,authenticated;
revoke all on function public.powder_official_launch_preflight_v20120(text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_activate_canary_v20120(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_advance_rollout_v20120(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_finalize_live_v20120(text,text,text,text) from public,anon,authenticated;
grant execute on function public.powder_reconciliation_sha_v20120(jsonb) to service_role;
grant execute on function public.powder_resource_effect_record_v20120(uuid,text,text,text,text,text,text,numeric,jsonb,jsonb,text,text,text,jsonb) to service_role;
grant execute on function public.powder_reconciliation_open_case_v20120(uuid,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.powder_reconciliation_scan_v20120(integer,text) to service_role;
grant execute on function public.powder_reconciliation_posture_v20120() to service_role;
grant execute on function public.powder_reconciliation_propose_repair_v20120(uuid,text,text,text) to service_role;
grant execute on function public.powder_reconciliation_approve_repair_v20120(uuid,text) to service_role;
grant execute on function public.powder_reconciliation_apply_repair_v20120(uuid,text) to service_role;
grant execute on function public.powder_reconciliation_drill_v20120(text) to service_role;
grant execute on function public.powder_official_launch_preflight_v20120(text,text,text) to service_role;
grant execute on function public.powder_official_activate_canary_v20120(text,text,text,text) to service_role;
grant execute on function public.powder_official_advance_rollout_v20120(text,text,text,text) to service_role;
grant execute on function public.powder_official_finalize_live_v20120(text,text,text,text) to service_role;
