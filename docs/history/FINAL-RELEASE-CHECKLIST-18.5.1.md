# Powder 18.5.1 — Final Release Checklist

## Combat Visual Feedback
- [x] Damage number rendered on the actual impacted Pow.
- [x] Critical hit explicitly labeled and visually distinguished.
- [x] Evade does not display fake zero damage.
- [x] Full shield block displays block feedback instead of fake zero damage.
- [x] Shield gained displays a positive shield value.
- [x] Shield absorbed displays an absorbed shield value.
- [x] Heal feedback remains target-local and supports per-target exact values.
- [x] Heal reaction uses compositor-only motion.
- [x] Shield reaction uses compositor-only motion.
- [x] Hard CC / lost turn has visible lock + reaction.
- [x] Reserve replacement has visible entry reaction.
- [x] Existing source→target trace preserved.
- [x] Existing Ultimate / Exclusive presentation preserved.

## Performance
- [x] LOW tier suppresses decorative FX before informative FX.
- [x] MEDIUM tier reduces decoration before LOW.
- [x] Damage / heal / shield / CC information survives LOW tier.
- [x] Hit-stop reduced under frame pressure.
- [x] No new per-unit rAF loop.
- [x] Long-session active interval = 0 after settle.
- [x] Long-session active rAF = 0 after settle.

## Core Regression
- [x] 396 / 396 actions execute.
- [x] 0 dead actions.
- [x] 11 / 11 utility mechanics pass.
- [x] 80 / 80 automated 5v5 battles finish.
- [x] 0 Combat soft-locks.

## Build Integrity
- [x] 103 / 103 JS syntax PASS.
- [x] 86 production scripts in order.
- [x] 1,228 preload entries unique.
- [x] 0 missing preload files.
- [x] 0 preload size mismatch.
- [x] 0 preload hash mismatch.
- [x] 0 direct client `/rpc/`.
- [x] 0 direct client REST write to `player_saves`.
- [x] Player browser smoke PASS.
- [x] Admin 15 / 15 page smoke PASS.
- [x] Battle scene 18.5.1 smoke PASS.
- [ ] HTTPS production-domain smoke — requires real deployed URL.
- [ ] Staging restore drill — requires staging deployment.
- [ ] Pilot 20–50 real users — requires external pilot.

## Release policy
- [x] Build may be registered only as candidate.
- [x] Production pointer must not be automatically activated.
