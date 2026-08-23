(()=>{'use strict';
const I=(id,name,en,icon,theme,story,lesson,elements,boss,pool,words,accent)=>({id,name,en,icon,theme,story,lesson,elements,boss,pool,words,accent});
const W=(vi,zh,py,en)=>({vi,zh,py,en});
const islands=[
I(1,'Đảo Khởi Nguyên','Dawnshore','🌅','Bờ Biển Bình Minh','Ngôi làng đầu tiên của Tamer đang bị Màn Sương Vô Ngôn phủ kín. Những Pow non trẻ quên mất tên gọi quen thuộc và không còn hiểu lời con người. Hãy khôi phục Ngữ Ấn đầu tiên.','Chào hỏi · số đếm · màu sắc · câu cơ bản',['fire','water','leaf','earth'],'gearbit',['pyroon','aquabub','mosshorn','terrapup','zephyroo','voltkit','gearbit','cindlet','brookfin','spriggle'],[
W('xin chào','你好','nǐ hǎo','hello'),W('cảm ơn','谢谢','xiè xie','thank you'),W('tạm biệt','再见','zài jiàn','goodbye'),W('một','一','yī','one'),W('hai','二','èr','two'),W('ba','三','sān','three'),W('đỏ','红色','hóng sè','red'),W('xanh lam','蓝色','lán sè','blue'),W('bạn','你','nǐ','you'),W('tôi','我','wǒ','I / me')],'#71d8ff'),
I(2,'Hỏa Lâm','Emberwild','🔥','Rừng Tro Đỏ','Ngữ Ấn Hỏa bị vỡ khiến thời gian sinh hoạt của cư dân rối loạn. Pow lửa chạy theo những nhịp ngày đêm sai lệch.','Thời gian · hoạt động hằng ngày',['fire','lava'],'blazetalon',['cindlet','embermole','emberix','ashmane','magmafang','lavarax','volcarnos','pyroon','blazetalon'],[
W('hôm nay','今天','jīn tiān','today'),W('ngày mai','明天','míng tiān','tomorrow'),W('buổi sáng','早上','zǎo shang','morning'),W('buổi tối','晚上','wǎn shang','evening'),W('ăn','吃','chī','eat'),W('uống','喝','hē','drink'),W('làm việc','工作','gōng zuò','work'),W('nghỉ ngơi','休息','xiū xi','rest'),W('bây giờ','现在','xiàn zài','now'),W('mấy giờ','几点','jǐ diǎn','what time')],'#ff704d'),
I(3,'Thủy Cảng Azure','Azure Port','🌊','Cảng Lam Triều','Các tuyến thương thuyền bị mắc kẹt vì người bán và người mua không còn hiểu nhau. Tamer phải tái kết nối ngôn ngữ trao đổi.','Mua sắm · đồ ăn · giá cả',['water'],'tidecrest',['brookfin','coralyn','streami','torrento','hydripple','tidefang','tidewarden','aquabub','tidecrest'],[
W('bao nhiêu tiền','多少钱','duō shao qián','how much'),W('mua','买','mǎi','buy'),W('bán','卖','mài','sell'),W('rẻ','便宜','pián yi','cheap'),W('đắt','贵','guì','expensive'),W('nước','水','shuǐ','water'),W('cơm','米饭','mǐ fàn','rice'),W('thịt','肉','ròu','meat'),W('ngon','好吃','hǎo chī','delicious'),W('hóa đơn','账单','zhàng dān','bill')],'#36b9ff'),
I(4,'Lục Mộc Sylvara','Sylvara','🌿','Rừng Sinh Mệnh','Cây Ngữ Mạch đang khô héo. Những từ ngữ về thiên nhiên và cơ thể biến mất trước tiên, làm liên kết giữa Pow trị liệu và cư dân suy yếu.','Thiên nhiên · cơ thể · trạng thái',['leaf','poison'],'bloomlord',['spriggle','bramblet','budtail','vinerex','thornclaw','toxiclaw','verdantusk','thorncrest','bloomlord'],[
W('cây','树','shù','tree'),W('hoa','花','huā','flower'),W('mưa','雨','yǔ','rain'),W('gió','风','fēng','wind'),W('đầu','头','tóu','head'),W('tay','手','shǒu','hand'),W('mệt','累','lèi','tired'),W('khỏe','健康','jiàn kāng','healthy'),W('ngủ','睡觉','shuì jiào','sleep'),W('giúp đỡ','帮助','bāng zhù','help')],'#64d67d'),
I(5,'Thiết Thành Ferrum','Ferrum Citadel','⚙️','Thành Phố Kỷ Luật','Ferrum sống theo nhịp học tập, công việc và trách nhiệm hằng ngày. Khi Ngữ Ấn nhiễu loạn, lịch trình và nhiệm vụ của cả thành phố bị đảo lộn.','Học tập · công việc thường ngày · trách nhiệm',['steel','earth'],'ironmane',['rivetoad','tinwing','ferrolyn','steelpaw','ironmantis','gearbit','pebblit','ironmane','bouldrax'],[
W('học tập','学习','xué xí','study'),W('công việc','工作','gōng zuò','work'),W('đồng nghiệp','同事','tóng shì','colleague'),W('nhiệm vụ','任务','rèn wu','task'),W('hoàn thành','完成','wán chéng','complete'),W('đúng giờ','准时','zhǔn shí','on time'),W('quan trọng','重要','zhòng yào','important'),W('giúp đỡ','帮忙','bāng máng','help'),W('nghỉ ngơi','休息','xiū xi','rest'),W('trách nhiệm','负责','fù zé','be responsible for')],'#9bb7c5'),
I(6,'Thiên Phong Aeris','Aeris Reach','🪽','Quần Đảo Trên Mây','Những cây cầu gió chỉ mở khi Tamer đọc đúng chỉ dẫn. Mỗi sai lệch phương hướng đều đưa đoàn thám hiểm vào tầng mây nguy hiểm.','Du lịch · phương hướng · phương tiện',['wind','storm'],'galehowl',['whisprill','windlet','aeralune','skydart','stormdash','stormcoil','zephyroo','galehowl','tempestrix'],[
W('trái','左边','zuǒ biān','left'),W('phải','右边','yòu biān','right'),W('phía trước','前面','qián miàn','ahead'),W('phía sau','后面','hòu miàn','behind'),W('ga tàu','火车站','huǒ chē zhàn','train station'),W('sân bay','机场','jī chǎng','airport'),W('vé','票','piào','ticket'),W('đi bộ','走路','zǒu lù','walk'),W('đến','到达','dào dá','arrive'),W('khởi hành','出发','chū fā','depart')],'#81e7ec'),
I(7,'Lôi Đình Voltara','Voltara','⚡','Tháp Sét Cộng Hưởng','Voltara thử thách khả năng mô tả tình huống, nhờ giúp đỡ và đưa ra quyết định. Màn Sương khiến thông tin giữa các nhóm bị hiểu sai.','Nhờ giúp · mô tả vấn đề · xác nhận kết quả',['lightning','storm'],'thunderos',['joltail','sparkit','voltraptor','arclynx','voltfang','thunderhorn','stormdash','voltkit','thunderos'],[
W('giúp đỡ','帮忙','bāng máng','help'),W('vấn đề','问题','wèn tí','problem'),W('tình hình','情况','qíng kuàng','situation'),W('nguyên nhân','原因','yuán yīn','reason'),W('giải quyết','解决','jiě jué','solve'),W('xác nhận','确认','què rèn','confirm'),W('trước tiên','先','xiān','first'),W('sau đó','然后','rán hòu','then'),W('kịp thời','及时','jí shí','in time'),W('kết quả','结果','jié guǒ','result')],'#ffd94d'),
I(8,'Băng Vực Cryora','Cryora','❄️','Biển Băng Trắng','Bão băng khóa kín lời nói trong hơi thở. Muốn vượt qua Cryora, Tamer phải hiểu thời tiết, trang phục và những câu giao tiếp sinh tồn.','Thời tiết · trang phục · tình huống',['ice','water'],'glacior',['frostfeather','frostwing','frostpelt','hydripple','tidewarden','streami','frostmaw','glacior'],[
W('lạnh','冷','lěng','cold'),W('nóng','热','rè','hot'),W('tuyết','雪','xuě','snow'),W('áo khoác','外套','wài tào','coat'),W('giày','鞋','xié','shoes'),W('cẩn thận','小心','xiǎo xīn','be careful'),W('nguy hiểm','危险','wēi xiǎn','dangerous'),W('ở đâu','在哪里','zài nǎ lǐ','where'),W('tôi hiểu','我明白','wǒ míng bai','I understand'),W('tôi không hiểu','我不明白','wǒ bù míng bai','I do not understand')],'#9edfff'),
I(9,'Độc Trạch Venara','Venara Mire','☣️','Đầm Lầy Lục Độc','Venara không tấn công bằng sức mạnh trực tiếp mà bằng thông tin sai lệch. Tamer phải phân biệt cảnh báo, nguyên nhân và hậu quả trước khi độc khí lan rộng.','An toàn · nguyên nhân · điều kiện',['poison','leaf','dark'],'vilexis',['toxiclaw','venomtail','bramblet','gloompelt','thornclaw','vinerex','vilexis','venomarch'],[
W('an toàn','安全','ān quán','safe'),W('nguy hiểm','危险','wēi xiǎn','danger'),W('bởi vì','因为','yīn wèi','because'),W('cho nên','所以','suǒ yǐ','therefore'),W('nếu','如果','rú guǒ','if'),W('cần phải','需要','xū yào','need to'),W('không được','不能','bù néng','must not'),W('bảo vệ','保护','bǎo hù','protect'),W('nguyên nhân','原因','yuán yīn','cause'),W('kết quả','结果','jié guǒ','result')],'#75d85b'),
I(10,'Quang Đô Solaria','Solaria','☀️','Thánh Thành Nhật Quang','Ngữ Ấn ánh sáng lưu giữ cách con người hợp tác. Hội đồng Solaria chỉ mở cổng khi Tamer chứng minh khả năng giao tiếp lịch sự và rõ ràng.','Họp · lịch sự · phối hợp công việc',['light','steel','wind'],'solarion',['sunfeather','ironmane','aeralune','coralyn','solarion','luxarion','zephyrion'],[
W('xin vui lòng','请','qǐng','please'),W('xin lỗi','对不起','duì bu qǐ','sorry'),W('không sao','没关系','méi guān xi','no problem'),W('cuộc họp','会议','huì yì','meeting'),W('kế hoạch','计划','jì huà','plan'),W('tiến độ','进度','jìn dù','progress'),W('hoàn thành','完成','wán chéng','complete'),W('đồng ý','同意','tóng yì','agree'),W('ý kiến','意见','yì jiàn','opinion'),W('hợp tác','合作','hé zuò','cooperate')],'#ffe487'),
I(11,'Ảnh Giới Nocturn','Nocturn','🌑','Vực Đêm Thì Thầm','Ở nơi gần nguồn Màn Sương nhất, lời nói không còn mang nghĩa cố định. Tamer phải hiểu cảm xúc, ý định và cách phản hồi trong hội thoại phức tạp.','Cảm xúc · ý định · giao tiếp nâng cao',['dark','poison'],'umbrael',['nightclaw','gloompelt','venomtail','toxiclaw','vilexis','umbrael','noxabyss'],[
W('lo lắng','担心','dān xīn','worried'),W('tin tưởng','相信','xiāng xìn','trust'),W('hy vọng','希望','xī wàng','hope'),W('quyết định','决定','jué dìng','decide'),W('thay đổi','改变','gǎi biàn','change'),W('giải thích','解释','jiě shì','explain'),W('hiểu lầm','误会','wù huì','misunderstanding'),W('thực ra','其实','qí shí','actually'),W('có lẽ','可能','kě néng','perhaps'),W('chắc chắn','一定','yí dìng','certainly')],'#9d7cff'),
I(12,'Vương Đảo Khai Nguyên','Origin Crown','👑','Trung Tâm Ngữ Mạch','Mọi Ngữ Ấn hội tụ tại Vương Đảo. Noxabyss đã bị Màn Sương chiếm lấy và đang xóa “Chân Danh” của toàn bộ Pow. Trận chiến cuối cùng đòi hỏi cả sức mạnh đội hình lẫn kiến thức đã học.','Tổng hợp Trung–Anh · phản xạ thực tế',['light','dark','lava','storm','ice','poison'],'noxabyss',['pyrion','aquarion','verdantis','terrakor','zephyrion','thunderos','glacior','vilexis','solarion','umbrael','calderion','magmorax','tempestrix','frostmaw','luxarion','venomarch','noxabyss'],[
W('bắt đầu','开始','kāi shǐ','begin'),W('tiếp tục','继续','jì xù','continue'),W('thành công','成功','chéng gōng','success'),W('thất bại','失败','shī bài','failure'),W('lựa chọn','选择','xuǎn zé','choice'),W('cơ hội','机会','jī huì','opportunity'),W('mục tiêu','目标','mù biāo','goal'),W('kiến thức','知识','zhī shi','knowledge'),W('sức mạnh','力量','lì liàng','power'),W('tương lai','未来','wèi lái','future')],'#ffca58')
];
const eliteBossByIsland={2:['ashmane','magmafang','volcarnos'],3:['torrento','tidewarden','tidefang'],4:['thornclaw','verdantusk','thorncrest'],5:['ferrolyn','ironmantis','bouldrax'],6:['skydart','stormcoil','zephyrion'],7:['voltraptor','thunderhorn','voltfang'],8:['frostwing','frostpelt','frostmaw'],9:['toxiclaw','venomtail','venomarch'],10:['sunfeather','luxarion','zephyrion'],11:['gloompelt','nightclaw','vilexis'],12:['magmorax','tempestrix','frostmaw']};
function hashPick(pool,seed){return pool[Math.abs(seed*1103515245+12345)%pool.length];}
function stageCount(island){return island.id===1?10:20;}
function stageKind(islandId,n){if(islandId===1)return n===10?'boss':n===5?'elite':'normal';if(n===20)return'boss';if(n===5||n===10||n===15)return'elite';return'normal';}
function recommendedLevel(i,n){
 if(i===1)return Math.min(10,1+Math.floor((n-1)*1.0));
 const base=8+(i-2)*8;
 return Math.min(100,base+Math.floor((n-1)*.65));
}
function starTarget(i){if(i===1)return 0;return Math.min(6,Math.ceil((i-1)/2));}
function enemyCount(i,n,kind){if(kind==='boss')return 1;if(i===1&&n<=2)return 1;if(i===1&&n<=5)return 2;return 3;}
const RARITY_POWER={common:0,rare:1,super_rare:2,epic:3,legendary:4,mythic:5,ancient:6};
function strongerPool(island,n){
 const data=window.POWDER_DATA?.pows||[], rank=id=>RARITY_POWER[data.find(p=>p.id===id)?.rarity]||0;
 const sorted=[...island.pool].sort((a,b)=>rank(a)-rank(b));
 const cut=n>=16?.50:n>=11?.34:n>=6?.18:0;
 return sorted.slice(Math.min(sorted.length-1,Math.floor(sorted.length*cut)));
}
function learningGate(i,n,kind){
 if(i===1){
  if(n<=2)return {count:3,need:2,threshold:67};
  if(kind==='boss')return {count:8,need:7,threshold:88};
  if(kind==='elite')return {count:6,need:5,threshold:84};
  return {count:4,need:3,threshold:75};
 }
 if(i<=4){if(kind==='boss')return {count:10,need:9,threshold:90};if(kind==='elite')return {count:8,need:7,threshold:88};return {count:6,need:5,threshold:84};}
 if(i<=7){if(kind==='boss')return {count:10,need:9,threshold:90};if(kind==='elite')return {count:9,need:8,threshold:89};return {count:7,need:6,threshold:86};}
 if(i<=11){if(kind==='boss')return {count:10,need:9,threshold:90};if(kind==='elite')return {count:10,need:9,threshold:90};return {count:8,need:7,threshold:88};}
 return {count:10,need:9,threshold:90};
}
function pressureProfile(i,n,kind){
 let pressure=1;
 if(i===1)pressure=kind==='boss'?2:kind==='elite'?2:1;
 else pressure=Math.min(5,2+Math.floor((i-2)/3)+(n>=16?1:0)+(kind==='elite'?1:kind==='boss'?2:0));
 const labels=['','LÀM QUEN','TIÊU CHUẨN','CĂNG THẲNG','KHẮC NGHIỆT','ĐỈNH CAO'];
 const adaptive=i===1?Math.min(1,.88+n*.012):Math.min(1.38,1.02+(i-2)*.025+(n-1)*.004+(kind==='elite'?.05:kind==='boss'?.10:0));
 let scale;
 if(i===1)scale=kind==='boss'?1.50:kind==='elite'?1.18:.92+n*.018;
 else if(kind==='boss')scale=1.62+(i-2)*.075;
 else if(kind==='elite')scale=1.24+(i-2)*.05+(n/20)*.08;
 else scale=1.00+(i-2)*.035+n*.006;
 const initiative=i===1?0:Math.min(24,(i-2)*1.15+(kind==='elite'?8:kind==='boss'?13:2)+(n>=16?3:0));
 const manaStart=kind==='boss'?.95:kind==='elite'?.86:Math.min(.84,.74+(i-1)*.009+(n>=16?.03:0));
 const rageStart=kind==='boss'?Math.min(58,38+i*1.7):kind==='elite'?Math.min(44,28+i*1.1):Math.min(34,20+Math.floor(i/2)+(n>=16?4:0));
 const starBonus=(kind==='boss'?1:kind==='elite'?1:(n>=16&&i>=4?1:0));
 return {pressure,label:labels[pressure],adaptive,scale:Number(scale.toFixed(3)),initiative:Math.round(initiative),manaStart:Number(manaStart.toFixed(2)),rageStart:Math.round(rageStart),starBonus};
}
function buildStages(island){const out=[],count=stageCount(island);for(let n=1;n<=count;n++){
 const kind=stageKind(island.id,n),ec=enemyCount(island.id,n,kind),eliteIndex=n===5?0:n===10?1:2;
 const enemyIds=[], pool=strongerPool(island,n);
 if(kind==='boss')enemyIds.push(island.boss);
 else if(kind==='elite'&&eliteBossByIsland[island.id])enemyIds.push(eliteBossByIsland[island.id][eliteIndex]||pool[0]||island.pool[0]);
 while(enemyIds.length<ec){const pick=hashPick(pool.length?pool:island.pool,island.id*97+n*31+enemyIds.length*17);if(!enemyIds.includes(pick))enemyIds.push(pick);else enemyIds.push((pool.length?pool:island.pool)[(n+enemyIds.length)%Math.max(1,(pool.length?pool:island.pool).length)]);}
 const level=recommendedLevel(island.id,n),progress=(island.id-1)*20+n,pressure=pressureProfile(island.id,n,kind),gate=learningGate(island.id,n,kind);
 const baseStars=starTarget(island.id),recommendedStars=Math.min(7,baseStars+pressure.starBonus);
 const rewardMult=1+(island.id-1)*.045+(kind==='elite'?.18:kind==='boss'?.48:0);
 const baseCoins=kind==='boss'?900+island.id*120:kind==='elite'?420+island.id*60:150+island.id*35;
 const baseExp=kind==='boss'?140+island.id*15:kind==='elite'?75+island.id*8:32+island.id*4;
 out.push({id:`${island.id}-${n}`,islandId:island.id,number:n,kind,name:kind==='boss'?`Ngữ Ấn ${island.name}`:kind==='elite'?`Tinh Anh · ${String(n).padStart(2,'0')}`:`Chặng ${String(n).padStart(2,'0')}`,enemyIds,enemyCount:ec,recommendedLevel:level,recommendedStars,scale:pressure.scale,adaptive:pressure.adaptive,pressure:pressure.pressure,difficultyLabel:pressure.label,initiative:pressure.initiative,manaStart:pressure.manaStart,rageStart:pressure.rageStart,prepCount:gate.count,prepNeed:gate.need,learningThreshold:gate.threshold,rewards:{coins:Math.round(baseCoins*rewardMult),exp:Math.round(baseExp*rewardMult)},storyIndex:progress});
 }return out;}
for(const island of islands)island.stages=buildStages(island);
window.POWDER_ADVENTURE_DATA={version:2,title:'Biên Niên Sử Màn Sương Vô Ngôn',islands,stageCount,islandById:id=>islands.find(x=>x.id===Number(id)),stageById:id=>{for(const i of islands){const s=i.stages.find(x=>x.id===String(id));if(s)return s}return null;}};
})();
