# Powder 20.15.0 — Disaster Recovery & Backup Validation Guide

## 1. Nguyên tắc an toàn
Không bao giờ chạy restore drill vào production database. Runner 20.15 yêu cầu source DB và restore DB khác fingerprint và chỉ chạy restore khi operator đặt `POWDER_ALLOW_DR_RESTORE=1`.

Source database chỉ được dùng cho `pg_dump` và các truy vấn SELECT/digest. Forced failure/write drill chỉ chạy trên restore DB cô lập.

## 2. Chuẩn bị
Cần có:
- `pg_dump`, `pg_restore`, `psql` tương thích PostgreSQL đang dùng.
- `POWDER_SOURCE_DATABASE_URL`: source cần kiểm chứng.
- `POWDER_RESTORE_DATABASE_URL`: database cô lập có thể bị `--clean` schema `public`.
- `POWDER_ROLLBACK_BUILD_ID`: build rollback đã pin, phải khác 20.15 candidate.
- `POWDER_ROLLBACK_EVIDENCE_SHA256`: SHA-256 từ rollback drill/deployment evidence.
- `POWDER_DR_EVIDENCE_TOKEN`: secret ingest chỉ dùng bên ngoài browser.
- `POWDER_SUPABASE_URL`: URL Edge Function evidence.

## 3. Chạy self-test harness
```bash
node tools/powder-disaster-recovery-runner-v20150.mjs --self-test
```
Self-test chỉ kiểm runner/evidence contract, không phải Real Restore Evidence.

## 4. Chạy isolated restore drill
```bash
POWDER_ALLOW_DR_RESTORE=1 \
POWDER_SOURCE_DATABASE_URL='postgresql://SOURCE' \
POWDER_RESTORE_DATABASE_URL='postgresql://ISOLATED_RESTORE' \
POWDER_ROLLBACK_BUILD_ID='powder-20.14.0-production-load-soak-testing' \
POWDER_ROLLBACK_EVIDENCE_SHA256='<64 hex>' \
POWDER_DR_EVIDENCE_TOKEN='<secret>' \
POWDER_SUPABASE_URL='https://<project>.supabase.co' \
node tools/powder-disaster-recovery-runner-v20150.mjs --submit
```

Runner thực hiện:
1. fingerprint source/restore và từ chối nếu giống nhau;
2. `pg_dump --format=custom --schema=public` từ source;
3. SHA-256 + size backup artifact;
4. restore schema `public` vào isolated DB;
5. schema fingerprint source ↔ restore;
6. digest + row count 12 bảng trọng yếu;
7. post-restore smoke;
8. forced transaction failure/rollback drill trên restore;
9. xác minh rollback build registry;
10. SHA-256 evidence rồi submit.

## 5. Server PASS criteria
Production mặc định yêu cầu:
- DR Gate đã ARM bởi Owner;
- evidence không quá 7 ngày;
- source != restore;
- sourceReadOnly = true;
- RPO ≤ 360 phút;
- RTO ≤ 60 phút;
- schema digest match;
- 12/12 table digest + row count match;
- Cloud Save/Economy/Pow/Inventory/Transaction smoke PASS;
- forced failure rollback + recovery PASS;
- rollback evidence hợp lệ;
- Recovery 20.4 technical baseline PASS.

## 6. Không làm
- Không dùng cùng một DB cho source và restore.
- Không chạy `pg_restore --clean` lên production.
- Không đặt SHA giả để ép PASS.
- Không coi `--self-test` là Real Restore Evidence.
- Không tắt gate để bỏ qua DR trước canary.
