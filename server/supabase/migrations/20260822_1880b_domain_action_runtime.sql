-- Powder 18.8.0 - server-authoritative domain action runtime

create or replace function public.powder_pvp_status_decay(p jsonb)
returns jsonb language plpgsql immutable set search_path='public' as $fn$
declare r jsonb:=coalesce(p,'{}'::jsonb);k text;v int;
begin
 foreach k in array array['Burn','Poison','Freeze','Stun','Slow','Defense Up','Attack Up','AP Up','Regeneration','Shock','AntiHeal','DomainCorrosion'] loop
   v:=coalesce((r->>k)::int,0);
   if v>1 then r:=jsonb_set(r,array[k],to_jsonb(v-1),true); elsif v=1 then r:=r-k; end if;
 end loop;
 if coalesce((r->>'AntiHeal')::int,0)=0 then r:=r-'AntiHealPct'; end if;
 return r;
end $fn$;

create or replace function public.powder_pvp_domain_state_guard_v1880()
returns trigger language plpgsql security definer set search_path='public' as $fn$
declare mp public.pvp_match_players; m public.pvp_matches; id text; active boolean:=false; simple_active boolean:=false; simple_id text; requested int; reduction numeric:=0; anti numeric:=0;
begin
 select * into mp from public.pvp_match_players where match_id=new.match_id and user_id=new.user_id;
 select * into m from public.pvp_matches where id=new.match_id;
 if not found then return new; end if;
 id:=mp.expansion_state->>'id'; active:=coalesce((mp.expansion_state->>'active')::boolean,false);
 simple_active:=coalesce((mp.simple_state->>'active')::boolean,false) and coalesce((mp.simple_state->>'expiresTurn')::int,0)>coalesce(m.turn_no,0);
 simple_id:=mp.simple_state->>'id';

 if new.hp<old.hp then
   requested:=old.hp-new.hp;
   if active and id='diamond_guard' then reduction:=greatest(reduction,.30); end if;
   if simple_active and simple_id='tide' then reduction:=greatest(reduction,.20); end if;
   if reduction>0 then
     new.hp:=greatest(0,old.hp-greatest(0,round(requested*(1-reduction))));
     new.eliminated:=(new.hp<=0);
     perform public.powder_pvp_domain_log_v1880(new.match_id,m.current_player,null,new.pow_id,'domain_guard',jsonb_build_object('kind','incoming_reduction','domainId',case when active and id='diamond_guard' then id else simple_id end,'requested',requested,'applied',old.hp-new.hp,'reduction',reduction));
   end if;
 end if;

 if new.hp>old.hp and coalesce((old.statuses->>'AntiHeal')::int,0)>0 then
   anti:=greatest(0,least(.90,coalesce((old.statuses->>'AntiHealPct')::numeric,.30)));
   requested:=new.hp-old.hp; new.hp:=least(new.max_hp,old.hp+greatest(0,round(requested*(1-anti))));
   perform public.powder_pvp_domain_log_v1880(new.match_id,m.current_player,null,new.pow_id,'domain_guard',jsonb_build_object('kind','anti_heal','requested',requested,'applied',new.hp-old.hp,'antiHeal',anti));
 end if;

 if active and id='jackpot_bagua' and (new.hp<=0 or new.eliminated) then
   new.hp:=1;new.eliminated:=false;
   perform public.powder_pvp_domain_log_v1880(new.match_id,new.user_id,null,new.pow_id,'domain_immortal',jsonb_build_object('domainId',id,'hp',1));
 end if;
 return new;
end $fn$;
drop trigger if exists trg_pvp_domain_state_guard_v1880 on public.pvp_match_pows;
create trigger trg_pvp_domain_state_guard_v1880 before update on public.pvp_match_pows for each row execute function public.powder_pvp_domain_state_guard_v1880();

