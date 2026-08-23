-- Powder 18.7.0 - PvP Online 2.0
-- Additive hardening: idempotent actions, stale-turn rejection, rematch audit and useful indexes.

create table if not exists public.pvp_action_receipts_v1870 (
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  user_id uuid not null,
  client_action_id text not null,
  expected_turn_no integer not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, client_action_id),
  constraint pvp_action_receipt_id_len_v1870 check (char_length(client_action_id) between 8 and 96)
);

alter table public.pvp_action_receipts_v1870 enable row level security;
revoke all on table public.pvp_action_receipts_v1870 from anon, authenticated;
grant select, insert, update, delete on table public.pvp_action_receipts_v1870 to service_role;

create index if not exists pvp_matches_player_a_completed_v1870 on public.pvp_matches(player_a, completed_at desc) where status='completed';
create index if not exists pvp_matches_player_b_completed_v1870 on public.pvp_matches(player_b, completed_at desc) where status='completed';
create index if not exists pvp_match_events_match_id_v1870 on public.pvp_match_events(match_id,id);
create index if not exists pvp_match_players_user_live_v1870 on public.pvp_match_players(user_id,last_seen_at desc);

create or replace function public.powder_pvp_action_v1870(
  p_user uuid,
  p_match uuid,
  p_actor text,
  p_target text,
  p_skill text,
  p_client_action_id text,
  p_expected_turn_no integer
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.pvp_matches;
  prior public.pvp_action_receipts_v1870;
  applied jsonb;
begin
  if p_user is null or p_match is null then raise exception 'PvP action thiếu định danh'; end if;
  if p_client_action_id is null or char_length(trim(p_client_action_id)) not between 8 and 96 then
    raise exception 'PvP actionId không hợp lệ';
  end if;
  if p_expected_turn_no is null or p_expected_turn_no < 1 then
    raise exception 'PvP expectedTurnNo không hợp lệ';
  end if;

  -- One deterministic lock per client action. Retries join the same authoritative result.
  perform pg_advisory_xact_lock(hashtextextended('powder:pvp:action:'||p_match::text||':'||p_user::text||':'||p_client_action_id,1870));

  select * into prior
    from public.pvp_action_receipts_v1870
   where match_id=p_match and user_id=p_user and client_action_id=p_client_action_id;
  if found then
    return coalesce(prior.result,'{}'::jsonb) || jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'clientActionId',p_client_action_id,
      'serverAcceptedTurn',prior.expected_turn_no
    );
  end if;

  select * into m from public.pvp_matches where id=p_match for update;
  if not found then raise exception 'Trận PvP không tồn tại'; end if;
  if p_user not in(m.player_a,m.player_b) then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'active' then raise exception 'Trận chưa ở trạng thái chiến đấu'; end if;
  if m.turn_no<>p_expected_turn_no then
    raise exception 'STALE_PVP_STATE: server turn %, client turn %',m.turn_no,p_expected_turn_no;
  end if;
  if m.current_player<>p_user then raise exception 'Chưa đến lượt của bạn'; end if;

  applied:=public.powder_pvp_action(p_user,p_match,coalesce(p_actor,''),coalesce(p_target,''),coalesce(p_skill,'basic'));
  applied:=coalesce(applied,'{}'::jsonb) || jsonb_build_object(
    'clientActionId',p_client_action_id,
    'serverAcceptedTurn',p_expected_turn_no,
    'idempotent',false
  );

  insert into public.pvp_action_receipts_v1870(match_id,user_id,client_action_id,expected_turn_no,result)
  values(p_match,p_user,p_client_action_id,p_expected_turn_no,applied);
  return applied;
end
$function$;

create or replace function public.powder_pvp_rematch_v1870(p_user uuid,p_match uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.pvp_matches;
  opponent uuid;
  request jsonb;
begin
  select * into m from public.pvp_matches where id=p_match for update;
  if not found then raise exception 'Trận PvP không tồn tại'; end if;
  if p_user not in(m.player_a,m.player_b) then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'completed' then raise exception 'Chỉ có thể tái đấu sau khi trận đã kết thúc'; end if;
  opponent:=case when m.player_a=p_user then m.player_b else m.player_a end;

  -- Result acknowledgement is per-user and does not delete replay/history.
  update public.pvp_match_players set result_seen=true,last_seen_at=now()
   where match_id=p_match and user_id=p_user;

  request:=public.powder_pvp_create_challenge_v1831(p_user,opponent);
  insert into public.pvp_match_events(match_id,turn_no,actor_user_id,event_type,payload)
  values(p_match,m.turn_no,p_user,'rematch_requested',jsonb_build_object('opponentId',opponent,'challengeId',request->>'challengeId'));
  return coalesce(request,'{}'::jsonb) || jsonb_build_object('ok',true,'opponentId',opponent,'sourceMatchId',p_match);
end
$function$;

-- AFK/disconnect finishes count as forfeits for PvP statistics as well.
create or replace function public.powder_pvp_record_result()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare loser uuid; forfeited int:=0;
begin
  if new.status='completed' and old.status is distinct from 'completed' and new.winner_id is not null then
    loser:=case when new.player_a=new.winner_id then new.player_b else new.player_a end;
    forfeited:=case when new.finish_reason in('forfeit','afk_limit','disconnect_timeout') then 1 else 0 end;
    insert into public.pvp_player_stats(user_id,wins,matches) values(new.winner_id,1,1)
      on conflict(user_id) do update set wins=pvp_player_stats.wins+1,matches=pvp_player_stats.matches+1,updated_at=now();
    insert into public.pvp_player_stats(user_id,losses,forfeits,matches) values(loser,1,forfeited,1)
      on conflict(user_id) do update set losses=pvp_player_stats.losses+1,forfeits=pvp_player_stats.forfeits+forfeited,matches=pvp_player_stats.matches+1,updated_at=now();
  end if;
  return new;
end
$function$;

revoke all on function public.powder_pvp_action_v1870(uuid,uuid,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.powder_pvp_action_v1870(uuid,uuid,text,text,text,text,integer) to service_role;
revoke all on function public.powder_pvp_rematch_v1870(uuid,uuid) from public, anon, authenticated;
grant execute on function public.powder_pvp_rematch_v1870(uuid,uuid) to service_role;
