-- Powder 20.15.0 · Disaster Recovery & Backup Validation
-- Extends the 20.4 recovery posture with isolated real restore evidence that is server-calculated.

begin;

create table if not exists public.disaster_recovery_config_v20150 (
  channel text primary key check (channel in ('production','staging')),
  enabled boolean not null default false,
  target_rpo_minutes integer not null default 360 check (target_rpo_minutes between 1 and 10080),
  target_rto_minutes integer not null default 60 check (target_rto_minutes between 1 and 1440),
  evidence_ttl_days integer not null default 7 check (evidence_ttl_days between 1 and 30),
  require_isolated_restore boolean not null default true,
  require_rollback_drill boolean not null default true,
  required_tables jsonb not null default '["player_saves","player_backups","player_economy","player_pows","tamer_progress","shop_state","daily_login_state","transaction_receipts_v2090","mutation_effect_receipts_v20100","mutation_adapter_dispatch_v20110","resource_effect_ledger_v20120","reconciliation_cases_v20120"]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.disaster_recovery_config_v20150(channel,enabled,target_rpo_minutes,target_rto_minutes,evidence_ttl_days,require_isolated_restore,require_rollback_drill)
values ('production',false,360,60,7,true,true),('staging',false,720,120,14,true,true)
on conflict(channel) do nothing;

create table if not exists public.disaster_recovery_evidence_v20150 (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('production','staging')),
  build_id text not null,
  runner_revision text not null,
  source_identity_sha256 text not null check (source_identity_sha256 ~ '^[0-9a-fA-F]{64}$'),
  restore_identity_sha256 text not null check (restore_identity_sha256 ~ '^[0-9a-fA-F]{64}$'),
  backup_provider text not null,
  backup_artifact_sha256 text not null check (backup_artifact_sha256 ~ '^[0-9a-fA-F]{64}$'),
  backup_size_bytes bigint not null check (backup_size_bytes > 0),
  backup_created_at timestamptz not null,
  incident_cutoff_at timestamptz not null,
  restore_started_at timestamptz not null,
  restore_completed_at timestamptz not null,
  rpo_minutes numeric not null check (rpo_minutes >= 0),
  rto_minutes numeric not null check (rto_minutes >= 0),
  restore_environment text not null,
  isolated_restore boolean not null default false,
  source_read_only boolean not null default false,
  schema_source_sha256 text not null check (schema_source_sha256 ~ '^[0-9a-fA-F]{64}$'),
  schema_restore_sha256 text not null check (schema_restore_sha256 ~ '^[0-9a-fA-F]{64}$'),
  table_digests jsonb not null default '{}'::jsonb,
  post_restore_smoke jsonb not null default '{}'::jsonb,
  failure_injection jsonb not null default '{}'::jsonb,
  rollback_validation jsonb not null default '{}'::jsonb,
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  calculated_pass boolean not null default false,
  failure_reasons jsonb not null default '[]'::jsonb,
  raw_report jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  ingested_by text not null default 'external-dr-runner'
);
create index if not exists disaster_recovery_evidence_v20150_lookup_idx on public.disaster_recovery_evidence_v20150(channel,build_id,ingested_at desc);

