-- Powder 21.7.3 · Domain Round / KO / Reserve Hardening
create or replace function public.powder_pvp_domain_round_reconcile_v2173(p_match uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rs public.pvp_domain_round_v2172; active_ids text[]; pruned text[]; advanced boolean:=false; old_seen text[];
begin
 insert into public.pvp_domain_round_v2172(match_id,user_id) values(p_match,p_user) on conflict do nothing;
 select * into rs from public.pvp_domain_round_v2172 where match_id=p_match and user_id=p_user for update;
 select coalesce(array_agg(pow_id order by slot),'{}'::text[]) into active_ids from public.pvp_match_pows where match_id=p_match and user_id=p_user and not eliminated and hp>0 and slot in (select slot from public.powder_pvp_active_slots(p_match,p_user));
 old_seen:=coalesce(rs.seen_pow_ids,'{}'::text[]);
 select coalesce(array_agg(x),'{}'::text[]) into pruned from unnest(old_seen) x where x=any(active_ids);
 if coalesce(cardinality(active_ids),0)>0 and active_ids <@ pruned then
   update public.pvp_domain_round_v2172 set round_no=rs.round_no+1,seen_pow_ids='{}',updated_at=now() where match_id=p_match and user_id=p_user;
   advanced:=true; pruned:='{}'::text[];
 elsif pruned is distinct from old_seen then
   update public.pvp_domain_round_v2172 set seen_pow_ids=pruned,updated_at=now() where match_id=p_match and user_id=p_user;
 end if;
 return jsonb_build_object('ok',true,'version','21.7.3','round',case when advanced then rs.round_no+1 else rs.round_no end,'advanced',advanced,'activePowIds',active_ids,'seenPowIds',pruned,'required',cardinality(active_ids),'acted',cardinality(pruned));
end $$;
revoke all on function public.powder_pvp_domain_round_reconcile_v2173(uuid,uuid) from public,anon,authenticated;

create or replace function public.powder_pvp_domain_charge_award_v2172(p_match uuid,p_user uuid,p_pow text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare mp public.pvp_match_players; pw public.pvp_match_pows; cat public.pvp_pow_catalog; rs public.pvp_domain_round_v2172; active_ids text[]; seen text[]; gain int:=0; before_charge int:=0; after_charge int:=0; completed boolean:=false; rec jsonb;
begin
 select * into mp from public.pvp_match_players where match_id=p_match and user_id=p_user for update;
 if not found or not mp.domain_loadout_locked or coalesce(mp.expansion_id,'')='' then return jsonb_build_object('ok',false,'reason','no-domain-loadout'); end if;
 if coalesce((mp.expansion_state->>'active')::boolean,false) then return jsonb_build_object('ok',false,'reason','domain-active'); end if;
 if mp.expansion_used and mp.expansion_id<>'jackpot_bagua' then return jsonb_build_object('ok',false,'reason','domain-already-used'); end if;
 select * into pw from public.pvp_match_pows where match_id=p_match and user_id=p_user and pow_id=p_pow for update;
 if not found or pw.eliminated or pw.hp<=0 or pw.slot not in (select slot from public.powder_pvp_active_slots(p_match,p_user)) then return jsonb_build_object('ok',false,'reason','pow-not-active'); end if;
 select * into cat from public.pvp_pow_catalog where pow_id=p_pow;
 rec:=public.powder_pvp_domain_round_reconcile_v2173(p_match,p_user);
 select * into rs from public.pvp_domain_round_v2172 where match_id=p_match and user_id=p_user for update;
 if p_pow=any(rs.seen_pow_ids) then return jsonb_build_object('ok',true,'version','21.7.3','gained',0,'repeatBlocked',true,'round',rs.round_no,'reconciled',coalesce((rec->>'advanced')::boolean,false)); end if;
 gain:=public.powder_pvp_domain_charge_gain_v2172(mp.expansion_id,cat.element,cat.role);
 insert into public.pvp_domain_charge_v2172(match_id,user_id,pow_id,charge,last_gain_round) values(p_match,p_user,p_pow,0,0) on conflict do nothing;
 select charge into before_charge from public.pvp_domain_charge_v2172 where match_id=p_match and user_id=p_user and pow_id=p_pow for update;
 after_charge:=least(100,before_charge+gain);
 update public.pvp_domain_charge_v2172 set charge=after_charge,last_gain_round=rs.round_no,updated_at=now() where match_id=p_match and user_id=p_user and pow_id=p_pow;
 seen:=array_append(rs.seen_pow_ids,p_pow);
 select coalesce(array_agg(pow_id order by slot),'{}'::text[]) into active_ids from public.pvp_match_pows where match_id=p_match and user_id=p_user and not eliminated and hp>0 and slot in (select slot from public.powder_pvp_active_slots(p_match,p_user));
 if coalesce(cardinality(active_ids),0)>0 and active_ids <@ seen then completed:=true; update public.pvp_domain_round_v2172 set round_no=rs.round_no+1,seen_pow_ids='{}',updated_at=now() where match_id=p_match and user_id=p_user;
 else update public.pvp_domain_round_v2172 set seen_pow_ids=seen,updated_at=now() where match_id=p_match and user_id=p_user; end if;
 return jsonb_build_object('ok',true,'domainVersion','21.7.3','powId',p_pow,'domainId',mp.expansion_id,'round',rs.round_no,'gained',after_charge-before_charge,'before',before_charge,'after',after_charge,'ready',after_charge>=100,'roundCompleted',completed,'reconciledBeforeAction',coalesce((rec->>'advanced')::boolean,false));
end $$;
revoke all on function public.powder_pvp_domain_charge_award_v2172(uuid,uuid,text) from public,anon,authenticated;
