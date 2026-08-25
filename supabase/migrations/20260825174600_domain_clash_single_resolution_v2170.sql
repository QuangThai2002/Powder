-- Powder 21.7.0 · one resolved Domain Clash per PvP match.
-- Each Tamer has one Bành Trướng loadout per match; once both active expansions clash,
-- the server must not allow a second client-created clash for the same match.

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='pvp_domain_clash_single_match_v2170'
  ) then
    create unique index pvp_domain_clash_single_match_v2170 on public.pvp_domain_clashes_v2170(match_id);
  end if;
end $$;
