# Powder 19.6.0 — Production Load & Integrity Gate

## Mục tiêu
19.6.0 không thêm gameplay Combat. Bản này biến mục Server Load/Concurrency thành evidence gate và kiểm tra integrity production trước Release Freeze.

## Mới
- `powder-admin-integrity` Edge Function 19.6.0, JWT bắt buộc.
- `powder_integrity_snapshot_v1960()` read-only: orphan/stale/save/constraint/RPC authority.
- Bounded Admin probe: tối đa 6 concurrent / 60 request, đo client P50/P95/P99 và DB P95.
- External Load Gate: cần cả `pvp_state` + `cloud_load`, >=200 request/mode, concurrency >=10, >=5 access session, error <=1%, P95 <=1500ms, P99 <=2500ms.
- CLI `tools/powder-load-gate-v1960.mjs`; report không chứa access token.
- CAS conflict sandbox: hai writer cùng expected revision, đúng một writer thắng và writer còn lại nhận conflict.
- 19.6 Release Seal yêu cầu Integrity Snapshot server PASS ngoài các gate cũ.

## Không đổi
- Combat/PvP/Boss/Domain gameplay frozen.
- Không tự chạy destructive/high-volume load lên production.
- Không đụng Cloud Save thật trong CAS probe.
- `official=false`; load evidence thật vẫn phải được thu trước khi seal.
