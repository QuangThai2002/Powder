# Powder 20.12.0 — Reconciliation & Crash Recovery

## Mới

- Resource Effect Ledger 20.12 cho canonical mutation.
- Reconciliation runs, cases, repair audit và crash drill.
- Phát hiện orphan, duplicate/hash mismatch, recovery case và unexplained delta.
- Admin Reconciliation & Crash Recovery console.
- Repair workflow propose → approve → apply với evidence hash và Before/After audit.
- Official Launch hard gate `reconciliationClean`.
- Mutation Gateway truyền reconciliation version + canonical request SHA-256 cho business handler.

## Safety

- Không tự replay resource sau crash.
- Không tự cộng/trừ Coin, item, Inventory, Mail reward hoặc Event reward để “sửa số liệu”.
- Mutation thành công nhưng thiếu effect evidence bị xem là unexplained và giữ production ở HOLD.
- Artifact vẫn `official=false`.

## Không thay đổi

- Combat/PvE/PvP/Boss logic.
- Pow/skill/balance.
- 22 gameplay critical files theo freeze baseline.

## Production note

Source authoritative của bốn Edge Function legacy không nằm trong artifact, nên 20.12 không giả lập production reconciliation. Production READY chỉ đạt khi deployment thật cung cấp canonical adapter evidence + Resource Effect Ledger và scan/drill sạch.
