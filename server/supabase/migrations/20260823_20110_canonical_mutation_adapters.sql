-- Powder 20.11.0 — Canonical Mutation Adapters
-- Centralizes all observed resource writes behind powder-mutation-gateway.
-- Legacy Edge functions are bridged server-to-server only as a compatibility route.
-- Official readiness remains fail-closed until each route has fresh evidence for:
-- 1) txKey idempotency, 2) business atomicity, 3) direct legacy writes blocked.

create extension if not exists pgcrypto;

create table if not exists public.mutation_adapter_routes_v20110 (
  scope text not null,
  action text not null,
  route_kind text not null default 'legacy_edge_bridge' check (route_kind in ('legacy_edge_bridge','sql_atomic')),
  target_edge text not null default '',
  legacy_action text not null default '',
  required_for_launch boolean not null default true,
  enabled boolean not null default true,
  txkey_forwarded boolean not null default true,
  idempotency_verified boolean not null default false,
  business_atomic_verified boolean not null default false,
  direct_write_blocked boolean not null default false,
  target_revision text not null default '',
  evidence_sha256 text not null default '',
  verified_at timestamptz,
  verified_by text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key(scope,action),
  check (scope in ('economy','inventory','reward','mail','event','purchase','support')),
  check (action ~ '^[a-z0-9_]{2,80}$'),
  check (target_edge in ('','powder-economy','powder-inventory','powder-liveops','powder-learning-events')),
  check (legacy_action = '' or legacy_action ~ '^[a-z0-9_]{2,80}$'),
  check (evidence_sha256 = '' or evidence_sha256 ~ '^[0-9a-f]{64}$')
);

