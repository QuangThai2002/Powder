# Production Launch Control Guide — 20.7.0

## Thứ tự vận hành
1. Deploy migration `20260823_2070_production_launch_control_hardening.sql`.
2. Deploy Edge Function `powder-admin-official-launch` 20.7.0.
3. Bật Production Observability và kiểm policy/ngưỡng.
4. Mở `index.html?freeze=1`, chạy Hash 22 file, Export JSON và import trong Admin.
5. Mở `index.html?polish=1`, chạy UI audit, Export JSON và import trong Admin.
6. Đảm bảo Load Integrity, Recovery, Security, Real Pilot và LiveOps đều PASS.
7. Tính SHA-256 của ZIP 20.7.0 rồi Register Candidate.
8. Ghi 4 evidence lên server.
9. Save Draft release plan với change window và rollback target.
10. Submit → Owner Approve → ARM.
11. Trong change window, khi Server Preflight PASS: Activate 5%.
12. Sau ≥15 phút và đủ sample: Capture Server Health.
13. Nếu PASS: Advance 20% → lặp capture → 50% → lặp → 100%.
14. Ở 100%, Capture Server Health lần cuối. Chỉ khi PASS mới Finalize Official Live.

## Khi stage health FAIL
Không advance. Điều tra Observability/Incident/Security/Recovery. Nếu cần, dùng Emergency Stop/Rollback hiện có. Không sửa số liệu stage bằng client vì endpoint nhập tay đã bị khóa HTTP 410.

## Change window
Window dài tối thiểu 1 giờ và tối đa 24 giờ, phải nằm trong phạm vi 7 ngày. Sau khi plan đã Submit thì không sửa trực tiếp; Owner phải Revoke rồi tạo revision mới.

## Dữ liệu không được giả lập
- Real Pilot evidence.
- Production Recovery evidence.
- Observability samples.
- Critical/High incident status.
- ZIP checksum.

Build artifact không tự tạo các evidence này.
