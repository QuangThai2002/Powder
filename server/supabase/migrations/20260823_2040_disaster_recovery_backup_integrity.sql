begin;

create table if not exists public.recovery_config_v2040 (
  channel text primary key check (channel in ('production','staging')),
  target_rpo_minutes integer not null default 360 check (target_rpo_minutes between 1 and 10080),
  target_rto_minutes integer not null default 60 check (target_rto_minutes between 1 and 1440),
  max_real_restore_age_days integer not null default 7 check (max_real_restore_age_days between 1 and 90),
  require_real_restore boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.recovery_config_v2040(channel,target_rpo_minutes,target_rto_minutes,max_real_restore_age_days,require_real_restore)
values ('production',360,60,7,true),('staging',360,60,14,false)
on conflict(channel) do nothing;

create table if not exists public.recovery_schema_baseline_v2040 (
  channel text primary key check (channel in ('production','staging')),
  fingerprint text not null,
  created_at timestamptz not null default now(),
  created_by text not null default 'migration-20.4.0'
);

create table if not exists public.recovery_restore_evidence_v2040 (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('production','staging')),
  build_id text not null,
  backup_provider text not null,
  backup_id text not null,
  backup_created_at timestamptz not null,
  backup_sha256 text not null check (backup_sha256 ~ '^[0-9a-fA-F]{64}$'),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  restore_environment text not null,
  restore_started_at timestamptz not null,
  restore_completed_at timestamptz not null,
  rpo_minutes numeric not null check (rpo_minutes >= 0),
  rto_minutes numeric not null check (rto_minutes >= 0),
  schema_compatible boolean not null default false,
  cloud_save_verified boolean not null default false,
  economy_verified boolean not null default false,
  pows_verified boolean not null default false,
  inventory_verified boolean not null default false,
  rollback_verified boolean not null default false,
  status text not null check (status in ('pass','fail')),
  notes text not null default '',
  checked_at timestamptz not null default now(),
  checked_by text not null default ''
);
create index if not exists recovery_restore_evidence_v2040_lookup_idx on public.recovery_restore_evidence_v2040(channel,build_id,checked_at desc);

create table if not exists public.recovery_sandbox_v2040 (
  id uuid primary key,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.recovery_posture_snapshots_v2040 (
  id bigint generated always as identity primary key,
  channel text not null,
  build_id text not null,
  posture jsonb not null,
  created_at timestamptz not null default now(),
  created_by text not null default ''
);

alter table public.recovery_config_v2040 enable row level security;
alter table public.recovery_schema_baseline_v2040 enable row level security;
alter table public.recovery_restore_evidence_v2040 enable row level security;
alter table public.recovery_sandbox_v2040 enable row level security;
alter table public.recovery_posture_snapshots_v2040 enable row level security;

revoke all on public.recovery_config_v2040 from public,anon,authenticated;
revoke all on public.recovery_schema_baseline_v2040 from public,anon,authenticated;
revoke all on public.recovery_restore_evidence_v2040 from public,anon,authenticated;
revoke all on public.recovery_sandbox_v2040 from public,anon,authenticated;
revoke all on public.recovery_posture_snapshots_v2040 from public,anon,authenticated;
grant select,insert,update,delete on public.recovery_config_v2040 to service_role;
grant select,insert,update,delete on public.recovery_schema_baseline_v2040 to service_role;
grant select,insert,update,delete on public.recovery_restore_evidence_v2040 to service_role;
grant select,insert,update,delete on public.recovery_sandbox_v2040 to service_role;
grant select,insert on public.recovery_posture_snapshots_v2040 to service_role;
grant usage,select on sequence public.recovery_posture_snapshots_v2040_id_seq to service_role;

create or replace function public.powder_recovery_schema_fingerprint_v2040()
returns text
language sql
security definer
set search_path=public
as $$
with parts as (
  select 'C:'||table_name||':'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'') as x
  from information_schema.columns
  where table_schema='public' and table_name in ('player_saves','player_backups','player_economy','player_pows','tamer_progress','shop_state','daily_login_state')
  union all
  select 'K:'||c.conrelid::regclass::text||':'||c.conname||':'||pg_get_constraintdef(c.oid,true)
  from pg_constraint c
  where c.conrelid in ('public.player_saves'::regclass,'public.player_backups'::regclass,'public.player_economy'::regclass,'public.player_pows'::regclass,'public.tamer_progress'::regclass)
  union all
  select 'F:'||p.proname||':'||pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('powder_create_player_backup','powder_restore_player_backup','powder_player_backup_state','powder_cloud_save_commit_v1828')
)
select md5(coalesce(string_agg(x,E'\n' order by x),'')) from parts;
$$;
revoke all on function public.powder_recovery_schema_fingerprint_v2040() from public,anon,authenticated;
grant execute on function public.powder_recovery_schema_fingerprint_v2040() to service_role;

