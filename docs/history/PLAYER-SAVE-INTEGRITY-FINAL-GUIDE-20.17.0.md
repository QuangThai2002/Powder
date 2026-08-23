# Powder 20.17.0 — Player Save Integrity Final Guide

## Mục tiêu
20.17 khóa đường Cloud Save trước Release Candidate: save cũ phải migrate an toàn, multi-device/conflict không được làm revision đi lùi, và các nhánh Pow/learning/equipment/artifact không được biến mất do serialization lỗi.

## Cơ chế chính
- `player_saves` nhận integrity SHA-256 + summary server-side.
- Mỗi revision tạo snapshot lịch sử trong `save_integrity_snapshots_v20170`.
- Trigger chặn revision regression, schema/saveVersion downgrade và các wipe/loss rõ ràng của dữ liệu trọng yếu.
- Same-revision hash drift hoặc stale-device commit tạo incident thay vì âm thầm ghi đè.
- Player runtime thêm integrity envelope và kiểm import trước `applyCloudBundle`.
- Giảm số lượng equipment/artifact hợp lệ vẫn được phép; 20.17 không dùng “count chỉ được tăng” làm luật.
- Read-only/reliability của 20.8 tiếp tục giữ `pendingSync`; 20.17 không tạo đường ghi bypass.

## Admin / Production
Trong Admin → Player Save Integrity:
1. Chạy authoritative scan.
2. Xem malformed save, missing snapshot, revision anomaly và incident.
3. Resolve incident chỉ sau khi có nguyên nhân/evidence rõ ràng.
4. Owner + AAL2 mới được ARM/DISARM gate.

`playerSaveIntegrityFinal` chỉ READY khi gate đã ARM, scan còn mới và Critical/High/malformed/missing snapshot/revision anomaly đều bằng 0.

## Deploy production
1. Apply migration `20260823_20170_player_save_integrity_final.sql`.
2. Redeploy `powder-admin-integrity` và `powder-admin-official-launch`.
3. Mở game bằng build 20.17 và xác nhận runtime `POWDER_SAVE_INTEGRITY_V20170` đã boot.
4. Chạy scan authoritative bằng Admin phiên AAL2.
5. Chỉ ARM khi scan sạch.
6. Production Launch vẫn phải vượt toàn bộ gate 20.7–20.16 trước khi canary.

## Fail-closed
Nếu migration/RPC scan chưa tồn tại, scan quá hạn, còn incident Critical/High hoặc save thiếu snapshot hiện hành, Official Launch phải HOLD. Không được tạo evidence giả hoặc repair tự động dữ liệu player.
