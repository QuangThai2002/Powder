-- Powder 18.8.0 - Banh Truong Lanh Dia server-authoritative foundation
-- Locked roster: exactly 9 expansions = 6 normal + 3 special. No tenth expansion.

create table if not exists public.pvp_domain_catalog_v1880(
  id text primary key,
  name text not null unique,
  kind text not null check(kind in('normal','special')),
  branch text not null check(branch in('fire','water','leaf')),
  direction text not null,
  duration_actions smallint not null check(duration_actions between 1 and 8),
  server_verified boolean not null default true,
  config jsonb not null default '{}'::jsonb
);

insert into public.pvp_domain_catalog_v1880(id,name,kind,branch,direction,duration_actions,server_verified,config) values
 ('nine_suns','Cửu Nhật Phần Thiên Giới','normal','fire','burn',4,true,'{"damageBonus":0.60,"burnSureHit":true,"sunMarkCap":4,"burstMaxHp":0.12}'::jsonb),
 ('infinite_strike','Thiên Kích Vô Tận Giới','normal','fire','multi_hit',4,true,'{"damageBonus":0.60,"comboSeed":1,"comboCap":4,"pursuitMaxHp":0.16,"secondPursuitAoeMaxHp":0.06}'::jsonb),
 ('limitless_void','Vô Lượng Không Xứ','special','fire','question',2,true,'{"damageBonus":0.50,"questionsPerGate":5,"ownerBonusPerCorrect":0.20,"hostileOneWrongScale":0.50,"hostileTwoWrongScale":0.0,"ownerTenCorrectBurstMaxHp":0.50}'::jsonb),
 ('frozen_silence','Huyền Băng Tịch Diệt Giới','normal','water','freeze',4,true,'{"damageBonus":0.60,"coldCap":3,"speedPenaltyPerStack":0.10,"damagePenaltyPerStack":0.07,"shatterMaxHp":0.15}'::jsonb),
 ('diamond_guard','Bất Động Kim Cương Giới','normal','water','defense',4,true,'{"damageBonus":0.45,"incomingReduction":0.30,"openingShieldMaxHp":0.12}'::jsonb),
 ('jackpot_bagua','Tọa Sát Bát Đồ','special','water','jackpot',3,true,'{"damageBonus":0.50,"baseChance":0.25,"failStep":0.05,"immortal":true,"fullEnergy":true,"sureHit":true}'::jsonb),
 ('myriad_poison','Vạn Độc Phệ Sinh Giới','normal','leaf','poison',4,true,'{"damageBonus":0.55,"poisonStackCap":6,"antiHeal":0.30}'::jsonb),
 ('rebirth_wood','Vạn Mộc Luân Sinh Giới','normal','leaf','heal',4,true,'{"damageBonus":0.60,"openingSinhQi":25,"healStage":25,"teamHealStage":50,"damageStage":75,"rebirthStage":100}'::jsonb),
 ('draw_swords','Rút Kiếm Ra','special','leaf','swords',5,true,'{"damageBonus":0.30,"hpBonus":0.30,"lifesteal":0.30,"swordMaxHp":0.20,"swordsSureHit":true,"restrictedRoles":["Hiệp sĩ","Đấu sĩ","Đỡ đòn"]}'::jsonb)
on conflict(id) do update set name=excluded.name,kind=excluded.kind,branch=excluded.branch,direction=excluded.direction,
 duration_actions=excluded.duration_actions,server_verified=true,config=excluded.config;

do $locked$
declare total int; specials int; normals int;
begin
  select count(*),count(*) filter(where kind='special'),count(*) filter(where kind='normal') into total,specials,normals from public.pvp_domain_catalog_v1880;
  if total<>9 or specials<>3 or normals<>6 then
    raise exception 'POWDER_DOMAIN_LOCK_V1880: expected 9 total / 6 normal / 3 special, got % / % / %',total,normals,specials;
  end if;
end $locked$;

