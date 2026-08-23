-- Powder 20.8.0 · Production Reliability & Incident Recovery
-- Additive reliability control-plane. Gameplay/combat tables are not modified.
create extension if not exists pgcrypto;

create table if not exists public.reliability_config_v2080 (
  channel text primary key check (channel in ('production','staging')),
  enabled boolean not null default true,
  automation_armed boolean not null default false,
  watchdog_window_minutes integer not null default 10 check (watchdog_window_minutes between 5 and 120),
  bad_checks_to_degrade integer not null default 2 check (bad_checks_to_degrade between 1 and 10),
  good_checks_to_recover integer not null default 3 check (good_checks_to_recover between 1 and 20),
  recovery_cooldown_minutes integer not null default 15 check (recovery_cooldown_minutes between 1 and 240),
  block_cloud_save_on_critical boolean not null default true,
  block_economy_on_critical boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.reliability_config_v2080(channel,enabled,automation_armed)
values ('production',true,false),('staging',true,false)
on conflict (channel) do nothing;

create table if not exists public.reliability_state_v2080 (
  channel text primary key check (channel in ('production','staging')),
  mode text not null default 'normal' check (mode in ('normal','degraded','read_only','emergency')),
  circuit_state text not null default 'closed' check (circuit_state in ('closed','half_open','open')),
  build_id text not null default '',
  reason text not null default '',
  bad_streak integer not null default 0,
  good_streak integer not null default 0,
  generation bigint not null default 1,
  cloud_writes_allowed boolean not null default true,
  economy_writes_allowed boolean not null default true,
  last_health jsonb not null default '{}'::jsonb,
  last_transition_at timestamptz not null default now(),
  last_watchdog_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.reliability_state_v2080(channel)
values ('production'),('staging') on conflict (channel) do nothing;

create table if not exists public.reliability_events_v2080 (
  id bigserial primary key,
  channel text not null check (channel in ('production','staging')),
  build_id text not null default '',
  event_type text not null,
  before_mode text not null default '',
  after_mode text not null default '',
  before_circuit text not null default '',
  after_circuit text not null default '',
  reason text not null default '',
  health jsonb not null default '{}'::jsonb,
  actor text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists reliability_events_v2080_recent_idx on public.reliability_events_v2080(channel,created_at desc);

alter table public.reliability_config_v2080 enable row level security;
alter table public.reliability_state_v2080 enable row level security;
alter table public.reliability_events_v2080 enable row level security;
revoke all on public.reliability_config_v2080 from public,anon,authenticated;
revoke all on public.reliability_state_v2080 from public,anon,authenticated;
revoke all on public.reliability_events_v2080 from public,anon,authenticated;
grant select,insert,update,delete on public.reliability_config_v2080 to service_role;
grant select,insert,update,delete on public.reliability_state_v2080 to service_role;
grant select,insert,update,delete on public.reliability_events_v2080 to service_role;
grant usage,select on sequence public.reliability_events_v2080_id_seq to service_role;

create or replace function public.powder_reliability_snapshot_v2080(
  p_channel text default 'production',
  p_build text default ''
) returns jsonb language plpgsql security definer set search_path='public' as $function$
declare
  c text:=case when p_channel='staging' then 'staging' else 'production' end;
  cfg public.reliability_config_v2080; st public.reliability_state_v2080;
  obs jsonb:='{}'::jsonb; rec jsonb:='{}'::jsonb; integ jsonb:='{}'::jsonb;
  critical_count int:=0; high_count int:=0; medium_count int:=0;
  obs_enabled boolean:=false; obs_sufficient boolean:=false; obs_healthy boolean:=false;
  recovery_ready boolean:=false; integrity_ready boolean:=false;
  hard_failure boolean:=false; soft_failure boolean:=false; healthy boolean:=false;
begin
  select * into cfg from public.reliability_config_v2080 where channel=c;
  select * into st from public.reliability_state_v2080 where channel=c;
  begin obs:=public.powder_observability_health_v2020(c,p_build,greatest(5,least(120,cfg.watchdog_window_minutes))); exception when others then obs:=jsonb_build_object('enabled',true,'sufficient',false,'healthy',false,'error',sqlerrm); end;
  begin rec:=public.powder_recovery_posture_v2040(c,p_build); exception when others then rec:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  begin integ:=public.powder_integrity_snapshot_v1960(); exception when others then integ:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  select count(*) filter(where severity='critical'),count(*) filter(where severity='high'),count(*) filter(where severity='medium')
    into critical_count,high_count,medium_count
    from public.official_incidents_v2010 where channel=c and status in ('open','monitoring');
  obs_enabled:=coalesce((obs->>'enabled')::boolean,false);
  obs_sufficient:=coalesce((obs->>'sufficient')::boolean,false);
  obs_healthy:=coalesce((obs->>'healthy')::boolean,false);
  recovery_ready:=coalesce((rec->>'ready')::boolean,false);
  integrity_ready:=coalesce((integ->>'ready')::boolean,false);
  hard_failure:=critical_count>0
    or coalesce((obs->>'crashes')::int,0)>coalesce((obs->'thresholds'->>'maxCrashes')::int,0)
    or coalesce((obs->>'saveConflicts')::int,0)>coalesce((obs->'thresholds'->>'maxSaveConflicts')::int,0)
    or not recovery_ready or not integrity_ready;
  soft_failure:=high_count>0 or (obs_enabled and (not obs_sufficient or not obs_healthy));
  healthy:=coalesce(cfg.enabled,true) and not hard_failure and not soft_failure;
  return jsonb_build_object(
    'version','20.8.0','channel',c,'buildId',p_build,'checkedAt',now(),
    'healthy',healthy,'hardFailure',hard_failure,'softFailure',soft_failure,
    'incidents',jsonb_build_object('critical',critical_count,'high',high_count,'medium',medium_count,'blockers',critical_count+high_count),
    'observability',obs,'recovery',rec,'integrity',integ,
    'config',to_jsonb(cfg),'state',to_jsonb(st)
  );
end $function$;

create or replace function public.powder_reliability_apply_mode_v2080(
  p_channel text,p_mode text,p_reason text,p_build text,p_actor text,p_health jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='public' as $function$
declare
  c text:=case when p_channel='staging' then 'staging' else 'production' end;
  m text:=case when p_mode in ('normal','degraded','read_only','emergency') then p_mode else 'degraded' end;
  st public.reliability_state_v2080; cfg public.reliability_config_v2080;
  next_circuit text; cloud_ok boolean; econ_ok boolean; changed boolean:=false; old_mode text; old_circuit text;
begin
  perform pg_advisory_xact_lock(hashtextextended('powder-reliability-v2080:'||c,0));
  select * into st from public.reliability_state_v2080 where channel=c for update;
  old_mode:=st.mode; old_circuit:=st.circuit_state;
  select * into cfg from public.reliability_config_v2080 where channel=c;
  next_circuit:=case when m in ('read_only','emergency') then 'open' when m='degraded' then 'half_open' else 'closed' end;
  cloud_ok:=not (m in ('read_only','emergency') and coalesce(cfg.block_cloud_save_on_critical,true));
  econ_ok:=not (m in ('read_only','emergency') and coalesce(cfg.block_economy_on_critical,true));
  changed:=st.mode<>m or st.circuit_state<>next_circuit or st.cloud_writes_allowed<>cloud_ok or st.economy_writes_allowed<>econ_ok;
  update public.reliability_state_v2080 set mode=m,circuit_state=next_circuit,build_id=left(coalesce(p_build,''),160),reason=left(coalesce(p_reason,''),800),
    cloud_writes_allowed=cloud_ok,economy_writes_allowed=econ_ok,last_health=coalesce(p_health,'{}'::jsonb),
    generation=case when changed then generation+1 else generation end,last_transition_at=case when changed then now() else last_transition_at end,
    updated_at=now(),updated_by=left(coalesce(p_actor,''),160)
  where channel=c returning * into st;
  if changed then
    insert into public.reliability_events_v2080(channel,build_id,event_type,before_mode,after_mode,before_circuit,after_circuit,reason,health,actor)
    values(c,left(coalesce(p_build,''),160),'mode_transition',old_mode,m,old_circuit,next_circuit,left(coalesce(p_reason,''),800),coalesce(p_health,'{}'::jsonb),left(coalesce(p_actor,''),160));
  end if;
  return to_jsonb(st);
end $function$;

-- Watchdog derives all health server-side. No client-supplied health numbers are accepted.
create or replace function public.powder_reliability_watchdog_v2080(
  p_channel text default 'production',p_build text default '',p_actor text default 'watchdog'
) returns jsonb language plpgsql security definer set search_path='public' as $function$
declare
  c text:=case when p_channel='staging' then 'staging' else 'production' end;
  cfg public.reliability_config_v2080; st public.reliability_state_v2080; snap jsonb;
  hard boolean:=false; soft boolean:=false; good boolean:=false;
  bads int:=0; goods int:=0; target_mode text; reason text; elapsed interval;
begin
  perform pg_advisory_xact_lock(hashtextextended('powder-reliability-watchdog-v2080:'||c,0));
  select * into cfg from public.reliability_config_v2080 where channel=c;
  select * into st from public.reliability_state_v2080 where channel=c for update;
  snap:=public.powder_reliability_snapshot_v2080(c,p_build);
  hard:=coalesce((snap->>'hardFailure')::boolean,false); soft:=coalesce((snap->>'softFailure')::boolean,false); good:=coalesce((snap->>'healthy')::boolean,false);
  bads:=case when hard or soft then st.bad_streak+1 else 0 end;
  goods:=case when good then st.good_streak+1 else 0 end;
  update public.reliability_state_v2080 set bad_streak=bads,good_streak=goods,last_health=snap,last_watchdog_at=now(),build_id=left(coalesce(p_build,''),160),updated_at=now(),updated_by=left(coalesce(p_actor,''),160) where channel=c returning * into st;
  target_mode:=st.mode; reason:='WATCHDOG_NO_CHANGE';
  if coalesce(cfg.enabled,true) and coalesce(cfg.automation_armed,false) then
    if hard then target_mode:='read_only'; reason:='AUTO_HARD_FAILURE';
    elsif soft and bads>=cfg.bad_checks_to_degrade and st.mode='normal' then target_mode:='degraded'; reason:='AUTO_SOFT_FAILURE';
    elsif good and st.mode<>'normal' and goods>=cfg.good_checks_to_recover and now()-st.last_transition_at>=make_interval(mins=>cfg.recovery_cooldown_minutes) then target_mode:='normal'; reason:='AUTO_STABLE_RECOVERY';
    end if;
  end if;
  if target_mode<>st.mode then
    perform public.powder_reliability_apply_mode_v2080(c,target_mode,reason,p_build,p_actor,snap);
    select * into st from public.reliability_state_v2080 where channel=c;
  end if;
  insert into public.reliability_events_v2080(channel,build_id,event_type,before_mode,after_mode,before_circuit,after_circuit,reason,health,actor)
  values(c,left(coalesce(p_build,''),160),'watchdog',st.mode,st.mode,st.circuit_state,st.circuit_state,reason,snap,left(coalesce(p_actor,''),160));
  return jsonb_build_object('version','20.8.0','channel',c,'mode',st.mode,'circuitState',st.circuit_state,'reason',reason,'badStreak',st.bad_streak,'goodStreak',st.good_streak,'automationArmed',cfg.automation_armed,'snapshot',snap,'state',to_jsonb(st));
end $function$;

-- Safe public surface for the player client. It does not expose incidents, thresholds, emails or audit data.
create or replace function public.powder_reliability_public_status_v2080()
returns jsonb language sql security definer set search_path='public' stable as $function$
  select jsonb_build_object(
    'version','20.8.0','mode',s.mode,'circuitState',s.circuit_state,'generation',s.generation,
    'cloudWritesAllowed',s.cloud_writes_allowed,'economyWritesAllowed',s.economy_writes_allowed,
    'fxMode',case when s.mode in ('read_only','emergency') then 'low' when s.mode='degraded' then 'balanced' else 'normal' end,
    'updatedAt',s.updated_at
  ) from public.reliability_state_v2080 s where s.channel='production';
$function$;

create or replace function public.powder_reliability_can_write_v2080(p_operation text default 'cloud_save')
returns boolean language plpgsql security definer set search_path='public' stable as $function$
declare s public.reliability_state_v2080; op text:=lower(coalesce(p_operation,''));
begin
  select * into s from public.reliability_state_v2080 where channel='production';
  if op in ('cloud','cloud_save','save','player_save') then return coalesce(s.cloud_writes_allowed,true); end if;
  if op in ('economy','reward','purchase','inventory') then return coalesce(s.economy_writes_allowed,true); end if;
  return s.mode not in ('emergency');
end $function$;

revoke all on function public.powder_reliability_snapshot_v2080(text,text) from public,anon,authenticated;
revoke all on function public.powder_reliability_apply_mode_v2080(text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.powder_reliability_watchdog_v2080(text,text,text) from public,anon,authenticated;
revoke all on function public.powder_reliability_can_write_v2080(text) from public,anon,authenticated;
grant execute on function public.powder_reliability_snapshot_v2080(text,text) to service_role;
grant execute on function public.powder_reliability_apply_mode_v2080(text,text,text,text,text,jsonb) to service_role;
grant execute on function public.powder_reliability_watchdog_v2080(text,text,text) to service_role;
grant execute on function public.powder_reliability_can_write_v2080(text) to service_role;
revoke all on function public.powder_reliability_public_status_v2080() from public;
grant execute on function public.powder_reliability_public_status_v2080() to anon,authenticated,service_role;


-- 20.8 keeps the 20.7 launch API surface but upgrades its expected candidate and adds Reliability as a hard preflight gate.
create or replace function public.powder_official_launch_preflight_v2070(
  p_channel text default 'production',
  p_build text default 'powder-20.8.0-production-reliability-incident-recovery',
  p_manifest_hash text default ''
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  c text:=case when p_channel='staging' then 'staging' else 'production' end;
  b public.release_builds; ch public.release_channels; ro public.release_rollout_v1950;
  auth public.official_release_authorization_v2070;
  integ jsonb:='{}'::jsonb; sec jsonb:='{}'::jsonb; rec jsonb:='{}'::jsonb; rel jsonb:='{}'::jsonb;
  active_pilot int:=0; recent_pilot int:=0; pvp_matches bigint:=0; crashes bigint:=0; low_fps int:=0; save_bad int:=0;
  pilot_critical int:=0; pilot_high int:=0; ops_critical int:=0; ops_high int:=0; evidence_pass int:=0;
  candidate_ok boolean:=false; integrity_ok boolean:=false; security_ok boolean:=false; recovery_ok boolean:=false;
  pilot_ok boolean:=false; rollout_ok boolean:=false; evidence_ok boolean:=false; incidents_ok boolean:=false;
  observability_ok boolean:=false; reliability_ok boolean:=false; rollback_ok boolean:=false; auth_ok boolean:=false; window_ok boolean:=false; ready boolean:=false;
begin
  select * into ch from public.release_channels where channel=c;
  select * into ro from public.release_rollout_v1950 where channel=c;
  select * into b from public.release_builds where channel=c and build_id=p_build limit 1;
  select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build;
  begin integ:=public.powder_integrity_snapshot_v1960(); exception when others then integ:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  begin sec:=public.powder_security_posture_v2030(); exception when others then sec:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  begin rec:=public.powder_recovery_posture_v2040(c,p_build); exception when others then rec:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  begin rel:=public.powder_reliability_snapshot_v2080(c,p_build); exception when others then rel:=jsonb_build_object('healthy',false,'error',sqlerrm); end;
  select count(*) into active_pilot from public.pilot_cohort_v1970 where active=true;
  select count(distinct d.user_id),coalesce(sum(d.pvp_matches),0),coalesce(sum(d.crash_count),0),
         count(*) filter(where d.avg_fps>0 and d.avg_fps<30),
         count(*) filter(where coalesce((d.last_summary->>'savePass')::boolean,true)=false)
    into recent_pilot,pvp_matches,crashes,low_fps,save_bad
    from public.pilot_device_health_v1970 d
    join public.pilot_cohort_v1970 p on p.user_id=d.user_id and p.active=true
   where d.last_seen_at>=now()-interval '7 days';
  select count(*) filter(where i.severity='critical'),count(*) filter(where i.severity='high')
    into pilot_critical,pilot_high
    from public.pilot_issue_reports_v1970 i
    join public.pilot_cohort_v1970 p on p.user_id=i.user_id and p.active=true
   where i.status in ('open','triaged');
  select count(*) filter(where severity='critical'),count(*) filter(where severity='high')
    into ops_critical,ops_high from public.official_incidents_v2010
   where channel=c and status in ('open','monitoring');
  select count(*) into evidence_pass from public.official_launch_evidence_v2000 e
   where e.channel=c and e.build_id=p_build and e.status='pass'
     and e.check_key in ('load_1960','recovery_1940','polish_1980','freeze_1990')
     and (p_manifest_hash='' or e.manifest_hash=p_manifest_hash)
     and e.evidence_sha256~'^[0-9a-fA-F]{64}$';
  candidate_ok:=b.build_id is not null and b.version='20.8.0' and b.status in ('candidate','active') and b.checksum~'^[0-9a-fA-F]{64}$';
  integrity_ok:=coalesce((integ->>'ready')::boolean,false);
  security_ok:=coalesce((sec->>'ready')::boolean,false);
  recovery_ok:=coalesce((rec->>'ready')::boolean,false);
  pilot_ok:=active_pilot between 20 and 50 and recent_pilot>=20 and pvp_matches>=20 and crashes=0 and low_fps=0 and save_bad=0 and pilot_critical=0 and pilot_high=0;
  rollout_ok:=coalesce(ro.emergency_mode,'normal')='normal' and coalesce(ch.hard_maintenance,false)=false;
  evidence_ok:=evidence_pass=4;
  incidents_ok:=ops_critical=0 and ops_high=0;
  observability_ok:=exists(select 1 from public.observability_config_v2020 o where o.channel=c and o.enabled=true and o.min_requests>=20);
  reliability_ok:=coalesce((rel->>'healthy')::boolean,false) and coalesce(rel->'state'->>'mode','normal')='normal' and coalesce(rel->'state'->>'circuit_state','closed')='closed';
  rollback_ok:=auth.rollback_target_build<>'' and ro.rollback_target_build=auth.rollback_target_build
    and auth.rollback_target_build<>p_build
    and exists(select 1 from public.release_builds rb where rb.channel=c and rb.build_id=auth.rollback_target_build and rb.checksum~'^[0-9a-fA-F]{64}$');
  auth_ok:=auth.status='armed' and auth.manifest_hash=p_manifest_hash and auth.artifact_checksum=b.checksum;
  window_ok:=auth.window_start is not null and auth.window_end is not null and now() between auth.window_start and auth.window_end;
  ready:=candidate_ok and integrity_ok and security_ok and recovery_ok and pilot_ok and rollout_ok and evidence_ok and incidents_ok and observability_ok and reliability_ok and rollback_ok and auth_ok and window_ok;
  return jsonb_build_object('version','20.8.0','channel',c,'buildId',p_build,'manifestHash',p_manifest_hash,'ready',ready,
    'checks',jsonb_build_object('candidate',candidate_ok,'integrity',integrity_ok,'securityPosture',security_ok,'recovery',recovery_ok,
      'realPilot',pilot_ok,'rolloutNormal',rollout_ok,'evidence4of4',evidence_ok,'liveOpsIncidents',incidents_ok,
      'observabilityArmed',observability_ok,'reliabilityNormal',reliability_ok,'rollbackPinned',rollback_ok,'authorizationArmed',auth_ok,'changeWindowOpen',window_ok),
    'candidate',case when b.build_id is null then null else to_jsonb(b) end,
    'release',case when ch.channel is null then null else to_jsonb(ch) end,
    'rollout',case when ro.channel is null then null else to_jsonb(ro) end,
    'authorization',case when auth.build_id is null then null else to_jsonb(auth) end,
    'integrity',integ,'security',sec,'recovery',rec,'reliability',rel,
    'pilot',jsonb_build_object('activePilot',active_pilot,'recentPilot7d',recent_pilot,'pvpMatches',pvp_matches,'crashes',crashes,'lowFpsDevices',low_fps,'saveBadDevices',save_bad,'openCritical',pilot_critical,'openHigh',pilot_high),
    'liveOps',jsonb_build_object('openCritical',ops_critical,'openHigh',ops_high,'blockers',ops_critical+ops_high),
    'evidencePass',evidence_pass,'checkedAt',now());
end $$;

create or replace function public.powder_official_activate_canary_v2070(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end; pf jsonb; ch public.release_channels; ro public.release_rollout_v1950; target public.release_builds; auth public.official_release_authorization_v2070; nowts timestamptz:=now();
begin
  perform pg_advisory_xact_lock(hashtextextended('official-launch-v2070:'||c,0));
  pf:=public.powder_official_launch_preflight_v2070(c,p_build,p_manifest_hash);
  if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_2070_PREFLIGHT_NOT_READY'; end if;
  select * into ch from public.release_channels where channel=c for update;
  select * into ro from public.release_rollout_v1950 where channel=c for update;
  select * into target from public.release_builds where channel=c and build_id=p_build for update;
  select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;
  if target.version<>'20.8.0' then raise exception 'OFFICIAL_2070_CANDIDATE_INVALID'; end if;
  if ch.build_id=p_build then raise exception 'OFFICIAL_2070_ALREADY_ACTIVE'; end if;
  if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_2070_AUTH_NOT_ARMED'; end if;
  if auth.rollback_target_build<>ch.build_id or ro.rollback_target_build<>ch.build_id then raise exception 'OFFICIAL_2070_ROLLBACK_TARGET_DRIFT'; end if;
  update public.release_builds set status='rolled_back' where channel=c and build_id=ch.build_id;
  update public.release_builds set status='active',activated_at=nowts where channel=c and build_id=p_build;
  update public.release_channels set current_version=target.version,build_id=target.build_id,asset_epoch=coalesce(asset_epoch,0)+1,updated_at=nowts,updated_by=p_admin where channel=c;
  update public.release_rollout_v1950 set rollout_percent=5,emergency_mode='normal',emergency_message='',updated_at=nowts,updated_by=p_admin where channel=c;
  delete from public.official_rollout_server_evidence_v2070 where channel=c and build_id=p_build;
  insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at)
  values(c,'official_canary_5_v2070',target.version,target.build_id,ch.current_version,jsonb_build_object('manifestHash',p_manifest_hash,'rollbackTarget',auth.rollback_target_build,'authorizationRevision',auth.revision),p_admin,nowts);
  return jsonb_build_object('ok',true,'channel',c,'version',target.version,'buildId',target.build_id,'rolloutPercent',5,'previousBuildId',ch.build_id,'at',nowts);
end $$;

create or replace function public.powder_official_advance_rollout_v2070(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end; pf jsonb; ch public.release_channels; ro public.release_rollout_v1950; auth public.official_release_authorization_v2070; cur smallint; nxt smallint; nowts timestamptz:=now();
begin
  perform pg_advisory_xact_lock(hashtextextended('official-launch-v2070:'||c,0));
  pf:=public.powder_official_launch_preflight_v2070(c,p_build,p_manifest_hash);
  if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_2070_PREFLIGHT_NOT_READY'; end if;
  select * into ch from public.release_channels where channel=c for update;
  select * into ro from public.release_rollout_v1950 where channel=c for update;
  select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;
  if ch.build_id<>p_build then raise exception 'OFFICIAL_2070_BUILD_NOT_ACTIVE'; end if;
  if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_2070_AUTH_WINDOW_CLOSED'; end if;
  cur:=ro.rollout_percent; nxt:=case cur when 5 then 20 when 20 then 50 when 50 then 100 else null end;
  if nxt is null then raise exception 'OFFICIAL_2070_STAGE_NOT_ADVANCEABLE'; end if;
  if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=cur and e.status='pass' and e.checked_at>=now()-interval '6 hours') then
    raise exception 'OFFICIAL_2070_SERVER_HEALTH_NOT_PASSED';
  end if;
  update public.release_rollout_v1950 set rollout_percent=nxt,updated_at=nowts,updated_by=p_admin where channel=c;
  insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at)
  values(c,'official_rollout_'||nxt::text||'_v2070',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('fromPercent',cur,'toPercent',nxt,'manifestHash',p_manifest_hash,'healthSource','server-observability'),p_admin,nowts);
  return jsonb_build_object('ok',true,'channel',c,'buildId',p_build,'fromPercent',cur,'rolloutPercent',nxt,'at',nowts);
end $$;

create or replace function public.powder_official_finalize_live_v2070(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end; pf jsonb; ch public.release_channels; ro public.release_rollout_v1950; auth public.official_release_authorization_v2070; nowts timestamptz:=now();
begin
  perform pg_advisory_xact_lock(hashtextextended('official-launch-v2070:'||c,0));
  pf:=public.powder_official_launch_preflight_v2070(c,p_build,p_manifest_hash);
  if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_2070_PREFLIGHT_NOT_READY'; end if;
  select * into ch from public.release_channels where channel=c for update;
  select * into ro from public.release_rollout_v1950 where channel=c for update;
  select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;
  if ch.build_id<>p_build or ch.current_version<>'20.8.0' then raise exception 'OFFICIAL_2070_BUILD_NOT_ACTIVE'; end if;
  if ro.rollout_percent<>100 then raise exception 'OFFICIAL_2070_ROLLOUT_NOT_100'; end if;
  if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=100 and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_2070_FINAL_HEALTH_NOT_PASSED'; end if;
  update public.launch_config_v170 set launch_status='live',content_frozen=true,registration_open=true,updated_by=p_admin,updated_at=nowts where id=1;
  update public.official_release_authorization_v2070 set status='consumed',consumed_at=nowts,updated_at=nowts,updated_by=p_admin where channel=c and build_id=p_build;
  insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at)
  values(c,'official_live_v2070',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('rolloutPercent',100,'manifestHash',p_manifest_hash,'authorizationRevision',auth.revision,'healthSource','server-observability'),p_admin,nowts);
  return jsonb_build_object('ok',true,'official',true,'channel',c,'version',ch.current_version,'buildId',ch.build_id,'rolloutPercent',100,'at',nowts);
end $$;


revoke all on function public.powder_official_launch_preflight_v2070(text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_activate_canary_v2070(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_advance_rollout_v2070(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_finalize_live_v2070(text,text,text,text) from public,anon,authenticated;
grant execute on function public.powder_official_launch_preflight_v2070(text,text,text) to service_role;
grant execute on function public.powder_official_activate_canary_v2070(text,text,text,text) to service_role;
grant execute on function public.powder_official_advance_rollout_v2070(text,text,text,text) to service_role;
grant execute on function public.powder_official_finalize_live_v2070(text,text,text,text) to service_role;
