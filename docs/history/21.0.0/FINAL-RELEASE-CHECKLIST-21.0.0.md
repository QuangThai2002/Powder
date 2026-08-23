# Final Release Checklist — Powder 21.0.0

## Artifact
- [x] 22/22 gameplay critical files unchanged
- [x] 99 Pow / 99 kits / 396 unique skills
- [x] 21.0 boot + service worker + release metadata
- [x] Official Production runtime passive-only
- [x] 21.0 canary/evidence SQL contract
- [x] Admin Official Launch bound to v21000
- [x] No manual Stage Health path
- [x] Gold Master 20.20 evidence preserved under docs/history

## Production — must be completed on real deployment
- [ ] Apply 21.0 migrations
- [ ] Redeploy Official Launch Edge Function
- [ ] Register candidate with real artifact SHA-256
- [ ] 20.20 predecessor 100% + finalized + final health PASS
- [ ] RC automated evidence PASS for 21.0
- [ ] Manual Smoke 13/13 PASS for 21.0
- [ ] Load/Soak production evidence PASS
- [ ] Disaster Recovery evidence PASS
- [ ] Security Critical 0 / High 0
- [ ] Save Integrity authoritative scan clean
- [ ] Rollback drill PASS
- [ ] 5% health PASS
- [ ] 20% health PASS
- [ ] 50% health PASS
- [ ] 100% health PASS
- [ ] Owner+AAL2 Finalize Official Live

Do not change `official=false` in the source artifact merely to bypass these server gates.
