# Powder 21.0.11 — Adaptive Runtime Pressure Governor

## Mục tiêu
Chuyển từ tối ưu phản ứng sau khi FPS đã tụt sang cơ chế phát hiện áp lực sớm từ nhiều tín hiệu, đồng thời bảo vệ Combat/Boss/Summon khỏi việc cắt giảm hiệu ứng quan trọng.

## Tham chiếu

### Three.js
- Tài liệu chính thức khuyến nghị quản lý vòng đời tài nguyên rõ ràng và giải phóng texture/geometry/material khi không còn dùng.
- `renderer.info` được dùng như tín hiệu chẩn đoán tài nguyên thay vì chỉ nhìn FPS.
- Rendering-on-demand tránh tiếp tục làm việc không cần thiết khi nội dung không thay đổi.

Áp dụng cho Powder: theo dõi nhiều tín hiệu runtime, dọn tài nguyên ẩn theo pressure và tạm dừng animation trang trí lặp vô hạn khi thiết bị chịu tải.

### PixiJS 8
- Có Texture GC với chính sách idle/check interval thay vì giữ mọi texture mãi mãi.
- Khuyến nghị culling nội dung ngoài màn hình và quản lý texture chủ động khi scene lớn.
- Render loop/ticker là tài nguyên cần kiểm soát, không phải mọi công việc đều cần chạy ở cùng mức ưu tiên.

Áp dụng cho Powder: hidden image được hạ fetch priority/evict sớm hơn khi `hot/critical`; active scene vẫn được ưu tiên.

### Phaser 3
- `TimeStep` dùng requestAnimationFrame và xử lý visibility/pause/resume như một phần lifecycle chính thức.
- Khi browser ngủ/ẩn rồi quay lại, engine reset timing thay vì giả định frame loop liên tục.

Áp dụng cho Powder: governor dừng sampling khi document ẩn, đánh giá lại ngay khi quay lại và đổi nhịp sample theo Battle/Boss so với view thường.

## Thiết kế Powder
- 4 mức: `calm`, `warm`, `hot`, `critical`.
- Tín hiệu: FPS, JS heap ratio (khi trình duyệt hỗ trợ), Long Task 12 giây, DOM node count, DOM pending work, image decode queue và cấu hình thiết bị.
- Hysteresis tránh nhảy trạng thái liên tục.
- `warm`: chỉ eviction nhẹ tài nguyên ẩn.
- `hot`: hạ priority ảnh ẩn, eviction mạnh hơn, lifecycle sweep và pause animation trang trí lặp vô hạn.
- `critical`: cleanup + sweep + eviction sâu hơn.
- Battle/Boss/Combat/Summon và phần tử `data-pressure-keep="1"` không bị governor pause animation.
- Khi trở lại `calm`, animation do governor pause được resume theo lô nhỏ để tránh tạo spike mới.
- Không sửa damage, skill, economy, learning, PvP hay save.

## Chẩn đoán
`POWDER_ADAPTIVE_PRESSURE_V21011.snapshot()` trả về pressure level/score và nguyên nhân quan sát được. Chế độ `?diagnostics=1` bổ sung pressure, image runtime, DOM runtime và lifecycle runtime vào JSON export nhưng không chứa token/password/save payload.
