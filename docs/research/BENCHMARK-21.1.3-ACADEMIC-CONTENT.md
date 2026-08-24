# Powder 21.1.3 — Academic Content & Exercise Expansion Benchmark

## Mục tiêu
Biến Learning Question Engine 4.0 thành một hệ học có phân bố năng lực hợp lý theo Rank, không để một bài 30–65 câu bị chi phối bởi chỉ vocabulary recognition.

## Nguồn đối chiếu

### 1. HSK 3.0 — Chinese Tests Service Website
- Nguồn chính thức hiện hành: https://www.chinesetest.cn/syllabus
- Dùng syllabus / sample / competency profile làm mốc định hướng cho Chinese curriculum.
- Powder không sao chép đề hay sách; chỉ dùng chuẩn năng lực để tổ chức nội dung tự biên soạn.

### 2. CEFR Companion Volume — Council of Europe
- https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors
- CEFR mô tả năng lực theo reception, production, interaction và mediation thay vì chỉ đếm từ vựng.
- Powder áp dụng nguyên tắc này cho B1+ → B2: reading, grammar/context, written production và workplace/application tăng dần theo Rank.

### 3. Open edX problem types
- https://docs.openedx.org/en/latest/educators/references/course_development/exercise_tools/guide_problem_types.html
- Single select, multi-select, text input và richer interactions đều là first-class assessment types; feedback/hints là một phần của exercise design.
- Powder giữ 5 renderer 21.1.2 và dùng content policy để quyết định khi nào dạng nào nên xuất hiện.

### 4. Moodle question behaviours
- https://docs.moodle.org/en/Question_behaviours
- Immediate feedback / interactive feedback cho thấy grading behaviour cần tách khỏi question content.
- Powder tiếp tục giữ content, renderer, grading và session policy thành các lớp riêng.

### 5. Anki FSRS concepts
- https://docs.ankiweb.net/stats.html
- Stability, difficulty và retrievability cho thấy review cần dựa vào khả năng nhớ, không dựa duy nhất vào số lần đã thấy.
- Powder chưa thay scheduler canonical ở 21.1.3; session planner chỉ ưu tiên dimension mastery yếu hơn.

## Quyết định thiết kế
1. Question family quota theo Rank thay vì chọn ngẫu nhiên toàn pool.
2. HSK1 explanation-first, Application bị khóa; Production chỉ rất nhẹ và có đáp án kiểm chứng.
3. HSK3–5 tăng Reading / Production / Application dần.
4. English bắt đầu ở B1+; không tạo A1/A2/B1 remedial curriculum.
5. Context question chỉ sinh từ câu/ví dụ thật trong lesson hiện tại.
6. Không sinh kiến thức ngoài lesson, không đẩy generated question vào canonical global bank.
7. Không sửa reward, Combat, Boss, Rank authority hay server mutation.
