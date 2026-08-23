-- Powder 18.7.1 - balance guard event ledger hardening
-- Applied after 20260822_1871_pvp_balance_layer.sql.

create or replace function public.powder_pvp_balance_log_v1871(
  p_match uuid,
  p_target text,
  p_payload jsonb
) returns void
language sql
security definer
set search_path='public'
as $fn$
  insert into public.pvp_match_events(match_id,turn_no,actor_user_id,target_pow_id,event_type,payload)
  select m.id,m.turn_no,m.current_player,p_target,'balance_guard',
         coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('balanceVersion','18.7.1')
  from public.pvp_matches m where m.id=p_match;
$fn$;

create or replace function public.powder_pvp_state_guard_v1871()
returns trigger
language plpgsql
security definer
set search_path='public'
as $fn$
declare
  r public.pvp_balance_rules_v1871;
  old_shield int:=0;
  new_shield int:=0;
  requested_shield int:=0;
  cap int:=0;
  requested_damage int:=0;
  heal_gain int:=0;
  requested_heal int:=0;
  heal_mult numeric:=1;
  shield_mult numeric:=1;
  old_hard boolean:=false;
  new_stun int:=0;
  new_freeze int:=0;
  block_chance numeric:=0;
begin
  select * into r from public.pvp_balance_rules_v1871 where version='18.7.1';

  if new.hp<old.hp then
    requested_damage:=old.hp-new.hp;
    cap:=greatest(1,round(old.max_hp*coalesce(r.damage_cap_pct,.82)));
    if requested_damage>cap then
      new.hp:=greatest(0,old.hp-cap);
      new.eliminated:=(new.hp<=0);
      perform public.powder_pvp_balance_log_v1871(new.match_id,new.pow_id,
        jsonb_build_object('kind','damage_cap','requested',requested_damage,'applied',old.hp-new.hp,'cap',cap));
    end if;
    new.pvp_heal_fatigue:=greatest(0,old.pvp_heal_fatigue-1);
  elsif new.hp>old.hp then
    heal_gain:=new.hp-old.hp;
    requested_heal:=heal_gain;
    if heal_gain>round(old.max_hp*.08) then
      heal_mult:=greatest(.50,coalesce(r.heal_coeff,.88)*(1-old.pvp_heal_fatigue*coalesce(r.heal_fatigue_step,.12)));
      new.hp:=least(new.max_hp,old.hp+greatest(1,round(heal_gain*heal_mult)));
      new.pvp_heal_fatigue:=least(3,old.pvp_heal_fatigue+1);
      perform public.powder_pvp_balance_log_v1871(new.match_id,new.pow_id,
        jsonb_build_object('kind','heal_fatigue','requested',requested_heal,'applied',new.hp-old.hp,
                           'fatigueBefore',old.pvp_heal_fatigue,'fatigueAfter',new.pvp_heal_fatigue));
    end if;
  end if;

  old_shield:=greatest(0,coalesce((old.statuses->>'shield')::int,0));
  new_shield:=greatest(0,coalesce((new.statuses->>'shield')::int,0));
  requested_shield:=new_shield;
  if new_shield>old_shield then
    shield_mult:=greatest(.50,coalesce(r.shield_coeff,.90)*(1-old.pvp_shield_fatigue*coalesce(r.shield_fatigue_step,.12)));
    cap:=greatest(1,round(new.max_hp*coalesce(r.shield_cap_pct,.35)));
    new_shield:=least(cap,old_shield+greatest(1,round((new_shield-old_shield)*shield_mult)));
    new.statuses:=jsonb_set(new.statuses,'{shield}',to_jsonb(new_shield),true);
    new.pvp_shield_fatigue:=least(3,old.pvp_shield_fatigue+1);
    if requested_shield<>new_shield then
      perform public.powder_pvp_balance_log_v1871(new.match_id,new.pow_id,
        jsonb_build_object('kind','shield_guard','requested',requested_shield,'applied',new_shield,'cap',cap,
                           'fatigueBefore',old.pvp_shield_fatigue,'fatigueAfter',new.pvp_shield_fatigue));
    end if;
  elsif new_shield<old_shield then
    new.pvp_shield_fatigue:=greatest(0,old.pvp_shield_fatigue-1);
  end if;

  old_hard:=coalesce((old.statuses->>'Stun')::int,0)>0 or coalesce((old.statuses->>'Freeze')::int,0)>0;
  new_stun:=greatest(0,coalesce((new.statuses->>'Stun')::int,0));
  new_freeze:=greatest(0,coalesce((new.statuses->>'Freeze')::int,0));
  if (new_stun>0 or new_freeze>0) and not old_hard then
    block_chance:=least(.72,old.pvp_cc_dr*coalesce(r.hard_cc_dr_step,.20));
    if random()<block_chance then
      new.statuses:=new.statuses-'Stun'-'Freeze';
      perform public.powder_pvp_balance_log_v1871(new.match_id,new.pow_id,
        jsonb_build_object('kind','hard_cc_dr','blocked',true,'dr',old.pvp_cc_dr,'blockChance',round(block_chance,3)));
    else
      new.pvp_cc_dr:=least(coalesce(r.hard_cc_dr_max,3),old.pvp_cc_dr+2);
    end if;
  elsif old_hard and (new_stun>0 or new_freeze>0) then
    new.statuses:=jsonb_set(new.statuses,'{Stun}',to_jsonb(coalesce((old.statuses->>'Stun')::int,0)),true);
    new.statuses:=jsonb_set(new.statuses,'{Freeze}',to_jsonb(coalesce((old.statuses->>'Freeze')::int,0)),true);
    if coalesce((old.statuses->>'Stun')::int,0)=0 then new.statuses:=new.statuses-'Stun'; end if;
    if coalesce((old.statuses->>'Freeze')::int,0)=0 then new.statuses:=new.statuses-'Freeze'; end if;
    perform public.powder_pvp_balance_log_v1871(new.match_id,new.pow_id,
      jsonb_build_object('kind','hard_cc_refresh_block','blocked',true,'dr',old.pvp_cc_dr));
  end if;
  return new;
end
$fn$;

revoke all on function public.powder_pvp_balance_log_v1871(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.powder_pvp_balance_log_v1871(uuid,text,jsonb) to service_role;
revoke all on function public.powder_pvp_state_guard_v1871() from public,anon,authenticated;
grant execute on function public.powder_pvp_state_guard_v1871() to service_role;
