# Final Release Checklist — 19.4.0

- [ ] Automated JS/CSS/manifest gate PASS
- [ ] 99 Pow / 396 skill / identity gate PASS
- [ ] Recovery Drill PASS trên ít nhất 1 thiết bị
- [ ] PvP server smoke PASS khi Online
- [ ] PvP 2 thiết bị ≥10 trận
- [ ] Reconnect/AFK/9 Domain/mobile/soak evidence đủ
- [ ] Pilot 20–50 người thật
- [ ] Server load/concurrency thật
- [ ] Rollback + Cloud Save recovery thật (manual + evidence)
- [ ] Release Seal 19.4.0 khớp manifest hash

`official=false` cho tới khi toàn bộ mục trên hoàn tất.
## Automated build verification

- [x] 121/121 JavaScript syntax
- [x] Service Worker syntax
- [x] 26 CSS structural check
- [x] 1245/1245 preload manifest size/hash
- [x] 99 Pow / 396 fixed unique skills
- [x] 99 Combat Identity / 10 Sát thủ
- [x] 22 critical gameplay files unchanged vs 19.3.0
- [x] Recovery round-trip/hash unit regression
- [x] Server smoke sequential-state unit regression
- [x] Release seal invalidates on manifest mismatch
- [ ] Pilot 20–50 người thật
- [ ] Real server load/concurrency
- [ ] Real rollback + Cloud Save recovery
