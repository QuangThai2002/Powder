# Powder 21.0.18 — Combat Skill Identity & Ultimate Presentation 2.0

## Mục tiêu
Tăng khả năng phân biệt trực quan giữa Basic / Skill 1 / Skill 2 / Exclusive / Ultimate mà không thay damage, mana, rage, AI, turn timing, target rules, battle state hay Combat Core.

## Benchmark 1 — Pokémon Showdown Client
Nguồn tham khảo: `smogon/pokemon-showdown-client`, đặc biệt `battle-animations-moves.ts` và battle protocol.

Điểm áp dụng:
- Battle simulation và presentation animation tách rời.
- Move/target là tín hiệu đầu vào cho presentation; client có thể chọn animation tương ứng mà không đổi kết quả battle.
- Mỗi move có identity riêng thay vì dùng một animation chung cho mọi action.

Áp dụng cho Powder:
- Không sửa `player-combat-scene-v1862.js` hay Combat Core.
- Đọc skill tier từ presentation DOM/event hiện hữu rồi gắn identity ở lớp 21.0.18.
- Skill identity chỉ ảnh hưởng visual state và diagnostics.

## Benchmark 2 — Phaser 3
Nguồn tham khảo: `phaserjs/phaser` Tween/Timeline architecture.

Điểm áp dụng:
- Sequencing nên dùng lifecycle/event/chained beats thay vì tạo polling loop mới.
- Phaser đã chuyển away khỏi tween timeline cũ từng gây timing bugs, ưu tiên chain/timeline hệ thống rõ lifecycle.

Áp dụng cho Powder:
- Không thêm `setInterval`, ticker hay MutationObserver mới.
- Dùng event `powder:combat-presentation-sync`, `powder:combat-impact-feedback`, `powder:combat-turn-flow` và tối đa một RAF coalescing.
- Ultimate build-up/release/impact chỉ là phase presentation bám theo action thật.

## Benchmark 3 — PixiJS
Nguồn tham khảo: `pixijs/pixijs`, AnimatedSprite / Ticker patterns.

Điểm áp dụng:
- Animation cần có ownership rõ, hạn chế callback/frame work khi không cần.
- Visual state nên được driven bởi lifecycle và cleaned up khi scene/action kết thúc.

Áp dụng cho Powder:
- Chỉ có một stage overlay được tái sử dụng trên active combat mount.
- Không giữ texture/image object mới.
- Pressure hot/critical cắt secondary paint nhưng giữ actor/skill/tier readable.
- Reduced motion tắt animation nhưng không ẩn thông tin.

## Quyết định kiến trúc
21.0.18 tạo lớp presentation-only mới:
- `js/combat-skill-identity-v21018.js`
- `css/combat-skill-identity-v21018.css`

Nguồn phân loại skill:
1. `.cv7-attack-flow.basic|skill1|skill2|exclusive|ultimate` khi release.
2. `.cv7-attack-callout.ultimate|exclusive` ngay từ charge.
3. Player command input cache từ `[data-cv7-skill]` để giữ đúng Basic/Skill 1/Skill 2 trong charge trước release.

Tier rank:
- Basic = 1
- Skill 1 = 2
- Skill 2 = 3
- Exclusive = 4
- Ultimate = 5

Không thêm framework hoặc dependency từ ba dự án tham khảo.