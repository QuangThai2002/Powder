# Powder 20.12.0 — Reconciliation & Crash Recovery Guide

## Mục tiêu

Powder 20.12.0 bổ sung lớp đối soát và phục hồi giao dịch sau crash cho control-plane transaction đã hình thành ở 20.9–20.11. Phiên bản này **không thay đổi combat, Pow, skill, balance hoặc learning gameplay**.

Mục tiêu production là giải thích được mỗi mutation thành công bằng chuỗi bằng chứng thống nhất:

`Transaction Receipt → Canonical Dispatch → Atomic Effect Receipt → Resource Effect Ledger`

Nếu một mắt xích bắt buộc bị thiếu hoặc hash không khớp, hệ thống tạo reconciliation case và giữ Production Launch ở trạng thái HOLD.

## Resource Effect Ledger 20.12

Mỗi canonical business handler production phải ghi Resource Effect Ledger bằng cùng `txKey` đã nhận từ Mutation Gateway. Gateway 20.12 truyền thêm:

- `reconciliationVersion = 20.12.0`
- `canonicalRequestSha256`
- header `X-Powder-Reconciliation: 20.12.0`
- header `X-Powder-Request-SHA256`

Handler phải ghi hiệu ứng tài nguyên sau khi business mutation thực sự thành công, trong cùng ranh giới atomic thích hợp với hệ thống authoritative của handler.

Shared helper có sẵn tại:

`server/supabase/functions/_shared/reconciliation-v20120.ts`

Helper `recordResourceEffectsV20120(...)` fail-closed nếu RPC ghi ledger thất bại.

## Các loại anomaly được theo dõi

- Receipt/dispatch orphan.
- Dispatch thành công nhưng thiếu effect evidence.
- Request/result hash mismatch.
- Duplicate/effect collision.
- Recovery queue còn mở.
- `unexplained_delta`: mutation báo thành công nhưng không đủ Resource Effect Ledger để giải thích thay đổi tài nguyên.
- Scan hoặc crash drill quá hạn.

## Crash recovery

20.12 **không replay reward/mua hàng một cách mù quáng**. Khi kết quả transaction không chắc chắn, hệ thống ưu tiên bằng chứng đã commit/chưa commit và tạo case điều tra nếu không đủ bằng chứng.

Điều này ngăn tình huống crash sau khi đã cộng Coin/item nhưng client tưởng thất bại rồi tự cấp lại lần nữa.

## Repair workflow

Repair bắt buộc đi qua:

1. `propose_repair`
2. `approve_repair`
3. `apply_repair`

Mỗi bước lưu evidence hash, actor và audit Before/After. Repair tự động trong 20.12 chỉ được phép sửa trạng thái control-plane khi có bằng chứng chắc chắn. **Không có đường repair trực tiếp Coin, item, Inventory, Mail reward hoặc Event reward.**

Admin endpoint cũng từ chối action `resource_adjustment`.

## Admin

Vào **Admin → Mutation & Recovery → Reconciliation & Crash Recovery** để:

- xem posture hiện tại;
- chạy reconciliation scan;
- xem anomaly/case và evidence hash;
- chạy crash drill;
- propose/approve/apply repair có audit trail.

Các thao tác nhạy cảm như drill, approve và apply yêu cầu Owner theo chính sách server.

## Production readiness

Official Production chỉ được READY khi đồng thời:

- canonical mutation adapter evidence đạt yêu cầu production;
- reconciliation scan sạch;
- không còn orphan/hash mismatch/unexplained delta/recovery case mở;
- scan gần nhất còn trong cửa sổ freshness;
- crash drill gần nhất PASS và còn hiệu lực;
- Reliability/Transaction/Launch hard gate trước đó vẫn PASS.

## Giới hạn được giữ minh bạch

Artifact hiện tại **không chứa source production authoritative** của bốn Edge Function legacy:

- `powder-economy`
- `powder-inventory`
- `powder-liveops`
- `powder-learning-events`

Artifact cũng không chứa đầy đủ business tables authoritative của các service này. Vì vậy 20.12 không đoán tên bảng hoặc tạo logic bù Coin/item giả để ép PASS. Việc đối soát số dư business end-to-end chỉ có thể hoàn tất khi các handler production thật ghi Resource Effect Ledger và cung cấp evidence từ deployment thật.
