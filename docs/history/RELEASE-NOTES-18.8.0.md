# Powder 18.8.0 — Bành Trướng Lãnh Địa

## Phạm vi
- Khóa cứng đúng 9 Bành Trướng: 6 thường + 3 đặc biệt; không có loại thứ 10.
- Giữ 3 Giản Dị ở catalog riêng. Giản Dị dùng được cho PvE/PvP; Bành Trướng Online dùng server authority.
- PvP loadout khóa cùng đội hình 3 active + 2 reserve: 1 Giản Dị + cấp Sơ/Trung/Cao + 1 Bành Trướng.
- Giản Dị và Bành Trướng không thể cùng hoạt động; mở Bành Trướng sẽ đóng Giản Dị.

## 9 Bành Trướng đã khóa
### Thường
1. Cửu Nhật Phần Thiên Giới — thiêu đốt, Nhật Ấn và Bạo Viêm.
2. Thiên Kích Vô Tận Giới — tích liên kích và truy kích.
3. Huyền Băng Tịch Diệt Giới — Hàn Khí, Freeze và Phá Băng.
4. Bất Động Kim Cương Giới — giảm damage nhận và khiên mở đầu.
5. Vạn Độc Phệ Sinh Giới — Poison, anti-heal và ăn mòn.
6. Vạn Mộc Luân Sinh Giới — Sinh Khí, hồi phục, cleanse và shield.

### Đặc biệt
7. Vô Lượng Không Xứ — 5 câu mỗi gate, server chấm; chủ Lãnh Địa +20% damage/câu đúng; đối thủ sai 1 câu còn 50% damage, sai từ 2 câu damage về 0; tích 10 câu đúng gây 50% Max HP toàn đội đối phương.
8. Tọa Sát Bát Đồ — Jackpot RNG phía server, xác suất tăng sau mỗi lần trượt, full Energy và bất tử khi thành công.
9. Rút Kiếm Ra — 5 hành động, buff +30% damage/HP/lifesteal cho Pow không thuộc Hiệp sĩ/Đấu sĩ/Đỡ đòn; server chọn ngẫu nhiên 5 kiếm không lặp, mỗi kiếm 20% Max HP và hiệu ứng riêng, Tất Trúng.

## Server authority / anti-cheat
- Client không gửi damage, số câu đúng, sword roll, Jackpot result, HP hoặc winner.
- Vô Lượng dùng `sessionId`; đáp án đúng không được trả về client.
- Rút Kiếm và Jackpot RNG chạy phía server.
- Domain activation có clientActionId + expectedTurnNo để chống double action/stale state.
- Event ledger ghi activation, question result, sword, domain damage, guard, pursuit, burst, immortal và kết thúc terrain.
- RPC 18.8.0 bị khóa khỏi anon/authenticated; Edge Function JWT là cổng Online.

## Tương thích
- PvP 18.7.0/18.7.1 authority, reconnect, AFK, history/replay và balance layer được giữ nguyên.
- Combat PvE không bị cân lại chỉ để phục vụ PvP.
