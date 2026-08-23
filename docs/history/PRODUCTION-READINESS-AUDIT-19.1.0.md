# Production Readiness Audit — 19.1.0

## Scope

19.1.0 hardens the 19.0.0 RC for real-device and pilot validation. It does not change combat coefficients or content rules.

## Production server snapshot checked before packaging

- `pvp_pow_catalog`: 99 Pow.
- `pvp_pow_identity_v1881`: 99 identities / 99 unique signatures.
- Canonical Sát thủ count: 10.
- Bành Trướng catalog: exactly 9 = 6 normal + 3 special.
- Giản Dị catalog: 3.
- All 9 Bành Trướng entries are marked server-verified.
- `powder-pvp`: version 5, ACTIVE, JWT verification enabled.
- `powder_pvp_action_v1870` and 18.8.0 sensitive Domain/PvP RPCs are not executable by `anon` or `authenticated`; service role remains the authority.
- Existing idempotency keys/primary keys cover PvP action receipts and core reward-claim tables.
- No active/stale pilot evidence existed in `pvp_matches` or Server Combat session tables at audit time; therefore field validation is intentionally not marked complete.

## 19.1.0 client hardening

### Network

- Offline banner tells players not to reload during a live server match.
- Reconnect state is visible while the existing Online foundation hydrates.
- Live PvP state is requested again after a >=30s hidden-tab resume.
- Network transitions/flaps/reconnects are counted, not logged without bounds.

### Mobile

- `viewport-fit=cover` added to player/Admin viewport meta.
- Additive breakpoints: 430px and 360px on top of existing PvP breakpoints.
- Coarse-pointer action/question controls target >=44px height.
- Mobile form controls retain >=16px font sizing to avoid unintended browser zoom.
- PvP log/replay content uses min-width/overflow-wrap hardening.

### Long session

- Memory usage is sampled only when the browser exposes `performance.memory`.
- At >=78% heap limit, cleanup is requested only if Combat is not active.
- Readiness health sweep is every 120s while visible; no per-frame telemetry was added.
- FPS probe is explicit and bounded to <=30 seconds.

## Hold conditions

19.1.0 may pass automated checks and still remain `Production Ready = HOLD`. Required field evidence includes two-device PvP, reconnect/AFK, all 9 Domains online, 320/360/390/430 real-device checks, 2–4h soak, 20–50 player pilot, server concurrency test, and rollback drill.
