# Powder 20.15.0 — Disaster Recovery & Backup Validation

## Mục tiêu
20.15.0 nâng lớp Recovery 20.4 thành một quy trình restore có bằng chứng độc lập trước khi Powder được phép tiến gần Official Production. Gameplay/Combat tiếp tục đóng băng.

## Nâng cấp
- External DR Runner tạo `pg_dump` chỉ đọc từ source và restore vào database cô lập do operator cung cấp.
- Runner từ chối chạy nếu source và restore database có cùng fingerprint.
- Restore bị khóa mặc định; phải đặt `POWDER_ALLOW_DR_RESTORE=1`.
- Backup artifact có SHA-256 + size; evidence bundle có SHA-256 và được Edge Function tự tính lại trước khi ingest.
- RPO/RTO do server tính từ timestamp; runner/Admin không được gửi trường PASS.
- Đối chiếu schema digest và 12 bảng trọng yếu: Save/Backup/Economy/Pow/progression + transaction/mutation/reconciliation ledger.
- Post-restore smoke bắt buộc cho Cloud Save, Economy, Pow, Inventory và Transaction evidence.
- Failure rollback drill trên restore DB chứng minh forced error không để lại write nửa chừng và database tiếp tục phục vụ sau lỗi.
- Rollback build evidence phải chỉ tới build khác candidate, tồn tại trong release registry và có SHA-256 evidence.
- Admin 20.15 chỉ xem posture và ARM/DISARM gate; không có nút tự ghi PASS/Real Restore.
- Official Launch 20.15 có hard gate `disasterRecoveryBackupValidation`.
- Recovery 20.4 vẫn cung cấp technical baseline; Real Restore 20.15 thay thế đường evidence checkbox cũ trong quyết định phát hành.
- Player runtime 20.15 passive-only: không tự backup, restore hay tạo network load.

## Trạng thái phát hành
`official=false`. Build chỉ READY cho bước tiếp theo khi deployment thật có DR evidence PASS còn hạn, Load/Soak 20.14 của chính candidate PASS và toàn bộ hard gate trước đó vẫn sạch.
