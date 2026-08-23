# Powder 18.7.0 — PvP Online 2.0

## Mục tiêu

18.7.0 hoàn thiện lớp PvP Online server-authoritative trước khi bước sang cân bằng PvP 18.7.1. Bản này không chỉnh hệ số hoặc gameplay PvE chỉ để phục vụ PvP.

## Thay đổi chính

- Server timer 45 giây hiển thị trực tiếp trong UI và được refresh từ state server.
- Reconnect lấy lại đúng lobby/trận đang active; mất mạng không tạo lại hoặc reset trận ở client.
- 90 giây reconnect grace và 3 AFK strike được hiển thị rõ cho cả hai phía.
- Đội hình đúng 5 Pow: slot 1–3 active, slot 4–5 reserve; server tự xác định active slots từ đội còn sống.
- Actor và target được chọn rõ ràng; chỉ mục tiêu active hợp lệ mới được gửi.
- Surrender, server battle result, rematch, match history và full event replay ledger.
- Hành động 18.7.0 gửi `clientActionId` + `expectedTurnNo`.
- RPC `powder_pvp_action_v1870` dùng transaction/advisory lock + receipt để retry cùng action không đánh hai lần.
- Client state cũ bị reject bằng `STALE_PVP_STATE`, sau đó client bắt buộc sync lại state server.
- PvP Edge vẫn tương thích client 18.6.x; client cũ dùng đường legacy trong giai đoạn chuyển tiếp.
- AFK/disconnect timeout được tính là forfeit trong PvP statistics.

## Backend

Supabase migration: `server/supabase/migrations/20260822_1870_pvp_online_2.sql`.

Edge source: `server/supabase/functions/powder-pvp/index.ts`.

Production Supabase đã được nâng Edge `powder-pvp` lên version 3 với `verify_jwt=true`. RPC mới chỉ cấp quyền `service_role`; `anon` và `authenticated` không thể gọi trực tiếp để bypass Edge.

## Player UI

Module: `js/pvp-online-v1870.js`.

Style: `css/pvp-online-v1870.css`.

PvP nằm trong **Cộng đồng**. Nút **Giao lưu** được gắn vào card bạn bè; khi có lobby/trận active, PvP panel chuyển sang đội hình/trận đang chạy. Replay chỉ đọc ledger server và không thay đổi kết quả.

## Không thuộc 18.7.0

- Không áp PvP coefficient/balance layer mới; việc đó thuộc 18.7.1.
- Không tích hợp 9 Bành Trướng trong mốc này; việc đó thuộc 18.8.0.
- Không sửa kit 99 Pow ở mốc này; audit identity thuộc 18.8.1.
