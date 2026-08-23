# Final Release Checklist — Powder 20.7.0

- [x] Release metadata = `20.7.0` / `production-launch-control-hardening` / `official=false`.
- [x] Service Worker = 20.7.0 / BUILD 20700 / `powder-assets-v2070`.
- [x] Boot loader = v2070, manifest 1260 entries, no missing asset.
- [x] 22/22 gameplay critical files byte-identical với Freeze baseline 19.9.0.
- [x] 99 Pow / 99 kit / 396 skill unique.
- [x] Release authorization workflow có Draft → Submit → Owner Approve → ARM → Consumed/Revoke.
- [x] Candidate bound vào manifest hash + artifact SHA-256.
- [x] Rollback target được pin vào active build trước activation.
- [x] Change window bắt buộc và fail-closed khi ngoài window.
- [x] Manual stage-health input bị khóa; API cũ trả 410.
- [x] Stage health lấy server-side từ Observability theo build + rollout ring.
- [x] Minimum 15 phút + min requests + error/P95/P99/crash/save-conflict policy.
- [x] Rollout chỉ 5 → 20 → 50 → 100.
- [x] Security / Recovery / Integrity / Real Pilot / LiveOps incidents đều nằm trong preflight.
- [x] Admin Production mutation Owner-only.
- [x] HTML local refs, duplicate IDs, CSS structure, JS syntax và manifest integrity qua automated final gate.
- [ ] Production Observability thật được bật và có đủ sample.
- [ ] Real Pilot / Recovery evidence thật đang PASS tại thời điểm release.
- [ ] ZIP SHA-256 của artifact deploy được Register trên server.
- [ ] Owner ARM plan trong change window thật.
- [ ] 5/20/50/100 server health thật đều PASS.
- [ ] Finalize Official Live được Owner thực hiện.

Các mục cuối cố ý chưa đánh dấu: artifact build không được giả lập bằng chứng production.
