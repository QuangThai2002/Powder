# Powder 21.0.19 — Combat Warmup & Zero-Stutter Entry Benchmark

## Mục tiêu
Giảm hitch lần đầu khi mở Combat mà không preload toàn bộ hệ Combat, không thay Combat Core và không giữ texture/Image lâu dài trong bộ nhớ.

## 1. PixiJS Assets 8.x
PixiJS Assets dùng Promise, cache để tránh request lặp, manifest/bundle và background loading. Bài học áp dụng cho Powder: warm theo bundle nhỏ đúng scene thay vì tải toàn kho asset; asset đã warm phải được dedupe/cache.

Áp dụng:
- Combat plan chỉ chứa arena + Pow sắp xuất hiện + một bộ skill art cần ngay.
- URL được dedupe trước khi queue.
- Recent decode cache có giới hạn; không giữ Image object sau decode.

## 2. Phaser Scene Loader
Phaser có lifecycle LOADING trước CREATE; scene chỉ tạo sau khi asset cần thiết hoàn tất. Bài học áp dụng: xác định dependency của scene trước first-use và tạo readiness boundary rõ.

Powder không đổi `startEncounter` thành async vì API Combat hiện tại là synchronous và thuộc gameplay freeze. Thay vào đó 21.0.19 warm từ Adventure/Boss idle-time, sau đó prime enemy ngay khi entry được gọi; preload canonical trong Combat vẫn là fallback cuối.

## 3. Godot — first-use stutter / pipeline precompilation
Godot mô tả first-use compilation/resource work là nguồn hitch và khuyến nghị làm công việc cần thiết trong loading/background trước lúc nội dung được vẽ. Tài liệu cũng chỉ ra precompile mọi biến thể có thể tốn nhiều thời gian và bộ nhớ.

Áp dụng:
- Không warm tất cả 99 Pow, 396 skill hay mọi combat form.
- Không warm particle/audio/Domain không chắc sẽ dùng.
- Pressure `hot` giảm plan mạnh; `critical` bỏ warm hoàn toàn.

## Quyết định kiến trúc Powder
Plan tối đa theo pressure:
- calm: tối đa 15 asset — 2 arena, 5 team, tối đa 3 enemy, tối đa 5 skill art của Pow đầu tiên.
- warm: tối đa 12 — 2 arena, 3 team, tối đa 3 enemy, tối đa 4 skill art.
- hot: tối đa 6 — 2 arena, 3 team, 1 enemy, không skill art.
- critical: 0 — không thêm tải/decode khi thiết bị đang chịu áp lực.

Warmup dùng `Image.decode()` one-shot, concurrency 3/2/1/0 theo pressure và giải phóng reference sau khi xong. Không thêm ticker, `setInterval`, `MutationObserver`, particle cache hoặc texture manager mới.

## Freeze
`player-combat-scene-v1862.js` và `combat-entry-v177.js` đều nằm trong 22-file gameplay freeze. 21.0.19 không sửa hai file này. Runtime mới wrap object `window.POWDER_COMBAT_ENTRY_V177` sau boot để prime asset rồi chuyển tiếp nguyên lời gọi sang API frozen.

## Nguồn tham khảo
- PixiJS 8.x — Assets / Manifests & Bundles.
- Phaser 4.x — Scene LOADING lifecycle / Loader.
- Godot latest — Reducing stutter from shader pipeline compilations / jitter & stutter guidance.
