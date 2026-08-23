# Powder 19.3.0 — Launch Hardening & Pilot Toolkit

## Mục tiêu
19.3.0 không thêm gameplay Combat mới. Bản này biến các field-test còn HOLD thành bằng chứng có thể đo, xuất và gộp từ nhiều thiết bị trước khi tạo release seal.

## Player Pilot Mode
Mở `index.html?pilot=1` để bật bảng Pilot nhỏ. Runtime luôn ghi evidence cục bộ nhưng overlay chỉ hiện khi Pilot Mode được bật.

Evidence được thu tự động:
- device ID cục bộ;
- thời gian tab thực sự active (tab ẩn/sleep không được tính vào soak);
- PvP match ID đã quan sát;
- Bành Trướng đã quan sát trong state/event ledger;
- offline/online/reconnect thật;
- AFK strike tối đa và finish reason;
- viewport mục tiêu 320 / 360 / 390 / 430 px;
- FPS probe có giới hạn thời gian;
- peak heap ratio nếu browser hỗ trợ;
- runtime error count.

Pilot overlay có nút FPS 10s, Checkpoint và Export evidence JSON.

## Admin Multi-device Pilot Evidence
Admin có thể import nhiều evidence JSON hoặc Pilot Bundle. Các device ID được dedupe rồi gộp thành một dashboard.

7 mục có thể PASS bằng evidence khách quan:
1. PvP hai thiết bị + >=10 match khác nhau;
2. offline + reconnect thật;
3. AFK 3 strike hoặc disconnect timeout;
4. đủ 9 Bành Trướng Online;
5. đủ viewport 320/360/390/430;
6. active soak >=2 giờ;
7. active soak >=4 giờ.

Ba mục không được tự PASS:
- Pilot 20–50 người chơi;
- Server load/concurrency;
- Rollback + Cloud Save recovery.

## Release seal 19.3
19.2 seal không được kế thừa. 19.3 tạo seal mới và fail-closed theo version, build ID, automated gate, 10/10 field checklist và manifest hash của chính build đang chạy.

## Backend
Không migration và không redeploy Edge. Production audit tại thời điểm đóng build:
- PvP catalog: 99;
- identity: 99;
- unique signatures: 99;
- Bành Trướng: 9 = 6 normal + 3 special;
- Giản Dị: 3;
- stale Server Combat sessions >30 phút: 0;
- powder-pvp: v5 ACTIVE, verify_jwt=true.

## Gameplay isolation
22 file Combat/PvP/Boss/Domain/Server Combat critical được so byte-for-byte với 19.2.0 và không thay đổi.
