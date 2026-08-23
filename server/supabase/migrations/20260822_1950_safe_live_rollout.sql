create table if not exists public.release_rollout_v1950 (
  channel text primary key check (channel in ('production','staging')),
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  cohort_salt text not null default 'powder-rollout-v1950',
  emergency_mode text not null default 'normal' check (emergency_mode in ('normal','halt')),
  emergency_message text not null default '',
  rollback_target_build text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.release_rollout_v1950(channel, rollout_percent, cohort_salt, emergency_mode, emergency_message)
values ('production',100,'powder-production-v1950','normal',''),('staging',100,'powder-staging-v1950','normal','')
on conflict (channel) do nothing;
alter table public.release_rollout_v1950 enable row level security;
revoke all on table public.release_rollout_v1950 from public, anon, authenticated;
grant select, insert, update on table public.release_rollout_v1950 to service_role;
create or replace function public.powder_release_manifest(p_channel text default 'production'::text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare r public.release_channels; ro public.release_rollout_v1950; c text := case when p_channel='staging' then 'staging' else 'production' end;
begin
  select * into r from public.release_channels where channel=c;
  select * into ro from public.release_rollout_v1950 where channel=c;
  return jsonb_build_object('channel',r.channel,'currentVersion',r.current_version,'minimumVersion',r.minimum_version,'buildId',r.build_id,'hardMaintenance',r.hard_maintenance,'maintenanceMessage',r.maintenance_message,'maintenanceUntil',r.maintenance_until,'updateUrl',r.update_url,'assetEpoch',r.asset_epoch,'rolloutPercent',coalesce(ro.rollout_percent,100),'rolloutSalt',coalesce(ro.cohort_salt,'powder-rollout-v1950'),'emergencyMode',coalesce(ro.emergency_mode,'normal'),'emergencyMessage',coalesce(ro.emergency_message,''),'rollbackTargetBuild',coalesce(ro.rollback_target_build,''),'rolloutUpdatedAt',ro.updated_at,'serverTime',now());
end $function$;
revoke all on function public.powder_release_manifest(text) from public, anon, authenticated;
grant execute on function public.powder_release_manifest(text) to service_role;
