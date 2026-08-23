# Powder 19.4.0 — Live Launch Verification & Recovery Hardening

## Mục tiêu
Không thêm gameplay Combat. Bổ sung bằng chứng recovery/launch trước khi mở Official.

## Mới
- Recovery Mode `index.html?recovery=1`.
- Phát hiện phiên đóng bất thường bằng heartbeat/clean-exit marker.
- Safe checkpoint: Offline tạo full backup; Online không cho local backup ghi đè server.
- Recovery Drill không phá dữ liệu: serialize/parse, localStorage round-trip, SHA-256, shape/save health, backup-slot verification.
- Authenticated PvP state smoke probe 1–6 mẫu, dùng Edge hiện tại và tuân thủ rate limit.
- Admin Launch Verification Console: import recovery evidence nhiều máy, production reliability snapshot read-only, rollback confirmation dựa trên evidence.
- Release Seal 19.4.0 fail-closed theo manifest hash và 10/10 field gate.

## Không thay đổi
Combat Core, 99 Pow, PvP balance, Boss, 9 Bành Trướng, Server Combat và reward authority không đổi.
