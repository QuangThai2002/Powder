# Powder 21.0.13 · Interaction Response 2.0 Benchmark

## Goal
Reduce input-to-feedback latency and accidental duplicate submissions without changing gameplay, combat formulas, learning rules, economy values, save semantics, or the 22-file gameplay freeze boundary.

## Reference 1 · PixiJS
Relevant pattern: the render loop gives interaction callbacks higher priority than normal gameplay/render utility work. PixiJS also normalizes pointer events through its event boundary before scene propagation.

Applied to Powder:
- Pointer feedback is handled in capture phase before application click handlers.
- Immediate input response is never scheduled behind optional scene maintenance.
- Interaction telemetry is separate from render/background work.

## Reference 2 · Phaser
Relevant pattern: Scene-owned InputPlugin receives pointer/keyboard events directly and exposes input enable/disable independently of rendering. Event-driven input can be handled immediately rather than waiting for polling/render work.

Applied to Powder:
- Capture pointer/keyboard input as a dedicated runtime layer.
- Do not delay core `renderAll()` or game state mutations.
- Guard only submit/transaction-like actions while navigation/filter actions remain rapid.

## Reference 3 · Excalibur
Relevant pattern: input/event lifecycle is kept separate from scene navigation and scene transition lifecycle. Recent Excalibur work also continues to harden pointer event receiver cleanup independently from pointer systems.

Applied to Powder:
- Interaction runtime is independent from Scene Transition 21.0.12, but can use its coalesced maintenance queue for post-render settling.
- Input feedback remains active under resource pressure while optional background work can still be suppressed.
- Cleanup and diagnostics are explicit and testable.

## Powder 21.0.13 decisions
- New `js/interaction-response-v21013.js` loaded after Scene Transition and before `app.js`.
- Immediate pointer/keyboard visual feedback via a short WAAPI opacity pulse; reduced-motion users are respected.
- Duplicate-submit guard only for high-risk action attributes/IDs or explicit `data-interaction-guard`.
- Navigation, view switches, filters, performance profiles, and PowBall selection are explicitly exempt from the guard.
- Guard windows are short and action-sensitive (answers shorter; reset/restore/export longer).
- `PerformanceObserver` Event Timing is recorded when supported.
- Input-to-first-frame and input-to-app-render response are tracked in read-only diagnostics.
- Post-render settle work is coalesced through Scene Transition 21.0.12 rather than spawning repeated maintenance tasks.

## Gate
`tools/powder-interaction-response-gate-v21013.mjs` validates in real headless Chrome:
- immediate pointer feedback;
- duplicate-submit blocking;
- unguarded rapid input preservation;
- render-response capture;
- first-frame latency budget;
- interaction priority while runtime pressure is `hot`;
- state cleanup;
- no serious runtime exceptions.

## Release rule
21.0.13 may merge only when the new Interaction Response gate and all existing CI/Security/Browser/Visual/Soak/Pressure/Scene gates pass on the same final commit. The new gate should also pass an independent rerun before merge.
