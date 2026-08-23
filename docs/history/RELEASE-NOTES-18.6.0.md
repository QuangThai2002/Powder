# Powder 18.6.0 — PvE Intelligence & Boss Combat Foundation

## New
- Added tactical PvE AI runtime with Normal, Elite and Boss tiers.
- AI now avoids empty cleanse/overheal/redundant shield, recognizes crisis and finishing windows, considers role priority and elemental matchup, and can hold Ultimate when its value is low.
- Added canonical Boss encounter policy shared by BattleCore, AI and UI.
- Boss phase policy: Daily 2, Weekly 3, Promotion 2, Story 2.
- Added phase-aware Boss tactical patterns and readable pre-cast intent/hints.
- Added Story Boss signature **Trấn Áp**: slows the fastest player Pow and reduces its turn meter.
- Added Admin Combat Lab AI/Boss diagnostics; internal meta remains out of Player UI.

## Fixed
- Removed prior mismatch between Boss phase logic and phase HUD.
- Story Boss no longer falls through an incomplete generic Boss policy.
- Elite/Boss decisions consistently use stronger tactical selection while standard enemies retain a small amount of human-like imperfection.

## Preserved
- 99 Pow / fixed four-skill kits unchanged.
- 18.5.0 canonical action runtime retained.
- 18.5.1 visual feedback retained.
- 18.5.2 60 FPS performance hardening retained.
- PvP remains server-authoritative.
- Online Event/Boss reward boundaries are not weakened.
- PowBall animation/timing unchanged.

## Validation
- 396/396 Combat actions PASS.
- 594 tactical AI decisions, 0 illegal decisions.
- 4/4 Boss policies valid.
- 8/8 lifecycle cases PASS.
- 80/80 5v5 stress battles finish, 0 soft-locks.
- 104/104 JavaScript syntax PASS.
- Browser Player/Admin smoke: 0 page/console errors.
- Preload: 1,229 unique entries / 87 scripts / 0 integrity mismatch.

18.6.0 is packaged as a release candidate. Production activation remains gated by real HTTPS deployment, restore drill and real-player pilot evidence.
