# Powder 18.8.1 — Combat Identity cho 99 Pow

## Mục tiêu
18.8.1 hoàn tất lớp Combat Identity cho toàn bộ 99 Pow mà không đổi bộ 4 kỹ năng cố định thành kit mới và không cân bằng Pow thấp thành ngang Pow hiếm cao.

## Nâng cấp chính
- 99/99 Pow có hồ sơ identity runtime: vai trò chính, vai trò phụ, archetype, combo, điểm mạnh, điểm yếu, synergy, counter, passive/core identity và hướng tăng bản sắc theo sao.
- 99/99 identity signature là duy nhất; không có hai Pow chỉ khác tên/hệ số trong dữ liệu canonical V8.1.
- CORE_REGISTRY của Combat Mechanics tăng từ 80 explicit core lên đủ 99/99. 19 Pow trước đây phải fallback qua suy luận text nay có core explicit.
- Khôi phục role canonical PvP: 10 Pow Sát thủ. Catalog Online cũ báo 0 Sát thủ do mapping role stale.
- Pow Profile hiển thị card Bản sắc Combat.
- PvP Lobby hiển thị role chính/phụ, archetype và core; màn battle hiển thị identity của actor đang chọn.
- Edge powder-pvp 18.8.1 trả identity metadata server-authoritative và vẫn giữ Domain runtime 18.8.0.

## Quy tắc không đổi
- Basic + Skill 1 + Skill 2 + Ultimate vẫn là fixed kit.
- Sao tăng hệ số, số hit/mục tiêu/tầng/hiệu lực theo core; không thay skill ID hoặc cấp extra-turn vô hạn.
- Rarity cao vẫn có lợi thế rõ. Identity không normalize 99 Pow về cùng sức mạnh.
- PvE/Boss/9 Bành Trướng không bị viết lại trong bản này.

## Backend
- Bảng `pvp_pow_identity_v1881`: 99 rows, 99 unique signatures, 10 Sát thủ.
- RLS/revoke: anon và authenticated không đọc trực tiếp; service_role được phép.
- `pvp_pow_catalog.role` đồng bộ lại theo canonical V8.1.
- Edge `powder-pvp` version 5 ACTIVE, JWT verification bật.
