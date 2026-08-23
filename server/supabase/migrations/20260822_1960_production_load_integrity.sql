-- Powder 19.6.0 Production Load & Integrity Gate
create table if not exists public.integrity_cas_probe_v1960 (
  id text primary key,
  revision bigint not null default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.integrity_cas_probe_v1960 enable row level security;
revoke all on table public.integrity_cas_probe_v1960 from public, anon, authenticated;
grant select,insert,update,delete on table public.integrity_cas_probe_v1960 to service_role;

create or replace function public.powder_integrity_probe_v1960()
returns jsonb language sql security definer set search_path='public' as $function$
  select jsonb_build_object(
    'pvpPow', (select count(*) from public.pvp_pow_catalog),
    'identity', (select count(*) from public.pvp_pow_identity_v1881),
    'domains', (select count(*) from public.pvp_domain_catalog_v1880),
    'simpleDomains', (select count(*) from public.pvp_simple_domain_catalog_v1880),
    'activePvp', (select count(*) from public.pvp_matches where status='active'),
    'activeServerCombat', (select count(*) from public.server_combat_sessions_v1862 where status='active'),
    'serverTime', now()
  );
$function$;
revoke all on function public.powder_integrity_probe_v1960() from public, anon, authenticated;
grant execute on function public.powder_integrity_probe_v1960() to service_role;

-- Snapshot validates orphan/stale rows, save shape, uniqueness and service-only PvP authority.
create or replace function public.powder_integrity_snapshot_v1960()
returns jsonb language plpgsql security definer set search_path='public' as $function$
declare orphan_players bigint; orphan_pows bigint; stale_server bigint; stale_pvp bigint; bad_saves bigint;
declare pvp_receipt_pk boolean; domain_receipt_pk boolean; reward_pk boolean; cloud_commit boolean; pvp_action_secure boolean; domain_action_secure boolean;
begin
 select count(*) into orphan_players from public.pvp_match_players p left join public.pvp_matches m on m.id=p.match_id where m.id is null;
 select count(*) into orphan_pows from public.pvp_match_pows p left join public.pvp_matches m on m.id=p.match_id where m.id is null;
 select count(*) into stale_server from public.server_combat_sessions_v1862 where status='active' and updated_at < now()-interval '20 minutes';
 select count(*) into stale_pvp from public.pvp_matches where status='active' and updated_at < now()-interval '10 minutes';
 select count(*) into bad_saves from public.player_saves where revision < 1 or jsonb_typeof(save_data) <> 'object';
 select exists(select 1 from pg_constraint where conrelid='public.pvp_action_receipts_v1870'::regclass and contype in ('p','u') and pg_get_constraintdef(oid) ilike '%match_id%user_id%client_action_id%') into pvp_receipt_pk;
 select exists(select 1 from pg_constraint where conrelid='public.pvp_domain_action_receipts_v1880'::regclass and contype in ('p','u') and pg_get_constraintdef(oid) ilike '%match_id%user_id%client_action_id%') into domain_receipt_pk;
 select exists(select 1 from pg_constraint where conrelid='public.learning_reward_claims'::regclass and contype='p') into reward_pk;
 select to_regprocedure('public.powder_cloud_save_commit_v1828(uuid,jsonb,bigint,boolean,text,integer,text)') is not null into cloud_commit;
 select not has_function_privilege('anon','public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer)','EXECUTE') and not has_function_privilege('authenticated','public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer)','EXECUTE') and has_function_privilege('service_role','public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer)','EXECUTE') into pvp_action_secure;
 select not has_function_privilege('anon','public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer)','EXECUTE') and not has_function_privilege('authenticated','public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer)','EXECUTE') and has_function_privilege('service_role','public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer)','EXECUTE') into domain_action_secure;
 return jsonb_build_object('version','19.6.0','checkedAt',now(),'counts',jsonb_build_object('pvpPow',(select count(*) from public.pvp_pow_catalog),'identity',(select count(*) from public.pvp_pow_identity_v1881),'identitySignatures',(select count(distinct signature) from public.pvp_pow_identity_v1881),'domains',(select count(*) from public.pvp_domain_catalog_v1880),'simpleDomains',(select count(*) from public.pvp_simple_domain_catalog_v1880),'activePvp',(select count(*) from public.pvp_matches where status='active'),'activeServerCombat',(select count(*) from public.server_combat_sessions_v1862 where status='active'),'playerSaves',(select count(*) from public.player_saves)),'issues',jsonb_build_object('orphanMatchPlayers',orphan_players,'orphanMatchPows',orphan_pows,'staleServerCombat',stale_server,'stalePvp',stale_pvp,'badPlayerSaves',bad_saves),'guards',jsonb_build_object('pvpReceiptUnique',pvp_receipt_pk,'domainReceiptUnique',domain_receipt_pk,'rewardClaimsPk',reward_pk,'cloudCommitExists',cloud_commit,'pvpActionServiceOnly',pvp_action_secure,'domainActionServiceOnly',domain_action_secure),'ready',(orphan_players=0 and orphan_pows=0 and stale_server=0 and bad_saves=0 and pvp_receipt_pk and domain_receipt_pk and reward_pk and cloud_commit and pvp_action_secure and domain_action_secure));
end $function$;
revoke all on function public.powder_integrity_snapshot_v1960() from public, anon, authenticated;
grant execute on function public.powder_integrity_snapshot_v1960() to service_role;

create or replace function public.powder_integrity_cas_reset_v1960(p_id text)
returns jsonb language plpgsql security definer set search_path='public' as $function$
declare r public.integrity_cas_probe_v1960; begin insert into public.integrity_cas_probe_v1960(id,revision,payload,updated_at) values(left(p_id,120),1,'{}'::jsonb,now()) on conflict(id) do update set revision=1,payload='{}'::jsonb,updated_at=now() returning * into r; return to_jsonb(r); end $function$;
revoke all on function public.powder_integrity_cas_reset_v1960(text) from public, anon, authenticated;
grant execute on function public.powder_integrity_cas_reset_v1960(text) to service_role;

create or replace function public.powder_integrity_cas_commit_v1960(p_id text,p_expected bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='public' as $function$
declare r public.integrity_cas_probe_v1960; begin perform pg_advisory_xact_lock(hashtextextended('integrity-cas:'||left(p_id,120),0)); select * into r from public.integrity_cas_probe_v1960 where id=left(p_id,120) for update; if not found then return jsonb_build_object('ok',false,'missing',true); end if; if r.revision<>p_expected then return jsonb_build_object('ok',false,'conflict',true,'revision',r.revision); end if; update public.integrity_cas_probe_v1960 set revision=r.revision+1,payload=coalesce(p_payload,'{}'::jsonb),updated_at=now() where id=r.id returning * into r; return jsonb_build_object('ok',true,'conflict',false,'revision',r.revision); end $function$;
revoke all on function public.powder_integrity_cas_commit_v1960(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.powder_integrity_cas_commit_v1960(text,bigint,jsonb) to service_role;
