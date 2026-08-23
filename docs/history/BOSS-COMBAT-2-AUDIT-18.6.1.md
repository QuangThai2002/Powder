# Powder 18.6.1 — Boss Combat 2.0 Audit

## Scope

Powder 18.6.1 layers Boss Combat 2.0 on top of the 18.6.0 Tactical PvE AI / Boss phase foundation. It does not create a second combat engine. Boss mechanics execute inside the existing BattleCore, emit the normal combat/reaction event bus, serialize inside the existing recovery state, and remain compatible with the 3-active + 2-reserve combat lifecycle.

## Boss reaction-window mechanics

### Daily Boss — Huyết Liệp · Truy Sát
- Arms the lowest-HP player Pow with **DẤU SĂN BOSS**.
- Reaction: **THANH TẨY** before the Boss resolves its next mechanic window.
- Unresolved hit: approximately 8.5% target Max HP; phase 2 increases pressure to approximately 11%.
- Shield absorbs damage normally and the hit emits standard `DAMAGE_TAKEN`, `SHIELD_BREAK`, and `KILL` mechanic events when applicable.

### Story Boss — Trấn Áp · Khóa Nhịp
- Marks the fastest / most dangerous tempo target with **DẤU TRẤN ÁP**.
- Reaction: **THANH TẨY**.
- Unresolved effect: Slow for 2 turns plus 14 Turn Meter loss; phase 2 raises the meter loss to 18.

### Promotion Boss — Phá Trận · Khiên Chấn
- Generates a breakable reaction barrier: approximately 8% Boss Max HP in phase 1 and 10% in phase 2.
- Reaction: **PHÁ KHIÊN** before resolution.
- Successful interrupt: Boss loses 24 Turn Meter and 25 Rage.
- Failed response: remaining reaction barrier is removed, 30% of current player shields are broken, and Anti-Heal -25% is applied for 2 turns.

### Weekly Boss — Đại Nạn · Tụ Năng
- Generates a breakable reaction barrier: approximately 10% Boss Max HP; final phase approximately 12%.
- Reaction: **PHÁ KHIÊN**.
- Successful interrupt: Boss loses 30 Turn Meter and 30 Rage.
- Failed response: AoE approximately 8% Max HP; final phase approximately 10%, with normal shield absorption and reaction events.

## Phase / recovery / replay behavior

- Pending mechanic state is stored at `boss.v9.battleFlags.bossMechanic1861` and therefore travels with the existing recovery snapshot.
- Phase transition cancels the old mechanic and removes temporary reaction barrier / Boss marks (`phase-cancel`) so no mechanic leaks into the next phase.
- Battle end clears pending mechanics.
- Final phase enables Boss Enrage, fills Rage to 100, adds Turn Meter pressure, and records `boss-enrage`.
- Replay compact events retain mechanic id, response, outcome, barrier/progress, enrage and direct mechanic-damage metadata.

## Player feedback

- Boss HUD shows **CỬA SỔ PHẢN ỨNG** with mechanic name, required response, marked target, barrier/progress and short instruction.
- Dedicated high-priority status visuals:
  - `Boss Mark` → **DẤU SĂN BOSS**
  - `Suppression Mark` → **DẤU TRẤN ÁP**
- Outcome feedback distinguishes **ĐÃ NGẮT**, **ĐÃ THANH TẨY**, and **BOSS KÍCH HOẠT**.
- Debug AI scores remain Admin-only; Player receives only actionable telegraph information.

## Focused assertions

All focused Boss mechanic assertions passed:
- Daily arm → recovery snapshot contains pending state → Cleanse cancels mechanic.
- Story arm → Cleanse cancels mechanic.
- Promotion shield break → interrupt; tested meter 70→46 and Rage 80→55.
- Weekly shield break → interrupt.
- Weekly failed response → AoE damage resolves through the normal shield / mechanic event path.
- Final Weekly phase → Enrage flag and event present.
- Promotion phase transition removes old reaction barrier; only canonical phase shield remains.
- Story phase transition removes old suppression mark.

## Boss stress test

80 Boss battles were executed: 20 Daily + 20 Weekly + 20 Promotion + 20 Story.

- Finished: **80 / 80**
- Wins: **41**
- Losses: **39**
- Exceptions: **0**
- Invalid BattleCore states: **0**
- Soft-locks: **0**
- Battles reaching safety action cap: **0**
- Total actions: **1,401**
- Longest battle: **48 actions**
- Average: **17.5 actions / battle**
- Mechanic interrupts: **20**
- Mechanic cleanses: **18**
- Mechanics resolved by Boss: **105**
- Enrage events: **48**
- Largest replay: **481 events**

## Core regression

The prior combat gates remain clean after Boss Combat 2.0:
- **99 Pow / 396 actions** executed.
- Dead/no-effect actions: **0**.
- Unintended unavailable actions: **0**.
- Empty targets: **0**.
- Invalid BattleCore states: **0**.
- KO/reserve/PvP lifecycle regression: **8 / 8 PASS**.
- Tactical AI / 4 Boss phase policies: PASS.

## Browser / Admin regression

- Production script order: **88 modules**.
- Player navigation smoke: PASS; no overflow; no page/console errors.
- Admin: **15 / 15 pages**; no overflow; no page/console errors.
- Combat Lab runtime target: `Boss Combat 2.0 / PvE AI 18.6.1`.
- Boss scene API: `18.6.1-boss-combat-2`.
- Mobile Boss reaction HUD smoke: PASS; reaction panel present; no horizontal overflow.
- Long-session: 270 navigation clicks + 100 modal cycles + 12 PowBall cycles; DOM delta -1; intervals 0; rAF 0 after settle; heap approximately 30 MB; no page/console errors.

## Static / preload integrity

- JavaScript syntax: **105 / 105 PASS**.
- Direct missing/scope/callability TypeScript diagnostics: TS2304/TS2552/TS2451/TS2448/TS2449/TS2349 = **0**.
- CSS files: 17; delimiter errors 0; local CSS URL missing 0.
- Duplicate HTML IDs: 0.
- Missing local HTML src/href: 0.
- Direct client `/rpc/`: 0.
- Direct client REST `player_saves`: 0.
- Service Worker `ignoreSearch:true`: 0.
- Preload entries: **1,230 unique / 1,230 total**.
- Production scripts: **88**.
- Missing preload files: 0.
- Size mismatch: 0.
- Hash mismatch: 0.
- Total preload bytes: **183,086,219**.
- Manifest hash: **47a00ce82276d7e0**.

## Preserved boundaries

- No PowBall animation/timing redesign.
- No framework migration or new npm dependency.
- No change to online reward authority: client-declared Event Combat wins remain non-authoritative.
- No weakening of PvP/economy/server-authoritative boundaries.
- 18.6.0 Tactical AI and Boss phase policy remain the foundation; 18.6.1 adds the reaction-window mechanic layer.

## Deployment limitation

A real hosted HTTPS smoke, staging restore drill, and 20–50-player pilot still require an actual deployment environment. These are not marked PASS by this sandbox audit.