create or replace function public.powder_pvp_domain_expire_v1880(p_match uuid,p_user uuid,p_reason text default 'duration')
returns void language plpgsql security definer set search_path='public' as $fn$
declare mp public.pvp_match_players; m public.pvp_matches; id text; other uuid;
begin
 select * into mp from public.pvp_match_players where match_id=p_match and user_id=p_user for update;
 if not found or not coalesce((mp.expansion_state->>'active')::boolean,false) then return; end if;
 select * into m from public.pvp_matches where id=p_match; id:=mp.expansion_state->>'id';
 other:=case when m.player_a=p_user then m.player_b else m.player_a end;
 if id='draw_swords' then
   update public.pvp_match_pows p set max_hp=greatest(1,round(p.max_hp/1.30)),hp=least(greatest(1,round(p.max_hp/1.30)),p.hp)
    from public.pvp_pow_catalog c where p.match_id=p_match and p.user_id=p_user and p.pow_id=c.pow_id and c.role not in('Hiệp sĩ','Đấu sĩ','Đỡ đòn');
 elsif id='frozen_silence' then
   update public.pvp_match_pows set statuses=statuses-'DomainCold' where match_id=p_match and user_id=other;
 elsif id='nine_suns' then
   update public.pvp_match_pows set statuses=statuses-'DomainSunMark' where match_id=p_match and user_id=other;
 end if;
 update public.pvp_match_players set expansion_state=jsonb_set(expansion_state,'{active}','false'::jsonb,true) where match_id=p_match and user_id=p_user;
 perform public.powder_pvp_domain_log_v1880(p_match,p_user,null,null,'domain_expansion_end',jsonb_build_object('id',id,'reason',p_reason));
end $fn$;

create or replace function public.powder_pvp_domain_consume_v1880(p_match uuid,p_user uuid,p_skipped boolean default false)
returns void language plpgsql security definer set search_path='public' as $fn$
declare mp public.pvp_match_players; rem int; state jsonb;
begin
 select * into mp from public.pvp_match_players where match_id=p_match and user_id=p_user for update;
 if not found or not coalesce((mp.expansion_state->>'active')::boolean,false) then return; end if;
 rem:=greatest(0,coalesce((mp.expansion_state->>'remainingActions')::int,1)-1);
 state:=jsonb_set(mp.expansion_state,'{remainingActions}',to_jsonb(rem),true);
 update public.pvp_match_players set expansion_state=state where match_id=p_match and user_id=p_user;
 if rem<=0 then perform public.powder_pvp_domain_expire_v1880(p_match,p_user,'duration'); end if;
end $fn$;

create or replace function public.powder_pvp_domain_finish_if_dead_v1880(p_match uuid,p_actor uuid,p_other uuid)
returns boolean language plpgsql security definer set search_path='public' as $fn$
declare m public.pvp_matches;
begin
 if public.powder_pvp_team_alive(p_match,p_other) then return false; end if;
 select * into m from public.pvp_matches where id=p_match for update;
 if m.status='active' then update public.pvp_matches set status='completed',winner_id=p_actor,finish_reason='knockout',completed_at=now() where id=p_match; end if;
 return true;
end $fn$;

create or replace function public.powder_pvp_action_v1880(
 p_user uuid,p_match uuid,p_actor text,p_target text,p_skill text,p_client_action_id text,p_expected_turn_no integer
) returns jsonb language plpgsql security definer set search_path='public' as $fn$
declare m public.pvp_matches; mp public.pvp_match_players; op public.pvp_match_players; actor public.pvp_match_pows; target public.pvp_match_pows;
 cat public.pvp_pow_catalog; cfg public.pvp_domain_catalog_v1880; prior public.pvp_action_receipts_v1870; applied jsonb; ev public.pvp_match_events;
 other uuid; myid text; enemyid text; myactive boolean:=false; enemyactive boolean:=false; sactive boolean:=false; enemy_simple_resist numeric:=0;
 mult numeric:=1; domain_bonus numeric:=0; question_scale numeric:=1; ownerq public.pvp_domain_question_sessions_v1880; hostileq public.pvp_domain_question_sessions_v1880;
 old_atk int;old_ap int;old_crit numeric;old_cd numeric;old_energy int;old_tdef int; zero_damage boolean:=false; old_target_hp int:=0; old_target_shield int:=0;
 before_event bigint:=0; damage int:=0;heal int:=0; role_name text; state jsonb; marks int; gain int; bursts int; sword_id text;sword_name text;sword_status text; sword_target text; d jsonb;
 used jsonb; old_target_frozen boolean:=false; qi int; newqi int; oldqi int; threshold50 boolean:=false; threshold100 boolean:=false; t record; active_target boolean:=false;
