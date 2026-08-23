# Powder 20.11.0 — Canonical Mutation Adapters

## Mục tiêu
20.11.0 tập trung đóng đường ghi tài nguyên trực tiếp từ player client và chuẩn hóa toàn bộ 18 mutation quan trọng qua `powder-mutation-gateway`, không thay đổi combat/gameplay đã freeze.

## Thay đổi chính
- 18/18 player write action có canonical route cố định.
- Player client dùng gateway-only; chế độ legacy write bị từ chối.
- Economy offline queue retry bằng đúng `txKey` cũ qua gateway.
- Gateway chỉ dispatch server-to-server tới allowlist 4 legacy Edge target.
- Kết quả mạng mơ hồ chuyển `unknown`; không tự replay tài nguyên.
- Evidence adapter phải chứng minh đồng thời: txKey idempotency, business atomicity, direct legacy write blocked.
- Evidence gắn SHA-256/target revision và phải còn fresh.
- Admin không có nút tự đánh dấu PASS.
- Official Launch 20.11 có hard gate `canonicalMutationAdapters` và route coverage 18/18.

## Trạng thái production
Source production thật của `powder-economy`, `powder-inventory`, `powder-liveops`, `powder-learning-events` không nằm trong artifact này. Vì vậy verification mặc định của 18 adapter là FALSE và Official Production Preflight phải HOLD cho đến khi CI/drill từ deployment thật cung cấp evidence hợp lệ.

`official=false` được giữ nguyên.
