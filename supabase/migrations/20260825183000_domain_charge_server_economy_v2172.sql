-- Powder 21.7.2 · Server Domain Charge Economy
create table if not exists public.pvp_domain_charge_v2172 (
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  user_id uuid not null,
  pow_id text not null,
  charge smallint not null default 0 check (charge between 0 and 100),
  last_gain_round integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (match_id,user_id,pow_id)
);
create table if not exists public.pvp_domain_round_v2172 (
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  user_id uuid not null,
  round_no integer not null default 1 check (round_no >= 1),
  seen_pow_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (match_id,user_id)
);
alter table public.pvp_domain_charge_v2172 enable row level security;
alter table public.pvp_domain_round_v2172 enable row level security;
revoke all on table public.pvp_domain_charge_v2172 from anon,authenticated;
revoke all on table public.pvp_domain_round_v2172 from anon,authenticated;

create or replace function public.powder_pvp_domain_charge_gain_v2172(p_domain text,p_element text,p_role text)
returns integer language plpgsql immutable set search_path=public as $$
declare branch text; eg text:=lower(coalesce(p_element,'')); rr text:=coalesce(p_role,'');
begin
 branch:=case when p_domain in ('nine_suns','infinite_strike','limitless_void') then 'fire'
              when p_domain in ('frozen_silence','diamond_guard','jackpot_bagua') then 'water'
              when p_domain in ('myriad_poison','rebirth_wood','draw_swords') then 'leaf' else '' end;
 if branch='' then return 14; end if;
 if (branch='fire' and eg in ('fire','lava','lightning','light')) or (branch='water' and eg in ('water','ice','storm','steel')) or (branch='leaf' and eg in ('leaf','poison','wind','earth','dark')) then return 20; end if;
 if (branch='fire' and rr in ('Xạ thủ','Pháp sư','Đấu sĩ','Sát thủ')) or (branch='water' and rr in ('Đỡ đòn','Hiệp sĩ','Trị liệu','Nhạc công')) or (branch='leaf' and rr in ('Thuật sư','Trị liệu','Nhạc công','Sát thủ')) then return 14; end if;
 return 8;
end $$;
revoke all on function public.powder_pvp_domain_charge_gain_v2172(text,text,text) from public,anon,authenticated;

