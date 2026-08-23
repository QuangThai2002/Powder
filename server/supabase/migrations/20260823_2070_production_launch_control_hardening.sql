-- Powder 20.7.0 — Production Launch Control Hardening
-- Server-authoritative release authorization + stage health. Gameplay remains frozen.

create table if not exists public.official_release_authorization_v2070 (
  channel text not null check (channel in ('production','staging')),
  build_id text not null,
  manifest_hash text not null default '',
  artifact_checksum text not null default '',
  rollback_target_build text not null default '',
  release_note text not null default '',
  window_start timestamptz,
  window_end timestamptz,
  status text not null default 'draft' check (status in ('draft','submitted','approved','armed','consumed','revoked')),
  revision integer not null default 1 check (revision between 1 and 1000000),
  created_at timestamptz not null default now(),
  created_by text not null default '',
  submitted_at timestamptz,
  submitted_by text not null default '',
  approved_at timestamptz,
  approved_by text not null default '',
  armed_at timestamptz,
  armed_by text not null default '',
  consumed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key(channel,build_id)
);

create table if not exists public.official_rollout_server_evidence_v2070 (
  channel text not null check (channel in ('production','staging')),
  build_id text not null,
  rollout_percent smallint not null check (rollout_percent in (5,20,50,100)),
  status text not null check (status in ('pass','fail')),
  health jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  checked_by text not null default 'server',
  primary key(channel,build_id,rollout_percent)
);

alter table public.official_release_authorization_v2070 enable row level security;
alter table public.official_rollout_server_evidence_v2070 enable row level security;
revoke all on public.official_release_authorization_v2070 from public,anon,authenticated;
revoke all on public.official_rollout_server_evidence_v2070 from public,anon,authenticated;
grant select,insert,update,delete on public.official_release_authorization_v2070 to service_role;
grant select,insert,update,delete on public.official_rollout_server_evidence_v2070 to service_role;

