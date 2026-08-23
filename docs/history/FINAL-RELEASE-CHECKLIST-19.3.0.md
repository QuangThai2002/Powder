# Final Release Checklist — Powder 19.3.0

## Automated build gate
- [x] JavaScript syntax gate
- [x] Service Worker syntax gate
- [x] HTML duplicate ID gate
- [x] Local reference gate
- [x] CSS brace gate
- [x] Boot manifest size/hash gate
- [x] 22 critical gameplay files unchanged from 19.2.0
- [x] Pilot aggregation synthetic test
- [x] Pilot PvP-state collector synthetic test
- [x] Production DB catalog/domain/stale-session audit
- [x] powder-pvp ACTIVE + JWT audit

## Objective field evidence
- [ ] 2 devices + >=10 PvP matches
- [ ] real offline/reconnect
- [ ] AFK 3 strike/disconnect timeout
- [ ] all 9 Bành Trướng Online
- [ ] 320/360/390/430 px
- [ ] >=2h active soak
- [ ] >=4h active soak

## Manual-only field proof
- [ ] Pilot 20–50 real players
- [ ] Server load/concurrency test
- [ ] Rollback + Cloud Save recovery drill

## Release seal
- [ ] 10/10 field checklist
- [ ] 19.3 automated readiness PASS
- [ ] create 19.3 release seal
- [ ] export and archive seal JSON

`official=false` remains correct until all items above are complete.
