# Powder 20.3.0 — Security Operations Guide

1. Open Admin → **Bảo mật & Vận hành**.
2. Review **Security & Anti-Abuse Posture**.
3. `READY` requires every server guard to pass.
4. Owner/Admin may run the duplicate sandbox probe. It must report `duplicateBlocked=true` and `cleaned=true`.
5. Only Owner may save a Production Security snapshot.
6. Treat any RLS missing, direct-write violation, sensitive RPC client grant, idempotency failure, CAS/rate failure, or invalid Admin role as a release blocker.
7. Do not “fix” a red gate by weakening the audit rule. Fix the underlying permission/constraint and rerun the posture.
8. Keep Support accounts read-only for Security review; use dedicated Owner/Admin actions for production mutations.
