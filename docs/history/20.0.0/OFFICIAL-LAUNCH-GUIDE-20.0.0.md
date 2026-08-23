# Official Launch Guide — Powder 20.0.0

## 1. Kiểm tra build 20.0
- Mở `index.html?freeze=1`.
- Chạy `Hash 22 file`, kết quả phải là 22/22 PASS.
- Export Freeze JSON và import vào Admin.
- Mở `index.html?polish=1`, chạy QA/FPS trên thiết bị thật rồi Export JSON và import Admin.
- Chạy Recovery Mode và Load Gate theo các guide 19.4/19.6.

## 2. Real Pilot
Admin phải có 20–50 pilot active với evidence server thật. Gate yêu cầu ≥20 pilot recent 7 ngày, ≥20 PvP match, crash=0, save bad=0, low-FPS device=0, Critical=0 và High=0.

## 3. Ghi evidence server
Trong Admin → Launch, phần Official Launch 20.0 chỉ bật nút ghi evidence khi local evidence tương ứng đã PASS. Mỗi evidence được hash SHA-256 trước khi gửi server.

## 4. Register candidate
Sau khi artifact được host/đặt ở vị trí phát hành, nhập ZIP SHA-256 và Artifact URL rồi chọn `Register 20.0 Candidate`. Bước này không thay currentVersion của người chơi.

## 5. Khóa rollback
Chọn `Khóa rollback = build active hiện tại`. Production chỉ cho phép activate 5% nếu rollback target đúng build đang active và có checksum hợp lệ.

## 6. Canary
- ACTIVATE 5%
- Quan sát ít nhất 15 phút, ghi stage-health PASS.
- ADVANCE 20%
- Quan sát và ghi stage-health PASS.
- ADVANCE 50%
- Quan sát và ghi stage-health PASS.
- ADVANCE 100%
- Quan sát stage 100%, ghi PASS.

Không được bỏ qua stage. Evidence stage quá 24 giờ không dùng để advance/finalize.

## 7. Official Live
Sau stage 100% PASS, dùng `FINALIZE OFFICIAL LIVE`. Server mới chuyển Launch Gate sang live. Nếu có blocker, dùng Emergency Stop/Rollback thay vì cố advance.
