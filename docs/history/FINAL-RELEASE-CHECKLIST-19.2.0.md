# Final Release Checklist — Powder 19.2.0

## Automated — PASS
- [x] JS syntax gate
- [x] Service Worker gate
- [x] CSS structural gate
- [x] HTML duplicate ID gate
- [x] Local reference gate
- [x] Preload manifest size/hash gate
- [x] 19.2.0 version/build/cache consistency
- [x] Old v1910 boot-loader removed
- [x] Critical Combat/PvP/Boss/Domain byte-isolation
- [x] Official Release Gate fail-closed regression

## Field validation — MUST be real
- [ ] PvP on two devices, at least 10 matches
- [ ] Network loss/reconnect before and after timeout boundaries
- [ ] AFK 3-strike and 90-second disconnect behavior
- [ ] All 9 Bành Trướng in Online PvP
- [ ] Mobile 320/360/390/430 CSS px
- [ ] Continuous session >= 2 hours
- [ ] Continuous session >= 4 hours
- [ ] Pilot with 20–50 players
- [ ] Server concurrency/load test
- [ ] Rollback drill + Cloud Save recovery

## Official transition
Only after all field items are confirmed:
1. Open Admin → Combat Test Lab → Official Release Seal.
2. Re-run readiness.
3. Create Official Release Seal.
4. Export `powder-19.2.0-official-release-seal.json` and archive it with the deployed build.
5. Only then change the external/public Launch Gate to Live if desired.
