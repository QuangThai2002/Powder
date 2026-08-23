# Canonical Mutation Adapters Guide — 20.11.0

## Luồng ghi chuẩn
Player → Transaction Safety 20.9 → Canonical Mutation Client 20.11 → `powder-mutation-gateway` → Adapter Route → canonical SQL handler hoặc server-to-server compatibility bridge.

Player không được fallback trực tiếp sang legacy write endpoint.

## 18 canonical actions
- Economy: `buy_candy`, `consume_candy`, `feed_candy`, `open_powball`, `upgrade_pow`, `daily_boss_entry`
- Reward: `claim_daily`, `claim_daily_login`
- Inventory: `equipment_equip`, `equipment_unequip`, `artifact_equip`, `artifact_unequip`, `item_lock`
- Mail: `claim_mail`
- Event: `claim_mission`, `claim_completion`, `finish_combat`
- Purchase: `event_buy`

## Quy tắc retry
- Transaction đã có kết quả chắc chắn: receipt có thể replay kết quả cũ.
- HTTP target từ chối rõ ràng: dispatch ghi `failed`.
- Timeout/network không xác định target đã commit hay chưa: dispatch ghi `unknown` và trả 409.
- `unknown` không được tự retry/replay; phải reconciliation.

## Điều kiện xác minh một adapter
Cả ba kiểm tra phải PASS trên server deployment thật:
1. `txKey` idempotency.
2. Business mutation atomicity.
3. Direct legacy write endpoint đã bị khóa/bắt buộc đi qua gateway.

Evidence phải có SHA-256, target revision, checked timestamp hợp lệ. Admin chỉ import evidence; không có thao tác tự set PASS.

## Official Production
20.11 QA có thể PASS toàn bộ static/runtime gate khi kiến trúc đúng. Tuy nhiên Official Production chỉ READY khi đủ 18/18 adapter verified + fresh và không còn dispatch unknown/stale/failed cần xử lý.
