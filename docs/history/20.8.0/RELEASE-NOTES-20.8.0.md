# Powder 20.8.0 — Production Reliability & Incident Recovery

20.8.0 không thêm gameplay mới. Bản này nâng lớp vận hành production sau Launch Control 20.7 và giữ nguyên Gameplay Freeze 19.9.

## Reliability Watchdog
- Health được server tự tổng hợp từ Observability 20.2, Recovery 20.4, Production Integrity 19.6 và LiveOps Incident 20.1.
- Admin không có trường nhập tay error rate, P95, crash hoặc save conflict.
- Watchdog duy trì `bad_streak` / `good_streak`; policy có ngưỡng degrade và ngưỡng recover riêng.
- Production automation mặc định **DISARMED** sau migration. Owner phải chủ động ARM sau khi dữ liệu Observability/Recovery là dữ liệu thật.

## Circuit Breaker
Các mode: `normal`, `degraded`, `read_only`, `emergency`.
- `normal`: circuit closed, ghi Cloud Save/economy bình thường.
- `degraded`: circuit half-open, giữ gameplay nhưng giảm FX phụ ở client.
- `read_only`: circuit open; Cloud Save/economy write có thể bị khóa theo policy để tránh ghi trạng thái sai trong incident nghiêm trọng.
- `emergency`: circuit open; client hợp lệ không đẩy Cloud Save mới và giữ pending sync để phục hồi sau.

## Player State Protection
- `reliability-runtime-v2080.js` đọc public reliability status an toàn, không lộ incident/audit nội bộ.
- `online-foundation-v150.js` chặn upload Cloud Save khi circuit không cho ghi, giữ `pendingSync=true` và tự đồng bộ lại khi service ổn định.
- Chỉ hiệu ứng nền/transition phụ bị giảm trong degraded/read-only/emergency; damage, skill, Pow, PvP và combat timing không bị sửa.

## Launch Control integration
- Launch Control được nâng để nhận candidate 20.8.0.
- Preflight mới có hard gate `reliabilityNormal`.
- Candidate không thể Activate/Advance/Finalize khi Reliability snapshot không healthy hoặc circuit không `closed`.
- Server-derived rollout health 5% → 20% → 50% → 100% của 20.7 vẫn được giữ.

## Regression
- 22/22 gameplay critical file byte-identical với baseline 19.9.0.
- Event Ops, Recovery, Security, Support, Observability và PvP server module giữ nguyên SHA-256 so với 20.7.0.
- 99 Pow / 99 kit / 396 skill unique giữ nguyên.

## Release status
`official=false`. Artifact không tự ARM automation, không tự tạo Production evidence và không tự activate release.
