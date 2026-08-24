# Powder 21.1.4 — Mastery & Adaptive Review 2.0

## Phạm vi
21.1.4 là lớp học thích ứng bổ sung trên 21.1.2 Question Engine + 21.1.3 Academic Content. Không đổi reward, Knowledge, Daily Boss, Rank Exam, Combat, economy hay SRS server authority.

## Runtime
`js/learning-mastery-adaptive-v2114.js`

### Local mastery state
Lưu dưới `save.learning.masteryAdaptiveV2114`:
- `dimensions.ZH/EN[dimension]`: score, attempts, correct, difficulty, stability, lastReviewAt, lastWrongAt.
- `recentMisses`: tối đa 48 mục.
- `model: bounded-dsr-lite`.

Đồng thời mirror `score` về `save.learning.academicDimensionMastery` để planner 21.1.3 tiếp tục dùng tín hiệu yếu/mạnh hiện tại.

### Cập nhật outcome
- Correct: score tiến dần về 100, difficulty giảm nhẹ, stability tăng có xét retrievability trước review.
- Wrong: score giảm, difficulty tăng, stability giảm và source được đưa vào recent misses.
- Một câu trả lời đúng lại sẽ bỏ recent miss tương ứng.
- Không có background interval, observer hoặc unbounded history.

### Review planner
`planReview()`:
1. Chỉ nhận lesson đã nằm trong `lessonsDone`.
2. Loại sourceLesson mismatch.
3. Application chỉ được lấy khi rank policy cho phép.
4. Online due IDs (nếu có) ưu tiên trước.
5. Sau đó ưu tiên recent miss, dimension mastery thấp và retrievability thấp.
6. Seed family diversity trước khi fill theo score.
7. Target bounded 5–30 câu.

### Offline Adaptive
- Nút Adaptive hiện có được intercept ở capture phase chỉ khi KHÔNG có Powder Online session.
- Online vẫn chạy `learning-adaptive-v172.js` như cũ.
- Offline dùng pool từ các lesson đã học và renderer `mount/grade/mark` của 21.1.2 nên hỗ trợ choice, multi, text, order, match.
- UI tái sử dụng modal Adaptive hiện có, không thêm render loop.

## App bridge
21.1.4 bổ sung API offline-only trong `POWDER_APP` để local adaptive session có thể ghi outcome vào save nội bộ thật, thay vì mutate bản clone từ `getSave()`.

Bridge phải:
- từ chối khi tài khoản Online đang hoạt động;
- từ chối câu thuộc lesson chưa học hoặc sourceLesson mismatch;
- gọi Question Engine `recordOutcome()`;
- lưu bằng save pipeline hiện có.

## Boot
Runtime được chèn:
`learning-academic-content-v2113.js → learning-question-engine-v2112.js → learning-mastery-adaptive-v2114.js → app.js`

## QA bắt buộc
- migration từ numeric dimension mastery;
- correct/wrong update đúng hướng và bounded;
- recent misses <= 48;
- learned-only pool;
- no source leakage;
- due Online priority;
- family diversity;
- rank0 không Application;
- engine hook giữ output cũ + thêm adaptive payload;
- no timer loop/MutationObserver;
- boot integrity + historical refresher compatibility;
- 99 Pow / 396 skills và 22 frozen gameplay files không đổi.
