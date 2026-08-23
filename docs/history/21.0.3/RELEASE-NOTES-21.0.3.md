# Powder 21.0.3 — Live Observability & SLO Enforcement

21.0.3 không thay đổi gameplay/combat. Bản này bổ sung lớp SLO/SLI và error-budget enforcement trên nền Observability 20.2, Launch Stabilization 21.0.1 và Hotfix Safety 21.0.2.

## Thay đổi chính
- SLO availability mặc định: **99.5%**.
- Latency SLO: **P95 ≤ 1500 ms**, **P99 ≤ 2500 ms**.
- Burn-rate nhiều cửa sổ: **15 phút / 60 phút / 6 giờ**.
- Fast burn mặc định ≤ **4×**; slow burn ≤ **2×**.
- Error budget 30 ngày phải còn tối thiểu **25%**.
- Snapshot SLO được server tự tính từ `observability_api_samples_v2020` và `observability_client_health_v2020`; Admin không gửi metric để tự PASS.
- Khi Guard đã ARM và SLO breach: rollout tự chuyển `emergency_mode=halt`.
- Không automatic rollback database/save/inventory.
- Thêm `powder_live_slo_assert_release_allowed_v21003()` để workflow release/hotfix fail-closed khi SLO posture chưa READY.
- Thêm Admin Live SLO console; ARM/DISARM/Emergency HOLD yêu cầu Owner + MFA/AAL2.
- Sửa đồng bộ version drift ở title/PWA/Environment/Service Worker và khóa Service Worker ↔ boot-loader 21.0.3.

## Freeze
22/22 gameplay critical files giữ nguyên so với Release Freeze baseline.
