# Pilot Validation — 19.1.0

Record each result in Admin → Combat Test Lab → **Pilot, Mobile & Network Readiness**. The Admin panel timestamps completed checks locally and exports one JSON report.

## 1. PvP two-device matrix

Run at least 10 completed matches using two accounts/browsers/devices. Include normal actions, target selection, reserve behavior, surrender, rematch and replay.

## 2. Network recovery

For live PvP, test both sides of the server turn timer:

- Drop network briefly before 45 seconds, reconnect, confirm exact match/turn state is restored.
- Drop network across the timeout boundary and confirm server timeout/AFK result is authoritative.
- Repeat network toggles several times and verify no duplicate action/event/reward.
- Hide the tab >=30 seconds then return; verify client refreshes server state instead of using stale local UI.

## 3. AFK/disconnect

Validate three AFK strikes and the 90-second reconnect/disconnect policy in real browsers. Verify result/history/replay all agree.

## 4. Domain matrix

Exercise all 9 Bành Trướng Online and the 3 Giản Dị. Specifically include Vô Lượng questions, Rút Kiếm server RNG and Tọa Sát Bát Đồ server RNG.

## 5. Mobile widths

Check 320, 360, 390 and 430 CSS px, portrait and at least one landscape pass. Required: no page-level horizontal scroll, Pow targets remain tappable, skill/action buttons remain usable, Domain question options remain readable.

## 6. Soak

Run one >=2h and one >=4h session. Capture readiness diagnostics before and after. Look for rising heap, increasing transient FX nodes, duplicated timers, input delay or FPS degradation.

## 7. Pilot population

Use 20–50 testers. Capture browser/device, network type, mode, match/session length, visible issue and diagnostics JSON. Do not record private conversation or unrelated personal data.

## 8. Server load / rollback

Perform a controlled concurrency test outside peak production traffic. Then execute the rollback plan and verify Cloud Save/reconnect after rollback.
