# Final Release Checklist — Powder 18.8.1

## Identity gate
- [x] 99/99 Pow có identity profile.
- [x] 99/99 identity signature duy nhất.
- [x] CORE_REGISTRY explicit 99/99, missing 0.
- [x] 10 Pow Sát thủ canonical ở local và server.
- [x] 396/396 fixed skill IDs duy nhất sau khi starter runtime được nạp.
- [x] Stars không thay 4 skill ID; chỉ tăng bản sắc/hệ số theo progression.

## Regression gate
- [x] 108 JS files: syntax PASS.
- [x] Service Worker syntax PASS.
- [x] 19 CSS files: brace structural PASS.
- [x] HTML duplicate IDs: 0.
- [x] Missing local references: 0.
- [x] Boot manifest: 1,235 entries, size/hash PASS.
- [x] Script order: identity sau role-system, trước combat-mechanics; PvP v1881 được nạp.
- [x] 13 combat/PvE critical files giữ checksum y hệt 18.8.0.
- [x] `combat-mechanics-v17.js` chỉ thay CORE_AUDIT_VERSION và merge 19 explicit identity cores; damage/Boss/Domain formulas không bị viết lại.
- [x] Edge TypeScript transpile errors: 0.

## Server gate
- [x] `pvp_pow_identity_v1881`: 99 rows.
- [x] Unique signatures: 99.
- [x] Sát thủ: 10.
- [x] `anon` SELECT: false.
- [x] `authenticated` SELECT: false.
- [x] `service_role` SELECT: true.
- [x] Edge `powder-pvp` version 5 ACTIVE, verify_jwt=true.

## Field testing còn phải làm trước Production Ready
- [ ] Test 2 tài khoản thật với các đội có Sát thủ để xác nhận UI/role/identity payload trong PvP.
- [ ] Pilot đa dạng archetype để thu win-rate/pick-rate; đây thuộc balance telemetry, không chặn build 18.8.1.
