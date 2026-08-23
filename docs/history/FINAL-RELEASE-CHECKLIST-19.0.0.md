# Final Release Checklist — Powder 19.0.0 RC

## Automated / static
- [x] 99 Pow roster gate
- [x] 396 fixed skill ID gate
- [x] 99 unique Combat Identity gate
- [x] 10 Assassin canonical role gate
- [x] 9 Domain Expansion = 6 normal + 3 special
- [x] 3 Simple Domain
- [x] Combat Content catalog validation
- [x] Duplicate combat start guard regression
- [x] Offline duplicate reward mutation guard regression
- [x] Production server catalog/domain identity audit
- [x] JWT ACTIVE on powder-pvp Edge
- [x] Reward/action idempotency key audit
- [x] JS syntax gate — 113/113 JS + service-worker PASS
- [x] HTML duplicate ID / local reference gate
- [x] Preload manifest size/hash integrity gate — 1,238/1,238 PASS
- [x] Critical gameplay diff gate versus 18.9.0 — 16 critical files, 0 changed
- [x] ZIP integrity gate

## Field / pilot — required before Production Ready
- [ ] 99 Pow smoke rotation in real browser/device
- [ ] PvE normal/Elite/Challenge/Gauntlet/Boss full playthrough
- [ ] Daily/Weekly/Rank/Event Boss server reward validation
- [ ] PvP two devices: 10+ matches
- [ ] Network drop <45 s and >45 s / reconnect exact match
- [ ] AFK 3 strikes / disconnect 90 s UX
- [ ] Domain 9/9 online, including Vô Lượng/Rút Kiếm/Bát Đồ
- [ ] Mobile 320/360/390/430 px touch validation
- [ ] 2–4 hour long-session soak test
- [ ] 20–50 player pilot
- [ ] server load test
- [ ] deployment rollback drill

**Status: RELEASE CANDIDATE. Production Ready = NO until all field/pilot items pass.**
