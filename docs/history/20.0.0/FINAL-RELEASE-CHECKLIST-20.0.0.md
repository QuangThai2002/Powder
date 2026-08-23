# Final Release Checklist — Powder 20.0.0

## Automated build gate
- [x] JS syntax PASS
- [x] CSS structural PASS
- [x] HTML refs/duplicate IDs PASS
- [x] Boot manifest hash/size PASS
- [x] 99 Pow / 396 unique skills PASS
- [x] 22 gameplay critical files unchanged
- [x] Service Worker v2000 PASS
- [x] ZIP integrity PASS

## Server static gate
- [x] Integrity 19.6 PASS
- [x] Emergency mode normal at audit time
- [ ] 20.0 candidate registered with valid ZIP SHA-256
- [ ] Rollback target locked to current active build
- [ ] Load evidence PASS
- [ ] Recovery evidence PASS
- [ ] Polish 20.0 evidence PASS
- [ ] Freeze 20.0 evidence PASS
- [ ] Real Pilot 20–50 PASS

## Rollout gate
- [ ] Activate 5%
- [ ] 5% health PASS ≥15 min
- [ ] Advance 20%
- [ ] 20% health PASS ≥15 min
- [ ] Advance 50%
- [ ] 50% health PASS ≥15 min
- [ ] Advance 100%
- [ ] 100% final health PASS ≥15 min
- [ ] Finalize Official Live

`official=true` chỉ hợp lệ sau bước cuối. Artifact mặc định phải giữ `official=false`.
