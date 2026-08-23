# Powder 18.5.1 — Combat Visual Feedback Audit

## Scope
18.5.1 is a presentation-only Combat upgrade on top of the validated 18.5.0 Combat Core. It does not rebalance Pow, change fixed kits, alter PowBall animation, or weaken server authority.

## Visual feedback changes
- Exact target-local heal feedback when an event provides per-target impacts; legacy single-target/derived heal events remain compatible.
- New shield-gain floating value (`⬡ +N`) and shield-absorb value (`⬡ -N`).
- Fully shielded hits show `CHẶN ĐÒN` instead of a misleading `-0` damage number.
- Evaded hits show `NÉ`; they no longer render a fake zero-damage hit.
- Critical hits show an explicit `BẠO KÍCH · -N` label in addition to the stronger visual tier.
- Compositor-only feedback motion for heal, shield, hard CC, status changes and reserve replacement.
- Hard CC / lost-turn feedback remains readable directly on the affected Pow.
- Existing source→target attack traces, hit reactions, camera direction and Ultimate/Exclusive presentations are preserved.

## Adaptive FPS policy
- HIGH: full informative + decorative Combat presentation.
- MEDIUM: removes non-essential secondary decorations first.
- LOW: keeps damage/heal/shield/CC information, but suppresses impact bursts, element-hit decorations, signature impact decorations and camera director.
- Hit-stop duration is automatically shortened at MEDIUM/LOW tiers.
- Feedback motion uses `transform` / `opacity` through Web Animations; no new top/left/width/height animation loop was added.

## Combat Core regression
- 99 Pow.
- 396 / 396 fixed-kit actions executed.
- 0 exceptions.
- 0 unavailable actions unexpectedly.
- 0 empty targets.
- 0 invalid BattleCore states.
- 0 dead actions.
- 11 / 11 utility mechanic assertions passed.
- 80 / 80 automated 5v5 stress battles finished.
- 0 soft-locks.

## Production runtime regression
- 103 / 103 JavaScript files: Node syntax PASS.
- TypeScript checkJs direct undefined/scope/callability classes: 0 for TS2304, TS2552, TS2451, TS2448, TS2449, TS2349.
- Player boot order: 86 scripts.
- Browser Player smoke: 0 page errors, 0 console errors, no horizontal overflow.
- Admin: 15 / 15 pages render, no horizontal overflow.
- Battle scene smoke: scene renders, 18.5.1 API loaded, no page/console errors, no overflow.
- Long-session regression: 270 navigation clicks + 100 modal cycles + 12 PowBall cycles; DOM node delta -1, active intervals 0, active rAF 0.

## Preload integrity
- Manifest entries: 1,228.
- Script order: 86.
- Missing entries: 0.
- Size mismatches: 0.
- Hash mismatches: 0.
- Direct client `/rpc/`: 0.
- Direct client `rest/v1/player_saves`: 0.

## Non-goals / unchanged
- No Pow balance changes.
- No fixed-kit changes.
- No PowBall timing/easing/FX changes.
- No framework or package additions.
- No client-trusted Online Combat reward/result path added.
- HTTPS public deployment smoke remains a real deployment gate and is not faked in this sandbox.
