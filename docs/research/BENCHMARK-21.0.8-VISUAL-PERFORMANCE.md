# Powder 21.0.8 — Visual Regression & Performance Gate

## Benchmarked projects
- `microsoft/playwright`: golden screenshot comparisons, fixed test environment, explicit visual-diff tolerance and masking/freezing volatile UI.
- `GoogleChrome/lighthouse-ci`: repeatable local-site collection plus assertion/performance budget concepts.
- `mrdoob/three.js`: dedicated E2E/size-report workflows and explicit comparison against a base measurement.

## Applied to Powder
- Reuse real Chrome on the Ubuntu GitHub runner for deterministic visual evidence.
- Freeze animation/transition and normalize dynamic loading text/progress before capture.
- Capture desktop loading UI, mobile loading UI and Admin desktop.
- Convert screenshots to small quantized visual fingerprints in Chrome and compare against an approved baseline.
- Gate JS/CSS/boot/manifest growth with headroom rather than exact byte equality.
- Gate stable browser metrics (DOM nodes, heap, layout/recalc counts) with conservative tolerance; record timing metrics as evidence but do not fail on noisy wall-clock timing.
- Upload actual screenshots and JSON on every run for manual investigation.

No combat, learning, economy, PvP or Supabase runtime behavior is changed.
