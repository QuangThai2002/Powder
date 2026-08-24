# Powder 21.1.2 — Learning Question Engine 4.0 Implementation

## Phạm vi release
21.1.2 là lớp tạo và trình bày câu hỏi học thuật cho **lesson session**. Không đổi reward, Rank gate, Daily Boss cost, Combat formula, economy, 22 gameplay-freeze files hoặc server authority.

## 7 Question Families
1. Recognition — nhận diện nghĩa/từ/phát âm/cặp đúng.
2. Recall — tự nhớ và nhập đáp án.
3. Grammar — điền, sắp xếp, cấu trúc, sửa/nhận diện lỗi.
4. Context — ngữ cảnh, tình huống, hội thoại, collocation.
5. Reading — chi tiết, ý chính, suy luận, bằng chứng.
6. Production — dịch/viết/cấu tạo câu có kiểm soát.
7. Application — ứng dụng lịch, thông báo, công việc, tác vụ thực tế khi lesson có dữ liệu phù hợp.

## Interaction 21.1.2
- `choice`: single select.
- `multi`: chọn nhiều đáp án, exact-set grading.
- `text`: nhập chữ/câu; normalization theo ngôn ngữ/dimension và accepted answers.
- `order`: chọn token để dựng câu, có thể hoàn tác token.
- `match`: ghép cặp term ↔ meaning bằng control mobile-friendly.

## Registry
Registry chứa >=70 archetype để khóa taxonomy dài hạn. Không đồng nghĩa mọi bài dùng tất cả archetype. Builder kiểm tra prerequisites; archetype không đủ dữ liệu sẽ không sinh câu.

## Generated question contract
```js
{
  id,
  lessonId,
  language,
  type, // legacy-compatible mastery type
  prompt,
  options,
  answer,
  explain,
  academicMeta: {
    family,
    archetype,
    interaction,
    dimension,
    sourceLessonId,
    sourceUnitId,
    generated: true,
    serverSafe: false
  }
}
```

## Tương thích hệ cũ
- `D.questions` không bị chèn academic-generated question trong release này.
- `learning-master-v2.js` vẫn quản lý canonical SRS/Boss/Combat pools.
- `app.js` chỉ dùng engine khi mở lesson. Nếu engine không tải, fallback flow cũ vẫn hoạt động.
- Online lesson: server vẫn chọn canonical IDs; client map về canonical base question và renderer legacy/engine choice tương thích.

## Chọn câu trong session
- Ưu tiên phủ family khác nhau trước.
- Không trùng `sourceUnitId + archetype`.
- Tăng trọng số dimension đang yếu nếu save đã có `learning.academicDimensionMastery`.
- Giữ số câu theo difficulty hiện tại: Standard 30–40, Hard 40–55, Deep 55–65.
- Nếu academic-generated pool chưa đủ, trộn canonical base questions để đạt target; tuyệt đối không clone prompt bằng tiền tố để giả đa dạng.

## Mastery dimension
21.1.2 bổ sung nested state, không đổi top-level save schema:
`save.learning.academicDimensionMastery[language][dimension]`

Các dimension đầu: `meaning`, `term`, `pinyin`, `hanzi`, `grammar`, `context`, `reading`, `production`, `application`.

## Gate
Chrome gate phải xác nhận:
- >=70 archetype, đúng 7 family.
- đủ 5 interaction thật.
- HSK1 tạo academic pool chỉ từ dữ liệu HSK1 hiện tại.
- không unseen source.
- không duplicate sourceUnit+archetype trong selected session.
- grading choice/multi/text/order/match.
- mobile 390px không overflow và input/control >=44px.
- Boss/SRS canonical bank vẫn không chứa generated academic question.
- không thay Coin/Knowledge/Rank khi chỉ build/render/grade test question.
