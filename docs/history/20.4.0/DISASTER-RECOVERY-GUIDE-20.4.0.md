# Powder 20.4.0 — Disaster Recovery Operations Guide

## 1. Local Recovery
Mở `index.html?recovery=1`.

Các thao tác:
- Checkpoint: tạo local full backup khi ở Offline và save health hợp lệ.
- Local Drill: serialize Cloud Bundle, ghi bản sao tạm, parse, SHA-256 round-trip và xóa bản tạm. Không restore đè save.
- Server Smoke: tối đa 6 request `powder-pvp state`, chỉ khi người dùng bấm.
- Export Evidence: xuất JSON có SHA-256 evidence.

## 2. Server Sandbox Restore
Admin → Reliability/Ops → Disaster Recovery → **Run Sandbox Restore**.

Drill dùng bảng sandbox riêng, mutate payload test rồi restore payload gốc, so hash và cleanup. Không dùng Player Save/Inventory/Economy thật.

## 3. Real Restore Drill bắt buộc cho Production
Thực hiện restore một backup thật trên môi trường cô lập/staging restore, sau đó kiểm tra:
- schema tương thích;
- Cloud Save load/commit conflict contract;
- Economy đúng;
- Pow roster/progression đúng;
- Inventory/Equipment/Artifact đúng;
- rollback/relaunch đúng.

Chuẩn bị:
- Backup provider + Backup ID.
- SHA-256 của backup artifact.
- SHA-256 của evidence bundle/log.
- Backup created time.
- Incident/cutoff time.
- Restore start/end time.
- Restore environment.

Owner nhập metadata vào **Record Real Restore Evidence**. Server tự tính:
- RPO = incident time − backup creation time.
- RTO = restore completion − restore start.

Production PASS mặc định yêu cầu RPO ≤ 360 phút, RTO ≤ 60 phút, tất cả verification flags = true và evidence không quá 7 ngày.

## 4. Không làm
- Không dùng sandbox drill để tuyên bố full DB restore PASS.
- Không restore database production chỉ để test.
- Không tắt `require_real_restore` trên production để lách release gate.
- Không cập nhật schema baseline nếu chưa review migration tác động tới save/restore.
