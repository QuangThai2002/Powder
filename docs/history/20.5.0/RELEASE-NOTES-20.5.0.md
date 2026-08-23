# Powder 20.5.0 — Player Support / GM Console

## Mục tiêu
20.5.0 bổ sung lớp vận hành hỗ trợ người chơi mà không sửa gameplay đã Freeze. GM/Support làm việc qua server-authoritative Edge/RPC; không có quyền sửa trực tiếp database từ client.

## Nâng cấp chính
- Trang **Hỗ trợ / GM** riêng trong Admin, không được nạp vào `index.html` người chơi.
- Tìm người chơi theo Tamer UID, tên hoặc email.
- Hồ sơ support đã redaction: Save chỉ có revision/schema/app-version/device-id đã mask; không trả `save_data`.
- Timeline: economy transaction delta, Mail + trạng thái claim, PvP summary, event progress/claim, monitoring/error, security incident metadata, account/device, backup metadata và Admin audit.
- Support Case + note + assignment + status workflow.
- Compensation Request: Support được đề xuất gói nhỏ có giới hạn cứng; Admin/Owner duyệt.
- Duyệt compensation là một transaction: khóa request → pre-compensation backup → tạo targeted Mail → ghi compensation batch → đánh request `sent`.
- Gọi lại request `sent` trả idempotent success, không tạo Mail/quà lần hai.
- Moderation chỉ Admin/Owner.

## Vá quyền cũ
`powder-admin` nâng lên v4:
- Support không đổi tên Tamer.
- Support không chỉnh tài nguyên/Rank/moderation.
- Raw Cloud Save export chỉ Owner.
- Mở chi tiết người chơi không còn tự gọi economy/world bootstrap, nên thao tác read không ghi DB.

## Trạng thái
- Gameplay critical: 22/22 byte-identical với Release Freeze baseline.
- 99 Pow / 99 kit / 396 skill unique.
- `official=false`; production release channel không được activate bởi bản này.
