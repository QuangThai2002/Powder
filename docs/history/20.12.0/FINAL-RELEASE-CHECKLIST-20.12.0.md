# Powder 20.12.0 — Final Release Checklist

## Build / boot

- [x] `release.json` = 20.12.0 và `official=false`.
- [x] Service Worker/cache version = 20.12.0.
- [x] Boot manifest/hash được tái tạo từ file player thực tế.
- [x] Boot order giữ Reliability → Transaction Safety → Canonical Mutation → Online Foundation.
- [x] Không thiếu local resource và không có duplicate HTML id.

## Gameplay freeze

- [x] 22/22 gameplay critical files giữ nguyên theo baseline.
- [x] Không thay đổi combat/Pow/skill/balance.

## Reconciliation / recovery

- [x] Resource Effect Ledger schema và RPC có sẵn.
- [x] Reconciliation scan/posture/case workflow có sẵn.
- [x] Orphan/duplicate/hash mismatch/unexplained delta được hard-fail phù hợp.
- [x] Recovery queue là tín hiệu HOLD.
- [x] Repair bắt buộc propose → approve → apply.
- [x] Repair lưu audit Before/After và evidence hash.
- [x] Không có blind replay hoặc direct resource adjustment.
- [x] Crash drill được hỗ trợ và đưa vào freshness gate.

## Regression

- [x] Transaction Safety regression PASS.
- [x] Transaction runtime behavior PASS.
- [x] Canonical Adapter gate/runtime PASS.
- [x] Reconciliation gate/runtime PASS.
- [x] Legacy server core modules không drift.

## Production HOLD — có chủ đích

- [ ] 18/18 canonical adapter evidence từ deployment thật.
- [ ] Production handlers thật ghi Resource Effect Ledger cho successful mutation.
- [ ] Reconciliation production scan sạch.
- [ ] Recovery queue production = 0.
- [ ] Crash drill production còn hiệu lực và PASS.

Không đánh dấu `official=true` trước khi toàn bộ mục Production HOLD phía trên hoàn thành.
