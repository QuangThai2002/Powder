# Final Release Checklist — Powder 18.8.2

## Admin Manual Combat Lab
- [x] Manual FX Arena added under Admin Combat Test Lab.
- [x] Uses 99 Pow canonical data.
- [x] Uses 396 fixed V8.1 skill slots.
- [x] 3 active + 2 reserve per side.
- [x] Actor / target manual selection.
- [x] Basic / Skill 1 / Skill 2 / Ultimate manual trigger.
- [x] HP / Mana / Nộ / Shield force controls.
- [x] Damage / Crit / Heal / Shield / CC / DoT / Cleanse / KO / Revive quick FX.
- [x] 3 Giản Dị preview.
- [x] Exactly 9 Bành Trướng preview.
- [x] Simple Domain and Expansion Domain do not coexist.
- [x] Special Domain previews clearly marked as visual sandbox behavior.
- [x] Old Combat Lab diagnostics retained in collapsible legacy diagnostics section.

## Safety
- [x] Manual Arena state is RAM-only.
- [x] No reward grant path.
- [x] No Cloud Save write path.
- [x] No PvP action request path.
- [x] No Edge/Supabase request from Manual FX module.

## Regression
- [x] 108/108 JS syntax PASS.
- [x] Service Worker syntax PASS.
- [x] 19/19 CSS structural brace gate PASS.
- [x] index.html duplicate IDs: 0.
- [x] admin.html duplicate IDs: 0.
- [x] index.html missing local references: 0.
- [x] admin.html missing local references: 0.
- [x] Boot manifest: 1,235 entries; hash/size errors: 0.
- [x] Canonical roles: 9; Sát thủ: 10.
- [x] 99 Pow / 396 skills / 396 unique skill IDs.
- [x] Old Admin Combat Lab v177 runtime references: 0.
- [x] Old boot-loader v1881 runtime references: 0.
- [x] 16 production gameplay files compared with 18.8.1: 0 changed.
- [x] Manual browser interaction harness: PASS, page errors 0.

## Release classification
18.8.2 is an **Admin tooling release**. Production Combat behavior remains 18.8.1-compatible; the new tool is intended for manual FX/UX inspection before proceeding to 18.9.0 Combat Content Expansion.
