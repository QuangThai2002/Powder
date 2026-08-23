create table if not exists public.observability_config_v2020 (
  channel text primary key check (channel in ('production','staging')),
  enabled boolean not null default false,
  sample_rate numeric(5,4) not null default 0.0500 check (sample_rate between 0 and 1),
  sample_salt text not null default 'powder-observability-v2020',
  min_requests integer not null default 200 check (min_requests between 20 and 1000000),
  max_error_rate numeric(8,6) not null default 0.010000 check (max_error_rate between 0 and 1),
  max_p95_ms integer not null default 1500 check (max_p95_ms between 100 and 120000),
  max_p99_ms integer not null default 2500 check (max_p99_ms between 100 and 120000),
  max_crashes integer not null default 0 check (max_crashes between 0 and 100000),
  max_save_conflicts integer not null default 0 check (max_save_conflicts between 0 and 100000),
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.observability_config_v2020(channel, enabled, sample_rate, sample_salt)
values ('production',false,0.0500,'powder-production-observe-v2020'),
       ('staging',false,0.2500,'powder-staging-observe-v2020')
on conflict (channel) do nothing;

create table if not exists public.observability_api_samples_v2020 (
  id bigserial primary key,
  channel text not null check (channel in ('production','staging')),
  user_id uuid not null,
  device_hash text not null,
  app_version text not null default '',
  build_id text not null default '',
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  endpoint text not null,
  status_code integer not null default 0,
  latency_ms integer not null check (latency_ms between 0 and 120000),
  ok boolean not null,
  network_type text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists observability_api_samples_v2020_recent_idx on public.observability_api_samples_v2020(channel, build_id, created_at desc);
create index if not exists observability_api_samples_v2020_endpoint_idx on public.observability_api_samples_v2020(channel, build_id, endpoint, created_at desc);
create index if not exists observability_api_samples_v2020_ring_idx on public.observability_api_samples_v2020(channel, build_id, rollout_percent, created_at desc);

create table if not exists public.observability_client_health_v2020 (
  id bigserial primary key,
  channel text not null check (channel in ('production','staging')),
  user_id uuid not null,
  device_hash text not null,
  app_version text not null default '',
  build_id text not null default '',
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  runtime_errors integer not null default 0 check (runtime_errors between 0 and 100000),
  suspected_crashes integer not null default 0 check (suspected_crashes between 0 and 100000),
  reconnects integer not null default 0 check (reconnects between 0 and 100000),
  save_conflicts integer not null default 0 check (save_conflicts between 0 and 100000),
  network_type text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists observability_client_health_v2020_recent_idx on public.observability_client_health_v2020(channel, build_id, created_at desc);

create table if not exists public.observability_snapshots_v2020 (
  id bigserial primary key,
  channel text not null check (channel in ('production','staging')),
  build_id text not null default '',
  label text not null default '',
  kind text not null default 'checkpoint' check (kind in ('baseline','checkpoint','rollback_before','rollback_after')),
  health jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default ''
);
create index if not exists observability_snapshots_v2020_recent_idx on public.observability_snapshots_v2020(channel, build_id, created_at desc);

alter table public.observability_config_v2020 enable row level security;
alter table public.observability_api_samples_v2020 enable row level security;
alter table public.observability_client_health_v2020 enable row level security;
alter table public.observability_snapshots_v2020 enable row level security;
revoke all on table public.observability_config_v2020 from public, anon, authenticated;
revoke all on table public.observability_api_samples_v2020 from public, anon, authenticated;
revoke all on table public.observability_client_health_v2020 from public, anon, authenticated;
revoke all on table public.observability_snapshots_v2020 from public, anon, authenticated;
grant select,insert,update,delete on table public.observability_config_v2020 to service_role;
grant select,insert,update,delete on table public.observability_api_samples_v2020 to service_role;
grant select,insert,update,delete on table public.observability_client_health_v2020 to service_role;
grant select,insert,update,delete on table public.observability_snapshots_v2020 to service_role;
grant usage,select on all sequences in schema public to service_role;

create or replace function public.powder_observability_health_v2020(
  p_channel text default 'production',
  p_build text default '',
  p_minutes integer default 30
) returns jsonb
language plpgsql security definer set search_path='public' as $function$
declare
  c text := case when p_channel='staging' then 'staging' else 'production' end;
  mins integer := greatest(5,least(1440,coalesce(p_minutes,30)));
  cfg public.observability_config_v2020;
  req_count bigint:=0; err_count bigint:=0; p50 numeric:=0; p95 numeric:=0; p99 numeric:=0;
  crashes bigint:=0; save_conflicts bigint:=0; runtime_errors bigint:=0; reconnects bigint:=0; devices bigint:=0;
  sufficient boolean:=false; healthy boolean:=false; eps jsonb:='[]'::jsonb; rings jsonb:='[]'::jsonb;
begin
  select * into cfg from public.observability_config_v2020 where channel=c;
  select count(*),count(*) filter(where not ok),
         coalesce(percentile_cont(0.50) within group(order by latency_ms),0),
         coalesce(percentile_cont(0.95) within group(order by latency_ms),0),
         coalesce(percentile_cont(0.99) within group(order by latency_ms),0)
    into req_count,err_count,p50,p95,p99
    from public.observability_api_samples_v2020
   where channel=c and (p_build='' or build_id=p_build) and created_at>=now()-make_interval(mins=>mins);
  select coalesce(sum(h.suspected_crashes),0),coalesce(sum(h.save_conflicts),0),coalesce(sum(h.runtime_errors),0),coalesce(sum(h.reconnects),0),count(distinct h.device_hash)
    into crashes,save_conflicts,runtime_errors,reconnects,devices
    from public.observability_client_health_v2020 h
   where h.channel=c and (p_build='' or h.build_id=p_build) and h.created_at>=now()-make_interval(mins=>mins);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.requests desc),'[]'::jsonb) into eps from (
    select endpoint,count(*) requests,count(*) filter(where not ok) errors,
           round((count(*) filter(where not ok))::numeric/greatest(count(*),1),6) error_rate,
           round((percentile_cont(0.50) within group(order by latency_ms))::numeric,1) p50_ms,
           round((percentile_cont(0.95) within group(order by latency_ms))::numeric,1) p95_ms,
           round((percentile_cont(0.99) within group(order by latency_ms))::numeric,1) p99_ms
      from public.observability_api_samples_v2020
     where channel=c and (p_build='' or build_id=p_build) and created_at>=now()-make_interval(mins=>mins)
     group by endpoint order by count(*) desc limit 30
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.rollout_percent),'[]'::jsonb) into rings from (
    select rollout_percent,count(*) requests,count(*) filter(where not ok) errors,
           round((count(*) filter(where not ok))::numeric/greatest(count(*),1),6) error_rate,
           round((percentile_cont(0.95) within group(order by latency_ms))::numeric,1) p95_ms,
           round((percentile_cont(0.99) within group(order by latency_ms))::numeric,1) p99_ms
      from public.observability_api_samples_v2020
     where channel=c and (p_build='' or build_id=p_build) and created_at>=now()-make_interval(mins=>mins)
     group by rollout_percent
  ) x;
  sufficient := req_count>=coalesce(cfg.min_requests,200);
  healthy := (not coalesce(cfg.enabled,false)) or (
    sufficient and err_count::numeric/greatest(req_count,1)<=coalesce(cfg.max_error_rate,0.01)
    and p95<=coalesce(cfg.max_p95_ms,1500) and p99<=coalesce(cfg.max_p99_ms,2500)
    and crashes<=coalesce(cfg.max_crashes,0) and save_conflicts<=coalesce(cfg.max_save_conflicts,0)
  );
  return jsonb_build_object(
    'version','20.2.0','channel',c,'buildId',p_build,'windowMinutes',mins,
    'enabled',coalesce(cfg.enabled,false),'sampleRate',coalesce(cfg.sample_rate,0),'sufficient',sufficient,'healthy',healthy,
    'requests',req_count,'errors',err_count,'errorRate',round(err_count::numeric/greatest(req_count,1),6),
    'p50Ms',round(p50,1),'p95Ms',round(p95,1),'p99Ms',round(p99,1),
    'devices',devices,'runtimeErrors',runtime_errors,'crashes',crashes,'reconnects',reconnects,'saveConflicts',save_conflicts,
    'thresholds',jsonb_build_object('minRequests',cfg.min_requests,'maxErrorRate',cfg.max_error_rate,'maxP95Ms',cfg.max_p95_ms,'maxP99Ms',cfg.max_p99_ms,'maxCrashes',cfg.max_crashes,'maxSaveConflicts',cfg.max_save_conflicts),
    'endpoints',eps,'rings',rings,'checkedAt',now()
  );
