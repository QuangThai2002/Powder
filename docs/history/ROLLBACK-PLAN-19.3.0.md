# Rollback Plan — 19.3.0

19.3.0 không thay database schema và không redeploy Edge, vì vậy rollback code chỉ cần quay static deployment về Powder 19.2.0 Official Release Gate.

- Không rollback database cho Pilot Toolkit.
- Không rollback powder-pvp; production Edge vẫn là v5.
- Xóa cache `powder-assets-v1930` nếu cần hard rollback client.
- 19.3 evidence keys (`powder_pilot1930_*`, `powder_or1930_release_seal`) là local-only và có thể xóa mà không ảnh hưởng save/gameplay.
- Field checklist kế thừa key từ 19.1/19.2 để không mất lịch sử xác nhận; khi điều tra sự cố cần export JSON trước khi reset.
