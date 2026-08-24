# Powder 21.0.14 — Mobile & Touch Experience 2.0

## Mục tiêu
Nâng trải nghiệm Android/màn 360–480 px mà không thay gameplay, không tách project và không tạo một UI mobile riêng gây lệch logic desktop.

## 1. PixiJS 8 — unified pointer interaction
Nguồn: https://pixijs.com/8.x/guides/components/events

Điểm tham khảo:
- Pointer Events là API chung cho mouse, pen và touch.
- `pointercancel` là một phần lifecycle chuẩn, quan trọng trên mobile khi gesture bị hệ điều hành/browser hủy.
- Chỉ đối tượng tương tác mới nên tham gia hit testing; vùng hit có thể độc lập với artwork.

Áp dụng vào Powder:
- Duy trì pointer lifecycle thống nhất đã có từ 21.0.13.
- Mobile runtime chỉ đo touch target trên `pointerdown`, không tạo touch handler song song với click/gameplay.
- CSS tăng vùng tương tác của control quan trọng mà không phóng artwork.

## 2. Phaser — Input + Scale Manager
Nguồn:
- https://docs.phaser.io/phaser/concepts/input
- https://docs.phaser.io/phaser/concepts/scale-manager

Điểm tham khảo:
- Phaser hợp nhất mouse và touch thành pointer API.
- Game/display/parent size là các khái niệm tách biệt; resize cần phản ứng theo viewport thực tế.
- Scale Manager phát `resize` và có viewport/display-size riêng.

Áp dụng vào Powder:
- Không dùng `100vh` cứng làm nguồn sự thật duy nhất trên mobile.
- `VisualViewport` cung cấp chiều cao/chiều rộng nhìn thấy thật cho modal và keyboard handling.
- Nav/filter có vùng scroll riêng; không cho toàn document nở ngang theo nội dung.

## 3. Godot — display safe area / cutouts
Nguồn: https://docs.godotengine.org/en/stable/classes/class_displayserver.html

Điểm tham khảo:
- `get_display_safe_area()` trả về vùng không bị che nơi interactive controls nên được render.
- Cutout/notch cần được tính riêng trên Android/iOS.
- Godot coi touchscreen, virtual keyboard và orientation là capability của display/input layer, không phải gameplay.

Áp dụng vào Powder:
- Giữ `viewport-fit=cover` hiện có.
- Dùng `env(safe-area-inset-*)` cho topbar, dialog và notification.
- Keyboard/orientation tracking nằm trong runtime giao diện 21.0.14, không chạm save/combat/learning.

## Thiết kế chốt
1. CSS mobile là lớp riêng `css/mobile-touch-v21014.css`, cài sau stylesheet player chính.
2. Runtime `js/mobile-touch-runtime-v21014.js` chạy sau Interaction Response 21.0.13 và trước `app.js`.
3. Touch target chính tối thiểu 44 px; input/select/textarea 16 px trên mobile để tránh browser zoom không mong muốn.
4. Nav/filter/wallet dùng scroll container riêng; body/root chặn horizontal spill.
5. VisualViewport + safe-area CSS variables điều khiển modal/keyboard footprint.
6. Không thay `app.js`, không sửa 22 gameplay-freeze files.
7. Chrome mobile gate kiểm tra 360×800, 390×844 và 480×960, touch emulation, orientation, keyboard classifier, overflow, target size và serious runtime exceptions.
