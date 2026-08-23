# Production Reliability Audit — 20.8.0

## Scope
Không thay đổi gameplay/combat. Audit tập trung vào server-derived health, circuit transition, Cloud Save write protection, Admin authorization và Launch Control integration.

## Findings
- Reliability health không lấy error/P95/crash/save-conflict từ Admin request.
- Dangerous policy/mode mutation là Owner-only; watchdog có thể chạy bởi Owner/Admin.
- Production automation mặc định DISARMED.
- Public status chỉ trả mode/circuit/generation/write permissions/FX mode.
- Client Cloud Save hợp lệ kiểm `canCloudWrite()` trước khi upload; khi block giữ pending sync thay vì ghi revision mới.
- Launch preflight 20.8 bắt buộc Reliability healthy + mode normal + circuit closed.
- 22 gameplay file frozen không đổi.

## Legacy module regression
Các Edge Function sau giữ SHA-256 nguyên vẹn so với 20.7.0:
- powder-admin-events
- powder-admin-recovery
- powder-admin-security
- powder-admin-support
- powder-admin-observability
- powder-observability
- powder-pvp

## Known deployment boundary
`powder_reliability_can_write_v2080()` được cung cấp cho server-side mutations. Web client đã tích hợp Cloud Save guard. Những Edge Function server khác muốn hard-block economy/inventory ở DB boundary cần gọi guard service-role trước mutation; 20.8 không tự viết lại các function gameplay đang freeze.
