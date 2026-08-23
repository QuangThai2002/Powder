-- Powder 20.20.0 · Gold Master immutable artifact evidence and production freeze posture
begin;

create table if not exists public.gold_master_config_v20200(
  id smallint primary key default 1 check(id=1),
  enabled boolean not null default false,
  evidence_max_age_hours int not null default 168 check(evidence_max_age_hours between 1 and 336),
  predecessor_build text not null default 'powder-20.19.0-release-candidate-canary',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.gold_master_config_v20200(id) values(1) on conflict(id) do nothing;

create table if not exists public.gold_master_evidence_v20200(
  id bigserial primary key,
  channel text not null default 'production',
  build_id text not null,
  manifest_hash text not null,
  artifact_sha256 text not null,
  lock_sha256 text not null,
  code_sha256 text not null,
  schema_sha256 text not null,
  api_sha256 text not null,
  assets_sha256 text not null,
  cleanup_pass boolean not null default false,
  automated_pass boolean not null default false,
  gameplay_freeze_pass boolean not null default false,
  critical_count int not null default 0,
  high_count int not null default 0,
  pass boolean not null default false,
  evidence_sha256 text not null,
  runner_revision text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null default 'ci'
);
create index if not exists gold_master_evidence_v20200_build_idx on public.gold_master_evidence_v20200(channel,build_id,created_at desc);

create or replace function public.powder_gold_master_record_v20200(
 p_channel text,p_build text,p_manifest_hash text,p_artifact_sha256 text,p_lock_sha256 text,
 p_code_sha256 text,p_schema_sha256 text,p_api_sha256 text,p_assets_sha256 text,
 p_cleanup_pass boolean,p_automated_pass boolean,p_gameplay_freeze_pass boolean,
 p_critical int,p_high int,p_evidence_sha256 text,p_runner_revision text,p_actor text default 'ci'
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;
 crit int:=greatest(0,coalesce(p_critical,0));hi int:=greatest(0,coalesce(p_high,0));ok boolean;rid bigint;
begin
 if p_build<>'powder-20.20.0-gold-master' then raise exception 'GM20200_BUILD_MISMATCH';end if;
 if p_manifest_hash!~'^[0-9a-fA-F]{16,64}$' then raise exception 'GM20200_MANIFEST_HASH_INVALID';end if;
 if p_artifact_sha256!~'^[0-9a-fA-F]{64}$' or p_lock_sha256!~'^[0-9a-fA-F]{64}$' or
    p_code_sha256!~'^[0-9a-fA-F]{64}$' or p_schema_sha256!~'^[0-9a-fA-F]{64}$' or
    p_api_sha256!~'^[0-9a-fA-F]{64}$' or p_assets_sha256!~'^[0-9a-fA-F]{64}$' or
    p_evidence_sha256!~'^[0-9a-fA-F]{64}$' then raise exception 'GM20200_SHA256_INVALID';end if;
 ok:=coalesce(p_cleanup_pass,false) and coalesce(p_automated_pass,false) and coalesce(p_gameplay_freeze_pass,false) and crit=0 and hi=0;
 insert into public.gold_master_evidence_v20200(channel,build_id,manifest_hash,artifact_sha256,lock_sha256,code_sha256,schema_sha256,api_sha256,assets_sha256,cleanup_pass,automated_pass,gameplay_freeze_pass,critical_count,high_count,pass,evidence_sha256,runner_revision,created_by)
 values(c,p_build,lower(p_manifest_hash),lower(p_artifact_sha256),lower(p_lock_sha256),lower(p_code_sha256),lower(p_schema_sha256),lower(p_api_sha256),lower(p_assets_sha256),coalesce(p_cleanup_pass,false),coalesce(p_automated_pass,false),coalesce(p_gameplay_freeze_pass,false),crit,hi,ok,lower(p_evidence_sha256),left(coalesce(p_runner_revision,''),160),left(coalesce(p_actor,'ci'),160)) returning id into rid;
 return jsonb_build_object('ok',true,'id',rid,'pass',ok,'critical',crit,'high',hi,'recordedAt',now());
end $function$;

create or replace function public.powder_gold_master_posture_v20200(
 p_channel text default 'production',p_build text default 'powder-20.20.0-gold-master',p_manifest_hash text default ''
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;
 cfg public.gold_master_config_v20200;e public.gold_master_evidence_v20200;pred public.release_canary_state_v20190;pred_stage public.release_canary_stage_evidence_v20190;
 fresh boolean:=false;predecessor_ok boolean:=false;ready boolean:=false;
begin
 select * into cfg from public.gold_master_config_v20200 where id=1;
 select * into e from public.gold_master_evidence_v20200 where channel=c and build_id=p_build and (p_manifest_hash='' or manifest_hash=lower(p_manifest_hash)) order by created_at desc limit 1;
 select * into pred from public.release_canary_state_v20190 where channel=c and build_id=cfg.predecessor_build;
 select * into pred_stage from public.release_canary_stage_evidence_v20190 where channel=c and build_id=cfg.predecessor_build and rollout_percent=100;
 fresh:=e.id is not null and e.created_at>=now()-make_interval(hours=>coalesce(cfg.evidence_max_age_hours,168));
 predecessor_ok:=pred.build_id is not null and pred.rollout_percent=100 and pred.finalized_at is not null and pred_stage.status='pass';
 ready:=coalesce(cfg.enabled,false) and fresh and predecessor_ok and coalesce(e.pass,false) and coalesce(e.cleanup_pass,false) and coalesce(e.automated_pass,false) and coalesce(e.gameplay_freeze_pass,false) and coalesce(e.critical_count,1)=0 and coalesce(e.high_count,1)=0;
 return jsonb_build_object('version','20.20.0','ready',ready,'armed',coalesce(cfg.enabled,false),'fresh',fresh,'predecessorBuild',cfg.predecessor_build,'predecessorCanary100',predecessor_ok,'evidence',case when e.id is null then null else to_jsonb(e) end,'checks',jsonb_build_object('artifactBound',e.id is not null and (p_manifest_hash='' or e.manifest_hash=lower(p_manifest_hash)),'cleanup',coalesce(e.cleanup_pass,false),'automated',coalesce(e.automated_pass,false),'gameplayFreeze',coalesce(e.gameplay_freeze_pass,false),'criticalZero',coalesce(e.critical_count,1)=0,'highZero',coalesce(e.high_count,1)=0,'predecessorCanary100',predecessor_ok),'checkedAt',now());
end $function$;

alter table public.gold_master_config_v20200 enable row level security;
alter table public.gold_master_evidence_v20200 enable row level security;
revoke all on public.gold_master_config_v20200,public.gold_master_evidence_v20200 from public,anon,authenticated;
grant select,insert,update,delete on public.gold_master_config_v20200,public.gold_master_evidence_v20200 to service_role;
grant usage,select on sequence public.gold_master_evidence_v20200_id_seq to service_role;
revoke all on function public.powder_gold_master_record_v20200(text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,int,int,text,text,text),public.powder_gold_master_posture_v20200(text,text,text) from public,anon,authenticated;
grant execute on function public.powder_gold_master_record_v20200(text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,int,int,text,text,text),public.powder_gold_master_posture_v20200(text,text,text) to service_role;

insert into public.admin_security_capabilities_v20160(function_name,action,require_owner,require_aal2)
values('powder-admin-official-launch','arm_gold_master',true,true)
on conflict(function_name,action) do update set require_owner=true,require_aal2=true;

commit;