create table if not exists public.pvp_simple_domain_catalog_v1880(
  id text primary key,
  name text not null unique,
  branch text not null check(branch in('fire','water','leaf')),
  config jsonb not null
);
insert into public.pvp_simple_domain_catalog_v1880(id,name,branch,config) values
 ('crimson','Xích Viêm Sát Giới','fire','{"damageBonus":0.25,"critRateBonus":10,"critDamageBonus":50,"resistByLevel":{"1":0.30,"2":0.40,"3":0.50}}'::jsonb),
 ('tide','Huyền Thủy Trấn Giới','water','{"damageBonus":0.25,"defenseBonus":0.25,"hpBonus":0.25,"resistByLevel":{"1":0.30,"2":0.40,"3":0.50}}'::jsonb),
 ('verdant','Thanh Mộc Huyết Giới','leaf','{"damageBonus":0.25,"lifesteal":0.20,"overhealToShield":true,"resistByLevel":{"1":0.30,"2":0.40,"3":0.50}}'::jsonb)
on conflict(id) do update set name=excluded.name,branch=excluded.branch,config=excluded.config;

alter table public.pvp_match_players add column if not exists simple_id text;
alter table public.pvp_match_players add column if not exists simple_level smallint not null default 1;
alter table public.pvp_match_players add column if not exists simple_charges smallint not null default 3;
alter table public.pvp_match_players add column if not exists simple_state jsonb not null default '{}'::jsonb;
alter table public.pvp_match_players add column if not exists expansion_id text;
alter table public.pvp_match_players add column if not exists expansion_used boolean not null default false;
alter table public.pvp_match_players add column if not exists expansion_state jsonb not null default '{}'::jsonb;
alter table public.pvp_match_players add column if not exists domain_loadout_locked boolean not null default false;

create table if not exists public.pvp_domain_action_receipts_v1880(
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  user_id uuid not null,
  client_action_id text not null,
  action_kind text not null,
  expected_turn_no integer not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key(match_id,user_id,client_action_id),
  check(char_length(client_action_id) between 8 and 96)
);

create table if not exists public.pvp_domain_question_sessions_v1880(
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  user_id uuid not null,
  turn_no integer not null,
  gate text not null check(gate in('owner','hostile')),
  domain_owner uuid not null,
  question_ids text[] not null,
  answered boolean not null default false,
  answers jsonb not null default '[]'::jsonb,
  correct_count smallint not null default 0,
  wrong_count smallint not null default 0,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  unique(match_id,user_id,turn_no,gate,domain_owner)
);

create index if not exists pvp_domain_question_turn_v1880 on public.pvp_domain_question_sessions_v1880(match_id,user_id,turn_no);

create or replace function public.powder_pvp_lock_team_v1880(p_user uuid,p_match uuid,p_team jsonb,p_domain jsonb)
returns jsonb language plpgsql security definer set search_path='public' as $fn$
declare sid text; eid text; lvl int; r jsonb;
begin
  sid:=coalesce(nullif(p_domain->>'simpleId',''),'crimson');
  eid:=coalesce(nullif(p_domain->>'expansionId',''),'nine_suns');
  lvl:=greatest(1,least(3,coalesce((p_domain->>'simpleLevel')::int,1)));
  if not exists(select 1 from public.pvp_simple_domain_catalog_v1880 where id=sid) then raise exception 'Giản Dị Lãnh Địa không hợp lệ'; end if;
  if not exists(select 1 from public.pvp_domain_catalog_v1880 where id=eid) then raise exception 'Bành Trướng Lãnh Địa không hợp lệ'; end if;
  update public.pvp_match_players set simple_id=sid,simple_level=lvl,simple_charges=3,simple_state='{}'::jsonb,
    expansion_id=eid,expansion_used=false,expansion_state='{}'::jsonb,domain_loadout_locked=true
    where match_id=p_match and user_id=p_user;
  if not found then raise exception 'Không tìm thấy người chơi trong phòng PvP'; end if;
  r:=public.powder_pvp_lock_team(p_user,p_match,p_team);
  return coalesce(r,'{}'::jsonb)||jsonb_build_object('domainLoadout',jsonb_build_object('simpleId',sid,'simpleLevel',lvl,'expansionId',eid),'domainVersion','18.8.0');
end $fn$;

create or replace function public.powder_pvp_simple_resist_v1880(p_match uuid,p_user uuid,p_turn int)
returns numeric language plpgsql stable security definer set search_path='public' as $fn$
declare mp public.pvp_match_players; lvl int; active boolean;
begin
 select * into mp from public.pvp_match_players where match_id=p_match and user_id=p_user;
 if not found then return 0; end if;
 active:=coalesce((mp.simple_state->>'active')::boolean,false) and coalesce((mp.simple_state->>'expiresTurn')::int,0)>p_turn;
 if not active then return 0; end if;
 lvl:=greatest(1,least(3,mp.simple_level));
 return case lvl when 1 then .30 when 2 then .40 else .50 end;
