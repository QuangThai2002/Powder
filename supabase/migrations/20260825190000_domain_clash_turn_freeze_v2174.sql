-- Powder 21.7.4 · Domain Clash Turn Freeze / Replay-safe action gate
drop index if exists public.pvp_domain_clash_single_match_v2170;

create or replace function public.powder_pvp_domain_clash_gate_v2174(p_match uuid)
returns text language plpgsql security definer set search_path=public as $$
declare m public.pvp_matches; a public.pvp_match_players; b public.pvp_match_players; ma text; mb text;
begin
 select * into m from public.pvp_matches where id=p_match;
 if not found or m.status<>'active' then return 'none'; end if;
 if exists(select 1 from public.pvp_domain_clashes_v2170 where match_id=p_match and status in ('active','waiting','sudden') and expires_at>now()) then return 'pending'; end if;
 select * into a from public.pvp_match_players where match_id=p_match and user_id=m.player_a;
 select * into b from public.pvp_match_players where match_id=p_match and user_id=m.player_b;
 if not coalesce((a.expansion_state->>'active')::boolean,false) or not coalesce((b.expansion_state->>'active')::boolean,false) then return 'none'; end if;
 ma:=coalesce(a.expansion_state->'domainClashV2170'->>'clashId',''); mb:=coalesce(b.expansion_state->'domainClashV2170'->>'clashId','');
 if ma<>'' and ma=mb then return 'resolved'; end if;
 return 'required';
end $$;
revoke all on function public.powder_pvp_domain_clash_gate_v2174(uuid) from public,anon,authenticated;

DO $$ begin if to_regprocedure('public.powder_pvp_action_legacy_v2173(uuid,uuid,text,text,text,text,integer)') is null then execute 'alter function public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer) rename to powder_pvp_action_legacy_v2173'; end if; end $$;
create or replace function public.powder_pvp_action_v1880(p_user uuid,p_match uuid,p_actor text,p_target text,p_skill text,p_client_action_id text,p_expected_turn_no integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare gate text;
begin
 if exists(select 1 from public.pvp_action_receipts_v1870 where match_id=p_match and user_id=p_user and client_action_id=p_client_action_id) then return public.powder_pvp_action_legacy_v2173(p_user,p_match,p_actor,p_target,p_skill,p_client_action_id,p_expected_turn_no); end if;
 gate:=public.powder_pvp_domain_clash_gate_v2174(p_match);
 if gate='pending' then raise exception 'DOMAIN_CLASH_PENDING: đang Đấu Lãnh Địa; action thường bị khóa'; end if;
 if gate='required' then raise exception 'DOMAIN_CLASH_REQUIRED: hai Bành Trướng đang đối đầu; phải Đấu Lãnh Địa trước'; end if;
 return public.powder_pvp_action_legacy_v2173(p_user,p_match,p_actor,p_target,p_skill,p_client_action_id,p_expected_turn_no);
end $$;
revoke all on function public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer) to service_role;

DO $$ begin if to_regprocedure('public.powder_pvp_resolve_timeout_legacy_v2173(uuid)') is null then execute 'alter function public.powder_pvp_resolve_timeout_v1831(uuid) rename to powder_pvp_resolve_timeout_legacy_v2173'; end if; end $$;
create or replace function public.powder_pvp_resolve_timeout_v1831(p_match uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare gate text;
begin
 gate:=public.powder_pvp_domain_clash_gate_v2174(p_match);
 if gate in ('pending','required') then update public.pvp_matches set turn_started_at=now() where id=p_match and status='active'; return jsonb_build_object('ok',true,'resolved',false,'domainClashFrozen',true,'gate',gate,'remaining',45); end if;
 return public.powder_pvp_resolve_timeout_legacy_v2173(p_match);
end $$;
revoke all on function public.powder_pvp_resolve_timeout_v1831(uuid) from public,anon,authenticated;
grant execute on function public.powder_pvp_resolve_timeout_v1831(uuid) to service_role;

create or replace function public.powder_pvp_domain_clash_turn_reset_v2174() returns trigger language plpgsql security definer set search_path=public as $$
begin if old.status is distinct from new.status and new.status in ('resolved','cancelled') then update public.pvp_matches set turn_started_at=now() where id=new.match_id and status='active'; end if; return new; end $$;
drop trigger if exists trg_domain_clash_turn_reset_v2174 on public.pvp_domain_clashes_v2170;
create trigger trg_domain_clash_turn_reset_v2174 after update of status on public.pvp_domain_clashes_v2170 for each row execute function public.powder_pvp_domain_clash_turn_reset_v2174();
revoke all on function public.powder_pvp_domain_clash_turn_reset_v2174() from public,anon,authenticated;

create or replace function public.powder_pvp_domain_activate_v1880(p_user uuid,p_match uuid,p_kind text,p_id text,p_client_action_id text,p_expected_turn_no integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare chosen public.pvp_domain_charge_v2172; r jsonb; gate text;
begin
 if exists(select 1 from public.pvp_domain_action_receipts_v1880 where match_id=p_match and user_id=p_user and client_action_id=p_client_action_id) then return public.powder_pvp_domain_activate_legacy_v2171(p_user,p_match,p_kind,p_id,p_client_action_id,p_expected_turn_no); end if;
 gate:=public.powder_pvp_domain_clash_gate_v2174(p_match);
 if gate='pending' then raise exception 'DOMAIN_CLASH_PENDING: không thể kích hoạt Lãnh Địa khác khi Clash đang mở'; end if;
 if gate='required' then raise exception 'DOMAIN_CLASH_REQUIRED: phải giải quyết Đấu Lãnh Địa trước'; end if;
 if p_kind<>'expansion' then return public.powder_pvp_domain_activate_legacy_v2171(p_user,p_match,p_kind,p_id,p_client_action_id,p_expected_turn_no); end if;
 select c.* into chosen from public.pvp_domain_charge_v2172 c join public.pvp_match_pows p on p.match_id=c.match_id and p.user_id=c.user_id and p.pow_id=c.pow_id where c.match_id=p_match and c.user_id=p_user and c.charge>=100 and not p.eliminated and p.hp>0 and p.slot in (select slot from public.powder_pvp_active_slots(p_match,p_user)) order by c.charge desc,p.speed desc,p.slot asc limit 1 for update of c;
 if not found then raise exception 'DOMAIN_CHARGE_REQUIRED: cần một Pow active đạt 100%% Lãnh Địa'; end if;
 update public.pvp_domain_charge_v2172 set charge=0,updated_at=now() where match_id=p_match and user_id=p_user and pow_id=chosen.pow_id;
 r:=public.powder_pvp_domain_activate_legacy_v2171(p_user,p_match,p_kind,p_id,p_client_action_id,p_expected_turn_no);
 return coalesce(r,'{}'::jsonb)||jsonb_build_object('domainChargeVersion','21.7.4','domainChargePowId',chosen.pow_id,'domainChargeSpent',100,'clashGate',gate);
end $$;
revoke all on function public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer) to service_role;
