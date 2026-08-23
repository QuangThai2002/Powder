(function () {
  'use strict';

  const META = [
    {
      title: 'Người gọi Pow đầu tiên', authority: 'Mầm Tamer', color: '#c98245', accent: '#ffbd6a', scale: 1,
      command: { hp: 0, def: 0, atk: 0, ap: 0, speed: 0, reward: 0 },
      privileges: ['Mở chiến đấu Map với đội hình 5 Pow', 'Khiêu chiến Boss ngày', 'Hồ sơ Tamer cấp Đồng'],
      intro: 'Một bước chân nhỏ mở cánh cửa vào thế giới Pow.'
    },
    {
      title: 'Kẻ bước vào hoang giới', authority: 'Tamer Tập sự', color: '#8dd6ea', accent: '#37e3ff', scale: 1.08,
      command: { hp: 1, def: 0, atk: 0, ap: 0, speed: 0, reward: 0 },
      privileges: ['Lệnh Tamer: +1% HP toàn đội', 'Khung hồ sơ Bạc Lam', 'Hiệu ứng xuất trận Sói Băng'],
      intro: 'Ý chí đã đủ cứng cáp để dẫn dắt một đội Pow thực thụ.'
    },
    {
      title: 'Tamer chính thức', authority: 'Người dẫn đội', color: '#62a9ff', accent: '#49c7ff', scale: 1.18,
      command: { hp: 1, def: 1, atk: 0, ap: 0, speed: 0, reward: 2 },
      privileges: ['Lệnh Tamer: +1% HP, +1% DEF', 'Thưởng Combat +2%', 'Dấu ấn Griffin Trung cấp'],
      intro: 'Tamer đã đủ năng lực chỉ huy năm Pow trong một trận chiến hoàn chỉnh.'
    },
    {
      title: 'Người dẫn dắt tinh anh', authority: 'Tamer Tinh anh', color: '#ae75ff', accent: '#e09aff', scale: 1.3,
      command: { hp: 2, def: 1, atk: 0, ap: 0, speed: 1, reward: 4 },
      privileges: ['Lệnh Tamer: +2% HP, +1% DEF, +1% SPEED', 'Thưởng Combat +4%', 'Rune xuất trận Tinh anh'],
      intro: 'Mỗi mệnh lệnh đều có thể đảo chiều nhịp độ của cả chiến trường.'
    },
    {
      title: 'Chỉ huy bách thú', authority: 'Tamer Chỉ huy', color: '#e7b24a', accent: '#6bb7ff', scale: 1.45,
      command: { hp: 3, def: 2, atk: 1, ap: 1, speed: 0, reward: 7 },
      privileges: ['Lệnh Tamer: +3% HP, +2% DEF, +1% ATK/AP', 'Thưởng Combat +7%', 'Danh hiệu Chỉ huy hiển thị công khai'],
      intro: 'Uy quyền của Tamer bắt đầu lan tỏa, khiến Pow đồng loạt đáp lại mệnh lệnh.'
    },
    {
      title: 'Bậc thầy vạn nguyên tố', authority: 'Tamer Đại sư', color: '#ffd75e', accent: '#fff4b2', scale: 1.65,
      command: { hp: 4, def: 3, atk: 2, ap: 2, speed: 0, reward: 11 },
      privileges: ['Lệnh Tamer: +4% HP, +3% DEF, +2% ATK/AP', 'Thưởng Combat +11%', 'Phượng Hoàng xuất trận và hào quang Đại sư'],
      intro: 'Nguyên tố quy phục, đội hình vận hành như một ý chí duy nhất.'
    },
    {
      title: 'Kẻ chinh phục giới hạn', authority: 'Tamer Tối cao', color: '#a58cff', accent: '#ffe36e', scale: 2.05,
      command: { hp: 5, def: 4, atk: 3, ap: 3, speed: 2, reward: 16 },
      privileges: ['Lệnh Tamer: +5% HP, +4% DEF, +3% ATK/AP, +2% SPEED', 'Thưởng Combat +16%', 'Song Long tinh thể, aura tối cao và intro độc quyền'],
      intro: 'Không còn là người thuần hóa Pow — đây là biểu tượng quyền lực của cả thế giới Powder.'
    }
  ];

  const rankAsset = id => `assets/ranks/rank-${id}.webp?v=13500`;
  const app = () => window.POWDER_APP;
  const getSave = () => app()?.getSave?.() || { rank: 0, settings: {} };
  const rankData = id => window.POWDER_DATA?.ranks?.[Math.max(0, Math.min(6, Number(id) || 0))] || {};
  const meta = id => META[Math.max(0, Math.min(6, Number(id) || 0))];
  const commandLabel = item => {
    const parts = [];
    if (item.hp) parts.push(`HP +${item.hp}%`);
    if (item.def) parts.push(`DEF +${item.def}%`);
    if (item.atk || item.ap) parts.push(`ATK/AP +${Math.max(item.atk, item.ap)}%`);
    if (item.speed) parts.push(`SPEED +${item.speed}%`);
    return parts.length ? parts.join(' · ') : 'Chưa có buff chỉ huy';
  };

  let scheduled = false;
  let introBypass = false;
  let promotionOpen = false;
  let pendingView = '';

  function scheduleDecorate(view = document.body?.dataset?.activeView || '') {
    pendingView = view || pendingView || document.body?.dataset?.activeView || '';
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const nextView = pendingView; pendingView = '';
      decorate(nextView);
    });
  }

  function applyRankClass(node, id) {
    if (!node) return;
    for (let i = 0; i <= 6; i += 1) node.classList.remove(`rank-authority-${i}`);
    node.classList.add(`rank-authority-${id}`);
    node.style.setProperty('--rank-color', meta(id).color);
    node.style.setProperty('--rank-accent', meta(id).accent);
    node.style.setProperty('--rank-power', meta(id).scale);
  }

  function renderTopbar(id) {
    // Header 17.5.8: Tamer progression already has its own navigation page.
    // Remove the duplicate rank/authority card from the global topbar.
    document.querySelectorAll('.topbar-rank-authority').forEach(node => node.remove());
  }

  function renderHome(id) {
    const card = document.querySelector('.rank-card');
    const badge = document.querySelector('#rankBadge');
    const sub = document.querySelector('#rankSub');
    if (!card || !badge || !sub) return;
    const signature = `${id}:3911`;
    applyRankClass(card, id);
    applyRankClass(badge, id);
    const r = rankData(id), m = meta(id);
    if (badge.dataset.rankSignature !== signature || !badge.querySelector('.rank-energy-ring')) {
      badge.dataset.rankSignature = signature;
      badge.innerHTML = `<span class="rank-energy-ring"></span><span class="rank-energy-core"></span><img src="${rankAsset(id)}" alt="${r.name || ''}"><span class="rank-badge-tier">${r.badge || id + 1}</span>`;
    }
    let detail = card.querySelector('.rank-authority-copy');
    if (!detail) {
      detail = document.createElement('div');
      detail.className = 'rank-authority-copy';
      sub.insertAdjacentElement('afterend', detail);
    }
    if (detail.dataset.rankSignature !== signature) {
      detail.dataset.rankSignature = signature;
      detail.innerHTML = `<strong>${m.title}</strong><span>${m.intro}</span><small>⚔ Lệnh Tamer: ${commandLabel(m.command)}</small>`;
    }
  }

  function renderTamerBanner(id) {
    const view = document.querySelector('#tamerView');
    const grid = document.querySelector('#rankGrid');
    if (!view || !grid) return;
    let banner = view.querySelector('.current-rank-authority-banner');
    if (!banner) {
      banner = document.createElement('article');
      banner.className = 'current-rank-authority-banner panel';
      grid.insertAdjacentElement('beforebegin', banner);
    }
    const signature = `${id}:3911`;
    if (banner.dataset.rankSignature === signature && banner.querySelector('.authority-banner-emblem')) return;
    banner.dataset.rankSignature = signature;
    applyRankClass(banner, id);
    const r = rankData(id), m = meta(id);
    banner.innerHTML = `<div class="authority-banner-emblem"><span class="rank-energy-ring"></span><img src="${rankAsset(id)}" alt="${r.name || ''}"></div>
      <div class="authority-banner-copy"><p class="eyebrow">TAMER AUTHORITY · CẤP ${id + 1}/7</p><h2>${r.name || ''} — ${m.title}</h2><p>${m.intro}</p><div class="authority-command"><b>Lệnh Tamer hiện tại</b><span>${commandLabel(m.command)}</span><small>Thưởng chiến đấu +${m.command.reward}%</small></div></div>
      <div class="authority-meter"><span>UY QUYỀN</span><i><b style="width:${((id + 1) / 7) * 100}%"></b></i><strong>${Math.round(((id + 1) / 7) * 100)}%</strong></div>`;
  }

  function rankCard(r, index, current) {
    const m = meta(index);
    const locked = index > current;
    const req = r.req ? `<span>Thi ${r.exam}%</span>` : '<span>Cấp tối đa</span>';
    const privileges = m.privileges.map(item => `<li>${item}</li>`).join('');
    return `<article data-rank-authority-card class="rank-item authority-rank-card rank-theme-${index} rank-authority-${index} ${index === current ? 'current' : ''} ${locked ? 'locked' : ''} ${index >= 5 ? 'rank-grand' : ''}" style="--rank-color:${m.color};--rank-accent:${m.accent};--rank-power:${m.scale}">
      <div class="rank-card-glow"></div><div class="authority-rank-badge"><span class="rank-energy-ring"></span><span class="rank-energy-core"></span><img src="${rankAsset(index)}" alt="${r.name}"><span class="rank-level-mark">${index + 1}</span></div>
      <div class="authority-rank-heading"><span>${m.authority}</span><h2>${r.name}</h2><strong>${m.title}</strong><small>${r.en}<br>${r.zh}</small></div>
      <p class="authority-rank-intro">${m.intro}</p>
      <div class="authority-rank-command"><b>Lệnh Tamer</b><span>${commandLabel(m.command)}</span><small>Thưởng Combat +${m.command.reward}%</small></div>
      <ul>${privileges}</ul>
      <footer><span>PowBall ${window.POWDER_DATA?.rarities?.find(x => x.id === r.chest)?.name || r.chest}</span>${req}</footer>
      ${locked ? '<div class="rank-lock-veil"><span>🔒</span><b>Chưa đạt quyền hạn</b></div>' : ''}
    </article>`;
  }

  function renderRankGrid(id) {
    const grid = document.querySelector('#rankGrid');
    const ranks = window.POWDER_DATA?.ranks || [];
    if (!grid || ranks.length !== 7) return;
    const signature = `${id}:${ranks.length}:3913`;
    if (grid.dataset.rankAuthoritySignature === signature && grid.querySelector('[data-rank-authority-card]')) return;
    grid.dataset.rankAuthoritySignature = signature;
    grid.classList.add('authority-rank-grid');
    grid.innerHTML = ranks.map((r, index) => rankCard(r, index, id)).join('');
  }

  function renderCombatSeal(id) {
    const shell = document.querySelector('#battle5v5Mount .b392-shell');
    if (!shell) return;

    // Remove the old floating seal because it could cover the battle heading.
    shell.querySelectorAll('.tamer-combat-seal').forEach(node => node.remove());

    const toolbarInfo = shell.querySelector('.b392-toolbar > div:first-child');
    if (!toolbarInfo) return;
    let seal = toolbarInfo.querySelector('.tamer-combat-command');
    if (!seal) {
      seal = document.createElement('aside');
      seal.className = 'tamer-combat-command';
      toolbarInfo.appendChild(seal);
    }

    const signature = `${id}:3913`;
    if (seal.dataset.rankSignature === signature && seal.querySelector('img')) return;
    seal.dataset.rankSignature = signature;
    applyRankClass(seal, id);
    const r = rankData(id), m = meta(id);
    seal.title = `Lệnh Tamer ${r.name || ''}: ${commandLabel(m.command)}. Thưởng Combat +${m.command.reward}%`;
    seal.innerHTML = `<img src="${rankAsset(id)}" alt="${r.name || ''}"><span><small>LỆNH TAMER</small><b>${r.name || ''}</b><em>${commandLabel(m.command)}</em></span><strong>+${m.command.reward}% thưởng</strong>`;
  }

  function decorate(view = document.body?.dataset?.activeView || '') {
    const rank = Math.max(0, Math.min(6, Number(getSave().rank) || 0));
    document.documentElement.dataset.tamerRank = String(rank);
    renderTopbar(rank);
    if (view === 'home' || !view) renderHome(rank);
    if ((view === 'tamer' || !view) && !document.querySelector('#tamerView.tamer-hub-v142')) {
      renderTamerBanner(rank);
      renderRankGrid(rank);
    }
    if (view === 'battle' || !view) renderCombatSeal(rank);
  }

  function removeOverlay(node) {
    if (!node) return;
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 280);
  }

  function showCombatIntro(rank, onDone) {
    const r = rankData(rank), m = meta(rank);
    const save = getSave();
    const reduced = Boolean(save.settings?.reducedMotion);
    const duration = reduced ? 450 : [850, 1000, 1150, 1350, 1600, 1900, 2350][rank];
    const overlay = document.createElement('div');
    overlay.className = `rank-combat-intro rank-authority-${rank}`;
    overlay.style.setProperty('--rank-color', m.color);
    overlay.style.setProperty('--rank-accent', m.accent);
    overlay.innerHTML = `<div class="rank-intro-beam beam-left"></div><div class="rank-intro-beam beam-right"></div><div class="rank-intro-runes"></div>
      <section><div class="rank-intro-emblem"><span class="rank-energy-ring"></span><span class="rank-energy-core"></span><img src="${rankAsset(rank)}" alt="${r.name || ''}"></div>
      <p>${m.authority.toUpperCase()} XUẤT TRẬN</p><h2>${r.name}</h2><strong>${m.title}</strong>
      <div class="rank-intro-command"><b>LỆNH TAMER</b><span>${commandLabel(m.command)}</span><em>Thưởng Combat +${m.command.reward}%</em></div></section>`;
    document.body.appendChild(overlay);
    setTimeout(() => {
      removeOverlay(overlay);
      setTimeout(() => onDone?.(), 250);
    }, duration);
  }

  function handleCombatLaunch(event) {
    const button = event.target.closest?.('[data-b393-launch]');
    if (!button || introBypass || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    introBypass = true;
    const rank = Math.max(0, Math.min(6, Number(getSave().rank) || 0));
    showCombatIntro(rank, () => {
      button.click();
      setTimeout(() => { introBypass = false; }, 0);
    });
  }

  function promotionOverlay(fromRank, toRank) {
    if (promotionOpen) return;
    promotionOpen = true;
    try { localStorage.setItem('powder_rank_visual_3911', String(toRank)); } catch (_) {}
    const oldR = rankData(fromRank), nextR = rankData(toRank), m = meta(toRank), previous = meta(fromRank);
    const overlay = document.createElement('div');
    overlay.className = `rank-promotion-overlay rank-authority-${toRank}`;
    overlay.style.setProperty('--rank-color', m.color);
    overlay.style.setProperty('--rank-accent', m.accent);
    overlay.innerHTML = `<div class="promotion-sky"></div><div class="promotion-runes"></div><section class="rank-promotion-card">
      <p class="eyebrow">TAMER RANK ASCENSION</p><h1>THĂNG CẤP TAMER</h1>
      <div class="promotion-emblems"><div class="promotion-old"><img src="${rankAsset(fromRank)}" alt="${oldR.name || ''}"><span>${oldR.name || ''}</span></div><i>➜</i><div class="promotion-new"><span class="rank-energy-ring"></span><img src="${rankAsset(toRank)}" alt="${nextR.name || ''}"><span>${nextR.name || ''}</span></div></div>
      <h2>${m.title}</h2><p>${m.intro}</p>
      <div class="promotion-command-change"><span>Quyền lực cũ<small>${commandLabel(previous.command)}</small></span><b>ĐÃ NÂNG CẤP</b><span>Quyền lực mới<small>${commandLabel(m.command)}</small></span></div>
      <div class="promotion-privileges"><h3>ĐẶC QUYỀN VỪA MỞ</h3>${m.privileges.map(item => `<div>✦ ${item}</div>`).join('')}</div>
      <button class="btn primary" data-close-rank-promotion>Nhận quyền hạn mới</button>
    </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close-rank-promotion]')?.addEventListener('click', () => {
      try { localStorage.setItem('powder_rank_visual_3911', String(toRank)); } catch (_) {}
      removeOverlay(overlay);
      promotionOpen = false;
      scheduleDecorate();
    });
  }

  function installPromotionWatcher() {
    const key = 'powder_rank_visual_3911';
    let current = Math.max(0, Math.min(6, Number(getSave().rank) || 0));
    let lastShownRank = current;
    let stored;
    try { stored = localStorage.getItem(key); } catch (_) { stored = null; }
    if (stored === null) { try { localStorage.setItem(key, String(current)); } catch (_) {} }
    const check = () => {
      if (document.hidden) return;
      const next = Math.max(0, Math.min(6, Number(getSave().rank) || 0));
      let seen = current;
      try { seen = Number(localStorage.getItem(key)); } catch (_) {}
      if (!Number.isFinite(seen)) seen = current;
      const changed = next !== current;
      if (next > seen && next > lastShownRank) {
        lastShownRank = next;
        try { localStorage.setItem(key, String(next)); } catch (_) {}
        promotionOverlay(Math.max(0, next - 1), next);
      } else if (next !== seen) {
        try { localStorage.setItem(key, String(next)); } catch (_) {}
      }
      current = next;
      if (changed) scheduleDecorate(document.body?.dataset?.activeView || '');
    };
    window.addEventListener('powder:rendered', check, {passive:true});
    window.addEventListener('powder:world-state', check, {passive:true});
    window.addEventListener('powder:economy-state', check, {passive:true});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); }, {passive:true});
  }

  function boot() {
    if (!app() || !window.POWDER_DATA) return setTimeout(boot, 80);
    document.addEventListener('click', handleCombatLaunch, true);
    window.addEventListener('powder:view-changed',e=>scheduleDecorate(e?.detail?.view||''),{passive:true});
    window.addEventListener('powder:rendered',e=>{const v=e?.detail?.view||document.body?.dataset?.activeView||'';if(v==='home'||v==='tamer'||v==='battle')scheduleDecorate(v)},{passive:true});
    installPromotionWatcher();
    decorate();
    window.POWDER_RANK_SYSTEM = { meta: META, decorate, showCombatIntro, showPromotion: promotionOverlay };
  }

  boot();
})();
