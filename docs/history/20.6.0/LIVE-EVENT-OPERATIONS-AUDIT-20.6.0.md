# Live Event Operations Audit — 20.6.0

## Backend
- `powder-admin-events` v6 ACTIVE, JWT ON.
- Event Ops tables RLS ON.
- anon/authenticated direct writes: denied.
- publish/rollback/eligibility RPC: service-role only.
- old direct `save/toggle/delete`: blocked by Edge v6.

## Regression finding fixed
Event Shop previously counted purchases before a per-user/event/shop lock, allowing a concurrent race around per-player limits. 20.6 adds an advisory transaction lock before count/check/deduct/claim.

## Server probe
A transaction-only probe performed:
`approved draft → publish → verify runtime active → rollback → verify runtime inactive → transaction rollback`.
Result: PASS. Persisted probe drafts: 0. Persisted probe events: 0.

## Player eligibility
Eligibility is enforced by DB functions used by the player Edge, including event state, mission/completion claim, shop purchase, combat start and quiz eligibility. Client UI is not authority.

## No gameplay change
Critical gameplay files remain checked against `RELEASE-FREEZE-BASELINE-19.9.0.json`.

## Final production state
- Probe Drafts: 0
- Probe Events: 0
- Existing active legacy events: 1 (left untouched)
- Production release: 18.3.0 / `powder-18.3.0-production-clean-baseline`
- `powder-admin-events`: v6 ACTIVE, JWT ON
