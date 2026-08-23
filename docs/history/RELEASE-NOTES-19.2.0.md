# Powder 19.2.0 — Official Release Gate

## Mục tiêu
19.2.0 là lớp khóa phát hành sau 19.1.0 Production Readiness. Bản này không thêm gameplay Combat mới và không thay đổi hệ số Combat/PvP/Boss/Domain.

## Thay đổi chính
- Build/version/cache được chuyển sang 19.2.0 / `powder-19.2.0-official-release-gate` / `powder-assets-v1920`.
- Boot loader `v1920` có manifest hash công khai trong diagnostics để đưa vào release seal.
- Thêm player-side `official-release-v1920.js` để kiểm tra release invariant mà không can thiệp gameplay.
- Thêm Admin Official Release Seal:
  - yêu cầu automated readiness PASS;
  - yêu cầu đủ 10/10 field validation từ 19.1.0;
  - tạo JSON seal có timestamp, manifest hash và SHA-256 checksum;
  - fail closed: chưa có seal thì Official Ready = false.
- Giữ nguyên key checklist 19.1.0 để không mất tiến độ test thực tế đã ghi trên máy Admin.
- Dọn boot-loader 19.1.0 cũ khỏi build và gom tài liệu lịch sử vào `docs/history/`.

## Trạng thái
- Automated build gate: PASS.
- `release.json`: `official=false`, `releaseState=official-gate`.
- Không tự bật đăng ký, không tự đổi Launch Gate server sang Live.
- Official/Live chỉ nên được bật sau khi hoàn tất pilot/mobile/network/soak/load/rollback field test và tạo release seal trong Admin.

## Backend
Không có migration database hoặc Edge Function mới trong 19.2.0. Server-authoritative Combat/PvP hiện tại được giữ nguyên.
