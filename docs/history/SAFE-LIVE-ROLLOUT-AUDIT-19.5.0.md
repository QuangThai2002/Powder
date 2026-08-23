# Safe Live Rollout Audit — 19.5.0

## Invariants
1. Combat gameplay frozen: critical Combat/PvP/Boss/Domain files phải byte-identical với 19.4.0.
2. Rollout mặc định không làm thay hành vi production: 100% + normal.
3. Minimum client version luôn ưu tiên hơn canary.
4. Cohort deterministic theo device + salt.
5. Emergency Stop cập nhật cả v19.5 emergency state và legacy hard maintenance.
6. Production Emergency/rollback target/rollback real chỉ Owner.
7. Rollback real chỉ dùng explicit target có SHA-256, không tự chọn target khác UI.
8. Release seal fail-closed theo build/version/manifest + field proof + rollout state.

## Server audit
- `release_rollout_v1950`: RLS ON, direct anon/auth SELECT revoked.
- `powder_release_manifest(text)`: anon/auth EXECUTE revoked, service role granted.
- Public release Edge tiếp tục dùng service role và trả manifest no-store.
- `powder-admin-rollout` là Edge riêng để cô lập rollout controls khỏi `powder-admin-release` cũ.

## Activation policy
19.5.0 chỉ là Safe Live Rollout Gate. Không activate production build nếu pilot/load/rollback evidence chưa hoàn tất.

## Final automated regression
- JS syntax: 123/123 PASS.
- Service Worker syntax: PASS.
- CSS structural: 28/28 PASS.
- index/admin duplicate IDs: 0.
- index/admin missing local refs: 0.
- Boot manifest: 1247 entries; size/hash errors 0.
- Boot manifest hash: `5f9771bcb8d60cde`.
- Canonical roster: 99 Pow.
- Fixed skill slots: 396; unique skill IDs: 396.
- Combat identity: 99 profiles / 99 unique signatures / 10 Sát thủ.
- Canary regression: 0% excluded, 100% eligible, device cohort stable.
- Official Gate: unsealed=false; wrong manifest=false; matching 19.5 seal=true in test harness.
- Admin Seal: rollout server state required.
- Gameplay freeze compare: 22 critical files changed = 0 vs 19.4.0.
