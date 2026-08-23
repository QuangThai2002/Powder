# Supabase deployment source — Powder 18.7.0

Applied migration: `migrations/20260822_1870_pvp_online_2.sql`.

Deployed Edge source: `functions/powder-pvp/index.ts` (`verify_jwt=true`).

The migration is additive for action receipts/indexes and replaces only the PvP result-stat trigger function to count AFK/disconnect as forfeits. The Edge keeps the legacy 18.6.x action path for compatibility while 18.7.0 clients use idempotent expected-turn actions.
