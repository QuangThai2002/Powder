# Powder 20.10.0 — Server Mutation Integration & Reconciliation Drill

20.10.0 đưa Data Integrity 20.9 xuống một lớp mutation gateway có khả năng thực thi canonical business handler trong cùng PostgreSQL transaction với transaction receipt và effect receipt.

### Mới
- Mutation Gateway authenticated cho player.
- 18 contract Economy/Inventory/Reward/Mail/Event/Purchase.
- Atomic execution + advisory lock + request hash binding.
- Deterministic commit proof bằng effect receipt.
- Recovery/reconciliation không blind replay.
- Chaos drill kiểm duplicate transaction và forced rollback.
- Admin Mutation & Recovery console.
- Official Launch hard gate `serverMutationIntegration`.
- Client gateway integration cho Economy, Inventory, Mail/Daily và Learning Event.

### An toàn tương thích
Client mặc định `prefer`: nếu contract chưa được triển khai thật, chỉ lỗi “contract not ready” mới quay về endpoint legacy. Lỗi mạng không rõ kết quả sẽ giữ nguyên txKey và không chuyển sang đường khác.

### Trạng thái production
`official=false`. 18 canonical handler required vẫn DISABLED vì source business production tương ứng không có trong repository. Do đó Official Server Preflight phải HOLD cho tới khi handler thật được triển khai, recovery queue sạch và chaos drill PASS.

### Gameplay
Không thay đổi combat, Pow, skill, balance hoặc progression critical đã freeze.
