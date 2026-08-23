# Powder 18.5.2 — Final Release Checklist

## Combat core
- [x] 99 Pow / 396 action execution sweep.
- [x] 0 invalid BattleCore state.
- [x] 11/11 utility mechanics.
- [x] KO / reserve / result lifecycle.
- [x] 80/80 5v5 stress battles; 0 soft-lock.

## Performance
- [x] Incremental FX DOM patching.
- [x] Vital-diff cache.
- [x] Shared high-frequency UI expiry scheduler.
- [x] Adaptive audio polyphony HIGH/MEDIUM/LOW.
- [x] Renderer P95/P99 telemetry.
- [x] Same-harness template creation reduced 241 -> 81 (~66.4%).
- [x] 162 repeated renderer patches: 2 vital writes / 322 skipped writes.
- [x] Focused harness patch P95 ~0.7 ms / P99 ~2.5 ms.

## Browser / long session
- [x] Player production modules: 86.
- [x] Admin: 15/15 pages.
- [x] Combat mobile overflow: none.
- [x] Page errors: 0.
- [x] Console errors: 0.
- [x] 270 nav + 100 modal + 12 PowBall stress.
- [x] DOM delta -1; final intervals 0; final rAF 0.

## Static / integrity
- [x] 103/103 JS syntax.
- [x] checkJs direct undefined/scope/callability categories = 0.
- [x] 1,228 preload entries, all unique.
- [x] Missing / size / hash mismatch = 0.
- [x] Direct client `/rpc/` = 0.
- [x] Direct client `player_saves` REST = 0.

## Deployment gates
- [ ] Deploy candidate to real HTTPS target.
- [ ] HTTPS smoke test.
- [ ] Backup/restore drill on staging.
- [ ] Pilot with 20–50 real players.
- [ ] Official Release Gate READY before Production activation.
