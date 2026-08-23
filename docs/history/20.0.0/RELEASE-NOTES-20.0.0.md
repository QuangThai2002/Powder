# Powder 20.0.0 — Official Launch Gate

## Mục tiêu
20.0.0 là build chuẩn bị phát hành chính thức, không phải một bản mở rộng Combat. Gameplay đã bị đóng băng từ 19.9.0 và 22 file gameplay critical phải giữ nguyên SHA-256.

## Mới trong 20.0.0
- Official Launch server preflight, fail-closed.
- Candidate registration không tự activate production.
- 4 evidence bắt buộc: Load 19.6, Recovery 19.4, Polish 20.0, Freeze 20.0.
- Freeze 20.0 hash trực tiếp 22 file gameplay và so với baseline 19.9.
- Canary rollout chỉ theo chuỗi 5% → 20% → 50% → 100%.
- Mỗi lần advance cần stage-health PASS trong 24 giờ.
- Stage-health PASS yêu cầu tối thiểu 15 phút quan sát, error rate ≤1%, P95 ≤1500ms, crash/save/Critical/High = 0.
- Finalize Official Live chỉ mở sau rollout 100% và stage 100% health PASS.
- Production mutation chỉ Owner; mọi thao tác ghi có audit log và confirmation phrase trên Admin UI.
- Emergency/rollback 19.5 tiếp tục giữ nguyên và có thể dùng khi rollout xảy ra sự cố.

## Trạng thái khi đóng build
20.0.0 vẫn `official=false` và `releaseState=official-launch-gate`.
Production chưa được chuyển khỏi build 18.3.0 trong quá trình tạo artifact này.
