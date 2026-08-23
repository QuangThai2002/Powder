-- Powder 20.10.0 — Server Mutation Integration & Reconciliation Drill
-- Provides a fail-closed atomic mutation gateway for resource writes.
-- Canonical handlers MUST implement: (p_user uuid, p_payload jsonb) returns jsonb.
-- The gateway executes handler + receipt/effect marker in one PostgreSQL transaction.

create extension if not exists pgcrypto;

alter table public.transaction_receipts_v2090
  add column if not exists executor text not null default '',
  add column if not exists atomic_group_id uuid;
create index if not exists transaction_receipts_v2090_executor_status_idx
  on public.transaction_receipts_v2090(executor,status,updated_at);

create table if not exists public.mutation_contracts_v20100 (
  scope text not null,
  action text not null,
  handler_schema text not null default 'public',
  handler_function text not null,
  required_for_launch boolean not null default true,
  enabled boolean not null default false,
  mutation_kind text not null default 'write' check (mutation_kind in ('write','read')),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'migration',
  primary key(scope,action),
  check (scope in ('economy','inventory','reward','mail','event','purchase','support')),
  check (action ~ '^[a-z0-9_]{2,80}$'),
  check (handler_schema ~ '^[a-zA-Z_][a-zA-Z0-9_]{0,62}$'),
  check (handler_function ~ '^[a-zA-Z_][a-zA-Z0-9_]{0,62}$')
);

create table if not exists public.mutation_effect_receipts_v20100 (
  user_id uuid not null,
  scope text not null,
  tx_key text not null,
  action text not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  result_sha256 text not null check (result_sha256 ~ '^[0-9a-f]{64}$'),
  handler text not null,
  atomic_group_id uuid not null,
  result jsonb not null default '{}'::jsonb,
  committed_at timestamptz not null default now(),
  primary key(user_id,scope,tx_key),
  unique(atomic_group_id)
);
create index if not exists mutation_effect_receipts_v20100_committed_idx
  on public.mutation_effect_receipts_v20100(committed_at desc);

