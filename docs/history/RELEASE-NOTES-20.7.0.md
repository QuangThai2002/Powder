# Powder 20.7.0 — Production Launch Control Hardening

20.7.0 không thêm gameplay mới. Bản này harden bước cuối trước khi có thể bật Powder cho người chơi thật, đồng thời giữ nguyên Gameplay Freeze 19.9.

## Production Launch Authorization
- Candidate 20.7.0 được bind với ZIP SHA-256 + manifest hash.
- Workflow: **Register Candidate → Record Evidence → Save Draft Plan → Submit → Owner Approve → ARM → Canary Rollout → Finalize**.
- Release Plan khóa change window 1–24 giờ và rollback target là build Production đang active tại thời điểm ARM.
- Candidate/checksum/manifest/active build bị drift sau Submit/Approve sẽ fail-closed.
- Production mutation vẫn Owner-only.

## Server-derived rollout health
20.7 loại bỏ cơ chế Admin tự nhập `observedMinutes/errorRate/P95/crash/saveErrors` để tự đánh dấu PASS.

Admin chỉ có nút **Capture Server Health**. Server tự tính từ Observability của đúng:
- channel;
- build ID;
- rollout ring 5/20/50/100;
- cửa sổ 30 phút.

PASS yêu cầu:
- Observability đang bật;
- đủ `min_requests` theo policy;
- sample trải tối thiểu 15 phút;
- error rate ≤ policy;
- P95/P99 ≤ policy;
- crash và save conflict ≤ policy.

Evidence stage chỉ có hiệu lực 6 giờ và phải thuộc đúng stage hiện tại.

## Fail-closed preflight
Activation/advance/finalize bị chặn nếu thiếu bất kỳ điều kiện nào:
- candidate checksum hợp lệ;
- Production Integrity PASS;
- Security Posture PASS;
- Recovery Posture PASS;
- Real Pilot PASS;
- không có Critical/High LiveOps incident;
- 4 build evidence PASS đúng manifest;
- Observability được bật;
- rollback target được pin;
- release authorization = ARMED;
- change window đang mở.

## Rollout
Rollout vẫn chỉ theo chuỗi **5% → 20% → 50% → 100%**. Không có đường nhảy thẳng 100%.

## Gameplay Freeze
22 file Combat/gameplay critical giữ nguyên SHA-256 so với baseline 19.9.0. 99 Pow / 99 kit / 396 skill unique vẫn giữ nguyên.

## Release status
`official=false`. Build này cung cấp cơ chế có thể đi tới Official Live, nhưng artifact được đóng gói không tự activate Production và không tự giả lập evidence thực tế.
