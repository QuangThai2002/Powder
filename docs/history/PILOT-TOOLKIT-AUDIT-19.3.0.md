# Pilot Toolkit Audit — 19.3.0

## Safety
- Pilot runtime không gửi action Combat/PvP mới.
- Không cấp reward.
- Không sửa Cloud Save.
- Không giả lập navigator.onLine để tạo evidence giả.
- Soak chỉ cộng thời gian khi document không hidden.
- Evidence được giới hạn số session/event/FPS run để tránh localStorage tăng vô hạn.

## Objective evidence rules
- `pvp10`: >=2 device packages và >=10 distinct match IDs.
- `reconnect`: >=1 offline event và >=1 `powder:network-reconnected` event.
- `afk`: max AFK strike >=3 hoặc finish reason `afk_limit` / `disconnect_timeout`.
- `domains`: đủ 9 expansion IDs canonical.
- `mobile`: đã thấy 320, 360, 390, 430 px (sai số ±2px ở player runtime).
- `soak2`: longest active session >=7,200,000ms.
- `soak4`: longest active session >=14,400,000ms.

## Multi-device aggregation test
Synthetic VM test dùng 2 devices, 10 distinct matches, 9 domains, 4 viewport targets, reconnect, AFK=3 và 4h active soak. Kết quả: 7/7 objective evidence PASS.

## Player state collector test
Synthetic PvP state test xác nhận collector đọc được match ID, active expansion, domain event, AFK strike và finish reason mà không gọi network API.
