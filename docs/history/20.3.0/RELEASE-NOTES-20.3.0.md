# Powder 20.3.0 — Security & Anti-Abuse Hardening

This build adds server-authoritative security posture auditing and release blocking without changing Combat/gameplay balance.

Highlights:
- RLS/direct-write audit for critical tables.
- Sensitive RPC grant audit.
- Reward and PvP idempotency verification.
- Cloud Save CAS, rate guard and device-revoke verification.
- Non-destructive duplicate sandbox probe.
- Owner/Admin/Support Security Console separation.
- Security Posture added to Official Launch server preflight.
- Player security status is read-only and explicitly non-authoritative.
- Gameplay remains frozen.

Production activation remains unchanged and `official=false`.
