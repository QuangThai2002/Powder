# Powder 20.4.0 — Disaster Recovery & Backup Integrity

## Mục tiêu
20.4.0 harden khả năng phục hồi trước khi Powder được phát hành rộng. Gameplay/Combat vẫn đóng băng.

## Nâng cấp
- Recovery Posture server-authoritative.
- Kiểm tra coverage của `player_backups` đối với mọi `player_saves` hiện có.
- Kiểm tra checksum backup, RLS/direct-write và quyền RPC restore.
- Schema fingerprint cho các bảng/hàm save/backup quan trọng.
- Sandbox Restore Drill: snapshot → mutate → restore → hash compare → cleanup, không chạm dữ liệu người chơi.
- Real Restore Evidence bắt buộc trên production; SHA-256 64 hex.
- RPO/RTO do server tự tính từ timestamp, không nhận số PASS do client tự khai.
- Target mặc định production: RPO ≤ 360 phút, RTO ≤ 60 phút, evidence mới trong 7 ngày.
- Official Launch preflight có thêm hard gate `recovery`.
- Recovery Runtime 20.4 thay lớp 19.4; heartbeat giảm 15s → 60s, server smoke chỉ chạy khi người dùng chủ động bấm.
- Admin Recovery Console phân quyền Support/Admin/Owner; không có nút restore database production.

## Trạng thái khi đóng build
- Backup coverage: PASS (2/2 save users có backup, 14 backup rows).
- Backup checksum: PASS.
- Restore RPC service-only: PASS.
- Schema fingerprint: PASS.
- Sandbox restore: PASS + cleanup.
- Real Restore Evidence: MISSING.
- Recovery Ready: **false / HOLD**.
- Production active version vẫn 18.3.0.
