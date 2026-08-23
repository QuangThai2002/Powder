# Powder 19.6.0 — External Load Gate Guide

Tool: `tools/powder-load-gate-v1960.mjs`

Tool chỉ gọi API read-only:
- `pvp_state` -> `powder-pvp` action `state`
- `cloud_load` -> `powder-cloud` action `load`

Không ghi Combat action, reward hay Cloud Save.

## PowerShell
```powershell
$env:POWDER_ANON_KEY="<publishable key>"
$env:POWDER_ACCESS_TOKENS="<token1>,<token2>,<token3>,<token4>,<token5>"
node tools/powder-load-gate-v1960.mjs pvp_state 200 10
node tools/powder-load-gate-v1960.mjs cloud_load 200 10
```

Khuyến nghị dùng tối thiểu 5 tài khoản/session pilot hợp lệ. Không đưa token vào file report; tool chỉ ghi `tokenCount`.

## Ngưỡng để Admin nhận Load PASS
Mỗi mode phải có:
- requests >= 200
- concurrency >= 10
- tokenCount >= 5
- errorRate <= 1%
- P95 <= 1500 ms
- P99 <= 2500 ms

Sau khi chạy, import cả hai JSON vào Admin > Launch > Production Load & Integrity. Bounded probe trong Admin không thể tự đánh dấu Real Load PASS.
