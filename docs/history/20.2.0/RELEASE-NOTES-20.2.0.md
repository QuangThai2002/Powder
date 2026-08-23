# Powder 20.2.0 — Observability & Post-Launch Stability

## Scope
20.2.0 adds a post-launch observability layer without changing frozen gameplay. Production sampling is **disabled by default**.

## New runtime
- `js/observability-v2020.js`
- Reads the 20.2 observability policy from the existing release manifest.
- When disabled: no fetch patch, no recurring timer and no persistent telemetry listeners are installed after manifest resolution.
- When enabled: deterministic device sampling, bounded in-memory queue, 5-minute flush cadence, and no flush during Combat.
- Captures only Powder Edge endpoint slug, status, latency, network type and aggregate runtime health counters.
- Does not read request/response bodies, Cloud Save payloads, passwords or access-token contents.

## Server observability
- `powder-observability` v1 (JWT ON)
- `powder-admin-observability` v1 (JWT ON)
- API latency P50/P95/P99 and error rate by endpoint.
- Release-ring health by rollout percentage.
- Runtime error, suspected crash, reconnect and save-conflict aggregates.
- Baseline/checkpoint/rollback-before/rollback-after snapshots.
- Baseline comparison for post-deploy/rollback regression.

## Rollout safety
Official Launch preflight now includes an additive Observability gate. If observability is disabled, existing behavior is unchanged. If enabled, rollout advancement is held until the observation window has enough samples and remains under configured error/P95/P99/crash/save-conflict thresholds.

## Version drift fix
`pilot-live-v2000.js` now derives app version/build ID dynamically from current Powder config/environment instead of reporting 20.0.0 forever.

## Gameplay freeze
The 22 Release Freeze critical gameplay files remain byte-identical to the 19.9 baseline.
