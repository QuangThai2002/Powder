# Powder 20.17.0 — Final Release Checklist

- [x] Version/build/service worker = 20.17.0.
- [x] Player Save Integrity migration có server hash + snapshot + destructive guard.
- [x] Multi-device anomaly được ghi incident.
- [x] Save Integrity runtime load trước Online Foundation.
- [x] Admin Save Integrity dùng central Security 20.16.
- [x] ARM/resolve nhạy cảm yêu cầu Owner + AAL2.
- [x] Official Launch có hard gate `playerSaveIntegrityFinal`.
- [x] 22/22 gameplay critical file không đổi.
- [x] Transaction/Canonical/Reconciliation/Exploit/Load/DR/Security regressions PASS.
- [x] Final Gate 31/31 PASS trước package.
- [ ] Apply migration trên production.
- [ ] Redeploy Edge Functions liên quan.
- [ ] Run authoritative production scan.
- [ ] Critical = 0, High = 0, malformed = 0, missing snapshot = 0, revision anomaly = 0.
- [ ] Owner + AAL2 ARM Save Integrity gate.
- [ ] Chỉ sau các bước trên mới được tiến vào canary/RC.
