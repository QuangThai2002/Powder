# Supabase deployment — Powder 18.8.1

Production đã áp dụng identity schema + 99 canonical rows theo batch guarded và đồng bộ `pvp_pow_catalog.role`.

Các migration nguồn trong build:
1. `20260822_1881_combat_identity_schema.sql`
2. `20260822_1881_combat_identity_seed_99.sql`
3. `20260822_1881_combat_identity_finalize.sql`

Gate cuối bắt buộc: 99 rows, 99 signatures, 10 `Sát thủ`.
Edge source: `server/supabase/functions/powder-pvp/index.ts` — version 18.8.1.
