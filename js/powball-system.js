(() => {
  "use strict";

  const D = window.POWDER_DATA;
  if (!D) throw new Error("POWDER_DATA chưa sẵn sàng cho Pow Ball System.");
  const ELIGIBILITY = window.POWDER_PLAYER_POW_ELIGIBILITY_V1;
  if (!ELIGIBILITY) throw new Error("Player Pow eligibility chưa sẵn sàng cho Pow Ball System.");

  const RARITY_ORDER = [
    "common",
    "rare",
    "super_rare",
    "epic",
    "legendary",
    "mythic",
    "ancient",
  ];

  // Tỷ lệ chính thức Beta 4.0.2. Mỗi Pow Ball luôn có tổng 100%.
  const DROP_RATES = Object.freeze({
    common: Object.freeze([
      { rarity: "common", chance: 90 },
      { rarity: "rare", chance: 10 },
    ]),
    rare: Object.freeze([
      { rarity: "common", chance: 22 },
      { rarity: "rare", chance: 70 },
      { rarity: "super_rare", chance: 8 },
    ]),
    super_rare: Object.freeze([
      { rarity: "rare", chance: 30 },
      { rarity: "super_rare", chance: 64 },
      { rarity: "epic", chance: 6 },
    ]),
    epic: Object.freeze([
      { rarity: "super_rare", chance: 34 },
      { rarity: "epic", chance: 62 },
      { rarity: "legendary", chance: 4 },
    ]),
    legendary: Object.freeze([
      { rarity: "super_rare", chance: 9 },
      { rarity: "epic", chance: 35 },
      { rarity: "legendary", chance: 55 },
      { rarity: "mythic", chance: 1 },
    ]),
    mythic: Object.freeze([
      { rarity: "epic", chance: 10 },
      { rarity: "legendary", chance: 60 },
      { rarity: "mythic", chance: 29.95 },
      { rarity: "ancient", chance: 0.05 },
    ]),
    ancient: Object.freeze([
      { rarity: "legendary", chance: 30 },
      { rarity: "mythic", chance: 40 },
      { rarity: "ancient", chance: 30 },
    ]),
  });

  const $ = (selector) => document.querySelector(selector);
  const rarityInfo = (id) => D.rarities.find((item) => item.id === id) || D.rarities[0];
  const elementInfo = (id) => D.elements[id] || { name: id || "Không rõ", icon: "✦", color: "#b8c6ce" };
  const rarityIndex = (id) => Math.max(0, RARITY_ORDER.indexOf(id));
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const powRevealAsset=(asset)=>{const s=String(asset||'');return window.POWDER_COMBAT_ASSETS?.[s]||(s.includes('assets/pow-beta12/')?s.replace('assets/pow-beta12/','assets/pow-combat-512/'):s);};
  const powReelAsset=(asset)=>{const s=String(asset||'');return window.POWDER_THUMBNAILS?.[s]||powRevealAsset(s);};

  function getConfiguredRates(ballRarity) {
    return DROP_RATES[ballRarity] || DROP_RATES.common;
  }

  function getRates(ballRarity) {
    const available = getConfiguredRates(ballRarity)
      .filter((item) => getPool(item.rarity).length > 0);
    const total = available.reduce((sum, item) => sum + Number(item.chance || 0), 0);
    if (total <= 0) return [];
    return available.map((item) => Object.freeze({
      ...item,
      configuredChance: item.chance,
      chance: (Number(item.chance) / total) * 100,
    }));
  }

  function validateRates() {
    const errors = [];
    for (const ball of RARITY_ORDER) {
      const configured = getConfiguredRates(ball);
      const rates = getRates(ball);
      const configuredTotal = configured.reduce((sum, item) => sum + Number(item.chance || 0), 0);
      const total = rates.reduce((sum, item) => sum + Number(item.chance || 0), 0);
      if (Math.abs(configuredTotal - 100) > 0.0001) errors.push(`${ball}: tổng tỷ lệ cấu hình ${configuredTotal}%`);
      if (Math.abs(total - 100) > 0.0001) errors.push(`${ball}: tổng tỷ lệ ${total}%`);
      for (const item of rates) {
        if (!RARITY_ORDER.includes(item.rarity)) errors.push(`${ball}: phẩm chất không hợp lệ ${item.rarity}`);
        if (!getPool(item.rarity).length) errors.push(`${ball}: không có Pow player-eligible ${item.rarity}`);
      }
    }
    return errors;
  }

  function rollRarity(ballRarity, random = Math.random) {
    const rates = getRates(ballRarity);
    let cursor = Math.max(0, Math.min(0.999999999, Number(random()))) * 100;
    for (const item of rates) {
      cursor -= item.chance;
      if (cursor < 0) return item.rarity;
    }
    return rates[rates.length - 1].rarity;
  }

  function getPool(resultRarity) {
    return ELIGIBILITY.filterPlayerPows(D.pows).filter((pow) => pow.rarity === resultRarity);
  }

  function powPickWeight(pow) {
    return ELIGIBILITY.isPlayerEligible(pow) ? 1 : 0;
  }

  function pickPow(list, random = Math.random) {
    const pool = ELIGIBILITY.filterPlayerPows(Array.isArray(list) ? list : []);
    if (!pool.length) return null;
    const total = pool.reduce((sum, pow) => sum + powPickWeight(pow), 0);
    let cursor = Math.max(0, Math.min(0.999999999, Number(random()))) * total;
    for (const pow of pool) {
      cursor -= powPickWeight(pow);
      if (cursor < 0) return pow;
    }
    return pool[pool.length - 1];
  }

  function isUpgrade(ballRarity, resultRarity) {
    return rarityIndex(resultRarity) > rarityIndex(ballRarity);
  }

  function getDuration(ballRarity) {
    // 18.1.0: restore the long CS:GO-style case-opening feel without restoring the old heavy renderer.
    return ["legendary", "mythic", "ancient"].includes(ballRarity) ? 5600 : 5200;
  }

  function formatChance(chance) {
    return Number.isInteger(chance) ? `${chance}%` : `${chance.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
  }

  function rateText(ballRarity) {
    return getRates(ballRarity)
      .map((item) => `${rarityInfo(item.rarity).name} ${formatChance(item.chance)}`)
      .join(" · ");
  }

  function rateMarkup(ballRarity) {
    return `<div class="powball-rate-list" aria-label="Tỷ lệ Pow Ball ${escapeHtml(rarityInfo(ballRarity).name)}">${getRates(ballRarity)
      .map((item) => {
        const rarity = rarityInfo(item.rarity);
        return `<div class="powball-rate-row" style="--drop-color:${rarity.frame}"><span><i></i>${escapeHtml(rarity.name)}</span><b>${formatChance(item.chance)}</b></div>`;
      })
      .join("")}<div class="powball-special-rate-note"><span>✦ POOL NGƯỜI CHƠI</span><b>Chỉ Pow đủ điều kiện xuất hiện</b><small>Tỷ lệ được chuẩn hóa khi một phẩm chất không có Pow hợp lệ.</small></div></div>`;
  }

  function ballPreviewMarkup(ballRarity) {
    const rarity = rarityInfo(ballRarity);
    const tier = rarityIndex(ballRarity) + 1;
    return `<div class="ball-preview powball-tier-${tier} rarity-${ballRarity}" style="--ball-color:${rarity.frame}">
      <span class="powball-preview-ring ring-a"></span>
      <span class="powball-preview-ring ring-b"></span>
      <span class="powball-preview-rune"></span>
      <img class="pow-ball-image" src="assets/pow-balls/${ballRarity}.webp" alt="Pow Ball ${escapeHtml(rarity.name)}">
      <span class="powball-preview-tier">TIER ${tier}</span>
    </div>`;
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function randomReelPow(ballRarity, avoidId) {
    const rolledRarity = rollRarity(ballRarity);
    const pool = getPool(rolledRarity);
    const filtered = pool.filter((pow) => pow.id !== avoidId);
    return pickPow(filtered.length ? filtered : pool) || ELIGIBILITY.filterPlayerPows(D.pows)[0];
  }

  function buildReel(result, count = 30, winningIndex = 25) {
    const items = [];
    for (let index = 0; index < count; index += 1) {
      const pow = index === winningIndex ? result.pow : randomReelPow(result.ballRarityId, result.pow.id);
      items.push({ pow, winning: index === winningIndex });
    }
    return { items, winningIndex };
  }

  function reelCardMarkup(entry) {
    const pow = entry.pow;
    const rarity = rarityInfo(pow.rarity);
    const element = elementInfo(pow.element);
    return `<article class="powball-reel-card rarity-${pow.rarity}${entry.winning ? " is-winning" : ""}" style="--rarity-color:${rarity.frame};--element-color:${element.color}" data-winning="${entry.winning ? "true" : "false"}">
      <div class="powball-reel-aura"></div>
      <div class="powball-reel-art"><img src="${escapeHtml(powReelAsset(pow.asset))}" alt="Pow bí ẩn" loading="eager" decoding="async" fetchpriority="low" width="150" height="148"></div>
      <strong>???</strong>
      <span class="powball-reel-element">${element.icon} ${escapeHtml(element.name)}</span>
      <small>${escapeHtml(rarity.name)}</small>
    </article>`;
  }

  function introMarkup(ballRarity) {
    const rarity = rarityInfo(ballRarity);
    const tier = rarityIndex(ballRarity) + 1;
    return `<div class="powball-opening-shell powball-intro rarity-${ballRarity}" style="--ball-color:${rarity.frame}">
      <div class="powball-sky-grid"></div>
      <div class="powball-intro-runes"><span></span><span></span><span></span></div>
      <div class="powball-magic-floor"></div>
      <div class="powball-intro-orbit orbit-a"></div>
      <div class="powball-intro-orbit orbit-b"></div>
      <div class="powball-intro-ball">
        <img src="assets/pow-balls/${ballRarity}.webp" alt="Pow Ball ${escapeHtml(rarity.name)}">
        <span class="powball-core-pulse"></span>
      </div>
      <div class="powball-intro-copy"><b>POW BALL TIER ${tier}</b><span>${escapeHtml(rarity.name)} đang cộng hưởng</span></div>
    </div>`;
  }

  async function prepareReelImages(root) {
    const images = [...root.querySelectorAll(".powball-reel-art img")];
    if (!images.length) return;
    // Decode every distinct thumbnail before the transform starts. 18.1.0 timed out
    // after ~180 ms, which allowed image decoding to continue during the reel and
    // caused visible frame drops on mid/low GPUs.
    const seen = new Set();
    const jobs = [];
    for (const img of images) {
      img.loading = "eager";
      img.fetchPriority = "low";
      const key = img.currentSrc || img.src;
      if (seen.has(key)) continue;
      seen.add(key);
      if (typeof img.decode === "function") jobs.push(img.decode().catch(() => undefined));
      else if (!img.complete) jobs.push(new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      }));
    }
    await Promise.allSettled(jobs);
    // Give layout/paint one clean frame before promoting the track to the compositor.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function reelMarkup(result, reel) {
    const ballRarity = rarityInfo(result.ballRarityId);
    return `<div class="powball-opening-shell powball-reel-shell rarity-${result.ballRarityId}" style="--ball-color:${ballRarity.frame}">
      <header class="powball-reel-header">
        <img src="assets/pow-balls/${result.ballRarityId}.webp" alt="">
        <div><b>${escapeHtml(result.chestName)}</b><span>Silhouette đã được che · Chỉ lộ hào quang và nguyên tố</span></div>
      </header>
      <div class="powball-reel-window">
        <div class="powball-reel-shade shade-left"></div>
        <div class="powball-reel-shade shade-right"></div>
        <div class="powball-reel-marker"><span></span></div>
        <div class="powball-reel-track">${reel.items.map(reelCardMarkup).join("")}</div>
      </div>
      <p class="powball-reel-caption">Năng lượng đang khóa mục tiêu...</p>
    </div>`;
  }

  function ceremonyMarkup(result) {
    const resultRarity = result.resultRarityId;
    const rarity = rarityInfo(resultRarity);
    const element = elementInfo(result.pow.element);
    const upgraded = isUpgrade(result.ballRarityId, resultRarity);
    const base = `<div class="powball-ceremony-core"><div class="powball-ceremony-silhouette" style="--rarity-color:${rarity.frame};--element-color:${element.color}"><img src="${escapeHtml(powRevealAsset(result.pow.asset))}" alt=""></div><span class="powball-ceremony-element">${element.icon}</span></div>`;

    if (resultRarity === "ancient") {
      return `<div class="powball-ceremony ancient-ceremony" style="--rarity-color:${rarity.frame};--element-color:${element.color}">
        <div class="ancient-sky-rift"></div>
        <div class="ancient-light-pillars">${Array.from({ length: 7 }, (_, index) => `<i style="--pillar:${index}"></i>`).join("")}</div>
        <div class="ancient-portal"><span></span></div>
        ${base}
        <div class="powball-ceremony-title"><b>CỔ THẦN ĐÃ THỨC TỈNH</b><span>Bảy cột sáng mở cánh cổng Thượng cổ</span></div>
      </div>`;
    }

    if (resultRarity === "mythic") {
      return `<div class="powball-ceremony mythic-ceremony" style="--rarity-color:${rarity.frame};--element-color:${element.color}">
        <div class="mythic-ground-cracks"></div>
        <div class="mythic-throne-aura"></div>
        ${base}
        <div class="powball-ceremony-title"><b>VỊ VUA NGUYÊN TỐ GIÁNG LÂM</b><span>${element.icon} Uy quyền ${escapeHtml(element.name)} đang làm rung chuyển chiến trường</span></div>
      </div>`;
    }

    if (resultRarity === "legendary") {
      return `<div class="powball-ceremony legendary-ceremony" style="--rarity-color:${rarity.frame};--element-color:${element.color}">
        <div class="legendary-sunburst"></div>
        <div class="legendary-rune-ring"></div>
        ${base}
        <div class="powball-ceremony-title"><b>HUYỀN THOẠI XUẤT HIỆN</b><span>${upgraded ? "Vận may đã vượt cấp Pow Ball" : "Hào quang Huyền thoại đã được xác nhận"}</span></div>
      </div>`;
    }

    return `<div class="powball-ceremony standard-ceremony rarity-${resultRarity}" style="--rarity-color:${rarity.frame};--element-color:${element.color}">
      <div class="standard-reveal-wave"></div>${base}
      <div class="powball-ceremony-title"><b>${escapeHtml(rarity.name).toUpperCase()} ĐÃ ĐƯỢC XÁC NHẬN</b><span>${element.icon} Năng lượng ${escapeHtml(element.name)}</span></div>
    </div>`;
  }

  function receivedStarCount(result) {
    const raw = result?.receivedStars ?? result?.initialStars ?? result?.pow?.startStars ?? result?.pow?.initialStar ?? 0;
    const max = Math.max(0, Number(result?.pow?.maxStars ?? 7) || 7);
    return Math.max(0, Math.min(max, Math.floor(Number(raw) || 0)));
  }

  function finalRevealMarkup(result) {
    const rarity = rarityInfo(result.resultRarityId);
    const ballRarity = rarityInfo(result.ballRarityId);
    const element = elementInfo(result.pow.element);
    const upgraded = isUpgrade(result.ballRarityId, result.resultRarityId);
    const shiny = Boolean(result.shiny);
    const receivedStars = receivedStarCount(result);
    const rewardText = result.existed
      ? result.shinyNew
        ? `Pow cũ đã thức tỉnh thành <b>Shiny</b>. Nhận thêm ${result.bonusShards} mảnh.`
        : `Pow trùng chuyển thành <b>${result.bonusShards} mảnh</b> nâng cấp.`
      : shiny
        ? `Đã ghi <b>${escapeHtml(result.pow.name)} Shiny</b> vào Powdex. Chỉ số cuối tăng 25%.`
        : `Đã ghi <b>${escapeHtml(result.pow.name)}</b> vào Powdex.`;

    return `<div class="powball-final-card rarity-${result.resultRarityId}${shiny ? " is-shiny" : ""}" style="--rarity-color:${rarity.frame};--element-color:${element.color}">
      ${upgraded ? `<div class="powball-lucky-banner"><b>CHÚC MỪNG TAMER!</b><span>Pow Ball ${escapeHtml(ballRarity.name)} đã vượt cấp phần thưởng</span></div>` : ""}
      <div class="powball-final-halo"></div>
      <div class="powball-final-art"><img src="${escapeHtml(powRevealAsset(result.pow.asset))}" alt="${escapeHtml(result.pow.name)}">${shiny ? '<span class="powball-shiny-sparks">✦ ✧ ✦</span>' : ""}</div>
      <div class="powball-final-copy">
        <p>${result.resultRarityId === "ancient" ? "CỔ THẦN" : result.resultRarityId === "mythic" ? "VUA NGUYÊN TỐ" : "POW ĐÃ TRIỆU HỒI"}</p>
        <h2>${escapeHtml(result.pow.name)}${shiny ? ' <em>SHINY</em>' : ""}</h2>
        <div class="powball-final-meta">
          <span class="element-pill">${element.icon} ${escapeHtml(element.name)}</span>
          <span class="rarity-pill" style="--pill-color:${rarity.frame}">${escapeHtml(rarity.name)}</span>
        </div>
        <div class="powball-final-stars" aria-label="${receivedStars} sao ban đầu">${receivedStars > 0 ? Array.from({ length: receivedStars }, () => "★").join("") : "0★"}</div>
        <div class="powball-result-message">${upgraded ? `<strong>May mắn nhận được Pow: ${escapeHtml(result.pow.name)} · Phẩm chất: ${escapeHtml(rarity.name)}</strong>` : ""}<span>${rewardText}</span></div>
      </div>
    </div>`;
  }

  let audioContext = null;
  let audioPrimed = false;
  let audioSuspendTimer = 0;
  function getAudioContext() {
    clearTimeout(audioSuspendTimer); audioSuspendTimer = 0;
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        try { audioContext = new AudioContext({ latencyHint: "interactive" }); }
        catch (_) { audioContext = new AudioContext(); }
      }
    }
    return audioContext;
  }

  function suspendAudio(delay = 0) {
    clearTimeout(audioSuspendTimer); audioSuspendTimer = 0;
    const run = () => {
      audioSuspendTimer = 0;
      if (!audioContext || audioContext.state !== "running") return;
      audioContext.suspend().catch(() => {});
    };
    if (delay > 0) audioSuspendTimer = window.setTimeout(run, delay); else run();
    return true;
  }

  function audioState() {
    return audioContext ? audioContext.state : "uninitialized";
  }

  function withRunningAudio(callback) {
    const context = getAudioContext();
    if (!context) return false;
    const run = () => {
      if (context.state !== "running") return;
      try { callback(context); } catch (_) {}
    };
    if (context.state === "running") run();
    else context.resume().then(run).catch(() => {});
    return true;
  }

  function primeAudio() {
    const context = getAudioContext();
    if (!context) return false;
    const unlock = () => {
      if (audioPrimed || context.state !== "running") return;
      audioPrimed = true;
      try {
        const buffer = context.createBuffer(1, 1, context.sampleRate);
        const src = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = 0.00001;
        src.buffer = buffer;
        src.connect(gain).connect(context.destination);
        src.start();
      } catch (_) {}
    };
    if (context.state === "running") unlock();
    else context.resume().then(unlock).catch(() => {});
    return true;
  }

  function playSpinSound(enabled, durationMs = 1200) {
    if (!enabled) return;
    withRunningAudio((context) => {
      const now = context.currentTime;
      const duration = Math.max(0.35, Number(durationMs || 1200) / 1000);
      const master = context.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.72, now + 0.055);
      master.gain.setValueAtTime(0.68, now + duration * 0.78);
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      master.connect(context.destination);
      const motor = context.createOscillator();
      const motorGain = context.createGain();
      motor.type = "triangle";
      motor.frequency.setValueAtTime(154, now);
      motor.frequency.exponentialRampToValueAtTime(106, now + duration * 0.78);
      motor.frequency.exponentialRampToValueAtTime(78, now + duration);
      motorGain.gain.setValueAtTime(0.034, now);
      motorGain.gain.exponentialRampToValueAtTime(0.017, now + duration * 0.82);
      motorGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      motor.connect(motorGain).connect(master);
      const gear = context.createOscillator();
      const gearGain = context.createGain();
      gear.type = "sawtooth";
      gear.frequency.setValueAtTime(74, now);
      gear.frequency.exponentialRampToValueAtTime(49, now + duration);
      gearGain.gain.setValueAtTime(0.009, now);
      gearGain.gain.exponentialRampToValueAtTime(0.004, now + duration * 0.86);
      gearGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      gear.connect(gearGain).connect(master);
      motor.start(now); gear.start(now);
      motor.stop(now + duration + 0.03); gear.stop(now + duration + 0.03);
    });
  }

  function playCaseTicks(enabled, durationMs) {
    if (!enabled) return;
    withRunningAudio((context) => {
      const duration = Math.max(.8, Number(durationMs || 4800) / 1000);
      const marks = [.055,.105,.155,.205,.255,.305,.355,.405,.455,.51,.57,.635,.705,.78,.86,.94];
      const baseTime = context.currentTime;
      marks.forEach((ratio, index) => {
        const t = baseTime + duration * ratio;
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(820 - Math.min(230, index * 11), t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(index > 11 ? 0.030 : 0.022, t + .003);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + .020);
        osc.connect(gain).connect(context.destination);
        osc.start(t);
        osc.stop(t + .024);
      });
    });
  }

  function tone(frequency, duration = 0.08, type = "sine", volume = 0.035, when = 0) {
    withRunningAudio((context) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = context.currentTime + when;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.03);
    });
  }

  function playIntroSound(enabled, ballRarity) {
    if (!enabled) return;
    const base = 190 + rarityIndex(ballRarity) * 34;
    tone(base, 0.18, "sine", 0.04);
    tone(base * 1.5, 0.22, "triangle", 0.025, 0.08);
  }

  function playTick(enabled, strength = 1) {
    if (!enabled) return;
    tone(760 + strength * 80, 0.025, "square", 0.012 + strength * 0.003);
  }

  function playRevealSound(enabled, resultRarity) {
    if (!enabled) return;
    if (resultRarity === "ancient") {
      tone(48, 1.8, "sawtooth", 0.04);
      [196, 247, 294, 392, 494, 587, 784].forEach((frequency, index) => tone(frequency, 0.45, "triangle", 0.035, 0.16 * index));
      return;
    }
    if (resultRarity === "mythic") {
      tone(58, 1.3, "sawtooth", 0.035);
      [220, 330, 440, 660].forEach((frequency, index) => tone(frequency, 0.5, "triangle", 0.04, 0.12 * index));
      return;
    }
    if (resultRarity === "legendary") {
      [330, 495, 660, 990].forEach((frequency, index) => tone(frequency, 0.3, "triangle", 0.035, 0.08 * index));
      return;
    }
    const base = 240 + rarityIndex(resultRarity) * 70;
    tone(base, 0.25, "triangle", 0.035);
    tone(base * 1.5, 0.28, "sine", 0.025, 0.06);
  }

  function vibrate(enabled, resultRarity) {
    if (!enabled || !navigator.vibrate) return;
    if (resultRarity === "ancient") navigator.vibrate([120, 45, 120, 45, 190]);
    else if (resultRarity === "mythic") navigator.vibrate([90, 40, 130]);
    else if (resultRarity === "legendary") navigator.vibrate([65, 35, 75]);
    else navigator.vibrate(35);
  }

  const activeTimers = new Set();
  function schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      activeTimers.delete(timer);
      callback();
    }, delay);
    activeTimers.add(timer);
    return timer;
  }

  function clearTimers() {
    for (const timer of activeTimers) window.clearTimeout(timer);
    activeTimers.clear();
  }

  function setOpeningFocus(active) {
    document.documentElement.classList.toggle("powball-focus1811", Boolean(active));
  }

  function ceremonyDuration(resultRarity, reducedMotion, balancedMotion=false) {
    if (reducedMotion) return 160;
    if (balancedMotion) return resultRarity==='ancient'?760:resultRarity==='mythic'?600:resultRarity==='legendary'?430:240;
    if (resultRarity === "ancient") return 1350;
    if (resultRarity === "mythic") return 980;
    if (resultRarity === "legendary") return 650;
    return 340;
  }

  function play(result, options = {}) {
    clearTimers();

    if (!result?.pow || !ELIGIBILITY.isPlayerEligible(result.pow)) {
      console.warn("[PowBall] blocked non-player-eligible reveal.");
      return false;
    }

    const modal = $("#summonModal");
    const sequence = $("#summonSequence");
    const reveal = $("#summonReveal");
    const title = $("#summonStageTitle");
    const stageText = $("#summonStageText");
    const claimButton = $("#summonClaimBtn");
    const againButton = $("#summonAgainBtn");
    const skipButton = $("#summonSkipBtn");
    if (!modal || !sequence || !reveal || !claimButton || !againButton || !skipButton) {
      throw new Error("Thiếu giao diện Pow Ball summon.");
    }

    const settings = options.settings || {};
    const perfTier=window.POWDER_PERFORMANCE_V1757?.tier?.()||'full';
    const reducedMotion = Boolean(settings.reducedMotion||perfTier==='low');
    const balancedMotion = perfTier==='balanced'||Boolean(settings.performanceLite);
    const soundEnabled = settings.sound !== false;
    const vibrationEnabled = settings.vibration !== false;
    const ballRarity = result.ballRarityId || result.rarityId || result.pow.rarity;
    const resultRarity = result.resultRarityId || result.pow.rarity;
    result.ballRarityId = ballRarity;
    result.resultRarityId = resultRarity;
    result.upgraded = isUpgrade(ballRarity, resultRarity);

    let reelAnimation = null;
    let seenSaved = false;
    const markSeen = () => {
      if (seenSaved) return;
      seenSaved = true;
      options.onSeen?.(ballRarity);
    };

    const finalReveal = () => {
      clearTimers();
      if (reelAnimation) {
        try { reelAnimation.cancel(); } catch (_) {}
        reelAnimation = null;
      }
      sequence.querySelector(".powball-reel-track")?.classList.remove("is-spinning");
      markSeen();
      modal.classList.remove("powball-screen-shake", "powball-ancient-active", "powball-mythic-active");
      modal.classList.add("powball-result-ready");
      sequence.hidden = true;
      reveal.hidden = false;
      reveal.className = `summon-reveal powball-final-reveal rarity-${resultRarity}${result.shiny ? " is-shiny" : ""}`;
      reveal.innerHTML = finalRevealMarkup(result);
      title.textContent = result.upgraded
        ? "CHÚC MỪNG TAMER — PHẦN THƯỞNG VƯỢT CẤP!"
        : resultRarity === "ancient"
          ? "Cổ Thần đã bước qua cánh cổng"
          : resultRarity === "mythic"
            ? "Vị vua nguyên tố đã giáng lâm"
            : `${rarityInfo(resultRarity).name} Pow đã xuất hiện`;
      stageText.textContent = `${elementInfo(result.pow.element).icon} ${elementInfo(result.pow.element).name} · ${rarityInfo(resultRarity).name}`;
      skipButton.hidden = true;
      claimButton.disabled = false;
      claimButton.textContent = "Nhận Pow";
      againButton.hidden = typeof options.onAgain !== "function";
      againButton.disabled = false;
      againButton.textContent = `Mở tiếp ${rarityInfo(ballRarity).name} Ball`;
      againButton.onclick = () => {
        claimButton.disabled = true;
        againButton.disabled = true;
        const opened = options.onAgain?.(result);
        if (opened === false) {
          claimButton.disabled = false;
          againButton.disabled = false;
        }
      };
      options.onFeedback?.(result);
    };

    const showCeremony = () => {
      sequence.innerHTML = ceremonyMarkup(result);
      modal.classList.toggle("powball-screen-shake", !balancedMotion && !reducedMotion && ["mythic", "ancient"].includes(resultRarity));
      modal.classList.toggle("powball-ancient-active", resultRarity === "ancient");
      modal.classList.toggle("powball-mythic-active", resultRarity === "mythic");
      playRevealSound(soundEnabled, resultRarity);
      vibrate(vibrationEnabled, resultRarity);
      title.textContent = resultRarity === "ancient"
        ? "Bảy cột sáng đang mở Cổng Thượng cổ"
        : resultRarity === "mythic"
          ? "Động đất — Vua nguyên tố đang giáng lâm"
          : resultRarity === "legendary"
            ? "Hào quang Huyền thoại đã khóa mục tiêu"
            : "Danh tính Pow đang được giải phóng";
      stageText.textContent = result.upgraded
        ? `May mắn vượt từ ${rarityInfo(ballRarity).name} lên ${rarityInfo(resultRarity).name}!`
        : `Năng lượng ${elementInfo(result.pow.element).name} đã được xác nhận.`;
      schedule(finalReveal, ceremonyDuration(resultRarity, reducedMotion, balancedMotion));
    };

    const showReel = async () => {
      const reel = buildReel(result);
      sequence.innerHTML = reelMarkup(result, reel);
      title.textContent = "PowBall đang quay";
      stageText.textContent = "Dải Pow đang chạy qua tâm — tốc độ sẽ giảm dần...";

      const viewport = sequence.querySelector(".powball-reel-window");
      const track = sequence.querySelector(".powball-reel-track");
      const card = sequence.querySelector(".powball-reel-card");
      if (!viewport || !track || !card) return finalReveal();

      // Only small thumbnail assets are decoded. The track itself is a single compositor layer.
      await prepareReelImages(sequence);
      if (!modal.classList.contains("powball-modal-active") || sequence.hidden) return;

      const style = window.getComputedStyle(track);
      const gap = Number.parseFloat(style.columnGap || style.gap || "8") || 8;
      const cardWidth = card.offsetWidth || 150;
      const step = cardWidth + gap;
      const startX = viewport.clientWidth * 0.5 - cardWidth * 0.5 + step * 2.1;
      const jitter = reducedMotion ? 0 : (Math.random() - 0.5) * Math.min(42, cardWidth * 0.26);
      const targetX = viewport.clientWidth * 0.5 - cardWidth * 0.5 - reel.winningIndex * step + jitter;
      const reelDuration = reducedMotion
        ? 1200
        : balancedMotion
          ? (["legendary", "mythic", "ancient"].includes(ballRarity) ? 5000 : 4650)
          : getDuration(ballRarity);

      track.style.transition = "none";
      track.style.transform = `translate3d(${startX}px,0,0)`;
      track.classList.add("is-spinning");
      track.style.willChange = "transform";

      // Powder 18.1.2/18.1.3: one continuous CS:GO-style deceleration curve — motion intentionally unchanged.
      // Previous builds split the travel into several easing segments. The speed changed
      // abruptly at every segment boundary, which looked like small hitches near the end.
      // Two compositor keyframes + one easing curve keeps velocity continuous all the way
      // to the selected Pow without changing reel length, marker, result or duration.
      const smoothCaseEasing = "cubic-bezier(.10,.56,.20,.985)";
      if (typeof track.animate === "function" && !reducedMotion) {
        reelAnimation = track.animate([
          { transform: `translate3d(${startX}px,0,0)` },
          { transform: `translate3d(${targetX}px,0,0)` }
        ], { duration: reelDuration, fill: "forwards", easing: smoothCaseEasing });
      } else {
        reelAnimation = null;
        track.style.transition = `transform ${reelDuration}ms ${smoothCaseEasing}`;
        requestAnimationFrame(() => { track.style.transform = `translate3d(${targetX}px,0,0)`; });
      }

      playSpinSound(soundEnabled, reelDuration);
      playCaseTicks(soundEnabled, reelDuration);

      const finishReel = () => {
        if (!modal.classList.contains("powball-modal-active") || sequence.hidden) return;
        if (reelAnimation) {
          // Freeze the compositor's exact final sub-pixel position before removing the effect.
          // This prevents the end frame from snapping from WAAPI back to the inline transform.
          try { reelAnimation.commitStyles?.(); } catch (_) {}
          try { reelAnimation.cancel(); } catch (_) {}
        }
        track.style.transform = `translate3d(${targetX}px,0,0)`;
        track.style.transition = "none";
        track.style.willChange = "auto";
        track.classList.remove("is-spinning");
        reelAnimation = null;
        const winner = sequence.querySelector('[data-winning="true"]');
        const caption = sequence.querySelector(".powball-reel-caption");
        // Apply the winner highlight on the next paint, after the reel is fully stationary.
        requestAnimationFrame(() => {
          winner?.classList.add("is-locked");
          if (caption) caption.textContent = result.upgraded
            ? "CẢNH BÁO: PowBall đã vượt cấp phần thưởng!"
            : "Đã khóa Pow dưới kim chọn";
        });
        schedule(showCeremony, reducedMotion ? 100 : balancedMotion ? 260 : 360);
      };

      if (reelAnimation) {
        reelAnimation.addEventListener("finish", finishReel, { once: true });
        reelAnimation.addEventListener("cancel", () => {}, { once: true });
      } else {
        schedule(finishReel, reelDuration + 20);
      }
    };

    setOpeningFocus(true);
    modal.hidden = false;
    modal.classList.add("powball-modal-active");
    const backdrop = modal.querySelector(".backdrop");
    const releaseOpeningFocus = () => {
      setOpeningFocus(false);
      claimButton.removeEventListener("click", releaseOpeningFocus);
      backdrop?.removeEventListener("click", releaseOpeningFocus);
    };
    claimButton.addEventListener("click", releaseOpeningFocus, { once: true });
    backdrop?.addEventListener("click", releaseOpeningFocus, { once: true });
    modal.classList.remove("powball-result-ready");
    reveal.hidden = true;
    reveal.innerHTML = "";
    reveal.className = "summon-reveal";
    sequence.hidden = false;
    sequence.innerHTML = introMarkup(ballRarity);
    title.textContent = result.chestName || `Pow Ball ${rarityInfo(ballRarity).name}`;
    stageText.textContent = `Tỷ lệ: ${rateText(ballRarity)}`;
    claimButton.disabled = true;
    claimButton.textContent = "Đang quay Pow Ball...";
    againButton.hidden = true;
    againButton.disabled = true;
    againButton.onclick = null;

    const maySkip = true;
    skipButton.hidden = false;
    skipButton.onclick = finalReveal;


    playIntroSound(soundEnabled, ballRarity);
    schedule(showReel, reducedMotion ? 100 : balancedMotion ? 220 : 380);
  }

  document.addEventListener("pointerdown", (event) => {
    if (event.target?.closest?.("[data-powball-open]")) primeAudio();
  }, true);

  document.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && document.activeElement?.closest?.("[data-powball-open]")) primeAudio();
  }, true);

  window.POWBALL_SYSTEM = Object.freeze({
    RARITY_ORDER,
    DROP_RATES,
    getConfiguredRates,
    getRates,
    getDuration,
    getPool,
    pickPow,
    powPickWeight,
    rollRarity,
    isUpgrade,
    rateText,
    rateMarkup,
    ballPreviewMarkup,
    validateRates,
    primeAudio,
    suspendAudio,
    audioState,
    play,
  });
})();
