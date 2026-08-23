# Powder 19.9.0 — Final Release Freeze Checklist

## Automated build gate

- [x] 131 JavaScript files pass `node --check`.
- [x] Service Worker syntax PASS.
- [x] 35 CSS files structurally balanced.
- [x] Index duplicate IDs = 0.
- [x] Admin duplicate IDs = 0.
- [x] Index missing local refs = 0.
- [x] Admin missing local refs = 0.
- [x] Boot manifest 1,254/1,254 valid.
- [x] Boot manifest hash = `2cf3b2d9807f0484`.
- [x] Script order 103/103 present.
- [x] Stale player boot/pilot/official v1980 runtime removed.

## Gameplay freeze

- [x] 22 critical gameplay files byte-identical to 19.8.0.
- [x] 99 Pow.
- [x] 99 fixed kits.
- [x] 396 fixed skill IDs.
- [x] 396 unique fixed skill IDs.
- [x] 99 Combat Identity profiles.
- [x] 99 unique identity signatures.
- [x] Sát thủ = 10.
- [x] Adventure = 12 islands / 230 stages.
- [x] Story Boss stages = 12.
- [x] Boss profiles = Daily / Weekly / Promotion / Story.
- [x] Challenge = 3.
- [x] Gauntlet = 3.
- [x] Giản Dị = 3.
- [x] Bành Trướng = 9 (6 normal + 3 special).

## Authority / integrity

- [x] Server Combat Event + Boss contract present.
- [x] Online reward remains server-protected/fail-closed.
- [x] Save upgrade/recovery hooks present.
- [x] Cloud revision/conflict contract present.
- [x] Production Integrity Snapshot PASS.
- [x] Production stale Server Combat = 0 at audit time.
- [x] Safe Rollout remains 100% / emergency normal at audit time.

## Release Seal 19.9

- [x] No seal → Official Ready false.
- [x] Wrong manifest → Official Ready false.
- [x] Player Freeze Audit exports the actual boot manifest hash.
- [x] Admin imports Player Freeze Audit instead of assuming a Player Boot Loader on the Admin page.
- [x] Seal 19.8 cannot be reused as a 19.9 seal.

## Field gates before 20.0.0

- [ ] Real Pilot server evidence PASS with 20–50 real users.
- [ ] No open Critical/High Pilot blocker.
- [ ] External load/concurrency evidence PASS.
- [ ] Rollback + Cloud Save recovery PASS.
- [ ] Mobile 320/360/390/430 real-device QA PASS.
- [ ] Polish QA PASS on the final 19.9 candidate.
- [ ] Import 19.9 Freeze Audit into Admin and confirm Freeze Gate PASS.
- [ ] Create 19.9 Release Seal against the final manifest hash.

Do not change `official` to `true` and do not activate 20.0.0 until all field gates are complete.