begin
 if p_client_action_id is null or char_length(trim(p_client_action_id)) not between 8 and 96 then raise exception 'PvP actionId không hợp lệ'; end if;
 select * into prior from public.pvp_action_receipts_v1870 where match_id=p_match and user_id=p_user and client_action_id=p_client_action_id;
 if found then return prior.result||jsonb_build_object('ok',true,'idempotent',true,'domainVersion','18.8.0'); end if;

 select * into m from public.pvp_matches where id=p_match for update;
 if not found or m.status<>'active' then raise exception 'Trận PvP chưa ở trạng thái chiến đấu'; end if;
 if m.current_player<>p_user then raise exception 'Chưa đến lượt của bạn'; end if;
 if m.turn_no<>p_expected_turn_no then raise exception 'STALE_PVP_STATE: server turn %, client turn %',m.turn_no,p_expected_turn_no; end if;
 other:=case when m.player_a=p_user then m.player_b else m.player_a end;
 select * into mp from public.pvp_match_players where match_id=p_match and user_id=p_user for update;
 select * into op from public.pvp_match_players where match_id=p_match and user_id=other for update;
 if coalesce((mp.simple_state->>'active')::boolean,false) and coalesce((mp.simple_state->>'expiresTurn')::int,0)<=m.turn_no then
   update public.pvp_match_players set simple_state='{}'::jsonb where match_id=p_match and user_id=p_user; mp.simple_state:='{}'::jsonb;
 end if;
 sactive:=coalesce((mp.simple_state->>'active')::boolean,false) and coalesce((mp.simple_state->>'expiresTurn')::int,0)>m.turn_no;
 myactive:=coalesce((mp.expansion_state->>'active')::boolean,false); myid:=mp.expansion_state->>'id';
 enemyactive:=coalesce((op.expansion_state->>'active')::boolean,false); enemyid:=op.expansion_state->>'id';
 enemy_simple_resist:=public.powder_pvp_simple_resist_v1880(p_match,other,m.turn_no);

 if p_skill<>'pass' then
   select * into actor from public.pvp_match_pows where match_id=p_match and user_id=p_user and pow_id=p_actor for update;
   if not found then raise exception 'Pow hành động không hợp lệ'; end if;
   select * into cat from public.pvp_pow_catalog where pow_id=actor.pow_id; role_name:=cat.role;
   old_atk:=actor.atk;old_ap:=actor.ap;old_crit:=actor.crit_rate;old_cd:=actor.crit_damage;old_energy:=actor.energy;
   if p_target is not null and p_target<>'' then
     select * into target from public.pvp_match_pows where match_id=p_match and user_id=other and pow_id=p_target for update;
     if found then old_target_hp:=target.hp;old_target_shield:=greatest(0,coalesce((target.statuses->>'shield')::int,0));old_target_frozen:=coalesce((target.statuses->>'Freeze')::int,0)>0;active_target:=true;old_tdef:=target.def; end if;
   end if;

   if sactive then
     mult:=mult*1.25;
     if mp.simple_state->>'id'='crimson' then actor.crit_rate:=least(100,actor.crit_rate+10);actor.crit_damage:=actor.crit_damage+50; end if;
   end if;
   if myactive then
     select * into cfg from public.pvp_domain_catalog_v1880 where id=myid;
     domain_bonus:=coalesce((cfg.config->>'damageBonus')::numeric,0);
     if myid='draw_swords' and role_name in('Hiệp sĩ','Đấu sĩ','Đỡ đòn') then domain_bonus:=0; end if;
     domain_bonus:=domain_bonus*(1-enemy_simple_resist);
     mult:=mult*(1+domain_bonus);
     if myid='rebirth_wood' and coalesce((mp.expansion_state->>'sinhQi')::int,0)>=75 then mult:=mult*1.20; end if;
   end if;
   if coalesce((actor.statuses->>'DomainCold')::int,0)>0 then mult:=mult*greatest(.50,1-.07*least(3,(actor.statuses->>'DomainCold')::int)); end if;
   if coalesce((actor.statuses->>'DomainCorrosion')::int,0)>0 then mult:=mult*.90; end if;

   if myactive and myid='limitless_void' then
     select * into ownerq from public.pvp_domain_question_sessions_v1880 where match_id=p_match and user_id=p_user and turn_no=m.turn_no and gate='owner' and domain_owner=p_user;
     if not found or not ownerq.answered then raise exception 'DOMAIN_QUESTIONS_REQUIRED: Vô Lượng cần 5 câu của chủ Lãnh Địa'; end if;
     question_scale:=question_scale*(1+.20*ownerq.correct_count);
   end if;
   if enemyactive and enemyid='limitless_void' then
     select * into hostileq from public.pvp_domain_question_sessions_v1880 where match_id=p_match and user_id=p_user and turn_no=m.turn_no and gate='hostile' and domain_owner=other;
     if not found or not hostileq.answered then raise exception 'DOMAIN_QUESTIONS_REQUIRED: Vô Lượng của đối thủ yêu cầu 5 câu'; end if;
     if hostileq.wrong_count>=2 then question_scale:=0; elsif hostileq.wrong_count=1 then question_scale:=question_scale*.50; end if;
   end if;
   mult:=mult*question_scale;
   if active_target and coalesce((target.statuses->>'DomainCorrosion')::int,0)>0 then update public.pvp_match_pows set def=greatest(1,round(def*.85)) where match_id=p_match and user_id=other and pow_id=p_target; end if;
   if myactive and myid='jackpot_bagua' then update public.pvp_match_pows set energy=100 where match_id=p_match and user_id=p_user and pow_id=p_actor; actor.energy:=100; end if;
   if mult<=0 then zero_damage:=true;mult:=.01; end if;
   update public.pvp_match_pows set atk=greatest(1,round(old_atk*mult)),ap=greatest(1,round(old_ap*mult)),crit_rate=actor.crit_rate,crit_damage=actor.crit_damage where match_id=p_match and user_id=p_user and pow_id=p_actor;
 end if;
 select coalesce(max(id),0) into before_event from public.pvp_match_events where match_id=p_match;

 applied:=public.powder_pvp_action_v1870(p_user,p_match,coalesce(p_actor,''),coalesce(p_target,''),coalesce(p_skill,'basic'),p_client_action_id,p_expected_turn_no);

 if p_skill<>'pass' then
   update public.pvp_match_pows set atk=old_atk,ap=old_ap,crit_rate=old_crit,crit_damage=old_cd where match_id=p_match and user_id=p_user and pow_id=p_actor;
   if active_target and old_tdef is not null then update public.pvp_match_pows set def=old_tdef where match_id=p_match and user_id=other and pow_id=p_target; end if;
 end if;
 if coalesce((applied->>'idempotent')::boolean,false) then return applied||jsonb_build_object('domainVersion','18.8.0'); end if;

 select * into ev from public.pvp_match_events where match_id=p_match and id>before_event and actor_user_id=p_user and event_type='skill' order by id desc limit 1;
 if found then damage:=greatest(0,coalesce((ev.payload->>'damage')::int,0));heal:=greatest(0,coalesce((ev.payload->>'heal')::int,0)); end if;
 if zero_damage and active_target and found then
   update public.pvp_match_pows set hp=old_target_hp,eliminated=false,statuses=case when old_target_shield>0 then jsonb_set(statuses,'{shield}',to_jsonb(old_target_shield),true) else statuses-'shield' end where match_id=p_match and user_id=other and pow_id=p_target;
   update public.pvp_match_events set payload=jsonb_set(jsonb_set(jsonb_set(payload,'{damage}',to_jsonb(0),true),'{rawDamage}',to_jsonb(0),true),'{absorbed}',to_jsonb(0),true)||jsonb_build_object('targetHp',old_target_hp,'limitlessZeroDamage',true) where id=ev.id;
   damage:=0;
   perform public.powder_pvp_domain_log_v1880(p_match,p_user,p_actor,p_target,'domain_limitless_scale',jsonb_build_object('scale',0,'wrong',hostileq.wrong_count,'serverVerified',true));
 end if;

 if sactive and mp.simple_state->>'id'='verdant' and damage>0 then
   update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(damage*.20))) where match_id=p_match and user_id=p_user and pow_id=p_actor;
 end if;

 if myactive and p_skill<>'pass' and found and damage>0 then
   if myid='nine_suns' and active_target then
     select * into target from public.pvp_match_pows where match_id=p_match and user_id=other and pow_id=p_target for update;
     marks:=least(4,greatest(0,coalesce((target.statuses->>'DomainSunMark')::int,0))+(case when cat.element='fire' then 2 else 1 end));
     update public.pvp_match_pows set statuses=jsonb_set(jsonb_set(statuses,'{Burn}',to_jsonb(3),true),'{DomainSunMark}',to_jsonb(marks),true) where match_id=p_match and user_id=other and pow_id=p_target;
     if marks>=4 then
       d:=public.powder_pvp_domain_direct_damage_v1880(p_match,p_user,other,p_target,.12,'Bạo Viêm','Burn',3);
       update public.pvp_match_pows set statuses=jsonb_set(statuses,'{DomainSunMark}',to_jsonb(0),true) where match_id=p_match and user_id=other and pow_id=p_target;
       perform public.powder_pvp_domain_log_v1880(p_match,p_user,p_actor,p_target,'domain_burst',jsonb_build_object('id',myid,'kind','sun_mark','damage',d->>'damage'));
     end if;
   elsif myid='infinite_strike' and active_target then
     gain:=case p_skill when 'ult' then 3 when 's2' then 2 when 's1' then 2 else 1 end;
     state:=(select expansion_state from public.pvp_match_players where match_id=p_match and user_id=p_user for update);
     marks:=coalesce((state->>'comboHits')::int,0)+gain;bursts:=coalesce((state->>'pursuitBursts')::int,0);
     while marks>=4 loop
       marks:=marks-4;bursts:=bursts+1;d:=public.powder_pvp_domain_direct_damage_v1880(p_match,p_user,other,p_target,.16,'Thiên Kích Truy Kích',null,0);
       perform public.powder_pvp_domain_log_v1880(p_match,p_user,p_actor,p_target,'domain_pursuit',jsonb_build_object('count',bursts,'damage',d->>'damage'));
       if bursts%2=0 then for t in select pow_id from public.pvp_match_pows where match_id=p_match and user_id=other and slot in(select slot from public.powder_pvp_active_slots(p_match,other)) loop perform public.powder_pvp_domain_direct_damage_v1880(p_match,p_user,other,t.pow_id,.06,'Thiên Kích Bạo Liên',null,0); end loop; end if;
     end loop;
     state:=jsonb_set(jsonb_set(state,'{comboHits}',to_jsonb(marks),true),'{pursuitBursts}',to_jsonb(bursts),true);update public.pvp_match_players set expansion_state=state where match_id=p_match and user_id=p_user;
   elsif myid='frozen_silence' and active_target then
     select * into target from public.pvp_match_pows where match_id=p_match and user_id=other and pow_id=p_target for update;
     if old_target_frozen then
       d:=public.powder_pvp_domain_direct_damage_v1880(p_match,p_user,other,p_target,.15,'Phá Băng',null,0);
       update public.pvp_match_pows set statuses=jsonb_set(statuses,'{DomainCorrosion}',to_jsonb(2),true) where match_id=p_match and user_id=other and pow_id=p_target;
     else
       marks:=least(3,coalesce((target.statuses->>'DomainCold')::int,0)+1);
       update public.pvp_match_pows set statuses=jsonb_set(statuses,'{DomainCold}',to_jsonb(marks),true) where match_id=p_match and user_id=other and pow_id=p_target;
       if marks>=3 then update public.pvp_match_pows set statuses=jsonb_set(statuses,'{Freeze}',to_jsonb(1),true) where match_id=p_match and user_id=other and pow_id=p_target; end if;
     end if;
   elsif myid='myriad_poison' and active_target then
     select * into target from public.pvp_match_pows where match_id=p_match and user_id=other and pow_id=p_target for update;
     marks:=least(6,coalesce((target.statuses->>'DomainPoisonStacks')::int,0)+1);
     update public.pvp_match_pows set statuses=jsonb_set(jsonb_set(jsonb_set(jsonb_set(statuses,'{Poison}',to_jsonb(3),true),'{DomainPoisonStacks}',to_jsonb(marks),true),'{AntiHeal}',to_jsonb(2),true),'{AntiHealPct}',to_jsonb(.30),true) where match_id=p_match and user_id=other and pow_id=p_target;
     if marks>=6 then update public.pvp_match_pows set statuses=jsonb_set(statuses,'{DomainCorrosion}',to_jsonb(2),true) where match_id=p_match and user_id=other and pow_id=p_target; end if;
   elsif myid='rebirth_wood' then
     state:=(select expansion_state from public.pvp_match_players where match_id=p_match and user_id=p_user for update);oldqi:=coalesce((state->>'sinhQi')::int,25);
     gain:=case when heal>0 then greatest(1,round(heal::numeric/greatest(1,actor.max_hp)*100)) else 0 end;newqi:=least(100,oldqi+gain);threshold50:=oldqi<50 and newqi>=50;threshold100:=oldqi<100 and newqi>=100;
     if threshold50 then update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(max_hp*.06))) where match_id=p_match and user_id=p_user and not eliminated; end if;
     if threshold100 then
       update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(max_hp*.20))),statuses=jsonb_set((statuses-'Burn'-'Poison'-'Slow'-'Stun'-'Freeze'),'{shield}',to_jsonb(greatest(coalesce((statuses->>'shield')::int,0),round(max_hp*.15)::int)),true) where match_id=p_match and user_id=p_user and not eliminated;
       newqi:=0;perform public.powder_pvp_domain_log_v1880(p_match,p_user,p_actor,null,'domain_rebirth',jsonb_build_object('healPct',.20,'shieldPct',.15,'cleanse',true));
     end if;
     state:=jsonb_set(state,'{sinhQi}',to_jsonb(newqi),true);update public.pvp_match_players set expansion_state=state where match_id=p_match and user_id=p_user;
   elsif myid='draw_swords' then
     state:=(select expansion_state from public.pvp_match_players where match_id=p_match and user_id=p_user for update);used:=coalesce(state->'swordsUsed','[]'::jsonb);
     select x.id,x.name,x.status into sword_id,sword_name,sword_status from (values
      ('flame','Xích Diệm Phần Thiên Kiếm','Burn'),('poison','Vạn Độc Phệ Tâm Kiếm','Poison'),('thunder','Thiên Lôi Trấn Phá Kiếm','Shock'),('sever','Đoạn Sinh Tuyệt Mạch Kiếm','AntiHeal'),('ice','Huyền Băng Phong Ngục Kiếm','Freeze')) x(id,name,status)
      where not (used ? x.id) order by random() limit 1;
     select p.pow_id into sword_target from public.pvp_match_pows p where p.match_id=p_match and p.user_id=other and p.slot in(select slot from public.powder_pvp_active_slots(p_match,other)) order by random() limit 1;
     if sword_id is not null and sword_target is not null then
       d:=public.powder_pvp_domain_direct_damage_v1880(p_match,p_user,other,sword_target,.20,sword_name,sword_status,case when sword_status in('Freeze') then 1 else 2 end);
       used:=used||jsonb_build_array(sword_id);state:=jsonb_set(state,'{swordsUsed}',used,true);update public.pvp_match_players set expansion_state=state where match_id=p_match and user_id=p_user;
       perform public.powder_pvp_domain_log_v1880(p_match,p_user,p_actor,sword_target,'domain_sword',jsonb_build_object('swordId',sword_id,'name',sword_name,'status',sword_status,'damage',d->>'damage','sureHit',true,'remaining',5-jsonb_array_length(used)));
     end if;
     if role_name not in('Hiệp sĩ','Đấu sĩ','Đỡ đòn') and damage>0 then update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(damage*.30))) where match_id=p_match and user_id=p_user and pow_id=p_actor; end if;
   end if;
 end if;

 if myactive and myid='jackpot_bagua' then update public.pvp_match_pows set energy=100 where match_id=p_match and user_id=p_user and not eliminated; end if;
 perform public.powder_pvp_domain_consume_v1880(p_match,p_user,p_skill='pass');
 perform public.powder_pvp_domain_finish_if_dead_v1880(p_match,p_user,other);
 return coalesce(applied,'{}'::jsonb)||jsonb_build_object('domainVersion','18.8.0','domainId',case when myactive then myid else null end,'questionScale',question_scale);
