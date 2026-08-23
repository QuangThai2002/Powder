# Final Release Checklist — Powder 21.0.4

## Artifact QA
- [x] 22/22 gameplay critical files unchanged
- [x] 99 Pow / 99 kits / 396 skills
- [x] Capacity Guard static gate PASS
- [x] Capacity Runtime PASS
- [x] Full Game Regression PASS
- [x] Transaction / Canonical Adapter / Reconciliation PASS
- [x] Anti-Exploit / Load-Soak / DR / Security / Save Integrity regressions PASS
- [x] Service Worker matches 21.0.4 boot loader
- [x] Lifecycle boot order corrected
- [x] No extra player capacity polling

## Production deployment — intentionally not marked complete by local QA
- [ ] Apply 21.0.4 migration to production
- [ ] Deploy updated Mutation Gateway
- [ ] Deploy Admin Capacity Guard Edge Function
- [ ] Configure exact artifact SHA-256 and manifest hash
- [ ] Owner + MFA/AAL2 ARM Capacity Guard
- [ ] Capture real production capacity snapshots
- [ ] Verify NORMAL mode under ordinary traffic
- [ ] Exercise controlled SOFT/HARD degradation in a safe drill
- [ ] Verify hysteresis recovery and no unrelated Reliability override
- [ ] Confirm Security / SLO / Save / Transaction posture remains READY

`official=false` remains intentional until real deployment evidence is present.
