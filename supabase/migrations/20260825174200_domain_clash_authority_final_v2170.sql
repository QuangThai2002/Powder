-- Powder 21.7.0 · PvP Domain Clash Server Authority
-- Server-owned 10x5 clash sessions. Client cannot read answer keys or write scores.

create table if not exists public.pvp_domain_clashes_v2170 (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  player_a uuid not null,
  player_b uuid not null,
  domain_a text not null,
  domain_b text not null,
  pow_a_id text,
  pow_b_id text,
  question_ids text[] not null default '{}',
  question_payload jsonb not null default '[]'::jsonb,
  phase text not null default 'base' check (phase in ('base','sudden','resolved','cancelled')),
  status text not null default 'active' check (status in ('active','waiting','sudden','resolved','cancelled')),
  ready_index_a smallint not null default 0,
  ready_index_b smallint not null default 0,
  ready_at_a timestamptz not null default now(),
  ready_at_b timestamptz not null default now(),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 minutes'),
  constraint pvp_domain_clash_players_distinct_v2170 check (player_a <> player_b)
);

create unique index if not exists pvp_domain_clash_one_open_per_match_v2170
  on public.pvp_domain_clashes_v2170(match_id)
  where status in ('active','waiting','sudden');
create index if not exists pvp_domain_clash_player_a_v2170 on public.pvp_domain_clashes_v2170(player_a,created_at desc);
create index if not exists pvp_domain_clash_player_b_v2170 on public.pvp_domain_clashes_v2170(player_b,created_at desc);

create table if not exists public.pvp_domain_clash_answers_v2170 (
  clash_id uuid not null references public.pvp_domain_clashes_v2170(id) on delete cascade,
  user_id uuid not null,
  question_index smallint not null check (question_index between 0 and 12),
  choice smallint,
  correct boolean not null default false,
  server_response_ms integer not null check (server_response_ms between 0 and 6000),
  timed_out boolean not null default false,
  answered_at timestamptz not null default now(),
  primary key (clash_id,user_id,question_index)
);
create index if not exists pvp_domain_clash_answers_user_v2170 on public.pvp_domain_clash_answers_v2170(clash_id,user_id,question_index);

alter table public.pvp_domain_clashes_v2170 enable row level security;
alter table public.pvp_domain_clash_answers_v2170 enable row level security;
revoke all on table public.pvp_domain_clashes_v2170 from anon,authenticated;
revoke all on table public.pvp_domain_clash_answers_v2170 from anon,authenticated;

create or replace function public.powder_domain_clash_match_guard_v2170()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  m public.pvp_matches%rowtype;
  pa public.pvp_match_players%rowtype;
  pb public.pvp_match_players%rowtype;
begin
  select * into m from public.pvp_matches where id=new.match_id;
  if not found then raise exception 'DOMAIN_CLASH_MATCH_NOT_FOUND'; end if;
  if m.status<>'active' then raise exception 'DOMAIN_CLASH_MATCH_NOT_ACTIVE'; end if;
  if not ((new.player_a=m.player_a and new.player_b=m.player_b) or (new.player_a=m.player_b and new.player_b=m.player_a)) then
    raise exception 'DOMAIN_CLASH_PARTICIPANT_MISMATCH';
  end if;

  select * into pa from public.pvp_match_players where match_id=new.match_id and user_id=new.player_a;
  select * into pb from public.pvp_match_players where match_id=new.match_id and user_id=new.player_b;
  if not found or pa.user_id is null or pb.user_id is null then raise exception 'DOMAIN_CLASH_PLAYER_STATE_MISSING'; end if;
  if not coalesce((pa.expansion_state->>'active')::boolean,false) or not coalesce((pb.expansion_state->>'active')::boolean,false) then
    raise exception 'DOMAIN_CLASH_REQUIRES_BOTH_ACTIVE';
  end if;
  if coalesce(pa.expansion_state->>'id','')<>new.domain_a or coalesce(pb.expansion_state->>'id','')<>new.domain_b then
    raise exception 'DOMAIN_CLASH_ACTIVE_DOMAIN_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_domain_clash_match_guard_v2170 on public.pvp_domain_clashes_v2170;
create trigger trg_domain_clash_match_guard_v2170
before insert or update of match_id,player_a,player_b,domain_a,domain_b on public.pvp_domain_clashes_v2170
for each row execute function public.powder_domain_clash_match_guard_v2170();

create or replace function public.powder_domain_clash_answer_guard_v2170()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.pvp_domain_clashes_v2170%rowtype;
  m_status text;
begin
  select * into c from public.pvp_domain_clashes_v2170 where id=new.clash_id;
  if not found then raise exception 'DOMAIN_CLASH_NOT_FOUND'; end if;
  if c.status not in ('active','waiting','sudden') then raise exception 'DOMAIN_CLASH_NOT_OPEN'; end if;
  if new.user_id<>c.player_a and new.user_id<>c.player_b then raise exception 'DOMAIN_CLASH_ANSWER_PARTICIPANT_MISMATCH'; end if;
  select status into m_status from public.pvp_matches where id=c.match_id;
  if coalesce(m_status,'')<>'active' then raise exception 'DOMAIN_CLASH_MATCH_NOT_ACTIVE'; end if;
  if now()>c.expires_at then raise exception 'DOMAIN_CLASH_EXPIRED'; end if;
  return new;
end;
$$;

drop trigger if exists trg_domain_clash_answer_guard_v2170 on public.pvp_domain_clash_answers_v2170;
create trigger trg_domain_clash_answer_guard_v2170
before insert on public.pvp_domain_clash_answers_v2170
for each row execute function public.powder_domain_clash_answer_guard_v2170();

revoke all on function public.powder_domain_clash_match_guard_v2170() from public,anon,authenticated;
revoke all on function public.powder_domain_clash_answer_guard_v2170() from public,anon,authenticated;
