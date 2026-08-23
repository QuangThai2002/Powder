# Final Release Checklist — Powder 19.1.0 Production Readiness

## Automated build gate

- [x] All JavaScript passes syntax validation.
- [x] Service Worker passes syntax validation.
- [x] Boot preload manifest count/hash/size validates exactly.
- [x] `index.html` and `admin.html` have no duplicate IDs or missing local refs.
- [x] CSS brace structure validates.
- [x] Production critical Combat/PvP/Boss/Domain files match 19.0.0 byte-for-byte unless explicitly listed.
- [x] 99 Pow / 396 unique fixed skills / 99 identity / 10 Sát thủ / 9=6+3 Domain gate passes.
- [x] 19.0.0 duplicate-start and duplicate-reward unit regression still passes.
- [x] 19.1.0 readiness runtime VM regression passes.
- [x] ZIP integrity passes.

## Field gate — must remain pending until actually tested

- [ ] 10+ PvP matches on two devices/accounts.
- [ ] Reconnect before/after turn timeout.
- [ ] 3 AFK strikes / 90s disconnect.
- [ ] 9 Bành Trướng Online + 3 Giản Dị.
- [ ] 320/360/390/430px real-device mobile pass.
- [ ] >=2h soak.
- [ ] >=4h soak.
- [ ] 20–50 tester pilot.
- [ ] Controlled server concurrency/load test.
- [ ] Rollback + Cloud Save recovery drill.

**Production Ready must remain HOLD until every field item above has evidence.**
