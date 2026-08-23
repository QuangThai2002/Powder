# Final Release Checklist — Powder 18.5.0

## Identity
- [x] Version 18.5.0
- [x] Build ID `powder-18.5.0-combat-core-experience`
- [x] Service Worker 18.5.0
- [x] Boot/cache namespace v1850
- [x] Production boot loads canonical action runtime v1850
- [x] Old canonical parser removed

## Combat Core
- [x] 99 Pow present
- [x] 396/396 fixed-kit action slots executed
- [x] 0 dead/no-effect actions
- [x] 0 unavailable actions
- [x] 0 empty target sets
- [x] 0 invalid BattleCore state
- [x] 3 dual-mode actions resolve by selected target
- [x] 11/11 utility mechanic assertions PASS
- [x] Reaction event bus restored for reactive passives
- [x] KO/reserve replacement validation PASS
- [x] PvE win/loss terminal states PASS
- [x] PvP draw/AFK/surrender lifecycle PASS
- [x] 80/80 5v5 stress battles terminate; 0 soft-lock

## Static / Integrity
- [x] JavaScript syntax 103/103
- [x] Direct undefined/scope/callability checkJs codes = 0
- [x] Duplicate IDs = 0
- [x] CSS sanity 17/17
- [x] Local HTML paths missing = 0
- [x] Direct client `/rpc/` = 0
- [x] Direct client `player_saves` REST = 0
- [x] Preload 1,228 unique entries
- [x] 86 production scripts
- [x] Manifest missing/size/hash mismatches = 0
- [x] Manifest hash `72f3d57a44d70898`
- [x] Total preload bytes 183,033,193

## Browser Regression
- [x] Player boot via production SCRIPT_ORDER: 0 page/console errors
- [x] Player no horizontal overflow
- [x] Player save validation clean
- [x] Admin 15/15 pages
- [x] Admin no horizontal overflow
- [x] Long-session nav/modal/PowBall lifecycle clean
- [x] interval settles to 0
- [x] rAF settles to 0
- [ ] Real deployed HTTPS navigation smoke — sandbox navigation is blocked; must run after deployment

## Release Safety
- [x] Package candidate only
- [x] Do not activate production automatically
- [ ] Official Release Gate HTTPS smoke PASS
- [ ] Official Release Gate staging restore drill PASS
- [ ] Official Release Gate pilot 20–50 PASS
