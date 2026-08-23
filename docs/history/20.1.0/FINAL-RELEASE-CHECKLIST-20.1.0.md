# Final Release Checklist · Powder 20.1.0

## Automated build gate
- [x] Release metadata 20.1.0.
- [x] 22/22 critical gameplay files unchanged.
- [x] 99 Pow / 99 kits / 396 unique skills.
- [x] Service Worker 20.1.0 / cache v2010.
- [x] Boot manifest 1,258/1,258 verified.
- [x] Player Diagnostics read-only and opt-in.
- [x] Admin Live Ops console wired to JWT-protected Edge.
- [x] No stale boot-loader/cache v2000 on player runtime.

## Server gate
- [x] `powder-admin-live-ops` ACTIVE + JWT.
- [x] Incident/health tables RLS locked from anon/authenticated.
- [x] Live Ops snapshot healthy at build time.
- [x] Critical/High incidents integrated into Official Launch preflight.

## Still required before Official Live
- [ ] 20–50 real Pilot users with valid recent evidence.
- [ ] Real external load evidence.
- [ ] Recovery/rollback evidence.
- [ ] Build-specific Polish and Freeze evidence for the final candidate.
- [ ] Candidate registration with final ZIP SHA-256.
- [ ] Rollback target locked.
- [ ] Canary 5% → 20% → 50% → 100% with stage health PASS.
- [ ] 100% final-health PASS and explicit Finalize Official Live.
