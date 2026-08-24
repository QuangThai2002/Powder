# Powder 21.0.15 — Combat Presentation 3.0 implementation contract

## Runtime files
- `js/combat-presentation-v21015.js`
- `css/combat-presentation-v21015.css`

## Frozen gameplay contract
21.0.15 MUST NOT modify any file listed in `RELEASE-FREEZE-BASELINE-19.9.0.json`.
In particular, `js/player-combat-scene-v1862.js`, Combat Core, mechanics, AI, Boss, Domain, PvP and Combat Audio remain byte-identical to the frozen baseline.

## Presentation behavior
- Existing `.cv7-attack-flow` remains the source of source→target direction; 21.0.15 only increases trace/impact readability.
- Existing `.cv7-fx` values remain authoritative; 21.0.15 only assigns visual lanes and contrast styles.
- Existing `.cv7-cc-lock`, `hp-critical`, `hp-wounded`, HP/Mana bars remain authoritative; 21.0.15 only emphasizes them.
- Runtime reacts to DOM changes and batches presentation sync to one `requestAnimationFrame`; there is no permanent frame loop.
- `audit()` may read geometry for QA, but normal runtime sync does not call `getBoundingClientRect()`.

## Pressure behavior
`hot` / `critical` pressure or existing `cv71-fx-low`:
- remove target impact ring and decorative element-hit;
- remove presentation glow;
- keep source→target trace;
- keep damage/heal/shield numbers;
- keep CC / lost-turn information;
- keep HP/Mana/state borders.

## QA contract
Real-Chrome gate must prove:
1. Presentation runtime and stylesheet are integrity-bound and loaded.
2. Source→target trace is visible.
3. Multiple values on one target receive distinct lanes.
4. HP/Mana bars are readable.
5. CC lock is visible and target is classified as controlled.
6. Hot pressure removes decoration but not core combat information.
7. State restores after synthetic QA battlefield is removed.
8. No serious runtime exception occurs.
9. Final Regression keeps all 22 gameplay freeze hashes unchanged.
