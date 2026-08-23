# Powder 20.20.0 — Gold Master

Powder 20.20.0 is the final pre-21.0 Gold Master packaging and freeze release. It adds no gameplay or combat content.

## What changed
- Added deterministic Gold Master lock across code, database schema, Edge/API source, and assets.
- Added a passive `POWDER_GOLD_MASTER_V20200` runtime between Release Freeze and Official Launch.
- Added service-role-only Gold Master evidence and server posture.
- Production readiness now requires a real 20.19 predecessor canary at 100% and finalized with server health PASS.
- Added an independent 20.20 staged rollout contract bound to build ID, manifest hash and artifact SHA-256.
- Added Gold Master as a hard check in Official Launch preflight.
- Removed the stale 20.19 boot loader from the production root and moved 20.19 release reports to `docs/history/20.19.0`.
- Kept `official=false`; 21.0 promotion still requires real production evidence.

## Frozen gameplay baseline
- 99 Pow
- 99 skill kits
- 396 unique skills
- 22/22 gameplay-critical files byte-identical to Release Freeze 19.9

## Gold Master rule
After the Gold Master artifact is signed, any code/schema/API/assets digest drift invalidates the evidence and production remains HOLD.
