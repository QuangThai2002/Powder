# Powder 20.6.0 — Live Event Operations Hardening

20.6.0 không thêm gameplay mới. Bản này khóa quy trình vận hành sự kiện để sự kiện chưa kiểm tra không thể đi thẳng tới người chơi.

## Publish workflow
- Event mới/sửa đổi được lưu vào `event_ops_drafts_v2060`, không ghi trực tiếp vào runtime event.
- Workflow bắt buộc: **Draft → Dry-run PASS → Submit → Owner Approve → Publish**.
- API `save/toggle/delete` cũ trên Admin Event Edge bị khóa fail-closed.
- Event live cũ phải `Import Live → Draft` trước khi sửa.
- Owner có Pause khẩn cấp và Rollback transactional.
- Publish receipt khóa theo `(draft_id, revision)` để retry không publish hai lần.

## Cohort / eligibility
- `all`: mọi người chơi đủ Rank.
- `pilot`: chỉ Real Pilot cohort active.
- `percentage`: cohort deterministic theo user UUID + salt.
- `explicit`: danh sách UUID cụ thể.
- Hỗ trợ exclude UUID.
- Eligibility được kiểm tra trong state, mission claim, completion claim, shop, combat start và Event Quiz eligibility.

## Reward safety
Dry-run tính reward exposure tối đa/người gồm completion + mission rewards + shop reward × limit, rồi so với policy cap server.

Policy mặc định:
- max duration: 45 ngày;
- max shop limit: 20 lần/món/người;
- có cap tổng cho Coin, Knowledge, Candy, Ticket, Element Coin, PowBall, item, equipment và artifact.

## Event Shop concurrency fix
20.6 sửa race condition của Event Shop bằng `pg_advisory_xact_lock(user + event + shopKey)` trước khi kiểm limit. Hai request đồng thời không thể cùng vượt limit.

## Release status
`official=false`. Gameplay Freeze tiếp tục được giữ nguyên. Production release channel không được activate bởi build này.
