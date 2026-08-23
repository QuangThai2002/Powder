# Launch Stabilization Guide — 21.0.1

1. Deploy migration `20260823_21001_launch_stabilization_post_launch_guardrails.sql`.
2. Deploy Edge Function `powder-admin-launch-stability`.
3. Deploy artifact 21.0.1 và xác nhận manifest/build hash.
4. Owner đăng nhập Admin bằng MFA/AAL2.
5. Nhập manifest hash + ZIP SHA-256 + rollback target `powder-21.0.0-official-production`, sau đó ARM Guard.
6. CI/monitoring gọi `powder_post_launch_record_health_v21001`; server tự tính PASS/HOLD.
7. Nếu health vượt ngưỡng khi policy đã ARM, server chuyển rollout sang `emergency_mode=halt`.
8. Không tự rollback dữ liệu. Operator đánh giá incident và dùng rollback workflow đã có nếu cần.
9. Chỉ Resume khi evidence mới nhất PASS và Critical/High incident đã được resolve.

Guardrail này bổ sung Reliability 20.8, Transaction Safety 20.9, Save Integrity 20.17 và Official Production 21.0; nó không thay thế các lớp đó.
