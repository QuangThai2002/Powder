# Combat Release Candidate Audit — 19.0.0

## Automated gates
- 99 Pow canonical roster
- 396 fixed skill IDs / 396 unique
- Combat Identity 99 / unique signature 99 / Assassin 10
- Domain lock: 9 total = 6 normal + 3 special
- Simple Domain: 3
- Combat Content: 3 Challenge, 3 Gauntlet, Elite/Dungeon/Boss modifier catalog valid
- Duplicate battle-start guard unit regression
- Offline duplicate reward guard unit regression
- JS syntax, HTML reference, manifest hash/size and ZIP integrity gates
- Production critical combat files compared against 18.9.0 to ensure the RC guard does not rewrite balance/core mechanics.

## Production server audit
Database audit performed against project `pxejydhqfzidnheudgnn` during RC preparation:
- pvp_pow_catalog = 99
- pvp_pow_identity_v1881 = 99
- distinct identity signature = 99
- primary role Sát thủ = 10
- pvp_domain_catalog_v1880 = 9 (6 normal, 3 special)
- pvp_simple_domain_catalog_v1880 = 3
- server_verified domain rows = 9
- powder-pvp Edge v5 ACTIVE with JWT verification
- pvp_action_receipts_v1870 primary key = match + user + client_action_id

## Guard policy
The RC layer is additive. It does not change PvE coefficients, PvP balance coefficients, Domain mechanics, Boss mechanics, skill identities, or Server Combat reward authority.

## Not automatically passed
The following require real field testing and remain pending until executed:
- 20–50 player pilot
- 2–4 hour continuous sessions
- two-device PvP reconnect / AFK / network drop tests
- mobile 320–430 px touch/layout validation
- server load test
- rollback drill from production deployment/backup

## Static build result
- 113/113 JavaScript files pass syntax check; service-worker also passes.
- index.html duplicate IDs: 0; missing local references: 0.
- admin.html duplicate IDs: 0; missing local references: 0.
- preload manifest: 1,238 entries, 0 hash/size errors.
- 16 production-critical Combat/Boss/Domain/PvP files: 0 byte changes versus 18.9.0.
- Chromium headless in the build environment did not return a trustworthy DOM before timeout; browser E2E remains a real-device/manual field item.
