# Powder 18.8.2 — Admin Manual Combat Lab

## Mục tiêu
18.8.2 bổ sung **Combat Test Lab · Manual FX Arena** trong Admin để kiểm tra trực quan các hiệu ứng Combat đã nâng cấp mà không cần đi qua bài học, Boss hay PvP Online thật.

## Manual FX Arena
- Dùng trực tiếp catalog **99 Pow canonical** và **396 fixed skills V8.1**.
- Dựng hai đội, mỗi bên **3 active + 2 reserve**.
- Click Pow để chọn actor/target; Shift+click để ép target.
- Chọn và kích hoạt Basic / Skill 1 / Skill 2 / Ultimate bằng tay.
- Ép HP %, Mana, Nộ và Shield.
- Ép trạng thái: Burn, Poison, Freeze, Stun, Shield, Regeneration, Slow, Attack Up, Defense Up, AP Up, Curse, Anti-Heal.
- Quick FX: Damage, Crit, Heal, Shield, Stun, Freeze, Burn, Poison, Cleanse, KO, Revive.
- Swap Pow active ↔ reserve để kiểm tra giao diện thay thế giữa trận.
- Có source→target tracer, hit reaction, hitstop, damage/heal/shield number và status overlay.

## Lãnh Địa trong Admin
Manual Arena có preview riêng cho:
- 3 Giản Dị: Xích Viêm Sát Giới, Huyền Thủy Trấn Giới, Thanh Mộc Huyết Giới.
- Đúng 9 Bành Trướng của 18.8.0.

Kích hoạt Giản Dị sẽ tắt Bành Trướng và ngược lại để phản ánh luật không coexist.

**Lưu ý:** Vô Lượng Không Xứ, Tọa Sát Bát Đồ và Rút Kiếm Ra trong Manual Arena chỉ là preview FX để kiểm tra hình ảnh/feedback. Cơ chế PvP Online thật vẫn dùng server verification / server RNG như 18.8.0–18.8.1; Admin Lab không thay thế authority đó.

## Safety boundary
Manual FX Arena:
- chỉ giữ state trong RAM của trang Admin;
- không ghi Cloud Save;
- không tạo reward;
- không gửi PvP action;
- không gọi Supabase/Edge Function;
- không sửa state trận production.

Các con số damage/heal trong Lab là **visual simulation để kiểm tra FX**, không phải nguồn balance-authoritative.

## Compatibility
16 file gameplay Combat/PvP/Boss/Lãnh Địa trọng yếu được xác minh byte-for-byte giống 18.8.1. 18.8.2 chỉ thêm công cụ Admin + version/cache wiring, không thay gameplay production.