end $fn$;

create or replace function public.powder_pvp_domain_log_v1880(p_match uuid,p_actor uuid,p_actor_pow text,p_target_pow text,p_type text,p_payload jsonb)
returns void language sql security definer set search_path='public' as $fn$
 insert into public.pvp_match_events(match_id,turn_no,actor_user_id,actor_pow_id,target_pow_id,event_type,payload)
 select m.id,m.turn_no,p_actor,p_actor_pow,p_target_pow,p_type,coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('domainVersion','18.8.0')
 from public.pvp_matches m where m.id=p_match;
$fn$;

create or replace function public.powder_pvp_domain_direct_damage_v1880(
 p_match uuid,p_source_user uuid,p_target_user uuid,p_target_pow text,p_ratio numeric,p_label text,p_status text default null,p_status_turns int default 0
) returns jsonb language plpgsql security definer set search_path='public' as $fn$
declare m public.pvp_matches; t public.pvp_match_pows; resist numeric:=0; requested int:=0; amount int:=0; shield int:=0; absorbed int:=0; hp_damage int:=0; ns jsonb;
begin
 select * into m from public.pvp_matches where id=p_match for update;
 if not found or m.status<>'active' then return jsonb_build_object('ok',false,'damage',0); end if;
 select * into t from public.pvp_match_pows where match_id=p_match and user_id=p_target_user and pow_id=p_target_pow for update;
 if not found or t.eliminated or t.hp<=0 then return jsonb_build_object('ok',false,'damage',0); end if;
 resist:=public.powder_pvp_simple_resist_v1880(p_match,p_target_user,m.turn_no);
 requested:=greatest(1,round(t.max_hp*greatest(0,p_ratio)));
 amount:=greatest(1,round(requested*(1-resist)));
 ns:=coalesce(t.statuses,'{}'::jsonb);
 shield:=greatest(0,coalesce((ns->>'shield')::int,0)); absorbed:=least(shield,amount); shield:=shield-absorbed; hp_damage:=amount-absorbed;
 if shield>0 then ns:=jsonb_set(ns,'{shield}',to_jsonb(shield),true); else ns:=ns-'shield'; end if;
 if p_status is not null and p_status_turns>0 and t.hp-hp_damage>0 then
   if p_status='AntiHeal' then ns:=jsonb_set(jsonb_set(ns,'{AntiHeal}',to_jsonb(p_status_turns),true),'{AntiHealPct}',to_jsonb(.50),true);
   elsif p_status='Shock' then ns:=jsonb_set(jsonb_set(ns,'{Shock}',to_jsonb(p_status_turns),true),'{Slow}',to_jsonb(greatest(2,coalesce((ns->>'Slow')::int,0))),true);
   else ns:=jsonb_set(ns,array[p_status],to_jsonb(p_status_turns),true); end if;
 end if;
 update public.pvp_match_pows set hp=greatest(0,hp-hp_damage),statuses=ns,eliminated=(hp-hp_damage<=0) where match_id=p_match and user_id=p_target_user and pow_id=p_target_pow;
 perform public.powder_pvp_domain_log_v1880(p_match,p_source_user,null,p_target_pow,'domain_damage',jsonb_build_object('label',p_label,'requested',requested,'damage',hp_damage,'absorbed',absorbed,'resist',resist,'status',p_status));
 return jsonb_build_object('ok',true,'damage',hp_damage,'absorbed',absorbed,'requested',requested,'resist',resist);
end $fn$;

create or replace function public.powder_pvp_domain_activate_v1880(
 p_user uuid,p_match uuid,p_kind text,p_id text,p_client_action_id text,p_expected_turn_no integer
) returns jsonb language plpgsql security definer set search_path='public' as $fn$
declare m public.pvp_matches; mp public.pvp_match_players; cfg public.pvp_domain_catalog_v1880; prior public.pvp_domain_action_receipts_v1880;
 other uuid; chance numeric; hit boolean; attempts int:=0; state jsonb; duration int; r jsonb; turnkey int;
