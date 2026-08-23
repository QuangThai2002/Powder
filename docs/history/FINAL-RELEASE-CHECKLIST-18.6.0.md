# Powder 18.6.0 — Final Release Checklist

## Combat / AI
- [x] 99 Pow canonical roster present.
- [x] 396/396 action execution PASS.
- [x] 0 dead actions / 0 empty targets / 0 invalid BattleCore state.
- [x] Normal / Elite / Boss tactical AI tiers implemented.
- [x] 594 AI decision sweep: 0 illegal decisions.
- [x] Overheal / crisis heal behavior validated.
- [x] Finish-window and elemental target preference validated.
- [x] AI does not receive future player action information.

## Boss foundation
- [x] Daily policy = 2 phases.
- [x] Weekly policy = 3 phases.
- [x] Promotion policy = 2 phases.
- [x] Story policy = 2 phases.
- [x] Core / AI / HUD share the same encounter policy.
- [x] Boss pattern intent + hint + confidence metadata available.
- [x] Player shows readable telegraph only; internal diagnostics remain Admin-only.
- [x] Story Boss `Trấn Áp` signature validated.

## Lifecycle / performance regression
- [x] 8/8 KO/reserve/PvP lifecycle tests PASS.
- [x] 80/80 5v5 stress battles finish.
- [x] 0 soft-locks.
- [x] 270 nav + 100 modal + 12 PowBall long-session stress PASS.
- [x] active interval after settle = 0.
- [x] active rAF after settle = 0.
- [x] PowBall animation/timing not redesigned.

## Browser / Admin
- [x] Player production order = 87 modules.
- [x] Player version = 18.6.0.
- [x] Player page errors = 0.
- [x] Player console errors = 0.
- [x] Player mobile overflow = false.
- [x] Story Boss HUD phase policy = 1/2 at start.
- [x] Admin 15/15 pages PASS.
- [x] Admin Combat Lab AI/Boss diagnostics PASS.

## Static integrity
- [x] 104/104 JavaScript syntax PASS.
- [x] Direct missing/scope/callability TypeScript diagnostics = 0.
- [x] HTML duplicate IDs = 0.
- [x] Local HTML asset refs missing = 0.
- [x] CSS URL refs missing = 0.
- [x] CSS delimiter problems = 0.
- [x] Direct client `/rpc/` = 0.
- [x] Direct client `player_saves` REST = 0.
- [x] Service Worker `ignoreSearch:true` = 0.

## Preload / release metadata
- [x] Version alignment = 18.6.0.
- [x] Build ID = `powder-18.6.0-pve-intelligence-boss-foundation`.
- [x] 1,229 unique preload entries.
- [x] 87 ordered production scripts.
- [x] preload missing = 0.
- [x] preload size mismatch = 0.
- [x] preload hash mismatch = 0.
- [x] total bytes = 183,062,098.
- [x] manifest hash = `7bfed682b4a4e216`.

## Production gates
- [ ] HTTPS production domain configured and verified.
- [ ] HTTPS end-to-end smoke completed on deployed artifact.
- [ ] Staging backup/restore drill completed.
- [ ] 20–50 real-player pilot completed.
- [ ] Official Release Gate READY.
- [ ] Production channel activated.

18.6.0 is suitable for **candidate registration**, not automatic Production activation.
