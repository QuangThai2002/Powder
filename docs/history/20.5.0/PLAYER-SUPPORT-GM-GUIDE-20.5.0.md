# Player Support / GM Guide — 20.5.0

## Role
### Support
Được tra cứu hồ sơ redacted, mở/cập nhật case, thêm note và tạo Compensation Request. Không được đổi tên, chỉnh Rank/tài nguyên, moderation hay export raw Cloud Save.

### Admin
Có quyền Support + duyệt/từ chối compensation + moderation. Không được export raw Cloud Save qua Player Management.

### Owner
Có quyền Admin + export raw Cloud Save ở Player Management.

## Quy trình hỗ trợ
1. Mở `Admin → Hỗ trợ / GM`.
2. Tìm theo Tamer UID/tên/email.
3. Xem timeline để xác định save/reward/PvP/mail/event/error/device/backup gần nhất.
4. Tạo Support Case và ghi note điều tra.
5. Nếu cần bồi thường, tạo Compensation Request và gắn case.
6. Admin/Owner xem hàng đợi, duyệt hoặc từ chối.
7. Khi duyệt, server tạo pre-compensation backup rồi gửi quà qua Hộp thư.
8. Người chơi tự claim Mail; claim vẫn dùng idempotency `powder_claim_mail`.

## Giới hạn Compensation Request
- Coin ≤ 100.000
- Knowledge ≤ 1.000
- PowCandy Thường ≤ 1.000
- PowCandy Hiếm ≤ 500
- PowCandy Huyền thoại ≤ 100
- Vé Cổ Ấn ≤ 100
- Tinh Tệ ≤ 10.000
- Mỗi loại PowBall ≤ 10
- Support path không cho item/equipment/artifact trực tiếp.

## Nguyên tắc riêng tư
GM endpoint không trả raw Cloud Save, monitoring context, security incident details, account event metadata hoặc backup snapshot. Device ID được mask.
