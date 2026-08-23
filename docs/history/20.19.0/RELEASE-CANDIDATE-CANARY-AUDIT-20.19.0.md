# Powder 20.19.0 — Release Candidate / Canary Audit

- Gameplay/combat: freeze 22/22 critical files.
- RC evidence: build + manifest + artifact SHA-256 bound.
- Manual smoke: 13 mục, không có default PASS.
- Rollback drill: service evidence, target build thật, ≤600s, data integrity + health bắt buộc.
- Stage health: server-derived only; manual health endpoint trả 410.
- Stage thresholds tăng dần 5% → 20% → 50% → 100%.
- Advance chỉ dùng `release_canary_stage_evidence_v20190` PASS mới và đúng manifest.
- Stage timer reset khi advance; Finalize yêu cầu health 100% PASS.
- Owner + AAL2 vẫn được áp bởi Security Contract 20.16.
- Production vẫn fail-closed khi thiếu evidence thật.
