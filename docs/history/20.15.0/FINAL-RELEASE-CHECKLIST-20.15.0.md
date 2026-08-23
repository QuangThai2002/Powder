# Powder 20.15.0 — Final Release Checklist

- [x] Release metadata = 20.15.0 / official=false.
- [x] Service Worker/cache namespace = 20.15.0.
- [x] 22 gameplay critical files byte-identical với Release Freeze baseline.
- [x] Passive DR runtime được boot, không tạo restore/network traffic.
- [x] External DR Runner có source/restore identity guard.
- [x] Restore cần explicit `POWDER_ALLOW_DR_RESTORE=1`.
- [x] Backup artifact + evidence SHA-256 contract.
- [x] RPO/RTO server-derived.
- [x] 12 critical table digest/row-count validation.
- [x] Post-restore smoke contract.
- [x] Forced failure rollback/recovery drill trên isolated restore DB.
- [x] Rollback build evidence contract.
- [x] Admin không thể tự nhập PASS.
- [x] Official Launch hard gate có Disaster Recovery 20.15.
- [x] Load/Soak, Transaction, Canonical Adapter, Reconciliation, Anti-Abuse regression giữ nguyên.
- [ ] Real source → isolated restore evidence PASS.
- [ ] DR Gate ARM trên deployment thật.
- [ ] Load + Soak + Overload evidence cho candidate 20.15 PASS.
- [ ] Canary/Official Production gate hoàn tất.

**Release state: HOLD for Official Live until real evidence exists.**
