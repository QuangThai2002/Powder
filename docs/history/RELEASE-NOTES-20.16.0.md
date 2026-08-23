# Powder 20.16.0 — Security & Permission Final Hardening

20.16 is the final security/permission hardening milestone before Player Save Integrity Final.

Highlights:
- Central access contract across all 17 Admin Edge Functions.
- Server-side role revalidation, JWT freshness, revoke controls and strict Origin allowlist.
- MFA/AAL2 enforcement for 48 high-impact actions while preserving existing business-role semantics where appropriate.
- Owner+AAL2 remains mandatory for production launch, rollback/emergency, security configuration and other Owner-only operations.
- Global PostgreSQL SECURITY DEFINER EXECUTE lockdown.
- Security RPCs service-role only.
- Admin Security UI with Critical/High posture, denied-access audit, origin configuration and snapshot.
- Official Launch 20.16 blocks canary unless Security Critical=0 and High=0.
- Fixed Admin session storage mismatch and stale candidate build IDs in operational panels/runtime.
- No gameplay/combat changes.

`official=false` remains intentional until production security evidence exists.
