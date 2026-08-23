# Powder 18.6.1 — Final Release Checklist

## Combat / Boss Core

- [x] Boss Combat 2.0 uses existing BattleCore; no parallel combat engine.
- [x] Daily Boss reaction mechanic: Cleanse window.
- [x] Story Boss reaction mechanic: Cleanse window.
- [x] Promotion Boss reaction mechanic: Shield-break interrupt window.
- [x] Weekly Boss reaction mechanic: Shield-break interrupt window.
- [x] Pending mechanic serializes in recovery state.
- [x] Phase transition cancels stale pending mechanic/barrier/mark.
- [x] Battle end clears pending mechanic.
- [x] Final phase Enrage implemented.
- [x] Direct Boss mechanic damage emits standard mechanic reaction events.
- [x] Player HUD exposes actionable response, not internal AI score.
- [x] Boss marks have dedicated high-priority visual metadata.

## Regression

- [x] 396/396 canonical actions execute.
- [x] 0 dead/no-effect action regression.
- [x] 0 unintended unavailable action.
- [x] 0 empty target.
- [x] 0 invalid BattleCore state in full action sweep.
- [x] 8/8 KO/reserve/PvP lifecycle regression PASS.
- [x] 4/4 Boss phase policy validation PASS.
- [x] 80/80 Boss stress battles finish.
- [x] 0 Boss stress exception.
- [x] 0 Boss stress invalid state.
- [x] 0 Boss stress soft-lock.

## Player / Admin / Performance

- [x] Player production order loads 88 modules.
- [x] Boss Combat API reports 18.6.1-boss-combat-2.
- [x] Mobile reaction HUD render PASS without horizontal overflow.
- [x] Player browser smoke: 0 page/console errors.
- [x] Admin 15/15 pages PASS.
- [x] Admin Combat Lab diagnostics PASS at 320px.
- [x] Long-session navigation/modal/PowBall stress: stable DOM/heap; no timer/rAF leak after settle.
- [x] PowBall timing/animation unchanged.

## Static / Build Integrity

- [x] 105/105 JavaScript syntax PASS.
- [x] Direct TS undefined/scope/callability codes all 0.
- [x] 17 CSS files basic delimiter PASS.
- [x] Duplicate HTML IDs = 0.
- [x] Missing local HTML refs = 0.
- [x] Missing CSS URL refs = 0.
- [x] Direct client `/rpc/` = 0.
- [x] Direct client REST `player_saves` = 0.
- [x] Service Worker `ignoreSearch:true` = 0.
- [x] Preload 1,230/1,230 unique.
- [x] Preload missing/size/hash mismatch = 0/0/0.
- [x] Preload total = 183,086,219 bytes.
- [x] Manifest hash = 47a00ce82276d7e0.

## Release Safety

- [x] Build prepared as candidate only.
- [x] Production activation is not performed by this build task.
- [x] Existing server-authoritative economy/PvP/reward boundaries preserved.
- [ ] Real production HTTPS/domain configured.
- [ ] HTTPS smoke on deployed 18.6.1.
- [ ] Backup/restore drill on staging.
- [ ] Pilot with 20–50 real players.
- [ ] Official Release Gate READY.