begin
 if p_client_action_id is null or char_length(trim(p_client_action_id)) not between 8 and 96 then raise exception 'Domain actionId không hợp lệ'; end if;
 perform pg_advisory_xact_lock(hashtextextended('powder:domain:'||p_match::text||':'||p_user::text||':'||p_client_action_id,1880));
 select * into prior from public.pvp_domain_action_receipts_v1880 where match_id=p_match and user_id=p_user and client_action_id=p_client_action_id;
 if found then return prior.result||jsonb_build_object('idempotent',true); end if;
 select * into m from public.pvp_matches where id=p_match for update;
 if not found or m.status<>'active' then raise exception 'Trận PvP chưa ở trạng thái chiến đấu'; end if;
 if m.current_player<>p_user then raise exception 'Chưa đến lượt của bạn'; end if;
 if m.turn_no<>p_expected_turn_no then raise exception 'STALE_PVP_STATE: server turn %, client turn %',m.turn_no,p_expected_turn_no; end if;
 select * into mp from public.pvp_match_players where match_id=p_match and user_id=p_user for update;
 if not found then raise exception 'Thiếu trạng thái Tamer PvP'; end if;
 other:=case when m.player_a=p_user then m.player_b else m.player_a end;

 if p_kind='simple' then
   if p_id<>mp.simple_id or not exists(select 1 from public.pvp_simple_domain_catalog_v1880 where id=p_id) then raise exception 'Giản Dị Lãnh Địa không đúng loadout'; end if;
   if mp.simple_charges<=0 then raise exception 'Đã hết 3 lần Giản Dị Lãnh Địa'; end if;
   if coalesce((mp.expansion_state->>'active')::boolean,false) then raise exception 'Bành Trướng đang hoạt động; không thể coexist với Giản Dị'; end if;
   if coalesce((mp.simple_state->>'active')::boolean,false) and coalesce((mp.simple_state->>'expiresTurn')::int,0)>m.turn_no then raise exception 'Giản Dị Lãnh Địa đang hoạt động'; end if;
   state:=jsonb_build_object('active',true,'id',p_id,'level',mp.simple_level,'startedTurn',m.turn_no,'expiresTurn',m.turn_no+2);
   update public.pvp_match_players set simple_charges=simple_charges-1,simple_state=state where match_id=p_match and user_id=p_user;
   perform public.powder_pvp_domain_log_v1880(p_match,p_user,null,null,'domain_simple',jsonb_build_object('id',p_id,'level',mp.simple_level,'charges',mp.simple_charges-1,'expiresTurn',m.turn_no+2));
   r:=jsonb_build_object('ok',true,'kind','simple','id',p_id,'charges',mp.simple_charges-1,'expiresTurn',m.turn_no+2);
 else
   if p_kind<>'expansion' then raise exception 'Loại Lãnh Địa không hợp lệ'; end if;
   if p_id<>mp.expansion_id then raise exception 'Bành Trướng không đúng loadout'; end if;
   select * into cfg from public.pvp_domain_catalog_v1880 where id=p_id;
   if not found then raise exception 'Bành Trướng không nằm trong danh sách 9 loại đã khóa'; end if;
   update public.pvp_match_players set simple_state='{}'::jsonb where match_id=p_match and user_id=p_user;
   if coalesce((mp.expansion_state->>'active')::boolean,false) then raise exception 'Bành Trướng đã hoạt động'; end if;
   if p_id<>'jackpot_bagua' and mp.expansion_used then raise exception 'Bành Trướng đã được sử dụng trong trận này'; end if;

   if p_id='jackpot_bagua' then
     attempts:=greatest(0,coalesce((mp.expansion_state->>'attempts')::int,0));
     turnkey:=coalesce((mp.expansion_state->>'lastAttemptTurn')::int,0);
     if turnkey=m.turn_no then raise exception 'Tọa Sát Bát Đồ chỉ được thử 1 lần mỗi lượt'; end if;
     chance:=least(.95,.25+attempts*.05); hit:=random()<chance; attempts:=attempts+1;
     if not hit then
       state:=jsonb_build_object('active',false,'id',p_id,'attempts',attempts,'lastAttemptTurn',m.turn_no,'lastChance',chance);
       update public.pvp_match_players set expansion_state=state where match_id=p_match and user_id=p_user;
       perform public.powder_pvp_domain_log_v1880(p_match,p_user,null,null,'domain_jackpot_fail',jsonb_build_object('id',p_id,'chance',chance,'attempt',attempts));
       r:=jsonb_build_object('ok',true,'kind','expansion','id',p_id,'jackpot',false,'chance',chance,'attempt',attempts);
       insert into public.pvp_domain_action_receipts_v1880 values(p_match,p_user,p_client_action_id,'domain_activate',p_expected_turn_no,r,now());
       return r;
     end if;
   end if;

   duration:=cfg.duration_actions;
   state:=jsonb_build_object('active',true,'id',p_id,'kind',cfg.kind,'startedTurn',m.turn_no,'remainingActions',duration,
     'attempts',case when p_id='jackpot_bagua' then attempts else 0 end,'lastAttemptTurn',case when p_id='jackpot_bagua' then m.turn_no else 0 end,
     'limitlessCorrect',0,'limitlessBurstDone',false,'comboHits',case when p_id='infinite_strike' then 1 else 0 end,'pursuitBursts',0,
     'sinhQi',case when p_id='rebirth_wood' then 25 else 0 end,'swordsUsed','[]'::jsonb);
   update public.pvp_match_players set expansion_state=state,expansion_used=true where match_id=p_match and user_id=p_user;

   if p_id='diamond_guard' then
     update public.pvp_match_pows set statuses=jsonb_set(coalesce(statuses,'{}'::jsonb),'{shield}',to_jsonb(greatest(coalesce((statuses->>'shield')::int,0),round(max_hp*.12)::int)),true)
       where match_id=p_match and user_id=p_user and not eliminated and hp>0;
   elsif p_id='myriad_poison' then
     update public.pvp_match_pows set statuses=jsonb_set(jsonb_set(jsonb_set(coalesce(statuses,'{}'::jsonb),'{Poison}',to_jsonb(3),true),'{DomainPoisonStacks}',to_jsonb(1),true),'{AntiHeal}',to_jsonb(2),true)
       where match_id=p_match and user_id=other and slot in(select slot from public.powder_pvp_active_slots(p_match,other));
   elsif p_id='frozen_silence' then
     update public.pvp_match_pows set statuses=jsonb_set(coalesce(statuses,'{}'::jsonb),'{DomainCold}',to_jsonb(1),true)
       where match_id=p_match and user_id=other and slot in(select slot from public.powder_pvp_active_slots(p_match,other));
   elsif p_id='nine_suns' then
     update public.pvp_match_pows set statuses=jsonb_set(coalesce(statuses,'{}'::jsonb),'{DomainSunMark}',to_jsonb(1),true)
       where match_id=p_match and user_id=other and slot in(select slot from public.powder_pvp_active_slots(p_match,other));
   elsif p_id='draw_swords' then
     update public.pvp_match_pows p set max_hp=greatest(1,round(p.max_hp*1.30)),hp=least(greatest(1,round(p.max_hp*1.30)),p.hp+greatest(1,round(p.max_hp*.30)))
       from public.pvp_pow_catalog c where p.match_id=p_match and p.user_id=p_user and p.pow_id=c.pow_id and c.role not in('Hiệp sĩ','Đấu sĩ','Đỡ đòn') and not p.eliminated;
   end if;
   if p_id='jackpot_bagua' then update public.pvp_match_pows set energy=100 where match_id=p_match and user_id=p_user and not eliminated; end if;
   perform public.powder_pvp_domain_log_v1880(p_match,p_user,null,null,'domain_expansion',jsonb_build_object('id',p_id,'name',cfg.name,'kind',cfg.kind,'durationActions',duration,'serverVerified',true,'jackpot',case when p_id='jackpot_bagua' then true else null end));
   r:=jsonb_build_object('ok',true,'kind','expansion','id',p_id,'name',cfg.name,'durationActions',duration,'serverVerified',true,'jackpot',case when p_id='jackpot_bagua' then true else null end);
 end if;
 insert into public.pvp_domain_action_receipts_v1880 values(p_match,p_user,p_client_action_id,'domain_activate',p_expected_turn_no,r,now());
 return r;
