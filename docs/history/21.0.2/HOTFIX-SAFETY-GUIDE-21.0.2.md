# Hotfix Safety Guide — 21.0.2

1. Deploy migration and `powder-admin-hotfix-safety`.
2. Configure manifest hash, artifact SHA-256 and rollback target.
3. Owner + MFA/AAL2 arms the Hotfix Guard.
4. CI records evidence with changed-file count, migration count, zero gameplay/API/destructive schema drift, test PASS, rollback-ready and Critical/High = 0.
5. If evidence exceeds budget, the hotfix is HOLD; promote the change to a normal minor release instead.
6. Automatic action is limited to `emergency_mode=halt`; data rollback remains manual and audited.
