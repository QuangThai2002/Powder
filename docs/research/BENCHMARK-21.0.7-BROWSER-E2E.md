# Powder 21.0.7 — Browser E2E Automation

## Benchmarked projects
- `microsoft/playwright`: browser automation, isolation, failure artifacts and deterministic browser testing.
- `mrdoob/three.js`: browser/E2E reporting for large WebGL codebases.
- `excaliburjs/Excalibur`: game/browser tests in CI and artifact retention on failure.

## Applied to Powder
- Real Chrome headless run on GitHub Actions.
- Local HTTP server; no production deployment or credentials required.
- Chrome DevTools Protocol harness written with Node 24 built-ins, so Powder does not gain a runtime npm dependency.
- Verify boot DOM, navigation contract, core views, Admin page, offline/privacy/terms pages and uncaught browser exceptions.
- Capture index/admin screenshots and JSON evidence.

Runtime/gameplay remain unchanged.
