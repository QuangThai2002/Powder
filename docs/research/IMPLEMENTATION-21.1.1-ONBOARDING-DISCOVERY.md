# Powder 21.1.1 — Onboarding & Discovery 2.0

## Player-facing change
Onboarding tự động của người chơi mới chuyển từ 15 bước xuống 5 bước cốt lõi. Hướng dẫn đầy đủ 15 bước vẫn giữ nguyên khi bấm nút `?` hoặc mở lại từ Settings.

## Quick flow
1. Chào mừng đến Powder — Home.
2. Hành trình hiện tại — spotlight panel 21.1.0.
3. Học viện là con đường chính — Learn.
4. Phiêu lưu để vận dụng kiến thức — Adventure.
5. Bạn đã sẵn sàng — Home.

## Compatibility
- Bước Hành trình ưu tiên selector `#powderJourney2110`.
- Giữ fallback `#playerJourneyHubV147` để không phá build/DOM cũ.
- API onboarding vẫn là `POWDER_ONBOARDING_V146`; bổ sung `mode()` và `flowSteps()` cho diagnostics.
- `start(0)` mặc định full 15 bước; chỉ `maybeAutoStart()` dùng `start(0,'quick')`.

## Không thay đổi
- Không xóa bất kỳ step hướng dẫn cũ nào.
- Không đổi gameplay/economy/reward/save schema.
- Không sửa Combat, Pow stats, Learning requirements hoặc gacha.
- Không sửa 22 gameplay freeze files.

## Release gate
Chrome profile sạch phải kiểm tra:
- chọn Starter thật;
- auto onboarding chạy `quick`, đúng 5 step;
- đi qua đúng chuỗi Home → Home → Learn → Adventure → Home;
- step Hành trình spotlight thật `#powderJourney2110`;
- hoàn tất quick flow rồi app trở về Home;
- manual `start(0)` vẫn là `full`, 15 step;
- mobile overlay không tràn viewport;
- không có serious runtime exception.
