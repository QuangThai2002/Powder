# Powder 20.3.0 — Final Release Checklist

- [x] Release metadata = 20.3.0 / official=false.
- [x] 22/22 gameplay-critical files match Release Freeze baseline.
- [x] 99 Pow / 99 kits / 396 unique skill IDs.
- [x] Security Posture migration applied.
- [x] `powder-admin-security` ACTIVE + JWT.
- [x] Critical table RLS audit PASS.
- [x] Direct client-write audit PASS.
- [x] Sensitive RPC client EXECUTE audit PASS.
- [x] Reward/PvP idempotency guards PASS.
- [x] Cloud Save CAS and rate guard service-only PASS.
- [x] Device revoke guard PASS.
- [x] Duplicate sandbox probe PASS + cleaned.
- [x] Official Launch preflight includes `securityPosture` hard gate.
- [x] Admin role matrix enforces Support/Admin/Owner separation.
- [ ] Real Pilot 20–50 evidence completed.
- [ ] Real load evidence completed.
- [ ] Recovery/rollback field evidence completed.
- [ ] Production candidate activated.
