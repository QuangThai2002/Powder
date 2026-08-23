# Observability Operations Guide — 20.2.0

## Default state
Production and staging observability ship disabled. Enabling production is Owner-only in Admin.

## Recommended rollout
1. Keep production OFF while validating build locally.
2. Enable staging sampling and verify P50/P95/P99 and endpoint tables.
3. Save an Observability baseline.
4. For a real canary, enable a small production sample rate only after the release/pilot gates are ready.
5. Do not advance rollout if Observability health is HOLD.
6. Before rollback, create `rollback_before`; after rollback, create `rollback_after` and compare against the baseline.

## Default health thresholds
- Minimum requests in 30-minute window: 200
- Error rate: <= 1%
- P95: <= 1500 ms
- P99: <= 2500 ms
- Suspected crashes: 0
- Cloud Save conflicts: 0

These values are release gates, not gameplay balance values.

## Data minimization
The browser sampler only retains a bounded queue in memory. Samples contain endpoint slug, HTTP status, latency, rollout ring and network type. It never inspects request/response bodies or save payloads.