create or replace function public.powder_rollout_stage_health_v2070(
  p_channel text default 'production',
  p_build text default '',
  p_rollout_percent integer default 5,
  p_minutes integer default 30
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  c text:=case when p_channel='staging' then 'staging' else 'production' end;
  pct integer:=case when p_rollout_percent in (5,20,50,100) then p_rollout_percent else 5 end;
  mins integer:=greatest(15,least(180,coalesce(p_minutes,30)));
  cfg public.observability_config_v2020;
  req_count bigint:=0; err_count bigint:=0; p95 numeric:=0; p99 numeric:=0;
  crashes bigint:=0; conflicts bigint:=0; runtime_errors bigint:=0; devices bigint:=0;
  first_sample timestamptz; last_sample timestamptz; span_minutes numeric:=0;
  sufficient boolean:=false; healthy boolean:=false;
begin
  select * into cfg from public.observability_config_v2020 where channel=c;
  select count(*),count(*) filter(where not ok),
         coalesce(percentile_cont(0.95) within group(order by latency_ms),0),
         coalesce(percentile_cont(0.99) within group(order by latency_ms),0),
         min(created_at),max(created_at)
    into req_count,err_count,p95,p99,first_sample,last_sample
    from public.observability_api_samples_v2020
   where channel=c and build_id=p_build and rollout_percent=pct
     and created_at>=now()-make_interval(mins=>mins);
  if first_sample is not null and last_sample is not null then
    span_minutes:=extract(epoch from (last_sample-first_sample))/60.0;
  end if;
  select coalesce(sum(suspected_crashes),0),coalesce(sum(save_conflicts),0),
         coalesce(sum(runtime_errors),0),count(distinct device_hash)
    into crashes,conflicts,runtime_errors,devices
    from public.observability_client_health_v2020
   where channel=c and build_id=p_build and rollout_percent=pct
     and created_at>=now()-make_interval(mins=>mins);
  sufficient:=coalesce(cfg.enabled,false)
    and req_count>=coalesce(cfg.min_requests,200)
    and span_minutes>=15;
  healthy:=sufficient
    and err_count::numeric/greatest(req_count,1)<=coalesce(cfg.max_error_rate,0.01)
    and p95<=coalesce(cfg.max_p95_ms,1500)
    and p99<=coalesce(cfg.max_p99_ms,2500)
    and crashes<=coalesce(cfg.max_crashes,0)
    and conflicts<=coalesce(cfg.max_save_conflicts,0);
  return jsonb_build_object(
    'version','20.7.0','channel',c,'buildId',p_build,'rolloutPercent',pct,'windowMinutes',mins,
    'observabilityEnabled',coalesce(cfg.enabled,false),'sufficient',sufficient,'healthy',healthy,
    'requests',req_count,'errors',err_count,'errorRate',round(err_count::numeric/greatest(req_count,1),6),
    'p95Ms',round(p95,1),'p99Ms',round(p99,1),'spanMinutes',round(span_minutes,1),
    'devices',devices,'runtimeErrors',runtime_errors,'crashes',crashes,'saveConflicts',conflicts,
    'thresholds',jsonb_build_object('minRequests',coalesce(cfg.min_requests,200),'minObservedMinutes',15,
      'maxErrorRate',coalesce(cfg.max_error_rate,0.01),'maxP95Ms',coalesce(cfg.max_p95_ms,1500),
      'maxP99Ms',coalesce(cfg.max_p99_ms,2500),'maxCrashes',coalesce(cfg.max_crashes,0),
      'maxSaveConflicts',coalesce(cfg.max_save_conflicts,0)),
    'checkedAt',now()
  );
end $$;

create or replace function public.powder_capture_rollout_stage_health_v2070(
  p_channel text,p_build text,p_rollout_percent integer
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end; h jsonb; st text;
begin
  if p_rollout_percent not in (5,20,50,100) then raise exception 'INVALID_ROLLOUT_STAGE'; end if;
  h:=public.powder_rollout_stage_health_v2070(c,p_build,p_rollout_percent,30);
  st:=case when coalesce((h->>'healthy')::boolean,false) then 'pass' else 'fail' end;
  insert into public.official_rollout_server_evidence_v2070(channel,build_id,rollout_percent,status,health,checked_at,checked_by)
  values(c,p_build,p_rollout_percent,st,h,now(),'server')
  on conflict(channel,build_id,rollout_percent) do update set status=excluded.status,health=excluded.health,checked_at=excluded.checked_at,checked_by='server';
  return jsonb_build_object('status',st,'health',h);
end $$;

create or replace function public.powder_official_launch_preflight_v2070(
  p_channel text default 'production',
  p_build text default 'powder-20.7.0-production-launch-control-hardening',
  p_manifest_hash text default ''
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  c text:=case when p_channel='staging' then 'staging' else 'production' end;
  b public.release_builds; ch public.release_channels; ro public.release_rollout_v1950;
  auth public.official_release_authorization_v2070;
  integ jsonb:='{}'::jsonb; sec jsonb:='{}'::jsonb; rec jsonb:='{}'::jsonb;
  active_pilot int:=0; recent_pilot int:=0; pvp_matches bigint:=0; crashes bigint:=0; low_fps int:=0; save_bad int:=0;
  pilot_critical int:=0; pilot_high int:=0; ops_critical int:=0; ops_high int:=0; evidence_pass int:=0;
  candidate_ok boolean:=false; integrity_ok boolean:=false; security_ok boolean:=false; recovery_ok boolean:=false;
  pilot_ok boolean:=false; rollout_ok boolean:=false; evidence_ok boolean:=false; incidents_ok boolean:=false;
  observability_ok boolean:=false; rollback_ok boolean:=false; auth_ok boolean:=false; window_ok boolean:=false; ready boolean:=false;
begin
  select * into ch from public.release_channels where channel=c;
  select * into ro from public.release_rollout_v1950 where channel=c;
  select * into b from public.release_builds where channel=c and build_id=p_build limit 1;
  select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build;
  begin integ:=public.powder_integrity_snapshot_v1960(); exception when others then integ:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  begin sec:=public.powder_security_posture_v2030(); exception when others then sec:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  begin rec:=public.powder_recovery_posture_v2040(c,p_build); exception when others then rec:=jsonb_build_object('ready',false,'error',sqlerrm); end;
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
  candidate_ok:=b.build_id is not null and b.version='20.7.0' and b.status in ('candidate','active') and b.checksum~'^[0-9a-fA-F]{64}$';
  integrity_ok:=coalesce((integ->>'ready')::boolean,false);
  security_ok:=coalesce((sec->>'ready')::boolean,false);
  recovery_ok:=coalesce((rec->>'ready')::boolean,false);
  pilot_ok:=active_pilot between 20 and 50 and recent_pilot>=20 and pvp_matches>=20 and crashes=0 and low_fps=0 and save_bad=0 and pilot_critical=0 and pilot_high=0;
  rollout_ok:=coalesce(ro.emergency_mode,'normal')='normal' and coalesce(ch.hard_maintenance,false)=false;
  evidence_ok:=evidence_pass=4;
  incidents_ok:=ops_critical=0 and ops_high=0;
  observability_ok:=exists(select 1 from public.observability_config_v2020 o where o.channel=c and o.enabled=true and o.min_requests>=20);
  rollback_ok:=auth.rollback_target_build<>'' and ro.rollback_target_build=auth.rollback_target_build
    and auth.rollback_target_build<>p_build
    and exists(select 1 from public.release_builds rb where rb.channel=c and rb.build_id=auth.rollback_target_build and rb.checksum~'^[0-9a-fA-F]{64}$');
  auth_ok:=auth.status='armed' and auth.manifest_hash=p_manifest_hash and auth.artifact_checksum=b.checksum;
  window_ok:=auth.window_start is not null and auth.window_end is not null and now() between auth.window_start and auth.window_end;
  ready:=candidate_ok and integrity_ok and security_ok and recovery_ok and pilot_ok and rollout_ok and evidence_ok and incidents_ok and observability_ok and rollback_ok and auth_ok and window_ok;
  return jsonb_build_object('version','20.7.0','channel',c,'buildId',p_build,'manifestHash',p_manifest_hash,'ready',ready,
    'checks',jsonb_build_object('candidate',candidate_ok,'integrity',integrity_ok,'securityPosture',security_ok,'recovery',recovery_ok,
      'realPilot',pilot_ok,'rolloutNormal',rollout_ok,'evidence4of4',evidence_ok,'liveOpsIncidents',incidents_ok,
      'observabilityArmed',observability_ok,'rollbackPinned',rollback_ok,'authorizationArmed',auth_ok,'changeWindowOpen',window_ok),
    'candidate',case when b.build_id is null then null else to_jsonb(b) end,
    'release',case when ch.channel is null then null else to_jsonb(ch) end,
    'rollout',case when ro.channel is null then null else to_jsonb(ro) end,
    'authorization',case when auth.build_id is null then null else to_jsonb(auth) end,
    'integrity',integ,'security',sec,'recovery',rec,
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
  if target.version<>'20.7.0' then raise exception 'OFFICIAL_2070_CANDIDATE_INVALID'; end if;
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
  if ch.build_id<>p_build or ch.current_version<>'20.7.0' then raise exception 'OFFICIAL_2070_BUILD_NOT_ACTIVE'; end if;
  if ro.rollout_percent<>100 then raise exception 'OFFICIAL_2070_ROLLOUT_NOT_100'; end if;
  if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=100 and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_2070_FINAL_HEALTH_NOT_PASSED'; end if;
  update public.launch_config_v170 set launch_status='live',content_frozen=true,registration_open=true,updated_by=p_admin,updated_at=nowts where id=1;
  update public.official_release_authorization_v2070 set status='consumed',consumed_at=nowts,updated_at=nowts,updated_by=p_admin where channel=c and build_id=p_build;
  insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at)
  values(c,'official_live_v2070',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('rolloutPercent',100,'manifestHash',p_manifest_hash,'authorizationRevision',auth.revision,'healthSource','server-observability'),p_admin,nowts);
  return jsonb_build_object('ok',true,'official',true,'channel',c,'version',ch.current_version,'buildId',ch.build_id,'rolloutPercent',100,'at',nowts);
end $$;

revoke all on function public.powder_rollout_stage_health_v2070(text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.powder_capture_rollout_stage_health_v2070(text,text,integer) from public,anon,authenticated;
revoke all on function public.powder_official_launch_preflight_v2070(text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_activate_canary_v2070(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_advance_rollout_v2070(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_finalize_live_v2070(text,text,text,text) from public,anon,authenticated;
grant execute on function public.powder_rollout_stage_health_v2070(text,text,integer,integer) to service_role;
grant execute on function public.powder_capture_rollout_stage_health_v2070(text,text,integer) to service_role;
grant execute on function public.powder_official_launch_preflight_v2070(text,text,text) to service_role;
grant execute on function public.powder_official_activate_canary_v2070(text,text,text,text) to service_role;
grant execute on function public.powder_official_advance_rollout_v2070(text,text,text,text) to service_role;
grant execute on function public.powder_official_finalize_live_v2070(text,text,text,text) to service_role;
