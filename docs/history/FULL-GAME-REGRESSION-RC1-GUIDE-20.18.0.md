# Powder 20.18.0 — Full Game Regression RC1 Guide

## Mục tiêu
20.18.0 là Release Candidate 1 để quét toàn bộ game trước canary. Bản này không mở thêm gameplay mới; chỉ sửa lỗi regression và khóa bằng chứng phát hành.

## Phạm vi automated regression
- PowDex: 99 Pow, ID không trùng.
- Skill: 99 kit / 396 skill unique.
- Rank: 7 bậc Tamer.
- Role: 99/99 Pow có mapping nghề.
- Equipment: 13 set / 52 món, asset đầy đủ.
- Artifact: 49 cổ vật, 7 món cho mỗi rarity.
- Learning: 73 bài, 10.707 câu active, ID không trùng, đáp án hợp lệ, Hard/Deep đủ pool.
- Adventure: 12 đảo, stage contract hợp lệ.
- Gacha: rate guard/entrypoint tồn tại.
- Navigation và subsystem entrypoint.
- Combat freeze: 22/22 file critical không thay đổi.
- Runtime diagnostic của RC1.

## Hai lỗi được sửa trong RC1
1. Bổ sung role mapping cho ba starter evolution mới: Flarion → Xạ thủ, Aquelion → Pháp sư, Sylvion → Trị liệu. Trước đó Pow data có role nhưng World/Equipment mapping thiếu.
2. Thay prompt Learning lặp cứng “Cặp nào thể hiện đúng kiến thức của bài?” bằng prompt có context bài học/term, giảm cảm giác lặp vô nghĩa trong bank câu hỏi.

## Manual smoke bắt buộc trước Production
Evidence phải thuộc đúng build `powder-20.18.0-full-game-regression-rc1` và manifest hiện tại. Server tự tính PASS; Admin không có nút tự tick.

Các smoke bắt buộc:
1. Home & Navigation
2. Learning Flow
3. PowDex & Inventory
4. Gacha Flow
5. Equipment & Artifact Flow
6. PvE Flow
7. PvP Flow
8. Boss Flow
9. Event & Mail Reward
10. Rank Promotion
11. Cloud Save Conflict
12. Admin Smoke
13. FPS Smoke

## Quy tắc phát hành
Production hard gate `fullGameRegressionRC1` chỉ READY khi:
- automated regression PASS;
- manual smoke PASS;
- Critical = 0;
- High = 0;
- evidence còn mới và khớp build/manifest;
- release authorization đang ARM.

`official=false` được giữ cho tới khi các điều kiện production thật hoàn tất.