insert into public.recovery_schema_baseline_v2040(channel,fingerprint)
select c, public.powder_recovery_schema_fingerprint_v2040() from (values('production'),('staging')) v(c)
on conflict(channel) do update set fingerprint=excluded.fingerprint,created_at=now(),created_by='migration-20.4.0';

create or replace function public.powder_recovery_sandbox_drill_v2040()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  rid uuid:=gen_random_uuid(); original jsonb:=jsonb_build_object('schema','recovery-v2040','coins',12345,'save',jsonb_build_object('revision',7,'marker',rid::text),'items',jsonb_build_array('a','b','c'));
  original_hash text; restored_hash text; started timestamptz:=clock_timestamp(); cleaned boolean:=false; pass boolean:=false;
begin
  original_hash:=md5(original::text);
  insert into public.recovery_sandbox_v2040(id,payload,revision) values(rid,original,1);
  update public.recovery_sandbox_v2040 set payload=jsonb_build_object('corrupted',true,'marker',gen_random_uuid()::text),revision=2,updated_at=now() where id=rid;
  update public.recovery_sandbox_v2040 set payload=original,revision=3,updated_at=now() where id=rid;
  select md5(payload::text) into restored_hash from public.recovery_sandbox_v2040 where id=rid;
  pass:=restored_hash=original_hash;
  delete from public.recovery_sandbox_v2040 where id=rid;
  cleaned:=not exists(select 1 from public.recovery_sandbox_v2040 where id=rid);
  return jsonb_build_object('version','20.4.0','pass',pass and cleaned,'hashMatch',pass,'cleaned',cleaned,'elapsedMs',round(extract(epoch from (clock_timestamp()-started))*1000,2),'originalHash',original_hash,'restoredHash',restored_hash,'checkedAt',now());
exception when others then
  delete from public.recovery_sandbox_v2040 where id=rid;
  return jsonb_build_object('version','20.4.0','pass',false,'cleaned',not exists(select 1 from public.recovery_sandbox_v2040 where id=rid),'error',sqlerrm,'checkedAt',now());
end $$;
revoke all on function public.powder_recovery_sandbox_drill_v2040() from public,anon,authenticated;
grant execute on function public.powder_recovery_sandbox_drill_v2040() to service_role;

create or replace function public.powder_recovery_posture_v2040(p_channel text default 'production', p_build text default '')
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c text:=case when p_channel='staging' then 'staging' else 'production' end;
  cfg public.recovery_config_v2040; current_fp text; baseline_fp text; drill jsonb;
  saves_count bigint:=0; backup_users bigint:=0; backups_count bigint:=0; bad_backup_checksum bigint:=0;
  restore_rpc_client bigint:=0; backup_direct_write bigint:=0; latest_real public.recovery_restore_evidence_v2040;
  coverage_ok boolean:=false; schema_ok boolean:=false; rpc_ok boolean:=false; local_ok boolean:=false; real_ok boolean:=false; ready boolean:=false;
