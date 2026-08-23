# PvP Balance Layer Audit — 18.7.1

## Scope
Audit này chỉ bao phủ PvP Online. Không chỉnh Combat Core/PvE để đạt cân bằng PvP.

## Safety rails đang active
1. **Server authoritative state**: client chỉ gửi intent; HP, status, lượt và result do server giữ.
2. **Double/stale action**: kế thừa 18.7.0 `clientActionId + expectedTurnNo`.
3. **Hard CC chain**: không refresh Stun/Freeze đang active; DR 0–3 giảm dần theo lượt và có xác suất chặn CC mới.
4. **Heal loop**: heal lớn hơn 8% Max HP nhận fatigue; hệ số cơ sở 0.88 và giảm tiếp theo stack, floor 0.50.
5. **Shield loop**: hệ số cơ sở 0.90, fatigue theo stack, shield cap 35% Max HP.
6. **One-shot guard**: một update HP giảm không vượt 82% Max HP.
7. **Infinite turn**: vẫn dùng server alternating turn + 45s timer + AFK resolver; client không được tự cấp thêm lượt.
8. **Replay/debug fidelity**: mọi lần safety rail sửa state đều sinh event `balance_guard`.

## Audit roster
- Catalog count: 99.
- Audit rows: 99.
- Hostile skill bị gắn nhầm `support` sau migration: 0.
- Role Sát thủ trong catalog: 0 — cảnh báo, chưa tự tái phân role.
- Kit signature cần review sâu ở 18.8.1: 17 Pow.

## Archetype tự động hiện tại
- guard_knight: 12
- attrition_caster: 9
- sustain_healer: 9
- control_mage: 8
- control_marksman: 8
- tempo_support: 8
- fortress_tank: 7
- pressure_bruiser: 6
- sustain_bruiser: 6
- control_tank: 5
- pressure_marksman: 5
- barrier_healer: 4
- control_support: 4
- attrition_mage: 3
- control_caster: 3
- burst_mage: 2

Các archetype này là **audit labels**, không phải kit mới. Mục tiêu là chỉ ra lý do dùng/điểm cân bằng để chuẩn bị cho 18.8.1, nơi từng Pow mới được audit identity sâu.

## Giới hạn chủ động của 18.7.1
- Không tuyên bố 99 Pow đã có identity hoàn toàn khác nhau; 17 signature giống nhau đã được phát hiện thay vì che giấu.
- Không làm rarity thấp mạnh ngang rarity cao.
- Không thêm mode/combat mechanic mới.
- Không thay Bành Trướng Lãnh Địa; phần đó thuộc 18.8.0.
