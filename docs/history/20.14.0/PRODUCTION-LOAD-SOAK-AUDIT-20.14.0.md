# Powder 20.14.0 — Production Load & Soak Audit

## Phạm vi đã hoàn thành trong artifact
- Migration load/soak evidence + server-side validator.
- DB connection utilization metrics.
- Edge runtime memory metrics.
- Sandbox atomic write stress không chạm tài nguyên người chơi.
- External runner 6 scenario.
- Overload Watchdog drill có explicit opt-in.
- Admin posture/evidence UI, không có self-PASS.
- Official Launch hard gate `productionLoadSoak`.
- Passive player runtime; không tạo network load từ client thật.

## QA artifact
Final Gate, static architecture gate và runner self-test PASS. 22 gameplay critical files không thay đổi.

## Điều chưa được tuyên bố PASS
Không có deployment Supabase production và test account/token thật trong artifact, vì vậy **không có bằng chứng load 15 phút, soak 4 giờ hay overload/recovery production thật**. Gate mặc định `enabled=false` và Official Production phải HOLD cho đến khi evidence thật được ingest và server tự tính PASS.

## Nguyên tắc an toàn
Load test không được ghi Coin/item/reward/save. Overload drill yêu cầu `POWDER_ALLOW_RELIABILITY_DRILL=1`. Mọi evidence gắn SHA-256, runner revision, scenario hash và metrics source revision.
