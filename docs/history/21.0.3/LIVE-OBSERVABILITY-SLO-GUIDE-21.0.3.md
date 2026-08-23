# Powder 21.0.3 — Live Observability & SLO Guide

## Mục tiêu
SLO 21.0.3 phát hiện hệ thống xuống chất lượng trước khi lỗi trở thành outage lớn. Nó không thay thế Observability 20.2; nó biến metric đã thu thập thành release/operations guard có error budget.

## Policy mặc định
- Availability target: 99.5%.
- P95: 1500 ms.
- P99: 2500 ms.
- 60m minimum sample: 500 requests.
- Fast burn (15m): tối đa 4×.
- Slow burn (6h): tối đa 2×.
- Error budget 30d còn lại: tối thiểu 25%.
- Crash 60m: 0.
- Save conflict 60m: 0.

## Luồng vận hành
1. Deploy migration `20260823_21003_live_observability_slo_enforcement.sql`.
2. Deploy `powder-admin-live-slo`.
3. Đảm bảo Observability production đang ingest metric đúng build `powder-21.0.3-live-observability-slo`.
4. Owner đăng nhập Admin với MFA/AAL2 và ARM SLO Guard bằng manifest hash + artifact SHA-256.
5. Service/CI định kỳ gọi `powder_live_slo_capture_v21003(...)`.
6. Kiểm `powder_live_slo_posture_v21003(...)`.
7. Release/hotfix workflow gọi `powder_live_slo_assert_release_allowed_v21003(...)` trước khi tiếp tục.

## Khi breach
Nếu Guard đã ARM và snapshot bị HOLD, server chuyển rollout sang `emergency_mode=halt` và ghi SLO incident. Không có logic tự rollback save, tiền, inventory hoặc database. Sau khi xử lý nguyên nhân, cần snapshot mới PASS và incident được xử lý trước khi workflow release tiếp tục.

## Lưu ý
Các gate local xác minh kiến trúc/harness. Chúng không chứng minh production đã đạt 99.5% availability; số liệu thật chỉ có sau khi deploy và thu đủ sample.
