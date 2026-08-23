# Powder 20.12.0 — Reconciliation & Crash Recovery Audit

## Phạm vi audit

Audit tập trung vào transaction evidence, crash recovery, repair safety và Production Launch gating. Gameplay/combat nằm ngoài phạm vi thay đổi và được kiểm bằng gameplay freeze baseline.

## Kết quả kiến trúc

- Reconciliation schema/migration 20.12: PASS.
- Resource Effect Ledger contract: PASS.
- Transaction Receipt ↔ Canonical Dispatch ↔ Effect evidence correlation: PASS.
- Evidence/request/result hash validation: PASS.
- Detection cho orphan/duplicate/hash mismatch/unexplained delta: PASS.
- Recovery queue được đưa vào posture: PASS.
- Repair workflow propose → approve → apply: PASS.
- Repair audit Before/After: PASS.
- Không có đường blind resource replay: PASS.
- Admin `resource_adjustment` bị từ chối: PASS.
- Crash drill contract: PASS.
- Official Launch hard gate `reconciliationClean`: PASS.
- Canonical Adapter 20.11 regression: PASS.

## Fail-closed production posture

20.12 xem mutation thành công nhưng thiếu Resource Effect Ledger là `unexplained_delta`, không giả định rằng tài nguyên đã đúng. Production Launch phải HOLD khi posture chưa sạch, scan/drill quá hạn hoặc còn case chưa xử lý.

## Resource safety

Code repair 20.12 không cập nhật trực tiếp Coin, item, Inventory, Mail reward hoặc Event reward. Điều này là chủ đích: artifact không sở hữu các business tables authoritative cần thiết để chứng minh một giá trị bù tài nguyên là đúng.

## Server-source honesty

Source production của `powder-economy`, `powder-inventory`, `powder-liveops`, `powder-learning-events` không có trong artifact. Vì thế audit chỉ xác nhận contract/gateway/reconciliation control-plane có sẵn; **không tuyên bố sai rằng số dư production thật đã được reconciled end-to-end**.

## Điều kiện để bỏ HOLD

Production cần evidence thật từ deployment:

1. Canonical adapters đáp ứng idempotency + atomicity + direct legacy write blocked.
2. Mỗi successful mutation cần effect evidence phù hợp với `txKey` và hash.
3. Reconciliation scan sạch, không orphan/hash mismatch/unexplained delta/recovery mở.
4. Crash drill production PASS trong cửa sổ freshness.
5. Các gate Reliability, Transaction Safety và Launch Control trước đó tiếp tục PASS.
