alter table public.recovery_restore_evidence_v2040 add column if not exists incident_at timestamptz;
update public.recovery_restore_evidence_v2040 set incident_at=restore_started_at where incident_at is null;
alter table public.recovery_restore_evidence_v2040 alter column incident_at set not null;

create or replace function public.powder_recovery_record_real_restore_v2040(
  p_channel text,p_build text,p_backup_provider text,p_backup_id text,p_backup_created_at timestamptz,
  p_backup_sha256 text,p_evidence_sha256 text,p_incident_at timestamptz,p_restore_environment text,
  p_restore_started_at timestamptz,p_restore_completed_at timestamptz,p_schema_compatible boolean,
  p_cloud_save_verified boolean,p_economy_verified boolean,p_pows_verified boolean,p_inventory_verified boolean,
  p_rollback_verified boolean,p_notes text,p_admin text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  c text:=case when p_channel='staging' then 'staging' else 'production' end;
  cfg public.recovery_config_v2040; rpo numeric; rto numeric; st text; rid uuid;
begin
  select * into cfg from public.recovery_config_v2040 where channel=c;
  if p_backup_sha256 !~ '^[0-9a-fA-F]{64}$' or p_evidence_sha256 !~ '^[0-9a-fA-F]{64}$' then raise exception 'RECOVERY_SHA256_INVALID'; end if;
  if p_backup_created_at>p_incident_at or p_restore_started_at>p_restore_completed_at then raise exception 'RECOVERY_TIMELINE_INVALID'; end if;
  rpo:=round(extract(epoch from (p_incident_at-p_backup_created_at))/60.0,2);
  rto:=round(extract(epoch from (p_restore_completed_at-p_restore_started_at))/60.0,2);
  st:=case when rpo<=cfg.target_rpo_minutes and rto<=cfg.target_rto_minutes and p_schema_compatible and p_cloud_save_verified and p_economy_verified and p_pows_verified and p_inventory_verified and p_rollback_verified then 'pass' else 'fail' end;
  insert into public.recovery_restore_evidence_v2040(channel,build_id,backup_provider,backup_id,backup_created_at,backup_sha256,evidence_sha256,incident_at,restore_environment,restore_started_at,restore_completed_at,rpo_minutes,rto_minutes,schema_compatible,cloud_save_verified,economy_verified,pows_verified,inventory_verified,rollback_verified,status,notes,checked_by)
  values(c,left(p_build,160),left(p_backup_provider,80),left(p_backup_id,180),p_backup_created_at,lower(p_backup_sha256),lower(p_evidence_sha256),p_incident_at,left(p_restore_environment,120),p_restore_started_at,p_restore_completed_at,rpo,rto,p_schema_compatible,p_cloud_save_verified,p_economy_verified,p_pows_verified,p_inventory_verified,p_rollback_verified,st,left(coalesce(p_notes,''),1200),left(coalesce(p_admin,''),160)) returning id into rid;
  return jsonb_build_object('ok',true,'id',rid,'status',st,'rpoMinutes',rpo,'rtoMinutes',rto,'targets',jsonb_build_object('rpoMinutes',cfg.target_rpo_minutes,'rtoMinutes',cfg.target_rto_minutes));
end $$;
revoke all on function public.powder_recovery_record_real_restore_v2040(text,text,text,text,timestamptz,text,text,timestamptz,text,timestamptz,timestamptz,boolean,boolean,boolean,boolean,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.powder_recovery_record_real_restore_v2040(text,text,text,text,timestamptz,text,text,timestamptz,text,timestamptz,timestamptz,boolean,boolean,boolean,boolean,boolean,boolean,text,text) to service_role;
