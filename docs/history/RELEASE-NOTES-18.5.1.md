# Powder 18.5.1 — Combat Visual Feedback

18.5.1 builds on the fully validated 18.5.0 Combat Core and focuses on one rule: **the player should understand what happened by looking at the affected Pow, without trading away frame-rate stability.**

### New
- Exact/local heal-number support.
- Shield gain number and shield absorption number.
- `NÉ` feedback for evade.
- `CHẶN ĐÒN` feedback for fully shielded hits.
- Explicit `BẠO KÍCH` damage label.
- Compositor-only heal, shield, CC and reserve-entry reactions.
- Gradual HIGH → MEDIUM → LOW adaptive FX budget.

### Preserved
- 99 Pow fixed kits.
- 18.5.0 canonical action parser/core.
- Source→target Combat traces.
- Ultimate / Exclusive presentation.
- Server-authoritative Online boundaries.
- PowBall animation and timing.

### QA
- 396/396 action sweep PASS.
- 11/11 utility mechanic assertions PASS.
- 80/80 5v5 stress battles finish, 0 soft-lock.
- Player/Admin browser smoke PASS.
- Long-session DOM/timer/rAF regression PASS.
