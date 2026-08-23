-- Powder 18.8.1 — compact server combat identity metadata; full canonical audit ships in COMBAT-IDENTITY-AUDIT-18.8.1.md
create table if not exists public.pvp_pow_identity_v1881(
 pow_id text primary key references public.pvp_pow_catalog(pow_id) on delete cascade,
 primary_role text not null, secondary_role text not null, archetype text not null,
 passive_name text not null, passive_summary text not null default '', combo text not null default '',
 strengths jsonb not null default '[]'::jsonb, weakness text not null default '', synergy text not null default '', counter text not null default '',
 star_identity jsonb not null default '[]'::jsonb, signature text not null unique, source_version text not null default '18.8.1',
 updated_at timestamptz not null default now()
);
alter table public.pvp_pow_identity_v1881 enable row level security;
revoke all on public.pvp_pow_identity_v1881 from public, anon, authenticated;
grant select,insert,update,delete on public.pvp_pow_identity_v1881 to service_role;
