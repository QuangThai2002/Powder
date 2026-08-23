# Production Reliability Guide — 20.8.0

## Deploy
1. Deploy migration `20260823_2080_production_reliability_incident_recovery.sql`.
2. Deploy Edge Function `powder-admin-reliability` 20.8.0.
3. Deploy Edge Function `powder-admin-official-launch` 20.8.0 để Launch Control nhận candidate 20.8.
4. Deploy web build và service worker 20.8.0.
5. Không ARM automation cho đến khi Observability Production bật, đủ sample và Recovery Posture/Real Restore là dữ liệu thật.

## Watchdog
Trong Admin → Reliability:
- `Run Server Watchdog` chỉ yêu cầu server tự chụp health; không nhận số liệu health từ browser.
- Soft failure lặp đủ `bad_checks_to_degrade` mới auto chuyển `normal → degraded`.
- Hard failure như Critical Incident, crash/save-conflict vượt ngưỡng, Recovery/Integrity fail có thể chuyển sang `read_only` ngay khi automation đã ARM.
- Recovery chỉ về `normal` sau đủ `good_checks_to_recover` và qua cooldown.

## Scheduler
Có thể gọi `powder_reliability_watchdog_v2080` định kỳ bằng service-role từ scheduler hạ tầng. Migration không tự tạo cron và không tự ARM Production.

## Incident flow
1. LiveOps mở incident và phân severity.
2. Watchdog server chụp health.
3. Nếu hard failure: circuit `open`, mode `read_only`.
4. Client hợp lệ ngừng upload Cloud Save mới, giữ pending local state.
5. Điều tra/khôi phục bằng Observability + Recovery tooling.
6. Khi health ổn định đủ policy, watchdog mới auto recovery; Owner luôn có manual failsafe nếu cần.
7. Pending Cloud Save được client đồng bộ lại sau khi public status cho phép ghi.

## Launch interaction
`reliabilityNormal` là hard gate của Production Launch Control. Không được chuyển mode về NORMAL chỉ để vượt launch gate khi incident/recovery thực tế chưa được xử lý; snapshot server vẫn có thể giữ `healthy=false` và preflight tiếp tục HOLD.
