-- Powder 20.1.0 · Live Ops & Incident Readiness
-- Additive operations schema. No gameplay/economy tables are modified.
create extension if not exists pgcrypto;
create table if not exists public.official_incidents_v2010 (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'production' check (channel in ('production','staging')),
  build_id text not null default '',
  severity text not null check (severity in ('critical','high','medium','cosmetic')),
  category text not null default 'general',
  title text not null,
  detail text not null default '',
  status text not null default 'open' check (status in ('open','monitoring','resolved','wontfix')),
  opened_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz,
  opened_by text not null default '', resolved_by text not null default '', resolution text not null default ''
);
create index if not exists official_incidents_v2010_open_idx on public.official_incidents_v2010(channel,status,severity,updated_at desc);
create table if not exists public.official_health_snapshots_v2010 (
  id bigserial primary key, channel text not null default 'production', build_id text not null default '',
  snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), created_by text not null default ''
);
create index if not exists official_health_snapshots_v2010_idx on public.official_health_snapshots_v2010(channel,created_at desc);
alter table public.official_incidents_v2010 enable row level security;
alter table public.official_health_snapshots_v2010 enable row level security;
revoke all on public.official_incidents_v2010 from public,anon,authenticated;
revoke all on public.official_health_snapshots_v2010 from public,anon,authenticated;
grant select,insert,update,delete on public.official_incidents_v2010 to service_role;
grant select,insert on public.official_health_snapshots_v2010 to service_role;
grant usage,select on sequence public.official_health_snapshots_v2010_id_seq to service_role;
create or replace function public.powder_live_ops_snapshot_v2010(p_channel text default 'production'::text, p_build text default '')
returns jsonb language plpgsql security definer set search_path='public' as $function$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end; integ jsonb:='{}'::jsonb; ch public.release_channels; ro public.release_rollout_v1950; open_critical int:=0; open_high int:=0; open_medium int:=0; open_cosmetic int:=0; active_pilot int:=0; recent_pilot int:=0; stale_sc int:=0;
begin
  select * into ch from public.release_channels where channel=c; select * into ro from public.release_rollout_v1950 where channel=c;
  begin integ:=public.powder_integrity_snapshot_v1960(); exception when others then integ:=jsonb_build_object('ready',false,'error',sqlerrm); end;
  select count(*) filter(where severity='critical'),count(*) filter(where severity='high'),count(*) filter(where severity='medium'),count(*) filter(where severity='cosmetic') into open_critical,open_high,open_medium,open_cosmetic from public.official_incidents_v2010 where channel=c and status in ('open','monitoring');
  select count(*) into active_pilot from public.pilot_cohort_v1970 where active=true;
  select count(distinct d.user_id) into recent_pilot from public.pilot_device_health_v1970 d join public.pilot_cohort_v1970 pc on pc.user_id=d.user_id and pc.active=true where d.last_seen_at>=now()-interval '7 days';
  select count(*) into stale_sc from public.server_combat_sessions_v1862 where status='active' and updated_at<now()-interval '10 minutes';
  return jsonb_build_object('version','20.1.0','channel',c,'buildId',p_build,'integrity',integ,'release',case when ch.channel is null then null else to_jsonb(ch) end,'rollout',case when ro.channel is null then null else to_jsonb(ro) end,'incidents',jsonb_build_object('critical',open_critical,'high',open_high,'medium',open_medium,'cosmetic',open_cosmetic,'blockers',open_critical+open_high),'pilot',jsonb_build_object('active',active_pilot,'recent7d',recent_pilot),'staleServerCombat',stale_sc,'healthy',coalesce((integ->>'ready')::boolean,false) and open_critical=0 and open_high=0 and stale_sc=0,'checkedAt',now());
end $function$;
revoke all on function public.powder_live_ops_snapshot_v2010(text,text) from public,anon,authenticated;
grant execute on function public.powder_live_ops_snapshot_v2010(text,text) to service_role;
