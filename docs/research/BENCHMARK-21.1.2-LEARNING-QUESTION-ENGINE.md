# Powder 21.1.2 — Learning Question Engine 4.0 Benchmark

## Mục tiêu
Nâng Powder từ ngân hàng câu hỏi chủ yếu chọn đáp án + biến thể câu dẫn thành một hệ bài tập học thuật đa hình thức, nhưng vẫn giữ curriculum, SRS, Boss và server authority hiện tại.

## 1. Moodle 5.0 — Question behaviours / question system
Tham khảo: https://docs.moodle.org/500/en/question/behaviour

Điểm áp dụng:
- Tách **nội dung câu hỏi** khỏi **hành vi tương tác/feedback**.
- Có immediate feedback, adaptive/multiple tries và certainty-based marking.
- Powder 21.1.2 chưa thay grading/reward bằng CBM, nhưng kiến trúc archetype/family phải cho phép thêm confidence/remediation sau này.

## 2. Open edX — Problem Types
Tham khảo:
- https://docs.openedx.org/en/latest/educators/references/course_development/exercise_tools/guide_problem_types.html
- https://docs.openedx.org/en/latest/educators/concepts/exercise_tools/about_text_input.html
- https://docs.openedx.org/en/latest/educators/concepts/instructional_design/feedback_best_practices.html

Điểm áp dụng:
- Một course nghiêm túc không nên chỉ dựa vào single-select: text input, multi-select, dropdown/selection và drag/drop-like interactions đều có giá trị.
- Text input cần hỗ trợ nhiều đáp án hợp lệ/normalization để tránh phạt người học vì khác biệt chữ hoa, khoảng trắng hoặc biến thể cho phép.
- Feedback phải giải thích vì sao đúng/sai, không chỉ báo màu.
- Mobile-ready là yêu cầu bắt buộc.

## 3. Anki FSRS — review theo lịch sử ghi nhớ
Tham khảo: https://docs.ankiweb.net/deck-options

Điểm áp dụng:
- Lịch ôn nên dựa trên lịch sử recall/độ khó thay vì lặp ngẫu nhiên.
- Powder đã có SRS; 21.1.2 không thay thuật toán interval hiện tại, nhưng bổ sung dimension mastery để về sau SRS biết người học yếu **mặt nào** của cùng một Learning Unit: nghĩa, Hanzi, Pinyin, grammar, context hay production.

## Quyết định cho Powder
1. 7 Question Families: Recognition, Recall, Grammar, Context, Reading, Production, Application.
2. Registry ít nhất 70 archetype, nhưng mỗi bài chỉ kích hoạt archetype có đủ dữ liệu và phù hợp Rank.
3. Năm interaction đầu tiên phải hoạt động thật: choice, multi-select, text input, token order, matching.
4. Không đưa câu generated phi-choice vào global `D.questions` trong 21.1.2. Boss, Combat, SRS và server lesson tiếp tục dùng canonical bank an toàn.
5. Offline lesson có thể dùng academic-generated pool. Online lesson vẫn chấp nhận server canonical question IDs và renderer legacy.
6. Không sinh kiến thức chưa học; generated question phải trace được về lesson và Learning Unit nguồn.
7. Không lặp cùng `sourceUnit + archetype` trong một session trừ remediation về sau.
