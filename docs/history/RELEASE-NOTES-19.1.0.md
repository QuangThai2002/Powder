# Powder 19.1.0 — Production Readiness

19.1.0 is a hardening/pilot build on top of the 19.0.0 Combat Release Candidate. It intentionally adds no new combat mode, Pow kit, PvP coefficient, Boss rule, or Domain rule.

## Added

- `production-readiness-v1910.js`: mobile/network/long-session readiness runtime.
- Network-state banner for offline → reconnecting → server-synced transitions.
- Visibility resume guard: if a live PvP tab was hidden for >=30 seconds, request authoritative PvP state again after resume.
- Network flap counters and reconnect counters for pilot diagnostics.
- Runtime viewport classification for <=360, <=430, <=760, <=1050 widths.
- Horizontal-overflow audit for document/Battle/PvP surfaces.
- Touch-target audit for coarse-pointer devices.
- Memory-pressure diagnostics; lifecycle cleanup is requested only while Combat is inactive.
- Bounded FPS probe API (`POWDER_PRODUCTION_READINESS_V1910.fpsProbe`) for pilot tests.
- 320/360/390/430px additive PvP/Domain-question CSS hardening and safe-area-aware network banner.
- Admin Production Readiness panel with timestamped field-validation checklist and JSON export.

## Safety / authority

- No production database migration is required by 19.1.0.
- No Edge Function was redeployed just to change the client version.
- Existing PvP v5 server authority, Domain server verification, 18.7.1 PvP balance, reward idempotency and 19.0.0 duplicate-start/reward guards remain intact.
- Production Ready remains HOLD until field/pilot checks are actually completed.
