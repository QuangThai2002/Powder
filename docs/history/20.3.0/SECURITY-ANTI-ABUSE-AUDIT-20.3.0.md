# Powder 20.3.0 — Security & Anti-Abuse Audit

## Scope
- Gameplay remains frozen against `RELEASE-FREEZE-BASELINE-19.9.0.json`.
- Security decisions are server-authoritative; no client anti-cheat claim is treated as a release gate.
- Production release channel is not activated or modified by this build process.

## Server posture checks
- RLS enabled on critical Admin/account/reward/save/PvP/LiveOps/Observability tables.
- No direct INSERT/UPDATE/DELETE grants to `anon` or `authenticated` for critical tables.
- Sensitive Cloud Save/rate/PvP/reward RPCs are checked for accidental client EXECUTE grants.
- Reward claim tables and PvP action receipts retain PK/UNIQUE idempotency guards.
- `account_devices.revoked_at` remains available for device-session revocation.
- Cloud Save CAS commit and rate guard remain service-role only.
- Duplicate sandbox probe must be blocked by the database and cleaned after the test.
- Active Admin roles are restricted to `owner`, `admin`, `support`.

## Role separation
- Support: read Security posture only.
- Admin: read posture + run non-destructive duplicate probe.
- Owner: above + save Production Security review snapshot.
- Production launch controls remain in their dedicated Owner-gated launch Edge.

## Official Launch integration
`powder_official_launch_preflight_v2000` now includes `securityPosture`. A failed Security posture makes Official Launch preflight fail closed, so activate/advance/finalize transactions cannot proceed.

## Production result at build time
Security Posture returned READY with zero RLS/direct-write/RPC-grant/admin-role violations and all idempotency/CAS/rate/device guards passing. This is a configuration/security regression result, not a claim that all real-world abuse has been eliminated.
