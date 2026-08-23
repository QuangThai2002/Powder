# Final Release Checklist — Powder 19.6.0

## Automated
- [x] Production Integrity Snapshot ready
- [x] CAS conflict sandbox verified
- [x] Sensitive PvP/Domain RPC authority verified
- [x] Reward/PvP idempotency constraints present
- [x] 99 Pow / 396 unique fixed skills / 99 identity / 10 Sát thủ
- [x] JS syntax gate
- [x] CSS structural gate
- [x] Boot manifest size/hash gate
- [x] HTML local-ref / duplicate-ID gate
- [x] 22 critical gameplay files unchanged vs 19.5.0
- [x] ZIP integrity

## Evidence still required before Official Seal
- [ ] External `pvp_state` load report passes 19.6 thresholds
- [ ] External `cloud_load` load report passes 19.6 thresholds
- [ ] Pilot 20–50 real players complete
- [ ] Rollback + Cloud Save recovery real drill complete
- [ ] No Critical/High blocker after load/pilot

## Release state
`production-load-integrity-gate`; `official=false`.