end $fn$;

create or replace function public.powder_pvp_domain_question_open_v1880(p_user uuid,p_match uuid,p_gate text,p_domain_owner uuid,p_expected_turn_no integer)
returns jsonb language plpgsql security definer set search_path='public' as $fn$
declare m public.pvp_matches; owner_mp public.pvp_match_players; s public.pvp_domain_question_sessions_v1880; qids text[]; rank_no int:=0;
begin
 select * into m from public.pvp_matches where id=p_match for update;
 if not found or m.status<>'active' or m.current_player<>p_user then raise exception 'Không thể mở câu hỏi ngoài lượt hiện tại'; end if;
 if m.turn_no<>p_expected_turn_no then raise exception 'STALE_PVP_STATE: server turn %, client turn %',m.turn_no,p_expected_turn_no; end if;
 if p_gate not in('owner','hostile') then raise exception 'Question gate không hợp lệ'; end if;
 if p_domain_owner not in(m.player_a,m.player_b) then raise exception 'Domain owner không hợp lệ'; end if;
 if (p_gate='owner' and p_domain_owner<>p_user) or (p_gate='hostile' and p_domain_owner=p_user) then raise exception 'Question gate không khớp chủ Lãnh Địa'; end if;
 select * into owner_mp from public.pvp_match_players where match_id=p_match and user_id=p_domain_owner;
 if not found or not coalesce((owner_mp.expansion_state->>'active')::boolean,false) or owner_mp.expansion_state->>'id'<>'limitless_void' then raise exception 'Vô Lượng Không Xứ không hoạt động'; end if;
 select * into s from public.pvp_domain_question_sessions_v1880 where match_id=p_match and user_id=p_user and turn_no=m.turn_no and gate=p_gate and domain_owner=p_domain_owner;
 if found then return jsonb_build_object('sessionId',s.id,'gate',s.gate,'domainOwner',s.domain_owner,'questionIds',to_jsonb(s.question_ids),'answered',s.answered,'correct',s.correct_count,'wrong',s.wrong_count); end if;
 select greatest(0,least(5,coalesce(rank,0))) into rank_no from public.tamer_progress where user_id=p_user;
 rank_no:=coalesce(rank_no,0);
 select array_agg(question_id order by ord) into qids from (
   select question_id,row_number() over() ord from public.question_catalog
    where enabled=true and rank=rank_no and length(trim(prompt))>0 and length(trim(answer))>0 and jsonb_typeof(options)='array' and jsonb_array_length(options)>=2
    order by random() limit 5
 ) q;
 if coalesce(array_length(qids,1),0)<5 then
   select array_agg(question_id order by ord) into qids from (
     select question_id,row_number() over() ord from public.question_catalog
      where enabled=true and length(trim(prompt))>0 and length(trim(answer))>0 and jsonb_typeof(options)='array' and jsonb_array_length(options)>=2
      order by random() limit 5
   ) q;
 end if;
 if coalesce(array_length(qids,1),0)<>5 then raise exception 'Server chưa đủ câu hỏi hợp lệ cho Vô Lượng Không Xứ'; end if;
 insert into public.pvp_domain_question_sessions_v1880(match_id,user_id,turn_no,gate,domain_owner,question_ids)
 values(p_match,p_user,m.turn_no,p_gate,p_domain_owner,qids) returning * into s;
 perform public.powder_pvp_domain_log_v1880(p_match,p_user,null,null,'domain_question_open',jsonb_build_object('sessionId',s.id,'gate',p_gate,'domainOwner',p_domain_owner,'count',5));
 return jsonb_build_object('sessionId',s.id,'gate',s.gate,'domainOwner',s.domain_owner,'questionIds',to_jsonb(s.question_ids),'answered',false,'correct',0,'wrong',0);
