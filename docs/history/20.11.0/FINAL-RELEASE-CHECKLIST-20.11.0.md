# Final Release Checklist — Powder 20.11.0

- [x] Version/build/release state = 20.11.0 Canonical Mutation Adapters.
- [x] `official=false`.
- [x] 18/18 canonical mutation routes.
- [x] Player writes gateway-only.
- [x] Legacy mode blocked on client.
- [x] Economy queued writes retry through gateway with preserved txKey.
- [x] Ambiguous result quarantine; no blind replay.
- [x] Evidence triple enforced.
- [x] Production launch hard gate includes canonical adapters.
- [x] Boot order: Reliability → Transaction Safety → Canonical Mutation → Online.
- [x] 22/22 gameplay critical files byte-identical.
- [x] Static/runtime/regression Final Gate PASS.
- [ ] 18/18 production adapter evidence imported from real deployment.
- [ ] Direct legacy write lock proven on all four production services.
- [ ] Official Production Preflight READY.

Các mục chưa tick là điều kiện deployment thật, không được giả lập để ép `official=true`.