begin
  select * into cfg from public.recovery_config_v2040 where channel=c;
  current_fp:=public.powder_recovery_schema_fingerprint_v2040();
  select fingerprint into baseline_fp from public.recovery_schema_baseline_v2040 where channel=c;
  schema_ok:=coalesce(current_fp,'')<>'' and current_fp=baseline_fp;
  select count(*) into saves_count from public.player_saves;
  select count(*),count(distinct user_id),count(*) filter(where checksum is null or checksum !~ '^[0-9a-fA-F]{32}$') into backups_count,backup_users,bad_backup_checksum from public.player_backups;
  coverage_ok:=saves_count=0 or not exists(select 1 from public.player_saves s where not exists(select 1 from public.player_backups b where b.user_id=s.user_id));
  select count(*) into restore_rpc_client from information_schema.routine_privileges where routine_schema='public' and routine_name in ('powder_create_player_backup','powder_restore_player_backup','powder_player_backup_state','powder_cloud_save_commit_v1828') and grantee in ('anon','authenticated');
  backup_direct_write := (case when has_table_privilege('anon','public.player_backups','INSERT') then 1 else 0 end)+(case when has_table_privilege('authenticated','public.player_backups','INSERT') then 1 else 0 end)+(case when has_table_privilege('authenticated','public.player_backups','UPDATE') then 1 else 0 end)+(case when has_table_privilege('authenticated','public.player_backups','DELETE') then 1 else 0 end);
  rpc_ok:=restore_rpc_client=0 and backup_direct_write=0;
  drill:=public.powder_recovery_sandbox_drill_v2040();
  local_ok:=coverage_ok and bad_backup_checksum=0 and rpc_ok and schema_ok and coalesce((drill->>'pass')::boolean,false);
  select * into latest_real from public.recovery_restore_evidence_v2040 where channel=c and (p_build='' or build_id=p_build) order by checked_at desc limit 1;
  if latest_real.id is not null then
    real_ok:=latest_real.status='pass' and latest_real.checked_at>=now()-(cfg.max_real_restore_age_days||' days')::interval and latest_real.rpo_minutes<=cfg.target_rpo_minutes and latest_real.rto_minutes<=cfg.target_rto_minutes and latest_real.schema_compatible and latest_real.cloud_save_verified and latest_real.economy_verified and latest_real.pows_verified and latest_real.inventory_verified and latest_real.rollback_verified;
  end if;
  ready:=local_ok and (not cfg.require_real_restore or real_ok);
  return jsonb_build_object('version','20.4.0','channel',c,'buildId',p_build,'ready',ready,
    'checks',jsonb_build_object('backupCoverage',coverage_ok,'backupChecksum',bad_backup_checksum=0,'restoreRpcServiceOnly',rpc_ok,'schemaFingerprint',schema_ok,'sandboxRestore',coalesce((drill->>'pass')::boolean,false),'realRestoreEvidence',real_ok),
    'counts',jsonb_build_object('playerSaves',saves_count,'backupRows',backups_count,'usersWithBackup',backup_users,'badBackupChecksum',bad_backup_checksum,'clientRestoreRpcGrants',restore_rpc_client,'directBackupWrites',backup_direct_write),
    'schema',jsonb_build_object('current',current_fp,'baseline',baseline_fp),
    'sandbox',drill,
    'targets',jsonb_build_object('rpoMinutes',cfg.target_rpo_minutes,'rtoMinutes',cfg.target_rto_minutes,'maxRealRestoreAgeDays',cfg.max_real_restore_age_days,'requireRealRestore',cfg.require_real_restore),
    'realEvidence',case when latest_real.id is null then null else jsonb_build_object('id',latest_real.id,'backupProvider',latest_real.backup_provider,'backupId',latest_real.backup_id,'backupCreatedAt',latest_real.backup_created_at,'restoreEnvironment',latest_real.restore_environment,'rpoMinutes',latest_real.rpo_minutes,'rtoMinutes',latest_real.rto_minutes,'status',latest_real.status,'checkedAt',latest_real.checked_at,'checkedBy',latest_real.checked_by) end,
    'checkedAt',now());
end $$;
revoke all on function public.powder_recovery_posture_v2040(text,text) from public,anon,authenticated;
grant execute on function public.powder_recovery_posture_v2040(text,text) to service_role;

commit;
