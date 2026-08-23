-- Powder 20.14.0 · Production Load & Soak Testing
-- Additive, fail-closed load evidence. No player gameplay tables are mutated by this migration.

create table if not exists public.load_soak_config_v20140 (
  channel text primary key check (channel in ('staging','production')),
  enabled boolean not null default false,
  evidence_ttl_days integer not null default 7 check (evidence_ttl_days between 1 and 30),
  load_min_duration_seconds integer not null default 900 check (load_min_duration_seconds between 60 and 86400),
  load_min_requests bigint not null default 10000 check (load_min_requests >= 100),
  load_min_peak_vus integer not null default 100 check (load_min_peak_vus between 1 and 10000),
  soak_min_duration_seconds integer not null default 14400 check (soak_min_duration_seconds between 1800 and 172800),
  soak_min_requests bigint not null default 50000 check (soak_min_requests >= 1000),
  soak_min_peak_vus integer not null default 50 check (soak_min_peak_vus between 1 and 10000),
  overload_min_duration_seconds integer not null default 300 check (overload_min_duration_seconds between 60 and 7200),
  overload_min_requests bigint not null default 5000 check (overload_min_requests >= 100),
  overload_min_peak_vus integer not null default 150 check (overload_min_peak_vus between 1 and 10000),
  max_error_rate numeric not null default 0.01 check (max_error_rate between 0 and 0.25),
  max_p95_ms numeric not null default 1500 check (max_p95_ms between 50 and 30000),
  max_p99_ms numeric not null default 2500 check (max_p99_ms between 50 and 60000),
  max_db_pool_pct numeric not null default 80 check (max_db_pool_pct between 1 and 100),
  load_max_memory_growth_pct numeric not null default 15 check (load_max_memory_growth_pct between 0 and 100),
  soak_max_memory_growth_pct numeric not null default 8 check (soak_max_memory_growth_pct between 0 and 100),
  required_scenario_requests integer not null default 100 check (required_scenario_requests between 1 and 1000000),
  max_recovery_seconds integer not null default 600 check (max_recovery_seconds between 30 and 3600),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'migration'
);
insert into public.load_soak_config_v20140(channel) values('production'),('staging') on conflict(channel) do nothing;

create table if not exists public.load_soak_evidence_v20140 (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('staging','production')),
  build_id text not null,
  profile text not null check (profile in ('load','soak','overload')),
  schema_version text not null default 'powder-load-soak-evidence-v20140',
  runner_revision text not null,
  scenario_sha256 text not null check (scenario_sha256 ~ '^[0-9a-fA-F]{64}$'),
  evidence_sha256 text not null unique check (evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  total_requests bigint not null check (total_requests >= 0),
  peak_vus integer not null check (peak_vus >= 0),
  error_rate numeric not null check (error_rate between 0 and 1),
  p50_ms numeric not null default 0,
  p95_ms numeric not null default 0,
  p99_ms numeric not null default 0,
  throughput_rps numeric not null default 0,
  max_db_pool_pct numeric,
  server_memory_start_mb numeric,
  server_memory_end_mb numeric,
  server_memory_growth_pct numeric,
  scenario_counts jsonb not null default '{}'::jsonb,
  integrity jsonb not null default '{}'::jsonb,
  degrade jsonb not null default '{}'::jsonb,
  metrics_source text not null default '',
  metrics_source_revision text not null default '',
  calculated_pass boolean not null default false,
  failure_reasons jsonb not null default '[]'::jsonb,
  report jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  ingested_by text not null default 'external-runner'
);
create index if not exists load_soak_evidence_v20140_recent_idx on public.load_soak_evidence_v20140(channel,build_id,profile,completed_at desc);

create table if not exists public.load_soak_sandbox_v20140 (
  run_id text not null,
  slot integer not null check (slot between 0 and 255),
  value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(run_id,slot)
);
create index if not exists load_soak_sandbox_v20140_updated_idx on public.load_soak_sandbox_v20140(updated_at);

