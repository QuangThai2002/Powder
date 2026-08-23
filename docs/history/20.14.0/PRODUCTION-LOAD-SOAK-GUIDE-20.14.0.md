# Powder 20.14.0 — Production Load & Soak Testing Guide

## Mục tiêu
20.14.0 bổ sung bộ kiểm thử tải production fail-closed mà không thay đổi gameplay. Bằng chứng hợp lệ phải được tạo từ deployment thật; artifact không chứa và không giả lập kết quả tải production.

## Ba profile bắt buộc
- **load**: tối thiểu 15 phút, 10.000 request, peak 100 VU.
- **soak**: tối thiểu 4 giờ, 50.000 request, peak 50 VU.
- **overload**: tối thiểu 5 phút, 5.000 request, peak 150 VU; phải chứng minh Reliability auto-degrade và phục hồi về `normal/closed` trong tối đa 600 giây.

## Luồng được tạo tải
Runner đọc đồng thời 5 luồng người chơi: login, Cloud Save load, Economy state, PvP state và Learning Event state. Tải ghi dùng bảng sandbox riêng `load_soak_sandbox_v20140`; không ghi Coin, item, Inventory, Mail reward hoặc Cloud Save người chơi.

## Ngưỡng mặc định
Load/soak yêu cầu error rate <= 1%, P95 <= 1500 ms, P99 <= 2500 ms và DB connection utilization <= 80%. Memory growth tối đa là 15% cho load và 8% cho soak. Mỗi luồng người chơi phải có tối thiểu 100 request.

## Data integrity
Evidence tự HOLD nếu có transaction duplicate, unexplained delta, orphan effect hoặc unresolved save conflict. Server tự tính `calculated_pass`; runner/Admin không thể gửi trường `pass` để ép kết quả.

## Chạy runner
Cần các biến môi trường `POWDER_ANON_KEY`, `POWDER_ACCESS_TOKENS` (ít nhất 5 tài khoản test) và `POWDER_LOAD_EVIDENCE_TOKEN`.

```bash
node tools/powder-load-soak-runner-v20140.mjs self-test
node tools/powder-load-soak-runner-v20140.mjs load --submit
node tools/powder-load-soak-runner-v20140.mjs soak --submit
POWDER_ALLOW_RELIABILITY_DRILL=1 node tools/powder-load-soak-runner-v20140.mjs overload --submit
```

Không chạy overload trên production thật nếu chưa có change window/rollback và Owner phê duyệt.

## Production Gate
Admin chỉ có thể ARM/DISARM gate. Official Launch 5% bị HOLD cho đến khi cả ba evidence còn hạn, Observability healthy, Reliability `normal/closed`, Reconciliation sạch và các gate trước đó đều PASS.
