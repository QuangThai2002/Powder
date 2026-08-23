# Powder 20.19.0 — Release Candidate / Canary Guide

## Mục tiêu
20.19.0 không thêm gameplay. Đây là candidate để chạy rollout 5% → 20% → 50% → 100% với health server-authoritative và rollback drill bắt buộc.

## Điều kiện trước 5%
- Candidate đúng `powder-20.19.0-release-candidate-canary` và ZIP SHA-256 đã register.
- Release authorization đã Owner Approve + ARM trong change window.
- 13 manual smoke của chính build 20.19 đã PASS, Critical=0, High=0.
- Load/Soak, DR, Security, Save Integrity và các posture server cũ đều READY cho đúng build.
- Rollback target đã pin và rollback drill thật ≤600 giây đã PASS data-integrity + post-rollback health.

## Policy từng stage
| Stage | Min requests | Min thời gian | Max error | P95 | P99 |
|---|---:|---:|---:|---:|---:|
| 5% | 1,000 | 15 phút | 1.0% | 1500 ms | 2500 ms |
| 20% | 3,000 | 30 phút | 0.8% | 1400 ms | 2300 ms |
| 50% | 10,000 | 60 phút | 0.5% | 1300 ms | 2100 ms |
| 100% | 25,000 | 120 phút | 0.3% | 1200 ms | 2000 ms |

Mọi stage còn yêu cầu crash=0 và saveConflict=0. Thời gian tính từ lúc stage bắt đầu; advance sẽ reset đồng hồ cho stage mới.

## Manual smoke 13 mục
Dùng `RC-MANUAL-SMOKE-TEMPLATE-20.19.0.json`. Chỉ đổi một mục thành `true` sau khi chạy thật trên deployment candidate. Tool `tools/powder-rc-evidence-builder-v20190.mjs` sẽ từ chối tạo evidence nếu còn mục `false`.

## Stage health
Admin chỉ có `Capture Server Health`. Không có form nhập error/P95/P99 thủ công. Server gọi Observability theo đúng build + rollout ring và tự quyết định PASS/HOLD.

## Rollback drill
Rollback drill phải được thực hiện ngoài artifact với service credential được ủy quyền. Evidence phải ghi target build thật, thời gian rollback, data integrity và post-rollback health. Admin UI không có nút tự PASS rollback drill.

## Finalize
100% chưa đồng nghĩa Official Live. Sau khi 100% đủ ít nhất 120 phút và stage health PASS mới được Owner+AAL2 Finalize. `official=false` trong artifact cho tới khi quy trình thật hoàn tất.