end $fn$;

create or replace function public.powder_pvp_domain_question_answer_v1880(p_user uuid,p_session uuid,p_answers jsonb,p_expected_turn_no integer)
returns jsonb language plpgsql security definer set search_path='public' as $fn$
declare s public.pvp_domain_question_sessions_v1880; m public.pvp_matches; qid text; selected text; correct int:=0; wrong int:=0; i int:=0;
 owner_mp public.pvp_match_players; state jsonb; total int:=0; burst_done boolean:=false; other uuid; t record; d jsonb;
begin
 select * into s from public.pvp_domain_question_sessions_v1880 where id=p_session for update;
 if not found or s.user_id<>p_user then raise exception 'Question session không hợp lệ'; end if;
 select * into m from public.pvp_matches where id=s.match_id for update;
 if not found or m.status<>'active' or m.current_player<>p_user or m.turn_no<>s.turn_no or m.turn_no<>p_expected_turn_no then raise exception 'STALE_PVP_STATE: question session đã cũ'; end if;
 if s.answered then return jsonb_build_object('ok',true,'sessionId',s.id,'answered',true,'correct',s.correct_count,'wrong',s.wrong_count,'idempotent',true); end if;
 if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)<>5 then raise exception 'Vô Lượng yêu cầu đúng 5 câu trả lời'; end if;
 foreach qid in array s.question_ids loop
   selected:=coalesce(p_answers->>i,'');
   if exists(select 1 from public.question_catalog q where q.question_id=qid and q.enabled=true and q.answer=selected) then correct:=correct+1; else wrong:=wrong+1; end if;
   i:=i+1;
 end loop;
 update public.pvp_domain_question_sessions_v1880 set answered=true,answers=p_answers,correct_count=correct,wrong_count=wrong,answered_at=now() where id=s.id;
 perform public.powder_pvp_domain_log_v1880(s.match_id,p_user,null,null,'domain_question_result',jsonb_build_object('sessionId',s.id,'gate',s.gate,'domainOwner',s.domain_owner,'correct',correct,'wrong',wrong));

 if s.gate='owner' then
   select * into owner_mp from public.pvp_match_players where match_id=s.match_id and user_id=s.domain_owner for update;
   state:=owner_mp.expansion_state; total:=least(10,coalesce((state->>'limitlessCorrect')::int,0)+correct); burst_done:=coalesce((state->>'limitlessBurstDone')::boolean,false);
   state:=jsonb_set(state,'{limitlessCorrect}',to_jsonb(total),true);
   other:=case when m.player_a=s.domain_owner then m.player_b else m.player_a end;
   if total>=10 and not burst_done then
     state:=jsonb_set(state,'{limitlessBurstDone}','true'::jsonb,true);
     for t in select pow_id from public.pvp_match_pows where match_id=s.match_id and user_id=other and not eliminated and hp>0 loop
       d:=public.powder_pvp_domain_direct_damage_v1880(s.match_id,s.domain_owner,other,t.pow_id,.50,'Vô Lượng Quá Tải',null,0);
     end loop;
     perform public.powder_pvp_domain_log_v1880(s.match_id,s.domain_owner,null,null,'domain_limitless_burst',jsonb_build_object('correctTotal',total,'ratio',.50,'serverVerified',true));
   end if;
   update public.pvp_match_players set expansion_state=state where match_id=s.match_id and user_id=s.domain_owner;
 end if;
 return jsonb_build_object('ok',true,'sessionId',s.id,'answered',true,'correct',correct,'wrong',wrong,'gate',s.gate,'domainOwner',s.domain_owner);
