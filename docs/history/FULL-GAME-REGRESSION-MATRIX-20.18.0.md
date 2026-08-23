# Powder 20.18.0 — RC1 Regression Matrix

| Hệ thống | Automated | Manual production smoke | Kỳ vọng |
|---|---|---|---|
| Home / Navigation | Có | Bắt buộc | Không dead-link, modal/view mở đúng |
| Learning | Có | Bắt buộc | Bài học, câu hỏi, reward flow hoạt động |
| PowDex | Có | Bắt buộc | 99 Pow, role/state hiển thị đúng |
| Inventory | Entry/guard | Bắt buộc | Đọc/ghi hợp lệ, không duplicate |
| Gacha | Có | Bắt buộc | Roll/reveal/reward flow hoàn chỉnh |
| Equipment | Có | Bắt buộc | Equip/unequip/set/role đúng |
| Artifact | Có | Bắt buộc | 49 artifact, equip/upgrade đúng |
| PvE | Entry/freeze | Bắt buộc | Combat hoàn thành, result/reward đúng |
| PvP | Entry/freeze | Bắt buộc | Join/battle/result/sync đúng |
| Boss | Entry/freeze | Bắt buộc | Gate → combat → reward đúng |
| Event | Entry/transaction | Bắt buộc | Progress/claim không lặp reward |
| Mail | Entry/transaction | Bắt buộc | Claim idempotent |
| Economy | Transaction/anti-abuse | Bắt buộc | Buy/exchange không double spend |
| Rank | Có | Bắt buộc | Promotion flow/requirement đúng |
| Cloud Save | Save integrity | Bắt buộc | Multi-device conflict/pending sync an toàn |
| Admin | Edge syntax/security | Bắt buộc | Permission/MFA/action flow đúng |
| Performance | Load/soak harness | Bắt buộc | FPS smoke + production health đạt gate |

Manual smoke evidence phải đúng build + manifest và được server xác minh.
