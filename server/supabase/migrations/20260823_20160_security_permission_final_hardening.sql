-- Powder 20.16.0 · Security & Permission Final Hardening
-- Central Admin access contract, token/origin/MFA checks, global SECURITY DEFINER privilege scan,
-- revocation controls and fail-closed production posture.

begin;

create table if not exists public.security_config_v20160(
  id smallint primary key default 1 check(id=1),
  enabled boolean not null default false,
  allowed_origins text[] not null default '{}'::text[],
  max_token_age_seconds integer not null default 3600 check(max_token_age_seconds between 300 and 86400),
  min_token_remaining_seconds integer not null default 60 check(min_token_remaining_seconds between 15 and 3600),
  max_future_iat_skew_seconds integer not null default 60 check(max_future_iat_skew_seconds between 0 and 600),
  require_aal2_for_critical boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.security_config_v20160(id) values(1) on conflict(id) do nothing;

create table if not exists public.security_admin_surfaces_v20160(
  function_name text primary key,
  allowed_roles text[] not null,
  enabled boolean not null default true,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.security_admin_surfaces_v20160(function_name,allowed_roles,notes) values
 ('powder-admin',array['owner','admin','support'],'Player/Admin console. Local action checks remain second layer.'),
 ('powder-admin-disaster-recovery',array['owner','admin','support'],'DR state visible to support; mutations remain Owner-only.'),
 ('powder-admin-events',array['owner','admin'],'Live event operations.'),
 ('powder-admin-exploit-hardening',array['owner','admin'],'Anti-abuse operations.'),
 ('powder-admin-integrity',array['owner','admin'],'Integrity probes.'),
 ('powder-admin-live-ops',array['owner','admin'],'Live operations.'),
 ('powder-admin-load-soak',array['owner','admin'],'Load/soak evidence posture.'),
 ('powder-admin-mutation-integration',array['owner','admin'],'Mutation integration controls.'),
 ('powder-admin-observability',array['owner','admin','support'],'Read posture to support; local mutation checks remain.'),
 ('powder-admin-official-launch',array['owner','admin'],'Production launch control.'),
 ('powder-admin-reconciliation',array['owner','admin'],'Reconciliation and repair.'),
 ('powder-admin-recovery',array['owner','admin','support'],'Recovery console.'),
 ('powder-admin-reliability',array['owner','admin','support'],'Reliability posture; local mutation checks remain.'),
 ('powder-admin-rollout',array['owner','admin'],'Rollout and emergency controls.'),
 ('powder-admin-security',array['owner','admin','support'],'Security posture and configuration.'),
 ('powder-admin-support',array['owner','admin','support'],'Player support.'),
 ('powder-admin-transactions',array['owner','admin','support'],'Transaction posture and recovery.')
on conflict(function_name) do update set allowed_roles=excluded.allowed_roles,notes=excluded.notes,updated_at=now();

create table if not exists public.security_critical_actions_v20160(
  function_name text not null references public.security_admin_surfaces_v20160(function_name) on delete cascade,
  action text not null,
  require_owner boolean not null default true,
  require_aal2 boolean not null default true,
  primary key(function_name,action)
);

insert into public.security_critical_actions_v20160(function_name,action,require_owner,require_aal2) values
 ('powder-admin-official-launch','register_candidate',true,true),
 ('powder-admin-official-launch','record_evidence',true,true),
 ('powder-admin-official-launch','save_plan',true,true),
 ('powder-admin-official-launch','submit_plan',true,true),
 ('powder-admin-official-launch','approve_plan',true,true),
 ('powder-admin-official-launch','arm_plan',true,true),
 ('powder-admin-official-launch','revoke_plan',true,true),
 ('powder-admin-official-launch','capture_stage_health',true,true),
 ('powder-admin-official-launch','activate_canary',true,true),
 ('powder-admin-official-launch','advance_rollout',true,true),
 ('powder-admin-official-launch','finalize_live',true,true),
 ('powder-admin-rollout','set_rollback_target',true,true),
 ('powder-admin-rollout','rollback_target',true,true),
 ('powder-admin-rollout','emergency_stop',true,true),
 ('powder-admin-rollout','emergency_resume',true,true),
 ('powder-admin-reliability','set_config',true,true),
 ('powder-admin-reliability','set_mode',true,true),
 ('powder-admin-disaster-recovery','set_enabled',true,true),
 ('powder-admin-load-soak','set_enabled',true,true),
 ('powder-admin-reconciliation','drill',true,true),
 ('powder-admin-reconciliation','approve_repair',true,true),
 ('powder-admin-reconciliation','apply_repair',true,true),
 ('powder-admin-exploit-hardening','run_drill',true,true),
 ('powder-admin-exploit-hardening','record_evidence',true,true),
 ('powder-admin-exploit-hardening','resolve_event',true,true),
 ('powder-admin-transactions','resolve',true,true),
 ('powder-admin-security','configure',true,true),
 ('powder-admin-security','revoke_user',true,true),
 ('powder-admin-security','revoke_token',true,true),
 ('powder-admin-security','snapshot',true,true),
 -- High-impact actions that keep their existing role semantics but require a fresh MFA/AAL2 session.
 ('powder-admin','adjust_resource',false,true),
 ('powder-admin','set_rank',false,true),
 ('powder-admin','moderate',false,true),
 ('powder-admin','export_save',true,true),
 ('powder-admin-events','approve',true,true),
 ('powder-admin-events','reject',true,true),
 ('powder-admin-events','publish',true,true),
 ('powder-admin-events','rollback',true,true),
 ('powder-admin-events','pause_live',true,true),
 ('powder-admin-events','toggle',true,true),
 ('powder-admin-events','import_live',true,true),
 ('powder-admin-live-ops','emergency_stop',true,true),
 ('powder-admin-live-ops','emergency_resume',true,true),
 ('powder-admin-mutation-integration','chaos_drill',true,true),
 ('powder-admin-mutation-integration','reconcile',true,true),
 ('powder-admin-mutation-integration','record_adapter_evidence',true,true),
 ('powder-admin-observability','set_config',true,true),
 ('powder-admin-recovery','run_sandbox',true,true),
 ('powder-admin-recovery','record_real_restore',true,true),
 ('powder-admin-recovery','set_targets',true,true),
 ('powder-admin-rollout','set_rollout',true,true),
 ('powder-admin-support','moderate',false,true),
 ('powder-admin-support','review_compensation',false,true)
on conflict(function_name,action) do update set require_owner=excluded.require_owner,require_aal2=excluded.require_aal2;

create table if not exists public.security_revocations_v20160(
  id bigint generated by default as identity primary key,
  user_id uuid null,
  token_sha256 text null,
  revoked_after timestamptz not null default now(),
  reason text not null default '',
  active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  check(user_id is not null or token_sha256 is not null),
  check(token_sha256 is null or token_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists security_revocations_v20160_user_idx on public.security_revocations_v20160(user_id,active,revoked_after desc);
create index if not exists security_revocations_v20160_token_idx on public.security_revocations_v20160(token_sha256) where token_sha256 is not null and active=true;

create table if not exists public.security_access_audit_v20160(
  id bigint generated by default as identity primary key,
  user_id uuid null,
  email text not null default '',
  role text not null default '',
  function_name text not null default '',
  action text not null default '',
  origin text not null default '',
  allowed boolean not null,
  code text not null default '',
  token_age_seconds integer null,
  aal text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists security_access_audit_v20160_recent_idx on public.security_access_audit_v20160(created_at desc);
create index if not exists security_access_audit_v20160_denied_idx on public.security_access_audit_v20160(allowed,created_at desc);

create table if not exists public.security_review_snapshots_v20160(
  id bigint generated by default as identity primary key,
  posture jsonb not null,
  created_at timestamptz not null default now(),
  created_by text not null default ''
);

alter table public.security_config_v20160 enable row level security;
alter table public.security_admin_surfaces_v20160 enable row level security;
alter table public.security_critical_actions_v20160 enable row level security;
alter table public.security_revocations_v20160 enable row level security;
alter table public.security_access_audit_v20160 enable row level security;
alter table public.security_review_snapshots_v20160 enable row level security;

revoke all on public.security_config_v20160,public.security_admin_surfaces_v20160,public.security_critical_actions_v20160,public.security_revocations_v20160,public.security_access_audit_v20160,public.security_review_snapshots_v20160 from public,anon,authenticated;
grant select,insert,update,delete on public.security_config_v20160,public.security_admin_surfaces_v20160,public.security_critical_actions_v20160,public.security_revocations_v20160,public.security_access_audit_v20160,public.security_review_snapshots_v20160 to service_role;
grant usage,select on sequence public.security_revocations_v20160_id_seq,public.security_access_audit_v20160_id_seq,public.security_review_snapshots_v20160_id_seq to service_role;

create or replace function public.powder_security_admin_access_v20160(
  p_user uuid,p_email text,p_role text,p_function text,p_action text,p_origin text,
  p_token_sha256 text,p_token_iat bigint,p_token_exp bigint,p_aal text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 cfg public.security_config_v20160;surf public.security_admin_surfaces_v20160;crit public.security_critical_actions_v20160;
 actual_role text:='';now_epoch bigint:=extract(epoch from now())::bigint;token_age int:=null;allowed boolean:=true;code text:='OK';bootstrap boolean:=false;
begin
 select * into cfg from public.security_config_v20160 where id=1;
 select role into actual_role from public.admin_allowlist where lower(email)=lower(coalesce(p_email,'')) and active=true limit 1;
 actual_role:=coalesce(actual_role,'');
 select * into surf from public.security_admin_surfaces_v20160 where function_name=p_function and enabled=true;
 select * into crit from public.security_critical_actions_v20160 where function_name=p_function and action=p_action;
 bootstrap:=p_function='powder-admin-security' and p_action in ('state','configure') and coalesce(array_length(cfg.allowed_origins,1),0)=0;
 token_age:=case when coalesce(p_token_iat,0)>0 then greatest(0,(now_epoch-p_token_iat)::int) else null end;

 if actual_role='' or actual_role<>coalesce(p_role,'') then allowed:=false;code:='SEC20160_ROLE_MISMATCH';
 elsif surf.function_name is null or not(actual_role=any(surf.allowed_roles)) then allowed:=false;code:='SEC20160_SURFACE_DENIED';
 elsif coalesce(p_token_iat,0)<=0 or coalesce(p_token_exp,0)<=0 then allowed:=false;code:='SEC20160_TOKEN_CLAIMS_MISSING';
 elsif p_token_iat>now_epoch+coalesce(cfg.max_future_iat_skew_seconds,60) then allowed:=false;code:='SEC20160_TOKEN_IAT_FUTURE';
 elsif now_epoch-p_token_iat>coalesce(cfg.max_token_age_seconds,3600) then allowed:=false;code:='SEC20160_TOKEN_TOO_OLD';
 elsif p_token_exp-now_epoch<coalesce(cfg.min_token_remaining_seconds,60) then allowed:=false;code:='SEC20160_TOKEN_EXPIRING';
 elsif exists(select 1 from public.security_revocations_v20160 r where r.active=true and ((r.token_sha256 is not null and r.token_sha256=lower(coalesce(p_token_sha256,''))) or (r.user_id=p_user and to_timestamp(p_token_iat)<=r.revoked_after))) then allowed:=false;code:='SEC20160_SESSION_REVOKED';
 elsif coalesce(p_origin,'')='' and not bootstrap then allowed:=false;code:='SEC20160_ORIGIN_MISSING';
 elsif coalesce(p_origin,'')<>'' and not bootstrap and not(coalesce(p_origin,'')=any(coalesce(cfg.allowed_origins,'{}'::text[]))) then allowed:=false;code:='SEC20160_ORIGIN_DENIED';
 elsif crit.function_name is not null and crit.require_owner and actual_role<>'owner' then allowed:=false;code:='SEC20160_OWNER_REQUIRED';
 elsif crit.function_name is not null and crit.require_aal2 and coalesce(cfg.require_aal2_for_critical,true) and lower(coalesce(p_aal,''))<>'aal2' then allowed:=false;code:='SEC20160_AAL2_REQUIRED';
 end if;

 insert into public.security_access_audit_v20160(user_id,email,role,function_name,action,origin,allowed,code,token_age_seconds,aal)
 values(p_user,lower(coalesce(p_email,'')),actual_role,p_function,p_action,left(coalesce(p_origin,''),300),allowed,code,token_age,left(coalesce(p_aal,''),20));
 return jsonb_build_object('version','20.16.0','allowed',allowed,'code',code,'role',actual_role,'function',p_function,'action',p_action,'critical',crit.function_name is not null,'aal',coalesce(p_aal,''),'tokenAgeSeconds',token_age,'originChecked',coalesce(p_origin,'')<>'','bootstrapOrigin',bootstrap);
end$$;

create or replace function public.powder_security_configure_v20160(p_allowed_origins text[],p_enabled boolean,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare clean text[];bad int:=0;
begin
 select coalesce(array_agg(distinct x order by x),'{}'::text[]) into clean from (select btrim(v) x from unnest(coalesce(p_allowed_origins,'{}'::text[])) v where btrim(v)<>'') q;
 select count(*) into bad from unnest(clean) x where x !~ '^https://[A-Za-z0-9.-]+(?::[0-9]+)?$' and x !~ '^http://(localhost|127\\.0\\.0\\.1)(?::[0-9]+)?$';
 if bad>0 then raise exception 'SEC20160_INVALID_ORIGIN';end if;
 update public.security_config_v20160 set allowed_origins=clean,enabled=coalesce(p_enabled,false),updated_at=now(),updated_by=left(coalesce(p_actor,''),200) where id=1;
 return jsonb_build_object('ok',true,'version','20.16.0','enabled',coalesce(p_enabled,false),'allowedOrigins',clean,'updatedAt',now());
end$$;

create or replace function public.powder_security_revoke_user_v20160(p_user uuid,p_reason text,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rid bigint;
begin
 if p_user is null then raise exception 'SEC20160_USER_REQUIRED';end if;
 insert into public.security_revocations_v20160(user_id,reason,created_by) values(p_user,left(coalesce(p_reason,''),1000),left(coalesce(p_actor,''),200)) returning id into rid;
 return jsonb_build_object('ok',true,'id',rid,'userId',p_user,'revokedAfter',now());
end$$;

create or replace function public.powder_security_revoke_token_v20160(p_token_sha256 text,p_reason text,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rid bigint;h text:=lower(coalesce(p_token_sha256,''));
begin
 if h!~'^[0-9a-f]{64}$' then raise exception 'SEC20160_TOKEN_HASH_INVALID';end if;
 insert into public.security_revocations_v20160(token_sha256,reason,created_by) values(h,left(coalesce(p_reason,''),1000),left(coalesce(p_actor,''),200)) returning id into rid;
 return jsonb_build_object('ok',true,'id',rid,'tokenSha256',h,'revokedAt',now());
end$$;

create or replace function public.powder_security_posture_v20160()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 cfg public.security_config_v20160;legacy jsonb:='{}'::jsonb;
 surface_count int:=0;surface_missing int:=0;critical_count int:=0;invalid_roles int:=0;public_definer_exec int:=0;direct_write int:=0;recent_denied int:=0;
 critical_tables text[]:=array['admin_allowlist','player_saves','transaction_receipts_v2090','transaction_recovery_queue_v2090','mutation_effect_receipts_v20100','mutation_adapter_dispatch_v20110','reconciliation_cases_v20120','mutation_abuse_events_v20130','official_release_authorization_v2070','release_rollout_v1950','reliability_state_v2080','disaster_recovery_evidence_v20150'];
 ready boolean:=false;crit_blockers int:=0;high_blockers int:=0;
begin
 select * into cfg from public.security_config_v20160 where id=1;
 begin legacy:=public.powder_security_posture_v2030(); exception when others then legacy:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 select count(*) into surface_count from public.security_admin_surfaces_v20160 where enabled=true;
 surface_missing:=greatest(0,17-surface_count);
 select count(*) into critical_count from public.security_critical_actions_v20160;
 select count(*) into invalid_roles from public.admin_allowlist where active=true and role not in ('owner','admin','support');
 select count(distinct p.oid) into public_definer_exec
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 join information_schema.routine_privileges rp on rp.specific_schema=n.nspname and rp.routine_name=p.proname
 where n.nspname='public' and p.prosecdef=true and rp.grantee in ('PUBLIC','anon','authenticated') and rp.privilege_type='EXECUTE'
   and p.proname not in ('powder_reliability_public_status_v2080');
 select count(*) into direct_write from unnest(critical_tables) t(name)
 where to_regclass('public.'||t.name) is not null and (
   has_table_privilege('anon',format('public.%I',t.name),'INSERT,UPDATE,DELETE') or
   has_table_privilege('authenticated',format('public.%I',t.name),'INSERT,UPDATE,DELETE'));
 select count(*) into recent_denied from public.security_access_audit_v20160 where allowed=false and created_at>=now()-interval '24 hours';
 crit_blockers:=direct_write+public_definer_exec+invalid_roles;
 high_blockers:=surface_missing + case when critical_count<45 then 1 else 0 end + case when coalesce(array_length(cfg.allowed_origins,1),0)=0 then 1 else 0 end + case when coalesce(cfg.enabled,false)=false then 1 else 0 end + case when coalesce((legacy->>'ready')::boolean,false)=false then 1 else 0 end;
 ready:=crit_blockers=0 and high_blockers=0 and surface_count=17 and critical_count>=45;
 return jsonb_build_object('version','20.16.0','ready',ready,'checkedAt',now(),'enabled',coalesce(cfg.enabled,false),
  'counts',jsonb_build_object('critical',crit_blockers,'high',high_blockers,'publicSecurityDefinerExec',public_definer_exec,'directWriteViolations',direct_write,'invalidAdminRoles',invalid_roles,'adminSurfaces',surface_count,'surfaceMissing',surface_missing,'criticalActions',critical_count,'denied24h',recent_denied),
  'guards',jsonb_build_object('originAllowlistConfigured',coalesce(array_length(cfg.allowed_origins,1),0)>0,'tokenFreshness',true,'sessionRevocation',true,'criticalAal2',coalesce(cfg.require_aal2_for_critical,true),'allAdminFunctionsCentralGuard',surface_count=17,'legacy2030',legacy),
  'config',jsonb_build_object('allowedOrigins',cfg.allowed_origins,'maxTokenAgeSeconds',cfg.max_token_age_seconds,'minTokenRemainingSeconds',cfg.min_token_remaining_seconds,'requireAal2ForCritical',cfg.require_aal2_for_critical));
end$$;

-- Close default PUBLIC EXECUTE on every current SECURITY DEFINER RPC, except the intentionally read-only public reliability status.
do $$
declare r record;
begin
 for r in select n.nspname,p.proname,oidvectortypes(p.proargtypes) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef=true and p.proname<>'powder_reliability_public_status_v2080'
 loop
  execute format('revoke execute on function %I.%I(%s) from public, anon, authenticated',r.nspname,r.proname,r.args);
 end loop;
end$$;

-- Explicitly preserve the one public, read-only status RPC.
grant execute on function public.powder_reliability_public_status_v2080() to anon,authenticated,service_role;

revoke all on function public.powder_security_admin_access_v20160(uuid,text,text,text,text,text,text,bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.powder_security_configure_v20160(text[],boolean,text) from public,anon,authenticated;
revoke all on function public.powder_security_revoke_user_v20160(uuid,text,text) from public,anon,authenticated;
revoke all on function public.powder_security_revoke_token_v20160(text,text,text) from public,anon,authenticated;
revoke all on function public.powder_security_posture_v20160() from public,anon,authenticated;
grant execute on function public.powder_security_admin_access_v20160(uuid,text,text,text,text,text,text,bigint,bigint,text) to service_role;
grant execute on function public.powder_security_configure_v20160(text[],boolean,text) to service_role;
grant execute on function public.powder_security_revoke_user_v20160(uuid,text,text) to service_role;
grant execute on function public.powder_security_revoke_token_v20160(text,text,text) to service_role;
grant execute on function public.powder_security_posture_v20160() to service_role;

commit;
