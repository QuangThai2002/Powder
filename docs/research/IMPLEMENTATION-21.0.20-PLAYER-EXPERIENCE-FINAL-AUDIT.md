# Powder 21.0.20 — Player Experience Final Audit

## Release principle

Không thêm gameplay mới. Không sửa 22 file gameplay freeze trừ khi có blocker Critical/High được chứng minh bằng gate. Không hạ bất kỳ security/performance/mobile/combat/soak budget hiện có.

## Audit matrix

### Boot & first-run
- App boot hoàn chỉnh, không có `__POWDER_APP_BOOT_ERROR__`.
- Nếu chưa có save, Starter setup hoạt động và vào Home thành công.
- Chỉ một view chính được hiển thị sau khi vào app.

### Navigation
- Home → Inventory → Learn → Adventure → Chests → PowDex → Settings → Home.
- `body.dataset.activeView`, hidden state và active navigation phải đồng bộ.
- Rapid navigation phải settle ở view cuối, không để Scene Transition mắc `pending`.

### Modal lifecycle
- PowDex mở được Pow profile modal và đóng sạch.
- Learning mở được lesson modal khi có Learning Unit khả dụng và đóng sạch.
- Kết thúc audit không còn modal hiển thị hoặc state busy mắc kẹt.

### Save & recovery health
- `POWDER_APP.saveNow('v21020-audit')` phải thành công.
- Save schema 15, validation error = 0.
- Primary save có dữ liệu và backup/recovery API không ném exception.
- Không thay đổi economy để tạo PASS.

### Mobile 390×844
- Chuyển qua các view chính trong mobile emulation.
- Không có horizontal overflow cấp document đáng kể.
- Các nút thao tác chính đang hiển thị có tap target tối thiểu xấp xỉ 44×44.
- Mobile runtime không báo overflow/keyboard state bị mắc.

### Runtime health
- Scene Transition, Interaction Response, Mobile Touch, Adaptive Pressure, Combat Warmup tồn tại.
- Sau khi settle: scene task/asset queue bounded; warmup queue/pending/active = 0.
- Không có serious Runtime exception.
- Không có visible enabled control giữ `data-busy="1"` ở cuối flow.

## Evidence

Gate tạo:
- `PLAYER-EXPERIENCE-FINAL-GATE-21.0.20.json`
- screenshot desktop cuối flow
- screenshot mobile cuối flow

## Release gate

Workflow mới `Powder Player Experience Final Audit` chạy song song với toàn bộ gate hiện có. Chỉ merge khi toàn bộ workflow cùng xanh trên một final head và gate 21.0.20 được rerun độc lập thêm một lần.
