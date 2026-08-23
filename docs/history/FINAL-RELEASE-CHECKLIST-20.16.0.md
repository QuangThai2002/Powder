# Powder 20.16.0 — Final Release Checklist

- [x] Release metadata 20.16.0 / `official=false`
- [x] 17/17 Admin Edge Function central guard
- [x] 48 critical/high-impact actions MFA/AAL2 protected
- [x] Admin role revalidation from `admin_allowlist`
- [x] JWT iat/exp freshness checks
- [x] User/token revocation
- [x] Origin allowlist + missing-origin fail-closed
- [x] SECURITY DEFINER global privilege lockdown
- [x] Security RPC service-role only
- [x] Official Launch `securityPermissionFinal` hard gate
- [x] Admin session storage bug fixed
- [x] Environment/runtime candidate buildId synchronized
- [x] 22/22 gameplay freeze unchanged
- [x] Transaction/Canonical/Reconciliation/Exploit regression PASS
- [x] Load/Soak regression PASS
- [x] Disaster Recovery regression PASS
- [x] Security runtime PASS
- [x] Final static/runtime gate PASS
- [ ] Production migration applied
- [ ] 17 Admin Edge Functions redeployed in production
- [ ] Production Owner MFA/AAL2 verified
- [ ] Production origin allowlist configured
- [ ] Production Security posture Critical=0 / High=0
- [ ] Production Security snapshot/evidence captured

Production remains HOLD until all unchecked production-only items are complete.
