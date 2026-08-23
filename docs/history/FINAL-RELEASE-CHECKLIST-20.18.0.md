# Powder 20.18.0 — Final Release Checklist RC1

## Artifact QA
- [x] release metadata = 20.18.0
- [x] full-game automated regression PASS
- [x] RC1 runtime diagnostic PASS
- [x] 99 Pow / 99 kit / 396 unique skill
- [x] 99/99 Pow role coverage
- [x] Learning bank integrity PASS
- [x] 22/22 gameplay critical file unchanged
- [x] Transaction regression PASS
- [x] Canonical Mutation regression PASS
- [x] Reconciliation regression PASS
- [x] Anti-Abuse regression PASS
- [x] Load/Soak harness regression PASS
- [x] Disaster Recovery regression PASS
- [x] Security regression PASS
- [x] Save Integrity regression PASS
- [x] manifest/hash/boot order PASS
- [x] JS/CSS/HTML/local resource checks PASS

## Production evidence — không được giả lập trong artifact
- [ ] Home & Navigation smoke
- [ ] Learning smoke
- [ ] PowDex & Inventory smoke
- [ ] Gacha smoke
- [ ] Equipment & Artifact smoke
- [ ] PvE smoke
- [ ] PvP smoke
- [ ] Boss smoke
- [ ] Event & Mail Reward smoke
- [ ] Rank Promotion smoke
- [ ] Cloud Save Conflict smoke
- [ ] Admin smoke
- [ ] FPS smoke
- [ ] Critical = 0
- [ ] High = 0
- [ ] Owner/AAL2 release authorization ARM

RC1 chỉ được chuyển sang canary sau khi phần Production evidence hoàn tất trên deployment thật.
