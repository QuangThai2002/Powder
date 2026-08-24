# Powder 21.0.17 — Implementation Notes

## Runtime
`js/combat-turn-flow-v21017.js`

Presentation-only runtime. It does not calculate combat values and does not mutate gameplay state.

### Phase model
- `idle`: no current actor visible.
- `turn`: current actor exists, waiting for action.
- `charge`: attack callout exists before attack flow release.
- `release`: source→target attack flow is active.
- `impact`: a combat impact event has just been received; result is latched for ~0.9s.

### HUD
One `.tf217-hud` is created inside the active `.cv7-field` and then reused. It shows:
- phase,
- actor,
- ability,
- target,
- result,
- next actor.

### Existing DOM annotations
Only `data-tf217-*` attributes are written on current unit, target units and turn-order entries. Existing gameplay classes are not changed.

### Performance
- no new `MutationObserver`,
- no recurring ticker,
- event-driven sync,
- at most one queued `requestAnimationFrame` for coalescing,
- one transient timeout after impact,
- pressure-aware paint reduction.

### Diagnostics
`window.POWDER_COMBAT_TURN_FLOW_V21017.snapshot()` exposes only presentation telemetry: phase counts, last actor/action/target/result/next, pressure and HUD state. No token, save payload or gameplay secret is exposed.

## Release safety
- `RELEASE-FREEZE-BASELINE-19.9.0.json` remains authoritative.
- No critical gameplay file is intentionally modified.
- Final gate must verify 22/22 gameplay-freeze files byte-identical before merge.
