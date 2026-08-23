# Powder 18.5.0 — Combat Core Experience

18.5.0 is a Combat correctness and lifecycle release. It does not redesign the whole Combat UI and does not alter PowBall animation.

## Highlights
- Production canonical action parser upgraded to v1850.
- 99 Pow / 396 fixed skill actions audited and executable with zero dead actions.
- Correct target semantics for multi-ally, multi-enemy, self+ally and dual enemy-or-ally skills.
- Correct canonical coefficient parsing for hybrid/multi-hit descriptions, including cases such as total damage coefficients.
- Reactive passive/mechanic event bus restored in the V9 damage override.
- Protection/redirect, direct damage reduction, lifesteal, shield redistribution, Growth, counter utility, one-hit debuff immunity, turn-meter chains and assist-shot mechanics implemented/tested.
- KO/reserve replacement hardened to prevent replacement soft-locks.
- PvE/PvP terminal lifecycle validated under focused tests and 80 full 5v5 stress battles.
- Production boot/rank/cache identity bumped to 18.5.0 and obsolete parser removed.

## Performance / stability
No new heavy Combat rendering layer or framework was introduced. Existing adaptive FX/performance strategy remains intact. Browser long-session stress continues to settle intervals/rAF to zero with stable DOM/heap behavior.

## Online authority
18.5.0 does not weaken server authority. Client-declared Online Combat wins remain unable to mint protected rewards where a server verifier is not yet available.
