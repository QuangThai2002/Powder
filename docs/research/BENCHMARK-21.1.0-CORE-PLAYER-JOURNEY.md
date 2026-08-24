# Powder 21.1.0 — Core Player Journey 2.0 benchmark

## Mục tiêu
Làm người chơi hiểu bước tiếp theo ngay trên Home mà không biến Powder thành auto-play, không thêm reward mới và không thay đổi gameplay formula.

## 1. PokéRogue
- Browser game có vòng lặp rất rõ: vào game, tiếp tục tiến trình, chiến đấu, boss và mở rộng đội hình.
- Bài học áp dụng: CTA chính phải nói rõ bước tiếp theo nhưng không khóa các lựa chọn còn lại.
- Powder áp dụng: một mục tiêu ưu tiên duy nhất + lối `Tự chọn khu vực`.

## 2. Habitica
- Biến tiến trình ngoài game thành mục tiêu RPG có trạng thái, progress và reward feedback dễ đọc.
- Bài học áp dụng: mục tiêu dài nên chia thành các track nhỏ có trạng thái hoàn thành.
- Powder áp dụng: tách ba lane `Học hôm nay`, `Boss ngày`, `Thăng hạng`, nhưng không tạo reward mới.

## 3. Pokémon Showdown Client
- Browser-first, navigation nhanh và vẫn dùng được trên mobile.
- Bài học áp dụng: hành động chính phải ngắn, phản hồi tức thời và không tạo overlay nặng.
- Powder áp dụng: panel thuần DOM/CSS, không canvas/particle/animation loop, CTA gọi API hiện có.

## Quy tắc không sao chép
Không copy source code, asset hoặc framework từ ba dự án. Chỉ áp dụng nguyên tắc UX/flow ở mức thiết kế.

## Quy tắc Powder 21.1.0
1. Không sửa 22 gameplay freeze files.
2. Không thay economy, gacha rate, Combat formula, Learning reward hay Rank requirement.
3. Nguồn sự thật duy nhất là save và Learning state hiện tại.
4. Ưu tiên: Promotion Boss → daily 4 ZH/2 EN/6 total → Daily Boss → Rank → Adventure.
5. Mobile tap target tối thiểu 44px cho CTA mới.
6. Runtime phải event-driven, không polling liên tục.