create table if not exists public.disaster_recovery_audit_v20150 (
  id bigint generated always as identity primary key,
  channel text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  actor text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists disaster_recovery_audit_v20150_lookup_idx on public.disaster_recovery_audit_v20150(channel,created_at desc);


create table if not exists public.disaster_recovery_failure_sandbox_v20150 (
  id uuid primary key,
  marker text not null,
  created_at timestamptz not null default now()
);

alter table public.disaster_recovery_config_v20150 enable row level security;
alter table public.disaster_recovery_evidence_v20150 enable row level security;
alter table public.disaster_recovery_audit_v20150 enable row level security;
alter table public.disaster_recovery_failure_sandbox_v20150 enable row level security;
revoke all on public.disaster_recovery_config_v20150 from public,anon,authenticated;
revoke all on public.disaster_recovery_evidence_v20150 from public,anon,authenticated;
revoke all on public.disaster_recovery_audit_v20150 from public,anon,authenticated;
revoke all on public.disaster_recovery_failure_sandbox_v20150 from public,anon,authenticated;
grant select,insert,update on public.disaster_recovery_config_v20150 to service_role;
grant select,insert on public.disaster_recovery_evidence_v20150 to service_role;
grant select,insert on public.disaster_recovery_audit_v20150 to service_role;
grant select,insert,delete on public.disaster_recovery_failure_sandbox_v20150 to service_role;
grant usage,select on sequence public.disaster_recovery_audit_v20150_id_seq to service_role;


create or replace function public.powder_dr_failure_rollback_drill_v20150()
returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=gen_random_uuid();rolled_back boolean:=false;recovered boolean:=false;
begin
 begin
   insert into public.disaster_recovery_failure_sandbox_v20150(id,marker) values(rid,'must-rollback');
   raise exception 'POWDER_DR_FORCED_FAILURE_20150';
 exception when others then
   null;
 end;
 rolled_back:=not exists(select 1 from public.disaster_recovery_failure_sandbox_v20150 where id=rid);
 begin perform 1;recovered:=true;exception when others then recovered:=false;end;
 return jsonb_build_object('version','20.15.0','pass',rolled_back and recovered,'forcedFailureObserved',true,'writeFailClosed',rolled_back,'recoveryObserved',recovered,'checkedAt',now());
end$$;

create or replace function public.powder_dr_validate_report_v20150(p_report jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c text:=case when p_report->>'channel'='staging' then 'staging' else 'production' end;
 cfg public.disaster_recovery_config_v20150;
 reasons jsonb:='[]'::jsonb; req text; td jsonb; smoke jsonb:=coalesce(p_report->'postRestoreSmoke','{}'::jsonb); fi jsonb:=coalesce(p_report->'failureInjection','{}'::jsonb); rb jsonb:=coalesce(p_report->'rollbackValidation','{}'::jsonb);
 rpo numeric:=greatest(0,extract(epoch from ((p_report->>'incidentCutoffAt')::timestamptz-(p_report->>'backupCreatedAt')::timestamptz))/60);
 rto numeric:=greatest(0,extract(epoch from ((p_report->>'restoreCompletedAt')::timestamptz-(p_report->>'restoreStartedAt')::timestamptz))/60);
 pass boolean:=false;
begin
 select * into cfg from public.disaster_recovery_config_v20150 where channel=c;
 if coalesce(p_report->>'schema','')<>'powder-disaster-recovery-evidence-v20150' then reasons:=reasons||to_jsonb('SCHEMA_INVALID'::text);end if;
 if coalesce(p_report->>'version','')<>'20.15.0' then reasons:=reasons||to_jsonb('VERSION_INVALID'::text);end if;
 if coalesce(p_report->>'buildId','')='' then reasons:=reasons||to_jsonb('BUILD_ID_MISSING'::text);end if;
 if coalesce(p_report->>'sourceIdentitySha256','') !~ '^[0-9a-fA-F]{64}$' or coalesce(p_report->>'restoreIdentitySha256','') !~ '^[0-9a-fA-F]{64}$' then reasons:=reasons||to_jsonb('DATABASE_IDENTITY_INVALID'::text);end if;
 if lower(coalesce(p_report->>'sourceIdentitySha256',''))=lower(coalesce(p_report->>'restoreIdentitySha256','')) then reasons:=reasons||to_jsonb('RESTORE_TARGET_EQUALS_SOURCE'::text);end if;
 if coalesce(p_report->>'backupArtifactSha256','') !~ '^[0-9a-fA-F]{64}$' or coalesce((p_report->>'backupSizeBytes')::bigint,0)<=0 then reasons:=reasons||to_jsonb('BACKUP_ARTIFACT_INVALID'::text);end if;
 if coalesce(p_report->>'evidenceSha256','') !~ '^[0-9a-fA-F]{64}$' then reasons:=reasons||to_jsonb('EVIDENCE_SHA_INVALID'::text);end if;
 if cfg.require_isolated_restore and coalesce((p_report->>'isolatedRestore')::boolean,false) is not true then reasons:=reasons||to_jsonb('RESTORE_NOT_ISOLATED'::text);end if;
 if coalesce((p_report->>'sourceReadOnly')::boolean,false) is not true then reasons:=reasons||to_jsonb('SOURCE_NOT_READ_ONLY'::text);end if;
 if rpo>cfg.target_rpo_minutes then reasons:=reasons||to_jsonb('RPO_TARGET_EXCEEDED'::text);end if;
 if rto>cfg.target_rto_minutes then reasons:=reasons||to_jsonb('RTO_TARGET_EXCEEDED'::text);end if;
 if coalesce(p_report->>'schemaSourceSha256','') !~ '^[0-9a-fA-F]{64}$' or coalesce(p_report->>'schemaRestoreSha256','') !~ '^[0-9a-fA-F]{64}$' or lower(p_report->>'schemaSourceSha256')<>lower(p_report->>'schemaRestoreSha256') then reasons:=reasons||to_jsonb('SCHEMA_DIGEST_MISMATCH'::text);end if;
 td:=coalesce(p_report->'tableDigests','{}'::jsonb);
 for req in select jsonb_array_elements_text(cfg.required_tables) loop
   if not (td ? req) then reasons:=reasons||to_jsonb(('TABLE_DIGEST_MISSING:'||req)::text);
   elsif coalesce(td->req->>'existsSource','false')<>'true' or coalesce(td->req->>'existsRestore','false')<>'true' then reasons:=reasons||to_jsonb(('TABLE_MISSING:'||req)::text);
   elsif coalesce(td->req->>'sourceSha256','') !~ '^[0-9a-fA-F]{64}$' or lower(coalesce(td->req->>'sourceSha256',''))<>lower(coalesce(td->req->>'restoreSha256','')) then reasons:=reasons||to_jsonb(('TABLE_DIGEST_MISMATCH:'||req)::text);
   elsif coalesce((td->req->>'sourceRows')::bigint,-1)<>coalesce((td->req->>'restoreRows')::bigint,-2) then reasons:=reasons||to_jsonb(('TABLE_ROWCOUNT_MISMATCH:'||req)::text);
   end if;
 end loop;
 if not (coalesce((smoke->>'auth')::boolean,false) and coalesce((smoke->>'cloudSave')::boolean,false) and coalesce((smoke->>'economy')::boolean,false) and coalesce((smoke->>'pows')::boolean,false) and coalesce((smoke->>'inventory')::boolean,false) and coalesce((smoke->>'transactions')::boolean,false)) then reasons:=reasons||to_jsonb('POST_RESTORE_SMOKE_INCOMPLETE'::text);end if;
 if not (coalesce((fi->>'databaseUnavailableObserved')::boolean,false) and coalesce((fi->>'writeFailClosed')::boolean,false) and coalesce((fi->>'recoveryObserved')::boolean,false)) then reasons:=reasons||to_jsonb('FAILURE_INJECTION_INCOMPLETE'::text);end if;
 if cfg.require_rollback_drill and not (coalesce((rb->>'verified')::boolean,false) and coalesce(rb->>'rollbackBuild','')<>'' and coalesce(rb->>'rollbackBuild','')<>coalesce(p_report->>'buildId','') and coalesce(rb->>'evidenceSha256','') ~ '^[0-9a-fA-F]{64}$') then reasons:=reasons||to_jsonb('ROLLBACK_DRILL_INVALID'::text);end if;
 pass:=jsonb_array_length(reasons)=0;
 return jsonb_build_object('version','20.15.0','pass',pass,'reasons',reasons,'rpoMinutes',round(rpo,2),'rtoMinutes',round(rto,2),'requiredTables',cfg.required_tables);
exception when others then
 return jsonb_build_object('version','20.15.0','pass',false,'reasons',jsonb_build_array('REPORT_VALIDATION_ERROR:'||left(sqlerrm,160)));
end$$;

create or replace function public.powder_dr_ingest_v20150(p_report jsonb,p_actor text default 'external-dr-runner')
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_report->>'channel'='staging' then 'staging' else 'production' end;v jsonb;row_id uuid;rpo numeric;rto numeric;
begin
 v:=public.powder_dr_validate_report_v20150(p_report);
 rpo:=coalesce((v->>'rpoMinutes')::numeric,999999);rto:=coalesce((v->>'rtoMinutes')::numeric,999999);
 insert into public.disaster_recovery_evidence_v20150(channel,build_id,runner_revision,source_identity_sha256,restore_identity_sha256,backup_provider,backup_artifact_sha256,backup_size_bytes,backup_created_at,incident_cutoff_at,restore_started_at,restore_completed_at,rpo_minutes,rto_minutes,restore_environment,isolated_restore,source_read_only,schema_source_sha256,schema_restore_sha256,table_digests,post_restore_smoke,failure_injection,rollback_validation,evidence_sha256,calculated_pass,failure_reasons,raw_report,ingested_by)
 values(c,left(coalesce(p_report->>'buildId',''),180),left(coalesce(p_report->>'runnerRevision',''),180),lower(p_report->>'sourceIdentitySha256'),lower(p_report->>'restoreIdentitySha256'),left(coalesce(p_report->>'backupProvider',''),100),lower(p_report->>'backupArtifactSha256'),coalesce((p_report->>'backupSizeBytes')::bigint,0),(p_report->>'backupCreatedAt')::timestamptz,(p_report->>'incidentCutoffAt')::timestamptz,(p_report->>'restoreStartedAt')::timestamptz,(p_report->>'restoreCompletedAt')::timestamptz,rpo,rto,left(coalesce(p_report->>'restoreEnvironment',''),160),coalesce((p_report->>'isolatedRestore')::boolean,false),coalesce((p_report->>'sourceReadOnly')::boolean,false),lower(p_report->>'schemaSourceSha256'),lower(p_report->>'schemaRestoreSha256'),coalesce(p_report->'tableDigests','{}'::jsonb),coalesce(p_report->'postRestoreSmoke','{}'::jsonb),coalesce(p_report->'failureInjection','{}'::jsonb),coalesce(p_report->'rollbackValidation','{}'::jsonb),lower(p_report->>'evidenceSha256'),coalesce((v->>'pass')::boolean,false),coalesce(v->'reasons','[]'::jsonb),p_report,left(coalesce(p_actor,'external-dr-runner'),200)) returning id into row_id;
 insert into public.disaster_recovery_audit_v20150(channel,action,details,actor) values(c,'evidence_ingested',jsonb_build_object('id',row_id,'buildId',p_report->>'buildId','calculatedPass',v->'pass','reasons',v->'reasons','rpoMinutes',v->'rpoMinutes','rtoMinutes',v->'rtoMinutes'),left(coalesce(p_actor,''),200));
 return jsonb_build_object('ok',true,'id',row_id,'validation',v);
end$$;

create or replace function public.powder_dr_posture_v20150(p_channel text default 'production',p_build text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;cfg public.disaster_recovery_config_v20150;e public.disaster_recovery_evidence_v20150;legacy jsonb:='{}'::jsonb;fresh boolean:=false;legacy_technical boolean:=false;ready boolean:=false;
begin
 select * into cfg from public.disaster_recovery_config_v20150 where channel=c;
 select * into e from public.disaster_recovery_evidence_v20150 where channel=c and (p_build='' or build_id=p_build) order by ingested_at desc limit 1;
 begin legacy:=public.powder_recovery_posture_v2040(c,p_build); exception when others then legacy:=jsonb_build_object('ready',false,'error',left(sqlerrm,160)); end;
 fresh:=e.id is not null and e.ingested_at>=now()-make_interval(days=>coalesce(cfg.evidence_ttl_days,7));
 legacy_technical:=coalesce((legacy#>>'{checks,backupCoverage}')::boolean,false) and coalesce((legacy#>>'{checks,backupChecksum}')::boolean,false) and coalesce((legacy#>>'{checks,restoreRpcServiceOnly}')::boolean,false) and coalesce((legacy#>>'{checks,schemaFingerprint}')::boolean,false) and coalesce((legacy#>>'{checks,sandboxRestore}')::boolean,false);
 ready:=coalesce(cfg.enabled,false) and fresh and coalesce(e.calculated_pass,false) and legacy_technical;
 return jsonb_build_object('version','20.15.0','channel',c,'buildId',p_build,'enabled',coalesce(cfg.enabled,false),'ready',ready,'freshEvidence',fresh,'legacyRecoveryReady',coalesce((legacy->>'ready')::boolean,false),'checks',jsonb_build_object('armed',coalesce(cfg.enabled,false),'evidenceFresh',fresh,'isolatedRestore',coalesce(e.isolated_restore,false),'sourceReadOnly',coalesce(e.source_read_only,false),'schemaMatch',coalesce(e.schema_source_sha256,'')<>'' and e.schema_source_sha256=e.schema_restore_sha256,'restoreCalculatedPass',coalesce(e.calculated_pass,false),'legacyTechnical',legacy_technical,'legacyRecovery',coalesce((legacy->>'ready')::boolean,false)),'latestEvidence',case when e.id is null then null else jsonb_build_object('id',e.id,'runnerRevision',e.runner_revision,'backupProvider',e.backup_provider,'backupSha256',e.backup_artifact_sha256,'backupSizeBytes',e.backup_size_bytes,'rpoMinutes',e.rpo_minutes,'rtoMinutes',e.rto_minutes,'restoreEnvironment',e.restore_environment,'calculatedPass',e.calculated_pass,'failureReasons',e.failure_reasons,'evidenceSha256',e.evidence_sha256,'ingestedAt',e.ingested_at) end,'legacyRecovery',legacy,'checkedAt',now());
end$$;

create or replace function public.powder_dr_set_enabled_v20150(p_channel text,p_enabled boolean,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;
begin
 update public.disaster_recovery_config_v20150 set enabled=coalesce(p_enabled,false),updated_at=now(),updated_by=left(coalesce(p_actor,''),200) where channel=c;
 insert into public.disaster_recovery_audit_v20150(channel,action,details,actor) values(c,'config_enabled',jsonb_build_object('enabled',coalesce(p_enabled,false)),left(coalesce(p_actor,''),200));
 return jsonb_build_object('ok',true,'channel',c,'enabled',coalesce(p_enabled,false));
end$$;

revoke all on function public.powder_dr_failure_rollback_drill_v20150() from public,anon,authenticated;
revoke all on function public.powder_dr_validate_report_v20150(jsonb) from public,anon,authenticated;
revoke all on function public.powder_dr_ingest_v20150(jsonb,text) from public,anon,authenticated;
revoke all on function public.powder_dr_posture_v20150(text,text) from public,anon,authenticated;
revoke all on function public.powder_dr_set_enabled_v20150(text,boolean,text) from public,anon,authenticated;
grant execute on function public.powder_dr_failure_rollback_drill_v20150() to service_role;
grant execute on function public.powder_dr_validate_report_v20150(jsonb) to service_role;
grant execute on function public.powder_dr_ingest_v20150(jsonb,text) to service_role;
grant execute on function public.powder_dr_posture_v20150(text,text) to service_role;
grant execute on function public.powder_dr_set_enabled_v20150(text,boolean,text) to service_role;

commit;
