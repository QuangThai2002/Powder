# Powder 20.17.0 — Player Save Integrity Final

20.17 hoàn thiện lớp bảo vệ save trước Release Candidate. Bản này không thêm gameplay mới.

## Mới
- Server-side save SHA-256 + integrity summary.
- Revision snapshot history.
- Chặn revision/schema/saveVersion downgrade và branch wipe rõ ràng.
- Phát hiện same-revision hash drift / stale-device commit.
- Player import guard + integrity envelope.
- Authoritative Save Integrity scan và Admin incident console.
- Hard gate `playerSaveIntegrityFinal` trong Official Launch.

## Giữ nguyên
- Combat/gameplay freeze.
- Reliability pending-sync/read-only.
- Transaction/Anti-Abuse/Reconciliation/DR/Security hardening.

## Production state
`official=false`. Production chỉ READY sau khi migration/Edge Function thật được deploy, authoritative scan sạch và gate được Owner+AAL2 ARM.