end $fn$;

revoke all on function public.powder_pvp_domain_state_guard_v1880() from public,anon,authenticated;
revoke all on function public.powder_pvp_domain_expire_v1880(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.powder_pvp_domain_consume_v1880(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.powder_pvp_domain_finish_if_dead_v1880(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.powder_pvp_domain_state_guard_v1880(),public.powder_pvp_domain_expire_v1880(uuid,uuid,text),public.powder_pvp_domain_consume_v1880(uuid,uuid,boolean),public.powder_pvp_domain_finish_if_dead_v1880(uuid,uuid,uuid),public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer) to service_role;

-- Any server-side domain damage that removes the last Pow must close the match immediately.
create or replace function public.powder_pvp_domain_knockout_v1880()
returns trigger language plpgsql security definer set search_path='public' as $fn$
declare m public.pvp_matches; winner uuid;
begin
 if old.hp>0 and (new.hp<=0 or new.eliminated) and not public.powder_pvp_team_alive(new.match_id,new.user_id) then
   select * into m from public.pvp_matches where id=new.match_id for update;
   if found and m.status='active' then
     winner:=case when m.player_a=new.user_id then m.player_b else m.player_a end;
     update public.pvp_matches set status='completed',winner_id=winner,finish_reason='knockout',completed_at=now() where id=new.match_id and status='active';
   end if;
 end if;
 return new;
end $fn$;
drop trigger if exists trg_pvp_domain_knockout_v1880 on public.pvp_match_pows;
create trigger trg_pvp_domain_knockout_v1880 after update on public.pvp_match_pows for each row execute function public.powder_pvp_domain_knockout_v1880();
revoke all on function public.powder_pvp_domain_knockout_v1880() from public,anon,authenticated;
grant execute on function public.powder_pvp_domain_knockout_v1880() to service_role;
