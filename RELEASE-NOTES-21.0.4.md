# Powder 21.0.4 — Capacity Guard & Graceful Degradation

21.0.4 is a post-launch infrastructure patch. It does **not** change combat, Pow balance, learning rules, gacha rates or player progression.

## Added
- Server-derived Capacity Guard using PostgreSQL connection pressure, active connections, lock waits, transaction/reconciliation backlog and Observability P95/error rate.
- Three capacity modes: `normal`, `soft`, `hard`.
- Soft mode actuates Reliability 20.8 `degraded`; hard mode actuates `read_only` to protect save/economy writes.
- Hysteresis recovery: multiple healthy snapshots are required before returning to normal.
- Admission control RPC for early backpressure before business mutation dispatch.
- Mutation Gateway integration with `Retry-After` and capacity reason codes.
- Admin Capacity Guard console with Owner + MFA/AAL2 ARM/DISARM/HOLD.
- Player Capacity Runtime that reuses Reliability state and adds **zero extra polling**.

## Fixed
- Corrected lifecycle boot order so Official Launch loads only after Launch Stabilization, Hotfix Safety, Live SLO and Capacity Guard.
- Corrected Security 20.16 Admin-surface cardinality after legitimate post-launch Admin functions were added.
- Corrected recovery queue counting to count only unresolved transaction/reconciliation states.
- Service Worker / boot-loader / release metadata are bound to 21.0.4.

## Safety
- No automatic rollback of save, currency, inventory or rewards.
- 22/22 gameplay critical files remain byte-identical to the freeze baseline.
- `official=false` remains intentional until production evidence exists.
