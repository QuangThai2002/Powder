-- Powder 21.7.1 · expiry rollback + Vô Lượng question parity

-- Rút Kiếm Ra must roll HP back by the exact verified Supremacy factor, not the old hard-coded 1.30.
-- Bất Động Kim Cương Giới also removes its scaled opening shield when the Domain expires.
create or replace function public.powder_pvp_domain_expire_v1880(p_match uuid,p_user uuid,p_reason text default 'duration')
returns void
language plpgsql
security definer
set search_path=public
as $$
declare mp public.pvp_match_players; m public.pvp_matches; id text; other uuid; sup_scale numeric:=1; hp_factor numeric:=1.30;
begin
 select * into mp from public.pvp_match_players where match_id=p_match and user_id=p_user for update;
 if not found or not coalesce((mp.expansion_state->>'active')::boolean,false) then return; end if;
 select * into m from public.pvp_matches where id=p_match; id:=mp.expansion_state->>'id';
 other:=case when m.player_a=p_user then m.player_b else m.player_a end;
 sup_scale:=public.powder_pvp_domain_supremacy_scale_v2171(p_match,p_user);
 hp_factor:=greatest(.10,1+.30*sup_scale);
 if id='draw_swords' then
   update public.pvp_match_pows p set max_hp=greatest(1,round(p.max_hp/hp_factor)),hp=least(greatest(1,round(p.max_hp/hp_factor)),p.hp)
    from public.pvp_pow_catalog c where p.match_id=p_match and p.user_id=p_user and p.pow_id=c.pow_id and c.role not in('Hiệp sĩ','Đấu sĩ','Đỡ đòn');
 elsif id='frozen_silence' then
   update public.pvp_match_pows set statuses=statuses-'DomainCold' where match_id=p_match and user_id=other;
 elsif id='nine_suns' then
   update public.pvp_match_pows set statuses=statuses-'DomainSunMark' where match_id=p_match and user_id=other;
 elsif id='diamond_guard' then
   update public.pvp_match_pows p set statuses=case
     when greatest(0,coalesce((p.statuses->>'shield')::int,0)-round(p.max_hp*.12*sup_scale))>0
       then jsonb_set(coalesce(p.statuses,'{}'::jsonb),'{shield}',to_jsonb(greatest(0,coalesce((p.statuses->>'shield')::int,0)-round(p.max_hp*.12*sup_scale))),true)
     else coalesce(p.statuses,'{}'::jsonb)-'shield' end
   where p.match_id=p_match and p.user_id=p_user and not p.eliminated;
 end if;
 update public.pvp_match_players set expansion_state=jsonb_set(expansion_state,'{active}','false'::jsonb,true) where match_id=p_match and user_id=p_user;
 perform public.powder_pvp_domain_log_v1880(p_match,p_user,null,null,'domain_expansion_end',jsonb_build_object('id',id,'reason',p_reason,'supremacyScale',sup_scale));
end;
$$;

-- Scale Vô Lượng's numeric knowledge-derived bonus/penalty by the verified Domain multiplier.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='powder_pvp_action_v1880' and p.prokind='f' limit 1;
  if d is null then raise exception 'POWDER_V2171_ACTION_FUNCTION_MISSING_2'; end if;
  if position('question_scale:=question_scale*(1+.20*ownerq.correct_count*sup_scale);' in d)=0 then
    if position('question_scale:=question_scale*(1+.20*ownerq.correct_count);' in d)=0 then raise exception 'POWDER_V2171_LIMITLESS_OWNER_DRIFT'; end if;
    d:=replace(d,'question_scale:=question_scale*(1+.20*ownerq.correct_count);','question_scale:=question_scale*(1+.20*ownerq.correct_count*sup_scale);');
  end if;
  if position('question_scale:=question_scale*greatest(0,1-enemy_sup_scale);' in d)=0 then
    if position('if hostileq.wrong_count>=2 then question_scale:=0; elsif hostileq.wrong_count=1 then question_scale:=question_scale*.50; end if;' in d)=0 then raise exception 'POWDER_V2171_LIMITLESS_HOSTILE_DRIFT'; end if;
    d:=replace(d,'if hostileq.wrong_count>=2 then question_scale:=0; elsif hostileq.wrong_count=1 then question_scale:=question_scale*.50; end if;','if hostileq.wrong_count>=2 then question_scale:=question_scale*greatest(0,1-enemy_sup_scale); elsif hostileq.wrong_count=1 then question_scale:=question_scale*greatest(0,1-.50*enemy_sup_scale); end if;');
  end if;
  execute d;
end $$;
