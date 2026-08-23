-- Powder 20.19.0 · Release Candidate / Canary evidence and stage policy
begin;

create table if not exists public.release_candidate_config_v20190(
  id smallint primary key default 1 check(id=1),
  enabled boolean not null default false,
  evidence_max_age_hours int not null default 168 check(evidence_max_age_hours between 1 and 336),
  rollback_drill_max_age_hours int not null default 168 check(rollback_drill_max_age_hours between 1 and 336),
  updated_at timestamptz not null default now(),updated_by text not null default ''
);
insert into public.release_candidate_config_v20190(id) values(1) on conflict(id) do nothing;

create table if not exists public.release_candidate_evidence_v20190(
  id bigserial primary key,channel text not null default 'production',build_id text not null,manifest_hash text not null,
  artifact_sha256 text not null,automated_checks jsonb not null default '{}'::jsonb,manual_checks jsonb not null default '{}'::jsonb,
  critical_count int not null default 0,high_count int not null default 0,automated_pass boolean not null default false,
  manual_pass boolean not null default false,pass boolean not null default false,evidence_sha256 text not null,
  runner_revision text not null default '',created_at timestamptz not null default now(),created_by text not null default ''
);
create index if not exists release_candidate_evidence_v20190_build_idx on public.release_candidate_evidence_v20190(channel,build_id,created_at desc);

create table if not exists public.release_canary_state_v20190(
  channel text not null,build_id text not null,manifest_hash text not null,artifact_sha256 text not null,
  rollout_percent smallint not null check(rollout_percent in(5,20,50,100)),stage_started_at timestamptz not null default now(),
  finalized_at timestamptz,updated_at timestamptz not null default now(),updated_by text not null default '',primary key(channel,build_id)
);

create table if not exists public.release_canary_stage_evidence_v20190(
  channel text not null,build_id text not null,manifest_hash text not null,artifact_sha256 text not null,
  rollout_percent smallint not null check(rollout_percent in(5,20,50,100)),status text not null check(status in('pass','hold')),
  health jsonb not null default '{}'::jsonb,policy jsonb not null default '{}'::jsonb,checked_at timestamptz not null default now(),
  checked_by text not null default 'server',primary key(channel,build_id,rollout_percent)
);

create table if not exists public.release_canary_rollback_drills_v20190(
  id bigserial primary key,channel text not null default 'production',source_build text not null,target_build text not null,
  artifact_sha256 text not null,manifest_hash text not null,duration_seconds int not null default 0,
  data_integrity_pass boolean not null default false,post_rollback_health_pass boolean not null default false,
  pass boolean not null default false,evidence_sha256 text not null,runner_revision text not null default '',
  created_at timestamptz not null default now(),created_by text not null default 'ci'
);
create index if not exists release_canary_rollback_drills_v20190_build_idx on public.release_canary_rollback_drills_v20190(channel,source_build,created_at desc);

