# Powder 21.0.20 — Player Experience Final Audit benchmark

## Mục tiêu

21.0.20 là release audit/hardening cuối của nhánh 21.0.x. Bản này không thêm gameplay mới. Mục tiêu là kiểm tra trải nghiệm thực tế xuyên suốt desktop + mobile và chỉ sửa regression/lỗi thật nếu gate phát hiện.

## 1. Lighthouse CI

Điểm tham khảo:
- Audit phải chạy lặp lại trong CI thay vì chỉ kiểm tra thủ công một lần.
- Regression nên bị chặn bằng assertion/budget rõ ràng.
- Performance, accessibility và runtime correctness nên được coi là release gate chứ không chỉ là báo cáo tham khảo.

Áp dụng cho Powder:
- Giữ toàn bộ gate hiện có làm baseline bắt buộc.
- 21.0.20 bổ sung một gate tổng hợp người chơi thay vì thay thế/hạ budget của các gate cũ.
- Không dùng Lighthouse package trong runtime và không thêm dependency.

## 2. Playwright

Điểm tham khảo:
- E2E nên thao tác trên UI thật và assert trạng thái người dùng nhìn thấy.
- Cùng một flow cần kiểm tra desktop và mobile emulation.
- Trace/evidence cần đủ để chẩn đoán khi gate fail.

Áp dụng cho Powder:
- Dùng Chrome DevTools Protocol native như các gate Powder hiện tại, không thêm Playwright dependency.
- Khởi động từ trạng thái người chơi mới, chọn Starter bằng UI thật nếu cần.
- Kiểm tra navigation, modal lifecycle, save health, rapid navigation settlement, mobile viewport/touch target và runtime cleanup.
- Xuất JSON + screenshot desktop/mobile làm evidence.

## 3. PixiJS performance guidance

Điểm tham khảo:
- Asset/cache phải có ownership rõ và bounded.
- Tránh tạo work liên tục khi không cần thiết.
- Giảm overdraw/work phụ trước khi hy sinh nội dung quan trọng.

Áp dụng cho Powder:
- Audit snapshot của Scene Transition 21.0.12, Adaptive Pressure 21.0.11, Image Runtime 18.2.6 và Combat Warmup 21.0.19.
- Cuối flow không được còn queue/pending bất thường hoặc cache metadata vượt bound đã thiết kế.
- Không thêm render loop, ticker, MutationObserver hoặc preload toàn bộ asset.

## Quyết định kiến trúc

21.0.20 ưu tiên **gate-first / zero-runtime-change**. Nếu toàn bộ trải nghiệm đạt chuẩn, release chỉ thêm research + audit gate/workflow. Nếu gate tìm thấy lỗi thật, sửa tối thiểu đúng subsystem sở hữu lỗi rồi chạy lại toàn bộ regression.

Không thêm React/Vue/TypeScript/Vite/Lighthouse/Playwright/PixiJS dependency vào Powder.
