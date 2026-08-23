# Domain Expansion Audit — Powder 18.8.0

## Lock gate
- Expansion total: **9**
- Normal: **6**
- Special: **3**
- Simple Domains: **3**, tách riêng và không tính vào 9 Bành Trướng.

## Online authority
- `pvp_domain_catalog_v1880`: canonical server catalog.
- `pvp_match_players`: lưu domain loadout/state/charges/used.
- `pvp_domain_action_receipts_v1880`: idempotency cho kích hoạt Lãnh Địa.
- `pvp_domain_question_sessions_v1880`: session câu hỏi Vô Lượng; answer key không gửi về client.
- `powder_pvp_action_v1880`: damage/heal/CC/terrain/sword/question interaction.
- `trg_pvp_domain_state_guard_v1880`: damage reduction, anti-heal, Jackpot immortality.
- `trg_pvp_domain_knockout_v1880`: domain damage có thể kết thúc trận đúng server result.

## Interaction coverage
- Damage: expansion bonus, direct Max-HP terrain/sword/pursuit damage, Simple resistance.
- Heal: anti-heal, Verdant lifesteal, Vạn Mộc Sinh Khí.
- Shield: Diamond opening shield, Vạn Mộc rebirth shield, shield absorption for direct domain damage.
- CC: Burn/Poison/Freeze/Slow/Shock/AntiHeal/Corrosion; vẫn đi cùng PvP hard-CC DR 18.7.1.
- Terrain: state có duration/action counter và server expire.
- Swords: 5 sword ID cố định, random không lặp phía server, target active random, sure-hit.
- Questions: 5 câu/gate/current turn; server verifies current player, current turn, domain owner and answer key.

## Fixed during gate
- Huyền Băng: Phá Băng chỉ xảy ra nếu mục tiêu đã Frozen trước hành động. Freeze vừa áp dụng trong cùng hit không kích shatter ngay.