create table if not exists public.load_soak_audit_v20140 (
  id bigint generated always as identity primary key,
  channel text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  actor text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists load_soak_audit_v20140_recent_idx on public.load_soak_audit_v20140(channel,created_at desc);

alter table public.load_soak_config_v20140 enable row level security;
alter table public.load_soak_evidence_v20140 enable row level security;
alter table public.load_soak_audit_v20140 enable row level security;
alter table public.load_soak_sandbox_v20140 enable row level security;
revoke all on table public.load_soak_config_v20140 from public,anon,authenticated;
revoke all on table public.load_soak_evidence_v20140 from public,anon,authenticated;
revoke all on table public.load_soak_audit_v20140 from public,anon,authenticated;
revoke all on table public.load_soak_sandbox_v20140 from public,anon,authenticated;
grant select,insert,update,delete on table public.load_soak_config_v20140 to service_role;
grant select,insert,update,delete on table public.load_soak_evidence_v20140 to service_role;
grant select,insert,update,delete on table public.load_soak_audit_v20140 to service_role;
grant select,insert,update,delete on table public.load_soak_sandbox_v20140 to service_role;

create or replace function public.powder_load_soak_validate_report_v20140(p_report jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c text:=case when p_report->>'channel'='staging' then 'staging' else 'production' end;
 cfg public.load_soak_config_v20140; profile text:=lower(coalesce(p_report->>'profile',''));
 duration_s integer:=coalesce((p_report->>'durationSeconds')::integer,0);
 reqs bigint:=coalesce((p_report->>'totalRequests')::bigint,0);
 vus integer:=coalesce((p_report->>'peakVUs')::integer,0);
 err numeric:=coalesce((p_report#>>'{metrics,errorRate}')::numeric,1);
 p95 numeric:=coalesce((p_report#>>'{metrics,p95Ms}')::numeric,999999);
 p99 numeric:=coalesce((p_report#>>'{metrics,p99Ms}')::numeric,999999);
 dbpct numeric:=nullif(p_report#>>'{serverMetrics,maxDbPoolPct}','')::numeric;
 memgrowth numeric:=nullif(p_report#>>'{serverMetrics,memoryGrowthPct}','')::numeric;
 counts jsonb:=coalesce(p_report->'scenarioCounts','{}'::jsonb);
 integ jsonb:=coalesce(p_report->'integrity','{}'::jsonb);
 deg jsonb:=coalesce(p_report->'degrade','{}'::jsonb);
 reasons jsonb:='[]'::jsonb; min_duration int; min_requests bigint; min_vus int; max_mem numeric;
 scenario text;
begin
 select * into cfg from public.load_soak_config_v20140 where channel=c;
 if cfg.channel is null then return jsonb_build_object('pass',false,'reasons',jsonb_build_array('CONFIG_MISSING')); end if;
 if p_report->>'schema'<>'powder-load-soak-evidence-v20140' then reasons:=reasons||to_jsonb('SCHEMA_INVALID'::text); end if;
 if p_report->>'version'<>'20.14.0' then reasons:=reasons||to_jsonb('VERSION_INVALID'::text); end if;
 if profile not in ('load','soak','overload') then reasons:=reasons||to_jsonb('PROFILE_INVALID'::text); end if;
 if coalesce(p_report->>'buildId','')='' then reasons:=reasons||to_jsonb('BUILD_ID_MISSING'::text); end if;
 if coalesce(p_report->>'runnerRevision','')='' then reasons:=reasons||to_jsonb('RUNNER_REVISION_MISSING'::text); end if;
 if coalesce(p_report->>'scenarioSha256','') !~ '^[0-9a-fA-F]{64}$' then reasons:=reasons||to_jsonb('SCENARIO_SHA_INVALID'::text); end if;
 if coalesce(p_report->>'evidenceSha256','') !~ '^[0-9a-fA-F]{64}$' then reasons:=reasons||to_jsonb('EVIDENCE_SHA_INVALID'::text); end if;
 if nullif(p_report#>>'{serverMetrics,source}','') is null or nullif(p_report#>>'{serverMetrics,sourceRevision}','') is null then reasons:=reasons||to_jsonb('SERVER_METRICS_SOURCE_REQUIRED'::text); end if;
 if dbpct is null then reasons:=reasons||to_jsonb('DB_POOL_METRIC_REQUIRED'::text); end if;
 if memgrowth is null then reasons:=reasons||to_jsonb('SERVER_MEMORY_METRIC_REQUIRED'::text); end if;
 if profile='load' then min_duration:=cfg.load_min_duration_seconds;min_requests:=cfg.load_min_requests;min_vus:=cfg.load_min_peak_vus;max_mem:=cfg.load_max_memory_growth_pct;
 elsif profile='soak' then min_duration:=cfg.soak_min_duration_seconds;min_requests:=cfg.soak_min_requests;min_vus:=cfg.soak_min_peak_vus;max_mem:=cfg.soak_max_memory_growth_pct;
 else min_duration:=cfg.overload_min_duration_seconds;min_requests:=cfg.overload_min_requests;min_vus:=cfg.overload_min_peak_vus;max_mem:=100; end if;
 if duration_s<min_duration then reasons:=reasons||to_jsonb('DURATION_TOO_SHORT'::text); end if;
 if reqs<min_requests then reasons:=reasons||to_jsonb('REQUEST_VOLUME_TOO_LOW'::text); end if;
 if vus<min_vus then reasons:=reasons||to_jsonb('PEAK_VUS_TOO_LOW'::text); end if;
 if profile in ('load','soak') then
   if err>cfg.max_error_rate then reasons:=reasons||to_jsonb('ERROR_RATE_TOO_HIGH'::text); end if;
   if p95>cfg.max_p95_ms then reasons:=reasons||to_jsonb('P95_TOO_HIGH'::text); end if;
   if p99>cfg.max_p99_ms then reasons:=reasons||to_jsonb('P99_TOO_HIGH'::text); end if;
   if dbpct is null or dbpct>cfg.max_db_pool_pct then reasons:=reasons||to_jsonb('DB_POOL_TOO_HIGH_OR_MISSING'::text); end if;
   if memgrowth is null or memgrowth>max_mem then reasons:=reasons||to_jsonb('MEMORY_GROWTH_TOO_HIGH_OR_MISSING'::text); end if;
   foreach scenario in array array['login','cloudSave','economy','pvp','event'] loop
     if coalesce((counts->>scenario)::integer,0)<cfg.required_scenario_requests then reasons:=reasons||to_jsonb(('SCENARIO_COVERAGE_'||upper(scenario))::text); end if;
   end loop;
 else
   if coalesce((deg->>'activated')::boolean,false) is not true then reasons:=reasons||to_jsonb('AUTO_DEGRADE_NOT_ACTIVATED'::text); end if;
   if coalesce((deg->>'recovered')::boolean,false) is not true then reasons:=reasons||to_jsonb('AUTO_DEGRADE_NOT_RECOVERED'::text); end if;
   if coalesce((deg->>'recoverySeconds')::integer,999999)>cfg.max_recovery_seconds then reasons:=reasons||to_jsonb('AUTO_DEGRADE_RECOVERY_TOO_SLOW'::text); end if;
   if coalesce(deg->>'finalMode','')<>'normal' or coalesce(deg->>'finalCircuit','')<>'closed' then reasons:=reasons||to_jsonb('RELIABILITY_NOT_NORMAL_AFTER_OVERLOAD'::text); end if;
 end if;
 if coalesce((integ->>'transactionDuplicates')::integer,999999)<>0 then reasons:=reasons||to_jsonb('TRANSACTION_DUPLICATES'::text); end if;
 if coalesce((integ->>'unexplainedDeltas')::integer,999999)<>0 then reasons:=reasons||to_jsonb('UNEXPLAINED_DELTAS'::text); end if;
 if coalesce((integ->>'orphanEffects')::integer,999999)<>0 then reasons:=reasons||to_jsonb('ORPHAN_EFFECTS'::text); end if;
 if coalesce((integ->>'unresolvedSaveConflicts')::integer,999999)<>0 then reasons:=reasons||to_jsonb('UNRESOLVED_SAVE_CONFLICTS'::text); end if;
 return jsonb_build_object('pass',jsonb_array_length(reasons)=0,'profile',profile,'channel',c,'reasons',reasons,
  'thresholds',jsonb_build_object('minDurationSeconds',min_duration,'minRequests',min_requests,'minPeakVUs',min_vus,'maxErrorRate',cfg.max_error_rate,'maxP95Ms',cfg.max_p95_ms,'maxP99Ms',cfg.max_p99_ms,'maxDbPoolPct',cfg.max_db_pool_pct,'maxMemoryGrowthPct',max_mem,'requiredScenarioRequests',cfg.required_scenario_requests,'maxRecoverySeconds',cfg.max_recovery_seconds));
exception when others then
 return jsonb_build_object('pass',false,'profile',profile,'channel',c,'reasons',jsonb_build_array('VALIDATION_ERROR'),'error',left(sqlerrm,240));
end$$;

create or replace function public.powder_load_soak_ingest_v20140(p_report jsonb,p_actor text default 'external-runner')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb; row_id bigint; c text:=case when p_report->>'channel'='staging' then 'staging' else 'production' end;
begin
 v:=public.powder_load_soak_validate_report_v20140(p_report);
 if coalesce(p_report->>'evidenceSha256','') !~ '^[0-9a-fA-F]{64}$' then raise exception 'LOADSOAK_20140_EVIDENCE_SHA_INVALID'; end if;
 if coalesce(p_report->>'scenarioSha256','') !~ '^[0-9a-fA-F]{64}$' then raise exception 'LOADSOAK_20140_SCENARIO_SHA_INVALID'; end if;
 insert into public.load_soak_evidence_v20140(channel,build_id,profile,runner_revision,scenario_sha256,evidence_sha256,started_at,completed_at,duration_seconds,total_requests,peak_vus,error_rate,p50_ms,p95_ms,p99_ms,throughput_rps,max_db_pool_pct,server_memory_start_mb,server_memory_end_mb,server_memory_growth_pct,scenario_counts,integrity,degrade,metrics_source,metrics_source_revision,calculated_pass,failure_reasons,report,ingested_by)
 values(c,left(coalesce(p_report->>'buildId',''),180),lower(coalesce(p_report->>'profile','')),left(coalesce(p_report->>'runnerRevision',''),180),lower(p_report->>'scenarioSha256'),lower(p_report->>'evidenceSha256'),(p_report->>'startedAt')::timestamptz,(p_report->>'completedAt')::timestamptz,coalesce((p_report->>'durationSeconds')::integer,0),coalesce((p_report->>'totalRequests')::bigint,0),coalesce((p_report->>'peakVUs')::integer,0),coalesce((p_report#>>'{metrics,errorRate}')::numeric,1),coalesce((p_report#>>'{metrics,p50Ms}')::numeric,0),coalesce((p_report#>>'{metrics,p95Ms}')::numeric,0),coalesce((p_report#>>'{metrics,p99Ms}')::numeric,0),coalesce((p_report#>>'{metrics,throughputRps}')::numeric,0),nullif(p_report#>>'{serverMetrics,maxDbPoolPct}','')::numeric,nullif(p_report#>>'{serverMetrics,memoryStartMb}','')::numeric,nullif(p_report#>>'{serverMetrics,memoryEndMb}','')::numeric,nullif(p_report#>>'{serverMetrics,memoryGrowthPct}','')::numeric,coalesce(p_report->'scenarioCounts','{}'::jsonb),coalesce(p_report->'integrity','{}'::jsonb),coalesce(p_report->'degrade','{}'::jsonb),left(coalesce(p_report#>>'{serverMetrics,source}',''),180),left(coalesce(p_report#>>'{serverMetrics,sourceRevision}',''),180),coalesce((v->>'pass')::boolean,false),coalesce(v->'reasons','[]'::jsonb),p_report,left(coalesce(p_actor,'external-runner'),200))
 on conflict(evidence_sha256) do update set report=excluded.report,calculated_pass=excluded.calculated_pass,failure_reasons=excluded.failure_reasons,ingested_at=now(),ingested_by=excluded.ingested_by returning id into row_id;
 insert into public.load_soak_audit_v20140(channel,action,details,actor) values(c,'evidence_ingested',jsonb_build_object('id',row_id,'profile',p_report->>'profile','buildId',p_report->>'buildId','calculatedPass',v->'pass','evidenceSha256',p_report->>'evidenceSha256','reasons',v->'reasons'),left(coalesce(p_actor,''),200));
 return jsonb_build_object('ok',true,'id',row_id,'validation',v,'serverCalculatedPass',coalesce((v->>'pass')::boolean,false));
end$$;


create or replace function public.powder_load_soak_sandbox_increment_v20140(p_run_id text,p_slot integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rid text:=left(trim(coalesce(p_run_id,'')),120);sl integer:=greatest(0,least(255,coalesce(p_slot,0)));v bigint;
begin
 if length(rid)<8 then raise exception 'LOADSOAK_20140_RUN_ID_INVALID'; end if;
 insert into public.load_soak_sandbox_v20140(run_id,slot,value,updated_at) values(rid,sl,1,now())
 on conflict(run_id,slot) do update set value=public.load_soak_sandbox_v20140.value+1,updated_at=now() returning value into v;
 return jsonb_build_object('ok',true,'runId',rid,'slot',sl,'value',v);
end$$;

create or replace function public.powder_load_soak_sandbox_state_v20140(p_run_id text,p_cleanup boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rid text:=left(trim(coalesce(p_run_id,'')),120);total bigint:=0;slots integer:=0;
begin
 select coalesce(sum(value),0),count(*) into total,slots from public.load_soak_sandbox_v20140 where run_id=rid;
 if coalesce(p_cleanup,false) then delete from public.load_soak_sandbox_v20140 where run_id=rid; end if;
 return jsonb_build_object('ok',true,'runId',rid,'total',total,'slots',slots,'cleaned',coalesce(p_cleanup,false));
end$$;

create or replace function public.powder_load_soak_db_metrics_v20140()
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare active_conn integer:=0;all_conn integer:=0;max_conn integer:=0;used numeric:=0;
begin
 select count(*) filter(where pid<>pg_backend_pid()),count(*) into active_conn,all_conn from pg_stat_activity;
 max_conn:=coalesce(nullif(current_setting('max_connections',true),''),'100')::integer;
 used:=round((all_conn::numeric/greatest(max_conn,1))*100,2);
 return jsonb_build_object('version','20.14.0','activeConnections',active_conn,'allConnections',all_conn,'maxConnections',max_conn,'dbPoolPct',used,'at',now());
exception when others then return jsonb_build_object('version','20.14.0','error',left(sqlerrm,200),'dbPoolPct',null,'at',now());
end$$;

create or replace function public.powder_load_soak_posture_v20140(p_channel text default 'production',p_build text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c text:=case when p_channel='staging' then 'staging' else 'production' end; cfg public.load_soak_config_v20140;
 l public.load_soak_evidence_v20140;s public.load_soak_evidence_v20140;o public.load_soak_evidence_v20140;
 obs jsonb:='{}'::jsonb;rel jsonb:='{}'::jsonb;recon jsonb:='{}'::jsonb; ttl interval;ready boolean:=false;
begin
 select * into cfg from public.load_soak_config_v20140 where channel=c; ttl:=make_interval(days=>coalesce(cfg.evidence_ttl_days,7));
 select * into l from public.load_soak_evidence_v20140 where channel=c and build_id=p_build and profile='load' and calculated_pass=true and completed_at>=now()-ttl order by completed_at desc limit 1;
 select * into s from public.load_soak_evidence_v20140 where channel=c and build_id=p_build and profile='soak' and calculated_pass=true and completed_at>=now()-ttl order by completed_at desc limit 1;
 select * into o from public.load_soak_evidence_v20140 where channel=c and build_id=p_build and profile='overload' and calculated_pass=true and completed_at>=now()-ttl order by completed_at desc limit 1;
 begin obs:=public.powder_observability_health_v2020(c,p_build,30); exception when others then obs:=jsonb_build_object('healthy',false,'error',sqlerrm); end;
 begin rel:=public.powder_reliability_snapshot_v2080(c,p_build); exception when others then rel:=jsonb_build_object('healthy',false,'error',sqlerrm); end;
 begin recon:=public.powder_reconciliation_posture_v20120(); exception when others then recon:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 ready:=coalesce(cfg.enabled,false) and l.id is not null and s.id is not null and o.id is not null and coalesce((obs->>'healthy')::boolean,false) and coalesce((rel->>'healthy')::boolean,false) and coalesce(rel#>>'{state,mode}','')='normal' and coalesce(rel#>>'{state,circuit_state}','')='closed' and coalesce((recon->>'ready')::boolean,false);
 return jsonb_build_object('version','20.14.0','channel',c,'buildId',p_build,'ready',ready,'enabled',coalesce(cfg.enabled,false),'ttlDays',coalesce(cfg.evidence_ttl_days,7),
  'checks',jsonb_build_object('load',l.id is not null,'soak',s.id is not null,'overloadRecovery',o.id is not null,'observabilityHealthy',coalesce((obs->>'healthy')::boolean,false),'reliabilityNormal',coalesce((rel->>'healthy')::boolean,false) and coalesce(rel#>>'{state,mode}','')='normal' and coalesce(rel#>>'{state,circuit_state}','')='closed','reconciliationClean',coalesce((recon->>'ready')::boolean,false)),
  'load',case when l.id is null then null else to_jsonb(l)-'report' end,'soak',case when s.id is null then null else to_jsonb(s)-'report' end,'overload',case when o.id is null then null else to_jsonb(o)-'report' end,'observability',obs,'reliability',rel,'reconciliation',recon,'config',to_jsonb(cfg),'checkedAt',now());
end$$;

create or replace function public.powder_load_soak_set_enabled_v20140(p_channel text,p_enabled boolean,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;
begin
 update public.load_soak_config_v20140 set enabled=coalesce(p_enabled,false),updated_at=now(),updated_by=left(coalesce(p_actor,''),200) where channel=c;
 insert into public.load_soak_audit_v20140(channel,action,details,actor) values(c,'config_enabled',jsonb_build_object('enabled',coalesce(p_enabled,false)),left(coalesce(p_actor,''),200));
 return jsonb_build_object('ok',true,'channel',c,'enabled',coalesce(p_enabled,false));
end$$;

-- 20.14 Official Launch gate: all 20.13 gates plus fresh server-calculated Load + Soak + Overload/Recovery evidence.
create or replace function public.powder_official_launch_preflight_v20140(
 p_channel text default 'production',p_build text default 'powder-20.14.0-production-load-soak-testing',p_manifest_hash text default ''
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare
 c text:=case when p_channel='staging' then 'staging' else 'production' end;
 b public.release_builds;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;
 integ jsonb:='{}'::jsonb;sec jsonb:='{}'::jsonb;rec jsonb:='{}'::jsonb;rel jsonb:='{}'::jsonb;txp jsonb:='{}'::jsonb;mut jsonb:='{}'::jsonb;adp jsonb:='{}'::jsonb;recon jsonb:='{}'::jsonb;abuse jsonb:='{}'::jsonb;loadsoak jsonb:='{}'::jsonb;
 active_pilot int:=0;recent_pilot int:=0;pvp_matches bigint:=0;crashes bigint:=0;low_fps int:=0;save_bad int:=0;pilot_critical int:=0;pilot_high int:=0;ops_critical int:=0;ops_high int:=0;evidence_pass int:=0;
 candidate_ok boolean:=false;integrity_ok boolean:=false;security_ok boolean:=false;recovery_ok boolean:=false;transaction_ok boolean:=false;mutation_ok boolean:=false;adapter_ok boolean:=false;recon_ok boolean:=false;abuse_ok boolean:=false;load_ok boolean:=false;pilot_ok boolean:=false;rollout_ok boolean:=false;evidence_ok boolean:=false;incidents_ok boolean:=false;observability_ok boolean:=false;reliability_ok boolean:=false;rollback_ok boolean:=false;auth_ok boolean:=false;window_ok boolean:=false;ready boolean:=false;
begin
 select * into ch from public.release_channels where channel=c;select * into ro from public.release_rollout_v1950 where channel=c;select * into b from public.release_builds where channel=c and build_id=p_build limit 1;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build;
 begin integ:=public.powder_integrity_snapshot_v1960(); exception when others then integ:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin sec:=public.powder_security_posture_v2030(); exception when others then sec:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin rec:=public.powder_recovery_posture_v2040(c,p_build); exception when others then rec:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin rel:=public.powder_reliability_snapshot_v2080(c,p_build); exception when others then rel:=jsonb_build_object('healthy',false,'error',sqlerrm); end;
 begin txp:=public.powder_transaction_posture_v2090(); exception when others then txp:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin mut:=public.powder_mutation_posture_v20100(); exception when others then mut:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin adp:=public.powder_mutation_adapter_posture_v20110(); exception when others then adp:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin recon:=public.powder_reconciliation_posture_v20120(); exception when others then recon:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin abuse:=public.powder_mutation_abuse_posture_v20130(); exception when others then abuse:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 begin loadsoak:=public.powder_load_soak_posture_v20140(c,p_build); exception when others then loadsoak:=jsonb_build_object('ready',false,'error',sqlerrm); end;
 select count(*) into active_pilot from public.pilot_cohort_v1970 where active=true;
 select count(distinct d.user_id),coalesce(sum(d.pvp_matches),0),coalesce(sum(d.crash_count),0),count(*) filter(where d.avg_fps>0 and d.avg_fps<30),count(*) filter(where coalesce((d.last_summary->>'savePass')::boolean,true)=false) into recent_pilot,pvp_matches,crashes,low_fps,save_bad from public.pilot_device_health_v1970 d join public.pilot_cohort_v1970 p on p.user_id=d.user_id and p.active=true where d.last_seen_at>=now()-interval '7 days';
 select count(*) filter(where i.severity='critical'),count(*) filter(where i.severity='high') into pilot_critical,pilot_high from public.pilot_issue_reports_v1970 i join public.pilot_cohort_v1970 p on p.user_id=i.user_id and p.active=true where i.status in ('open','triaged');
 select count(*) filter(where severity='critical'),count(*) filter(where severity='high') into ops_critical,ops_high from public.official_incidents_v2010 where channel=c and status in ('open','monitoring');
 select count(*) into evidence_pass from public.official_launch_evidence_v2000 e where e.channel=c and e.build_id=p_build and e.status='pass' and e.check_key in ('load_1960','recovery_1940','polish_1980','freeze_1990') and (p_manifest_hash='' or e.manifest_hash=p_manifest_hash) and e.evidence_sha256~'^[0-9a-fA-F]{64}$';
 candidate_ok:=b.build_id is not null and b.version='20.14.0' and b.status in ('candidate','active') and b.checksum~'^[0-9a-fA-F]{64}$';
 integrity_ok:=coalesce((integ->>'ready')::boolean,false);security_ok:=coalesce((sec->>'ready')::boolean,false);recovery_ok:=coalesce((rec->>'ready')::boolean,false);transaction_ok:=coalesce((txp->>'ready')::boolean,false);mutation_ok:=coalesce((mut->>'ready')::boolean,false);adapter_ok:=coalesce((adp->>'ready')::boolean,false);recon_ok:=coalesce((recon->>'ready')::boolean,false);abuse_ok:=coalesce((abuse->>'ready')::boolean,false);load_ok:=coalesce((loadsoak->>'ready')::boolean,false);
 pilot_ok:=active_pilot between 20 and 50 and recent_pilot>=20 and pvp_matches>=20 and crashes=0 and low_fps=0 and save_bad=0 and pilot_critical=0 and pilot_high=0;rollout_ok:=coalesce(ro.emergency_mode,'normal')='normal' and coalesce(ch.hard_maintenance,false)=false;evidence_ok:=evidence_pass=4;incidents_ok:=ops_critical=0 and ops_high=0;observability_ok:=exists(select 1 from public.observability_config_v2020 o where o.channel=c and o.enabled=true and o.min_requests>=20);reliability_ok:=coalesce((rel->>'healthy')::boolean,false) and coalesce(rel->'state'->>'mode','normal')='normal' and coalesce(rel->'state'->>'circuit_state','closed')='closed';rollback_ok:=auth.rollback_target_build<>'' and ro.rollback_target_build=auth.rollback_target_build and auth.rollback_target_build<>p_build and exists(select 1 from public.release_builds rb where rb.channel=c and rb.build_id=auth.rollback_target_build and rb.checksum~'^[0-9a-fA-F]{64}$');auth_ok:=auth.status='armed' and auth.manifest_hash=p_manifest_hash and auth.artifact_checksum=b.checksum;window_ok:=auth.window_start is not null and auth.window_end is not null and now() between auth.window_start and auth.window_end;
 ready:=candidate_ok and integrity_ok and security_ok and recovery_ok and transaction_ok and mutation_ok and adapter_ok and recon_ok and abuse_ok and load_ok and pilot_ok and rollout_ok and evidence_ok and incidents_ok and observability_ok and reliability_ok and rollback_ok and auth_ok and window_ok;
 return jsonb_build_object('version','20.14.0','channel',c,'buildId',p_build,'manifestHash',p_manifest_hash,'ready',ready,
  'checks',jsonb_build_object('candidate',candidate_ok,'integrity',integrity_ok,'securityPosture',security_ok,'recovery',recovery_ok,'transactionIntegrity',transaction_ok,'serverMutationIntegration',mutation_ok,'canonicalMutationAdapters',adapter_ok,'reconciliationClean',recon_ok,'economyRewardExploitHardening',abuse_ok,'productionLoadSoak',load_ok,'realPilot',pilot_ok,'rolloutNormal',rollout_ok,'evidence4of4',evidence_ok,'liveOpsIncidents',incidents_ok,'observabilityArmed',observability_ok,'reliabilityNormal',reliability_ok,'rollbackPinned',rollback_ok,'authorizationArmed',auth_ok,'changeWindowOpen',window_ok),
  'candidate',case when b.build_id is null then null else to_jsonb(b) end,'release',case when ch.channel is null then null else to_jsonb(ch) end,'rollout',case when ro.channel is null then null else to_jsonb(ro) end,'authorization',case when auth.build_id is null then null else to_jsonb(auth) end,'integrity',integ,'security',sec,'recovery',rec,'reliability',rel,'transactions',txp,'serverMutations',mut,'canonicalAdapters',adp,'reconciliation',recon,'antiAbuse',abuse,'loadSoak',loadsoak,'pilot',jsonb_build_object('activePilot',active_pilot,'recentPilot7d',recent_pilot,'pvpMatches',pvp_matches,'crashes',crashes,'lowFpsDevices',low_fps,'saveBadDevices',save_bad,'openCritical',pilot_critical,'openHigh',pilot_high),'liveOps',jsonb_build_object('openCritical',ops_critical,'openHigh',ops_high,'blockers',ops_critical+ops_high),'evidencePass',evidence_pass,'checkedAt',now());
end $function$;

create or replace function public.powder_official_activate_canary_v20140(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;target public.release_builds;auth public.official_release_authorization_v2070;nowts timestamptz:=now();
begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20140:'||c,0));pf:=public.powder_official_launch_preflight_v20140(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20140_PREFLIGHT_NOT_READY';end if;
 select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into target from public.release_builds where channel=c and build_id=p_build for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;
 if target.version<>'20.14.0' then raise exception 'OFFICIAL_20140_CANDIDATE_INVALID';end if;if ch.build_id=p_build then raise exception 'OFFICIAL_20140_ALREADY_ACTIVE';end if;if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_20140_AUTH_NOT_ARMED';end if;if auth.rollback_target_build<>ch.build_id or ro.rollback_target_build<>ch.build_id then raise exception 'OFFICIAL_20140_ROLLBACK_TARGET_DRIFT';end if;
 update public.release_builds set status='rolled_back' where channel=c and build_id=ch.build_id;update public.release_builds set status='active',activated_at=nowts where channel=c and build_id=p_build;update public.release_channels set current_version=target.version,build_id=target.build_id,asset_epoch=coalesce(asset_epoch,0)+1,updated_at=nowts,updated_by=p_admin where channel=c;update public.release_rollout_v1950 set rollout_percent=5,emergency_mode='normal',emergency_message='',updated_at=nowts,updated_by=p_admin where channel=c;delete from public.official_rollout_server_evidence_v2070 where channel=c and build_id=p_build;
 insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_canary_5_v20140',target.version,target.build_id,ch.current_version,jsonb_build_object('manifestHash',p_manifest_hash,'rollbackTarget',auth.rollback_target_build,'authorizationRevision',auth.revision,'loadSoak','20.14.0','antiAbuse','20.13.0','automaticResourceReplay',false),p_admin,nowts);
 return jsonb_build_object('ok',true,'channel',c,'version',target.version,'buildId',target.build_id,'rolloutPercent',5,'previousBuildId',ch.build_id,'at',nowts);
end $function$;

create or replace function public.powder_official_advance_rollout_v20140(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;cur smallint;nxt smallint;nowts timestamptz:=now();
begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20140:'||c,0));pf:=public.powder_official_launch_preflight_v20140(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20140_PREFLIGHT_NOT_READY';end if;select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;if ch.build_id<>p_build or ch.current_version<>'20.14.0' then raise exception 'OFFICIAL_20140_BUILD_NOT_ACTIVE';end if;if auth.status<>'armed' or nowts not between auth.window_start and auth.window_end then raise exception 'OFFICIAL_20140_AUTH_WINDOW_CLOSED';end if;cur:=ro.rollout_percent;nxt:=case cur when 5 then 20 when 20 then 50 when 50 then 100 else null end;if nxt is null then raise exception 'OFFICIAL_20140_STAGE_NOT_ADVANCEABLE';end if;if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=cur and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_20140_SERVER_HEALTH_NOT_PASSED';end if;
 update public.release_rollout_v1950 set rollout_percent=nxt,updated_at=nowts,updated_by=p_admin where channel=c;insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_rollout_'||nxt::text||'_v20140',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('fromPercent',cur,'toPercent',nxt,'manifestHash',p_manifest_hash,'healthSource','server-observability+transaction-integrity+canonical-adapters+reconciliation+anti-abuse+load-soak'),p_admin,nowts);return jsonb_build_object('ok',true,'channel',c,'buildId',p_build,'fromPercent',cur,'rolloutPercent',nxt,'at',nowts);
end $function$;

create or replace function public.powder_official_finalize_live_v20140(p_channel text,p_build text,p_manifest_hash text,p_admin text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pf jsonb;ch public.release_channels;ro public.release_rollout_v1950;auth public.official_release_authorization_v2070;nowts timestamptz:=now();
begin
 perform pg_advisory_xact_lock(hashtextextended('official-launch-v20140:'||c,0));pf:=public.powder_official_launch_preflight_v20140(c,p_build,p_manifest_hash);if coalesce((pf->>'ready')::boolean,false) is not true then raise exception 'OFFICIAL_20140_PREFLIGHT_NOT_READY';end if;select * into ch from public.release_channels where channel=c for update;select * into ro from public.release_rollout_v1950 where channel=c for update;select * into auth from public.official_release_authorization_v2070 where channel=c and build_id=p_build for update;if ch.build_id<>p_build or ch.current_version<>'20.14.0' then raise exception 'OFFICIAL_20140_BUILD_NOT_ACTIVE';end if;if ro.rollout_percent<>100 then raise exception 'OFFICIAL_20140_ROLLOUT_NOT_100';end if;if not exists(select 1 from public.official_rollout_server_evidence_v2070 e where e.channel=c and e.build_id=p_build and e.rollout_percent=100 and e.status='pass' and e.checked_at>=now()-interval '6 hours') then raise exception 'OFFICIAL_20140_FINAL_HEALTH_NOT_PASSED';end if;
 update public.launch_config_v170 set launch_status='live',content_frozen=true,registration_open=true,updated_by=p_admin,updated_at=nowts where id=1;update public.official_release_authorization_v2070 set status='consumed',consumed_at=nowts,updated_at=nowts,updated_by=p_admin where channel=c and build_id=p_build;insert into public.release_deployments(channel,action,version,build_id,previous_version,details,created_by,created_at) values(c,'official_live_v20140',ch.current_version,ch.build_id,ch.current_version,jsonb_build_object('rolloutPercent',100,'manifestHash',p_manifest_hash,'authorizationRevision',auth.revision,'healthSource','server-observability+transaction-integrity+canonical-adapters+reconciliation+anti-abuse+load-soak'),p_admin,nowts);return jsonb_build_object('ok',true,'official',true,'channel',c,'version',ch.current_version,'buildId',ch.build_id,'rolloutPercent',100,'at',nowts);
end $function$;

revoke all on function public.powder_load_soak_validate_report_v20140(jsonb) from public,anon,authenticated;
revoke all on function public.powder_load_soak_ingest_v20140(jsonb,text) from public,anon,authenticated;
revoke all on function public.powder_load_soak_sandbox_increment_v20140(text,integer) from public,anon,authenticated;
revoke all on function public.powder_load_soak_sandbox_state_v20140(text,boolean) from public,anon,authenticated;
revoke all on function public.powder_load_soak_db_metrics_v20140() from public,anon,authenticated;
revoke all on function public.powder_load_soak_posture_v20140(text,text) from public,anon,authenticated;
revoke all on function public.powder_load_soak_set_enabled_v20140(text,boolean,text) from public,anon,authenticated;
revoke all on function public.powder_official_launch_preflight_v20140(text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_activate_canary_v20140(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_advance_rollout_v20140(text,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_official_finalize_live_v20140(text,text,text,text) from public,anon,authenticated;
grant execute on function public.powder_load_soak_validate_report_v20140(jsonb) to service_role;
grant execute on function public.powder_load_soak_ingest_v20140(jsonb,text) to service_role;
grant execute on function public.powder_load_soak_sandbox_increment_v20140(text,integer) to service_role;
grant execute on function public.powder_load_soak_sandbox_state_v20140(text,boolean) to service_role;
grant execute on function public.powder_load_soak_db_metrics_v20140() to service_role;
grant execute on function public.powder_load_soak_posture_v20140(text,text) to service_role;
grant execute on function public.powder_load_soak_set_enabled_v20140(text,boolean,text) to service_role;
grant execute on function public.powder_official_launch_preflight_v20140(text,text,text) to service_role;
grant execute on function public.powder_official_activate_canary_v20140(text,text,text,text) to service_role;
grant execute on function public.powder_official_advance_rollout_v20140(text,text,text,text) to service_role;
grant execute on function public.powder_official_finalize_live_v20140(text,text,text,text) to service_role;
