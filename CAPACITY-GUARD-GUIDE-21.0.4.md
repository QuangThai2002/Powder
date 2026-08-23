# Capacity Guard 21.0.4 — Production Guide

## Purpose
Capacity Guard prevents a busy server from degrading into data corruption or a total outage. It does this by applying backpressure **before** expensive writes and by reusing Reliability 20.8 for graceful degradation.

## Modes
- **NORMAL** — all normal traffic is admitted.
- **SOFT** — background/bulk work is deferred; Reliability becomes `degraded`; gameplay rules do not change.
- **HARD** — non-critical admission is rejected with `Retry-After`; Reliability becomes `read_only` so Cloud Save/economy writes are protected.

## Server-derived inputs
The capture RPC reads PostgreSQL connection usage, active connections, lock waits, unresolved transaction recovery, unresolved reconciliation cases, and Observability 15-minute P95/error rate. Admin does not type these metrics manually.

## Activation
1. Apply migration `20260823_21004_capacity_guard_graceful_degradation.sql`.
2. Deploy `powder-admin-capacity-guard` and the updated `powder-mutation-gateway`.
3. Confirm Security 20.16 Origin/MFA posture is ready.
4. In Admin, open Capacity Guard and ARM using the exact 21.0.4 manifest hash and artifact SHA-256.
5. Schedule service/CI to call `powder_capacity_capture_v21004(...)` at an operationally appropriate interval.
6. Watch the latest snapshot and transition events.

## Recovery behavior
A single healthy sample does not immediately reopen the system. The default is three consecutive good samples. Capacity Guard returns Reliability to `normal` only if the current Reliability mode was previously applied by Capacity Guard itself; it does not override an unrelated emergency.

## Important limitation
Artifact QA proves the code path and fail-closed contracts. It does not prove real production capacity. Database pool limits, traffic shape and SLO evidence must be measured after deployment.
