# Powder 18.6.1 — Boss Combat 2.0

## New

- Boss signatures now create a real reaction window instead of resolving immediately.
- Daily Boss: **Huyết Liệp · Truy Sát** marks a target and can be canceled by Cleanse.
- Story Boss: **Trấn Áp · Khóa Nhịp** can be canceled by Cleanse; unresolved mark applies Slow + Turn Meter loss.
- Promotion Boss: **Phá Trận · Khiên Chấn** creates a breakable barrier; breaking it interrupts the mechanic and suppresses Boss tempo/Rage.
- Weekly Boss: **Đại Nạn · Tụ Năng** creates a breakable charging barrier; failure allows a Max-HP AoE to resolve.
- Final Boss phases gain an Enrage state and event.
- Boss reaction windows and outcomes are written into replay/recovery-compatible BattleCore state.

## Player UX

- New Boss HUD panel: **CỬA SỔ PHẢN ỨNG**.
- Clear response labels: **THANH TẨY** or **PHÁ KHIÊN**.
- Shows marked target / remaining barrier / progress.
- Dedicated **DẤU SĂN BOSS** and **DẤU TRẤN ÁP** visuals.
- Clear outcome feedback for interrupted, cleansed and Boss-triggered mechanics.

## Reliability

- Phase transition cleans stale reaction state, marks and temporary barriers.
- Boss direct mechanic damage uses the normal Combat mechanic event bus so reactive passives still work.
- 80/80 Boss stress battles finished; 0 exception, invalid state or soft-lock.
- Existing 396-action, reserve/KO/PvP lifecycle and Tactical AI regressions remain clean.

## Build

- Version: **18.6.1**
- Build ID: `powder-18.6.1-boss-combat-2`
- Production modules: **88**
- Preload entries: **1,230**
- Preload bytes: **183,086,219**
- Manifest hash: `47a00ce82276d7e0`

## Not changed

- PowBall opening timing/animation.
- Combat fixed-kit/star policy.
- Online reward authority or anti-cheat rules.
- Production release pointer.
