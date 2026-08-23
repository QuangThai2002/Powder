-- Powder 18.7.1 - PvP Balance Layer
-- Strictly PvP-only: catalog/runtime tables below are used only by powder-pvp.

create table if not exists public.pvp_balance_rules_v1871(
  version text primary key,
  damage_cap_pct numeric not null default .82,
  heal_coeff numeric not null default .88,
  heal_fatigue_step numeric not null default .12,
  shield_coeff numeric not null default .90,
  shield_fatigue_step numeric not null default .12,
  shield_cap_pct numeric not null default .35,
  hard_cc_dr_step numeric not null default .20,
  hard_cc_dr_max smallint not null default 3,
  updated_at timestamptz not null default now()
);
insert into public.pvp_balance_rules_v1871 values('18.7.1',.82,.88,.12,.90,.12,.35,.20,3,now())
on conflict(version) do update set damage_cap_pct=excluded.damage_cap_pct,heal_coeff=excluded.heal_coeff,
 heal_fatigue_step=excluded.heal_fatigue_step,shield_coeff=excluded.shield_coeff,
 shield_fatigue_step=excluded.shield_fatigue_step,shield_cap_pct=excluded.shield_cap_pct,
 hard_cc_dr_step=excluded.hard_cc_dr_step,hard_cc_dr_max=excluded.hard_cc_dr_max,updated_at=now();

create table if not exists public.pvp_role_balance_v1871(
  role text primary key, hp_coeff numeric not null default 1, atk_coeff numeric not null default 1,
  ap_coeff numeric not null default 1, def_coeff numeric not null default 1, speed_coeff numeric not null default 1,
  archetype_hint text not null default 'flex'
);
insert into public.pvp_role_balance_v1871 values
 ('Xạ thủ',1,1.03,1,1,1.01,'pressure / burst'),('Pháp sư',1,1,1.03,1,1,'burst / control'),
 ('Đỡ đòn',1.04,.97,.97,1.04,.98,'frontline / disruption'),('Đấu sĩ',1.01,1.02,1.01,1,1,'bruiser / pressure'),
 ('Hiệp sĩ',1.02,1,1,1.02,1,'guard / tempo'),('Thuật sư',1,1,1.02,1,1,'control / attrition'),
 ('Trị liệu',1.02,.96,1.02,1.01,1,'sustain / cleanse'),('Nhạc công',1,.98,1.01,1,1.03,'tempo / utility'),
 ('Sát thủ',.98,1.04,1.02,.96,1.03,'pick / execute')
on conflict(role) do update set hp_coeff=excluded.hp_coeff,atk_coeff=excluded.atk_coeff,ap_coeff=excluded.ap_coeff,
 def_coeff=excluded.def_coeff,speed_coeff=excluded.speed_coeff,archetype_hint=excluded.archetype_hint;

alter table public.pvp_match_pows add column if not exists pvp_cc_dr smallint not null default 0;
alter table public.pvp_match_pows add column if not exists pvp_heal_fatigue smallint not null default 0;
alter table public.pvp_match_pows add column if not exists pvp_shield_fatigue smallint not null default 0;

-- A number of PvP catalog skills were typed support while carrying hostile statuses.
-- In 18.7.0 that made the skill target/self-CC. Normalize only the PvP catalog.
do $fix$
declare slot text;
begin
  foreach slot in array array['s1','s2','ult'] loop
    update public.pvp_pow_catalog
       set skills=jsonb_set(skills,array[slot,'type'],'"control"'::jsonb,true)
     where skills->slot->>'type'='support'
       and skills->slot->>'status' in('Stun','Freeze','Paralysis','Slow','Burn','Magma Burn','Poison','Curse');
  end loop;
end $fix$;

-- Mild role identity coefficients are applied only when a new PvP match snapshot is created.
create or replace function public.powder_pvp_role_coeff_guard_v1871() returns trigger
language plpgsql security definer set search_path='public' as $fn$
declare r public.pvp_role_balance_v1871; role_name text;
begin
  select role into role_name from public.pvp_pow_catalog where pow_id=new.pow_id;
  select * into r from public.pvp_role_balance_v1871 where role=role_name;
  if found then
    new.max_hp:=greatest(1,round(new.max_hp*r.hp_coeff)); new.hp:=new.max_hp;
    new.atk:=greatest(1,round(new.atk*r.atk_coeff)); new.ap:=greatest(1,round(new.ap*r.ap_coeff));
    new.def:=greatest(1,round(new.def*r.def_coeff)); new.speed:=greatest(1,round(new.speed*r.speed_coeff));
  end if;
  return new;
end $fn$;
drop trigger if exists trg_pvp_role_coeff_v1871 on public.pvp_match_pows;
create trigger trg_pvp_role_coeff_v1871 before insert on public.pvp_match_pows
for each row execute function public.powder_pvp_role_coeff_guard_v1871();