end $fn$;

alter table public.pvp_domain_catalog_v1880 enable row level security;
alter table public.pvp_simple_domain_catalog_v1880 enable row level security;
alter table public.pvp_domain_action_receipts_v1880 enable row level security;
alter table public.pvp_domain_question_sessions_v1880 enable row level security;
revoke all on public.pvp_domain_catalog_v1880,public.pvp_simple_domain_catalog_v1880,public.pvp_domain_action_receipts_v1880,public.pvp_domain_question_sessions_v1880 from anon,authenticated;
grant select,insert,update,delete on public.pvp_domain_catalog_v1880,public.pvp_simple_domain_catalog_v1880,public.pvp_domain_action_receipts_v1880,public.pvp_domain_question_sessions_v1880 to service_role;

revoke all on function public.powder_pvp_lock_team_v1880(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.powder_pvp_domain_question_open_v1880(uuid,uuid,text,uuid,integer) from public,anon,authenticated;
revoke all on function public.powder_pvp_domain_question_answer_v1880(uuid,uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.powder_pvp_domain_direct_damage_v1880(uuid,uuid,uuid,text,numeric,text,text,integer) from public,anon,authenticated;
revoke all on function public.powder_pvp_simple_resist_v1880(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.powder_pvp_domain_log_v1880(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.powder_pvp_lock_team_v1880(uuid,uuid,jsonb,jsonb),public.powder_pvp_domain_activate_v1880(uuid,uuid,text,text,text,integer),
 public.powder_pvp_domain_question_open_v1880(uuid,uuid,text,uuid,integer),public.powder_pvp_domain_question_answer_v1880(uuid,uuid,jsonb,integer),
 public.powder_pvp_domain_direct_damage_v1880(uuid,uuid,uuid,text,numeric,text,text,integer),public.powder_pvp_simple_resist_v1880(uuid,uuid,integer),
 public.powder_pvp_domain_log_v1880(uuid,uuid,text,text,text,jsonb) to service_role;
