# Powder Automation 21.0.5 — CI/CD & Release Automation

## Vì sao runtime vẫn là 21.0.4?
21.0.5 là **tooling patch của repository**, không thay player/server runtime. Giữ runtime 21.0.4 giúp tránh tạo một build game mới chỉ vì thêm GitHub Actions và giữ 22/22 gameplay-critical file byte-identical.

## Benchmark trước khi triển khai
- **PixiJS**: tham khảo cách tách push/release workflow, dùng concurrency và artifact release.
- **Excalibur.js**: tham khảo CI nhiều job, test Linux + Windows và upload artifact để điều tra lỗi.
- **Three.js**: tham khảo tư duy CI/security automation nghiêm cho JavaScript/WebGL repository lớn.
- **Babylon.js**: tham khảo cách tách kiểm tra chuyên biệt thay vì gom mọi thứ vào một job.

Chỉ áp dụng pattern CI/release; không copy engine, gameplay hoặc framework.

## Powder CI
- PR/push `main` tự chạy Policy Gate.
- Policy Gate chạy cả Ubuntu và Windows.
- Sau đó chạy Final Gate 21.0.4 hiện hành.
- JSON kết quả được giữ 14 ngày dưới dạng GitHub Actions artifact.
- Run cũ cùng branch tự hủy bằng `concurrency`.
- CI chỉ có `contents: read` và không dùng production secrets.

## Release Automation
- Chỉ chạy khi push tag `vX.Y.Z`.
- Tag phải đúng bằng `v` + `release.json.version`.
- Policy Gate + Final Gate phải PASS.
- Tự đóng ZIP, tạo SHA-256 và Final Gate report.
- `gh release create --verify-tag` chỉ publish tag đã tồn tại.
- Workflow không bao giờ tự đổi `official=true`.

## Repository setting nên bật
Bật Ruleset/Branch protection cho `main`, yêu cầu `Powder CI` PASS trước merge và chặn force-push.
