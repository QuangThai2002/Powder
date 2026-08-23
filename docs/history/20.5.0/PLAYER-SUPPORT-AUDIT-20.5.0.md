# Player Support Security Audit — 20.5.0

## Production backend
- `powder-admin-support` v2 — ACTIVE — JWT ON.
- `powder-admin` v4 — ACTIVE — JWT ON.
- Migration `player_support_gm_console_2050` applied.

## Support posture
- Direct writes from anon/authenticated to support tables: 0.
- Sensitive compensation-approval RPC client EXECUTE: 0.
- Invalid active Admin roles: 0.
- `service_role` retains required authority.

## Compensation safety
Validator tests:
- `{coins:1}` → accepted.
- `{coins:100001}` → rejected.
- `{items:[]}` → rejected.
Approval RPC contract contains row lock, `sent` idempotent branch, pre-compensation backup, targeted Mail and compensation batch creation.

## Data minimization
Support endpoint returns save metadata only; raw `save_data` is intentionally absent. Error/security/account/device/backup views are redacted or metadata-only.

## Production mutation during verification
No support case, compensation request or test Mail was created while validating 20.5.0.
