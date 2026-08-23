# Powder 19.7.0 — Real Pilot Operations Guide

## Mục tiêu
Chạy pilot thật với 20–50 người chơi trước Launch Polish. Không dùng dữ liệu giả để PASS release gate.

## 1. Enroll người chơi
Admin → Launch → **Real Pilot Release · 19.7.0**.

- Nhập Tamer UID hoặc user UUID.
- Cohort mặc định: `pilot-1970`.
- Chỉ tài khoản `active=true` mới được server nhận telemetry.

## 2. Người chơi bật Pilot Mode
Người chơi đăng nhập Powder Online rồi mở:

`index.html?pilot=1`

Nếu tài khoản chưa được enroll, overlay sẽ hiện **CHƯA ĐƯỢC MỜI** và server không nhận report.

## 3. Dữ liệu được gửi
Chỉ metrics tổng hợp, tối đa theo chu kỳ khoảng 5 phút khi tab đang active:

- browser/platform đã chuẩn hóa;
- viewport;
- device memory / hardware concurrency nếu browser hỗ trợ;
- số session;
- suspected crash;
- runtime error count;
- reconnect count;
- PvP match / disconnect count;
- Cloud Save conflict count quan sát được;
- FPS probe gần nhất;
- navigation load time;
- heap ratio nếu browser hỗ trợ;
- save-health PASS/FAIL + revision;
- Domain/viewport target đã test.

Không gửi access token, không gửi nội dung save, không gửi mật khẩu, không gửi dữ liệu mỗi frame.

## 4. Báo lỗi Pilot
Trong overlay 19.7 bấm **Báo lỗi** và chọn:

- `critical`: mất/corrupt save, exploit nghiêm trọng, crash blocker, không thể chơi;
- `high`: lỗi gameplay/PvP/reconnect lớn, FPS nghiêm trọng;
- `medium`: lỗi ảnh hưởng nhưng còn workaround;
- `cosmetic`: text/UI/animation không chặn gameplay.

Admin có thể đổi severity và status: `open / triaged / resolved / wontfix`.

## 5. Điều kiện Pilot Gate PASS
Server yêu cầu đồng thời:

- 20–50 tài khoản pilot active;
- >=20 user có telemetry trong 7 ngày;
- >=20 PvP match tổng hợp;
- 0 suspected crash;
- 0 device có save-health FAIL;
- 0 device đã đo FPS <30;
- 0 Critical blocker mở;
- 0 High blocker mở.

Khi đủ, Admin bấm **Áp dụng Pilot evidence**. Checklist ghi source `pilot-server-19.7.0`; checkbox Pilot thủ công cũ không được Release Seal 19.7 công nhận.

## 6. Release Seal
19.7 seal vẫn yêu cầu đầy đủ các gate trước: PvP/reconnect/AFK/9 Domain/mobile/soak/load/rollback + Real Pilot server evidence + manifest hash đúng.

Không seal build nếu còn Critical/High blocker.
