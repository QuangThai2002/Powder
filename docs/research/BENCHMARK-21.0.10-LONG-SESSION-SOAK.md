# Powder 21.0.10 — Long Session Soak & Leak Gate

Ngày nghiên cứu: 2026-08-23

## Mục tiêu

Bổ sung một gate tự động phát hiện regression trong phiên chơi dài mà các gate hiện tại chưa bao phủ: DOM tăng dần, JS heap không quay về sau GC, transient VFX không được dọn, runtime/image cleanup không hoạt động sau nhiều lần chuyển vùng logic.

Bản này không đổi combat, learning, economy, PvP hay cân bằng gameplay.

## 3 dự án tham khảo

### 1. Three.js

Repository: https://github.com/mrdoob/three.js

Quy mô tham khảo tại thời điểm nghiên cứu: khoảng 113k GitHub stars.

Điểm áp dụng: texture và tài nguyên renderer có chi phí bộ nhớ lớn hơn nhiều so với kích thước file tải xuống; tài nguyên đã bỏ khỏi scene vẫn cần được giải phóng/không giữ reference ngoài ý muốn. Powder áp dụng ý tưởng này ở mức web DOM/image runtime: ép GC trong gate, kiểm tra heap quay về, kiểm tra hidden image eviction và cleanup sau nhiều vòng.

### 2. PixiJS

Repository: https://github.com/pixijs/pixijs

Quy mô tham khảo tại thời điểm nghiên cứu: khoảng 47k GitHub stars.

Điểm áp dụng: render loop/ticker có kiểm soát nhịp, pause/resume và giới hạn công việc theo frame. Powder đã có adaptive FPS tier; 21.0.10 bổ sung kiểm thử phiên dài để bảo đảm các cơ chế dọn nền không tạo tích lũy DOM/heap qua nhiều vòng hoạt động.

### 3. Phaser

Repository: https://github.com/phaserjs/phaser

Quy mô tham khảo tại thời điểm nghiên cứu: khoảng 40k GitHub stars.

Điểm áp dụng: lifecycle của game có pause/resume rõ ràng và tách khỏi logic nội dung. Powder đã có visibility/lifecycle handling; 21.0.10 kiểm chứng tự động rằng lifecycle cleanup vẫn hoạt động khi runtime bị stress lặp lại.

## Thiết kế gate 21.0.10

- Chạy Chrome headless thật, không mock DOM.
- Chờ đủ `POWDER_RUNTIME_LIFECYCLE_V1826`, `POWDER_IMAGE_RUNTIME_V1826`, `POWDER_PERFORMANCE_V1757`.
- Lấy baseline DOM/heap sau forced GC.
- Chạy 5 vòng stress trên tối đa 12 view runtime.
- Mỗi vòng gọi đúng API lifecycle/image hiện có, tạo transient VFX giả rồi yêu cầu cleanup.
- Forced GC sau mỗi vòng và lưu metrics.
- Fail nếu transient còn sót, heap cuối vượt budget, node cuối vượt budget, heap cuối phiên không ổn định hoặc có serious runtime exception.
- Khôi phục `activeView`/hidden state sau test.
- Lưu JSON evidence và screenshot cuối phiên.

## Nguyên tắc an toàn

- Không hạ ngưỡng gate cũ.
- Không đổi runtime/player code chỉ để test pass.
- Nếu gate phát hiện leak thật, sửa leak ở runtime gốc rồi chạy lại toàn bộ CI.
- Không đưa report/ảnh QA vào ZIP runtime phát hành.