create table if not exists public.mutation_reconciliation_runs_v20100 (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'system',
  scanned integer not null default 0,
  auto_committed integer not null default 0,
  auto_not_committed integer not null default 0,
  legacy_manual integer not null default 0,
  anomalies integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mutation_chaos_drills_v20100 (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'system',
  status text not null check (status in ('pass','fail','blocked')),
  checks jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mutation_chaos_sandbox_v20100 (
  user_id uuid primary key,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.mutation_contracts_v20100 enable row level security;
alter table public.mutation_effect_receipts_v20100 enable row level security;
alter table public.mutation_reconciliation_runs_v20100 enable row level security;
alter table public.mutation_chaos_drills_v20100 enable row level security;
alter table public.mutation_chaos_sandbox_v20100 enable row level security;
revoke all on table public.mutation_contracts_v20100 from anon,authenticated;
revoke all on table public.mutation_effect_receipts_v20100 from anon,authenticated;
revoke all on table public.mutation_reconciliation_runs_v20100 from anon,authenticated;
revoke all on table public.mutation_chaos_drills_v20100 from anon,authenticated;
revoke all on table public.mutation_chaos_sandbox_v20100 from anon,authenticated;
grant select,insert,update,delete on table public.mutation_contracts_v20100 to service_role;
grant select,insert,update,delete on table public.mutation_effect_receipts_v20100 to service_role;
grant select,insert,update,delete on table public.mutation_reconciliation_runs_v20100 to service_role;
grant select,insert,update,delete on table public.mutation_chaos_drills_v20100 to service_role;
grant select,insert,update,delete on table public.mutation_chaos_sandbox_v20100 to service_role;

-- Required write surface observed in the 20.9 player client. Handlers are intentionally disabled
-- until a canonical adapter with the standard (uuid,jsonb)->jsonb signature is deployed.
insert into public.mutation_contracts_v20100(scope,action,handler_function,required_for_launch,enabled,notes) values
 ('economy','buy_candy','powder_mutation_buy_candy_v20100',true,false,'Coin debit + candy credit'),
 ('economy','consume_candy','powder_mutation_consume_candy_v20100',true,false,'Candy debit'),
 ('economy','feed_candy','powder_mutation_feed_candy_v20100',true,false,'Candy debit + Pow EXP/level'),
 ('economy','open_powball','powder_mutation_open_powball_v20100',true,false,'PowBall debit + authoritative roll/grant'),
 ('economy','upgrade_pow','powder_mutation_upgrade_pow_v20100',true,false,'Coin/shard debit + star upgrade'),
 ('reward','claim_daily','powder_mutation_claim_daily_v20100',true,false,'Daily journey reward claim'),
 ('economy','daily_boss_entry','powder_mutation_daily_boss_entry_v20100',true,false,'Knowledge debit / boss entry'),
 ('inventory','equipment_equip','powder_mutation_equipment_equip_v20100',true,false,'Equip ownership/loadout mutation'),
 ('inventory','equipment_unequip','powder_mutation_equipment_unequip_v20100',true,false,'Unequip loadout mutation'),
 ('inventory','artifact_equip','powder_mutation_artifact_equip_v20100',true,false,'Artifact equip ownership mutation'),
 ('inventory','artifact_unequip','powder_mutation_artifact_unequip_v20100',true,false,'Artifact unequip mutation'),
 ('inventory','item_lock','powder_mutation_item_lock_v20100',true,false,'Inventory item lock mutation'),
 ('mail','claim_mail','powder_mutation_claim_mail_v20100',true,false,'Mail reward claim'),
 ('reward','claim_daily_login','powder_mutation_claim_daily_login_v20100',true,false,'Daily login reward claim'),
 ('event','claim_mission','powder_mutation_event_claim_mission_v20100',true,false,'Event mission reward'),
 ('event','claim_completion','powder_mutation_event_claim_completion_v20100',true,false,'Event completion reward'),
 ('purchase','event_buy','powder_mutation_event_buy_v20100',true,false,'Event currency debit + reward grant'),
 ('event','finish_combat','powder_mutation_event_finish_combat_v20100',true,false,'Event combat completion/progress')
on conflict(scope,action) do update set
 handler_function=excluded.handler_function,
 required_for_launch=excluded.required_for_launch,
 notes=excluded.notes,
 updated_at=now();

create or replace function public.powder_mutation_handler_exists_v20100(p_schema text,p_function text)
returns boolean language sql security definer set search_path=public stable as $function$
  select to_regprocedure(format('%I.%I(uuid,jsonb)',coalesce(p_schema,'public'),coalesce(p_function,''))) is not null;
$function$;

create or replace function public.powder_mutation_hash_result_v20100(p_result jsonb)
returns text language sql immutable as $function$
  select encode(digest(coalesce(p_result,'{}'::jsonb)::text,'sha256'),'hex');
$function$;

-- Atomic gateway: receipt + canonical handler + effect marker commit together.
create or replace function public.powder_mutation_execute_v20100(
  p_user uuid,
  p_scope text,
  p_action text,
  p_tx_key text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $function$
declare
  sc text:=lower(trim(coalesce(p_scope,'')));
  act text:=lower(trim(coalesce(p_action,'')));
  k text:=trim(coalesce(p_tx_key,''));
  c public.mutation_contracts_v20100;
  r public.transaction_receipts_v2090;
  req_hash text;
  group_id uuid:=gen_random_uuid();
  handler_result jsonb:='{}'::jsonb;
  handler_qname text;
  allowed boolean:=false;
  err_code text; err_msg text; err_detail text;
begin
  if p_user is null then raise exception 'MUTATION_20100_USER_REQUIRED'; end if;
  if sc not in ('economy','inventory','reward','mail','event','purchase','support') then raise exception 'MUTATION_20100_SCOPE_INVALID'; end if;
  if act !~ '^[a-z0-9_]{2,80}$' then raise exception 'MUTATION_20100_ACTION_INVALID'; end if;
  if length(k)<12 or length(k)>180 or k !~ '^[A-Za-z0-9:._-]+$' then raise exception 'MUTATION_20100_KEY_INVALID'; end if;
  if octet_length(coalesce(p_payload,'{}'::jsonb)::text)>32768 then raise exception 'MUTATION_20100_PAYLOAD_TOO_LARGE'; end if;

  select * into c from public.mutation_contracts_v20100 where scope=sc and action=act;
  if not found or c.mutation_kind<>'write' or c.enabled is not true then raise exception 'MUTATION_20100_CONTRACT_NOT_READY'; end if;
  if public.powder_mutation_handler_exists_v20100(c.handler_schema,c.handler_function) is not true then raise exception 'MUTATION_20100_HANDLER_MISSING'; end if;

  begin
    allowed:=public.powder_reliability_can_write_v2080(case when sc='inventory' then 'inventory' when sc in ('reward','mail','event') then 'reward' else 'economy' end);
  exception when others then allowed:=false; end;
  if allowed is not true then raise exception 'MUTATION_20100_RELIABILITY_WRITE_BLOCKED'; end if;

  perform set_config('statement_timeout','12000',true);
  req_hash:=public.powder_transaction_hash_v2090(act,coalesce(p_payload,'{}'::jsonb));
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||'|'||sc||'|'||k,0));
  select * into r from public.transaction_receipts_v2090 where user_id=p_user and scope=sc and tx_key=k for update;

  if found then
    if r.request_sha256<>req_hash or r.operation<>act then
      insert into public.transaction_integrity_events_v2090(user_id,scope,tx_key,event_type,details,actor)
      values(p_user,sc,k,'key_reuse_mismatch',jsonb_build_object('executor','atomic_gateway_v20100','storedOperation',r.operation,'incomingOperation',act,'storedHash',r.request_sha256,'incomingHash',req_hash),'atomic_gateway_v20100');
      raise exception 'MUTATION_20100_KEY_REUSE_MISMATCH';
    end if;
    if r.status='committed' then
      return jsonb_build_object('ok',true,'execute',false,'idempotent',true,'atomic',r.executor='atomic_gateway_v20100','status','committed','txKey',k,'result',r.result,'committedAt',r.committed_at);
    end if;
    -- A receipt created by the old split BEGIN/COMMIT protocol is never taken over by the atomic gateway.
    if coalesce(r.executor,'')<>'' and r.executor<>'atomic_gateway_v20100' then raise exception 'MUTATION_20100_EXECUTOR_CONFLICT'; end if;
    if coalesce(r.executor,'')='' then raise exception 'MUTATION_20100_LEGACY_RECEIPT_REQUIRES_RECONCILIATION'; end if;
  else
    insert into public.transaction_receipts_v2090(user_id,scope,tx_key,operation,request_sha256,status,lease_token,lease_expires_at,attempt_count,executor,atomic_group_id)
    values(p_user,sc,k,act,req_hash,'pending',null,null,1,'atomic_gateway_v20100',group_id)
    returning * into r;
  end if;

  handler_qname:=format('%I.%I',c.handler_schema,c.handler_function);
  begin
    execute format('select %s($1,$2)',handler_qname) into handler_result using p_user,coalesce(p_payload,'{}'::jsonb);
    handler_result:=coalesce(handler_result,'{}'::jsonb);

    insert into public.mutation_effect_receipts_v20100(user_id,scope,tx_key,action,request_sha256,result_sha256,handler,atomic_group_id,result)
    values(p_user,sc,k,act,req_hash,public.powder_mutation_hash_result_v20100(handler_result),handler_qname,group_id,handler_result);

    update public.transaction_receipts_v2090
       set status='committed',result=handler_result,error_code='',error_message='',lease_token=null,lease_expires_at=null,
           executor='atomic_gateway_v20100',atomic_group_id=group_id,updated_at=now(),committed_at=now()
     where user_id=p_user and scope=sc and tx_key=k;

    update public.transaction_recovery_queue_v2090 set status='resolved_committed',updated_at=now(),resolved_at=now(),resolved_by='atomic_gateway_v20100',resolution_note='Atomic effect receipt proves canonical mutation committed.'
     where user_id=p_user and scope=sc and tx_key=k and status in ('queued','investigating');
  exception when others then
    get stacked diagnostics err_code=returned_sqlstate,err_msg=message_text,err_detail=pg_exception_detail;
    -- The EXCEPTION block rolls back all handler-side writes from the nested subtransaction.
    update public.transaction_receipts_v2090
       set status='failed',executor='atomic_gateway_v20100',atomic_group_id=group_id,error_code=left(coalesce(err_code,'MUTATION_FAILED'),120),
           error_message=left(coalesce(err_msg,'Mutation failed'),800),lease_token=null,lease_expires_at=null,updated_at=now()
     where user_id=p_user and scope=sc and tx_key=k;
    return jsonb_build_object('ok',false,'atomic',true,'rolledBack',true,'status','failed','txKey',k,'error','MUTATION_20100_HANDLER_FAILED','sqlstate',err_code,'message',left(coalesce(err_msg,''),500));
  end;

  return jsonb_build_object('ok',true,'execute',true,'idempotent',false,'atomic',true,'status','committed','txKey',k,'result',handler_result,'atomicGroupId',group_id,'handler',handler_qname);
end $function$;

-- Deterministic reconciliation for transactions executed by the atomic gateway.
-- effect marker present => committed; atomic receipt with no marker => handler transaction did not commit.
-- Legacy split-protocol receipts remain manual and are never guessed/replayed.
create or replace function public.powder_mutation_reconcile_v20100(p_limit integer default 100,p_actor text default 'system')
returns jsonb language plpgsql security definer set search_path=public as $function$
declare lim int:=greatest(1,least(500,coalesce(p_limit,100))); n_scan int:=0;n_commit int:=0;n_not int:=0;n_legacy int:=0;n_anom int:=0;run_id uuid:=gen_random_uuid();
begin
  perform public.powder_transaction_reconcile_scan_v2090(lim,p_actor);

  with candidates as (
    select q.id,q.user_id,q.scope,q.tx_key,r.executor,r.status as receipt_status,e.result,e.committed_at
      from public.transaction_recovery_queue_v2090 q
      join public.transaction_receipts_v2090 r on r.user_id=q.user_id and r.scope=q.scope and r.tx_key=q.tx_key
      left join public.mutation_effect_receipts_v20100 e on e.user_id=q.user_id and e.scope=q.scope and e.tx_key=q.tx_key
     where q.status in ('queued','investigating')
     order by q.created_at asc limit lim for update of q skip locked
  ), committed as (
    update public.transaction_receipts_v2090 r set status='committed',result=c.result,error_code='',error_message='',lease_token=null,lease_expires_at=null,committed_at=coalesce(r.committed_at,c.committed_at,now()),updated_at=now()
      from candidates c where c.executor='atomic_gateway_v20100' and c.result is not null and r.user_id=c.user_id and r.scope=c.scope and r.tx_key=c.tx_key
    returning r.user_id,r.scope,r.tx_key
  ), qcommit as (
    update public.transaction_recovery_queue_v2090 q set status='resolved_committed',resolved_at=now(),updated_at=now(),resolved_by=left(coalesce(p_actor,'system'),160),resolution_note='20.10 effect receipt proves atomic commit.'
      where exists(select 1 from committed c where c.user_id=q.user_id and c.scope=q.scope and c.tx_key=q.tx_key) and q.status in ('queued','investigating') returning q.id
  ) select count(*) into n_commit from qcommit;

  with candidates as (
    select q.id,q.user_id,q.scope,q.tx_key,r.executor
      from public.transaction_recovery_queue_v2090 q
      join public.transaction_receipts_v2090 r on r.user_id=q.user_id and r.scope=q.scope and r.tx_key=q.tx_key
      left join public.mutation_effect_receipts_v20100 e on e.user_id=q.user_id and e.scope=q.scope and e.tx_key=q.tx_key
     where q.status in ('queued','investigating') and r.executor='atomic_gateway_v20100' and e.tx_key is null
     order by q.created_at asc limit lim for update of q skip locked
  ), failed as (
    update public.transaction_receipts_v2090 r set status='failed',error_code='ATOMIC_EFFECT_ABSENT',error_message='20.10 atomic transaction has no committed effect marker; no resource replay performed.',lease_token=null,lease_expires_at=null,updated_at=now()
      from candidates c where r.user_id=c.user_id and r.scope=c.scope and r.tx_key=c.tx_key and r.status<>'committed' returning r.user_id,r.scope,r.tx_key
  ), qnot as (
    update public.transaction_recovery_queue_v2090 q set status='resolved_not_committed',resolved_at=now(),updated_at=now(),resolved_by=left(coalesce(p_actor,'system'),160),resolution_note='20.10 atomic semantics + absent effect marker prove not committed; safe retry must use same txKey.'
      where exists(select 1 from failed f where f.user_id=q.user_id and f.scope=q.scope and f.tx_key=q.tx_key) and q.status in ('queued','investigating') returning q.id
  ) select count(*) into n_not from qnot;

  select count(*) into n_legacy from public.transaction_recovery_queue_v2090 q join public.transaction_receipts_v2090 r on r.user_id=q.user_id and r.scope=q.scope and r.tx_key=q.tx_key where q.status in ('queued','investigating') and coalesce(r.executor,'')<>'atomic_gateway_v20100';
  select count(*) into n_anom from public.transaction_receipts_v2090 r left join public.mutation_effect_receipts_v20100 e on e.user_id=r.user_id and e.scope=r.scope and e.tx_key=r.tx_key where r.executor='atomic_gateway_v20100' and ((r.status='committed' and e.tx_key is null) or (r.status<>'committed' and e.tx_key is not null));
  n_scan:=n_commit+n_not+n_legacy;
  insert into public.mutation_reconciliation_runs_v20100(id,actor,scanned,auto_committed,auto_not_committed,legacy_manual,anomalies,details)
  values(run_id,left(coalesce(p_actor,'system'),160),n_scan,n_commit,n_not,n_legacy,n_anom,jsonb_build_object('automaticReplay',false,'proof','atomic effect marker'));
  return jsonb_build_object('ok',true,'version','20.10.0','runId',run_id,'scanned',n_scan,'autoCommitted',n_commit,'autoNotCommitted',n_not,'legacyManual',n_legacy,'anomalies',n_anom,'automaticReplay',false,'at',now());
end $function$;

create or replace function public.powder_mutation_posture_v20100()
returns jsonb language plpgsql security definer set search_path=public stable as $function$
declare req int:=0;ready_handlers int:=0;enabled_missing int:=0;atomic_open int:=0;atomic_anom int:=0;legacy_open int:=0;last_drill timestamptz;last_status text;ready boolean:=false;
begin
  select count(*),count(*) filter(where enabled and public.powder_mutation_handler_exists_v20100(handler_schema,handler_function)),count(*) filter(where enabled and not public.powder_mutation_handler_exists_v20100(handler_schema,handler_function))
    into req,ready_handlers,enabled_missing from public.mutation_contracts_v20100 where required_for_launch;
  select count(*) into atomic_open from public.transaction_receipts_v2090 where executor='atomic_gateway_v20100' and status in ('pending','reconciling');
  select count(*) into legacy_open from public.transaction_recovery_queue_v2090 q join public.transaction_receipts_v2090 r on r.user_id=q.user_id and r.scope=q.scope and r.tx_key=q.tx_key where q.status in ('queued','investigating') and coalesce(r.executor,'')<>'atomic_gateway_v20100';
  select count(*) into atomic_anom from public.transaction_receipts_v2090 r left join public.mutation_effect_receipts_v20100 e on e.user_id=r.user_id and e.scope=r.scope and e.tx_key=r.tx_key where r.executor='atomic_gateway_v20100' and ((r.status='committed' and e.tx_key is null) or (r.status<>'committed' and e.tx_key is not null));
  select created_at,status into last_drill,last_status from public.mutation_chaos_drills_v20100 order by created_at desc limit 1;
  ready:=req>0 and ready_handlers=req and enabled_missing=0 and atomic_open=0 and atomic_anom=0 and legacy_open=0 and last_status='pass' and last_drill>=now()-interval '7 days';
  return jsonb_build_object('version','20.10.0','ready',ready,'checkedAt',now(),
    'contracts',jsonb_build_object('required',req,'ready',ready_handlers,'enabledMissingHandler',enabled_missing),
    'transactions',jsonb_build_object('atomicOpen',atomic_open,'atomicAnomalies',atomic_anom,'legacyRecoveryOpen',legacy_open),
    'chaos',jsonb_build_object('lastStatus',coalesce(last_status,'none'),'lastAt',last_drill,'fresh7d',coalesce(last_drill>=now()-interval '7 days',false)),
    'guards',jsonb_build_object('atomicHandlerAndReceipt',true,'automaticResourceReplay',false,'legacyFallbackAllowedForOfficial',false));
end $function$;

-- Sandbox canonical handler used only by the drill. Not part of the launch-required contracts.
create or replace function public.powder_mutation_chaos_increment_v20100(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare amount int:=greatest(1,least(10,coalesce((p_payload->>'amount')::int,1)));bal int;
begin
  insert into public.mutation_chaos_sandbox_v20100(user_id,balance) values(p_user,0) on conflict(user_id) do nothing;
  update public.mutation_chaos_sandbox_v20100 set balance=balance+amount,updated_at=now() where user_id=p_user returning balance into bal;
  if coalesce((p_payload->>'forceError')::boolean,false) then raise exception 'CHAOS_FORCED_ROLLBACK'; end if;
  return jsonb_build_object('balance',bal,'amount',amount);
end $function$;
insert into public.mutation_contracts_v20100(scope,action,handler_function,required_for_launch,enabled,notes)
values('support','chaos_increment','powder_mutation_chaos_increment_v20100',false,true,'20.10 reconciliation sandbox only')
on conflict(scope,action) do update set handler_function=excluded.handler_function,required_for_launch=false,enabled=true,notes=excluded.notes,updated_at=now();

create or replace function public.powder_mutation_chaos_drill_v20100(p_actor text default 'system')
returns jsonb language plpgsql security definer set search_path=public as $function$
declare u uuid:=gen_random_uuid();k text:='tx20100:chaos:'||replace(gen_random_uuid()::text,'-','');r1 jsonb;r2 jsonb;rf jsonb;bal int:=0;dupe_ok boolean:=false;rollback_ok boolean:=false;effect_ok boolean:=false;status text:='fail';drill_id uuid:=gen_random_uuid();
begin
  begin
    r1:=public.powder_mutation_execute_v20100(u,'support','chaos_increment',k,jsonb_build_object('amount',3));
    r2:=public.powder_mutation_execute_v20100(u,'support','chaos_increment',k,jsonb_build_object('amount',3));
    select balance into bal from public.mutation_chaos_sandbox_v20100 where user_id=u;
    dupe_ok:=bal=3 and coalesce((r2->>'idempotent')::boolean,false);
    effect_ok:=exists(select 1 from public.mutation_effect_receipts_v20100 where user_id=u and scope='support' and tx_key=k);
    rf:=public.powder_mutation_execute_v20100(u,'support','chaos_increment',k||':fail',jsonb_build_object('amount',5,'forceError',true));
    select balance into bal from public.mutation_chaos_sandbox_v20100 where user_id=u;
    rollback_ok:=bal=3 and coalesce((rf->>'rolledBack')::boolean,false) and not exists(select 1 from public.mutation_effect_receipts_v20100 where user_id=u and scope='support' and tx_key=k||':fail');
    status:=case when dupe_ok and effect_ok and rollback_ok then 'pass' else 'fail' end;
  exception when others then
    status:='blocked';
    r1:=jsonb_build_object('error',sqlerrm,'sqlstate',sqlstate);
  end;
  insert into public.mutation_chaos_drills_v20100(id,actor,status,checks,details) values(drill_id,left(coalesce(p_actor,'system'),160),status,jsonb_build_object('duplicateIdempotent',dupe_ok,'atomicEffectMarker',effect_ok,'forcedRollback',rollback_ok),jsonb_build_object('user',u,'first',r1,'second',r2,'forced',rf,'finalSandboxBalance',bal));
  delete from public.mutation_chaos_sandbox_v20100 where user_id=u;
  return jsonb_build_object('ok',status='pass','version','20.10.0','drillId',drill_id,'status',status,'checks',jsonb_build_object('duplicateIdempotent',dupe_ok,'atomicEffectMarker',effect_ok,'forcedRollback',rollback_ok),'at',now());
end $function$;

revoke all on function public.powder_mutation_handler_exists_v20100(text,text) from public,anon,authenticated;
revoke all on function public.powder_mutation_hash_result_v20100(jsonb) from public,anon,authenticated;
revoke all on function public.powder_mutation_execute_v20100(uuid,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.powder_mutation_reconcile_v20100(integer,text) from public,anon,authenticated;
revoke all on function public.powder_mutation_posture_v20100() from public,anon,authenticated;
revoke all on function public.powder_mutation_chaos_increment_v20100(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.powder_mutation_chaos_drill_v20100(text) from public,anon,authenticated;
grant execute on function public.powder_mutation_handler_exists_v20100(text,text) to service_role;
grant execute on function public.powder_mutation_hash_result_v20100(jsonb) to service_role;
grant execute on function public.powder_mutation_execute_v20100(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.powder_mutation_reconcile_v20100(integer,text) to service_role;
grant execute on function public.powder_mutation_posture_v20100() to service_role;
grant execute on function public.powder_mutation_chaos_increment_v20100(uuid,jsonb) to service_role;
grant execute on function public.powder_mutation_chaos_drill_v20100(text) to service_role;

-- 20.10 Official Launch surface: reuses all mature 20.7/20.9 posture checks,
-- fixes candidate version to 20.10 and adds Server Mutation Integration as a hard gate.
create or replace function public.powder_official_launch_preflight_v20100(
  p_channel text default 'production',
  p_build text default 'powder-20.10.0-server-mutation-integration-reconciliation-drill',
  p_manifest_hash text default ''
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;base jsonb:='{}'::jsonb;b public.release_builds;mut jsonb:='{}'::jsonb;checks jsonb:='{}'::jsonb;candidate_ok boolean:=false;mutation_ok boolean:=false;ready boolean:=false;
begin
  begin base:=public.powder_official_launch_preflight_v2070(c,p_build,p_manifest_hash); exception when others then base:=jsonb_build_object('ready',false,'checks','{}'::jsonb,'error',sqlerrm); end;
  select * into b from public.release_builds where channel=c and build_id=p_build limit 1;
  begin mut:=public.powder_mutation_posture_v20100(); exception when others then mut:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  candidate_ok:=b.build_id is not null and b.version='20.10.0' and b.status in ('candidate','active') and b.checksum~'^[0-9a-fA-F]{64}$';
  mutation_ok:=coalesce((mut->>'ready')::boolean,false);
  checks:=coalesce(base->'checks','{}'::jsonb)||jsonb_build_object('candidate',candidate_ok,'serverMutationIntegration',mutation_ok);
  ready:=candidate_ok and mutation_ok
    and coalesce((checks->>'integrity')::boolean,false)
    and coalesce((checks->>'securityPosture')::boolean,false)
    and coalesce((checks->>'recovery')::boolean,false)
    and coalesce((checks->>'transactionIntegrity')::boolean,false)
    and coalesce((checks->>'realPilot')::boolean,false)
    and coalesce((checks->>'rolloutNormal')::boolean,false)
    and coalesce((checks->>'evidence4of4')::boolean,false)
    and coalesce((checks->>'liveOpsIncidents')::boolean,false)
    and coalesce((checks->>'observabilityArmed')::boolean,false)
    and coalesce((checks->>'reliabilityNormal')::boolean,false)
    and coalesce((checks->>'rollbackPinned')::boolean,false)
    and coalesce((checks->>'authorizationArmed')::boolean,false)
    and coalesce((checks->>'changeWindowOpen')::boolean,false);
  return (base-'version'-'ready'-'checks'-'candidate')||jsonb_build_object('version','20.10.0','ready',ready,'checks',checks,'candidate',case when b.build_id is null then null else to_jsonb(b) end,'serverMutations',mut,'checkedAt',now());
end $function$;

create or replace function public.powder_official_activate_canary_v20100(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;target public.release_builds;auth public.official_release_authorization_v2070;nowts timestamptz:=now();
begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20100:'||c,0));
 pf:=public.powder_official_launch_preflight_v20100(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20100_PREFLIGHT_NOT_READY';end if;
 select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into target from public.release_builds where channel=c and build_id=p_build for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;
 if target.version<>'20.10.0' then raise exception 'OFFICIAL_20100_CANDIDATE_INVALID';end if;if ch.build_id=p_build then raise exception 'OFFICIAL_20100_ALREADY_ACTIVE';end if;if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_20100_AUTH_NOT_ARMED';end if;if auth.rollback_target_build<>ch.build_id or ro.rollback_target_build<>ch.build_id then raise exception 'OFFICIAL_20100_ROLLBACK_TARGET_DRIFT';end if;
 update public.release_builds set status='rolled_back' where channel=c and build_id=ch.build_id;update public.release_builds set status='active',activated_at=nowts where channel=c and build_id=p_build;update public.release_channels set current_version=target.version,build_id=target.build_id,asset_epoch=coalesce(asset_epoch,0)+1,updated_at=nowts,updated_by=p_admin where channel=c;update public.release_rollout_v1950 set rollout_percent=5,emergency_mode='normal',emergency_message='',updated_at=nowts,updated_by=p_admin where channel=c;delete from public.official_rollout_server_evidence_v2070 where channel=c and build_id=p_build;
 insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_canary_5_v20100',target.version,target.build_id,ch.current_version,jsonb_build_object('manifestHash',p_manifest_hash,'rollbackTarget',auth.rollback_target_build,'authorizationRevision',auth.revision,'transactionIntegrity','20.9.0','serverMutationIntegration','20.10.0'),p_admin,nowts);
 return jsonb_build_object('ok',true,'channel',c,'version',target.version,'buildId',target.build_id,'rolloutPercent',5,'previousBuildId',ch.build_id,'at',nowts);
end $function$;

create or replace function public.powder_official_advance_rollout_v20100(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;cur smallint;nxt smallint;nowts timestamptz:=now();
begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20100:'||c,0));pf:=public.powder_official_launch_preflight_v20100(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20100_PREFLIGHT_NOT_READY';end if;
 select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;if ch.build_id<>p_build or ch.current_version<>'20.10.0' then raise exception 'OFFICIAL_20100_BUILD_NOT_ACTIVE';end if;if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_20100_AUTH_WINDOW_CLOSED';end if;cur:=ro.rollout_percent;nxt:=case cur when 5 then 20 when 20 then 50 when 50 then 100 else null end;if nxt is null then raise exception 'OFFICIAL_20100_STAGE_NOT_ADVANCEABLE';end if;
 if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=cur and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_20100_SERVER_HEALTH_NOT_PASSED';end if;
 update public.release_rollout_v1950 set rollout_percent=nxt,updated_at=nowts,updated_by=p_admin where channel=c;insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_rollout_'||nxt::text||'_v20100',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('fromPercent',cur,'toPercent',nxt,'manifestHash',p_manifest_hash,'healthSource','server-observability+transaction-integrity+atomic-mutation'),p_admin,nowts);return jsonb_build_object('ok',true,'channel',c,'buildId',p_build,'fromPercent',cur,'rolloutPercent',nxt,'at',nowts);
end $function$;

create or replace function public.powder_official_finalize_live_v20100(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;nowts timestamptz:=now();
begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20100:'||c,0));pf:=public.powder_official_launch_preflight_v20100(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20100_PREFLIGHT_NOT_READY';end if;select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;if ch.build_id<>p_build or ch.current_version<>'20.10.0' then raise exception 'OFFICIAL_20100_BUILD_NOT_ACTIVE';end if;if ro.rollout_percent<>100 then raise exception 'OFFICIAL_20100_ROLLOUT_NOT_100';end if;if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=100 and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_20100_FINAL_HEALTH_NOT_PASSED';end if;
 update public.launch_config_v170 set launch_status='live',content_frozen=true,registration_open=true,updated_by=p_admin,updated_at=nowts where id=1;update public.official_release_authorization_v2070 set status='consumed',consumed_at=nowts,updated_at=nowts,updated_by=p_admin where channel=c and build_id=p_build;insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_live_v20100',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('rolloutPercent',100,'manifestHash',p_manifest_hash,'authorizationRevision',auth.revision,'healthSource','server-observability+transaction-integrity+atomic-mutation'),p_admin,nowts);return jsonb_build_object('ok',true,'official',true,'channel',c,'version',ch.current_version,'buildId',ch.build_id,'rolloutPercent',100,'at',nowts);
end $function$;

revoke all on function public.powder_official_launch_preflight_v20100(text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_activate_canary_v20100(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_advance_rollout_v20100(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_finalize_live_v20100(text,text,text,text) from public,anon,authenticated;
grant execute on function public.powder_official_launch_preflight_v20100(text,text,text) to service_role;
grant execute on function public.powder_official_activate_canary_v20100(text,text,text,text) to service_role;
grant execute on function public.powder_official_advance_rollout_v20100(text,text,text,text) to service_role;
grant execute on function public.powder_official_finalize_live_v20100(text,text,text,text) to service_role;
