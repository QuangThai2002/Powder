# Powder 20.14.0 — Final Release Checklist

- [x] release/build/service worker = 20.14.0
- [x] boot manifest integrity PASS
- [x] 22/22 gameplay freeze PASS
- [x] Transaction runtime regression PASS
- [x] Canonical mutation regression PASS
- [x] Reconciliation runtime regression PASS
- [x] Exploit hardening runtime regression PASS
- [x] Load/Soak architecture gate PASS
- [x] Load/Soak runner self-test PASS
- [x] Load/Soak server calculates PASS/HOLD
- [x] Admin cannot self-record PASS
- [x] Safe sandbox write isolated from player resources
- [x] Official Launch includes `productionLoadSoak`
- [ ] Real deployment Load evidence PASS
- [ ] Real deployment 4-hour Soak evidence PASS
- [ ] Approved Overload/Recovery evidence PASS
- [ ] Production `official=true`

`official=false` is intentional until external evidence is complete.
