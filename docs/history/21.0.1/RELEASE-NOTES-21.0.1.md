# Powder 21.0.1 — Launch Stabilization & Post-Launch Guardrails

Patch ổn định sau 21.0.0. Không thay đổi gameplay/combat.

## Thay đổi
- Post-launch server health evidence riêng cho 21.0.1.
- Guardrail mặc định DISARMED; Owner+AAL2 mới được ARM.
- Khi đã ARM, health vượt ngưỡng có thể tự chuyển rollout sang `halt`.
- Không có automatic rollback hoặc automatic resource/save mutation.
- Resume fail-closed: cần health evidence mới nhất PASS và không còn Critical/High incident.
- Binding theo build ID, manifest hash, artifact SHA-256 và rollback target 21.0.0.
- Admin Launch Stabilization panel hiển thị health, incident, HOLD/RESUME và rollback target.
- Server/CI là nguồn duy nhất có thể ghi health evidence; Admin không có API nhập tay error/P95/crash để tự PASS.
- Boot/cache được nâng lên 21.0.1; 21.0.0 loader được chuyển vào history.

## Ngưỡng mặc định
- Sample ≥ 1,000
- Error rate ≤ 1%
- P95 ≤ 1,500 ms
- P99 ≤ 2,500 ms
- Crash rate ≤ 0.3%
- Save conflict = 0
- Transaction blocker = 0
- Critical/High incident = 0
- Reliability = normal / circuit closed

`official=false` vẫn được giữ. Đây là artifact readiness; health production thật phải do deployment/CI cung cấp.
