# Powder 18.6.2 — Final Release Checklist

## Build gate

- [x] Version metadata = 18.6.2
- [x] Build ID = `powder-18.6.2-server-combat-reward-authority`
- [x] Service Worker/cache = 18.6.2 / 18620 / v1862
- [x] index.html loads boot-loader v1862
- [x] Admin live labels/default build fields = 18.6.2
- [x] Server Combat client bridge loaded in production script order
- [x] 1,231/1,231 preload entries unique
- [x] Preload missing = 0
- [x] Preload hash mismatch = 0
- [x] Preload size mismatch = 0
- [x] Manifest hash = `ca6843cf207f471f`
- [x] Total preload bytes = 183,102,111
- [x] 106/106 JS syntax PASS
- [x] Critical direct checkJs groups = 0
- [x] HTML/CSS direct ref and duplicate-ID gate PASS

## Server authority gate

- [x] `powder-combat-v1862` Edge requires valid JWT
- [x] Device revoke guard enabled
- [x] Server rate guard enabled
- [x] Server Combat RPC EXECUTE: service_role only
- [x] Client action payload excludes damage/HP/winner/reward
- [x] Server owns player/enemy HP and action ledger
- [x] Enemy response is server resolved
- [x] Scene does not simulate a second local enemy action
- [x] Server reserve promotion mirrors into client scene
- [x] Event Combat winner/progress written server-side
- [x] Legacy Event `win=true` remains blocked
- [x] Boss reward remains fail-closed
- [x] Boss Player server bridge remains disabled until Boss 2.0 mechanic + qualification parity
- [x] Promotion Boss remains under Rank Authority
- [x] QA sessions left in production DB = 0

## Combat regression

- [x] 99 Pow / 396 actions executed
- [x] Dead actions = 0
- [x] Empty targets = 0
- [x] Invalid BattleCore state = 0
- [x] Lifecycle 8/8 PASS
- [x] 80/80 5v5 stress finished; 0 soft-lock
- [x] Boss Combat 2.0 mechanic assertions PASS
- [x] Boss stress 80/80; 0 exception/invalid/soft-lock
- [x] Boss phase-cancel cleanup PASS

## Browser/performance

- [x] Player 89 production modules booted
- [x] Player page/console error = 0
- [x] Player horizontal overflow = false
- [x] Admin 15/15 pages PASS
- [x] Admin page/console error = 0
- [x] Boss reaction HUD mobile smoke PASS
- [x] Long session 270 nav + 100 modal + 12 PowBall
- [x] DOM delta = -1
- [x] Active intervals after settle = 0
- [x] Active rAF after settle = 0
- [x] PowBall animation/timing unchanged

## Security/static

- [x] Direct client `/rpc/` = 0
- [x] Direct client `/rest/v1/player_saves` = 0
- [x] Service Worker `ignoreSearch:true` = 0
- [x] No stale v1861 boot/rank/scene refs in live runtime

## Required post-deploy checks — intentionally not fabricated

- [ ] Production HTTPS domain configured
- [ ] Auth redirect verified on real HTTPS origin
- [ ] Real Event Server Combat with authenticated account end-to-end
- [ ] Disconnect/reconnect during Server Combat action flow
- [ ] Multi-device same-account consistency
- [ ] Server load/concurrency pilot
- [ ] 20–50 real-user pilot
- [ ] Backup/restore staging drill
- [ ] Server qualification parity for Daily/Weekly Boss
- [ ] Server mechanic parity for all Boss Combat 2.0 reaction windows

## Go / No-Go

Do not activate production from this candidate until Official Release Gate passes real deployment checks. Do not weaken Boss reward qualification or accept client winner/damage merely to make the gate pass.