create or replace function public.powder_release_candidate_record_v20190(
 p_channel text,p_build text,p_manifest_hash text,p_artifact_sha256 text,p_automated jsonb,p_manual jsonb,
 p_critical int,p_high int,p_evidence_sha256 text,p_runner_revision text,p_actor text default 'ci'
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;
 auto_required text[]:=array['powDex99','skills396','rank7','roleCoverage99','equipment13x4','artifacts49','learningBank','adventure12Islands','gachaRatesGuard','coreSubsystemEntrypoints','combatFreeze22','transactionRuntime','canonicalAdapterRegression','reconciliationRuntime','securityRuntime','saveIntegrityRuntime'];
 manual_required text[]:=array['homeAndNavigation','learningFlow','powDexInventory','gachaFlow','equipmentArtifactFlow','pveFlow','pvpFlow','bossFlow','eventAndMailReward','rankPromotion','cloudSaveConflict','adminSmoke','fpsSmoke'];
 k text;auto_ok boolean:=true;manual_ok boolean:=true;crit int:=greatest(0,coalesce(p_critical,0));hi int:=greatest(0,coalesce(p_high,0));final_ok boolean;rid bigint;
begin
 if p_build<>'powder-20.19.0-release-candidate-canary' then raise exception 'RC20190_BUILD_MISMATCH';end if;
 if p_manifest_hash!~'^[0-9a-fA-F]{16,64}$' or p_artifact_sha256!~'^[0-9a-fA-F]{64}$' or p_evidence_sha256!~'^[0-9a-fA-F]{64}$' then raise exception 'RC20190_HASH_INVALID';end if;
 foreach k in array auto_required loop if coalesce((p_automated->>k)::boolean,false) is not true then auto_ok:=false;end if;end loop;
 foreach k in array manual_required loop if coalesce((p_manual->>k)::boolean,false) is not true then manual_ok:=false;end if;end loop;
 final_ok:=auto_ok and manual_ok and crit=0 and hi=0;
 insert into public.release_candidate_evidence_v20190(channel,build_id,manifest_hash,artifact_sha256,automated_checks,manual_checks,critical_count,high_count,automated_pass,manual_pass,pass,evidence_sha256,runner_revision,created_by)
 values(c,p_build,lower(p_manifest_hash),lower(p_artifact_sha256),coalesce(p_automated,'{}'::jsonb),coalesce(p_manual,'{}'::jsonb),crit,hi,auto_ok,manual_ok,final_ok,lower(p_evidence_sha256),left(coalesce(p_runner_revision,''),160),left(coalesce(p_actor,'ci'),160)) returning id into rid;
 return jsonb_build_object('ok',true,'id',rid,'automatedPass',auto_ok,'manualPass',manual_ok,'critical',crit,'high',hi,'pass',final_ok,'recordedAt',now());
end $function$;

create or replace function public.powder_canary_rollback_drill_record_v20190(
 p_channel text,p_source_build text,p_target_build text,p_manifest_hash text,p_artifact_sha256 text,p_duration_seconds int,
 p_data_integrity_pass boolean,p_post_rollback_health_pass boolean,p_evidence_sha256 text,p_runner_revision text,p_actor text default 'ci'
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;ok boolean;rid bigint;
begin
 if p_source_build<>'powder-20.19.0-release-candidate-canary' or p_target_build='' or p_target_build=p_source_build then raise exception 'RC20190_ROLLBACK_TARGET_INVALID';end if;
 if p_manifest_hash!~'^[0-9a-fA-F]{16,64}$' or p_artifact_sha256!~'^[0-9a-fA-F]{64}$' or p_evidence_sha256!~'^[0-9a-fA-F]{64}$' then raise exception 'RC20190_ROLLBACK_HASH_INVALID';end if;
 if not exists(select 1 from public.release_builds where channel=c and build_id=p_target_build and checksum~'^[0-9a-fA-F]{64}$') then raise exception 'RC20190_ROLLBACK_BUILD_UNKNOWN';end if;
 ok:=coalesce(p_data_integrity_pass,false) and coalesce(p_post_rollback_health_pass,false) and coalesce(p_duration_seconds,999999) between 1 and 600;
 insert into public.release_canary_rollback_drills_v20190(channel,source_build,target_build,artifact_sha256,manifest_hash,duration_seconds,data_integrity_pass,post_rollback_health_pass,pass,evidence_sha256,runner_revision,created_by)
 values(c,p_source_build,p_target_build,lower(p_artifact_sha256),lower(p_manifest_hash),greatest(0,coalesce(p_duration_seconds,0)),coalesce(p_data_integrity_pass,false),coalesce(p_post_rollback_health_pass,false),ok,lower(p_evidence_sha256),left(coalesce(p_runner_revision,''),160),left(coalesce(p_actor,'ci'),160)) returning id into rid;
 return jsonb_build_object('ok',true,'id',rid,'pass',ok,'durationSeconds',p_duration_seconds,'recordedAt',now());
end $function$;

create or replace function public.powder_release_candidate_posture_v20190(p_channel text default 'production',p_build text default 'powder-20.19.0-release-candidate-canary',p_manifest_hash text default '')
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;cfg public.release_candidate_config_v20190;e public.release_candidate_evidence_v20190;d public.release_canary_rollback_drills_v20190;a public.official_release_authorization_v2070;fresh boolean:=false;drill_fresh boolean:=false;ready boolean:=false;
begin
 select * into cfg from public.release_candidate_config_v20190 where id=1;
 select * into e from public.release_candidate_evidence_v20190 where channel=c and build_id=p_build and (p_manifest_hash='' or manifest_hash=lower(p_manifest_hash)) order by created_at desc limit 1;
 select * into a from public.official_release_authorization_v2070 where channel=c and build_id=p_build;
 select * into d from public.release_canary_rollback_drills_v20190 where channel=c and source_build=p_build and (a.rollback_target_build is null or target_build=a.rollback_target_build) and (p_manifest_hash='' or manifest_hash=lower(p_manifest_hash)) order by created_at desc limit 1;
 fresh:=e.id is not null and e.created_at>=now()-make_interval(hours=>coalesce(cfg.evidence_max_age_hours,168));
 drill_fresh:=d.id is not null and d.created_at>=now()-make_interval(hours=>coalesce(cfg.rollback_drill_max_age_hours,168));
 ready:=coalesce(cfg.enabled,false) and fresh and drill_fresh and coalesce(e.pass,false) and coalesce(e.automated_pass,false) and coalesce(e.manual_pass,false) and coalesce(e.critical_count,1)=0 and coalesce(e.high_count,1)=0 and coalesce(d.pass,false);
 return jsonb_build_object('version','20.19.0','ready',ready,'armed',coalesce(cfg.enabled,false),'fresh',fresh,'rollbackDrillFresh',drill_fresh,'evidence',case when e.id is null then null else to_jsonb(e) end,'rollbackDrill',case when d.id is null then null else to_jsonb(d) end,'checks',jsonb_build_object('automatedRC',coalesce(e.automated_pass,false),'manualSmoke13',coalesce(e.manual_pass,false),'criticalZero',coalesce(e.critical_count,1)=0,'highZero',coalesce(e.high_count,1)=0,'manifestBound',e.id is not null and (p_manifest_hash='' or e.manifest_hash=lower(p_manifest_hash)),'rollbackDrill',coalesce(d.pass,false)),'checkedAt',now());
end $function$;

create or replace function public.powder_canary_stage_health_v20190(p_channel text,p_build text,p_manifest_hash text,p_rollout_percent int)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;pct int:=p_rollout_percent;window_m int;min_req bigint;min_span numeric;max_err numeric;max_p95 numeric;max_p99 numeric;h jsonb;s public.release_canary_state_v20190;b public.release_builds;a public.official_release_authorization_v2070;elapsed numeric:=0;pass boolean:=false;
begin
 if pct not in(5,20,50,100) then raise exception 'RC20190_STAGE_INVALID';end if;
 window_m:=case pct when 5 then 30 when 20 then 60 when 50 then 120 else 180 end;
 min_req:=case pct when 5 then 1000 when 20 then 3000 when 50 then 10000 else 25000 end;
 min_span:=case pct when 5 then 15 when 20 then 30 when 50 then 60 else 120 end;
 max_err:=case pct when 5 then .010 when 20 then .008 when 50 then .005 else .003 end;
 max_p95:=case pct when 5 then 1500 when 20 then 1400 when 50 then 1300 else 1200 end;
 max_p99:=case pct when 5 then 2500 when 20 then 2300 when 50 then 2100 else 2000 end;
 select * into s from public.release_canary_state_v20190 where channel=c and build_id=p_build;
 select * into b from public.release_builds where channel=c and build_id=p_build;
 select * into a from public.official_release_authorization_v2070 where channel=c and build_id=p_build;
 if s.build_id is null or s.rollout_percent<>pct then raise exception 'RC20190_STAGE_NOT_ACTIVE';end if;
 if lower(s.manifest_hash)<>lower(p_manifest_hash) or lower(s.artifact_sha256)<>lower(coalesce(b.checksum,'')) or lower(a.manifest_hash)<>lower(p_manifest_hash) or lower(a.artifact_checksum)<>lower(coalesce(b.checksum,'')) then raise exception 'RC20190_STAGE_BUILD_DRIFT';end if;
 elapsed:=extract(epoch from(now()-s.stage_started_at))/60.0;
 h:=public.powder_rollout_stage_health_v2070(c,p_build,pct,window_m);
 pass:=coalesce((h->>'healthy')::boolean,false) and elapsed>=min_span and coalesce((h->>'requests')::bigint,0)>=min_req and coalesce((h->>'spanMinutes')::numeric,0)>=min_span and coalesce((h->>'errorRate')::numeric,1)<=max_err and coalesce((h->>'p95Ms')::numeric,999999)<=max_p95 and coalesce((h->>'p99Ms')::numeric,999999)<=max_p99 and coalesce((h->>'crashes')::bigint,1)=0 and coalesce((h->>'saveConflicts')::bigint,1)=0;
 return jsonb_build_object('version','20.19.0','channel',c,'buildId',p_build,'manifestHash',lower(p_manifest_hash),'artifactSha256',lower(coalesce(b.checksum,'')),'rolloutPercent',pct,'stageElapsedMinutes',round(elapsed,1),'pass',pass,'health',h,'policy',jsonb_build_object('windowMinutes',window_m,'minRequests',min_req,'minObservedMinutes',min_span,'maxErrorRate',max_err,'maxP95Ms',max_p95,'maxP99Ms',max_p99,'maxCrashes',0,'maxSaveConflicts',0),'checkedAt',now());
end $function$;

create or replace function public.powder_capture_canary_stage_health_v20190(p_channel text,p_build text,p_manifest_hash text,p_rollout_percent int)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;r jsonb;st text;
begin
 r:=public.powder_canary_stage_health_v20190(c,p_build,p_manifest_hash,p_rollout_percent);st:=case when coalesce((r->>'pass')::boolean,false) then 'pass' else 'hold' end;
 insert into public.release_canary_stage_evidence_v20190(channel,build_id,manifest_hash,artifact_sha256,rollout_percent,status,health,policy,checked_at,checked_by)
 values(c,p_build,lower(p_manifest_hash),r->>'artifactSha256',p_rollout_percent,st,coalesce(r->'health','{}'::jsonb),coalesce(r->'policy','{}'::jsonb),now(),'server')
 on conflict(channel,build_id,rollout_percent) do update set manifest_hash=excluded.manifest_hash,artifact_sha256=excluded.artifact_sha256,status=excluded.status,health=excluded.health,policy=excluded.policy,checked_at=excluded.checked_at,checked_by='server';
 return jsonb_build_object('status',st,'result',r);
end $function$;

alter table public.release_candidate_config_v20190 enable row level security;
alter table public.release_candidate_evidence_v20190 enable row level security;
alter table public.release_canary_state_v20190 enable row level security;
alter table public.release_canary_stage_evidence_v20190 enable row level security;
alter table public.release_canary_rollback_drills_v20190 enable row level security;
revoke all on public.release_candidate_config_v20190,public.release_candidate_evidence_v20190,public.release_canary_state_v20190,public.release_canary_stage_evidence_v20190,public.release_canary_rollback_drills_v20190 from public,anon,authenticated;
grant select,insert,update,delete on public.release_candidate_config_v20190,public.release_candidate_evidence_v20190,public.release_canary_state_v20190,public.release_canary_stage_evidence_v20190,public.release_canary_rollback_drills_v20190 to service_role;
grant usage,select on sequence public.release_candidate_evidence_v20190_id_seq,public.release_canary_rollback_drills_v20190_id_seq to service_role;
revoke all on function public.powder_release_candidate_record_v20190(text,text,text,text,jsonb,jsonb,int,int,text,text,text),public.powder_canary_rollback_drill_record_v20190(text,text,text,text,text,int,boolean,boolean,text,text,text),public.powder_release_candidate_posture_v20190(text,text,text),public.powder_canary_stage_health_v20190(text,text,text,int),public.powder_capture_canary_stage_health_v20190(text,text,text,int) from public,anon,authenticated;
grant execute on function public.powder_release_candidate_record_v20190(text,text,text,text,jsonb,jsonb,int,int,text,text,text),public.powder_canary_rollback_drill_record_v20190(text,text,text,text,text,int,boolean,boolean,text,text,text),public.powder_release_candidate_posture_v20190(text,text,text),public.powder_canary_stage_health_v20190(text,text,text,int),public.powder_capture_canary_stage_health_v20190(text,text,text,int) to service_role;

-- New Official Launch actions remain Owner + AAL2 through the 20.16 central guard.
insert into public.admin_security_capabilities_v20160(function_name,action,require_owner,require_aal2)
values('powder-admin-official-launch','capture_stage_health',true,true)
on conflict(function_name,action) do update set require_owner=true,require_aal2=true;

commit;
