# Powder 20.16.0 — Security & Permission Final Hardening Guide

## Mục tiêu
20.16 khóa lớp quyền quản trị và RPC trước Release Candidate. Gameplay/combat không thay đổi.

## 1. Central Admin Access Contract
Tất cả 17 Admin Edge Function hiện có phải gọi `enforceAdminAccessV20160()` sau khi Supabase xác thực JWT và đọc role từ `admin_allowlist`.

Guard server kiểm:
- role hiện tại khớp `admin_allowlist`;
- function/role nằm trong surface matrix;
- JWT có `iat` và `exp` hợp lệ;
- token không quá cũ, không sắp hết hạn;
- user/token chưa bị revoke;
- `Origin` phải có và nằm trong allowlist sau bootstrap;
- thao tác nhạy cảm phải có MFA/AAL2;
- thao tác vốn Owner-only tiếp tục Owner-only.

Guard luôn fail-closed nếu RPC kiểm quyền không hoạt động.

## 2. 17 Admin surfaces
`powder-admin`, disaster-recovery, events, exploit-hardening, integrity, live-ops, load-soak, mutation-integration, observability, official-launch, reconciliation, recovery, reliability, rollout, security, support, transactions.

## 3. Critical-action matrix
20.16 có 48 action nhạy cảm được gắn MFA/AAL2. Các action có tác động trực tiếp như activate/finalize production, rollback/emergency, publish event, recovery, chaos drill, chỉnh resource/rank, compensation approval... phải qua guard trung tâm trước khi logic cũ chạy.

Các action vốn cho `admin` vẫn giữ role nghiệp vụ cũ khi phù hợp, nhưng yêu cầu AAL2. Action vốn chỉ Owner mới làm tiếp tục yêu cầu Owner + AAL2.

## 4. Session & token
- Admin session dùng `sessionStorage`, không giữ access token Admin dài hạn trong `localStorage`.
- Có revoke theo `user_id` hoặc SHA-256 của token.
- Token freshness mặc định: tuổi tối đa 3600 giây, còn ít nhất 60 giây trước expiry.

## 5. Origin allowlist
Production Security Gate chỉ READY khi Owner cấu hình ít nhất một origin hợp lệ. Chỉ cho HTTPS; localhost/127.0.0.1 HTTP được chấp nhận cho QA local.

Bootstrap duy nhất: `powder-admin-security state/configure` được phép khi allowlist còn rỗng để Owner thiết lập origin ban đầu. Sau đó request Admin thiếu Origin hoặc Origin không nằm trong allowlist sẽ bị chặn.

## 6. PostgreSQL SECURITY DEFINER lockdown
Migration 20.16 quét toàn bộ SECURITY DEFINER function trong schema `public` và revoke default EXECUTE khỏi `PUBLIC`, `anon`, `authenticated`, ngoại trừ RPC read-only `powder_reliability_public_status_v2080()`.

Các RPC Security 20.16 chỉ cấp EXECUTE cho `service_role`.

## 7. Official Launch hard gate
`powder_official_launch_preflight_v20160()` thêm `securityPermissionFinal`.

Không được activate canary nếu:
- Critical Security > 0;
- High Security > 0;
- chưa ARM Security config;
- chưa có Origin allowlist;
- 17/17 Admin surface chưa được bảo vệ;
- SECURITY DEFINER RPC còn lộ quyền;
- critical table còn direct-write từ anon/authenticated;
- legacy Security 20.3 chưa READY.

## 8. Cách triển khai production
1. Apply migration `20260823_20160_security_permission_final_hardening.sql`.
2. Redeploy 17 Admin Edge Function và shared helper 20.16.
3. Đăng nhập Owner bằng MFA/AAL2.
4. Vào Admin → Security & Permission Final Hardening.
5. Cấu hình exact Admin origin(s), sau đó ARM.
6. Chạy Security probe và lưu Security snapshot.
7. Xác nhận posture: Critical=0, High=0.
8. Chỉ sau đó mới tiếp tục Official Launch preflight/canary.

## 9. Nguyên tắc an toàn
20.16 không tự tuyên bố production PASS. Artifact chỉ chứng minh code/gate/runtime QA. Production READY cần migration + Edge deployment + origin + MFA + posture thật trên Supabase production.
