# Powder 20.18.0 — Full Game Regression RC1 Audit

## Kết luận artifact
Automated RC1 regression PASS. Không có thay đổi vào 22 file combat/gameplay critical đã freeze.

## Coverage đã xác nhận
- 99 Pow / 99 role mapping.
- 99 skill kit / 396 unique skill.
- 7 Tamer rank.
- 13 equipment set / 52 equipment.
- 49 artifact, phân bố 7 × 7 rarity.
- 73 lesson / 10.707 active question.
- Không duplicate question ID; mọi answer thuộc options; Hard/Deep không thiếu pool.
- 12 Adventure island.
- Gacha, Economy, Mail, Event, PvE, PvP, Boss, Rank, Cloud Save, Admin và Performance đều có subsystem entrypoint/guard được regression kiểm tra.

## Fix được phát hiện trong RC1
### Starter role mapping
Ba starter evolution `starter_fire_flarion`, `starter_water_aquelion`, `starter_leaf_sylvion` thiếu mapping nghề trong World data. Đã bổ sung lần lượt `marksman`, `mage`, `healer`.

### Learning prompt repetition
Một mẫu prompt generic bị lặp hàng trăm lần. Đã đổi sang prompt có tên bài và term hiện tại. Dữ liệu câu hỏi/answer không bị xóa hay giảm pool.

## Fail-closed release evidence
Migration 20.18 tạo evidence contract cho automated + manual smoke. Server chỉ tính run PASS nếu toàn bộ key bắt buộc true và Critical/High = 0. Evidence sai build, sai manifest, quá hạn hoặc chưa ARM đều HOLD.

## Giới hạn audit
Automated PASS không thay thế test UI/browser thật trên deployment. Artifact không có production credential nên manual smoke, live latency và production service health không được giả lập thành PASS.
