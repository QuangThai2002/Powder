# Powder 18.5.2 — Combat Performance 60 FPS Hardening

18.5.2 keeps the validated Combat Core and Visual Feedback from 18.5.0/18.5.1, then reduces renderer and feedback overhead without changing Pow balance or PowBall animation.

## Highlights
- FX DOM is patched incrementally instead of reparsing the whole FX layer every scene patch.
- HP/Mana/Rage/Shield DOM uses a numeric diff cache.
- Frequent feedback expiry uses one shared scheduler.
- Combat Audio follows HIGH/MEDIUM/LOW performance tiers with 56/40/28 node polyphony caps.
- Combat API exposes performance telemetry including frame/action P95/P99 and renderer patch P95/P99.
- Focused benchmark: template creation reduced from 241 to 81 (~66.4%) across the same 160 UI renders; 322 redundant vital writes were skipped.
- Full 396-action, utility, lifecycle and 80-battle stress regressions remain clean.
