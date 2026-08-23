# Powder 19.8.0 — Final Release Checklist

## Automated build gate

- [x] 131 JavaScript files pass `node --check`.
- [x] Service Worker syntax pass.
- [x] 33 CSS files structurally balanced.
- [x] Index duplicate IDs = 0.
- [x] Admin duplicate IDs = 0.
- [x] Index missing local refs = 0.
- [x] Admin missing local refs = 0.
- [x] Boot manifest 1,252/1,252 valid.
- [x] Boot manifest hash = `2c4594de296bdf9c`.
- [x] Script order 102/102 present.
- [x] No stale player runtime references to boot/pilot/official v1970.

## Canonical gameplay freeze

- [x] 99 Pow.
- [x] 99 fixed skill kits.
- [x] 396 fixed skill IDs.
- [x] 396 unique fixed skill IDs.
- [x] 99 Combat Identity profiles.
- [x] 99 unique identity signatures.
- [x] 10 Sát thủ.
- [x] 22 critical gameplay files byte-identical to 19.7.0.

## Release gate logic

- [x] No 19.8 seal → Official Ready false.
- [x] Wrong manifest seal → false.
- [x] Admin without Polish QA → not eligible.
- [x] Admin accepts Real Pilot backend contract version 19.7.0, not 19.8.0.
- [x] Pilot client sends appVersion 19.8.0.
- [x] Launch Polish module contains no recurring `setInterval` loop.

## Field gate — must be completed on real devices/services

- [ ] Real Pilot server evidence PASS.
- [ ] Real load/concurrency evidence PASS.
- [ ] Rollback + Cloud Save recovery PASS.
- [ ] Mobile 320/360/390/430 visual QA PASS.
- [ ] PvE/Boss/PvP/Domain Polish Audit imported and PASS.
- [ ] No Critical/High Pilot blockers.
- [ ] Release Seal 19.8 created against the final manifest hash.

Do not change `official` to `true` until the field gate is complete.
