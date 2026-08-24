# Powder 21.1.4 — Mastery & Adaptive Review 2.0 Benchmark

## Mục tiêu
Thiết kế lớp mastery/adaptive cục bộ bổ sung cho SRS server hiện tại. Không thay thế lịch SRS Online, không sinh kiến thức chưa học, không biến mọi review thành trắc nghiệm.

## 1. Anki / FSRS
Nguồn tham khảo:
- https://docs.ankiweb.net/deck-options.html
- https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- https://github.com/open-spaced-repetition/py-fsrs/blob/main/fsrs/scheduler.py

Điểm áp dụng:
- Tách trạng thái ghi nhớ thành tín hiệu tương tự Difficulty / Stability / Retrievability thay vì chỉ nhìn phần trăm đúng.
- Trạng thái chỉ đổi khi có review; không cần timer/polling nền.
- Lapse phải làm tăng ưu tiên ôn lại, còn câu đã nhớ tốt giãn ưu tiên.

Điểm KHÔNG sao chép:
- Powder không tự nhận mình chạy FSRS-6 đầy đủ ở local. 21.1.4 dùng mô hình nhỏ `bounded-dsr-lite` để xếp ưu tiên, còn SRS server canonical vẫn giữ quyền lịch ôn Online.

## 2. Open edX
Nguồn tham khảo:
- https://docs.openedx.org/en/latest/educators/references/course_development/exercise_tools/guide_problem_types.html
- https://docs.openedx.org/en/latest/educators/references/course_development/working_with_problem_components.html

Điểm áp dụng:
- Review phải giữ nhiều interaction: single/multi select, text input, order, matching nếu nội dung hỗ trợ.
- Feedback sau câu trả lời là một phần của trải nghiệm học, không chỉ chấm điểm.
- Renderer 21.1.2 được tái sử dụng thay vì tạo một quiz engine thứ hai.

## 3. Moodle
Nguồn tham khảo:
- https://docs.moodle.org/502/en/Learning_plans
- https://docs.moodle.org/501/en/Question_behaviours

Điểm áp dụng:
- Mastery được nhìn theo competency/dimension thay vì chỉ một điểm tổng.
- Adaptive review có hành vi riêng nhưng vẫn dùng cùng nguồn câu hỏi/feedback canonical.
- Hồ sơ năng lực là tín hiệu chọn nội dung; không tự mở curriculum chưa học.

## Quyết định cho Powder
1. Giữ SRS server và weak concepts Online nguyên vẹn.
2. Thêm local mastery theo `language + academic dimension` để hoạt động cả Offline.
3. Mỗi dimension chỉ giữ trạng thái tổng hợp bounded; không lưu event log vô hạn.
4. `recentMisses` tối đa 48 mục, đúng lại thì xóa lỗi tương ứng.
5. Review pool chỉ xây từ `lessonsDone` và metadata của chính lesson.
6. Online due card nếu được truyền vào planner luôn có ưu tiên cao nhất.
7. Rank thấp không được lọt Application ngoài policy hiện có.
8. Local adaptive session dùng `POWDER_LEARNING_QUESTION_ENGINE_V2112.mount/grade/mark`, nhờ đó không quay lại choice-only.
