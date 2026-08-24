# Powder 21.1.3 — Academic Content & Exercise Expansion

## Runtime mới
`js/learning-academic-content-v2113.js`

### Nhiệm vụ
- Map Rank → academic profile riêng cho ZH/EN.
- Cân bằng 7 families theo Rank.
- Ưu tiên dimension mastery yếu hơn.
- Bảo toàn nguồn canonical và giới hạn tối đa 2 câu từ cùng một source unit trong session.
- Reclassify canonical reading/situation/sentence-transformation/writing sang archetype học thuật cụ thể hơn.
- Sinh thêm `context_cloze` và `word_in_context` chỉ từ vocabulary + example/sentencePattern example của chính lesson.

## Phân bố mục tiêu
### Chinese
- Rank 0 HSK1: Recognition 24 / Recall 20 / Grammar 24 / Context 12 / Reading 15 / Production 5 / Application 0.
- Rank 1 HSK2: tăng Context/Production nhẹ.
- Rank 2–3 HSK3: Reading và Production tăng rõ.
- Rank 4–5 HSK4: Reading là trụ cột, Application bắt đầu đáng kể.
- Rank 6 HSK5: Reading 24, Production 20, Application 11.

### English
- Rank 0 là B1+ → B2 Bridge, không A1/A2/B1.
- Từ Rank 2 trở lên tăng dần Reading/Production/Application.
- Rank 6 B2 Complete ưu tiên Reading 23 / Production 19 / Application 12.

## Tích hợp với 21.1.2
`learning-question-engine-v2112.js` sẽ gọi:
- `POWDER_ACADEMIC_CONTENT_V2113.augmentPool(...)`
- `POWDER_ACADEMIC_CONTENT_V2113.planSession(...)`

Nếu runtime 21.1.3 không tồn tại, engine vẫn dùng đường 21.1.2 hiện tại để tránh hard dependency.

## An toàn
- Không mutate `D.questions`.
- Không tạo kiến thức ngoài lesson.
- Không sửa server IDs / online candidate IDs.
- Không sửa SRS canonical, reward, Knowledge, economy, Combat hay 22 frozen gameplay files.
- Không interval loop / MutationObserver / animation.
