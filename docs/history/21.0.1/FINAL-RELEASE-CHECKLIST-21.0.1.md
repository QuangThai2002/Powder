# Final Release Checklist — 21.0.1

- [x] Release metadata 21.0.1 đúng build ID.
- [x] 21.0.0 Official Production lock được giữ trong history.
- [x] 22/22 gameplay critical file không đổi.
- [x] Post-launch evidence chỉ server/CI được ghi.
- [x] Automatic HALT chỉ khi Owner đã ARM policy.
- [x] Không có automatic rollback/save/resource replay.
- [x] Resume yêu cầu fresh PASS + 0 Critical/High.
- [x] Admin surface được Security 20.16 bảo vệ.
- [x] Boot 21.0.1 chỉ có một current loader.
- [x] Final automated regression PASS.
- [ ] Deploy production migration/function thật.
- [ ] ARM bằng Owner + MFA/AAL2 trên production.
- [ ] Thu server health evidence thật sau deploy.
- [ ] Xác nhận rollback target 21.0.0 khả dụng.

`official=false` cho tới khi các mục production thật được hoàn tất.
