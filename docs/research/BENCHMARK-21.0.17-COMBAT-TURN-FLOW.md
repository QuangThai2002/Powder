# Powder 21.0.17 — Combat Turn Flow & Action Readability 2.0

## Mục tiêu benchmark
Nâng độ rõ của từng lượt chiến đấu mà không chạm battle simulation, damage formula, AI, mana, turn timing hay gameplay state.

## 1. Pokémon Showdown Client
Nguồn: https://github.com/smogon/pokemon-showdown-client

Điểm tham khảo:
- Battle client tách phần battle presentation/animation khỏi simulation/server state.
- Move animation được tổ chức thành lớp trình bày riêng, phù hợp với hướng Powder đọc state hiện có thay vì tính lại mechanics.

Áp dụng vào Powder:
- 21.0.17 không sửa Combat Core hoặc `player-combat-scene-v1862.js`.
- Turn Flow HUD chỉ đọc current unit, attack callout, telegraph target, turn order và impact event đã có.

## 2. Phaser 3
Nguồn: https://docs.phaser.io/api-documentation/3.90.0/class/plugins-sceneplugin
Nguồn bổ sung: https://docs.phaser.io/api-documentation/3.88.2/event/animations-events

Điểm tham khảo:
- Scene lifecycle có các event start/ready/update/pause/resume/transition/shutdown rõ ràng.
- Animation có start/update/complete/stop events thay vì buộc presentation phải tự polling liên tục.

Áp dụng vào Powder:
- 21.0.17 chạy theo event `powder:combat-presentation-sync` và `powder:combat-impact-feedback`.
- Result state chỉ giữ bằng timer one-shot rồi kết thúc, không tạo game loop mới.

## 3. PixiJS 8
Nguồn: https://pixijs.com/8.x/guides/concepts/render-loop
Nguồn bổ sung: https://pixijs.com/8.x/guides/components/ticker

Điểm tham khảo:
- Render loop có chi phí rõ ràng: ticker callbacks → scene graph update → render.
- Ticker listener phải được quản lý có chủ đích; thêm callback mỗi frame làm tăng công việc CPU/GPU.

Áp dụng vào Powder:
- Không thêm MutationObserver mới.
- Không thêm ticker/requestAnimationFrame loop liên tục.
- Chỉ dùng một RAF để coalesce event-driven sync.
- Pressure `hot/critical` chỉ giảm paint phụ, không bỏ actor/target/result/next-turn information.

## Kết luận thiết kế
Powder 21.0.17 dùng kiến trúc presentation-only:
1. Current actor được lấy từ `.cv7-unit.current` / attack callout.
2. Ability được lấy từ `.cv7-attack-callout`.
3. Target được lấy từ telegraph/locked target và impact target.
4. Result được lấy từ impact event + visible FX của đúng target.
5. Next actor được lấy từ turn-order hiện hữu.
6. Chỉ gắn `data-tf217-*` để làm nổi bật actor/target/now/next; không thay gameplay class.
