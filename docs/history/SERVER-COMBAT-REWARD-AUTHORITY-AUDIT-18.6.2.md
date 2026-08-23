# Powder 18.6.2 — Server Combat Session & Reward Authority Audit

## Phạm vi

18.6.2 đưa Event Combat Online sang mô hình server-authoritative mà không thay nền Combat local/PvE đã khóa ở 18.5.x–18.6.1.

Client Online chỉ gửi lựa chọn hành động: `sessionId`, `actorPowId`, `targetPowId`, `skillSlot`. Client không gửi damage, HP, crit, winner hoặc reward.

## Server Combat authority

Backend mới sử dụng các bảng authority riêng:

- `server_combat_sessions_v1862`
- `server_combat_units_v1862`
- `server_combat_events_v1862`
- `server_boss_qualifications_v1862`

RPC authority:

- `powder_sc_start_event_v1862`
- `powder_sc_start_boss_v1862`
- `powder_sc_state_v1862`
- `powder_sc_action_v1862`
- `powder_sc_forfeit_v1862`

Các RPC trên không cấp EXECUTE cho `anon` hoặc `authenticated`; chỉ `service_role` được phép gọi. Player đi qua Edge Function `powder-combat-v1862` có JWT, account/device guard và rate guard.

## Event Combat Online

Event Combat có mission Combat được bật Player bridge 18.6.2:

1. Đồng bộ team lên Cloud Server.
2. Server tạo session và dựng unit từ Pow thực sự thuộc tài khoản.
3. Client chọn actor + skill + target.
4. Server tính HP/damage/heal/shield/status/energy/cooldown.
5. Cùng transaction, server xử lý phản công của địch.
6. Server ghi event ledger cho cả hai phía.
7. Client chỉ replay ledger để trình diễn và đồng bộ state server.
8. Khi toàn bộ enemy bị hạ, server chuyển session sang `win` và cập nhật Event progress server-side.

Legacy Event RPC tiếp tục từ chối `win=true` từ client.

## Client bridge hardening

Đã sửa một regression trong quá trình tích hợp: bản bridge ban đầu để server xử lý phản công rồi scene còn mô phỏng thêm enemy action local. Bản final không còn hành vi này.

Trong Server Combat:

- local `BattleCore.performAction()` không được dùng làm authority cho action player;
- không chạy enemy action local lần thứ hai;
- damage/heal/crit/status presentation được dựng từ `server_combat_events_v1862`;
- HP/energy/cooldown/status được reconcile từ server state;
- reserve promotion do server quyết định và được mirror về local scene;
- local replacement queue bị xóa trong server session;
- client `canUse()` chỉ là UX preview, server vẫn là gate cuối.

Server bridge QA xác nhận payload `act` chỉ chứa:

```text
action
sessionId
actorPowId
targetPowId
skillSlot
```

Forbidden fields kiểm tra: `win`, `damage`, `reward`, `hp`, `crit` = 0.

## Boss authority — fail-closed, không làm regression Boss 2.0

Backend 18.6.2 đã có Boss session foundation và qualification table. Tuy nhiên Player bridge Daily/Weekly Boss **không được bật ở bản final** vì hai phần chưa đạt parity:

1. bốn mechanic reaction-window của Boss Combat 2.0 18.6.1 chưa được mô phỏng đầy đủ trên Server Combat;
2. qualification câu hỏi Daily/Weekly chưa phải server-authoritative hoàn chỉnh.

Do đó 18.6.2 chọn an toàn thay vì hạ chất lượng hoặc mở lỗ hổng:

- Daily/Weekly Player vẫn giữ Boss Combat 2.0 local mechanics;
- thắng local trong tài khoản Online không được cấp reward;
- Boss server foundation vẫn tồn tại để phát triển parity tiếp theo;
- `bossPlayerReady()` trả `false` và `rewardFailClosed=true`;
- Promotion Boss tiếp tục dùng Rank Authority hiện hữu.

Không có fallback từ local `win=true` sang reward Online.

## Backend QA

Transaction QA của Server Combat đã chạy và rollback sạch:

- tạo session: PASS;
- actor/target lấy từ state server: PASS;
- player action: PASS;
- enemy server response: PASS;
- action/event ledger tăng đúng: PASS;
- forfeit: PASS;
- QA session còn lại sau rollback: 0.

Một lỗi PL/pgSQL ambiguous variable `statuses` đã được QA bắt và sửa trước khi phát hành candidate.

RPC permission final:

- anon execute: false;
- authenticated execute: false;
- service_role execute: true.

## Combat regression

### 99 Pow / 396 action

- Pow: 99
- expected slots: 396
- executed: 396
- exceptions: 0
- unavailable sai: 0
- empty targets: 0
- invalid state: 0
- dead/no-effect action: 0

Action classes:

- offense: 171
- hybrid: 97
- support: 109
- enemy-utility: 16
- dual-mode: 3

### Lifecycle / 5v5 stress

- lifecycle cases: 8/8 PASS
- battles: 80
- finished: 80/80
- exceptions: 0
- invalid state: 0
- soft-lock: 0
- capped: 0
- max actions: 76
- avg actions: 24.9

### Boss Combat 2.0 regression

- Boss mechanic validation: PASS
- Daily/Story cleanse windows: PASS
- Promotion/Weekly shield-break: PASS
- Weekly failed-window resolve: PASS
- Enrage: PASS
- phase-cancel cleanup: PASS

Boss stress:

- 80/80 finished
- exceptions: 0
- invalid: 0
- soft-locks: 0
- mechanic arms: 191
- interrupted: 20
- cleansed: 18
- resolved: 105
- enrage: 48

## Browser / long-session

Player smoke:

- production modules: 89
- `POWDER_APP`: ready
- app version: 18.6.2
- page errors: 0
- console errors: 0
- horizontal overflow: false
- save validation errors: 0

Admin:

- scripts: 16
- pages: 15/15 visible exactly one at a time
- Combat Lab present
- overflow: false
- page/console errors: 0

Long-session:

- nav clicks: 270
- modal cycles: 100
- PowBall cycles: 12
- DOM delta: -1
- active intervals after settle: 0
- active rAF after settle: 0
- heap in harness: ~28 MB
- page/console errors: 0

PowBall timing/easing/FX không thay đổi.

## Static / integrity

- JavaScript syntax: 106/106 PASS
- `checkJs` critical direct groups TS2304/2552/2451/2448/2449/2349: 0
- HTML local direct refs: 64, missing 0
- duplicate HTML IDs: 0
- CSS files: 17, delimiter errors 0
- direct client `/rpc/`: 0
- direct client `/rest/v1/player_saves`: 0
- Service Worker `ignoreSearch:true`: 0

Preload final:

- entries: 1,231
- unique: 1,231
- production script order: 89
- missing: 0
- hash/size mismatch: 0
- total bytes: 183,102,111
- manifest hash: `ca6843cf207f471f`

## Hạn chế môi trường / release

Không đánh dấu real HTTPS smoke là PASS trong sandbox. Domain/Auth redirect, real multi-device/pilot và production rollout vẫn thuộc Official Release Gate.

18.6.2 phải được đăng ký ở trạng thái `candidate`; không tự activate Production.
