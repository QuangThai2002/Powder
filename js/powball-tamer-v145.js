(()=>{
  'use strict';
  const D=window.POWDER_DATA;
  const G=window.POWDER_GROWTH_V143;
  if(!D)return;
  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmt=value=>Math.max(0,Math.floor(Number(value)||0)).toLocaleString('vi-VN');
  const pct=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
  const rarity=id=>D.rarities.find(x=>x.id===id)||D.rarities[0];
  const rank=id=>D.ranks[Math.max(0,Math.min(D.ranks.length-1,Number(id)||0))]||D.ranks[0];
  const ballName=c=>String(c?.name||rarity(c?.rarity).name).replace(/^Rương\s*Pow\s*/i,'PowBall ').replace(/^Rương\s*/i,'PowBall ');
  const ballAsset=id=>`assets/pow-balls/${id}.webp`;
  const itemThumb=asset=>window.POWDER_ITEM_THUMBNAILS?.[asset]||asset;
  const powThumb=asset=>window.POWDER_THUMBNAILS?.[asset]||asset;
  const rankAsset=id=>`assets/ranks/rank-${id}.webp?v=14200`;
  const rarityCount=Object.fromEntries(D.rarities.map(r=>[r.id,D.pows.filter(p=>p.rarity===r.id).length]));
  const ballPoolCount=c=>(window.POWBALL_SYSTEM?.getRates?.(c.rarity)||c.dropRates||[]).reduce((n,r)=>n+(rarityCount[r.rarity]||0),0);
  const chance=v=>Number.isInteger(Number(v))?`${Number(v)}%`:`${Number(v).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}%`;
  let selectedBallId=null;
  let staticRankPathCache='';
  let staticElementCache='';

  function ensureSelected(save){
    const max=Math.max(0,Math.min(D.chests.length-1,Number(save?.rank)||0));
    if(!selectedBallId||!D.chests.some(c=>c.id===selectedBallId))selectedBallId=D.chests[max]?.id||D.chests[0]?.id;
    return selectedBallId;
  }
  function selectBall(id){if(D.chests.some(c=>c.id===id))selectedBallId=id;return selectedBallId}

  function rateRows(c){
    const rates=window.POWBALL_SYSTEM?.getRates?.(c.rarity)||c.dropRates||[];
    return rates.map(row=>{const r=rarity(row.rarity);return `<div class="pb142-rate-row"><span><i style="--rate:${esc(r.frame)}"></i>${esc(r.name)}</span><b style="color:${esc(r.frame)}">${chance(row.chance)}</b></div>`}).join('');
  }
  function renderPowBall(ctx){
    const save=ctx.save||{},coins=Number(save.coins)||0;
    const selected=ensureSelected(save),c=D.chests.find(x=>x.id===selected)||D.chests[0];
    const idx=D.chests.indexOf(c),r=rarity(c.rarity),unlocked=idx<=Number(save.rank||0),owned=Number(save.chestsOwned?.[c.id]??save.chestsOwned?.[c.rarity])||0,pity=Number(save.pity?.[c.id])||0;
    const totalBalls=D.chests.reduce((n,x)=>n+(Number(save.chestsOwned?.[x.id]??save.chestsOwned?.[x.rarity])||0),0);
    const unlockedCount=Math.min(D.chests.length,Math.max(1,(Number(save.rank)||0)+1));
    const history=Array.isArray(save.chestHistory)?save.chestHistory:[];
    const summary=`
      <article><span>🔮</span><div><small>PowBall đang có</small><b>${fmt(totalBalls)}</b></div></article>
      <article><span><img class="currency-icon-img" src="assets/items/ui-compact/military-coin.webp" alt="Coin"></span><div><small>Coin hiện tại</small><b>${fmt(coins)}</b></div></article>
      <article><span>🔓</span><div><small>Bậc đã mở</small><b>${unlockedCount}/${D.chests.length}</b></div></article>
      <article><span>✨</span><div><small>Lượt mở đã ghi</small><b>${fmt(history.length)}</b></div></article>`;
    const tiers=D.chests.map((ball,i)=>{const rr=rarity(ball.rarity),count=Number(save.chestsOwned?.[ball.id]??save.chestsOwned?.[ball.rarity])||0,isUnlocked=i<=Number(save.rank||0),active=ball.id===c.id;return `<button class="pb142-tier ${active?'is-active':''} ${isUnlocked?'':'is-locked'}" data-powball-select="${esc(ball.id)}" style="--tier:${esc(rr.frame)}" type="button"><span class="pb142-tier-art"><img src="${itemThumb(ballAsset(ball.rarity))}" alt="" loading="lazy" decoding="async"></span><span class="pb142-tier-copy"><small>TIER ${i+1}</small><b>${esc(rr.name)}</b><em>${isUnlocked?`${count} Ball`:'Chưa mở'}</em></span></button>`}).join('');
    const pool=ballPoolCount(c),priceOk=coins>=Number(c.coin||0),canOpen=unlocked&&owned>0&&priceOk;
    const detail=`<article class="pb142-focus" style="--tier:${esc(r.frame)}">
      <div class="pb142-ball-stage"><span class="pb142-aura"></span><img src="${ballAsset(c.rarity)}" alt="${esc(ballName(c))}" decoding="async"><small>POWBALL TIER ${idx+1}</small></div>
      <div class="pb142-ball-info"><div class="pb142-title-row"><div><p class="eyebrow">POWBALL</p><h2>${esc(ballName(c))}</h2><p>Kho khoảng <b>${pool} Pow</b>. Chọn PowBall để xem tỷ lệ, pity và những Pow có thể xuất hiện.</p></div><span class="pb142-owned" style="color:${esc(r.frame)}"><small>SỞ HỮU</small><b>${owned}</b></span></div>
      <div class="pb142-meta-grid"><span><small>Giá mở</small><b>${fmt(c.coin)} Coin</b></span><span><small>Bảo đảm Pow mới</small><b>${pity}/${fmt(c.pity)}</b></span><span><small>Điều kiện</small><b>${esc(c.requirement||'—')}</b></span><span><small>Pow có thể xuất hiện</small><b>${pool} Pow</b></span></div>
      <div class="pb142-pity"><div><span>Bảo đảm Pow mới</span><b>${pity}/${fmt(c.pity)}</b></div><i><b style="width:${Math.min(100,(pity/Math.max(1,Number(c.pity)||1))*100)}%"></b></i></div>
      <div class="pb142-rates"><div class="pb142-block-head"><b>Tỷ lệ phẩm chất</b><small>3 Pow đặc biệt xuất hiện hiếm hơn Pow thường.</small></div>${rateRows(c)}</div>
      <div class="pb142-open-row"><button class="btn primary" data-powball-open="${esc(c.id)}" ${canOpen?'':'disabled'}>${!unlocked?'🔒 Chưa đủ cấp Tamer':owned<=0?'Chưa có PowBall':!priceOk?'Không đủ Coin':'Mở PowBall'}</button><span>${unlocked?'Đã mở quyền sử dụng':'Cần '+esc(c.requirement||'rank phù hợp')} · ${fmt(c.coin)} Coin/lượt</span></div>
      </div></article>`;
    const historyMarkup=history.length?[...history].reverse().slice(0,8).map(h=>{const p=D.pows.find(x=>x.id===h.powId),rr=rarity(h.rarity),ball=rarity(h.ballRarity||h.chestId||h.rarity),upgrade=window.POWBALL_SYSTEM?.isUpgrade?.(h.ballRarity||h.chestId||h.rarity,h.rarity);return `<div class="pb142-history-item ${upgrade?'is-upgrade':''}"><img src="${esc(powThumb(p?.asset||'assets/ui/powder-logo-project.webp'))}" alt="" loading="lazy" decoding="async"><span><b>${esc(p?.name||h.powId)}${h.shiny?' ✨':''}</b><small>${esc(ball.name)} PowBall → <em style="color:${esc(rr.frame)}">${esc(rr.name)}</em>${upgrade?' · Vượt cấp':''}</small></span><time>${new Date(h.time||Date.now()).toLocaleString('vi-VN')}</time></div>`}).join(''):'<div class="pb142-empty"><span>◌</span><b>Chưa có lịch sử mở</b><small>Lần mở PowBall đầu tiên sẽ được ghi tại đây.</small></div>';
    return{summary,tiers,detail,history:historyMarkup,selected:c.id};
  }

  function masteryBars(summary,language){
    const labels={Vocabulary:'Từ vựng',Hanzi:'Hán tự',Grammar:'Ngữ pháp',Reading:'Đọc hiểu',Writing:'Viết'};
    return Object.entries(summary||{}).map(([key,value])=>`<div class="tm142-mastery-row"><div><span>${labels[key]||esc(key)}</span><b>${pct(value)}%</b></div><i><b style="width:${pct(value)}%"></b></i></div>`).join('')||'<p class="muted">Chưa có dữ liệu Mastery.</p>';
  }
  function progressItems(promotion){
    if(promotion?.final)return `<div class="tm142-final-rank"><span>✦</span><div><b>Bạn đã đạt Thách đấu</b><small>Tiếp tục hoàn thiện HSK5/B2, săn Pow và chinh phục những Boss khó nhất.</small></div></div>`;
    const labels={'Bài Trung cốt lõi':'Tiếng Trung bắt buộc','Bài Anh cốt lõi':'Tiếng Anh bắt buộc','Mastery':'Độ thành thạo','Tamer EXP':'Kinh nghiệm Tamer','Trận thắng':'Trận thắng'};
    return (promotion?.items||[]).map(([name,value,max])=>{const ratio=Math.min(100,(Number(value)||0)/Math.max(1,Number(max)||1)*100),done=Number(value)>=Number(max);return `<div class="tm142-progress-row ${done?'is-done':''}"><div><span>${esc(labels[name]||name)}</span><b>${done?'✓ ':''}${fmt(Math.min(Number(value)||0,Number(max)||0))}/${fmt(max)}${name==='Mastery'?'%':''}</b></div><i><b style="width:${ratio}%"></b></i></div>`}).join('');
  }
  function buildRankPath(learning){
    const key=`${D.ranks.length}:${learning?.version||learning?.source||'lm'}`;
    if(staticRankPathCache&&staticRankPathCache.startsWith(`<!--${key}-->`))return staticRankPathCache.slice(key.length+7);
    const html=D.ranks.map((r,i)=>{const curr=learning?.rankInfo?.(i)||{};const reward=rarity(r.chest);return `<article class="tm142-rank-card" data-tm-rank="${i}"><div class="tm142-rank-emblem"><img src="${rankAsset(i)}" alt="${esc(r.name)}" loading="lazy" decoding="async"><span>${i+1}</span></div><div><small>CẤP ${i+1}/7</small><h3>${esc(r.name)}</h3><p>${esc(r.en)} · ${esc(r.zh)}</p><div class="tm142-rank-curr"><span>🇨🇳 ${esc(curr.chinese||'—')}</span><span>🇬🇧 ${esc(curr.english||'—')}</span></div><footer><span>PowBall ${esc(reward.name)}</span><b>${r.req?`Thi ≥ ${r.exam}%`:'Cấp tối đa'}</b></footer></div></article>`}).join('');
    staticRankPathCache=`<!--${key}-->${html}`;return html;
  }
  function buildElements(){
    if(staticElementCache)return staticElementCache;
    const names=ids=>(ids||[]).map(id=>D.elements[id]?.name||id).join(', ')||'—';
    const fusions=(D.fusions||[]).map(f=>{const e=D.elements[f.element]||{};return `<span><b>${e.icon||'✦'} ${esc(f.result)}</b><small>${esc(f.formula)}</small></span>`}).join('');
    const rows=Object.entries(D.elements||{}).map(([id,e])=>`<tr><td><b style="color:${esc(e.color)}">${e.icon||'✦'} ${esc(e.name)}</b></td><td>${esc(names(e.strong))}</td><td>${esc(names(e.weak))}</td><td>${esc(names(e.resist))}</td><td>${esc(names(e.immune))}</td></tr>`).join('');
    staticElementCache=`<div class="tm142-fusions">${fusions}</div><div class="table-scroll"><table class="tm142-element-table"><thead><tr><th>Hệ</th><th>Mạnh</th><th>Yếu</th><th>Kháng</th><th>Miễn nhiễm</th></tr></thead><tbody>${rows}</tbody></table></div>`;return staticElementCache;
  }
  function renderTamer(ctx){
    const save=ctx.save||{},learning=ctx.learning,currentIndex=Math.max(0,Math.min(6,Number(save.rank)||0)),r=rank(currentIndex),curr=learning?.rankInfo?.(currentIndex)||{},next=currentIndex<6?learning?.rankInfo?.(currentIndex+1):null;
    const mastery=learning?.averageMastery?.(save)||Number(save.mastery)||0,zh=learning?.skillMasterySummary?.(save,'ZH')||{},en=learning?.skillMasterySummary?.(save,'EN')||{},today=learning?.todaySummary?.(save)||{total:0,zh:0,en:0},due=learning?.dueQuestions?.(save)?.length||0;
    const coreLessons=(D.lessons||[]).filter(l=>!(learning?.unitMeta?.(l)?.Optional));
    const doneSet=new Set(save.lessonsDone||[]),doneCore=coreLessons.filter(l=>doneSet.has(l.id)).length;
    const ownedCount=Object.keys(save.owned||{}).length,shinyCount=Object.values(save.owned||{}).filter(o=>o?.shiny).length,teamCount=(save.team||[]).length;
    const dailyDone=!!save.bosses?.daily?.completed,weeklyDone=!!save.bosses?.weekly?.completed,adv=save.adventure||{};
    const hero=`<article class="tm142-profile-card rank-${currentIndex}"><div class="tm142-emblem"><span class="tm142-emblem-glow"></span><img src="${rankAsset(currentIndex)}" alt="${esc(r.name)}"><b>${r.badge||currentIndex+1}</b></div><div class="tm142-profile-copy"><p class="eyebrow">TAMER · CẤP ${currentIndex+1}/7</p><h1>${esc(r.name)}</h1><p class="tm142-rank-names">${esc(r.en)} · ${esc(r.zh)}</p><p>Bạn đang ở bậc <b>${esc(r.name)}</b>. Học bài, ôn kiến thức, thắng các thử thách và xây đội hình để tiến tới <b>${esc(next?.name||'đỉnh cao')}</b>.</p><div class="tm142-curriculum-pills"><span>🇨🇳 ${esc(curr.chinese||'—')}</span><span>🇬🇧 ${esc(curr.english||'—')}</span>${curr.support?`<span>🧰 ${esc(curr.support)}</span>`:''}</div></div><div class="tm142-authority"><span>TIẾN ĐỘ 7 BẬC TAMER</span><b>${Math.round((currentIndex+1)/7*100)}%</b><i><em style="width:${(currentIndex+1)/7*100}%"></em></i><small>${next?`Tiếp theo: ${esc(next.name)}`:'Đã đạt Thách đấu'}</small></div></article>`;
    const quick=`<article><span>📚</span><div><small>Bài bắt buộc</small><b>${doneCore}/${coreLessons.length}</b></div></article><article><span>🧠</span><div><small>Độ thành thạo</small><b>${pct(mastery)}%</b></div></article><article><span>⚔️</span><div><small>Trận thắng</small><b>${fmt(save.wins)}</b></div></article><article><span>🐾</span><div><small>Pow sở hữu</small><b>${ownedCount}/${D.pows.length}</b></div></article><article><span>✨</span><div><small>Shiny</small><b>${shinyCount}</b></div></article><article><span>🛡️</span><div><small>Đội hình</small><b>${teamCount}/5</b></div></article>`;
    const remaining=(ctx.promotion?.items||[]).filter(([,value,max])=>Number(value)<Number(max)).length,pending=save.bosses?.promotionPending!=null,nextRank=currentIndex<6?rank(currentIndex+1):null;
    const promotionCta=currentIndex>=6
      ? '<button class="btn secondary tm145-promotion-cta" type="button" disabled>Đã đạt cấp Tamer cao nhất</button>'
      : pending
        ? '<button class="btn primary tm145-promotion-cta" type="button" data-promotion-exam-btn data-promotion-state="boss">Đến Boss thăng rank</button>'
        : ctx.promotion?.ready
          ? `<button class="btn primary tm145-promotion-cta is-ready" type="button" data-promotion-exam-btn data-promotion-state="exam">🎓 Nâng Rank · Thi lên ${esc(nextRank.name)}</button>`
          : `<button class="btn secondary tm145-promotion-cta" type="button" disabled>🔒 Nâng Rank · Còn ${remaining} điều kiện</button>`;
    const promotion=`<div class="tm142-panel-head"><div><p class="eyebrow">MỤC TIÊU TIẾP THEO</p><h2>${currentIndex>=6?'Giữ vững Thách đấu':`Chinh phục ${esc(nextRank.name)}`}</h2><p class="tm145-panel-lead">${currentIndex>=6?'Bạn đã hoàn thành toàn bộ hành trình thăng hạng.':pending?'Bạn đã vượt kỳ thi. Hãy đánh bại Boss cuối.':ctx.promotion?.ready?'Tất cả mục tiêu đã đủ. Nhấn Nâng Rank để làm đề thi.':`Hoàn thành ${remaining} mục còn thiếu để mở kỳ thi.`}</p></div><span class="chip">${pending?'Boss cuối':ctx.promotion?.ready?'Sẵn sàng thi':'Đang tiến bộ'}</span></div>${progressItems(ctx.promotion)}${currentIndex<6?`<p class="tm142-next-note">Khi các thanh đạt yêu cầu, bạn được thi lên <b>${esc(nextRank.name)}</b>. Qua kỳ thi, đánh bại Boss thăng hạng để nhận cấp mới.</p>`:''}<div class="tm145-promotion-actions">${promotionCta}</div>`;
    const masteryHtml=`<div class="tm142-panel-head"><div><p class="eyebrow">ĐỘ THÀNH THẠO</p><h2>Bạn đang nắm chắc phần nào?</h2></div><span class="chip">TB ${pct(mastery)}%</span></div><div class="tm142-mastery-columns"><section><h3>🇨🇳 Tiếng Trung</h3>${masteryBars(zh,'ZH')}</section><section><h3>🇬🇧 Tiếng Anh</h3>${masteryBars(en,'EN')}</section></div>`;
    const curriculum=`<div class="tm142-panel-head"><div><p class="eyebrow">BẠN ĐANG HỌC GÌ?</p><h2>Nội dung của cấp hiện tại</h2></div></div><div class="tm142-track"><span>中</span><div><small>TRUNG VĂN</small><b>${esc(curr.chinese||'—')}</b><p>Từ vựng · Hán tự · Ngữ pháp · Đọc · Viết.</p></div></div><div class="tm142-track"><span>EN</span><div><small>ENGLISH</small><b>${esc(curr.english||'—')}</b><p>Ôn nền B1 và tiến dần tới B2 qua từ vựng, ngữ pháp, đọc và viết.</p></div></div>${curr.support?`<div class="tm142-track optional"><span>+</span><div><small>HỖ TRỢ TÙY CHỌN</small><b>${esc(curr.support)}</b><p>Phần bổ sung để luyện giao tiếp thực tế sau khi đã đủ nền tảng.</p></div></div>`:''}`;
    const activity=`<div class="tm142-panel-head"><div><p class="eyebrow">HÔM NAY</p><h2>Việc bạn có thể tiếp tục</h2></div></div><div class="tm142-activity-grid"><span><small>Bài học hôm nay</small><b>${today.total||0}/6</b><em>中文 ${today.zh||0}/4 · EN ${today.en||0}/2</em></span><span><small>Bài cần ôn</small><b>${due}</b><em>Ôn lại các câu sắp quên</em></span><span><small>Điểm Hiểu Biết</small><b>${fmt(save.knowledge)}</b><em>Dùng để mở Boss ngày</em></span><span><small>Boss ngày</small><b>${dailyDone?'Đã thắng':'Chưa thắng'}</b><em>${weeklyDone?'Boss tuần đã thắng':'Boss tuần đang chờ'}</em></span><span><small>Phiêu lưu</small><b>${fmt(adv.totalStars||0)} ★</b><em>Đảo mở ${fmt(adv.islandsUnlocked||1)}/12</em></span><span><small>Lực chiến đội</small><b>${fmt(ctx.teamPower||0)}</b><em>${teamCount} Pow trong đội</em></span></div>`;
    const growthBands=(G?.bands||[]).map(b=>`<span><b>${esc(b.range)}</b><strong>${fmt(b.xp)} EXP</strong><small>${esc(b.note)}</small></span>`).join('');
    const growth=`<div class="tm142-panel-head"><div><p class="eyebrow">POW CỦA BẠN</p><h2>Làm sao để Pow mạnh lên?</h2></div><span class="chip"><img class="currency-inline-icon" src="assets/items/ui-compact/candy-common.webp" alt=""> Thường 60 · Hiếm 300 · Huyền thoại 1.200 EXP</span></div><p class="tm143-growth-intro">Lv.1–5 lên nhanh để bạn thử Pow mới. Sau Lv.5, hãy <b>hoàn thành bài mới, ôn bài và trả lời đúng khi chiến đấu</b> để nhận nhiều Pow EXP; Kẹo Pow là cách hỗ trợ thêm; mỗi bậc cho lượng EXP khác nhau.</p><div class="tm143-growth-bands">${growthBands}</div><div class="tm143-star-caps">${(G?.STAR_CAPS||[10,20,30,40,50,60,80,100]).map((cap,i)=>`<span><small>${i}★</small><b>Lv.${cap}</b></span>`).join('')}</div><p class="tm143-growth-note">Hoàn thành bài mới với điểm cao cho nhiều EXP nhất. Pow chính nhận toàn bộ EXP, đồng đội nhận một phần; trả lời đúng trong Combat cũng giúp đội hình tăng Level dần.</p>`;
    const ranks=buildRankPath(learning).replaceAll('class="tm142-rank-card"',(_,)=>'class="tm142-rank-card"');
    const rankDecorated=D.ranks.map((_,i)=>'').length; // retained as a zero-cost version marker for static cache
    return{hero,quick,promotion,mastery:masteryHtml,curriculum,activity,growth,ranks:buildRankPath(learning),elements:buildElements(),currentIndex,rankDecorated};
  }
  const api={version:'17.9.9',selectBall,renderPowBall,renderTamer};window.POWDER_POWBALL_TAMER_V142=api;window.POWDER_POWBALL_TAMER_V143=api;window.POWDER_POWBALL_TAMER_V145=api;
})();
