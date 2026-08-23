# Powder 19.5.0 — Safe Live Rollout & Emergency Controls

## Mục tiêu
19.5.0 không thay Combat. Bản này bổ sung lớp vận hành an toàn trước Live: cohort rollout ổn định theo thiết bị, emergency halt tương thích client cũ, rollback target có checksum, và release seal mới.

## Player release runtime
- Cohort bucket 0–99 được hash từ `powder_device_v150 + rolloutSalt`; cùng thiết bị luôn ở cùng cohort khi salt không đổi.
- `rolloutPercent` chỉ quyết định cohort nào nhận thông báo/rollout bản mới. `minimumVersion` vẫn là hard gate cho 100% client.
- `emergencyMode=halt` chặn Online ngay; server đồng thời bật legacy `hardMaintenance` để client cũ cũng dừng.
- Service Worker registration bỏ query version hardcode, lấy trực tiếp version hiện tại và sinh build tag 19.5.0 → 19500.

## Admin Safe Rollout
- Production/Staging rollout 0–100%.
- Preset 5/25/50/100%.
- Emergency Stop/Resume; production chỉ Owner.
- Khóa rollback target; production chỉ Owner.
- Rollback thật chỉ tới đúng target đã khóa và target bắt buộc có SHA-256 hợp lệ.
- Toàn bộ thao tác ghi admin audit/deployment log.

## Release seal
- Seal 19.4 không được kế thừa.
- 19.5 seal yêu cầu automated readiness, 10/10 field proof, manifest hash hiện tại và Safe Rollout server state 19.5.
- Chỉnh file sau seal làm manifest hash lệch và seal mất hiệu lực.

## Backend
- Migration `20260822_1950_safe_live_rollout.sql` đã được apply.
- `powder-admin-rollout` latest production Edge: version 9, ACTIVE, `verify_jwt=true`.
- `release_rollout_v1950` mặc định production/staging = 100%, emergency normal.
- `anon/authenticated` không có SELECT trực tiếp; release manifest function chỉ service role execute.
- Production release channel không được activate sang 19.5.0 trong mốc này.
