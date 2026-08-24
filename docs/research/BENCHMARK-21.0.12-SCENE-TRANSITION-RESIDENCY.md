# Powder 21.0.12 — Scene Transition & Asset Residency Benchmark

## Mục tiêu
Giảm burst main-thread/network ngay sau thao tác chuyển view mà không thay gameplay, dữ liệu học, combat hay chất lượng hiệu ứng quan trọng.

## 1. PixiJS — BackgroundLoader
Tham khảo `pixijs/pixijs` `src/assets/BackgroundLoader.ts`.

Pattern áp dụng:
- Background loading tuần tự / concurrency rất thấp để giảm tác động lên frame hiện tại.
- Background load tự pause khi có công việc tải ưu tiên cao.
- Asset đã tải được cache để lần sử dụng sau nhanh hơn.

Áp dụng cho Powder:
- Prefetch nền dùng queue riêng, tối đa 2 request khi `calm`, 1 khi `warm`, 0 khi `hot/critical`.
- Không giữ `Image` ẩn để tránh tăng RAM/GPU residency.

## 2. Phaser — Scene Loader
Tham khảo `phaserjs/phaser` `src/loader/LoaderPlugin.js`.

Pattern áp dụng:
- Loader gắn với lifecycle Scene.
- Queue / inflight được tách rõ.
- Concurrency có thể cấu hình thay vì phát request không giới hạn.
- Asset cache dùng chung giữa scene sau khi tải.

Áp dụng cho Powder:
- Mỗi transition có generation token.
- Task/prefetch của view cũ bị loại bỏ hoặc abort khi người chơi đổi view nhanh.
- Diagnostics tách `queued / inflight / completed / aborted`.

## 3. Excalibur — Director / Scene Transition
Tham khảo `excaliburjs/Excalibur` `src/engine/director/director.ts`.

Pattern áp dụng:
- Navigation có lifecycle bắt đầu/kết thúc rõ ràng.
- Loader của destination có thể chạy sớm nhưng không được chặn transition khi dùng hidden loading.
- Theo dõi scene đã tải để tránh tải lặp.

Áp dụng cho Powder:
- `begin(from,to)` đánh dấu transition generation trước render target.
- First-frame được ưu tiên; polish/prefetch chạy sau hai `requestAnimationFrame`.
- Prefetch dedupe và residency map có giới hạn.

## Quyết định không áp dụng
- Không thêm PixiJS/Phaser/Excalibur vào runtime Powder.
- Không đổi MVC/framework hiện tại.
- Không preload toàn bộ view tiếp theo.
- Không tăng số request để đổi lấy tốc độ giả tạo.
- Không giữ texture/ảnh ẩn trong bộ nhớ chỉ để transition nhanh hơn.

## Acceptance
- 22 gameplay freeze files giữ nguyên SHA-256.
- Không hạ Visual Performance, Long Session Soak, Security hoặc Adaptive Pressure gate.
- Rapid navigation phải hủy stale task.
- `hot/critical` phải chặn optional prefetch.
- `calm` phải phục hồi background queue.
- Không có serious browser runtime exception.
