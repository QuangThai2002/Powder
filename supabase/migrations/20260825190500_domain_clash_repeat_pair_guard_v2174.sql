-- Powder 21.7.4 · Allow future re-Clash only after a real Domain reactivation
create or replace function public.powder_domain_clash_match_guard_v2170()
returns trigger language plpgsql security definer set search_path=public as $$
declare m public.pvp_matches%rowtype; pa public.pvp_match_players%rowtype; pb public.pvp_match_players%rowtype; ma text; mb text;
begin
  select * into m from public.pvp_matches where id=new.match_id;
  if not found then raise exception 'DOMAIN_CLASH_MATCH_NOT_FOUND'; end if;
  if m.status<>'active' then raise exception 'DOMAIN_CLASH_MATCH_NOT_ACTIVE'; end if;
  if not ((new.player_a=m.player_a and new.player_b=m.player_b) or (new.player_a=m.player_b and new.player_b=m.player_a)) then raise exception 'DOMAIN_CLASH_PARTICIPANT_MISMATCH'; end if;
  select * into pa from public.pvp_match_players where match_id=new.match_id and user_id=new.player_a;
  select * into pb from public.pvp_match_players where match_id=new.match_id and user_id=new.player_b;
  if pa.user_id is null or pb.user_id is null then raise exception 'DOMAIN_CLASH_PLAYER_STATE_MISSING'; end if;
  if not coalesce((pa.expansion_state->>'active')::boolean,false) or not coalesce((pb.expansion_state->>'active')::boolean,false) then raise exception 'DOMAIN_CLASH_REQUIRES_BOTH_ACTIVE'; end if;
  if coalesce(pa.expansion_state->>'id','')<>new.domain_a or coalesce(pb.expansion_state->>'id','')<>new.domain_b then raise exception 'DOMAIN_CLASH_ACTIVE_DOMAIN_MISMATCH'; end if;
  ma:=coalesce(pa.expansion_state->'domainClashV2170'->>'clashId',''); mb:=coalesce(pb.expansion_state->'domainClashV2170'->>'clashId','');
  if ma<>'' and ma=mb then raise exception 'DOMAIN_CLASH_ALREADY_RESOLVED_FOR_ACTIVE_PAIR'; end if;
  return new;
end $$;
revoke all on function public.powder_domain_clash_match_guard_v2170() from public,anon,authenticated;
