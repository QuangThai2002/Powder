# Powder 21.0.0 — Official Production Readiness & Launch

## Mục tiêu
21.0.0 là lớp promotion chính thức trên Gold Master 20.20. Không thêm gameplay. Build giữ `official=false` cho tới khi server nhận đủ evidence production thật và rollout 5% → 20% → 50% → 100% đều PASS.

## Điều kiện bắt buộc
- Predecessor `powder-20.20.0-gold-master` đã 100%, finalized và stage health PASS.
- Gold Master posture 20.20 READY.
- Candidate 21.0 có ZIP SHA-256 + manifest hash đúng.
- 16 automated checks + 13 manual smoke checks PASS cho đúng build 21.0.
- Production evidence: deployment, manual smoke, load/soak, DR, security, save integrity, rollback đều PASS.
- Critical = 0, High = 0.
- Observability, Reliability, Transaction Safety, Canonical Mutation, Reconciliation, Anti-Abuse đều READY.
- Owner + AAL2/MFA ARM change window.

## Quy trình launch
1. Apply migrations 21.0 và redeploy `powder-admin-official-launch`.
2. Register candidate 21.0 với SHA-256 artifact thật.
3. CI/service ghi RC evidence và Official Production evidence (Admin UI không có quyền tự PASS hai evidence này).
4. Chạy Manual Smoke 13 luồng trên deployment thật.
5. Chạy rollback drill và xác nhận data-integrity + post-rollback health.
6. Owner tạo/approve/ARM release plan trong change window.
7. Activate 5%.
8. Chờ đủ sample/thời gian, Capture Server Health. Chỉ khi PASS mới advance 20% → 50% → 100%.
9. Ở 100%, capture final health và Finalize Official Live.

## Nguyên tắc fail-closed
- Không có nhập tay error rate/P95/P99/crash/save conflict.
- Evidence của build khác hoặc manifest khác không được dùng lại.
- Unknown transaction/recovery/reconciliation anomaly làm HOLD.
- Thiếu production evidence hoặc predecessor Gold Master chưa finalized làm HOLD.
- Runtime người chơi 21.0 không tự launch hay tự tạo traffic.
