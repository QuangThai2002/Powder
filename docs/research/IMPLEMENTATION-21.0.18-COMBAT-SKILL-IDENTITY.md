# Powder 21.0.18 — Implementation Notes

## Scope
Presentation-only Combat upgrade. Không thay mechanics, damage, mana/rage costs, AI, target rules, turn timing, server combat, save/economy/learning.

## Runtime
`js/combat-skill-identity-v21018.js`

### Classification
- Release: đọc trực tiếp class trên `.cv7-attack-flow`.
- Charge Ultimate/Exclusive: đọc class callout có sẵn.
- Player Basic/Skill1/Skill2: capture click ở phase capture trước handler game trên `[data-cv7-skill]`, lưu key + ability trong 2.6s để match callout.
- Impact: latch exact key gần nhất trong 950ms để result vẫn giữ đúng identity khi attack-flow đã biến mất.

### Visual ownership
- Tạo tối đa một `.csi218-stage` cho active combat mount và tái sử dụng.
- Chỉ ghi `data-csi218-*` trên mount, callout, flow và Turn Flow HUD.
- Không đổi gameplay class.
- Không thêm texture/image/particle object.

### Scheduling
- Event-driven từ `powder:combat-presentation-sync`, `powder:combat-turn-flow`, `powder:combat-impact-feedback`, `powder:resource-pressure`.
- Tối đa một pending RAF để coalesce event.
- Không MutationObserver mới.
- Không setInterval/ticker.
- Stage beat dùng Web Animations one-shot khi phase/key/actor/ability thực sự đổi.

## Visual hierarchy
1. Basic: card gọn, dashed edge, trace không glow.
2. Skill 1: single accent edge, nhẹ hơn Skill 2.
3. Skill 2: double-edge depth + stronger trace.
4. Exclusive: special violet treatment nhưng vẫn dưới Ultimate.
5. Ultimate: card lớn nhất, typography mạnh nhất, actor/target ring emphasis và release trace mạnh nhất.

## Performance degradation
- `hot`: bỏ secondary shadow/trace glow, semantic text vẫn giữ.
- `critical`: tiếp tục giảm border/ring paint.
- `reduce-motion`: không chạy stage animation, vẫn hiển thị tier/skill/actor/target.

## Mobile
Stage giữ tier + skill + actor→target. Ở <=560px chỉ ẩn nhãn beat phụ; không ẩn skill tier/name/actor/target.

## Freeze boundary
`player-combat-scene-v1862.js` và 22 file trong `RELEASE-FREEZE-BASELINE-19.9.0.json` không được sửa.

## Gate requirements
Chrome gate phải xác minh Basic / Skill1 / Skill2 / Exclusive / Ultimate rank tăng 1→5, Ultimate hierarchy, impact latch, hot pressure reduction, reduced-motion, cleanup, telemetry và 0 serious runtime exception.