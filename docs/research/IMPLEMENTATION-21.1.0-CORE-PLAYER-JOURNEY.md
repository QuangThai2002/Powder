# Powder 21.1.0 — Core Player Journey 2.0

## Player-facing change
Home có thêm `Hành trình hiện tại` sau hero. Panel đọc save thật và hiển thị:
- mục tiêu ưu tiên hiện tại;
- CTA đi thẳng đến khu vực phù hợp;
- bài học tiếp theo khi có;
- ba lane Học hôm nay / Boss ngày / Thăng hạng;
- nút Tự chọn khu vực để không ép luồng.

## Priority model
1. Nếu đã qua kỳ thi và có Promotion Boss: đi Boss.
2. Nếu Boss ngày chưa hoàn thành: ưu tiên đủ 4 Learning Unit Trung, sau đó 2 Anh, sau đó đủ tổng 6.
3. Khi Learning Unit đủ: nếu Daily Boss gate sẵn sàng thì đi Boss, nếu thiếu Knowledge thì tiếp tục Learning.
4. Sau khi Boss ngày hoàn thành: đánh giá các điều kiện Rank hiện tại.
5. Nếu Rank đủ điều kiện: đi Tamer thi thăng Rank.
6. Nếu thiếu bài/Mastery: Learning. Nếu thiếu EXP/trận thắng: Adventure.

## Runtime
`js/player-journey-v2110.js`
- event-driven qua `powder:app-booted`, `powder:rendered`, `powder:view-changed`, `powder:local-save`, `powder:server-state-dirty`;
- không setInterval, không MutationObserver toàn trang;
- dùng `POWDER_APP.getSave()`, `getLearningState()`, `showView()` và `openLessonFromDungeon()`;
- chỉ render panel khi Home đang active;
- API chẩn đoán `POWDER_PLAYER_JOURNEY_V2110.model()` và `.snapshot()`.

## UI
`css/player-journey-v2110.css`
- desktop 3 progress lanes;
- mobile chuyển 1 cột;
- CTA tối thiểu 44px;
- không thêm blur/particle/canvas nặng.

## Không thay đổi
- economy/reward;
- tỷ lệ PowBall/Cổ vật;
- nội dung câu hỏi hoặc requirement;
- Combat formula;
- save schema;
- 22 gameplay freeze files.

## Release gate
Chrome profile sạch phải xác minh first-run, panel xuất hiện, model ưu tiên Learning ở save mới, CTA mở đúng lesson/learn, mobile không overflow, tap target >=44px, event refresh không nhân bản panel/listener và không có serious runtime exception.
