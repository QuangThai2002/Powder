# Powder 21.0.7 — Browser E2E Automation

## Benchmarked projects
- `microsoft/playwright`: browser automation, isolation, failure artifacts and deterministic browser testing.
- `mrdoob/three.js`: browser/E2E reporting for large WebGL codebases.
- `excaliburjs/Excalibur`: game/browser tests in CI and artifact retention on failure.

## Applied to Powder
- Real Chrome headless run on GitHub Actions.
- Local HTTP server; no production deployment or credentials required.
- Chrome DevTools Protocol harness written with Node 24 built-ins, so Powder does not gain a runtime npm dependency.
- Verify boot DOM, navigation contract, core views, Admin page, offline/privacy/terms pages and serious browser exceptions.
- Capture index/admin screenshots and JSON evidence.

## Runtime defects discovered by the new gate
1. `TOTAL_BYTES` was referenced before declaration in `boot-loader-v21004.js`, which could leave loading stuck at 0%.
2. `LEGACY` was referenced without declaration during preload.

Both defects were fixed while preserving the existing Final Gate manifest parser and without changing combat/gameplay logic. Security Gate, Windows/Linux policy, Full Regression and Browser E2E all pass after repair.
