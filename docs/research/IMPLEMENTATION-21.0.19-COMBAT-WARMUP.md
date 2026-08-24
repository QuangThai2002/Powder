# Powder 21.0.19 — Combat Warmup & Zero-Stutter Entry

## Runtime
`js/combat-warmup-v21019.js`

## Luồng
1. Khi `powder:view-changed` vào `adventure` hoặc `boss`, warmup được đưa qua scheduler 21.0.12 ở priority thấp.
2. Idle plan warm arena, Pow đội hình và skill art của Pow đầu tiên theo budget pressure.
3. Runtime wrap `window.POWDER_COMBAT_ENTRY_V177` sau khi file frozen đã load.
4. `startMap/startBoss/startEvent` gọi `prime(stage, source)` trước rồi forward ngay sang API gốc, giữ boolean return và timing gameplay hiện hữu.
5. Stage plan đọc `stage.enemyIds`, nên không quét toàn roster.
6. Private preload trong `player-combat-scene-v1862.js` vẫn tồn tại như fallback canonical; 21.0.19 chỉ đưa critical work lên sớm hơn.

## Asset plan
- Arena: `bg-battle-legend-cloud-arena.webp` + `celestial-battlefield-theme-combat.webp`.
- Team: combat asset của Pow từ save team, tối đa 5.
- Enemy: combat asset từ `stage.enemyIds`, tối đa 3.
- Skill: `POWDER_SKILL_ART` của Pow đầu tiên, tối đa 5 ở calm.
- Mapping combat giữ cùng quy tắc `POWDER_COMBAT_ASSETS` / `pow-beta12 → pow-combat-512` như Combat Scene.

## Hiệu năng
- Queue duy nhất; không queue theo từng subsystem.
- Concurrency: calm 3, warm 2, hot 1, critical 0.
- URL pending được dedupe.
- Asset decode gần đây được nhớ bằng metadata thời gian có giới hạn; không giữ DOM/Image/texture.
- `Image` reference được bỏ sau load/decode/error/timeout.
- Không `setInterval`, không frame loop, không MutationObserver.
- Scene scheduler 21.0.12 nhận prefetch hint `sticky` để request đang warm không bị hủy chỉ vì view chuyển từ Adventure sang Battle.

## Cancellation
Mỗi `prime()` tăng generation. Các queued item của plan cũ được resolve false và bỏ. In-flight image đã bắt đầu được phép kết thúc để browser cache không lãng phí request đang chạy, nhưng không tạo thêm queue cũ.

## Pressure
- calm: <=15
- warm: <=12
- hot: <=6
- critical: 0

## Diagnostics
`snapshot()` chỉ xuất count, duration, pressure và history tóm tắt tối đa 16 lần. Không chứa save payload, account, question text hoặc token.

## Gameplay freeze
Không sửa bất kỳ file nào trong `RELEASE-FREEZE-BASELINE-19.9.0.json`. Đặc biệt:
- `js/player-combat-scene-v1862.js` giữ byte-identical.
- `js/combat-entry-v177.js` giữ byte-identical.
- damage / mana / AI / target / turn / Boss / Domain / PvP không đổi.
