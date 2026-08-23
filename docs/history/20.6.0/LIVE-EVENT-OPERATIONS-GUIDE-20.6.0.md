# Live Event Operations Guide — 20.6.0

## Tạo event
1. Mở Admin → Sự kiện.
2. Chọn template hoặc cấu hình mục tiêu/quà/câu hỏi/Combat như trước.
3. Chọn Cohort ở **Publish Workflow 20.6**.
4. Bấm **Lưu Draft**.
5. Bấm **Dry-run**. Không Submit khi còn blocker.
6. Bấm **Submit Review**.
7. Owner kiểm tra và bấm **Owner Approve**.
8. Owner bấm **Publish Live**.

## Sửa event đang live
Không sửa trực tiếp runtime row. Ở Event Registry chọn **Tạo Draft sửa**, chỉnh bản Draft, rồi chạy lại toàn bộ workflow.

## Pause khẩn cấp
Owner có thể bấm **Pause** ở event Live. Pause chỉ chuyển `active=false`, không xóa tiến độ/claim lịch sử.

## Rollback
Rollback dùng snapshot trước publish. Với event mới, rollback sẽ deactivate event. Với event cập nhật, rollback phục hồi payload + eligibility trước đó.

## Cohort
- **All**: toàn bộ người chơi đủ Rank.
- **Pilot**: active Real Pilot.
- **Percentage**: deterministic, cùng user không nhảy cohort giữa các lần refresh.
- **Explicit**: tối đa 500 UUID include; có tối đa 500 UUID exclude.

## Nguyên tắc an toàn
- Không dùng direct DB edit để publish.
- Không xóa runtime event đã có claim/progress.
- Không tăng reward cap để chữa lỗi cấu hình; sửa Draft và dry-run lại.
- Nếu event sai khi đang Live: Pause trước, sau đó tạo Draft sửa hoặc Rollback.
