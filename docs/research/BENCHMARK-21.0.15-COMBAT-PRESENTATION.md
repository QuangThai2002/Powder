# Powder 21.0.15 — Combat Presentation 3.0 benchmark

## Mục tiêu
Nâng khả năng đọc trận đấu trên web mà không sửa combat formula/gameplay freeze: nhìn rõ ai đánh ai, mục tiêu nhận gì, HP/Mana/CC và số damage/heal/shield; giữ 60 FPS bằng one-shot/compositor-friendly effects.

## 1. Pokémon Showdown Client
Repository: https://github.com/smogon/pokemon-showdown-client
Battle animations: https://github.com/smogon/pokemon-showdown-client/blob/master/play.pokemonshowdown.com/src/battle-animations-moves.ts

Điểm tham khảo:
- Battle scene/animation là lớp client riêng, tách khỏi battle simulation.
- Move presentation có timeline/scene riêng thay vì nhúng logic cân bằng vào UI.
- Battle log là lớp thông tin riêng, giúp animation không phải gánh toàn bộ ngữ nghĩa trận đấu.

Áp dụng vào Powder:
- Không sửa 22 gameplay-freeze files.
- Dùng lớp `combat-presentation-v21015` chỉ đọc DOM/tín hiệu từ Combat V7.
- Source→target trace, hit ring, number lane và CC emphasis chỉ là presentation.

## 2. Phaser Examples / Phaser camera effects
Repository: https://github.com/phaserjs/examples
Framework: https://github.com/phaserjs/phaser

Điểm tham khảo:
- Shake/flash/tween là hiệu ứng có thời lượng, không phải loop nền vĩnh viễn.
- Camera/impact feedback là presentation concern; game state không cần đổi theo hiệu ứng.
- Ưu tiên các hiệu ứng ngắn và có easing để người chơi hiểu impact mà không kéo dài frame cost.

Áp dụng vào Powder:
- Giữ hit-stop/camera hiện tại, chỉ làm attack trace/hit target rõ hơn.
- Custom impact ring là one-shot và tự tắt ở pressure-reduced tier.
- Không thêm particle loop hoặc blur/filter nặng.

## 3. PixiJS 8
Repository: https://github.com/pixijs/pixijs

Điểm tham khảo:
- Ticker/render updates phải có kiểm soát và frame-aware.
- Tránh tạo vòng cập nhật riêng nếu nội dung chỉ thay đổi theo event.
- Motion nên ưu tiên transform/opacity và tránh công việc layout lặp lại không cần thiết.

Áp dụng vào Powder:
- Presentation runtime không có animation loop riêng.
- Mutation được gom lại thành tối đa một sync trong `requestAnimationFrame`.
- Runtime chỉ đổi data attributes/CSS custom properties; audit geometry chỉ chạy khi QA gọi `audit()`.

## Quyết định kiến trúc 21.0.15
1. Giữ nguyên toàn bộ 22 file gameplay freeze, đặc biệt `player-combat-scene-v1862.js`.
2. Thêm một JS presentation runtime + một CSS stylesheet integrity-bound.
3. Floating numbers được xếp lane theo side/slot để giảm đè số khi multi-hit/AoE.
4. Attack flow hiện có được tăng contrast, có target impact ring one-shot.
5. HP/Mana/critical/CC được ưu tiên thị giác hơn decoration.
6. Pressure Governor `hot/critical` bỏ hit ring/glow/element decoration nhưng không ẩn damage/heal/shield/CC.
7. Thêm real-Chrome Combat Presentation gate và kiểm tra gameplay freeze không đổi.