create or replace function public.powder_pvp_domain_charge_award_v2172(p_match uuid,p_user uuid,p_pow text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare mp public.pvp_match_players; pw public.pvp_match_pows; cat public.pvp_pow_catalog; rs public.pvp_domain_round_v2172; active_ids text[]; seen text[]; gain int:=0; before_charge int:=0; after_charge int:=0; completed boolean:=false;
begin
 select * into mp from public.pvp_match_players where match_id=p_match and user_id=p_user for update;
 if not found or not mp.domain_loadout_locked or coalesce(mp.expansion_id,'')='' then return jsonb_build_object('ok',false,'reason','no-domain-loadout'); end if;
 if coalesce((mp.expansion_state->>'active')::boolean,false) then return jsonb_build_object('ok',false,'reason','domain-active'); end if;
 if mp.expansion_used and mp.expansion_id<>'jackpot_bagua' then return jsonb_build_object('ok',false,'reason','domain-already-used'); end if;
 select * into pw from public.pvp_match_pows where match_id=p_match and user_id=p_user and pow_id=p_pow for update;
 if not found or pw.eliminated or pw.hp<=0 or pw.slot not in (select slot from public.powder_pvp_active_slots(p_match,p_user)) then return jsonb_build_object('ok',false,'reason','pow-not-active'); end if;
 select * into cat from public.pvp_pow_catalog where pow_id=p_pow;
 insert into public.pvp_domain_round_v2172(match_id,user_id) values(p_match,p_user) on conflict do nothing;
 select * into rs from public.pvp_domain_round_v2172 where match_id=p_match and user_id=p_user for update;
 if p_pow=any(rs.seen_pow_ids) then return jsonb_build_object('ok',true,'gained',0,'repeatBlocked',true,'round',rs.round_no); end if;
 gain:=public.powder_pvp_domain_charge_gain_v2172(mp.expansion_id,cat.element,cat.role);
 insert into public.pvp_domain_charge_v2172(match_id,user_id,pow_id,charge,last_gain_round) values(p_match,p_user,p_pow,0,0) on conflict do nothing;
 select charge into before_charge from public.pvp_domain_charge_v2172 where match_id=p_match and user_id=p_user and pow_id=p_pow for update;
 after_charge:=least(100,before_charge+gain);
 update public.pvp_domain_charge_v2172 set charge=after_charge,last_gain_round=rs.round_no,updated_at=now() where match_id=p_match and user_id=p_user and pow_id=p_pow;
 seen:=array_append(rs.seen_pow_ids,p_pow);
 select coalesce(array_agg(pow_id order by slot),'{}'::text[]) into active_ids from public.pvp_match_pows where match_id=p_match and user_id=p_user and not eliminated and hp>0 and slot in (select slot from public.powder_pvp_active_slots(p_match,p_user));
 if coalesce(cardinality(active_ids),0)>0 and active_ids <@ seen then completed:=true; update public.pvp_domain_round_v2172 set round_no=rs.round_no+1,seen_pow_ids='{}',updated_at=now() where match_id=p_match and user_id=p_user;
 else update public.pvp_domain_round_v2172 set seen_pow_ids=seen,updated_at=now() where match_id=p_match and user_id=p_user; end if;
 return jsonb_build_object('ok',true,'domainVersion','21.7.2','powId',p_pow,'domainId',mp.expansion_id,'round',rs.round_no,'gained',after_charge-before_charge,'before',before_charge,'after',after_charge,'ready',after_charge>=100,'roundCompleted',completed);
end $$;
revoke all on function public.powder_pvp_domain_charge_award_v2172(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.powder_pvp_domain_charge_event_v2172() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.event_type='skill' and new.actor_user_id is not null and coalesce(new.actor_pow_id,'')<>'' then perform public.powder_pvp_domain_charge_award_v2172(new.match_id,new.actor_user_id,new.actor_pow_id); end if; return new; end $$;
drop trigger if exists trg_pvp_domain_charge_event_v2172 on public.pvp_match_events;
create trigger trg_pvp_domain_charge_event_v2172 after insert on public.pvp_match_events for each row execute function public.powder_pvp_domain_charge_event_v2172();
revoke all on function public.powder_pvp_domain_charge_event_v2172() from public,anon,authenticated;

create or replace function public.powder_pvp_domain_charge_state_v2172(p_match uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); m public.pvp_matches; rows jsonb; rounds jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into m from public.pvp_matches where id=p_match;
 if not found or uid not in (m.player_a,m.player_b) then raise exception 'PVP_MATCH_FORBIDDEN'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('userId',c.user_id,'powId',p.pow_id,'slot',p.slot,'charge',coalesce(c.charge,0),'round',coalesce(c.last_gain_round,0),'element',cat.element,'role',cat.role,'gain',public.powder_pvp_domain_charge_gain_v2172(mp.expansion_id,cat.element,cat.role)) order by p.user_id,p.slot),'[]'::jsonb) into rows from public.pvp_match_pows p join public.pvp_match_players mp on mp.match_id=p.match_id and mp.user_id=p.user_id left join public.pvp_domain_charge_v2172 c on c.match_id=p.match_id and c.user_id=p.user_id and c.pow_id=p.pow_id left join public.pvp_pow_catalog cat on cat.pow_id=p.pow_id where p.match_id=p_match;
 select coalesce(jsonb_agg(jsonb_build_object('userId',x.user_id,'round',coalesce(r.round_no,1),'seenPowIds',coalesce(r.seen_pow_ids,'{}'::text[]),'domainId',x.expansion_id)),'[]'::jsonb) into rounds from public.pvp_match_players x left join public.pvp_domain_round_v2172 r on r.match_id=x.match_id and r.user_id=x.user_id where x.match_id=p_match;
 return jsonb_build_object('ok',true,'version','21.7.2','matchId',p_match,'me',uid,'rows',rows,'rounds',rounds);
end $$;
grant execute on function public.powder_pvp_domain_charge_state_v2172(uuid) to authenticated;

DO $$ begin if to_regprocedure('public.powder_pvp_domain_activate_legacy_v2171(uuid,uuid,text,text,text,integer)') is null then execute 'alter function public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer) rename to powder_pvp_domain_activate_legacy_v2171'; end if; end $$;
create or replace function public.powder_pvp_domain_activate_v1880(p_user uuid,p_match uuid,p_kind text,p_id text,p_client_action_id text,p_expected_turn_no integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare chosen public.pvp_domain_charge_v2172; r jsonb;
begin
 if p_kind<>'expansion' then return public.powder_pvp_domain_activate_legacy_v2171(p_user,p_match,p_kind,p_id,p_client_action_id,p_expected_turn_no); end if;
 select c.* into chosen from public.pvp_domain_charge_v2172 c join public.pvp_match_pows p on p.match_id=c.match_id and p.user_id=c.user_id and p.pow_id=c.pow_id where c.match_id=p_match and c.user_id=p_user and c.charge>=100 and not p.eliminated and p.hp>0 and p.slot in (select slot from public.powder_pvp_active_slots(p_match,p_user)) order by c.charge desc,p.speed desc,p.slot asc limit 1 for update of c;
 if not found then raise exception 'DOMAIN_CHARGE_REQUIRED: cần một Pow active đạt 100%% Lãnh Địa'; end if;
 update public.pvp_domain_charge_v2172 set charge=0,updated_at=now() where match_id=p_match and user_id=p_user and pow_id=chosen.pow_id;
 r:=public.powder_pvp_domain_activate_legacy_v2171(p_user,p_match,p_kind,p_id,p_client_action_id,p_expected_turn_no);
 return coalesce(r,'{}'::jsonb)||jsonb_build_object('domainChargeVersion','21.7.2','domainChargePowId',chosen.pow_id,'domainChargeSpent',100);
end $$;
revoke all on function public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer) to service_role;
