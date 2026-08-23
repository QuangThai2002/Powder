# Powder 18.7.0 — Final Release Checklist

## Build / static

- [x] Version metadata = 18.7.0.
- [x] Build ID = `powder-18.7.0-pvp-online-2`.
- [x] Service Worker/cache = 18.7.0 / 18700 / v1870.
- [x] New PvP JS/CSS included by boot loader.
- [x] 107 Player JS files pass `node --check`.
- [x] 1,233 preload manifest entries match file size + SHA-256 prefix.
- [x] No duplicate IDs / missing local refs in `index.html` and `admin.html`.
- [x] Main/PvP/boot CSS structural brace check passes.
- [x] No direct RPC bypass in Player PvP module.
- [x] Edge TypeScript structural compile passes with Deno/Supabase type stubs.

## Server

- [x] Migration `pvp_online_2_v1870` applied.
- [x] `pvp_action_receipts_v1870` exists.
- [x] `powder_pvp_action_v1870` direct execute blocked for anon/authenticated.
- [x] `powder_pvp_rematch_v1870` direct execute blocked for anon/authenticated.
- [x] service_role retains execute for Edge.
- [x] PvP result + turn clock + AFK reset triggers remain installed.
- [x] `powder-pvp` Edge deployed ACTIVE version 3, JWT verification enabled.

## PvP Online 2.0 features

- [x] Server timer UI.
- [x] Reconnect exact live match.
- [x] Network loss does not reset client battle state.
- [x] AFK strike UI.
- [x] 3 active + 2 reserve server slots.
- [x] Explicit actor/target selection.
- [x] Surrender.
- [x] Rematch.
- [x] Server battle result.
- [x] Match history.
- [x] Event log + full replay viewer.
- [x] Idempotent action receipt.
- [x] Expected-turn stale-state rejection.

## Manual gates before calling 18.7.0 field-tested

- [ ] Two real accounts complete 10+ PvP matches across two physical devices/browsers.
- [ ] Unplug/reconnect network before and after 45s turn boundary.
- [ ] Validate all 3 AFK strikes and 90s disconnect defeat UX with two users.
- [ ] Spam-click/retry the same action under artificial packet loss and verify one server event only.
- [ ] Verify rematch invitation flow from both winner and loser.
- [ ] Replay several completed matches and compare event ledger to final state.
- [ ] Mobile touch/layout pass on narrow viewport.
- [ ] Full browser preload smoke gate: automated headless attempt timed out while loading the ~183 MB full asset preload, so this is deliberately not marked PASS.

18.7.0 is ready for focused PvP testing, but **Production Ready** remains reserved for the 19.0.0 gate in the roadmap.
