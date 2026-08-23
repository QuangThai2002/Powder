# Final Release Checklist — Powder 20.8.0

- [x] release.json = 20.8.0, `official=false`.
- [x] Service Worker = 20.8.0 / build 20800.
- [x] Boot manifest 1262 entries, hash verified.
- [x] Script order 106; Reliability runtime loads before Online Foundation.
- [x] 22/22 gameplay critical files unchanged.
- [x] Reliability migration and Admin Edge Function included.
- [x] Automation defaults DISARMED.
- [x] Circuit modes normal/degraded/read_only/emergency implemented.
- [x] Cloud Save pending-sync guard integrated.
- [x] Reliability public status is limited/safe.
- [x] Launch Control accepts candidate 20.8.0.
- [x] `reliabilityNormal` hard launch gate implemented.
- [x] No Admin manual health injection fields.
- [x] Event Ops/Recovery/Security/Support/Observability/PvP server modules unchanged from 20.7.
- [x] Final Gate 20.8.0 PASS.

Production deployment still requires real Observability, Recovery evidence, release authorization, canary health and operator-controlled activation.
