# Powder 19.8.0 — Launch Polish Audit

Date: 2026-08-22
Build: `powder-19.8.0-launch-polish`
Release state: `launch-polish-gate`
Official: `false`

## Scope

19.8.0 is a presentation/performance polish release. It does not add a new Combat mode and does not change Combat coefficients, PvP balance, Boss mechanics, Domain mechanics, Server Combat authority, or the fixed 99-Pow/396-skill catalog.

## Player polish layer

- Added `js/launch-polish-v1980.js` and `css/launch-polish-v1980.css`.
- Uses `VisualViewport` when available to stabilize mobile height and keyboard-safe layout.
- Adds safe-area handling for notches/home indicators.
- Keeps Combat FX/callouts inside phone viewports without changing timing or damage logic.
- Improves skill-strip touch targets and scroll snapping.
- Improves PvP/Domain question modal height, scrolling, and safe-bottom padding.
- Reuses the existing Production Readiness network banner instead of creating another reconnect UI.
- QA instrumentation is opt-in through `?polish=1`; no recurring Launch Polish polling runs in normal mode.

## Pilot compatibility

- Player Pilot client is now `pilot-live-v1980.js` so telemetry reports app version `19.8.0` correctly.
- It continues to use the existing Real Pilot 19.7 server contract.
- Release Seal requires Pilot server evidence from source `pilot-server-19.7.0`.
- Pilot backend is not redeployed by this release.

## Polish QA gate

The Admin Launch Polish panel accepts an audit exported from the exact 19.8 build and checks:

- no horizontal overflow;
- touch-target compliance;
- no broken images in the tested view;
- no detected active Combat FX clipping;
- no Pilot Critical blocker;
- no Pilot High blocker.

Release Seal 19.8 additionally requires the existing Real Pilot, Safe Rollout, Load/Integrity, Recovery, and field validation gates.

## Automated regression

- JavaScript syntax: 131/131 PASS.
- Service Worker syntax: PASS.
- CSS structural: 33/33 PASS.
- `index.html`: duplicate IDs 0; missing local refs 0.
- `admin.html`: duplicate IDs 0; missing local refs 0.
- Boot manifest: 1,252/1,252 entries exist and match size/hash.
- Boot manifest hash: `2c4594de296bdf9c`.
- Boot script order: 102/102 files present.
- Canonical Pow: 99/99.
- Fixed skill kits: 99/99.
- Fixed skill IDs: 396/396 unique.
- Combat Identity: 99/99 profiles; 99 unique signatures; Sát thủ 10.
- Critical gameplay byte comparison vs 19.7.0: 0/22 changed.
- Release Seal player gate: no seal = false; wrong manifest = false; correct seal/build = true in isolated regression.
- Admin Release gate: missing Polish QA = HOLD; correct Pilot 19.7 + Polish QA + other gates = eligible in isolated regression.

## Browser field verification

A full real-device/browser E2E pass is not claimed by the automated gate. Use the 19.8 Polish QA flow on actual target devices before creating the Release Seal.
