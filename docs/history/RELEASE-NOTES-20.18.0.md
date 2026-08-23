# Powder 20.18.0 — Full Game Regression RC1

20.18.0 là RC1 toàn game. Không thêm gameplay mới.

## Fix
- Sửa thiếu role mapping cho Flarion, Aquelion và Sylvion.
- Sửa mẫu Learning prompt generic bị lặp quá nhiều bằng prompt có context bài học.

## QA/Release
- Thêm Full Game Regression runtime + static gate.
- Thêm server evidence contract cho automated/manual smoke.
- Thêm Official Launch hard gate `fullGameRegressionRC1`.
- Build/manifest/evidence phải khớp tuyệt đối; evidence cũ hoặc khác build sẽ HOLD.
- Combat/gameplay critical freeze tiếp tục được bảo vệ.

`official=false` cho tới khi manual production smoke và toàn bộ hard gate hoàn tất.
