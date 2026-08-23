(()=>{'use strict';
const D=window.POWDER_DATA;if(!D)return;
const byId=id=>D.lessons.find(l=>l.id===id);
const q=(id,type,prompt,options,answer,explain,extra={})=>({id,type,prompt,options,answer,explain,...extra});
const apply=(id,cfg)=>{const l=byId(id);if(!l)return;Object.assign(l,cfg);if(cfg.extraQuestions?.length){const known=new Set((l.questions||[]).map(x=>x.id));l.questions=[...(l.questions||[]),...cfg.extraQuestions.filter(x=>!known.has(x.id))];}delete l.extraQuestions;};
const zh={
zh_hsk1_greetings:{difficulty:'standard',reward:{coin:105},
 sentencePatterns:[
  ['A 是 B','Dùng 是 (shì) để xác định/giới thiệu danh tính.','我是学生。 Wǒ shì xuésheng. — Tôi là học sinh.'],
  ['A 叫 + tên','叫 (jiào) dùng để nói tên của mình/người khác.','我叫安娜。 Wǒ jiào Ānnà. — Tôi tên Anna.'],
  ['...吗？','吗 (ma) đặt cuối câu trần thuật để tạo câu hỏi Có/Không.','你是老师吗？— Bạn là giáo viên phải không?'],
  ['...呢？','呢 (ne) dùng để hỏi lại cùng chủ đề hoặc hỏi trạng thái/vị trí trong ngữ cảnh.','我很好，你呢？— Tôi khỏe, còn bạn?']
 ],
 usageNotes:[
  ['吗 ma','Không dùng 吗 cùng từ để hỏi như 谁/什么/哪儿. Sai: *你是谁吗？ Đúng: 你是谁？'],
  ['也 yě','“cũng”; thường đứng trước động từ/vị ngữ: 我也是学生。'],
  ['很 hěn','Với tính từ, 很 thường nối chủ ngữ với tính từ: 我很好。 Không cần dịch máy móc thành “rất” trong mọi câu.']
 ],
 dialogue:[['A','你好！你叫什么名字？'],['B','我叫林安。你呢？'],['A','我叫美玲。你是学生吗？'],['B','是，我也是学生。']],
 extraQuestions:[
  q('v136_greet_7','grammar','Câu nào hỏi tên đúng mà KHÔNG dùng sai 吗?',['你叫什么名字？','你叫什么名字吗？','你是叫什么名字？','吗你叫什么名字？'],'你叫什么名字？','Từ để hỏi 什么 đã tự tạo câu hỏi; không thêm 吗.'),
  q('v136_greet_8','grammar','Điền cấu trúc hợp lý: “我是学生，你___？”',['呢','吗','不','没'],'呢','呢 dùng để hỏi lại cùng chủ đề: “Tôi là học sinh, còn bạn?”'),
  q('v136_greet_9','sentence_order','Chọn trật tự tự nhiên nhất.',['我也很好。','也我很好。','我很好也。','我很也好。'],'我也很好。','也 đứng trước vị ngữ mà nó bổ nghĩa.'),
  q('v136_greet_10','situation','A: “谢谢！” B nên đáp thế nào?',['不客气。','对不起。','没关系。','你好吗？'],'不客气。','不客气 là đáp lời cảm ơn thông dụng.'),
  q('v136_greet_11','grammar','Câu nào đúng để hỏi “Bạn có phải giáo viên không?”',['你是老师吗？','你老师吗是？','你是谁老师？','你是老师呢吗？'],'你是老师吗？','Câu trần thuật + 吗 tạo câu hỏi Có/Không.'),
  q('v136_greet_12','reading','Đọc: “我叫王明。我不是老师，我是学生。李华也是学生。” Điều nào đúng?',['王明和李华都是学生。','王明是老师。','李华不是学生。','王明叫李华。'],'王明和李华都是学生。','不是 phủ định 是; 也 cho biết 李华 cũng là học sinh.')
 ]},
zh_hsk1_numbers_time:{difficulty:'standard',reward:{coin:110},
 sentencePatterns:[
  ['几 + lượng từ/danh từ','几 (jǐ) hỏi số lượng nhỏ, thường khi dự đoán con số không lớn.','你几岁？ / 几个人？'],
  ['多少 + danh từ','多少 (duōshao) hỏi số lượng rộng hơn.','多少钱？— Bao nhiêu tiền?'],
  ['现在 + số + 点','点 dùng cho giờ.','现在八点。— Bây giờ 8 giờ.'],
  ['星期 + số','星期一…星期六; Chủ nhật thường 星期天/星期日.','今天星期三。']
 ],
 usageNotes:[
  ['一 yī','Đọc riêng là yī. Trong lời nói thường biến điệu: trước thanh 4 → yí (一个 yí ge); trước thanh 1/2/3 → yì (一天 yì tiān). Khi đọc số/thứ tự có thể giữ yī.'],
  ['二 èr / 两 liǎng','二 dùng khi đọc số; 两 thường đứng trước lượng từ: 两个人.'],
  ['几点 / 多少','Hỏi giờ dùng 几点, không nói *多少点 trong mẫu cơ bản.']
 ],
 extraQuestions:[
  q('v136_time_7','grammar','Chọn cách nói tự nhiên cho “hai người”.',['两个人','二个人','两个二','人两个'],'两个人','Trước lượng từ 个, 两 tự nhiên hơn 二.'),
  q('v136_time_8','grammar','“一个” trong lời nói thường đọc 一 như thế nào?',['yí (trước thanh 4)','yì (trước thanh 4)','luôn yī, không đổi','yǐ'],'yí (trước thanh 4)','一 biến thành thanh 2 trước âm tiết thanh 4: 一个 yí ge.'),
  q('v136_time_9','fill','Chọn từ đúng: 你今年___岁？',['几','什么','谁','哪儿'],'几','几 phù hợp để hỏi tuổi với số lượng nhỏ.'),
  q('v136_time_10','reading','“今天星期五，明天星期六。” Hôm qua là…',['星期四','星期三','星期天','星期一'],'星期四','Lùi một ngày từ thứ Sáu là thứ Năm.'),
  q('v136_time_11','sentence_order','Chọn câu đúng để hỏi giá.',['这个多少钱？','多少这个钱？','这个几钱？','钱这个多少？'],'这个多少钱？','多少钱 là cụm cố định để hỏi giá.'),
  q('v136_time_12','situation','Bạn muốn hỏi “Bây giờ là mấy giờ?”.',['现在几点？','今天几号？','现在多少号？','几点今天？'],'现在几点？','几点 hỏi thời điểm theo giờ.')
 ]},
zh_hsk1_family_people:{difficulty:'hard',reward:{coin:120},
 sentencePatterns:[
  ['A 的 B','的 (de) nối người/vật sở hữu với danh từ.','我的妈妈 — mẹ của tôi'],
  ['A 有 B','有 (yǒu) biểu thị sở hữu/có.','我有一个姐姐。'],
  ['这/那 + 是 + ...','Giới thiệu người/vật ở gần/xa.','这是我爸爸。'],
  ['谁？','谁 (shéi) hỏi người.','她是谁？']
 ],
 usageNotes:[
  ['的 de','Quan hệ thân thuộc gần gũi đôi khi có thể lược 的: 我妈妈. Cả 我的妈妈 và 我妈妈 đều gặp trong tiếng Trung.'],
  ['有 / 是','有 = có/sở hữu; 是 = là/xác định danh tính. Không thay thế nhau.'],
  ['个 ge','Lượng từ phổ biến: 一个人、三个人.']
 ],
 extraQuestions:[
  q('v136_family_7','grammar','Câu nào tự nhiên để nói “mẹ tôi”?',['我妈妈','我有妈妈的','我是妈妈','妈妈我有的'],'我妈妈','Với thân thuộc gần, 的 thường có thể lược.'),
  q('v136_family_8','grammar','Chọn đúng: “Tôi có hai người bạn.”',['我有两个朋友。','我是两个朋友。','我两个有朋友。','我有二朋友个。'],'我有两个朋友。','有 biểu thị sở hữu; 两个 đứng trước danh từ.'),
  q('v136_family_9','fill','___是你的老师？',['谁','什么','几','怎么'],'谁','谁 dùng để hỏi người.'),
  q('v136_family_10','sentence_order','Chọn câu đúng để giới thiệu anh trai.',['这是我的哥哥。','这我的哥哥是。','我的这是哥哥。','是这哥哥我的。'],'这是我的哥哥。','Trật tự cơ bản: 这 + 是 + cụm danh từ.'),
  q('v136_family_11','reading','“我家有四个人：爸爸、妈妈、姐姐和我。” Người nói có anh trai không?',['Không','Có một anh trai','Có hai anh trai','Không đủ thông tin'],'Không','Danh sách chỉ có bố, mẹ, chị gái và người nói.'),
  q('v136_family_12','grammar','Câu nào dùng 的 đúng?',['这是老师的书。','这是的老师书。','这的书是老师。','老师这是的书。'],'这是老师的书。','A 的 B = B thuộc/liên quan đến A.')
 ]},
zh_hsk1_food_daily:{difficulty:'hard',reward:{coin:125},
 sentencePatterns:[
  ['想 + V','想 (xiǎng) = muốn/dự định làm gì.','我想喝茶。'],
  ['喜欢 + N/V','喜欢 (xǐhuan) = thích.','我喜欢吃米饭。'],
  ['要 + N/V','要 có thể chỉ nhu cầu/muốn; ngữ cảnh quyết định.','我要一杯茶。'],
  ['太 + Adj + 了','Mẫu cảm thán/mức độ: “quá… rồi!”.','太好了！— Tuyệt quá!']
 ],
 usageNotes:[
  ['想 / 喜欢','想 = muốn làm ở thời điểm/ý định; 喜欢 = sở thích. “Tôi muốn uống trà” ≠ “Tôi thích uống trà”.'],
  ['杯 bēi','Lượng từ cho đồ uống theo cốc: 一杯水、两杯茶.'],
  ['太…了','Không nhất thiết tiêu cực; 太好了 là cảm thán tích cực rất phổ biến.']
 ],
 extraQuestions:[
  q('v136_food_7','grammar','Bạn đang khát và muốn uống nước ngay. Câu nào sát nghĩa nhất?',['我想喝水。','我喜欢水吗？','我是喝水。','我会水。'],'我想喝水。','想 + động từ diễn đạt mong muốn/ý định.'),
  q('v136_food_8','grammar','Câu “太好了！” mang nghĩa gần nhất là…',['Tuyệt quá!','Quá đói rồi.','Không tốt.','Bạn khỏe không?'],'Tuyệt quá!','太 + tính từ + 了 có thể tạo cảm thán về mức độ.'),
  q('v136_food_9','fill','我要两___茶。',['杯','本','个书','岁'],'杯','杯 là lượng từ phù hợp cho trà/nước theo cốc.'),
  q('v136_food_10','grammar','Câu nào nói về SỞ THÍCH chứ không phải ý định nhất thời?',['我喜欢吃苹果。','我想吃苹果。','我要苹果。','我在苹果。'],'我喜欢吃苹果。','喜欢 nhấn mạnh sở thích.'),
  q('v136_food_11','reading','“我喜欢喝茶，但是今天很热，我想喝水。” Hôm nay người nói muốn uống gì?',['Nước','Trà','Cà phê','Sữa'],'Nước','喜欢 nói sở thích chung, 想 nói mong muốn hiện tại.'),
  q('v136_food_12','situation','Món ăn rất ngon, bạn muốn cảm thán.',['太好吃了！','好吃吗谁？','我不太吃。','这是吃的谁？'],'太好吃了！','太 + 好吃 + 了 diễn đạt “ngon quá!”.')
 ]},
zh_hsk1_places:{difficulty:'hard',reward:{coin:125},
 sentencePatterns:[
  ['A 在 B','在 (zài) chỉ vị trí của người/vật.','我在学校。'],
  ['A 在哪儿？','哪儿/哪里 hỏi địa điểm.','商店在哪儿？'],
  ['这里 / 那里','这里 = ở đây; 那里 = ở đó.','老师在这里。'],
  ['去 + địa điểm','去 (qù) + nơi đến.','我去学校。']
 ],
 usageNotes:[
  ['在 / 有','A 在 B = A ở B. B 有 A = ở B có A. Hai cấu trúc nhìn cùng cảnh nhưng trọng tâm khác nhau.'],
  ['哪儿','Từ để hỏi đứng đúng vị trí mà câu trả lời sẽ đứng: 我在学校 → 你在哪儿？'],
  ['去 / 来','去 = đi xa khỏi điểm nói; 来 = đến về phía điểm nói/người nói.']
 ],
 extraQuestions:[
  q('v136_place_7','grammar','Câu nào đúng để nói “Ở trường có một giáo viên”?',['学校有一个老师。','老师在有学校。','学校在一个老师。','有学校老师在。'],'学校有一个老师。','Địa điểm + 有 + người/vật biểu thị tồn tại.'),
  q('v136_place_8','grammar','Câu nào hỏi vị trí đúng?',['你的书在哪儿？','你的书吗哪儿？','哪儿吗你的书？','你的哪儿是书吗？'],'你的书在哪儿？','Từ nghi vấn 哪儿 không đi cùng 吗.'),
  q('v136_place_9','sentence_order','Chọn câu tự nhiên nhất theo trật tự thời gian.',['我明天去北京。','我去明天北京。','北京我去明天。','明天北京去我。'],'我明天去北京。','Thời gian thường đứng trước động từ: Chủ ngữ + thời gian + 去 + nơi.'),
  q('v136_place_10','reading','“小王在学校。小李去学校。” Ai đã ở trường?',['小王','小李','Cả hai chắc chắn','Không ai'],'小王','在 chỉ trạng thái vị trí hiện tại; 去 chỉ hướng đi đến.'),
  q('v136_place_11','fill','饭店___哪儿？',['在','有','是有','去在'],'在','在哪儿 = ở đâu.'),
  q('v136_place_12','situation','Bạn đang ở ga và hỏi nhà vệ sinh ở đâu.',['请问，洗手间在哪儿？','洗手间吗？','谁是洗手间？','洗手间几岁？'],'请问，洗手间在哪儿？','请问 làm câu hỏi lịch sự; 在哪儿 hỏi vị trí.')
 ]},
zh_hsk1_objects:{difficulty:'hard',reward:{coin:125},
 sentencePatterns:[
  ['这/那 + lượng từ + N','Chỉ định đồ vật: 这本书、那个杯子.','这本书很好。'],
  ['số + lượng từ + N','Danh từ đếm thường cần lượng từ.','两本书、三个杯子'],
  ['什么？','什么 hỏi vật/sự việc.','这是什么？'],
  ['N1 上/下 + 有 + N2','Mô tả tồn tại theo vị trí.','桌子上有一本书。']
 ],
 usageNotes:[
  ['本 běn','Lượng từ thường dùng cho sách, tạp chí, vở: 一本书.'],
  ['个 ge','Lượng từ phổ thông nhưng không nên thay mọi lượng từ khi đã biết lượng từ chuẩn.'],
  ['这 / 这个','这 có thể đi với lượng từ: 这个人、这本书.']
 ],
 extraQuestions:[
  q('v136_obj_7','grammar','Chọn lượng từ đúng: 三___书',['本','杯','岁','点'],'本','书 thường dùng lượng từ 本.'),
  q('v136_obj_8','grammar','Câu nào đúng?',['桌子上有两个杯子。','桌子上在两个杯子。','两个杯子有桌子上。','桌子两个杯子在有。'],'桌子上有两个杯子。','Địa điểm + 有 + vật dùng để nói “ở đâu có gì”.'),
  q('v136_obj_9','fill','___是什么？',['这','几岁','谁人','怎么在'],'这','这是什么？ = Đây là cái gì?'),
  q('v136_obj_10','sentence_order','Chọn cụm đúng cho “quyển sách này”.',['这本书','本这书','这书本','书这本'],'这本书','Thứ tự: từ chỉ định + lượng từ + danh từ.'),
  q('v136_obj_11','reading','“桌子上有一本书，椅子上没有书。” Sách ở đâu?',['Trên bàn','Trên ghế','Cả hai','Không có sách'],'Trên bàn','有/没有 mô tả có/không có tại vị trí.'),
  q('v136_obj_12','grammar','Câu nào dùng 两 đúng nhất?',['两本书','二本书们','本两书','两书本'],'两本书','两 thường đứng trước lượng từ khi đếm số lượng.')
 ]},
zh_hsk1_daily_routine:{difficulty:'hard',reward:{coin:130},
 sentencePatterns:[
  ['S + thời gian + V','Thời gian thường đứng sau chủ ngữ và trước động từ.','我每天七点起床。'],
  ['每天 + V','每天 = mỗi ngày; biểu thị thói quen.','我每天学习汉语。'],
  ['先…再…','Trình tự: trước… rồi… (dạng luyện mở rộng).','我先吃饭，再学习。'],
  ['什么时候？','Hỏi thời điểm rộng hơn “mấy giờ”.','你什么时候回家？']
 ],
 usageNotes:[
  ['点 / 时候','几点 hỏi giờ cụ thể; 什么时候 hỏi thời điểm nói chung.'],
  ['上午/下午/晚上','Đặt trước giờ: 上午八点、晚上十点.'],
  ['也','Dùng để nối thói quen tương đồng: 我晚上学习，他也晚上学习。']
 ],
 extraQuestions:[
  q('v136_routine_7','grammar','Trật tự nào tự nhiên?',['我晚上十点睡觉。','我睡觉晚上十点。','十点我睡觉晚上。','晚上睡觉我十点。'],'我晚上十点睡觉。','Thời gian đứng trước động từ chính.'),
  q('v136_routine_8','grammar','Muốn hỏi “Bạn khi nào về nhà?” dùng…',['你什么时候回家？','你几回家人？','你回家吗什么时候？','什么时候吗你回家？'],'你什么时候回家？','什么时候 là từ nghi vấn nên không thêm 吗.'),
  q('v136_routine_9','reading','“我早上六点起床，七点吃饭，八点上课。” Việc nào xảy ra thứ hai?',['Ăn cơm','Thức dậy','Vào học','Đi ngủ'],'Ăn cơm','6h thức dậy → 7h ăn → 8h vào học.'),
  q('v136_routine_10','sentence_order','Chọn câu diễn đạt trình tự hợp lý.',['我先吃饭，再学习。','我再吃饭，先学习。','先我再吃饭学习。','吃饭学习先再我。'],'我先吃饭，再学习。','先…再… dùng để sắp xếp hai hành động.'),
  q('v136_routine_11','fill','我___七点起床。',['每天','哪儿','谁','本'],'每天','每天 + thời gian + động từ mô tả thói quen.'),
  q('v136_routine_12','situation','Bạn muốn nói “Tối nay tôi không học”.',['我今天晚上不学习。','我不今天晚上学习吗。','我晚上没是学习。','今天我学习晚上不吗。'],'我今天晚上不学习。','不 đứng trước động từ/vị ngữ cần phủ định.')
 ]},
zh_hsk1_descriptions:{difficulty:'hard',reward:{coin:135},
 sentencePatterns:[
  ['S + 很 + Adj','Tính từ có thể làm vị ngữ; 很 thường làm cầu nối tự nhiên.','她很漂亮。'],
  ['不 + Adj','Phủ định tính từ bằng 不.','今天不冷。'],
  ['有点儿 + Adj','“hơi…” thường dùng với trạng thái không lý tưởng.','我有点儿累。'],
  ['太 + Adj + 了','Cảm thán mức độ mạnh.','太漂亮了！']
 ],
 usageNotes:[
  ['Không dùng 是 trước tính từ','Trong mẫu cơ bản, nói 她很漂亮, không nói *她是很漂亮.'],
  ['很 hěn','Trong câu tính từ trung tính, 很 đôi khi không mang nghĩa nhấn “rất” mạnh.'],
  ['太…了','Mẫu cảm thán rất quan trọng: 太好了、太大了、太忙了.']
 ],
 extraQuestions:[
  q('v136_desc_7','grammar','Câu nào tự nhiên nhất?',['她很漂亮。','她是漂亮。','她漂亮是。','她很是漂亮。'],'她很漂亮。','Tính từ làm vị ngữ thường không cần 是; 很 thường nối tự nhiên.'),
  q('v136_desc_8','grammar','“太贵了！” gần nghĩa nhất là…',['Đắt quá!','Rất rẻ.','Có đắt không?','Không đắt.'],'Đắt quá!','太 + tính từ + 了 là mẫu cảm thán mức độ.'),
  q('v136_desc_9','fill','我今天有点儿___。',['累','本','哪儿','岁'],'累','有点儿 thường đi với tính từ/trạng thái.'),
  q('v136_desc_10','grammar','Phủ định “Hôm nay không lạnh” là…',['今天不冷。','今天没冷是。','今天不是冷。','不今天冷。'],'今天不冷。','Phủ định tính từ bằng 不 trong mẫu cơ bản.'),
  q('v136_desc_11','reading','“这个房间很大，但是有点儿冷。” Nhận xét nào đúng?',['Phòng lớn nhưng hơi lạnh.','Phòng nhỏ và nóng.','Phòng rất lạnh và nhỏ.','Không nói về phòng.'],'Phòng lớn nhưng hơi lạnh.','但是 tạo tương phản; 有点儿冷 = hơi lạnh.'),
  q('v136_desc_12','situation','Bạn nhìn thấy phong cảnh rất đẹp và muốn cảm thán.',['太漂亮了！','漂亮是谁？','漂亮吗什么？','我没漂亮。'],'太漂亮了！','Mẫu cảm thán 太 + Adj + 了.')
 ]},
zh_hsk1_abilities:{difficulty:'deep',reward:{coin:145},
 sentencePatterns:[
  ['会 + V','会 (huì): biết làm do đã học/kỹ năng.','我会说汉语。'],
  ['能 + V','能 (néng): có khả năng/điều kiện để làm trong tình huống.','今天我能来。'],
  ['可以 + V','可以 (kěyǐ): được phép/có thể.','这里可以坐吗？'],
  ['会…吗？','Hỏi kỹ năng Có/Không.','你会写汉字吗？']
 ],
 usageNotes:[
  ['会 / 能','会 nhấn kỹ năng đã học; 能 nhấn điều kiện/khả năng thực tế. “Biết bơi” thường 会游泳; “hôm nay có thể đi” thường 今天能去.'],
  ['可以','Thường dùng xin/cho phép: 我可以进去吗？'],
  ['一点儿','Đặt sau động từ hoặc trước danh từ/tính từ theo cấu trúc; 一点儿汉语 = một chút tiếng Trung.']
 ],
 extraQuestions:[
  q('v136_ability_7','grammar','Bạn đã học bơi và biết bơi. Chọn từ phù hợp nhất.',['我会游泳。','我能是游泳。','我可以游泳人。','我游泳吗会吗。'],'我会游泳。','会 thường diễn đạt kỹ năng có được qua học/luyện.'),
  q('v136_ability_8','grammar','Hôm nay chân bạn bị đau nên “không thể đi”. Câu nào sát nghĩa?',['我今天不能去。','我今天不会去。','我今天不可以是去。','我没会今天去。'],'我今天不能去。','不能 nhấn điều kiện/khả năng hiện tại không cho phép thực hiện.'),
  q('v136_ability_9','situation','Bạn xin phép ngồi ở đây.',['我可以坐这里吗？','我会坐这里谁？','我能坐吗哪里？','这里坐是我吗？'],'我可以坐这里吗？','可以 + V + 吗 thường dùng để xin phép.'),
  q('v136_ability_10','grammar','Câu nào KHÔNG nên thêm 吗?',['你会说什么语言？','你会说汉语吗？','你可以来吗？','他是学生吗？'],'你会说什么语言？','Câu đã có 什么 là từ nghi vấn, không cần 吗.'),
  q('v136_ability_11','reading','“小林会开车，但是今天没有车，所以他不能开车去。” Vì sao hôm nay anh ấy không lái xe đi?',['Vì không có xe.','Vì không biết lái.','Vì không thích xe.','Vì đang học lái.'],'Vì không có xe.','会 = biết kỹ năng; 不能 ở đây do điều kiện không có xe.'),
  q('v136_ability_12','sentence_transformation','Chọn câu diễn đạt “Tôi biết nói một chút tiếng Trung.” tự nhiên nhất.',['我会说一点儿汉语。','我一点儿会汉语说。','我能汉语一点儿是。','一点儿我说会汉语吗。'],'我会说一点儿汉语。','Trật tự: Chủ ngữ + 会 + động từ + số lượng/tân ngữ.')
 ]},
zh_hsk1_dates:{difficulty:'deep',reward:{coin:145},
 sentencePatterns:[
  ['年 + 月 + 号/日','Thứ tự ngày tháng tiếng Trung: năm → tháng → ngày.','2026年8月17号'],
  ['几月几号？','Hỏi tháng/ngày.','你的生日是几月几号？'],
  ['多大 / 几岁','Hỏi tuổi; 几岁 thường cho trẻ/tuổi nhỏ, 多大 rộng hơn.','你今年几岁？'],
  ['今天/明天/昨天','Từ thời gian thường đứng trước vị ngữ.','今天我学习汉语。']
 ],
 usageNotes:[
  ['号 / 日','Trong khẩu ngữ dùng 号 rất thường; 日 xuất hiện nhiều trong văn viết/trang trọng.'],
  ['年 đọc số','Năm thường đọc từng chữ số: 2026年 → 二零二六年.'],
  ['岁 suì','Đơn vị tuổi đứng sau số: 二十岁.']
 ],
 extraQuestions:[
  q('v136_date_7','grammar','Cách nói ngày 17/8 đúng trật tự Trung văn là…',['八月十七号','十七号八月','八十七月号','号十七八月'],'八月十七号','Tháng đứng trước ngày.'),
  q('v136_date_8','grammar','Câu hỏi sinh nhật đúng là…',['你的生日是几月几号？','你的生日吗几月几号？','几号吗你的生日月？','你的生日多少岁月？'],'你的生日是几月几号？','几月几号 đã là cấu trúc nghi vấn, không thêm 吗.'),
  q('v136_date_9','fill','我今年二十___。',['岁','号','点','本'],'岁','岁 là đơn vị tuổi.'),
  q('v136_date_10','reading','“今天八月十七号，考试是八月二十号。” Còn mấy ngày tới kỳ thi?',['3 ngày','2 ngày','17 ngày','20 ngày'],'3 ngày','20 - 17 = 3.'),
  q('v136_date_11','grammar','Trong giao tiếp thường ngày, “ngày 5” có thể nói…',['五号','五岁','五点年','五本月'],'五号','号 dùng phổ biến cho ngày trong tháng.'),
  q('v136_date_12','sentence_order','Chọn câu tự nhiên.',['我明天过生日。','我过明天生日。','生日明天过我。','明天生日我过吗。'],'我明天过生日。','Từ thời gian 明天 đứng trước động từ 过.')
 ]},
zh_hsk1_questions:{difficulty:'deep',reward:{coin:150},
 sentencePatterns:[
  ['不 + V/Adj','不 phủ định thói quen, ý muốn, hiện tại/tương lai hoặc tính chất.','我不喝咖啡。'],
  ['没(有) + N/V','没有 phủ định “có”; 没 thường dùng phủ định đã xảy ra/đã có.','我没有书。'],
  ['谁/什么/哪儿/怎么','Từ nghi vấn giữ vị trí của thành phần cần hỏi.','你吃什么？'],
  ['A 还是 B？','还是 dùng trong câu hỏi lựa chọn.','你喝茶还是喝水？']
 ],
 usageNotes:[
  ['不 / 没','不 thường phủ định hiện tại/thói quen/ý định; 没(有) phủ định sở hữu hoặc việc chưa/không xảy ra.'],
  ['吗 và từ nghi vấn','Không ghép 吗 với 谁、什么、哪儿、怎么、几、多少 trong câu hỏi thông tin.'],
  ['都 dōu','“đều”; thường đứng trước vị ngữ: 我们都是学生。']
 ],
 extraQuestions:[
  q('v136_q_7','grammar','Bạn không có sách. Câu nào đúng nhất?',['我没有书。','我不有书。','我书没有是。','我不是有书。'],'我没有书。','Phủ định 有 bằng 没有, không dùng 不有.'),
  q('v136_q_8','grammar','Câu nào sai vì dùng 吗 thừa?',['你去哪儿吗？','你是学生吗？','你喜欢茶吗？','他会写汉字吗？'],'你去哪儿吗？','哪儿 đã là từ để hỏi, không thêm 吗.'),
  q('v136_q_9','fill','你喝茶___喝水？',['还是','吗谁','没有','都不吗'],'还是','还是 dùng để đưa ra lựa chọn trong câu hỏi.'),
  q('v136_q_10','grammar','“Chúng tôi đều là sinh viên.”',['我们都是学生。','我们也都吗学生。','都我们学生是。','我们没都是学生吗。'],'我们都是学生。','都 đứng trước 是/vị ngữ.'),
  q('v136_q_11','reading','“我今天不喝茶，因为家里没有茶。” Có hai phủ định khác nhau vì…',['不 phủ định hành động hiện tại; 没有 phủ định sự tồn tại/sở hữu.','Hai từ hoàn toàn giống nhau.','没有 chỉ dùng với người.','不 chỉ dùng với danh từ.'],'不 phủ định hành động hiện tại; 没有 phủ định sự tồn tại/sở hữu.','Đây là khác biệt cốt lõi giữa 不 và 没有 ở sơ cấp.'),
  q('v136_q_12','sentence_transformation','Chọn câu hỏi tương ứng với “我去学校。” nếu muốn hỏi ĐI ĐÂU.',['你去哪儿？','你去学校吗谁？','你什么去学校吗？','去哪儿吗你？'],'你去哪儿？','Thay thành phần địa điểm 学校 bằng 哪儿 tại đúng vị trí.')
 ]},
zh_hsk1_social:{difficulty:'deep',reward:{coin:150},
 sentencePatterns:[
  ['请 + V','请 dùng để mời/yêu cầu lịch sự.','请坐。— Mời ngồi.'],
  ['请问，...？','Công thức mở đầu câu hỏi lịch sự.','请问，地铁站在哪儿？'],
  ['谢谢 ↔ 不客气','Cặp cảm ơn – đáp lời.','A: 谢谢！ B: 不客气！'],
  ['对不起 ↔ 没关系','Cặp xin lỗi – đáp lời.','A: 对不起。 B: 没关系。']
 ],
 usageNotes:[
  ['吧 ba','Ở giai đoạn mở rộng sơ cấp, 吧 có thể làm lời đề nghị mềm hơn: 我们走吧！— Chúng ta đi nhé!'],
  ['啊/呀 a/ya','Trợ từ cảm thán khẩu ngữ có thể làm câu tự nhiên hơn; Powder chỉ giới thiệu nhận diện, không bắt buộc ở HSK1 core.'],
  ['再见','Dùng khi chia tay; không dùng 不客气 để thay lời tạm biệt.']
 ],
 extraQuestions:[
  q('v136_social_7','situation','Bạn muốn mời người khác ngồi.',['请坐。','没关系。','不客气。','你是谁？'],'请坐。','请 + động từ là mẫu lịch sự cơ bản.'),
  q('v136_social_8','grammar','A: 对不起。 B: ___',['没关系。','谢谢。','不客气。','你好。'],'没关系。','没关系 là đáp lời xin lỗi.'),
  q('v136_social_9','grammar','“我们走吧！” có sắc thái gần nhất là…',['Chúng ta đi nhé!','Chúng ta không đi.','Bạn đi đâu?','Ai đang đi?'],'Chúng ta đi nhé!','吧 làm đề nghị/mệnh lệnh mềm hơn.'),
  q('v136_social_10','situation','Bạn muốn hỏi đường lịch sự.',['请问，银行在哪儿？','银行在哪儿吗谁？','对不起银行是几岁？','不客气，银行谁？'],'请问，银行在哪儿？','请问 là cách mở đầu lịch sự trước câu hỏi thông tin.'),
  q('v136_social_11','reading','A: “谢谢你！” B: “不客气。” Sau đó A nói “再见！” B nên nói…',['再见！','没关系！','太贵了！','你几岁？'],'再见！','再见 là đáp lời chia tay phù hợp.'),
  q('v136_social_12','grammar','Câu cảm thán nào tự nhiên nhất khi nhận tin rất tốt?',['太好了！','好吗太了？','好谁太？','我没有好。'],'太好了！','太 + Adj + 了 là mẫu cảm thán đã học, dùng rất tự nhiên trong giao tiếp.')
 ]}
};
for(const [id,cfg] of Object.entries(zh))apply(id,cfg);

// Complete the HSK1 starter spine to 15 Chinese lessons. The teaching text is original Powder content;
// the scope/count mirrors the published HSK Standard Course 1 structure rather than copying textbook pages.
const newHsk1Lessons=[
 {id:'zh_hsk1_weather',title:'HSK1 · Thời tiết và môi trường quanh mình',language:'ZH',rank:0,difficulty:'deep',level:'HSK1',topic:'HSK1 · Thời tiết & trạng thái hằng ngày',reward:{coin:150},track:'core',
  vocabulary:[['天气','tiānqì','thời tiết'],['下雨','xiàyǔ','mưa'],['晴','qíng','trời quang / nắng'],['热','rè','nóng'],['冷','lěng','lạnh'],['风','fēng','gió'],['衣服','yīfu','quần áo'],['穿','chuān','mặc'],['外面','wàimiàn','bên ngoài'],['里面','lǐmiàn','bên trong'],['开','kāi','mở'],['关','guān','đóng']],
  sentencePatterns:[['天气 + 很 + Adj','Miêu tả thời tiết bằng tính từ.','今天天气很热。'],['下雨了','了 ở cuối câu có thể báo hiệu tình huống mới/thay đổi.','外面下雨了。'],['S + 穿 + quần áo','穿 dùng cho hành động mặc.','我穿一件衣服。'],['外面/里面 + 很 + Adj','Địa điểm có thể làm chủ đề trước vị ngữ tính từ.','外面很冷。']],
  usageNotes:[['了 le','Ở đây chỉ giới thiệu nhận diện “trạng thái mới”: 下雨了 = trời bắt đầu/đang mưa rồi. Chưa yêu cầu dùng mọi nghĩa của 了.'],['很 + tính từ','Giữ quy tắc HSK1: 天气很冷, không dùng *天气是冷.'],['开 / 关','Động từ trái nghĩa thường gặp: 开门 mở cửa; 关门 đóng cửa.']],
  dialogue:[['A','今天天气怎么样？'],['B','很冷，外面也有风。'],['A','下雨了吗？'],['B','没有，但是你多穿一点儿衣服吧。']],
  questions:[
   q('v136_weather_1','choice','“天气” nghĩa là gì?',['thời tiết','quần áo','cửa hàng','sinh nhật'],'thời tiết','天气 = thời tiết.'),
   q('v136_weather_2','hanzi','Chọn chữ đúng cho “mưa”.',['下雨','天气','衣服','外面'],'下雨','下雨 = mưa.'),
   q('v136_weather_3','grammar','Câu nào tự nhiên để nói “Hôm nay rất lạnh”?',['今天很冷。','今天是冷。','今天冷是。','冷今天吗是。'],'今天很冷。','Tính từ làm vị ngữ không cần 是; 很 thường làm câu tự nhiên.'),
   q('v136_weather_4','grammar','“外面下雨了。” cho biết điều gì?',['Bên ngoài bắt đầu/đang mưa rồi.','Bên ngoài không mưa.','Ngày mai chắc chắn mưa.','Ai đang mặc áo?'],'Bên ngoài bắt đầu/đang mưa rồi.','了 ở đây đánh dấu tình huống mới/thay đổi.'),
   q('v136_weather_5','fill','外面很冷，我要___衣服。',['穿','吃','写','喝'],'穿','穿 + 衣服 = mặc quần áo.'),
   q('v136_weather_6','sentence_order','Chọn câu đúng.',['今天天气很好。','今天很好天气是。','天气今天好很是。','很今天气天好。'],'今天天气很好。','Thời gian + chủ đề + 很 + tính từ.'),
   q('v136_weather_7','grammar','Phủ định “hôm nay không nóng” là…',['今天不热。','今天没热是。','今天不是热。','不今天热吗。'],'今天不热。','Tính từ thường phủ định bằng 不.'),
   q('v136_weather_8','reading','“外面很热，里面很冷。” Nơi nào lạnh?',['Bên trong','Bên ngoài','Cả hai','Không nơi nào'],'Bên trong','里面很冷 = bên trong lạnh.'),
   q('v136_weather_9','situation','Trời chuyển mưa, câu cảm thán/thông báo tự nhiên nhất là…',['下雨了！','雨谁吗？','是下雨冷。','不客气雨。'],'下雨了！','Câu ngắn với 了 báo tình huống mới rất tự nhiên.'),
   q('v136_weather_10','grammar','Chọn cặp trái nghĩa đúng.',['开 / 关','热 / 本','外面 / 岁','天气 / 谁'],'开 / 关','开 = mở; 关 = đóng.'),
   q('v136_weather_11','reading','“今天晴，但是风很大。” Điều nào đúng?',['Trời quang nhưng gió mạnh.','Trời mưa và không gió.','Trời lạnh vì có tuyết.','Không nói về thời tiết.'],'Trời quang nhưng gió mạnh.','晴 = quang/nắng; 风很大 = gió mạnh.'),
   q('v136_weather_12','situation','Bạn thấy ngoài trời rất lạnh và nhắc bạn mặc áo. Chọn câu phù hợp nhất.',['外面很冷，多穿一点儿衣服。','外面是谁衣服？','衣服天气吗？','我很开天气。'],'外面很冷，多穿一点儿衣服。','Kết hợp nhận xét thời tiết và lời nhắc hành động.')
  ]},
 {id:'zh_hsk1_shopping',title:'HSK1 · Mua sắm, giá cả và màu sắc',language:'ZH',rank:0,difficulty:'deep',level:'HSK1',topic:'HSK1 · Giá cả, lượng từ & lựa chọn',reward:{coin:155},track:'core',
  vocabulary:[['钱','qián','tiền'],['块','kuài','đồng / tệ (khẩu ngữ)'],['元','yuán','nhân dân tệ / đồng tệ'],['贵','guì','đắt'],['便宜','piányi','rẻ'],['颜色','yánsè','màu sắc'],['红','hóng','đỏ'],['白','bái','trắng'],['黑','hēi','đen'],['件','jiàn','lượng từ cho áo/quần/sự việc'],['给','gěi','đưa / cho'],['找','zhǎo','tìm; trả lại tiền thừa']],
  sentencePatterns:[['这个多少钱？','多少钱 hỏi giá.','这个多少钱？— Cái này bao nhiêu tiền?'],['số + 块/元','Nói giá tiền.','二十块。 / 二十元。'],['太 + Adj + 了','Cảm thán mức độ, rất hữu ích khi mua hàng.','太贵了！— Đắt quá!'],['给 + người + vật','给 có thể diễn đạt “đưa/cho”.','请给我这个。']],
  usageNotes:[['块 / 元','元 là đơn vị chuẩn; 块 rất phổ biến trong khẩu ngữ khi nói giá.'],['件 jiàn','Lượng từ thường dùng cho quần áo: 一件衣服.'],['太贵了','Mẫu cảm thán chứ không phải câu hỏi; muốn hỏi giá vẫn dùng 多少钱.']],
  dialogue:[['A','请问，这件衣服多少钱？'],['B','八十块。'],['A','太贵了。那件呢？'],['B','那件五十块。']],
  questions:[
   q('v136_shop_1','choice','“钱” nghĩa là gì?',['tiền','màu sắc','thời tiết','đường'],'tiền','钱 = tiền.'),
   q('v136_shop_2','hanzi','Chọn chữ đúng cho “đắt”.',['贵','白','找','元'],'贵','贵 = đắt.'),
   q('v136_shop_3','grammar','Câu hỏi giá đúng là…',['这件衣服多少钱？','这件衣服几岁？','多少钱吗这件衣服？','谁钱这件衣服？'],'这件衣服多少钱？','多少钱 là từ nghi vấn, không thêm 吗.'),
   q('v136_shop_4','grammar','Trong ngữ cảnh mua hàng, “太贵了！” gần nghĩa nhất là…',['Đắt quá!','Rẻ quá!','Bao nhiêu tiền?','Tôi không có tiền.'],'Đắt quá!','太 + Adj + 了 tạo cảm thán mức độ.'),
   q('v136_shop_5','fill','一___衣服',['件','本','点','岁'],'件','件 là lượng từ phù hợp cho quần áo.'),
   q('v136_shop_6','grammar','Trong giao tiếp, “20 tệ” có thể nói tự nhiên là…',['二十块','二十本','二十岁','二十天气'],'二十块','块 thường dùng khẩu ngữ để nói tiền.'),
   q('v136_shop_7','reading','A: “这个八十块，那个五十块。” Món nào rẻ hơn?',['那个','这个','Bằng nhau','Không biết'],'那个','50 < 80 nên 那个 rẻ hơn.'),
   q('v136_shop_8','sentence_order','Chọn câu lịch sự nhất khi muốn lấy món này.',['请给我这个。','这个给请我吗谁。','我这个是给。','给这个谁请？'],'请给我这个。','请 + 给 + người + vật là mẫu yêu cầu lịch sự.'),
   q('v136_shop_9','choice','“红、白、黑” thuộc nhóm nào?',['Màu sắc','Ngày tháng','Gia đình','Động từ'],'Màu sắc','红 = đỏ, 白 = trắng, 黑 = đen.'),
   q('v136_shop_10','grammar','Câu nào đúng để nói “cái màu đỏ rẻ”?',['红色的很便宜。','红色是便宜很。','便宜红吗色。','红色的有便宜是。'],'红色的很便宜。','的 có thể danh từ hóa cụm màu sắc trong ngữ cảnh: “cái màu đỏ”.'),
   q('v136_shop_11','situation','Người bán trả tiền thừa cho bạn; 找 trong ngữ cảnh này liên quan tới…',['tiền thừa','màu sắc','mặc áo','đi học'],'tiền thừa','找钱 có nghĩa trả lại tiền thừa.'),
   q('v136_shop_12','reading','“白色的五十块，黑色的八十块。我想买白色的。” Vì sao người nói chọn màu trắng?',['Bản màu trắng rẻ hơn.','Màu đen không có.','Màu trắng đắt hơn.','Không có thông tin giá.'],'Bản màu trắng rẻ hơn.','50 tệ thấp hơn 80 tệ; câu cũng kiểm tra cách dùng 的 thay danh từ đã biết.')
  ]},
 {id:'zh_hsk1_transport',title:'HSK1 · Đi lại và phương hướng cơ bản',language:'ZH',rank:0,difficulty:'deep',level:'HSK1',topic:'HSK1 · Phương tiện, đích đến & vị trí',reward:{coin:160},track:'core',
  vocabulary:[['坐','zuò','ngồi; đi bằng (phương tiện)'],['车','chē','xe'],['出租车','chūzūchē','taxi'],['飞机','fēijī','máy bay'],['火车','huǒchē','tàu hỏa'],['路','lù','đường'],['前面','qiánmiàn','phía trước'],['后面','hòumiàn','phía sau'],['左边','zuǒbian','bên trái'],['右边','yòubian','bên phải'],['到','dào','đến'],['走','zǒu','đi / đi bộ / rời đi']],
  sentencePatterns:[['坐 + phương tiện','坐 dùng để nói đi bằng một phương tiện.','我坐出租车去学校。'],['到 + địa điểm','到 chỉ đạt tới đích.','我八点到学校。'],['A 在 B 的 前面/后面','Mô tả vị trí tương đối.','商店在学校的前面。'],['往/向 + phương hướng','Nhận diện mẫu chỉ hướng; ở HSK1 chỉ luyện qua tình huống đơn giản.','往右边走。']],
  usageNotes:[['坐 zuò','坐车 = đi xe; không dịch máy móc chỉ là “ngồi”.'],['去 / 到','去 nhấn hành động đi đến; 到 nhấn đạt tới đích.'],['前面/后面/左边/右边','Có thể đứng sau 的 để mô tả vị trí tương đối.']],
  dialogue:[['A','请问，医院在哪儿？'],['B','在学校的后面。'],['A','怎么去？'],['B','坐出租车吧，也可以往前走。']],
  questions:[
   q('v136_transport_1','choice','“出租车” nghĩa là gì?',['taxi','máy bay','tàu hỏa','cửa hàng'],'taxi','出租车 = taxi.'),
   q('v136_transport_2','hanzi','Chọn chữ đúng cho “bên phải”.',['右边','左边','前面','后面'],'右边','右边 = bên phải.'),
   q('v136_transport_3','grammar','Câu nào tự nhiên để nói “Tôi đi taxi đến trường”?',['我坐出租车去学校。','我出租车坐是学校。','我去坐学校出租车吗。','学校我出租车是坐。'],'我坐出租车去学校。','坐 + phương tiện + 去 + nơi đến.'),
   q('v136_transport_4','grammar','“我八点到学校。” nhấn mạnh điều gì?',['8 giờ tôi đến/đạt tới trường.','8 giờ tôi rời trường.','Tôi học 8 tiếng.','Trường có 8 người.'],'8 giờ tôi đến/đạt tới trường.','到 nhấn mốc đạt tới đích.'),
   q('v136_transport_5','fill','商店在学校的___。',['前面','天气','块','岁'],'前面','前面 mô tả vị trí phía trước.'),
   q('v136_transport_6','reading','“银行在饭店左边，医院在饭店右边。” Bên phải nhà hàng là gì?',['Bệnh viện','Ngân hàng','Trường học','Taxi'],'Bệnh viện','医院在饭店右边.'),
   q('v136_transport_7','grammar','Câu nào hỏi cách đi đúng?',['怎么去？','去吗怎么？','谁怎么吗去？','去几岁？'],'怎么去？','怎么 hỏi cách thức; không thêm 吗.'),
   q('v136_transport_8','sentence_order','Chọn trật tự tự nhiên.',['我明天坐火车去北京。','我火车明天北京坐去。','北京坐我去明天火车。','明天北京火车我吗去。'],'我明天坐火车去北京。','Chủ ngữ + thời gian + 坐 + phương tiện + 去 + đích.'),
   q('v136_transport_9','situation','Bạn được chỉ “đi về bên phải”. Câu phù hợp là…',['往右边走。','右边是谁？','右边几块？','走是右边吗谁？'],'往右边走。','往 + phương hướng + 走 là mẫu chỉ đường cơ bản.'),
   q('v136_transport_10','grammar','Cặp nào đối lập về phương hướng?',['左边 / 右边','坐 / 钱','火车 / 红','到 / 岁'],'左边 / 右边','Trái và phải là hai hướng đối lập.'),
   q('v136_transport_11','reading','“我不坐飞机，我坐火车去上海。” Người nói đi bằng gì?',['Tàu hỏa','Máy bay','Taxi','Đi bộ'],'Tàu hỏa','不坐飞机 phủ định máy bay; 坐火车 xác định phương tiện.'),
   q('v136_transport_12','situation','Bạn muốn hỏi “Ga tàu ở đâu?” theo cấu trúc đã học.',['火车站在哪儿？','火车站吗在哪儿？','火车站谁岁？','哪儿吗火车站是？'],'火车站在哪儿？','在哪儿 là mẫu hỏi địa điểm; không thêm 吗 khi đã có 哪儿.')
  ]}
];
for(const l of newHsk1Lessons){
 if(byId(l.id))continue;
 const pos=D.lessons.findIndex(x=>x.id==='zh_hsk1_social');
 D.lessons.splice(pos>=0?pos+1:D.lessons.length,0,l);
}

// English B1 review: deeper consolidation before B2 rather than re-teaching A1/A2.
const enDepth={
 en_b1_review_tenses:{patterns:[['Present simple vs continuous','Routine/state vs action around now.','I usually work at home, but this week I am working in the office.'],['Past simple vs present perfect','Finished past time vs life/recent experience connected to now.','I visited Beijing in 2024. / I have visited Beijing twice.'],['for / since','for + duration; since + starting point.','for three years / since May']],qs:[
  q('v136_en_tense_7','grammar','Choose the best option: “I ___ this book twice, so I can recommend it.”',['have read','read yesterday','am reading every day','have reading'],'have read','Present perfect fits repeated experience relevant now.'),
  q('v136_en_tense_8','grammar','Which sentence is correct with a finished past time?',['I met her last Monday.','I have met her last Monday.','I am meeting her last Monday.','I have meet her last Monday.'],'I met her last Monday.','A finished time marker such as last Monday normally takes past simple.'),
  q('v136_en_tense_9','fill','She has worked here ___ 2022.',['since','for','during','ago'],'since','since + starting point; for + duration.'),
  q('v136_en_tense_10','sentence_transformation','Choose the closest meaning: “He started studying Chinese three years ago and still studies it.”',['He has studied Chinese for three years.','He studied Chinese for three years and stopped.','He studies Chinese since three years.','He is study Chinese for three years.'],'He has studied Chinese for three years.','Present perfect links the starting point to the present.'),
  q('v136_en_tense_11','reading','“Normally I take the bus, but this month I am cycling to work.” What is temporary?',['Cycling to work','Taking the bus','Working','The month'],'Cycling to work','Present continuous marks the temporary current arrangement.'),
  q('v136_en_tense_12','grammar','Which pair correctly contrasts routine and current action?',['I usually cook; I am cooking now.','I am usually cook; I cook now.','I have usually cooking; I cooked now.','I cooking usually; I am cook now.'],'I usually cook; I am cooking now.','Present simple = routine; present continuous = action around now.')
 ]},
 en_b1_review_everyday:{patterns:[['Polite requests','Could you / Would you mind… make requests softer.','Could you recommend a café?'],['Common collocations','Learn words in natural combinations, not alone.','make an appointment; catch a train; keep a receipt'],['Phrasal verbs in context','Meaning depends on the whole phrase.','find out = discover; pick up = collect']],qs:[
  q('v136_en_everyday_7','grammar','Which request is the most polite?',['Could you tell me where the station is, please?','Tell me station.','Where station now?','You tell station.'],'Could you tell me where the station is, please?','Could you… please? is a natural polite request.'),
  q('v136_en_everyday_8','choice','Choose the natural collocation for making plans.',['make an appointment','do an appointment','build an appointment','take an appointmenting'],'make an appointment','English collocations are fixed combinations; make an appointment is standard.'),
  q('v136_en_everyday_9','choice','“Find out” is closest to…',['discover information','lose something','cancel a journey','pay a receipt'],'discover information','find out = discover/learn information.'),
  q('v136_en_everyday_10','reading','“Please keep your receipt in case you need to return the item.” Why keep it?',['It may be needed for a return.','It gives a discount automatically.','It is the product manual.','It proves the shop is open.'],'It may be needed for a return.','The phrase in case introduces a possible future need.'),
  q('v136_en_everyday_11','sentence_transformation','Choose the closest polite version of “Recommend a restaurant.”',['Could you recommend a restaurant?','You must recommend restaurant.','Restaurant recommend now.','Do recommend a restaurant you.'],'Could you recommend a restaurant?','Modal could softens the request.'),
  q('v136_en_everyday_12','situation','You cannot attend an appointment. What is the best message?',['I’m sorry, I can’t make the appointment. Could we rearrange it?','Appointment no.','I disappear today.','You change it.'],'I’m sorry, I can’t make the appointment. Could we rearrange it?','A B1/B2-bridge response combines apology, reason/status and a polite solution.')
 ]},
 en_b1_review_comparison:{patterns:[['Comparative + than','Compare two things.','This route is faster than the other one.'],['as ... as','Express equality or inequality.','It is not as expensive as the hotel.'],['much/a bit + comparative','Modify the degree of comparison.','much better / a bit cheaper']],qs:[
  q('v136_en_comp_7','grammar','Choose the correct modifier.',['This option is much cheaper.','This option is very cheaper.','This option is more cheap.','This option much cheap than.'],'This option is much cheaper.','much can intensify a comparative; very normally modifies the base adjective.'),
  q('v136_en_comp_8','fill','The second route is not ___ fast as the first.',['as','than','more','most'],'as','not as + adjective + as expresses inequality.'),
  q('v136_en_comp_9','grammar','Which sentence compares exactly two options correctly?',['The blue one is better than the red one.','The blue one is the best than red.','Blue is more better.','Blue better as red.'],'The blue one is better than the red one.','better is the irregular comparative of good.'),
  q('v136_en_comp_10','sentence_transformation','“The train costs £20. The bus costs £18.” Choose the best comparison.',['The bus is a bit cheaper than the train.','The bus is much most cheap.','The train is as cheap than the bus.','The bus is the cheaper of all transport in the world.'],'The bus is a bit cheaper than the train.','a bit + comparative is suitable for a small difference.'),
  q('v136_en_comp_11','reading','“Hotel A is more central, but Hotel B is quieter and slightly cheaper.” Which advantage belongs to A?',['Location','Quietness','Lower price','All three'],'Location','more central describes Hotel A; the other advantages describe B.'),
  q('v136_en_comp_12','grammar','Choose the natural superlative.',['This is the most convenient option.','This is the more convenient option of all.','This is most convenient than that.','This is the convenientest.'],'This is the most convenient option.','Most + adjective forms the superlative for many longer adjectives.')
 ]},
 en_b1_review_countability:{patterns:[['Countable vs uncountable','Countable nouns can use a/an and plural forms; many uncountables cannot.','a suggestion / some information'],['a few / a little','a few + countable plural; a little + uncountable.','a few ideas / a little time'],['much / many','many + countable plural; much + uncountable.','many emails / much time']],qs:[
  q('v136_en_count_7','grammar','Choose the correct phrase.',['a piece of information','an information','two informations','many information'],'a piece of information','information is uncountable; piece can count an item of information.'),
  q('v136_en_count_8','fill','We still have ___ time before the train leaves.',['a little','a few','many','an'],'a little','time is uncountable in this meaning.'),
  q('v136_en_count_9','fill','There are ___ useful suggestions in the report.',['a few','a little','much','an'],'a few','suggestions is a countable plural noun.'),
  q('v136_en_count_10','grammar','Which sentence is natural?',['I need some advice.','I need an advice.','I need advices.','I need many advice.'],'I need some advice.','advice is normally uncountable.'),
  q('v136_en_count_11','reading','“We have little time left.” Compared with “a little time”, the speaker suggests…',['there is almost not enough time','there is plenty of time','time is countable','the event is cancelled'],'there is almost not enough time','little without a suggests a negative/insufficient amount.'),
  q('v136_en_count_12','sentence_transformation','Choose the natural equivalent of “not many people”.',['few people','little people','much people','an people'],'few people','few modifies countable plural nouns and suggests a small number.')
 ]},
 en_b1_review_messages:{patterns:[['Polite email request','Use could/would and a clear action.','Could you please confirm the time?'],['Reason + action','Short messages should say what changed and what the reader should do.','The meeting has been moved, so please use Room 12.'],['Appropriate register','Avoid slang in formal/semi-formal messages.','Kind regards / Best wishes']],qs:[
  q('v136_en_msg_7','grammar','Choose the clearest subject line for a changed meeting time.',['Meeting time changed to 3 p.m.','Hello!!!','Important stuff','Read this now'],'Meeting time changed to 3 p.m.','A useful subject line is specific and informative.'),
  q('v136_en_msg_8','sentence_transformation','Choose the more polite version of “Send me the file.”',['Could you please send me the file?','Send file now.','You send file.','File!'],'Could you please send me the file?','Could you please… is an appropriate request form.'),
  q('v136_en_msg_9','reading','Message: “The workshop has been postponed until Friday. Your booking remains valid.” What must attendees change?',['The date','Their booking','The location','Their name'],'The date','postponed until Friday changes the date; booking remains valid.'),
  q('v136_en_msg_10','choice','Which closing best fits a polite semi-formal email?',['Kind regards,','Yo!','Bye forever','No closing needed ever'],'Kind regards,','Kind regards is common in polite professional/semi-formal messages.'),
  q('v136_en_msg_11','grammar','Which sentence clearly confirms an arrangement?',['I can confirm that I will attend on Friday.','I maybe Friday thing.','Friday attended maybe.','I confirmation Friday.'],'I can confirm that I will attend on Friday.','confirm + that-clause clearly states the arrangement.'),
  q('v136_en_msg_12','situation','A class location changes at short notice. Which message is best?',['Today’s class will be in Room 12 instead of Room 4. Please go directly there.','Room changed.','Something happened.','Class maybe somewhere.'],'Today’s class will be in Room 12 instead of Room 4. Please go directly there.','Good practical messages state the change and required action.')
 ]},
 en_b1_review_relatives:{patterns:[['who / which / that','who for people; which for things; that can often replace either in defining clauses.','The person who called… / the book which I bought…'],['where','Refers to places.','the café where we met'],['to + infinitive for purpose','Explain why someone does something.','I called to confirm the booking.']],qs:[
  q('v136_en_rel_7','grammar','Choose the correct relative pronoun. “The woman ___ helped us was very kind.”',['who','where','which place','what'],'who','who refers to people in a relative clause.'),
  q('v136_en_rel_8','fill','This is the café ___ we first met.',['where','who','when person','which he'],'where','where refers to a place.'),
  q('v136_en_rel_9','grammar','Which sentence expresses purpose clearly?',['I went online to check the timetable.','I went online checking because timetable to.','I went online for check timetable.','I went to online checked timetable.'],'I went online to check the timetable.','to + infinitive can express purpose.'),
  q('v136_en_rel_10','sentence_transformation','Combine naturally: “I bought a phone. The phone has a very good camera.”',['I bought a phone that has a very good camera.','I bought a phone where has a camera.','I bought who phone camera.','The phone I bought where camera.'],'I bought a phone that has a very good camera.','that introduces a defining relative clause about a thing.'),
  q('v136_en_rel_11','reading','“We stayed in a town where almost everyone cycled to work.” What does where refer to?',['the town','everyone','work','cycling'],'the town','where connects the relative clause to a place noun.'),
  q('v136_en_rel_12','grammar','Choose the sentence in which “who” is used correctly.',['I spoke to the person who manages the centre.','I spoke to the building who is new.','The bus who arrived was late.','The idea who helped was useful.'],'I spoke to the person who manages the centre.','who is used for people, not things.')
 ]}
};
for(const [id,cfg] of Object.entries(enDepth)){
 const l=byId(id);if(!l)continue;l.difficulty='hard';l.reward={...(l.reward||{}),coin:Math.max(135,Number(l.reward?.coin)||0)};
 l.sentencePatterns=cfg.patterns;l.usageNotes=[['B1 → B2 review','Không học lại A1/A2; phần này yêu cầu chọn cấu trúc theo ngữ cảnh, paraphrase, collocation và reading inference trước khi chuyển B2.']];
 const known=new Set((l.questions||[]).map(x=>x.id));l.questions.push(...cfg.qs.filter(x=>!known.has(x.id)));
}
D.questions=D.lessons.flatMap(l=>(l.questions||[]).map(q=>{q.lessonId=q.lessonId||l.id;q.language=q.language||l.language;return q;}));
D.learningConfig=D.learningConfig||{};D.learningConfig.curriculumVersion='13.6-hsk-deep-language-points';
window.POWDER_LEARNING_DEPTH_V136={version:'13.6',sourceNote:'Original Powder teaching content aligned to HSK syllabus / HSK Standard Course structure; not copied textbook pages.',enhancedChineseLessons:Object.keys(zh),addedQuestions:Object.values(zh).reduce((n,x)=>n+(x.extraQuestions?.length||0),0)+newHsk1Lessons.reduce((n,x)=>n+(x.questions?.length||0),0)+Object.values(enDepth).reduce((n,x)=>n+(x.qs?.length||0),0)};
})();
