# Powder 18.5.0 — Combat Core Experience Audit

## Scope
18.5.0 upgrades the existing Combat V7/V9 stack without replacing the architecture or changing Powder's fixed-kit rule. Every Pow keeps Basic + Skill 1 + Skill 2 + Ultimate; star progression strengthens the same kit rather than swapping skills.

## Canonical action runtime
- Production boot now loads `js/canonical-action-runtime-v1850.js`.
- Obsolete `canonical-action-runtime-v18.js` was removed from the build.
- 99 Pow / 396 action slots classified and executed.
- Classes: 171 offense, 97 hybrid, 109 support, 16 enemy-utility, 3 dual-mode.
- 0 undefined action classes, 0 unavailable actions, 0 empty target sets, 0 dead/no-effect actions, 0 invalid BattleCore states.
- Extended targeting covers enemy, two-enemies, all-enemies, front-row, ally, self, self-and-ally/self-and-lowest-ally, two-allies, three-allies, team and enemy-or-ally.
- Dual-mode Basic actions for Solarion, Verdantis and Luxarion correctly resolve offense vs enemy and heal vs ally according to the selected target.

## Utility mechanics
11/11 focused mechanic assertions PASS:
1. Gearbit protection split + resource.
2. Aegiscarab protection split + resource.
3. Budtail two-ally direct damage reduction.
4. Ashmane lifesteal + damage reduction.
5. Steelpaw shield redistribution preserves total shield.
6. Verdantusk backline damage reduction + once-per-round Growth.
7. Venomtail damage reduction + attacker accuracy down + Poison.
8. Umbrael first-hit reduction + same-hit debuff block.
9. Zephyrion first-hit reduction + survive turn-meter gain.
10. Zephyroo leader meter + 18/10 chain behavior.
11. Torrento next-Basic assist exactly once + resource.

## Reaction event bus
The Combat V9 damage override now emits the canonical reaction/mechanic events needed by passives, including damage-taken/ally-damage style reactions. This restores reactive passives that had valid data but previously could fail to trigger from normal hits.

## KO / reserve / end-battle lifecycle
8/8 focused lifecycle cases PASS:
- single KO queues and valid reserve replacement;
- invalid slot/reserve/side replacement rejected;
- multiple KOs with fewer reserves do not soft-lock;
- PvE enemy reserve auto-replacement;
- full enemy defeat -> win;
- full player defeat -> loss;
- simultaneous PvP KO -> draw;
- PvP AFK 3 strikes -> loss, surrender/recovery grace behavior valid.

Stress: 80 complete 5v5 PvE battles -> 80/80 terminal results, 0 exceptions, 0 invalid state, 0 soft-lock, 0 action-cap stalls. Longest sampled battle 103 actions; replay remained below the 1,200-event cap.

## Production boot and preload
- Version: 18.5.0.
- Build ID: `powder-18.5.0-combat-core-experience`.
- Boot loader: `boot-loader-v1850.js`.
- Rank Authority: `rank-authority-v1850.js`.
- Service Worker/cache namespace: 18.5.0 / `powder-assets-v1850`.
- Preload: 1,228 unique entries, 86 scripts.
- Total preload bytes: 183,033,193.
- Manifest hash: `72f3d57a44d70898`.
- 0 missing files, 0 size mismatches, 0 content-hash mismatches, 0 script-order missing paths.
- No active reference remains to `boot-loader-v1840`, `rank-authority-v1840.js` or `canonical-action-runtime-v18.js`.

## Static / browser regression
- JavaScript syntax: 103/103 PASS.
- `tsc --allowJs --checkJs`: 0 direct TS2304/TS2552/TS2451/TS2448/TS2449/TS2349 errors. Remaining diagnostics are plain-JS/custom-window typing debt, not new direct scope/callability failures.
- Duplicate HTML IDs: 0 in Player and Admin.
- CSS delimiter sanity: 17/17 files PASS.
- Local HTML asset refs missing: 0.
- Direct client `/rpc/`: 0.
- Direct client `/rest/v1/player_saves`: 0.
- Player browser harness: 86 modules, version 18.5.0, 0 page errors, 0 console errors, no horizontal overflow, save validation clean.
- Admin harness: 15/15 pages, 0 page errors, 0 console errors, no horizontal overflow.
- Warm long-session: 270 navigation clicks + 100 modal cycles + 12 PowBall cycles; DOM delta -1, interval 0, rAF 0, heap about 30 MB, no page/console errors.

## Navigation limitation of this sandbox
Chromium navigation to both localhost HTTP and a routed fake HTTPS origin is blocked by the environment with `ERR_BLOCKED_BY_ADMINISTRATOR`. Therefore a real deployed-HTTPS navigation smoke is intentionally NOT marked PASS here. Runtime coverage uses the same production SCRIPT_ORDER with real source modules injected into Chromium, while the final deployed HTTPS smoke remains a release-gate item.

## Verdict
Combat Core Experience 18.5.0 passes the local/static/runtime Combat gates and is suitable to register as a release candidate. Do not activate Production until the Official Release Gate's real HTTPS / restore / pilot requirements pass.
