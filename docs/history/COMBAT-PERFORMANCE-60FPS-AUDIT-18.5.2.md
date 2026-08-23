# Powder 18.5.2 — Combat Performance 60 FPS Audit

## Scope
18.5.2 is a performance-only hardening pass on the validated 18.5.1 Combat Visual Feedback build. It does not rebalance Pow, change the fixed four-slot skill model, change PowBall animation, or weaken Online server authority.

## Renderer hardening
- Incremental FX DOM patching: the FX layer no longer reparses the complete FX template on every persistent scene patch.
- Vital-diff cache: HP / Mana / Rage / Shield DOM is only rewritten when the numeric state changes.
- Shared UI-expiry scheduler for high-frequency banner / pulse / FX / camera / hit-stop expiry instead of one independent timer per feedback item.
- Renderer patch telemetry now exposes patch P95/P99, vital write/skip counts, FX node create/reuse and expiry wakeups.
- Frame percentile sampling sorts each sample window once per evaluation instead of repeatedly sorting the same data.

## Audio hardening
- Combat Audio receives the current FX performance tier.
- Audio polyphony budget: HIGH 56, MEDIUM 40, LOW 28 active nodes.
- The canonical BGM and important gameplay SFX are preserved; the cap primarily prevents burst polyphony from compounding frame/audio pressure.

## Measured renderer comparison
Same Chromium harness, same Combat scene, 160 repeated UI renders with unchanged unit vitals:
- 18.5.1 `<template>` creations: 241
- 18.5.2 `<template>` creations: 81
- Reduction: ~66.4%
- 18.5.2 renderer patches: 162
- Vital DOM writes: 2
- Vital writes skipped: 322
- Patch P95: ~0.7 ms
- Patch P99: ~2.5 ms
- Max patch observed: ~5.1 ms
- Harness frame P95/P99: 16.67 / 16.67 ms, 0 jank frames in this focused run.

These are sandbox/harness measurements, not a claim that every player device will always hold exactly 60 FPS. The production scene keeps adaptive HIGH/MEDIUM/LOW degradation for slower hardware.

## Combat regression
- 99 Pow / 396 canonical actions executed.
- 396/396 executed, 0 invalid BattleCore states.
- 11/11 utility-mechanic assertions PASS.
- 8/8 KO / reserve / PvP lifecycle cases PASS.
- 80/80 automated 5v5 stress battles completed, 0 soft-lock.
- 18.5.1 visual-feedback behavior retained.

## Browser / lifecycle regression
- Player boot: 86 production modules.
- Admin: 15/15 pages.
- No page errors or console errors in final browser smoke.
- Mobile Combat scene: no horizontal overflow.
- Long-session: 270 navigation changes + 100 modal cycles + 12 PowBall cycles.
- DOM node delta: -1.
- Active interval: 0; active rAF: 0 after settling.
- Heap in harness: ~30 MB at final settle.

## Static / build integrity
- JavaScript syntax: 103/103 PASS.
- checkJs direct missing/scope/callability categories: 0.
- Preload manifest: 1,228 unique entries / 86 scripts.
- Manifest bytes: 183,045,825.
- Manifest hash: cac18703a72c96d2.
- Missing / size mismatch / hash mismatch: 0.
- Direct client `/rpc/`: 0.
- Direct client `/rest/v1/player_saves`: 0.

## Release position
18.5.2 is a candidate build. It must not be activated as Production until the Official Release Gate's real deployment evidence is complete (HTTPS deployment/smoke, staging restore drill, and 20–50 player pilot).