-- Universal PvP safety rails: one-shot guard, heal/shield fatigue and hard-CC diminishing returns.
create or replace function public.powder_pvp_state_guard_v1871() returns trigger
language plpgsql security definer set search_path='public' as $fn$
declare r public.pvp_balance_rules_v1871; old_shield int:=0; new_shield int:=0; cap int:=0;
        heal_gain int:=0; heal_mult numeric:=1; shield_mult numeric:=1;
        old_hard boolean:=false; new_stun int:=0; new_freeze int:=0; block_chance numeric:=0;
begin
  select * into r from public.pvp_balance_rules_v1871 where version='18.7.1';
  -- No single state update may remove more than 82% max HP. DoT/ticks are far below this cap.
  if new.hp<old.hp then
    cap:=greatest(1,round(old.max_hp*coalesce(r.damage_cap_pct,.82)));
    if old.hp-new.hp>cap then new.hp:=greatest(0,old.hp-cap); new.eliminated:=(new.hp<=0); end if;
    new.pvp_heal_fatigue:=greatest(0,old.pvp_heal_fatigue-1);
  elsif new.hp>old.hp then
    heal_gain:=new.hp-old.hp;
    if heal_gain>round(old.max_hp*.08) then
      heal_mult:=greatest(.50,coalesce(r.heal_coeff,.88)*(1-old.pvp_heal_fatigue*coalesce(r.heal_fatigue_step,.12)));
      new.hp:=least(new.max_hp,old.hp+greatest(1,round(heal_gain*heal_mult)));
      new.pvp_heal_fatigue:=least(3,old.pvp_heal_fatigue+1);
    end if;
  end if;

  old_shield:=greatest(0,coalesce((old.statuses->>'shield')::int,0));
  new_shield:=greatest(0,coalesce((new.statuses->>'shield')::int,0));
  if new_shield>old_shield then
    shield_mult:=greatest(.50,coalesce(r.shield_coeff,.90)*(1-old.pvp_shield_fatigue*coalesce(r.shield_fatigue_step,.12)));
    cap:=greatest(1,round(new.max_hp*coalesce(r.shield_cap_pct,.35)));
    new_shield:=least(cap,old_shield+greatest(1,round((new_shield-old_shield)*shield_mult)));
    new.statuses:=jsonb_set(new.statuses,'{shield}',to_jsonb(new_shield),true);
    new.pvp_shield_fatigue:=least(3,old.pvp_shield_fatigue+1);
  elsif new_shield<old_shield then new.pvp_shield_fatigue:=greatest(0,old.pvp_shield_fatigue-1); end if;

  old_hard:=coalesce((old.statuses->>'Stun')::int,0)>0 or coalesce((old.statuses->>'Freeze')::int,0)>0;
  new_stun:=greatest(0,coalesce((new.statuses->>'Stun')::int,0));
  new_freeze:=greatest(0,coalesce((new.statuses->>'Freeze')::int,0));
  if (new_stun>0 or new_freeze>0) and not old_hard then
    block_chance:=least(.72,old.pvp_cc_dr*coalesce(r.hard_cc_dr_step,.20));
    if random()<block_chance then
      new.statuses:=new.statuses-'Stun'-'Freeze';
    else new.pvp_cc_dr:=least(coalesce(r.hard_cc_dr_max,3),old.pvp_cc_dr+2); end if;
  elsif old_hard and (new_stun>0 or new_freeze>0) then
    -- Never refresh/chain a hard CC while one is already active.
    new.statuses:=jsonb_set(new.statuses,'{Stun}',to_jsonb(coalesce((old.statuses->>'Stun')::int,0)),true);
    new.statuses:=jsonb_set(new.statuses,'{Freeze}',to_jsonb(coalesce((old.statuses->>'Freeze')::int,0)),true);
    if coalesce((old.statuses->>'Stun')::int,0)=0 then new.statuses:=new.statuses-'Stun'; end if;
    if coalesce((old.statuses->>'Freeze')::int,0)=0 then new.statuses:=new.statuses-'Freeze'; end if;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_pvp_state_guard_v1871 on public.pvp_match_pows;
create trigger trg_pvp_state_guard_v1871 before update on public.pvp_match_pows
for each row execute function public.powder_pvp_state_guard_v1871();

-- DR decays when that side receives a new server turn; no infinite hard-CC immunity.
create or replace function public.powder_pvp_dr_turn_decay_v1871() returns trigger
language plpgsql security definer set search_path='public' as $fn$
begin
  if new.status='active' and new.turn_no is distinct from old.turn_no and new.current_player is not null then
    update public.pvp_match_pows set pvp_cc_dr=greatest(0,pvp_cc_dr-1)
      where match_id=new.id and user_id=new.current_player and pvp_cc_dr>0;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_pvp_dr_turn_decay_v1871 on public.pvp_matches;
create trigger trg_pvp_dr_turn_decay_v1871 after update on public.pvp_matches
for each row execute function public.powder_pvp_dr_turn_decay_v1871();

