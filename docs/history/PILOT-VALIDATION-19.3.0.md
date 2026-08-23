# Cách chạy Pilot 19.3.0

1. Trên mỗi thiết bị test, mở `index.html?pilot=1`.
2. Chơi PvP/Combat bình thường. Pilot overlay không thay đổi gameplay.
3. Với mobile responsive test, chạy lần lượt 320, 360, 390, 430px và bấm Checkpoint sau mỗi viewport.
4. Để test reconnect, ngắt mạng thật rồi nối lại; không dùng nút giả lập.
5. Test AFK cho đến khi server ghi 3 strikes hoặc disconnect timeout.
6. Kích hoạt đủ 9 Bành Trướng qua các trận PvP cần thiết.
7. Để tab active cho soak; thời gian hidden/sleep không được tính.
8. Chạy FPS 10s trong các cảnh Combat nặng đại diện.
9. Bấm Export trên từng thiết bị.
10. Vào Admin > Multi-device Pilot Evidence, import các JSON, rồi bấm `Áp dụng evidence hợp lệ`.
11. Ba mục Pilot 20–50, load test và rollback vẫn phải xác nhận thủ công sau khi thực hiện thật.
12. Khi đủ 10/10 và automated PASS, tạo Release Seal 19.3.
