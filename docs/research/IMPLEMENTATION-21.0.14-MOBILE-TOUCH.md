# Powder 21.0.14 — Implementation Scope

- Branch: `upgrade/21.0.14-mobile-touch-experience-2`
- Player runtime only; no gameplay formula change.
- New CSS: `css/mobile-touch-v21014.css`.
- New runtime: `js/mobile-touch-runtime-v21014.js`.
- Boot order: Scene 21.0.12 → Interaction 21.0.13 → Mobile 21.0.14 → `app.js`.
- Extra stylesheet is integrity-bound and installed after the canonical player stylesheet.
- Boot manifest target: 1281 entries / 125 scripts.
- Mobile breakpoints validated by gate: 360×800, 390×844, 480×960 plus landscape 800×360.
- No changes to the 22 gameplay-freeze files.