create table if not exists public.pvp_pow_audit_v1871(
  pow_id text primary key references public.pvp_pow_catalog(pow_id) on delete cascade, role text not null,
  archetype text not null, power_score numeric not null, power_band text not null, tags jsonb not null default '[]'::jsonb,
  reason_to_use text not null, duplicate_signature_count integer not null default 1, warning text, audited_at timestamptz not null default now()
);
with b as(
 select c.*,((base_stats->>'hp')::numeric/5+(base_stats->>'atk')::numeric*1.2+(base_stats->>'ap')::numeric*1.2+
 (base_stats->>'def')::numeric+(base_stats->>'speed')::numeric+(base_stats->>'critRate')::numeric*3+
 greatest((base_stats->>'critDamage')::numeric-200,0)*.5) score,
 c.skills::text ~* '"status"\s*:\s*"(Stun|Freeze|Paralysis)"' cc,
 c.skills::text ~* '"status"\s*:\s*"(Burn|Magma Burn|Poison|Curse)"' dot,
 c.skills::text ~* '"status"\s*:\s*"(Regeneration|Cleanse)"' sustain,
 c.skills::text ~* '"status"\s*:\s*"Shield"' shield,
 concat_ws('|',c.role,c.element,c.skills->'s1'->>'type',c.skills->'s1'->>'status',c.skills->'s2'->>'type',c.skills->'s2'->>'status',c.skills->'ult'->>'status') sig
 from public.pvp_pow_catalog c
),r as(select b.*,ntile(4) over(order by score) q,count(*) over(partition by sig) dup from b)
insert into public.pvp_pow_audit_v1871(pow_id,role,archetype,power_score,power_band,tags,reason_to_use,duplicate_signature_count,warning,audited_at)
select pow_id,role,
 case when role='Xạ thủ' then case when cc then 'control_marksman' else 'pressure_marksman' end
 when role='Pháp sư' then case when cc then 'control_mage' when dot then 'attrition_mage' else 'burst_mage' end
 when role='Đỡ đòn' then case when shield then 'fortress_tank' else 'control_tank' end
 when role='Đấu sĩ' then case when sustain or shield then 'sustain_bruiser' else 'pressure_bruiser' end
 when role='Hiệp sĩ' then 'guard_knight' when role='Thuật sư' then case when cc then 'control_caster' else 'attrition_caster' end
 when role='Trị liệu' then case when shield then 'barrier_healer' else 'sustain_healer' end
 when role='Nhạc công' then case when cc then 'control_support' else 'tempo_support' end
 when role='Sát thủ' then 'pick_assassin' else 'flex' end,
 round(score,2),case q when 1 then 'entry' when 2 then 'core' when 3 then 'elite' else 'apex' end,
 to_jsonb(array_remove(array[case when cc then 'hard_cc' end,case when dot then 'dot' end,case when sustain then 'sustain' end,case when shield then 'shield' end],null)),
 case when cc then 'Có utility hard CC để mở combo hoặc ngắt nhịp đối thủ.' when shield then 'Có giá trị bảo hộ/barrier cho đội hình chống burst.'
 when sustain then 'Có sustain để thắng trao đổi dài nhưng bị PvP fatigue kiểm soát.' when dot then 'Có DoT để bào mòn các đội hình phòng thủ.'
 else 'Đóng góp áp lực theo role/hệ và giữ một vị trí trong đội hình cân bằng.' end,
 dup,case when dup>1 then 'KIT_SIMILARITY_REVIEW_18.8.1' else null end,now() from r
on conflict(pow_id) do update set role=excluded.role,archetype=excluded.archetype,power_score=excluded.power_score,power_band=excluded.power_band,
 tags=excluded.tags,reason_to_use=excluded.reason_to_use,duplicate_signature_count=excluded.duplicate_signature_count,warning=excluded.warning,audited_at=now();

alter table public.pvp_balance_rules_v1871 enable row level security;
alter table public.pvp_role_balance_v1871 enable row level security;
alter table public.pvp_pow_audit_v1871 enable row level security;
revoke all on public.pvp_balance_rules_v1871,public.pvp_role_balance_v1871,public.pvp_pow_audit_v1871 from anon,authenticated;
grant select,insert,update,delete on public.pvp_balance_rules_v1871,public.pvp_role_balance_v1871,public.pvp_pow_audit_v1871 to service_role;
revoke all on function public.powder_pvp_role_coeff_guard_v1871() from public,anon,authenticated;
revoke all on function public.powder_pvp_state_guard_v1871() from public,anon,authenticated;
revoke all on function public.powder_pvp_dr_turn_decay_v1871() from public,anon,authenticated;
grant execute on function public.powder_pvp_role_coeff_guard_v1871() to service_role;
grant execute on function public.powder_pvp_state_guard_v1871() to service_role;
grant execute on function public.powder_pvp_dr_turn_decay_v1871() to service_role;