end $function$;

create or replace function public.powder_observability_rollout_gate_v2020(p_channel text default 'production',p_build text default '')
returns jsonb language plpgsql security definer set search_path='public' as $function$
declare h jsonb;
begin
  h:=public.powder_observability_health_v2020(p_channel,p_build,30);
  return jsonb_build_object('enabled',coalesce((h->>'enabled')::boolean,false),'healthy',coalesce((h->>'healthy')::boolean,false),'sufficient',coalesce((h->>'sufficient')::boolean,false),'health',h);
end $function$;

create or replace function public.powder_release_manifest(p_channel text default 'production'::text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare r public.release_channels; ro public.release_rollout_v1950; ob public.observability_config_v2020; c text:=case when p_channel='staging' then 'staging' else 'production' end;
begin
  select * into r from public.release_channels where channel=c;
  select * into ro from public.release_rollout_v1950 where channel=c;
  select * into ob from public.observability_config_v2020 where channel=c;
  return jsonb_build_object(
    'channel',r.channel,'currentVersion',r.current_version,'minimumVersion',r.minimum_version,'buildId',r.build_id,
    'hardMaintenance',r.hard_maintenance,'maintenanceMessage',r.maintenance_message,'maintenanceUntil',r.maintenance_until,'updateUrl',r.update_url,'assetEpoch',r.asset_epoch,
    'rolloutPercent',coalesce(ro.rollout_percent,100),'rolloutSalt',coalesce(ro.cohort_salt,'powder-rollout-v1950'),'emergencyMode',coalesce(ro.emergency_mode,'normal'),'emergencyMessage',coalesce(ro.emergency_message,''),'rollbackTargetBuild',coalesce(ro.rollback_target_build,''),'rolloutUpdatedAt',ro.updated_at,
    'observability',jsonb_build_object('version','20.2.0','enabled',coalesce(ob.enabled,false),'sampleRate',coalesce(ob.sample_rate,0),'sampleSalt',coalesce(ob.sample_salt,'powder-observability-v2020')),
    'serverTime',now()
  );
end $function$;

revoke all on function public.powder_observability_health_v2020(text,text,integer) from public,anon,authenticated;
revoke all on function public.powder_observability_rollout_gate_v2020(text,text) from public,anon,authenticated;
revoke all on function public.powder_release_manifest(text) from public,anon,authenticated;
grant execute on function public.powder_observability_health_v2020(text,text,integer) to service_role;
grant execute on function public.powder_observability_rollout_gate_v2020(text,text) to service_role;
grant execute on function public.powder_release_manifest(text) to service_role;

-- Additive Official Launch guard: when observability is enabled, rollout health becomes a hard server-side gate.
create or replace function public.powder_official_launch_preflight_v2000(
  p_channel text default 'production'::text,
  p_build text default 'powder-20.0.0-official-launch-gate'::text,
  p_manifest_hash text default ''::text
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  c text := case when p_channel='staging' then 'staging' else 'production' end;
  b public.release_builds; ch public.release_channels; ro public.release_rollout_v1950; integ jsonb := '{}'::jsonb; obs jsonb := '{}'::jsonb;
  active_pilot int:=0; recent_pilot int:=0; pvp_matches bigint:=0; crashes bigint:=0; low_fps int:=0; save_bad int:=0; critical int:=0; high int:=0; evidence_pass int:=0;
  ops_critical int:=0; ops_high int:=0;
  rollback_ok boolean:=false; candidate_ok boolean:=false; integrity_ok boolean:=false; pilot_ok boolean:=false; rollout_ok boolean:=false; evidence_ok boolean:=false; incident_ok boolean:=false; obs_ok boolean:=true; ready boolean:=false;
begin
  select * into ch from public.release_channels where channel=c;
  select * into ro from public.release_rollout_v1950 where channel=c;
  select * into b from public.release_builds where channel=c and build_id=p_build limit 1;
  begin integ := public.powder_integrity_snapshot_v1960(); exception when others then integ := jsonb_build_object('ready',false,'error',sqlerrm); end;
  begin obs := public.powder_observability_rollout_gate_v2020(c,p_build); exception when others then obs := jsonb_build_object('enabled',true,'healthy',false,'sufficient',false,'error',sqlerrm); end;
  select count(*) into active_pilot from public.pilot_cohort_v1970 where active=true;
  select count(distinct d.user_id),coalesce(sum(d.pvp_matches),0),coalesce(sum(d.crash_count),0),count(*) filter(where d.avg_fps>0 and d.avg_fps<30),count(*) filter(where coalesce((d.last_summary->>'savePass')::boolean,true)=false)
    into recent_pilot,pvp_matches,crashes,low_fps,save_bad from public.pilot_device_health_v1970 d join public.pilot_cohort_v1970 c0 on c0.user_id=d.user_id and c0.active=true where d.last_seen_at>=now()-interval '7 days';
  select count(*) filter(where i.severity='critical'),count(*) filter(where i.severity='high') into critical,high from public.pilot_issue_reports_v1970 i join public.pilot_cohort_v1970 c0 on c0.user_id=i.user_id and c0.active=true where i.status in ('open','triaged');
  select count(*) filter(where severity='critical'),count(*) filter(where severity='high') into ops_critical,ops_high from public.official_incidents_v2010 where channel=c and status in ('open','monitoring');
  select count(*) into evidence_pass from public.official_launch_evidence_v2000 e where e.channel=c and e.build_id=p_build and e.status='pass' and e.check_key in ('load_1960','recovery_1940','polish_1980','freeze_1990') and (p_manifest_hash='' or e.manifest_hash=p_manifest_hash) and e.evidence_sha256 ~ '^[0-9a-fA-F]{64}$';
  if ro.rollback_target_build<>'' then rollback_ok := exists(select 1 from public.release_builds rb where rb.channel=c and rb.build_id=ro.rollback_target_build and rb.checksum ~ '^[0-9a-fA-F]{64}$' and rb.build_id<>p_build); end if;
  candidate_ok := b.build_id is not null and b.version='20.0.0' and b.status in ('candidate','active') and b.checksum ~ '^[0-9a-fA-F]{64}$';
  integrity_ok := coalesce((integ->>'ready')::boolean,false)=true;
  pilot_ok := active_pilot between 20 and 50 and recent_pilot>=20 and pvp_matches>=20 and crashes=0 and low_fps=0 and save_bad=0 and critical=0 and high=0;
  rollout_ok := coalesce(ro.emergency_mode,'normal')='normal' and coalesce(ch.hard_maintenance,false)=false;
  evidence_ok := evidence_pass=4;
  incident_ok := ops_critical=0 and ops_high=0;
  obs_ok := case when coalesce((obs->>'enabled')::boolean,false) then coalesce((obs->>'healthy')::boolean,false) and coalesce((obs->>'sufficient')::boolean,false) else true end;
  ready := candidate_ok and integrity_ok and pilot_ok and rollout_ok and evidence_ok and rollback_ok and incident_ok and obs_ok;
  return jsonb_build_object('version','20.0.0','channel',c,'buildId',p_build,'manifestHash',p_manifest_hash,'ready',ready,
    'checks',jsonb_build_object('candidate',candidate_ok,'integrity',integrity_ok,'realPilot',pilot_ok,'rolloutNormal',rollout_ok,'evidence4of4',evidence_ok,'rollbackTarget',rollback_ok,'liveOpsIncidents',incident_ok,'observability',obs_ok),
    'candidate',case when b.build_id is null then null else to_jsonb(b) end,'release',case when ch.channel is null then null else to_jsonb(ch) end,'rollout',case when ro.channel is null then null else to_jsonb(ro) end,'integrity',integ,
    'pilot',jsonb_build_object('activePilot',active_pilot,'recentPilot7d',recent_pilot,'pvpMatches',pvp_matches,'crashes',crashes,'lowFpsDevices',low_fps,'saveBadDevices',save_bad,'openCritical',critical,'openHigh',high),
    'liveOps',jsonb_build_object('openCritical',ops_critical,'openHigh',ops_high,'blockers',ops_critical+ops_high),'observability',obs,'evidencePass',evidence_pass,'checkedAt',now());
end $function$;
revoke all on function public.powder_official_launch_preflight_v2000(text,text,text) from public,anon,authenticated;
grant execute on function public.powder_official_launch_preflight_v2000(text,text,text) to service_role;