create table if not exists public.mutation_adapter_dispatch_v20110 (
  user_id uuid not null,
  scope text not null,
  tx_key text not null,
  action text not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  route_kind text not null,
  target_edge text not null default '',
  legacy_action text not null default '',
  status text not null default 'pending' check (status in ('pending','succeeded','failed','unknown','investigating','resolved')),
  attempt_count integer not null default 1 check (attempt_count between 1 and 1000),
  http_status integer,
  result jsonb,
  result_sha256 text not null default '',
  error_code text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(user_id,scope,tx_key),
  check (result_sha256 = '' or result_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists mutation_adapter_dispatch_v20110_status_idx on public.mutation_adapter_dispatch_v20110(status,updated_at);
create index if not exists mutation_adapter_dispatch_v20110_action_idx on public.mutation_adapter_dispatch_v20110(scope,action,created_at desc);

create table if not exists public.mutation_adapter_evidence_v20110 (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  action text not null,
  target_revision text not null,
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_pass boolean not null,
  business_atomic_pass boolean not null,
  direct_write_blocked_pass boolean not null,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by text not null,
  foreign key(scope,action) references public.mutation_adapter_routes_v20110(scope,action) on delete cascade
);
create index if not exists mutation_adapter_evidence_v20110_route_idx on public.mutation_adapter_evidence_v20110(scope,action,checked_at desc);

alter table public.mutation_adapter_routes_v20110 enable row level security;
alter table public.mutation_adapter_dispatch_v20110 enable row level security;
alter table public.mutation_adapter_evidence_v20110 enable row level security;
revoke all on table public.mutation_adapter_routes_v20110 from anon,authenticated;
revoke all on table public.mutation_adapter_dispatch_v20110 from anon,authenticated;
revoke all on table public.mutation_adapter_evidence_v20110 from anon,authenticated;
grant select,insert,update,delete on table public.mutation_adapter_routes_v20110 to service_role;
grant select,insert,update,delete on table public.mutation_adapter_dispatch_v20110 to service_role;
grant select,insert,update,delete on table public.mutation_adapter_evidence_v20110 to service_role;

-- 18 observed player write actions. All are routed through the gateway in 20.11.
insert into public.mutation_adapter_routes_v20110(scope,action,route_kind,target_edge,legacy_action,required_for_launch,enabled,notes) values
 ('economy','buy_candy','legacy_edge_bridge','powder-economy','buy_candy',true,true,'Coin debit + candy credit'),
 ('economy','consume_candy','legacy_edge_bridge','powder-economy','consume_candy',true,true,'Candy debit'),
 ('economy','feed_candy','legacy_edge_bridge','powder-economy','feed_candy',true,true,'Candy debit + Pow EXP/level'),
 ('economy','open_powball','legacy_edge_bridge','powder-economy','open_powball',true,true,'PowBall debit + authoritative roll/grant'),
 ('economy','upgrade_pow','legacy_edge_bridge','powder-economy','upgrade_pow',true,true,'Coin/shard debit + star upgrade'),
 ('reward','claim_daily','legacy_edge_bridge','powder-economy','claim_daily',true,true,'Journey milestone reward'),
 ('economy','daily_boss_entry','legacy_edge_bridge','powder-economy','daily_boss_entry',true,true,'Knowledge debit / boss entry'),
 ('inventory','equipment_equip','legacy_edge_bridge','powder-inventory','equipment_equip',true,true,'Equipment ownership/loadout'),
 ('inventory','equipment_unequip','legacy_edge_bridge','powder-inventory','equipment_unequip',true,true,'Equipment unequip'),
 ('inventory','artifact_equip','legacy_edge_bridge','powder-inventory','artifact_equip',true,true,'Artifact ownership/equip'),
 ('inventory','artifact_unequip','legacy_edge_bridge','powder-inventory','artifact_unequip',true,true,'Artifact unequip'),
 ('inventory','item_lock','legacy_edge_bridge','powder-inventory','item_lock',true,true,'Inventory item lock'),
 ('mail','claim_mail','legacy_edge_bridge','powder-liveops','claim_mail',true,true,'Mail reward claim'),
 ('reward','claim_daily_login','legacy_edge_bridge','powder-liveops','claim_daily',true,true,'Daily login claim'),
 ('event','claim_mission','legacy_edge_bridge','powder-learning-events','claim_mission',true,true,'Event mission reward'),
 ('event','claim_completion','legacy_edge_bridge','powder-learning-events','claim_completion',true,true,'Event completion reward'),
 ('purchase','event_buy','legacy_edge_bridge','powder-learning-events','buy',true,true,'Event currency debit + reward grant'),
 ('event','finish_combat','legacy_edge_bridge','powder-learning-events','finish_combat',true,true,'Legacy event combat finish/progress')
on conflict(scope,action) do update set
 route_kind=excluded.route_kind,target_edge=excluded.target_edge,legacy_action=excluded.legacy_action,
 required_for_launch=excluded.required_for_launch,enabled=excluded.enabled,notes=excluded.notes,updated_at=now();

-- Server-only route lookup. The Edge gateway also applies an explicit target allowlist.
create or replace function public.powder_mutation_adapter_route_v20110(p_scope text,p_action text)
returns jsonb language plpgsql security definer set search_path=public stable as $function$
declare r public.mutation_adapter_routes_v20110;begin
 select * into r from public.mutation_adapter_routes_v20110 where scope=lower(trim(coalesce(p_scope,''))) and action=lower(trim(coalesce(p_action,''))) and enabled=true;
 if r.scope is null then return jsonb_build_object('ok',false,'code','ADAPTER_20110_ROUTE_NOT_READY'); end if;
 return jsonb_build_object('ok',true,'version','20.11.0','scope',r.scope,'action',r.action,'routeKind',r.route_kind,'targetEdge',r.target_edge,'legacyAction',r.legacy_action,
  'txKeyForwarded',r.txkey_forwarded,'idempotencyVerified',r.idempotency_verified,'businessAtomicVerified',r.business_atomic_verified,'directWriteBlocked',r.direct_write_blocked,'verifiedAt',r.verified_at,'targetRevision',r.target_revision);
end $function$;

-- Begin bridge dispatch. Never blindly redispatch an ambiguous txKey.
create or replace function public.powder_mutation_adapter_begin_v20110(
 p_user uuid,p_scope text,p_action text,p_tx_key text,p_request_sha256 text
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare sc text:=lower(trim(coalesce(p_scope,'')));act text:=lower(trim(coalesce(p_action,'')));k text:=trim(coalesce(p_tx_key,''));r public.mutation_adapter_routes_v20110;d public.mutation_adapter_dispatch_v20110;allowed boolean:=false;begin
 if p_user is null then raise exception 'ADAPTER_20110_USER_REQUIRED'; end if;
 if k='' or length(k)>180 then raise exception 'ADAPTER_20110_TX_KEY_INVALID'; end if;
 if coalesce(p_request_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'ADAPTER_20110_HASH_INVALID'; end if;
 begin select public.powder_reliability_can_write_v2080('economy') into allowed; exception when others then allowed:=false; end;
 if allowed is not true then raise exception 'ADAPTER_20110_RELIABILITY_WRITE_BLOCKED'; end if;
 select * into r from public.mutation_adapter_routes_v20110 where scope=sc and action=act and enabled=true for share;
 if r.scope is null then raise exception 'ADAPTER_20110_ROUTE_NOT_READY'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||sc||':'||k,0));
 select * into d from public.mutation_adapter_dispatch_v20110 where user_id=p_user and scope=sc and tx_key=k for update;
 if d.user_id is not null then
   if d.action<>act or d.request_sha256<>p_request_sha256 then raise exception 'ADAPTER_20110_KEY_REUSE_MISMATCH'; end if;
   if d.status='succeeded' then return jsonb_build_object('ok',true,'state','replay','result',d.result,'httpStatus',d.http_status,'routeKind',d.route_kind,'targetEdge',d.target_edge,'legacyAction',d.legacy_action); end if;
   return jsonb_build_object('ok',false,'state','blocked','status',d.status,'code','ADAPTER_20110_AMBIGUOUS_TX','message','Transaction đã tồn tại nhưng chưa có bằng chứng commit an toàn. Reconciliation bắt buộc.');
 end if;
 insert into public.mutation_adapter_dispatch_v20110(user_id,scope,tx_key,action,request_sha256,route_kind,target_edge,legacy_action,status)
 values(p_user,sc,k,act,p_request_sha256,r.route_kind,r.target_edge,r.legacy_action,'pending');
 return jsonb_build_object('ok',true,'state','dispatch','routeKind',r.route_kind,'targetEdge',r.target_edge,'legacyAction',r.legacy_action,'verified',r.idempotency_verified and r.business_atomic_verified and r.direct_write_blocked);
end $function$;

create or replace function public.powder_mutation_adapter_finish_v20110(
 p_user uuid,p_scope text,p_tx_key text,p_status text,p_http_status integer,p_result jsonb default null,p_result_sha256 text default '',p_error_code text default '',p_error_message text default ''
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare st text:=lower(coalesce(p_status,''));begin
 if st not in ('succeeded','failed','unknown') then raise exception 'ADAPTER_20110_STATUS_INVALID'; end if;
 if st='succeeded' and coalesce(p_result_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'ADAPTER_20110_RESULT_HASH_REQUIRED'; end if;
 update public.mutation_adapter_dispatch_v20110 set status=st,http_status=p_http_status,result=case when st='succeeded' then coalesce(p_result,'{}'::jsonb) else result end,result_sha256=case when st='succeeded' then p_result_sha256 else result_sha256 end,error_code=left(coalesce(p_error_code,''),120),error_message=left(coalesce(p_error_message,''),800),updated_at=now(),completed_at=case when st='succeeded' then now() else completed_at end
 where user_id=p_user and scope=lower(trim(coalesce(p_scope,''))) and tx_key=trim(coalesce(p_tx_key,''));
 if not found then raise exception 'ADAPTER_20110_DISPATCH_NOT_FOUND'; end if;
 return jsonb_build_object('ok',true,'status',st,'at',now());
end $function$;

-- Pending bridge calls older than 90 seconds are ambiguous; never replay automatically.
create or replace function public.powder_mutation_adapter_reconcile_v20110(p_limit integer default 200,p_actor text default 'system')
returns jsonb language plpgsql security definer set search_path=public as $function$
declare n int:=0;begin
 with c as (select user_id,scope,tx_key from public.mutation_adapter_dispatch_v20110 where status='pending' and updated_at<now()-interval '90 seconds' order by updated_at limit greatest(1,least(coalesce(p_limit,200),1000)) for update skip locked)
 update public.mutation_adapter_dispatch_v20110 d set status='unknown',error_code='ADAPTER_TIMEOUT_UNKNOWN',error_message='Bridge response was not committed within 90 seconds; no automatic replay.',updated_at=now()
 from c where d.user_id=c.user_id and d.scope=c.scope and d.tx_key=c.tx_key;
 get diagnostics n=row_count;
 return jsonb_build_object('ok',true,'version','20.11.0','markedUnknown',n,'automaticReplay',false,'actor',left(coalesce(p_actor,'system'),160),'at',now());
end $function$;

-- Evidence import is deliberately strict: PASS requires all three checks and a fresh SHA-bound CI/drill result.
create or replace function public.powder_mutation_adapter_record_evidence_v20110(
 p_scope text,p_action text,p_target_revision text,p_evidence_sha256 text,p_idempotency_pass boolean,p_business_atomic_pass boolean,p_direct_write_blocked_pass boolean,p_checked_at timestamptz,p_actor text,p_details jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare sc text:=lower(trim(coalesce(p_scope,'')));act text:=lower(trim(coalesce(p_action,'')));all_pass boolean;begin
 if coalesce(p_evidence_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'ADAPTER_20110_EVIDENCE_SHA_INVALID'; end if;
 if trim(coalesce(p_target_revision,''))='' then raise exception 'ADAPTER_20110_TARGET_REVISION_REQUIRED'; end if;
 if p_checked_at is null or p_checked_at<now()-interval '24 hours' or p_checked_at>now()+interval '5 minutes' then raise exception 'ADAPTER_20110_EVIDENCE_NOT_FRESH'; end if;
 if not exists(select 1 from public.mutation_adapter_routes_v20110 where scope=sc and action=act and required_for_launch) then raise exception 'ADAPTER_20110_ROUTE_INVALID'; end if;
 all_pass:=coalesce(p_idempotency_pass,false) and coalesce(p_business_atomic_pass,false) and coalesce(p_direct_write_blocked_pass,false);
 insert into public.mutation_adapter_evidence_v20110(scope,action,target_revision,evidence_sha256,idempotency_pass,business_atomic_pass,direct_write_blocked_pass,details,checked_at,recorded_by)
 values(sc,act,trim(p_target_revision),lower(p_evidence_sha256),coalesce(p_idempotency_pass,false),coalesce(p_business_atomic_pass,false),coalesce(p_direct_write_blocked_pass,false),coalesce(p_details,'{}'::jsonb),p_checked_at,left(coalesce(p_actor,'system'),160));
 update public.mutation_adapter_routes_v20110 set target_revision=trim(p_target_revision),evidence_sha256=lower(p_evidence_sha256),idempotency_verified=all_pass,business_atomic_verified=all_pass,direct_write_blocked=all_pass,verified_at=case when all_pass then p_checked_at else null end,verified_by=left(coalesce(p_actor,'system'),160),updated_at=now() where scope=sc and action=act;
 return jsonb_build_object('ok',true,'version','20.11.0','scope',sc,'action',act,'verified',all_pass,'checkedAt',p_checked_at);
end $function$;

create or replace function public.powder_mutation_adapter_posture_v20110()
returns jsonb language plpgsql security definer set search_path=public stable as $function$
declare req int:=0;covered int:=0;verified int:=0;fresh int:=0;unknowns int:=0;pending_old int:=0;failed_open int:=0;ready boolean:=false;begin
 select count(*),count(*) filter(where enabled and route_kind in ('legacy_edge_bridge','sql_atomic')),
        count(*) filter(where enabled and idempotency_verified and business_atomic_verified and direct_write_blocked),
        count(*) filter(where enabled and idempotency_verified and business_atomic_verified and direct_write_blocked and verified_at>=now()-interval '7 days')
 into req,covered,verified,fresh from public.mutation_adapter_routes_v20110 where required_for_launch;
 select count(*) filter(where status in ('unknown','investigating')),count(*) filter(where status='pending' and updated_at<now()-interval '90 seconds'),count(*) filter(where status='failed')
 into unknowns,pending_old,failed_open from public.mutation_adapter_dispatch_v20110;
 ready:=req=18 and covered=req and verified=req and fresh=req and unknowns=0 and pending_old=0 and failed_open=0;
 return jsonb_build_object('version','20.11.0','ready',ready,'checkedAt',now(),
   'routes',jsonb_build_object('required',req,'covered',covered,'verified',verified,'fresh7d',fresh),
   'dispatch',jsonb_build_object('unknown',unknowns,'stalePending',pending_old,'failed',failed_open),
   'guards',jsonb_build_object('clientDirectWriteBypass',false,'gatewayRequired',true,'automaticReplay',false,'evidenceTriple','idempotency+businessAtomic+directWriteBlocked'));
end $function$;

revoke all on function public.powder_mutation_adapter_route_v20110(text,text) from public,anon,authenticated;
revoke all on function public.powder_mutation_adapter_begin_v20110(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_mutation_adapter_finish_v20110(uuid,text,text,text,integer,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_mutation_adapter_reconcile_v20110(integer,text) from public,anon,authenticated;
revoke all on function public.powder_mutation_adapter_record_evidence_v20110(text,text,text,text,boolean,boolean,boolean,timestamptz,text,jsonb) from public,anon,authenticated;
revoke all on function public.powder_mutation_adapter_posture_v20110() from public,anon,authenticated;
grant execute on function public.powder_mutation_adapter_route_v20110(text,text) to service_role;
grant execute on function public.powder_mutation_adapter_begin_v20110(uuid,text,text,text,text) to service_role;
grant execute on function public.powder_mutation_adapter_finish_v20110(uuid,text,text,text,integer,jsonb,text,text,text) to service_role;
grant execute on function public.powder_mutation_adapter_reconcile_v20110(integer,text) to service_role;
grant execute on function public.powder_mutation_adapter_record_evidence_v20110(text,text,text,text,boolean,boolean,boolean,timestamptz,text,jsonb) to service_role;
grant execute on function public.powder_mutation_adapter_posture_v20110() to service_role;

-- 20.11 Official Launch hard gate: canonical adapter verification is required in addition to 20.10 gates.
create or replace function public.powder_official_launch_preflight_v20110(
  p_channel text default 'production',
  p_build text default 'powder-20.11.0-canonical-mutation-adapters',
  p_manifest_hash text default ''
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;base jsonb:='{}'::jsonb;b public.release_builds;adp jsonb:='{}'::jsonb;checks jsonb:='{}'::jsonb;candidate_ok boolean:=false;coverage_ok boolean:=false;adapter_ok boolean:=false;ready boolean:=false;begin
 begin base:=public.powder_official_launch_preflight_v20100(c,p_build,p_manifest_hash); exception when others then base:=jsonb_build_object('ready',false,'checks','{}'::jsonb,'error',sqlerrm); end;
 select * into b from public.release_builds where channel=c and build_id=p_build limit 1;
 begin adp:=public.powder_mutation_adapter_posture_v20110(); exception when others then adp:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 candidate_ok:=b.build_id is not null and b.version='20.11.0' and b.status in ('candidate','active') and b.checksum~'^[0-9a-fA-F]{64}$';
 coverage_ok:=coalesce((adp->'routes'->>'required')::int,0)=18 and coalesce((adp->'routes'->>'covered')::int,0)=18;
 adapter_ok:=coalesce((adp->>'ready')::boolean,false);
 checks:=coalesce(base->'checks','{}'::jsonb)||jsonb_build_object('candidate',candidate_ok,'serverMutationIntegration',coverage_ok,'canonicalMutationAdapters',adapter_ok);
 ready:=candidate_ok and coverage_ok and adapter_ok
  and coalesce((checks->>'integrity')::boolean,false)
  and coalesce((checks->>'securityPosture')::boolean,false)
  and coalesce((checks->>'recovery')::boolean,false)
  and coalesce((checks->>'transactionIntegrity')::boolean,false)
  and coalesce((checks->>'serverMutationIntegration')::boolean,false)
  and coalesce((checks->>'realPilot')::boolean,false)
  and coalesce((checks->>'rolloutNormal')::boolean,false)
  and coalesce((checks->>'evidence4of4')::boolean,false)
  and coalesce((checks->>'liveOpsIncidents')::boolean,false)
  and coalesce((checks->>'observabilityArmed')::boolean,false)
  and coalesce((checks->>'reliabilityNormal')::boolean,false)
  and coalesce((checks->>'rollbackPinned')::boolean,false)
  and coalesce((checks->>'authorizationArmed')::boolean,false)
  and coalesce((checks->>'changeWindowOpen')::boolean,false);
 return (base-'version'-'ready'-'checks'-'candidate')||jsonb_build_object('version','20.11.0','ready',ready,'checks',checks,'candidate',case when b.build_id is null then null else to_jsonb(b) end,'canonicalAdapters',adp,'checkedAt',now());
end $function$;

create or replace function public.powder_official_activate_canary_v20110(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;target public.release_builds;auth public.official_release_authorization_v2070;nowts timestamptz:=now();begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20110:'||c,0));pf:=public.powder_official_launch_preflight_v20110(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20110_PREFLIGHT_NOT_READY';end if;
 select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into target from public.release_builds where channel=c and build_id=p_build for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;
 if target.version<>'20.11.0' then raise exception 'OFFICIAL_20110_CANDIDATE_INVALID';end if;if ch.build_id=p_build then raise exception 'OFFICIAL_20110_ALREADY_ACTIVE';end if;if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_20110_AUTH_NOT_ARMED';end if;if auth.rollback_target_build<>ch.build_id or ro.rollback_target_build<>ch.build_id then raise exception 'OFFICIAL_20110_ROLLBACK_TARGET_DRIFT';end if;
 update public.release_builds set status='rolled_back' where channel=c and build_id=ch.build_id;update public.release_builds set status='active',activated_at=nowts where channel=c and build_id=p_build;update public.release_channels set current_version=target.version,build_id=target.build_id,asset_epoch=coalesce(asset_epoch,0)+1,updated_at=nowts,updated_by=p_admin where channel=c;update public.release_rollout_v1950 set rollout_percent=5,emergency_mode='normal',emergency_message='',updated_at=nowts,updated_by=p_admin where channel=c;delete from public.official_rollout_server_evidence_v2070 where channel=c and build_id=p_build;
 insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_canary_5_v20110',target.version,target.build_id,ch.current_version,jsonb_build_object('manifestHash',p_manifest_hash,'rollbackTarget',auth.rollback_target_build,'authorizationRevision',auth.revision,'canonicalMutationAdapters','20.11.0'),p_admin,nowts);
 return jsonb_build_object('ok',true,'channel',c,'version',target.version,'buildId',target.build_id,'rolloutPercent',5,'previousBuildId',ch.build_id,'at',nowts);
end $function$;

create or replace function public.powder_official_advance_rollout_v20110(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;cur smallint;nxt smallint;nowts timestamptz:=now();begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20110:'||c,0));pf:=public.powder_official_launch_preflight_v20110(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20110_PREFLIGHT_NOT_READY';end if;
 select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;if ch.build_id<>p_build or ch.current_version<>'20.11.0' then raise exception 'OFFICIAL_20110_BUILD_NOT_ACTIVE';end if;if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_20110_AUTH_WINDOW_CLOSED';end if;cur:=ro.rollout_percent;nxt:=case cur when 5 then 20 when 20 then 50 when 50 then 100 else null end;if nxt is null then raise exception 'OFFICIAL_20110_STAGE_NOT_ADVANCEABLE';end if;
 if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=cur and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_20110_SERVER_HEALTH_NOT_PASSED';end if;
 update public.release_rollout_v1950 set rollout_percent=nxt,updated_at=nowts,updated_by=p_admin where channel=c;insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_rollout_'||nxt::text||'_v20110',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('fromPercent',cur,'toPercent',nxt,'manifestHash',p_manifest_hash,'healthSource','server-observability+transaction-integrity+canonical-adapters'),p_admin,nowts);return jsonb_build_object('ok',true,'channel',c,'buildId',p_build,'fromPercent',cur,'rolloutPercent',nxt,'at',nowts);
end $function$;

create or replace function public.powder_official_finalize_live_v20110(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;nowts timestamptz:=now();begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20110:'||c,0));pf:=public.powder_official_launch_preflight_v20110(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20110_PREFLIGHT_NOT_READY';end if;select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;if ch.build_id<>p_build or ch.current_version<>'20.11.0' then raise exception 'OFFICIAL_20110_BUILD_NOT_ACTIVE';end if;if ro.rollout_percent<>100 then raise exception 'OFFICIAL_20110_ROLLOUT_NOT_100';end if;if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=100 and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_20110_FINAL_HEALTH_NOT_PASSED';end if;
 update public.launch_config_v170 set launch_status='live',content_frozen=true,registration_open=true,updated_by=p_admin,updated_at=nowts where id=1;update public.official_release_authorization_v2070 set status='consumed',consumed_at=nowts,updated_at=nowts,updated_by=p_admin where channel=c and build_id=p_build;insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_live_v20110',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('rolloutPercent',100,'manifestHash',p_manifest_hash,'authorizationRevision',auth.revision,'healthSource','server-observability+transaction-integrity+canonical-adapters'),p_admin,nowts);return jsonb_build_object('ok',true,'official',true,'channel',c,'version',ch.current_version,'buildId',ch.build_id,'rolloutPercent',100,'at',nowts);
end $function$;

revoke all on function public.powder_official_launch_preflight_v20110(text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_activate_canary_v20110(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_advance_rollout_v20110(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_finalize_live_v20110(text,text,text,text) from public,anon,authenticated;
grant execute on function public.powder_official_launch_preflight_v20110(text,text,text) to service_role;
grant execute on function public.powder_official_activate_canary_v20110(text,text,text,text) to service_role;
grant execute on function public.powder_official_advance_rollout_v20110(text,text,text,text) to service_role;
grant execute on function public.powder_official_finalize_live_v20110(text,text,text,text) to service_role;
