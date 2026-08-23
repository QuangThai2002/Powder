# Final Release Checklist — Powder 21.0.3

## Artifact QA
- [x] Release metadata 21.0.3 đúng build ID.
- [x] 22/22 gameplay critical file byte-identical.
- [x] Manifest 1,275 entries đúng hash.
- [x] Boot order 119 module đúng lineage.
- [x] Live SLO Gate 16/16 PASS.
- [x] Live SLO Runtime 8/8 PASS.
- [x] Final Gate 25/25 PASS.
- [x] Full Game/Transaction/Reconciliation/Security/Save regressions PASS.
- [x] Service Worker ↔ boot-loader cùng build 21.0.3.

## Production evidence — không giả lập trong artifact
- [ ] Migration 21.0.3 đã apply production.
- [ ] `powder-admin-live-slo` đã deploy.
- [ ] Observability ingest đúng build 21.0.3.
- [ ] Owner + AAL2 đã ARM SLO Guard.
- [ ] SLO snapshot production mới nhất PASS.
- [ ] Error budget 30d ≥ 25%.
- [ ] Fast burn ≤ 4×; slow burn ≤ 2×.
- [ ] P95/P99 trong SLO.
- [ ] Critical/High SLO incident = 0.
- [ ] Release/hotfix workflow gọi `powder_live_slo_assert_release_allowed_v21003`.

`official=false` tiếp tục được giữ cho tới khi production evidence thật đủ điều kiện.
