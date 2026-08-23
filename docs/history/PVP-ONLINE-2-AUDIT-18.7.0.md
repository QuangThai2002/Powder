# Powder 18.7.0 — PvP Online 2.0 Audit

## Authority map

| Hạng mục | Authority |
|---|---|
| Match/lobby ownership | Server |
| 3 active + 2 reserve | Server slots |
| Current player / turn number | Server |
| 45s turn timer | Server `turn_started_at` |
| AFK strike / disconnect timeout | Server |
| Damage / heal / shield / CC | Server RPC |
| Winner / finish reason | Server |
| PvP stats | DB trigger |
| Match history / replay | Server DB ledger |
| UI interpolation của timer | Client display only |
| Actor/target/skill selection | Client intent only |

## Double-action / stale-state hardening

18.7.0 không dựa vào disable button để chống double action. Mỗi action mới có `clientActionId` ngẫu nhiên và `expectedTurnNo`.

`powder_pvp_action_v1870`:

1. khóa action theo match/user/action id;
2. trả receipt cũ nếu cùng action được retry;
3. khóa row trận;
4. so sánh `expectedTurnNo` với turn server;
5. reject stale state trước khi áp hành động;
6. gọi action engine server cũ trong cùng transaction;
7. lưu authoritative result receipt.

Nếu transaction lỗi trước khi lưu receipt, toàn bộ thay đổi action cùng transaction bị rollback; client sync state thay vì tự đoán kết quả.

## Reconnect / AFK

- Poll active ~1.1s, lobby ~1.8s khi trang phù hợp.
- Khi browser `online`, `powder:network-reconnected`, đăng nhập lại hoặc trở lại tab, client gọi `state`.
- Edge resolve timeout bằng server clock trước khi refresh `last_seen_at`; reconnect quá 90 giây không thể tự cứu bằng một heartbeat đến muộn.
- Mất mạng phía client không xóa local match id và không tạo trận mới; state authoritative vẫn ở DB.

## Replay / debug

`pvp_match_events` là ledger. State trả phần gần nhất để UI hiển thị; `replay` trả full ledger (giới hạn an toàn 1200 event) cho chính hai participant. Client có event stepper và copy JSON để debug.

## Security checks

- `powder-pvp` Edge: JWT required.
- account/game moderation guard vẫn chạy trước PvP action.
- rate guard giữ nguyên và bổ sung history/replay/rematch limits.
- RPC 18.7.0 không cấp execute cho `anon`/`authenticated`.
- Client mới không gọi `/rest/v1/rpc` và không gửi damage/winner/HP lên server.
