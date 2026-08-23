# Powder 20.10.0 — Server Mutation Integration Guide

## Mục tiêu
20.10.0 thêm một cổng mutation thống nhất cho Economy, Inventory, Reward, Mail và Event. Cổng này dùng transaction receipt 20.9 nhưng chuyển việc thực thi business mutation vào **một PostgreSQL transaction nguyên tử**: canonical handler + effect receipt + transaction receipt cùng commit hoặc cùng rollback.

## Luồng chuẩn
1. Client Transaction Safety 20.9 tạo/giữ `txKey`.
2. Server Mutation Runtime 20.10 gửi `{scope, action, txKey, payload}` tới `powder-mutation-gateway`.
3. Gateway xác thực user bằng JWT và gọi `powder_mutation_execute_v20100` bằng service role.
4. SQL kiểm contract, Reliability write guard, request hash và advisory lock.
5. Canonical handler có chữ ký `(uuid, jsonb) -> jsonb` chạy trong nested subtransaction.
6. Nếu thành công, effect receipt và transaction receipt commit cùng mutation tài nguyên.
7. Nếu handler lỗi, mutation tài nguyên trong handler rollback và receipt được đánh `failed`.

## Fail-closed quan trọng
18 contract business bắt buộc được seed `enabled=false`. Project hiện không chứa source canonical production của `powder-economy`, `powder-inventory`, `powder-liveops`, `powder-learning-events`, vì vậy 20.10 **không tạo handler giả** để đánh dấu READY.

Ở `prefer` mode, client chỉ fallback sang endpoint legacy khi server trả đúng lỗi `CONTRACT_NOT_READY/HANDLER_MISSING/404`. Timeout hoặc lỗi mạng mơ hồ tuyệt đối không fallback, tránh mutation được thực thi hai lần qua hai đường khác nhau.

## Điều kiện bật một contract
Chỉ bật sau khi có function thật với chữ ký `(p_user uuid, p_payload jsonb) returns jsonb`, mutation tài nguyên nằm trong cùng database transaction, và output là kết quả canonical cho client. Không bật contract nếu handler gọi một hệ thống ngoài không có cơ chế idempotency tương đương.

## Reconciliation
`powder_mutation_reconcile_v20100` không phát lại reward/purchase. Với transaction do atomic gateway tạo:
- Có effect receipt => chứng minh đã commit.
- Không có effect receipt và receipt chưa committed => chứng minh không commit; safe retry phải dùng lại cùng `txKey`.
- Receipt legacy 20.9 => giữ manual, không đoán trạng thái.

## Chaos drill
Owner chạy `powder_mutation_chaos_drill_v20100` từ Admin → Mutation & Recovery. PASS yêu cầu:
- duplicate cùng txKey chỉ tăng sandbox balance một lần;
- committed mutation có effect marker;
- forced error rollback hoàn toàn và không có effect marker.

## Official Launch
`powder_mutation_posture_v20100().ready` chỉ TRUE khi:
- tất cả contract required được enabled và handler tồn tại;
- không có atomic transaction mở/anomaly;
- không có legacy recovery chưa xử lý;
- chaos drill PASS trong 7 ngày.

`powder_official_launch_preflight_v20100` đưa trạng thái này vào hard gate `serverMutationIntegration`. Vì vậy build 20.10 có thể chạy ở chế độ tương thích legacy để test, nhưng không thể Finalize Official Live khi server mutation chưa thực sự hoàn chỉnh.
