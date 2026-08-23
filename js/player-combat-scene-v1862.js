(function(){
  'use strict';

  const D=window.POWDER_DATA;
  const C=window.POWDER_CONFIG;
  const Core=window.POWDER_COMBAT_CORE_V7;
  const TAMER_SIMPLE=Core?.TAMER_SIMPLE||{};
  const TAMER_EXPANSIONS=Core?.TAMER_EXPANSIONS||{};
  const CombatAudio=window.POWDER_COMBAT_AUDIO||null;
  const SC=()=>window.POWDER_SERVER_COMBAT_V1862;
  if(!D||!Core)throw new Error('Combat Scene V7 requires data and core.');

  const qs=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const effectNow=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
  const effectAge=e=>Math.max(0,Math.round(effectNow()-Number(e?.startedAt||effectNow())));
  const rarityRank={common:0,rare:1,super_rare:2,epic:3,legendary:4,mythic:5,ancient:6};
  const ROLE_ANIMATION={
    marksman:{label:'XẠ THỦ',icon:'◎'}, knight:{label:'HIỆP SĨ',icon:'⚔'}, mage:{label:'PHÁP SƯ',icon:'✦'}, tank:{label:'ĐỠ ĐÒN',icon:'⬡'},
    enchanter:{label:'THUẬT SƯ',icon:'◇'}, musician:{label:'NHẠC CÔNG',icon:'♫'}, healer:{label:'TRỊ LIỆU',icon:'✚'}, assassin:{label:'SÁT THỦ',icon:'◆'}, fighter:{label:'ĐẤU SĨ',icon:'✹'}
  };
  const DOMAIN_VISUAL=Object.freeze({
    frenzy:{icon:'✹',eyebrow:'CHIẾN TRƯỜNG CUỒNG NỘ',accent:'HỎA ẤN BÙNG NỔ'},
    fortress:{icon:'⬡',eyebrow:'THÀNH LŨY HỘ VỆ',accent:'KẾT GIỚI KIÊN CỐ'},
    timeflow:{icon:'◷',eyebrow:'DÒNG THỜI GIAN BIẾN ĐỔI',accent:'NHỊP THỜI LƯU'},
    vitality:{icon:'❧',eyebrow:'SINH KHÍ LAN TRÀN',accent:'MẠCH SỐNG HỒI SINH'}
  });
  const DOMAIN_JP=Object.freeze({frenzy:'狂戦の領域',fortress:'城塞の領域',timeflow:'時流の領域',vitality:'生命の領域'});

  const SIGNATURE_FX=Object.freeze({
    pyrion:{icon:'♛',title:'CỬU TRÙNG VIÊM QUAN',motif:'flame-crown'},
    aquarion:{icon:'◉',title:'HẢI HOÀNG LUÂN',motif:'tide-wheel'},
    verdantis:{icon:'♧',title:'THẾ GIỚI THỤ HOÀNG ẤN',motif:'world-tree'},
    terrakor:{icon:'⬢',title:'SƠN HÀ ĐẾ ẤN',motif:'mountain-seal'},
    zephyrion:{icon:'✧',title:'THIÊN PHONG VŨ ẤN',motif:'sky-feather'},
    thunderos:{icon:'ϟ',title:'CỬU THIÊN LÔI ẤN',motif:'thunder-seal'},
    glacior:{icon:'❄',title:'VẠN NIÊN BĂNG ẤN',motif:'ice-crown'},
    vilexis:{icon:'☣',title:'VẠN ĐỘC HOÀNG ẤN',motif:'venom-mandala'},
    solarion:{icon:'☀',title:'NHẬT LUÂN HOÀNG MỆNH',motif:'solar-halo'},
    umbrael:{icon:'◑',title:'VỰC ĐẾ MA ẢNH',motif:'eclipse'},
    calderion:{icon:'◆',title:'ĐỊA TÂM HOÀNG BẠO',motif:'magma-core'},
    venomarch:{icon:'〰',title:'THIÊN CỔ HÓA NỌC',motif:'centipede'},
    magmorax:{icon:'♨',title:'NIẾT BÀN TẬN THẾ',motif:'phoenix'},
    tempestrix:{icon:'龍',title:'THIÊN BÃO NGHỊCH CHU THIÊN',motif:'dragon'},
    frostmaw:{icon:'鯤',title:'THIÊN BĂNG TẬN KHÔNG',motif:'kunpeng'},
    luxarion:{icon:'♚',title:'LUÂN HỒI NHẬT ẤN',motif:'royal-lion'},
    noxabyss:{icon:'☠',title:'SẮC LỆNH XÓA TÊN',motif:'lich-crown'}
  });

  let mounted=false, mount=null, battle=null, serial=0, flowToken=0, fxSerial=0, renderFrame=0;
  let uiExpiryTimer=0, uiExpirySerial=0;
  const uiExpiryQueue=[];
  const compositorAnimations=new Map();
  const combatImageCache=new Map();
  const rendererV2={battleSerial:0,fullRebuilds:0,patches:0,actionPatches:0,rosterReplacements:0,lastPatchMs:0,maxPatchMs:0,patchSamples:[],vitalWrites:0,vitalSkips:0,fxNodesCreated:0,fxNodesReused:0,fxTimerWakeups:0};
  const framePacing={raf:0,lastTs:0,samples:[],actionSamples:[],fps:60,frameMs:16.67,p95:16.67,p99:16.67,max:16.67,actionP95:16.67,actionP99:16.67,actionMax:16.67,jank:0,tier:'high',bad:0,medium:0,good:0,evalCounter:0,started:false};
  let ui={mode:'ready',selectedKey:null,targetSide:null,question:null,lastEvents:[],reward:null,fx:[],unitPulse:{},banner:null,camera:'',hitStop:'',guardLink:null,attackCallout:null,attackMotion:null,cinematic:null,formCinematic:null,tamerMenu:null,domainCinematic:null,audioMenu:false,formationSelectedId:null,bossIntro:null,bossPhaseCinematic:null,bossWarning:null,bossDefeat:null,bossMechanicNotice:null,cameraDirector:null,domainVisualStartedAt:0,battleStats:null,combatFeed:[],logOpen:false,logFilter:'all'};

  function attackDomLocked(){
    return Boolean(ui.attackMotion?.phase==='release' && ui.attackMotion?.sourceId);
  }

  function scheduleRender(){
    if(renderFrame||!mount)return;
    renderFrame=requestAnimationFrame(()=>{
      renderFrame=0;
      if(attackDomLocked()) patchActionDom();
      else render();
    });
  }


  function resetUiExpiryScheduler(){
    if(uiExpiryTimer){clearTimeout(uiExpiryTimer);uiExpiryTimer=0;}
    uiExpiryQueue.length=0;
  }

  function armUiExpiryScheduler(){
    if(uiExpiryTimer||!uiExpiryQueue.length)return;
    uiExpiryQueue.sort((a,b)=>a.at-b.at);
    const wait=Math.max(0,Math.ceil(uiExpiryQueue[0].at-effectNow()));
    uiExpiryTimer=setTimeout(()=>{
      uiExpiryTimer=0;rendererV2.fxTimerWakeups++;
      const now=effectNow();let changed=false;
      while(uiExpiryQueue.length&&uiExpiryQueue[0].at<=now+2){
        const job=uiExpiryQueue.shift();
        try{if(job.guard())changed=job.expire()!==false||changed;}catch(e){console.warn('[Combat 18.6.2 expiry]',e);}
      }
      if(changed)scheduleRender();
      armUiExpiryScheduler();
    },wait);
  }

  function scheduleUiExpiry(ttl,guard,expire){
    const job={id:++uiExpirySerial,at:effectNow()+Math.max(0,Number(ttl)||0),guard,expire};
    uiExpiryQueue.push(job);
    if(uiExpiryTimer){clearTimeout(uiExpiryTimer);uiExpiryTimer=0;}
    armUiExpiryScheduler();
    return job.id;
  }

  function cancelCompositorAnimation(key){
    const anim=compositorAnimations.get(key);
    if(anim){try{anim.cancel();}catch(_){} compositorAnimations.delete(key);}
  }

  function runCompositorAnimation(key,el,frames,options){
    if(!el?.animate)return null;
    cancelCompositorAnimation(key);
    el.style.willChange='transform, opacity';
    const anim=el.animate(frames,{...options,fill:'both'});
    compositorAnimations.set(key,anim);
    const cleanup=()=>{
      if(compositorAnimations.get(key)!==anim)return;
      compositorAnimations.delete(key);
      try{anim.cancel();}catch(_){}
      el.style.willChange='';
    };
    anim.addEventListener?.('finish',cleanup,{once:true});
    anim.addEventListener?.('cancel',()=>{if(compositorAnimations.get(key)===anim)compositorAnimations.delete(key);},{once:true});
    return anim;
  }

  function playAttackCompositorMotion(m){
    if(!m||m.phase!=='release'||!mount)return;
    const unitEl=mount.querySelector(`.cv7-unit[data-cv7-unit="${CSS.escape(String(m.sourceId))}"]`);
    const art=unitEl?.querySelector('.cv7-art'); if(!art)return;
    const token=`${m.sourceId}:${Math.round(Number(m.releaseStartedAt)||0)}`;
    if(art.dataset.cv711AttackToken===token)return;
    art.dataset.cv711AttackToken=token;
    const dy=m.side==='player'?-13:13;
    const duration=Math.max(420,Number(m.release)||620);
    const peak=Math.max(.48,Math.min(.62,(Number(m.impactDelay)||duration*.54)/duration));
    runCompositorAnimation(`attack:${m.sourceId}`,art,[
      {offset:0,transform:'translate3d(0,0,0)',opacity:1},
      {offset:peak,transform:`translate3d(0,${dy}px,0)`,opacity:1},
      {offset:1,transform:'translate3d(0,0,0)',opacity:1}
    ],{duration,easing:'cubic-bezier(.22,.64,.18,1)'});
  }

  function hitMotionSpec(kind='hit-basic'){
    const key=String(kind||'');
    if(key.includes('ultimate')||key.includes('crit'))return {px:12,duration:660};
    if(key.includes('exclusive'))return {px:10,duration:610};
    if(key.includes('skill2'))return {px:8,duration:560};
    if(key.includes('skill1'))return {px:6,duration:510};
    return {px:4,duration:460};
  }

  function playHitCompositorMotion(el,u,kind,pulseId){
    if(!el||!u||!String(kind||'').startsWith('hit-'))return;
    const art=el.querySelector('.cv7-art');if(!art)return;
    const token=`${u.id}:${pulseId||kind}`;if(art.dataset.cv711HitToken===token)return;
    art.dataset.cv711HitToken=token;
    const spec=hitMotionSpec(kind),dir=u.side==='enemy'?-1:1;
    runCompositorAnimation(`hit:${u.id}`,art,[
      {offset:0,transform:'translate3d(0,0,0)',opacity:1},
      {offset:.18,transform:`translate3d(0,${dir*spec.px}px,0)`,opacity:1},
      {offset:1,transform:'translate3d(0,0,0)',opacity:1}
    ],{duration:spec.duration,easing:'cubic-bezier(.18,.55,.2,1)'});
  }


  function playFeedbackCompositor(el,u,kind,pulseId){
    if(!el||!u||!kind)return;
    const art=el.querySelector('.cv7-art');
    const ring=el.querySelector('.cv7-ring');
    const token=`${u.id}:${pulseId||kind}`;
    if(el.dataset.cv1851FeedbackToken===token)return;
    el.dataset.cv1851FeedbackToken=token;
    const low=framePacing.tier==='low';
    if(kind==='heal' || kind==='status-heal'){
      if(art)runCompositorAnimation(`feedback:${u.id}`,art,[
        {offset:0,transform:'translate3d(0,0,0) scale(1)',opacity:1},
        {offset:.42,transform:'translate3d(0,-3px,0) scale(1.025)',opacity:1},
        {offset:1,transform:'translate3d(0,0,0) scale(1)',opacity:1}
      ],{duration:low?300:460,easing:'cubic-bezier(.2,.7,.2,1)'});
      if(ring&&!low)runCompositorAnimation(`feedback-ring:${u.id}`,ring,[
        {offset:0,transform:'translate3d(-50%,0,0) scale(1)',opacity:.7},
        {offset:.5,transform:'translate3d(-50%,0,0) scale(1.08)',opacity:1},
        {offset:1,transform:'translate3d(-50%,0,0) scale(1)',opacity:.7}
      ],{duration:520,easing:'ease-out'});
      return;
    }
    if(kind==='shield' || kind==='shield-gain' || kind==='guarded'){
      if(ring)runCompositorAnimation(`feedback-ring:${u.id}`,ring,[
        {offset:0,transform:'translate3d(-50%,0,0) scale(.96)',opacity:.62},
        {offset:.38,transform:'translate3d(-50%,0,0) scale(1.11)',opacity:1},
        {offset:1,transform:'translate3d(-50%,0,0) scale(1)',opacity:.78}
      ],{duration:low?320:560,easing:'cubic-bezier(.18,.7,.2,1)'});
      return;
    }
    if(kind==='status-control'){
      if(art)runCompositorAnimation(`feedback:${u.id}`,art,[
        {offset:0,transform:'translate3d(0,0,0)'},
        {offset:.18,transform:'translate3d(-4px,0,0)'},
        {offset:.38,transform:'translate3d(4px,0,0)'},
        {offset:.58,transform:'translate3d(-3px,0,0)'},
        {offset:.78,transform:'translate3d(2px,0,0)'},
        {offset:1,transform:'translate3d(0,0,0)'}
      ],{duration:low?300:480,easing:'ease-out'});
      return;
    }
    if(kind==='replace'){
      if(art)runCompositorAnimation(`feedback:${u.id}`,art,[
        {offset:0,transform:'translate3d(0,16px,0) scale(.96)',opacity:.25},
        {offset:.55,transform:'translate3d(0,-2px,0) scale(1.015)',opacity:1},
        {offset:1,transform:'translate3d(0,0,0) scale(1)',opacity:1}
      ],{duration:low?360:620,easing:'cubic-bezier(.18,.72,.2,1)'});
      return;
    }
    if(kind==='status-new' || kind==='status-cleanse' || kind==='break'){
      if(ring&&!low)runCompositorAnimation(`feedback-ring:${u.id}`,ring,[
        {offset:0,transform:'translate3d(-50%,0,0) scale(1)',opacity:.72},
        {offset:.45,transform:'translate3d(-50%,0,0) scale(1.07)',opacity:1},
        {offset:1,transform:'translate3d(-50%,0,0) scale(1)',opacity:.72}
      ],{duration:430,easing:'ease-out'});
    }
  }

  function playDeathCompositorMotion(unitId,isBoss=false){
    if(!mount||!unitId)return;
    const unitEl=mount.querySelector(`.cv7-unit[data-cv7-unit="${CSS.escape(String(unitId))}"]`);
    const art=unitEl?.querySelector('.cv7-art');if(!art)return;
    const duration=isBoss?620:440;
    runCompositorAnimation(`death:${unitId}`,art,[
      {offset:0,transform:'translate3d(0,0,0) scale(1)',opacity:1},
      {offset:.28,transform:'translate3d(0,3px,0) scale(.995)',opacity:.94},
      {offset:1,transform:'translate3d(0,9px,0) scale(.975)',opacity:.34}
    ],{duration,easing:'cubic-bezier(.2,.55,.2,1)'});
  }

  function app(){return window.POWDER_APP||null;}
  function save(){return app()?.getSave?.()||{};}
  function pow(id){return D.pows.find(p=>p.id===id)||null;}
  function element(id){return D.elements?.[id]||{name:id||'—',icon:'✦',color:'#8cd9ff'};}
  function combatAsset(asset){
    const s=String(asset||'');
    const mapped=window.POWDER_COMBAT_ASSETS?.[s];
    if(mapped)return mapped;
    return s.includes('assets/pow-beta12/')?s.replace('assets/pow-beta12/','assets/pow-combat-512/'):s;
  }

  function preloadImage(url){
    if(!url)return Promise.resolve(false);
    if(combatImageCache.has(url))return combatImageCache.get(url);
    const job=new Promise(resolve=>{
      const img=new Image();
      img.decoding='async';
      img.onload=()=>{try{const d=img.decode?.();if(d?.then)d.then(()=>resolve(true)).catch(()=>resolve(true));else resolve(true);}catch(_){resolve(true);}};
      img.onerror=()=>resolve(false);
      img.src=url;
    });
    combatImageCache.set(url,job);
    return job;
  }

  function preloadCombatAssets(){
    if(!battle)return Promise.resolve([]);
    const units=[...(battle.state.team||[]),...(battle.state.reserves||[]),...(battle.state.enemies||[])];
    const urls=[...new Set(units.map(u=>combatAsset(u.asset)).filter(Boolean))];
    for(const u of units){const p=pow(u.powId);if(p?.combatForms)for(const f of Object.values(p.combatForms))if(f?.asset)urls.push(combatAsset(f.asset));}
    urls.push('assets/ui/combat/celestial-battlefield-theme-combat.webp');
    return Promise.all(urls.map(preloadImage));
  }

  function fxElementClass(el){
    const k=String(el||'neutral').toLowerCase();
    const map={
      fire:'fire','lửa':'fire',water:'water','nước':'water',leaf:'leaf','lá':'leaf',earth:'earth','đất':'earth',lightning:'lightning','sét':'lightning',wind:'wind','gió':'wind',
      poison:'poison','độc':'poison',ice:'ice','băng':'ice',steel:'steel','thép':'steel',lava:'lava','dung nham':'lava',storm:'storm','bão':'storm',light:'light','ánh sáng':'light',dark:'dark','bóng tối':'dark'
    };
    return map[k]||'neutral';
  }

  function elementImpactIcon(el){
    return ({fire:'🔥',water:'💧',leaf:'🍃',earth:'◆',lightning:'⚡',wind:'✦',poison:'☣',ice:'❄',steel:'⬢',lava:'🌋',storm:'ϟ',light:'☀',dark:'◑'})[fxElementClass(el)]||'✧';
  }

  function fxToneForAction(ref,key){
    if(key==='ultimate') return 'ultimate';
    if(key==='exclusive') return 'exclusive';
    return ref?.unit?.side==='player' ? 'player' : 'enemy';
  }

  function roleMotionClass(unit,ability,key){
    const role=String(unit?.combatRole||'').toLowerCase();
    const type=String(ability?.type||'').toLowerCase();
    const target=String(ability?.target||'').toLowerCase();
    const support=type==='support' || ['self','ally','allies','team'].includes(target);
    if(role==='assassin')return 'assassin';
    if(role==='marksman')return 'marksman';
    if(role==='mage')return 'mage';
    if(role==='tank')return support?'tank-guard':'tank';
    if(role==='knight')return support?'knight-guard':'knight';
    if(role==='healer')return 'healer';
    if(role==='enchanter')return 'enchanter';
    if(role==='musician')return 'enchanter';
    if(role==='fighter')return 'fighter';
    return support?'support':type==='physical'?'physical':'magic';
  }

  function choreographyStyle(unit,ability,key){
    if(key==='ultimate')return `ultimate role-${roleMotionClass(unit,ability,key)}`;
    if(key==='exclusive')return `exclusive role-${roleMotionClass(unit,ability,key)}`;
    return roleMotionClass(unit,ability,key);
  }

  function identityVariant(unit,ability,key){
    const role=String(unit?.combatRole||'marksman').toLowerCase();
    const target=String(ability?.target||'').toLowerCase();
    const support=String(ability?.type||'').toLowerCase()==='support' || ['self','ally','allies','team'].includes(target);
    if(key==='ultimate')return `${role}-ultimate`;
    if(key==='exclusive')return `${role}-signature`;
    if(role==='marksman')return 'precision-shot';
    if(role==='assassin')return 'shadow-cut';
    if(role==='mage')return 'arcane-cast';
    if(role==='tank')return support?'fortress-guard':'shield-slam';
    if(role==='knight')return support?'knight-guard':'blade-rush';
    if(role==='healer')return 'life-bloom';
    if(role==='enchanter')return support?'ally-sigil':'enemy-hex';
    if(role==='musician')return support?'ally-sigil':'arcane-cast';
    if(role==='fighter')return 'power-strike';
    return support?'support-sigil':'direct-strike';
  }

  function roleAnimationProfile(unit,ability,key){
    const role=String(unit?.combatRole||'marksman').toLowerCase();
    const meta=ROLE_ANIMATION[role]||ROLE_ANIMATION.marksman;
    return {role,label:meta.label,icon:meta.icon,identity:identityVariant(unit,ability,key)};
  }

  function signatureProfile(unit,key){
    if(!unit || !['ultimate','exclusive'].includes(key))return null;
    const p=pow(unit.powId); if(!p || !['mythic','ancient'].includes(p.rarity))return null;
    const sig=SIGNATURE_FX[p.id]; if(!sig)return null;
    return {...sig,id:p.id,tier:p.rarity,element:fxElementClass(unit.element),powName:p.name};
  }

  function attackTier(key){
    return key==='ultimate'?5:key==='exclusive'?4:key==='skill2'?3:key==='skill1'?2:1;
  }
  function ownedFor(p,s){
    if(s.owned?.[p.id])return s.owned[p.id];
    return {level:1,stars:0,shiny:false};
  }

  function cameraShotProfile(unit,key,ability,info,targetRefs=[]){
    const role=String(unit?.combatRole||'marksman').toLowerCase();
    const target=String(ability?.target||'').toLowerCase();
    const support=String(ability?.type||'').toLowerCase()==='support' || ['self','ally','allies','team'].includes(target);
    const aoe=Boolean(info?.area)||targetRefs.length>1||['team','allies'].includes(target);
    let shot='duel-focus',label='ĐỐI ĐẦU';
    if(key==='ultimate'){shot='ultimate-focus';label='ULTIMATE FOCUS';}
    else if(key==='exclusive'){shot='signature-focus';label='SIGNATURE FOCUS';}
    else if(aoe&&!support){shot='aoe-wide';label='AOE WIDE';}
    else if(role==='assassin'&&!support){shot='assassin-track';label='ASSASSIN TRACK';}
    else if(role==='marksman'&&!support){shot='precision-lock';label='PRECISION LOCK';}
    else if(role==='healer'||support){shot='support-focus';label=role==='healer'?'HEAL FOCUS':'SUPPORT FOCUS';}
    else if(role==='tank'||role==='knight'){shot='guardian-frame';label='GUARDIAN FRAME';}
    else if(role==='mage'){shot='arcane-focus';label='ARCANE FOCUS';}
    return {shot,label,role,support,aoe};
  }

  function beginCameraDirector(unit,key,ability,info,sourceRef,targetRefs=[]){
    const profile=cameraShotProfile(unit,key,ability,info,targetRefs);
    const entry={
      id:`director-${++fxSerial}`,sourceId:unit.id,key,ability:ability?.name||'Kỹ năng',
      side:sourceRef.side,slot:sourceRef.slot,role:profile.role,shot:profile.shot,label:profile.label,
      support:profile.support,aoe:profile.aoe,phase:'charge',startedAt:effectNow(),
      source:{side:sourceRef.side,slot:sourceRef.slot,id:unit.id},
      targets:targetRefs.map(x=>({side:x.side,slot:x.slot,id:x.unit.id}))
    };
    ui.cameraDirector=entry;
    return entry;
  }

  function setCameraDirectorPhase(phase,meta={}){
    const d=ui.cameraDirector;if(!d)return;
    d.phase=phase;Object.assign(d,meta);d.phaseStartedAt=effectNow();
  }

  function endCameraDirector(sourceId=null){
    if(!ui.cameraDirector)return;
    if(sourceId&&ui.cameraDirector.sourceId!==sourceId)return;
    ui.cameraDirector=null;
  }

  function selectedEntries(){
    const s=save(), ids=[];
    for(const id of s.team||[])if(pow(id)&&!ids.includes(id))ids.push(id);
    const ownedIds=Object.keys(s.owned||{}).filter(id=>pow(id));
    for(const id of ownedIds)if(!ids.includes(id))ids.push(id);
    for(const p of D.pows)if(!ids.includes(p.id))ids.push(p.id);
    return ids.slice(0,5).map(id=>{const p=pow(id);return {pow:p,owned:ownedFor(p,s)}}).filter(x=>x.pow);
  }

  function arenaEnemies(playerEntries){
    const used=new Set(playerEntries.map(e=>e.pow.id));
    const avgR=playerEntries.reduce((x,e)=>x+(rarityRank[e.pow.rarity]||0),0)/Math.max(1,playerEntries.length);
    const avgL=Math.round(playerEntries.reduce((x,e)=>x+Number(e.owned.level||1),0)/Math.max(1,playerEntries.length));
    const avgS=Math.round(playerEntries.reduce((x,e)=>x+Number(e.owned.stars||0),0)/Math.max(1,playerEntries.length));
    const pool=D.pows.filter(p=>!used.has(p.id)).sort((a,b)=>Math.abs((rarityRank[a.rarity]||0)-avgR)-Math.abs((rarityRank[b.rarity]||0)-avgR));
    const chosen=[];
    for(let i=0;i<pool.length&&chosen.length<3;i+=Math.max(1,Math.floor(pool.length/11))){if(!chosen.includes(pool[i]))chosen.push(pool[i]);}
    for(const p of pool)if(chosen.length<3&&!chosen.includes(p))chosen.push(p);
    return chosen.slice(0,3).map(p=>({pow:p,owned:{level:Math.max(1,avgL),stars:Math.min(Number(p.maxStars||0),avgS),shiny:false}}));
  }

  function storyPlayerEntries(){
    const s=save(),ids=[];
    for(const id of s.team||[])if(s.owned?.[id]&&pow(id)&&!ids.includes(id))ids.push(id);
    if(!ids.length&&s.starterId&&s.owned?.[s.starterId]&&pow(s.starterId))ids.push(s.starterId);
    return ids.slice(0,5).map(id=>{const p=pow(id);return {pow:p,owned:ownedFor(p,s)}}).filter(x=>x.pow);
  }

  function storyEnemyEntries(players,stage){
    const avgL=Math.max(1,Math.round(players.reduce((a,e)=>a+Number(e.owned?.level||1),0)/Math.max(1,players.length)));
    const avgS=Math.max(0,Math.round(players.reduce((a,e)=>a+Number(e.owned?.stars||0),0)/Math.max(1,players.length)));
    const adaptive=Math.max(Number(stage?.recommendedLevel)||1,Math.round(avgL*(Number(stage?.adaptive)||1)));
    const targetLevel=Math.max(1,Math.min(100,adaptive));
    const adaptiveStars=avgS+(stage?.kind==='boss'?1:stage?.kind==='elite'?1:0);
    const targetStars=Math.max(Number(stage?.recommendedStars)||0,Math.min(7,adaptiveStars));
    const ids=(stage?.enemyIds||[]).slice(0,Math.max(1,Number(stage?.enemyCount)||1));
    return ids.map((id,i)=>{
      const p=pow(id)||D.pows[(Number(stage?.storyIndex)||0+i)%D.pows.length];
      const boss=stage?.kind==='boss'&&i===0;
      const combatGrade=clamp((Math.max(1,Number(stage?.islandId)||1)-1)+(boss?1:0),0,10),gradeScale=Math.pow(Number(window.POWDER_POWER_CURVE_V8?.enemyGradeBase||1.35),combatGrade),scale=(Number(stage?.scale)||1)*gradeScale*(boss?1:1+(i*.025));
      return {pow:p,owned:{level:targetLevel,stars:Math.min(Number(p.maxStars||0),targetStars),shiny:false},boss,bossType:boss?'story':null,aiTier:boss?'boss':stage?.kind==='elite'?'elite':'standard',scale,combatGrade};
    }).filter(x=>x.pow);
  }

  function prepareStory(stage){
    serial+=1; flowToken+=1; resetUiExpiryScheduler();
    const players=storyPlayerEntries();
    if(!players.length){window.alert('Hãy chọn ít nhất 1 Pow trong đội trước khi vào phó bản.');return;}
    const enemies=storyEnemyEntries(players,stage);
    const mode=stage?.kind==='boss'?'boss':'pve';
    battle=new Core.BattleCore({serial,mode,bossType:stage?.kind==='boss'?'story':'daily',playerEntries:players,enemyEntries:enemies});
    window.POWDER_COMBAT_CONTENT_V1890?.attachBattle?.(battle,stage);
    // Adventure 8.2 pressure: later enemies start closer to their first action and with more resources.
    const init=Math.max(0,Number(stage?.initiative)||0), manaStart=Math.max(.5,Math.min(1,Number(stage?.manaStart)||.74)), rageStart=Math.max(20,Math.min(80,Number(stage?.rageStart)||20));
    battle.state.enemies.forEach((u,i)=>{u.meter=Math.min(92,(Number(u.meter)||0)+init-Math.min(4,i*2));u.mana=Math.min(u.maxMana,Math.max(u.mana,Math.round(u.maxMana*manaStart)));u.rage=Math.max(u.rage,rageStart);});
    // Learning-first counterweight: strong pre-battle mastery grants a small resource/tempo edge, never raw stat inflation.
    const adv=app()?.getAdventure?.()||{}, prep=adv.stagePrep?.[stage?.id]||{}, mastery=Number(prep.bestPct)||0;
    if(mastery>=90)battle.state.team.forEach(u=>{u.mana=Math.min(u.maxMana,u.mana+4);u.rage=Math.min(100,u.rage+3);});
    if(mastery>=100)battle.state.team.forEach(u=>u.meter=Math.min(95,(Number(u.meter)||0)+5));
    ui={mode:'ready',selectedKey:null,targetSide:null,question:null,lastEvents:[],reward:null,fx:[],unitPulse:{},banner:null,camera:'',hitStop:'',guardLink:null,attackCallout:null,attackMotion:null,cinematic:null,formCinematic:null,tamerMenu:null,domainCinematic:null,audioMenu:false,formationSelectedId:null,bossIntro:null,bossPhaseCinematic:null,bossWarning:null,bossDefeat:null,bossMechanicNotice:null,cameraDirector:null,domainVisualStartedAt:0,battleStats:null,combatFeed:[],logOpen:false,logFilter:'all',storyStage:JSON.parse(JSON.stringify(stage||{})),storyMastery:mastery,serverCombatState:stage?.serverCombatState||SC()?.cached?.(stage?.serverCombatSessionId)||null,serverCombatLastEventId:0};
    if(stage?.serverCombatSessionId&&ui.serverCombatState){SC()?.syncCore?.(battle,ui.serverCombatState);ui.serverCombatLastEventId=SC()?.maxEventId?.(ui.serverCombatState)||0;}
    ui.battleStats=initBattleStats();
    document.documentElement.classList.add('combat-v7-session');
    ui.preloadPromise=preloadCombatAssets();
    render();
  }

  function bossEnemy(playerEntries,type){
    const candidates={
      daily:['terrakor','thunderhorn','volcarnos','bloomlord'],
      promotion:['tempestrix','noxabyss','luxarion','calderion'],
      weekly:['noxabyss','tempestrix','luxarion','magmorax']
    }[type]||[];
    let p=candidates.map(pow).find(Boolean) || [...D.pows].sort((a,b)=>(rarityRank[b.rarity]||0)-(rarityRank[a.rarity]||0))[0];
    const avgL=Math.round(playerEntries.reduce((x,e)=>x+Number(e.owned.level||1),0)/Math.max(1,playerEntries.length));
    const scale=type==='weekly'?3.4:type==='promotion'?2.65:2.15;
    return [{pow:p,owned:{level:Math.max(avgL,50),stars:Number(p.maxStars||0),shiny:false},boss:true,bossType:type,aiTier:'boss',scale}];
  }


  function bossTypeLabel(type){
    return type==='weekly'?'BOSS TUẦN':type==='promotion'?'BOSS THĂNG RANK':type==='story'?'BOSS CỐT TRUYỆN':'BOSS NGÀY';
  }
  function bossEncounter(type){return window.POWDER_BOSS_ENCOUNTER_V1860?.encounter?.(type)||window.POWDER_BOSS_ENCOUNTER_V21?.encounter?.(type)||null;}
  function bossMaxPhases(type){const cfg=bossEncounter(type);return cfg?.thresholds?.length?cfg.thresholds.length+1:1;}
  function bossThresholds(type){const cfg=bossEncounter(type);return Array.isArray(cfg?.thresholds)?cfg.thresholds.map(x=>Math.round(Number(x)*100)):[];}
  function bossDangerLabel(key){
    return key==='ultimate'?'TỐI THƯỢNG':key==='exclusive'?'ĐỘC QUYỀN':key==='skill2'?'KỸ NĂNG MẠNH':key==='skill1'?'KỸ NĂNG':'ĐÒN ĐÁNH';
  }

  function initBattleStats(){
    if(!battle)return null;
    const units={};
    const initialActive=new Set([...battle.state.team,...battle.state.enemies].map(u=>u.id));
    const reserveIds=new Set(battle.state.reserves.map(u=>u.id));
    for(const u of [...battle.state.team,...battle.state.reserves,...battle.state.enemies]){
      units[u.id]={
        unitId:u.id,powId:u.powId,name:u.name,asset:u.asset,side:u.side,roleKey:u.combatRole||'marksman',roleLabel:u.roleLabel||ROLE_ANIMATION[u.combatRole]?.label||'Pow',rarity:u.rarity,element:u.element,maxHp:Number(u.maxHp)||1,
        entered:initialActive.has(u.id),reserve:reserveIds.has(u.id),actions:0,basic:0,skill1:0,skill2:0,ultimate:0,exclusive:0,
        damageDealt:0,damageTaken:0,shieldDamage:0,shieldAbsorbed:0,healingDone:0,healingReceived:0,
        guards:0,protectedByGuard:0,kills:0,crits:0,statusesApplied:0,statusesReceived:0,cleanses:0,deaths:0,
        knowledgeSum:0,knowledgeActions:0,knowledgePerfect:0
      };
    }
    return {
      startedAt:null,endedAt:null,eventCount:0,units,
      tamer:{simpleUses:0,assaultUses:0,guardUses:0,expansionUses:0,domainId:null,domainName:null,domainActions:0,domainRoundsUsed:0,bonusDamage:0,damagePrevented:0,bonusHealing:0,speedBoostedActions:0}
    };
  }

  function battleStatLine(id){return ui.battleStats?.units?.[id]||null;}
  function feedUnitName(id){return unitRef(id)?.unit?.name||'Pow';}
  function pushCombatFeed(kind,text,tone='system',meta={}){
    if(!text)return;
    ui.combatFeed=Array.isArray(ui.combatFeed)?ui.combatFeed:[];
    ui.combatFeed.push({id:`feed-${++fxSerial}`,kind,text,tone,round:Number(battle?.state?.round)||1,at:Date.now(),...meta});
    if(ui.combatFeed.length>96)ui.combatFeed.splice(0,ui.combatFeed.length-96);
  }
  function recordCombatFeed(evt){
    if(!evt)return;
    if(evt.type==='battle-start')return pushCombatFeed('system','Bắt đầu chiến đấu.','start');
    if(evt.type==='turn-start')return pushCombatFeed('system',`${feedUnitName(evt.unitId)} bắt đầu lượt.`,'turn');
    if(evt.type==='action'){
      const dmg=Number(evt.result?.damage)||0, heal=Number(evt.result?.heal)||0;
      const targets=(evt.targetIds||[]).map(feedUnitName).join(', ');
      const result=dmg?`${fmtStat(dmg)} DMG`:heal?`+${fmtStat(heal)} HP`:'Kích hoạt hiệu ứng';
      const scale=Number(evt.scale)||1;
      return pushCombatFeed('action',`${feedUnitName(evt.sourceId)} · ${evt.ability}${targets?` → ${targets}`:''} · ${result}${scale!==1?` · x${scale.toFixed(2)}`:''}`,dmg?'damage':heal?'heal':'action');
    }
    if(evt.type==='guard')return pushCombatFeed('action',`${feedUnitName(evt.guardId)} BẢO HỘ ${feedUnitName(evt.protectedId)}.`,'guard');
    if(evt.type==='kill')return pushCombatFeed('action',`${feedUnitName(evt.sourceId)} hạ gục ${feedUnitName(evt.targetId)}.`,'kill');
    if(evt.type==='break')return pushCombatFeed('action',`${feedUnitName(evt.sourceId)} phá Khiên của ${feedUnitName(evt.targetId)}.`,'break');
    if(evt.type==='heal')return pushCombatFeed('action',`${feedUnitName(evt.sourceId)} hồi ${fmtStat(evt.amount)} HP.`,'heal');
    if(evt.type==='status-apply')return pushCombatFeed('status',`${feedUnitName(evt.targetId)} nhận ${statusMeta(evt.status).label}.`,statusMeta(evt.status).tone||'status');
    if(evt.type==='status-expire')return pushCombatFeed('status',`${statusMeta(evt.status).label} trên ${feedUnitName(evt.targetId)} kết thúc.`,'expire');
    if(evt.type==='status-tick'){
      const e=evt.event||{}, label=statusMeta(e.status||'').label||e.status||'Hiệu ứng';
      if(e.type==='dot')return pushCombatFeed('status',`${feedUnitName(evt.unitId)} chịu ${fmtStat(e.amount)} DMG từ ${label}.`,'damage');
      if(e.type==='heal')return pushCombatFeed('status',`${feedUnitName(evt.unitId)} hồi ${fmtStat(e.amount)} HP từ ${label}.`,'heal');
      if(e.type==='skip')return pushCombatFeed('status',`${feedUnitName(evt.unitId)} mất lượt do ${label}.`,'cc');
    }
    if(evt.type==='cleanse')return pushCombatFeed('status',`${feedUnitName(evt.sourceId)} thanh tẩy ${statusMeta(evt.status).label} khỏi ${feedUnitName(evt.targetId)}.`,'cleanse');
    if(evt.type==='replacement')return pushCombatFeed('system',`${feedUnitName(evt.unitId)} vào sân thay thế.`,'replace');
    if(evt.type==='boss-phase')return pushCombatFeed('system',`${feedUnitName(evt.bossId)} chuyển sang Pha ${evt.phase}.`,'boss');
    if(evt.type==='boss-pattern-telegraph')return pushCombatFeed('system',`${feedUnitName(evt.bossId)} · ${evt.intent||'Đổi chiến thuật'}${evt.detail?` · ${evt.detail}`:''}.`,'boss');
    if(evt.type==='boss-mechanic-arm')return pushCombatFeed('system',`⚠ ${evt.name} · PHẢN ỨNG: ${evt.responseLabel||evt.response||'HÀNH ĐỘNG'}${evt.detail?` · ${evt.detail}`:''}`,'boss');
    if(evt.type==='boss-mechanic-progress')return pushCombatFeed('system',`${evt.name} · ${evt.detail||`Tiến độ ${Math.round((Number(evt.progress)||0)*100)}%`}`,'boss');
    if(evt.type==='boss-mechanic-outcome')return pushCombatFeed('system',`${evt.name} · ${evt.outcome==='interrupted'?'ĐÃ NGẮT':evt.outcome==='cleansed'?'ĐÃ THANH TẨY':evt.outcome==='resolved'?'BOSS KÍCH HOẠT':'KẾT THÚC'}${evt.detail?` · ${evt.detail}`:''}`,evt.outcome==='resolved'?'danger':'boss');
    if(evt.type==='boss-enrage')return pushCombatFeed('system',`${feedUnitName(evt.bossId)} bước vào CUỒNG NỘ CUỐI CÙNG.`,'danger');
    if(evt.type==='tamer-simple')return pushCombatFeed('tamer',`Tamer Command · ${evt.name}.`,'tamer');
    if(evt.type==='tamer-expansion')return pushCombatFeed('tamer',`BÀNH TRƯỚNG LÃNH ĐỊA · ${evt.name}.`,'domain');
    if(evt.type==='tamer-domain-end')return pushCombatFeed('tamer',`${evt.name} tan biến.`,'domain-end');
    if(evt.type==='battle-end')return pushCombatFeed('system',evt.result==='win'?'CHIẾN THẮNG.':'THẤT BẠI.',evt.result==='win'?'win':'loss');
  }
  function addBattleStat(id,key,amount=1){const line=battleStatLine(id);if(line)line[key]=(Number(line[key])||0)+(Number(amount)||0);return line;}
  function recordBattleEvent(evt){
    if(!evt)return;
    recordCombatFeed(evt);
    const stats=ui.battleStats;if(!stats)return;
    stats.eventCount+=1;
    if(evt.type==='battle-start'){stats.startedAt=stats.startedAt||Date.now();return;}
    if(evt.type==='turn-start'){const line=battleStatLine(evt.unitId);if(line)line.entered=true;return;}
    if(evt.type==='replacement'){const line=battleStatLine(evt.unitId);if(line){line.entered=true;line.reserve=false;}return;}
    if(evt.type==='status-apply'){
      if(evt.sourceId)addBattleStat(evt.sourceId,'statusesApplied',1);
      addBattleStat(evt.targetId,'statusesReceived',1);return;
    }
    if(evt.type==='cleanse'){if(evt.sourceId)addBattleStat(evt.sourceId,'cleanses',1);return;}
    if(evt.type==='guard'){
      addBattleStat(evt.guardId,'guards',1);addBattleStat(evt.protectedId,'protectedByGuard',1);return;
    }
    if(evt.type==='damage'){
      for(const impact of evt.impacts||[]){
        addBattleStat(evt.sourceId,'damageDealt',Number(impact.damage)||0);
        addBattleStat(evt.sourceId,'shieldDamage',Number(impact.absorbed)||0);
        addBattleStat(impact.targetId,'damageTaken',Number(impact.damage)||0);
        addBattleStat(impact.targetId,'shieldAbsorbed',Number(impact.absorbed)||0);
        if(impact.crit)addBattleStat(evt.sourceId,'crits',1);
      }
      return;
    }
    if(evt.type==='heal'){
      const amount=Number(evt.amount)||0;addBattleStat(evt.sourceId,'healingDone',amount);
      const ids=evt.targetIds||[];const per=ids.length?amount/ids.length:0;for(const id of ids)addBattleStat(id,'healingReceived',per);
      return;
    }
    if(evt.type==='kill'){
      addBattleStat(evt.sourceId,'kills',1);const target=battleStatLine(evt.targetId);if(target)target.deaths=Math.max(1,Number(target.deaths)||0);return;
    }
    if(evt.type==='status-tick'){
      const e=evt.event||{}, amount=Number(e.amount)||0;
      if(e.type==='dot'){
        addBattleStat(evt.sourceId,'damageDealt',amount);addBattleStat(evt.unitId,'damageTaken',amount);
        const target=battleStatLine(evt.unitId), ref=unitRef(evt.unitId);
        if(target && ref?.unit?.defeated && !target.deaths){target.deaths=1;if(evt.sourceId)addBattleStat(evt.sourceId,'kills',1);}
      }else if(e.type==='heal'){
        addBattleStat(evt.sourceId||evt.unitId,'healingDone',amount);addBattleStat(evt.unitId,'healingReceived',amount);
      }
      return;
    }
    if(evt.type==='action'){
      const line=battleStatLine(evt.sourceId);if(line){
        line.actions+=1;if(['basic','skill1','skill2','ultimate','exclusive'].includes(evt.key))line[evt.key]+=1;
        const scale=Number(evt.scale)||1;line.knowledgeSum+=scale;line.knowledgeActions+=1;if(scale>=1)line.knowledgePerfect+=1;
      }
      const t=stats.tamer, dmg=Number(evt.result?.damage)||0, heal=Number(evt.result?.heal)||0;
      if(evt.tamerSimple==='assault'){t.bonusDamage+=Math.max(0,Math.round(dmg-dmg/1.25));}
      if(evt.tamerSimple==='guard'){t.damagePrevented+=Math.max(0,Math.round(dmg/0.70-dmg));}
      if(evt.domain){
        const src=battleStatLine(evt.sourceId); const playerAction=src?.side==='player';
        if((evt.domain==='fortress'&&!playerAction)||(evt.domain!=='fortress'&&playerAction))t.domainActions+=1;
        if(evt.domain==='frenzy'&&playerAction)t.bonusDamage+=Math.max(0,Math.round(dmg-dmg/1.35));
        if(evt.domain==='fortress'&&!playerAction)t.damagePrevented+=Math.max(0,Math.round(dmg/0.70-dmg));
        if(evt.domain==='vitality'&&playerAction)t.bonusHealing+=Math.max(0,Math.round(heal-heal/1.45));
        if(evt.domain==='timeflow'&&playerAction)t.speedBoostedActions+=1;
      }
      return;
    }
    if(evt.type==='tamer-simple'){
      stats.tamer.simpleUses+=1;if(evt.kind==='assault')stats.tamer.assaultUses+=1;if(evt.kind==='guard')stats.tamer.guardUses+=1;return;
    }
    if(evt.type==='tamer-expansion'){
      stats.tamer.expansionUses+=1;stats.tamer.domainId=evt.id;stats.tamer.domainName=evt.name;stats.tamer.domainRoundsUsed=0;return;
    }
    if(evt.type==='tamer-domain-tick'){
      stats.tamer.domainRoundsUsed=Math.max(stats.tamer.domainRoundsUsed,5-Math.max(0,Number(evt.remainingRounds)||0));return;
    }
    if(evt.type==='tamer-domain-end'){stats.tamer.domainRoundsUsed=5;return;}
    if(evt.type==='battle-end'){
      stats.endedAt=Date.now();
      const active=battle?.state?.tamer?.expansion;if(active)stats.tamer.domainRoundsUsed=Math.max(stats.tamer.domainRoundsUsed,5-Math.max(0,Number(active.remainingRounds)||0));
    }
  }

  function normalizeMetric(v,max){return max>0?clamp((Number(v)||0)/max,0,1):0;}
  function mvpWeights(role){
    const map={
      marksman:{damage:.50,heal:0,tank:.05,guard:.03,kills:.20,crits:.17,utility:.05},
      assassin:{damage:.43,heal:0,tank:.05,guard:.02,kills:.27,crits:.18,utility:.05},
      mage:{damage:.46,heal:.02,tank:.05,guard:.02,kills:.18,crits:.12,utility:.15},
      knight:{damage:.30,heal:.02,tank:.18,guard:.18,kills:.12,crits:.08,utility:.12},
      tank:{damage:.16,heal:.02,tank:.28,guard:.30,kills:.06,crits:.03,utility:.15},
      healer:{damage:.08,heal:.52,tank:.10,guard:.04,kills:.03,crits:.01,utility:.22},
      enchanter:{damage:.16,heal:.08,tank:.10,guard:.10,kills:.04,crits:.02,utility:.50},
      musician:{damage:.16,heal:.08,tank:.10,guard:.10,kills:.04,crits:.02,utility:.50},
      fighter:{damage:.39,heal:.02,tank:.24,guard:.06,kills:.15,crits:.09,utility:.05}
    };return map[role]||map.marksman;
  }

  function combatSummary(){
    const stats=ui.battleStats||initBattleStats()||{units:{},tamer:{}};
    const all=Object.values(stats.units||{});const players=all.filter(x=>x.side==='player');const enemies=all.filter(x=>x.side==='enemy');
    const active=players.filter(x=>x.entered||x.actions||x.damageTaken||x.healingDone);
    const maxOf=key=>Math.max(0,...active.map(x=>Number(x[key])||0));
    const maxPressure=Math.max(0,...active.map(x=>(Number(x.damageTaken)||0)+(Number(x.shieldAbsorbed)||0)));
    const maxUtility=Math.max(0,...active.map(x=>(Number(x.statusesApplied)||0)+(Number(x.cleanses)||0)*2));
    const maxima={damage:maxOf('damageDealt'),heal:maxOf('healingDone'),tank:maxPressure,guard:maxOf('guards'),kills:maxOf('kills'),crits:maxOf('crits'),utility:maxUtility};
    for(const line of players){
      const w=mvpWeights(line.roleKey), utility=(Number(line.statusesApplied)||0)+(Number(line.cleanses)||0)*2;
      const score=(normalizeMetric(line.damageDealt,maxima.damage)*w.damage+normalizeMetric(line.healingDone,maxima.heal)*w.heal+normalizeMetric((Number(line.damageTaken)||0)+(Number(line.shieldAbsorbed)||0),maxima.tank)*w.tank+normalizeMetric(line.guards,maxima.guard)*w.guard+normalizeMetric(line.kills,maxima.kills)*w.kills+normalizeMetric(line.crits,maxima.crits)*w.crits+normalizeMetric(utility,maxima.utility)*w.utility)*100;
      line.mvpScore=(line.entered||line.actions)?Math.round(score):0;
      line.knowledgeAvg=line.knowledgeActions?line.knowledgeSum/line.knowledgeActions:0;
    }
    const mvp=[...active].sort((a,b)=>b.mvpScore-a.mvpScore||b.damageDealt-a.damageDealt||b.healingDone-a.healingDone)[0]||players[0]||null;
    const sum=(arr,key)=>arr.reduce((s,x)=>s+(Number(x[key])||0),0);
    return {
      players,enemies,mvp,tamer:stats.tamer||{},
      teamDamage:sum(players,'damageDealt'),enemyDamage:sum(enemies,'damageDealt'),teamHeal:sum(players,'healingDone'),teamTaken:sum(players,'damageTaken'),
      teamKills:sum(players,'kills'),teamCrits:sum(players,'crits'),teamGuards:sum(players,'guards'),
      durationMs:Math.max(0,(stats.endedAt||Date.now())-(stats.startedAt||Date.now())),rounds:Number(battle?.state?.round)||1,turns:Number(battle?.state?.turnCount)||0
    };
  }

  function fmtStat(n){return Math.round(Number(n)||0).toLocaleString('vi-VN');}
  function fmtDuration(ms){const sec=Math.max(0,Math.round((Number(ms)||0)/1000));const m=Math.floor(sec/60),s=sec%60;return `${m}:${String(s).padStart(2,'0')}`;}
  function lineHighlight(line){
    if(!line)return '';
    if(line.roleKey==='healer')return `Hồi phục ${fmtStat(line.healingDone)}`;
    if(line.roleKey==='tank')return `Bảo hộ ${fmtStat(line.guards)} · Chịu ${fmtStat(line.damageTaken)}`;
    if(line.roleKey==='enchanter'||line.roleKey==='musician')return `Hiệu ứng ${fmtStat((line.statusesApplied||0)+(line.cleanses||0))}`;
    return `Sát thương ${fmtStat(line.damageDealt)} · Hạ ${fmtStat(line.kills)}`;
  }


  function rankHud(){
    const s=save(); const idx=clamp(Number(s.rank)||0,0,D.ranks.length-1); const r=D.ranks[idx]||D.ranks[0];
    return `<div class="cv7-rank"><img src="assets/ranks/rank-${idx}.webp" alt=""><div><small>TAMER</small><b>${esc(r.name)}</b><span>🏆 ${Number(s.exp)||0}</span></div></div>`;
  }

  const STATUS_VISUAL_META={
    'Stun':{label:'CHOÁNG',icon:'💫',cls:'stun',tone:'debuff',description:'Mất lượt hành động kế tiếp. Trong thời gian Choáng, Pow cũng không thể thực hiện Bảo hộ.'},
    'Poison':{label:'NHIỄM ĐỘC',icon:'☣',cls:'poison',tone:'debuff',description:'Mất 5% HP tối đa khi đến lượt. Là sát thương theo thời gian và tiếp tục tồn tại cho tới khi hết lượt hoặc được Thanh tẩy.'},
    'Burn':{label:'THIÊU ĐỐT',icon:'🔥',cls:'burn',tone:'debuff',description:'Mất 6% HP tối đa khi đến lượt. Có thể gây áp lực kéo dài qua nhiều lượt.'},
    'Freeze':{label:'ĐÓNG BĂNG',icon:'❄',cls:'freeze',tone:'debuff',description:'Mất lượt hành động và bị giảm SPEED. Đây là khống chế cứng nên Bảo hộ bị vô hiệu trong lượt bị khóa.'},
    'Slow':{label:'CHẬM',icon:'◴',cls:'slow',tone:'debuff',description:'Giảm 25% SPEED, khiến Pow tích thanh lượt chậm hơn.'},
    'Defense Up':{label:'TĂNG DEF',icon:'🛡',cls:'defense-up',tone:'buff',description:'Tăng 30% DEF. Hiệu ứng này làm giảm sát thương nhận vào qua công thức phòng thủ nhưng KHÔNG tạo thêm HP hay Giáp Ảo.'},
    'Attack Up':{label:'TĂNG ATK',icon:'⚔',cls:'attack-up',tone:'buff',description:'Tăng 30% ATK trong thời gian hiệu lực.'},
    'AP Up':{label:'TĂNG AP',icon:'✦',cls:'ap-up',tone:'buff',description:'Tăng 30% AP trong thời gian hiệu lực.'},
    'Shield':{label:'GIÁP ẢO',icon:'⬡',cls:'shield-status',tone:'buff',description:'Lớp HP tạm thời nằm trên HP thật. Sát thương phá Giáp Ảo trước; chỉ phần dư mới trừ HP. Không phải buff DEF và có thể bị phá hoàn toàn.'},
    'Regeneration':{label:'TÁI SINH',icon:'✚',cls:'regeneration',tone:'buff',description:'Hồi 6% HP tối đa khi đến lượt trong thời gian hiệu lực.'},
    'Speed Up':{label:'TĂNG SPEED',icon:'➤',cls:'speed-up',tone:'buff',description:'Tăng tốc độ hành động và có thể đẩy thanh lượt tùy kỹ năng tạo hiệu ứng.'},
    'Curse':{label:'NGUYỀN RỦA',icon:'🌑',cls:'curse',tone:'debuff',description:'Nguyền rủa chiến thuật độc quyền hệ Bóng tối. Tác dụng cụ thể phụ thuộc kỹ năng đã đặt Nguyền rủa.'},
    'Paralysis':{label:'TÊ LIỆT',icon:'⚡',cls:'paralysis',tone:'debuff',description:'Khống chế điện khiến mục tiêu bị khóa hành động theo cơ chế kỹ năng và mất khả năng Bảo hộ khi bị khống chế cứng.'},
    'Frostbite':{label:'CÓNG LẠNH',icon:'❅',cls:'frostbite',tone:'debuff',description:'Khống chế băng nâng cao: làm giảm nhịp hành động và được hiển thị như trạng thái khóa mạnh.'},
    'Magma Burn':{label:'THIÊU ĐỐT DUNG NHAM',icon:'🌋',cls:'magma-burn',tone:'debuff',description:'Thiêu đốt đặc biệt của hệ Dung nham, gây áp lực sát thương theo thời gian và tương tác với kỹ năng Dung nham.'},
    'Bind':{label:'TRÓI BUỘC',icon:'🌿',cls:'bind',tone:'debuff',description:'Khống chế cứng bằng trói buộc. Pow bị khóa hành động và không thể Bảo hộ trong lượt bị khống chế.'},
    'Aim Mark':{label:'NGẮM BẮN',icon:'◎',cls:'aim-mark',tone:'debuff',description:'Dấu mục tiêu cho Xạ thủ; các kỹ năng liên quan có thể nhận thêm lợi ích khi tấn công mục tiêu này.'},
    'Hunt Mark':{label:'DẤU SĂN',icon:'🎯',cls:'hunt-mark',tone:'debuff',description:'Dấu săn dành cho chuỗi Ám sát; kỹ năng Sát thủ liên quan gây thêm áp lực lên mục tiêu bị đánh dấu.'},
    'Boss Mark':{label:'DẤU SĂN BOSS',icon:'⚠',cls:'boss-mark',tone:'debuff',description:'Boss đang khóa mục tiêu này cho mechanic sắp tới. Thanh tẩy dấu trước lượt Boss kế tiếp để hủy cơ chế.'},
    'Suppression Mark':{label:'DẤU TRẤN ÁP',icon:'⌛',cls:'suppression-mark',tone:'debuff',description:'Boss Cốt truyện đang khóa nhịp mục tiêu này. Thanh tẩy trước lượt Boss kế tiếp để tránh Chậm và mất Thanh lượt.'},
    'Petrify':{label:'HÓA ĐÁ',icon:'◆',cls:'petrify',tone:'debuff',description:'Khống chế cứng: mất lượt và không thể Bảo hộ khi đang bị Hóa đá.'},
    'Sleep':{label:'NGỦ',icon:'Z',cls:'sleep',tone:'debuff',description:'Khống chế cứng khiến Pow không thể hành động trong thời gian hiệu lực.'},
    'Effect Resist':{label:'KHÁNG HIỆU ỨNG',icon:'◇',cls:'effect-resist',tone:'buff',description:'Tăng khả năng chống lại hiệu ứng bất lợi và khống chế theo kỹ năng tạo buff.'},
    'Guard':{label:'BẢO HỘ',icon:'⬢',cls:'guard-status',tone:'buff',description:'Tăng khả năng can thiệp cho đồng minh trước đòn đơn mục tiêu. Không chặn AOE và bị vô hiệu bởi khống chế cứng.'}
  };
  const STATUS_BASE_FOR_CUSTOM={'Paralysis':'Slow','Frostbite':'Freeze','Magma Burn':'Burn','Bind':'Stun'};
  function statusMeta(name){
    const meta=STATUS_VISUAL_META[name]||{}; const data=D.statusEffects?.[name]||{};
    return {label:meta.label||String(data.name||name).toUpperCase(),icon:meta.icon||data.icon||'✦',cls:meta.cls||String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),tone:meta.tone||'neutral',description:meta.description||data.description||''};
  }
  const STATUS_PRIORITY={Stun:100,Freeze:98,Paralysis:97,Petrify:96,Sleep:95,Bind:94,Frostbite:92,Curse:88,Shield:84,'Magma Burn':80,Poison:78,Burn:76,'Boss Mark':90,'Suppression Mark':89,'Hunt Mark':72,'Aim Mark':71,Slow:66,Regeneration:64,Guard:62,'Effect Resist':60,'Defense Up':58,'Attack Up':57,'AP Up':56,'Speed Up':55};
  const HARD_CC_STATUSES=new Set(['Stun','Freeze','Frostbite','Bind','Petrify','Sleep','Paralysis']);
  function statusRecord(u,name){return u.customStatuses?.[name] ?? u.statuses?.[name] ?? null;}
  function statusTurns(u,name){return Number(statusRecord(u,name)?.turns ?? 0)||0;}
  function statusStacks(u,name){
    const r=statusRecord(u,name)||{};
    const n=Number(r.stacks ?? r.stack ?? r.count ?? 0);
    return Number.isFinite(n)&&n>1?Math.round(n):0;
  }
  function visualStatuses(u){
    const custom=new Set(Object.keys(u.customStatuses||{}));
    const hiddenBase=new Set([...custom].map(x=>STATUS_BASE_FOR_CUSTOM[x]).filter(Boolean));
    return [...new Set([...Object.keys(u.statuses||{}),...custom])].filter(x=>!hiddenBase.has(x));
  }
  function orderedVisualStatuses(u){
    return visualStatuses(u).sort((a,b)=>{
      const pa=STATUS_PRIORITY[a]||0,pb=STATUS_PRIORITY[b]||0;
      if(pa!==pb)return pb-pa;
      const ta=statusMeta(a).tone,tb=statusMeta(b).tone;
      if(ta!==tb)return ta==='debuff'?-1:1;
      return String(statusMeta(a).label).localeCompare(String(statusMeta(b).label),'vi');
    });
  }
  function statusVfxMarkup(u){
    const names=visualStatuses(u);
    if(!names.length)return '';
    const major=new Set(['Stun','Poison','Burn','Freeze','Slow','Shield','Regeneration','Curse','Paralysis','Frostbite','Magma Burn','Bind','Petrify','Sleep','Aim Mark','Hunt Mark','Boss Mark','Suppression Mark']);
    const layers=names.filter(x=>major.has(x)).slice(0,4).map(name=>{const m=statusMeta(name);const shieldPct=name==='Shield'?clamp((Number(u.shield)||0)/Math.max(1,u.maxHp),0,1):0;return `<span class="cv7-status-layer status-${esc(m.cls)}" style="--status-strength:${shieldPct||1}"><i></i><b></b><em>${esc(m.icon)}</em></span>`;}).join('');
    const buffs=names.filter(x=>!major.has(x)).slice(0,5).map(name=>{const m=statusMeta(name);return `<span class="cv7-status-sigil status-${esc(m.cls)}"><i>${esc(m.icon)}</i></span>`;}).join('');
    return `<div class="cv7-status-vfx" aria-hidden="true" style="--status-time:-${Math.round(effectNow()%12000)}ms">${layers}<div class="cv7-status-sigils">${buffs}</div></div>`;
  }
  function statusChipsMarkup(u,limit=5){
    const names=orderedVisualStatuses(u),shown=names.slice(0,Math.max(1,limit));
    const chips=shown.map(name=>{
      const m=statusMeta(name),turns=statusTurns(u,name),stacks=statusStacks(u,name);
      const shield=name==='Shield'?Math.max(0,Math.round(Number(u.shield)||0)):0;
      const typeLabel=m.tone==='buff'?'BUFF':m.tone==='debuff'?'DEBUFF':'HIỆU ỨNG';
      const details=[m.label,turns?`${turns} lượt`:'',stacks?`${stacks} tầng`:'',shield?`Giáp Ảo ${shield.toLocaleString('vi-VN')}`:'',m.description].filter(Boolean);
      const title=details.join(' · ');
      const rows=[turns?`<span><small>THỜI LƯỢNG</small><b>${turns} lượt</b></span>`:'',stacks?`<span><small>CỘNG DỒN</small><b>×${stacks}</b></span>`:'',shield?`<span><small>GIÁP CÒN LẠI</small><b>${shield.toLocaleString('vi-VN')}</b></span>`:''].join('');
      return `<i class="cv7-status-chip cv78-status-chip ${esc(m.tone)} status-${esc(m.cls)} ${HARD_CC_STATUSES.has(name)?'priority-cc':''}" title="${esc(title)}" aria-label="${esc(title)}"><span>${esc(m.icon)}</span>${turns?`<b class="turns">${turns}</b>`:''}${stacks?`<em class="stacks">×${stacks}</em>`:''}<span class="cv824-status-tooltip"><header><i>${esc(m.icon)}</i><div><small>${typeLabel}</small><strong>${esc(m.label)}</strong></div></header>${rows?`<section>${rows}</section>`:''}<p>${esc(m.description||'Hiệu ứng chiến đấu đang hoạt động.')}</p>${name==='Shield'?'<footer>Giáp Ảo hấp thụ sát thương trước HP thật · Không phải Tăng DEF</footer>':''}</span></i>`;
    }).join('');
    const hidden=Math.max(0,names.length-shown.length);
    const overflow=hidden?`<i class="cv7-status-chip cv78-status-more" title="${esc(names.slice(shown.length).map(n=>statusMeta(n).label).join(', '))}"><span>+${hidden}</span></i>`:'';
    return chips+overflow;
  }
  function ccLockMarkup(u,names=orderedVisualStatuses(u)){
    const ccName=names.find(s=>HARD_CC_STATUSES.has(s)); if(!ccName)return '';
    const m=statusMeta(ccName),turns=statusTurns(u,ccName);
    return `<span class="cv7-cc-lock cv78-cc-lock status-${esc(m.cls)}"><i>${esc(m.icon)}</i><b>${esc(m.label)}</b><small>${turns?`${turns} LƯỢT · `:''}MẤT LƯỢT</small></span>`;
  }

  function unitMarkup(u,side,slot){
    const p=pow(u.powId), el=element(u.element); const hp=Math.round(u.hp/u.maxHp*100); const mana=Math.round(u.mana/u.maxMana*100); const rage=Math.round(u.rage); const shield=Math.max(0,Math.round(Number(u.shield)||0)); const shieldPct=clamp(Math.round(shield/Math.max(1,u.maxHp)*100),0,100);
    const current=battle?.state.current?.id===u.id; const targetable=ui.mode==='target' && (ui.targetSide==='both'||ui.targetSide===side) && !u.defeated; const pulseEntry=ui.unitPulse?.[u.id]||null; const pulse=typeof pulseEntry==='string'?pulseEntry:(pulseEntry?.kind||''); const pulseAge=pulseEntry&&typeof pulseEntry==='object'?effectAge(pulseEntry):0;
    const motion=ui.attackMotion?.sourceId===u.id?ui.attackMotion:null; const teleTarget=ui.attackMotion?.targetIds?.includes(u.id); const lockedTarget=tacticalTargetRef()?.unit?.id===u.id; const sig=motion?.signature||null; const attackAge=motion?.phase==='release'&&motion?.releaseStartedAt?Math.max(0,Math.round(effectNow()-motion.releaseStartedAt)):0;
    const activeStatusNames=orderedVisualStatuses(u); const activeStatusClasses=activeStatusNames.map(s=>`has-status-${statusMeta(s).cls}`).join(' ');
    return `<button class="cv7-unit ${side} slot-${slot} rarity-${esc(u.rarity)} ${u.boss?'boss-unit':''} ${u.defeated?'dead':''} ${!u.defeated&&hp<=25?'hp-critical':!u.defeated&&hp<=50?'hp-wounded':''} ${current?'current':''} ${targetable?'targetable':''} ${teleTarget?'telegraph-target':''} ${lockedTarget?'cv69-locked-target':''} ${activeStatusClasses} ${motion?`motion-${esc(motion.style)} motion-${esc(motion.phase)} motion-${esc(motion.key)} motion-role-${esc(motion.role||'marksman')} motion-id-${esc(motion.identity||'direct-strike')} ${sig?`signature-source sig-${esc(sig.id)} sig-${esc(sig.tier)}`:''}`:''} ${pulse?`pulse-${pulse}`:''}" style="--pulse-age:-${pulseAge}ms;${motion?`--attack-step-ms:${Number(motion.release)||780}ms;--attack-hit-ms:${Number(motion.impactDelay)||420}ms;--attack-age:-${attackAge}ms;`:''}" data-cv7-unit="${esc(u.id)}" data-slot="${slot}" data-boss-phase="${Number(u.bossPhase||1)}" ${u.defeated?'disabled':''}>
      <div class="cv7-unit-top"><span class="cv7-level">Lv.${Number(u.owned?.level)||1}</span><span class="cv7-element" style="--el:${el.color}">${el.icon}</span><span class="cv7-role">${esc(u.roleLabel)}</span></div>
      <div class="cv7-art-wrap"><img class="cv7-art" src="${esc(combatAsset(u.asset))}" alt="${esc(u.name)}" decoding="async">${statusVfxMarkup(u)}${ccLockMarkup(u,activeStatusNames)}<i class="cv7-ring" style="--el:${el.color}"></i></div>
      <div class="cv7-unit-info ${shield>0?'has-virtual-shield':''}"><b>${esc(u.name)}</b><div class="cv7-bars"><i class="hp"><span style="width:${hp}%"></span><b class="cv824-shield-bar" style="width:${shieldPct}%"></b></i><i class="mana"><span style="width:${mana}%"></span></i><i class="rage"><span style="width:${rage}%"></span></i></div>
      <div class="cv7-values"><span>${Math.max(0,Math.round(u.hp)).toLocaleString('vi-VN')}/${Math.round(u.maxHp).toLocaleString('vi-VN')}${shield>0?` · <b class="cv824-shield-value">⬡ +${shield.toLocaleString('vi-VN')}</b>`:''}</span><span>🔹 ${Math.round(u.mana)}/${u.maxMana}</span><span>⚡ ${rage}</span></div>
      <div class="cv7-presence"><span>Hiện diện <b>${u.presence}</b></span>${u.guardChance?`<span>Bảo hộ <b>${clamp(u.guardChance+u.guardBonus,0,100)}%</b></span>`:''}</div>
      <div class="cv7-statuses">${statusChipsMarkup(u)}</div></div>
    </button>`;
  }

  function statusIcon(s){
    const map={Burn:'🔥',Poison:'☣',Stun:'💫',Freeze:'❄',Slow:'🐌','Defense Up':'🛡','Attack Up':'⚔','AP Up':'✦',Shield:'◇',Regeneration:'✚','Speed Up':'💨',Curse:'🌑',Paralysis:'⚡',Frostbite:'🧊','Magma Burn':'🌋',Bind:'🌿','Aim Mark':'◎','Hunt Mark':'🎯','Boss Mark':'⚠','Suppression Mark':'⌛'};
    return map[s]||'•';
  }



  function unitRef(unitId){
    if(!battle||!unitId)return null;
    const pIndex=battle.state.team.findIndex(u=>u?.id===unitId);
    if(pIndex>=0)return {unit:battle.state.team[pIndex],side:'player',slot:pIndex};
    const eIndex=battle.state.enemies.findIndex(u=>u?.id===unitId);
    if(eIndex>=0)return {unit:battle.state.enemies[eIndex],side:'enemy',slot:eIndex};
    const rIndex=battle.state.reserves.findIndex(u=>u?.id===unitId);
    if(rIndex>=0)return {unit:battle.state.reserves[rIndex],side:'reserve',slot:rIndex};
    return null;
  }


  function localUnitByPow(side,powId){
    if(!battle||!powId)return null;
    const arr=side==='enemy'?[...battle.state.enemies,...battle.state.enemyReserves]:[...battle.state.team,...battle.state.reserves];
    return arr.find(u=>String(u?.powId)===String(powId))||null;
  }

  function serverVisualEvents(state,lastId=0){
    const out=[];const SCV=SC();const rows=SCV?.eventsSince?.(state,lastId)||[];
    for(const row of rows){
      if(row.type!=='skill')continue;
      const p=row.payload||{},actor=localUnitByPow(row.actorSide,row.actorPowId),target=localUnitByPow(row.actorSide==='enemy'?'player':'enemy',row.targetPowId)||localUnitByPow(row.actorSide,row.targetPowId);
      const key=p.skill==='s1'?'skill1':p.skill==='s2'?'skill2':p.skill==='ult'?'ultimate':'basic';
      if(actor)actor.lastAction={key,name:p.skillName||key};
      if(actor&&target)out.push({type:'action',sourceId:actor.id,key,ability:p.skillName||key,targetIds:[target.id],result:{damage:Number(p.damage)||0,heal:Number(p.heal)||0}});
      if(actor&&target&&(Number(p.damage)>0||Number(p.absorbed)>0))out.push({type:'damage',sourceId:actor.id,impacts:[{targetId:target.id,damage:Math.max(0,Number(p.damage)||0),absorbed:Math.max(0,Number(p.absorbed)||0),crit:!!p.crit,killed:!!target.defeated}]});
      if(actor&&target&&Number(p.heal)>0)out.push({type:'heal',sourceId:actor.id,targetIds:[target.id],amount:Number(p.heal),impacts:[{targetId:target.id,amount:Number(p.heal)}]});
      const rawStatus=String(p.status||''),status=rawStatus==='Paralysis'?'Stun':rawStatus==='Magma Burn'?'Burn':rawStatus;
      if(target&&status&&status!=='Shield'&&target.statuses?.[status])out.push({type:'status-apply',sourceId:actor?.id||null,targetId:target.id,status,refresh:false});
      if(target&&status==='Shield'&&Number(target.shield)>0)out.push({type:'shield',sourceId:actor?.id||null,targetId:target.id,amount:Number(target.shield)||0,serverVerified:true});
      if(target?.defeated)out.push({type:'kill',sourceId:actor?.id||null,targetId:target.id});
    }
    if(state?.status&&state.status!=='active')out.push({type:'battle-end',result:state.status==='win'?'win':'loss',serverVerified:true});
    return out;
  }

  function slotPos(side,slot){
    const map={player:[['29%','69%'],['50%','67%'],['71%','69%']],enemy:[['29%','24%'],['50%','22%'],['71%','24%']]};
    const arr=map[side]||map.player; return arr[Number(slot)||0] || ['50%','50%'];
  }

  function addBanner(text, tone='info', ttl=1320){
    const id=`banner-${++fxSerial}`;
    ui.banner={id,text,tone,startedAt:effectNow()};
    scheduleUiExpiry(ttl,()=>ui.banner?.id===id,()=>{ui.banner=null;return true;});
  }

  function addPulse(unitId, kind='damage', ttl=680){
    if(!unitId)return;
    const entry={id:`pulse-${++fxSerial}`,kind,startedAt:effectNow()};
    ui.unitPulse[unitId]=entry;
    scheduleUiExpiry(ttl,()=>ui.unitPulse[unitId]?.id===entry.id,()=>{delete ui.unitPulse[unitId];return true;});
  }

  function addFx(entry, ttl=1520){
    const decorative=new Set(['impact','impact-aoe','element-hit']);
    if(framePacing.tier==='low' && decorative.has(String(entry?.kind||'')))return null;
    const id=`fx-${++fxSerial}`;
    ui.fx.push({...entry,id,startedAt:effectNow()});
    scheduleUiExpiry(ttl,()=>ui.fx.some(x=>x.id===id),()=>{
      const idx=ui.fx.findIndex(x=>x.id===id);
      if(idx<0)return false;ui.fx.splice(idx,1);return true;
    });
    return id;
  }

  function triggerCamera(kind='medium', ttl=620){
    const entry={id:`camera-${++fxSerial}`,kind,startedAt:effectNow()};
    ui.camera=entry;
    scheduleUiExpiry(ttl,()=>ui.camera?.id===entry.id,()=>{ui.camera=null;return true;});
  }

  function triggerHitStop(kind='light', ttl=110){
    if(framePacing.tier==='low')ttl=Math.min(70,Math.round(ttl*.55));
    else if(framePacing.tier==='medium')ttl=Math.min(125,Math.round(ttl*.82));
    const entry={id:`hitstop-${++fxSerial}`,kind,startedAt:effectNow()};
    ui.hitStop=entry;
    scheduleUiExpiry(ttl,()=>ui.hitStop?.id===entry.id,()=>{ui.hitStop=null;return true;});
  }

  // 7.0.1: restore the snappier V5.9-era motion speed. Readability now comes
  // from a static action beat AFTER the motion, not by stretching every frame.
  function telegraphPause(key){
    if(key==='ultimate') return 2100;
    if(key==='exclusive') return 1500;
    if(key==='skill2') return 1200;
    if(key==='skill1') return 1050;
    return 900;
  }

  // 7.2.2: the action label may stay visible for readability, but it must not
  // block the turn flow for its whole lifetime. `flowDelay` is intentionally
  // short; `visibleMs` is only a non-blocking UI lifetime.
  function actionBeatSpec(key,events=[]){
    let visibleMs=key==='ultimate'?1700:key==='exclusive'?1450:key==='skill2'?1200:key==='skill1'?1100:1000;
    let flowDelay=key==='ultimate'?380:key==='exclusive'?320:key==='skill2'?270:key==='skill1'?230:190;
    let label=key==='ultimate'?'TỐI THƯỢNG':key==='exclusive'?'ĐỘC QUYỀN':key==='skill2'?'KỸ NĂNG MẠNH':key==='skill1'?'KỸ NĂNG':'ĐÒN ĐÁNH';
    let tone=key==='ultimate'?'ultimate':key==='exclusive'?'exclusive':'action';
    const has=t=>events.some(e=>e?.type===t);
    const crit=events.some(e=>e?.type==='damage'&&(e.impacts||[]).some(i=>i?.crit));
    if(has('heal')){visibleMs=Math.max(visibleMs,1100);flowDelay=Math.max(flowDelay,230);label='HỒI PHỤC';tone='heal';}
    if(has('cleanse')){visibleMs=Math.max(visibleMs,1150);flowDelay=Math.max(flowDelay,250);label='THANH TẨY';tone='cleanse';}
    if(has('guard')){visibleMs=Math.max(visibleMs,1400);flowDelay=Math.max(flowDelay,300);label='BẢO HỘ';tone='guard';}
    if(crit){visibleMs=Math.max(visibleMs,1400);flowDelay=Math.max(flowDelay,320);label='BẠO KÍCH';tone='crit';}
    if(has('break')){visibleMs=Math.max(visibleMs,1500);flowDelay=Math.max(flowDelay,340);label='PHÁ KHIÊN';tone='break';}
    if(has('kill')){visibleMs=Math.max(visibleMs,1800);flowDelay=Math.max(flowDelay,460);label='HẠ GỤC';tone='kill';}
    if(has('boss-phase')){visibleMs=2000;flowDelay=Math.max(flowDelay,560);label='BOSS CHUYỂN PHA';tone='boss';}
    if(has('boss-mechanic-arm')){visibleMs=1850;flowDelay=Math.max(flowDelay,360);label='BOSS BÁO TRƯỚC CƠ CHẾ';tone='boss';}
    if(has('boss-mechanic-outcome')){visibleMs=1700;flowDelay=Math.max(flowDelay,340);label='PHẢN ỨNG BOSS';tone='boss';}
    if(has('tamer-expansion')){visibleMs=1800;flowDelay=Math.max(flowDelay,480);label='BÀNH TRƯỚNG LÃNH ĐỊA';tone='domain';}
    if(has('tamer-simple')){visibleMs=Math.max(visibleMs,1200);flowDelay=Math.max(flowDelay,260);label='TAMER COMMAND';tone='tamer';}
    if(has('frostmaw-form')){visibleMs=Math.max(visibleMs,1650);flowDelay=Math.max(flowDelay,470);label='CÔN BẰNG CHUYỂN DẠNG';tone='kunpeng';}
    if(has('battle-end')){visibleMs=Math.max(visibleMs,1800);flowDelay=Math.max(flowDelay,520);label='KẾT THÚC TRẬN';tone='result';}
    return {visibleMs:clamp(visibleMs,900,2000),flowDelay:clamp(flowDelay,160,620),label,tone};
  }

  async function holdActionBeat(key,events=[]){
    if(!mount)return;
    const spec=actionBeatSpec(key,events);
    const field=mount.querySelector('.cv7-field');
    const prior=field?.querySelector(':scope > .cv101-action-beat');
    prior?.remove();
    if(field){
      const beat=document.createElement('div');
      const beatId=`beat-${++fxSerial}`;
      beat.dataset.beatId=beatId;
      beat.className=`cv101-action-beat tone-${spec.tone}`;
      beat.innerHTML=`<small>NHỊP CHIẾN ĐẤU</small><b>${esc(spec.label)}</b>`;
      field.appendChild(beat);
      setTimeout(()=>{
        const current=field.querySelector(`:scope > .cv101-action-beat[data-beat-id="${beatId}"]`);
        current?.remove();
      },spec.visibleMs);
    }
    // Do not pause Pow/VFX/background loops here. Only a small pacing gap is awaited.
    await sleep(spec.flowDelay);
  }


  function clearAttackPresentation(sourceId=null){
    if(sourceId)cancelCompositorAnimation(`attack:${sourceId}`);
    if(!sourceId || ui.attackMotion?.sourceId===sourceId) ui.attackMotion=null;
    if(!sourceId || ui.attackCallout?.sourceId===sourceId || ui.attackCallout?.unitId===sourceId) ui.attackCallout=null;
    if(!sourceId || ui.cinematic?.sourceId===sourceId) ui.cinematic=null;
    if(!sourceId || ui.bossWarning?.bossId===sourceId) ui.bossWarning=null;
    endCameraDirector(sourceId);
  }

  async function preCastTelegraph(unit,key,ability,requestedTargetId,decision=null){
    if(!unit)return {impactDelay:0,settleDelay:0,canceled:true};
    const ref=unitRef(unit.id); if(!ref)return {impactDelay:0,settleDelay:0,canceled:true};
    const info=battle?.actionInfo?.(unit,key)||{};
    const legal=battle?.legalTargets?.(unit,ability,key)||[];
    let targetIds=[];
    if(info.area || ability?.target==='team' || ability?.target==='allies') targetIds=legal.map(x=>x.id);
    else if(ability?.target==='self') targetIds=[unit.id];
    else targetIds=[requestedTargetId||legal[0]?.id].filter(Boolean);
    const targetRefs=targetIds.map(unitRef).filter(Boolean);
    const elCls=fxElementClass(unit.element);
    const style=choreographyStyle(unit,ability,key);
    const profile=roleAnimationProfile(unit,ability,key);
    const signature=signatureProfile(unit,key);
    beginCameraDirector(unit,key,ability,info,ref,targetRefs);
    let total=telegraphPause(key);
    if(unit.boss) total += key==='ultimate'?1050:key==='exclusive'?850:key==='skill2'?650:key==='skill1'?520:360;
    const charge=Math.round(total*(key==='ultimate'?0.64:key==='exclusive'?0.61:0.58));
    const release=Math.max(420,total-charge);
    const impactDelay=Math.round(release*0.54);
    // 7.0.1: motion settles quickly; the readable 1–2s pause is static and happens after motion.
    const settleDelay=Math.max(160,release-impactDelay);
    ui.attackCallout={sourceId:unit.id,side:ref.side,slot:ref.slot,name:unit.name,role:unit.roleLabel,roleKey:profile.role,roleFxLabel:profile.label,roleFxIcon:profile.icon,identity:profile.identity,ability:ability?.name||'Kỹ năng',asset:unit.asset,element:elCls,key,style,signature};
    ui.attackMotion={sourceId:unit.id,side:ref.side,slot:ref.slot,key,style,role:profile.role,identity:profile.identity,element:elCls,phase:'charge',targetIds,targetRefs:targetRefs.map(x=>({side:x.side,slot:x.slot,id:x.unit.id})),charge,release,impactDelay,settleDelay,signature,startedAt:effectNow(),releaseStartedAt:0};
    if(unit.boss){
      ui.bossWarning={id:`boss-warning-${++fxSerial}`,bossId:unit.id,name:unit.name,ability:ability?.name||'Kỹ năng',key,danger:bossDangerLabel(key),asset:unit.asset,element:elCls,phase:Number(unit.bossPhase||1),duration:total,pattern:decision?.aiIntent||'',patternHint:decision?.aiHint||'',confidence:Number(decision?.aiConfidence)||0,startedAt:effectNow()};
      CombatAudio?.bossThreat?.(unit,key,ability);
    }
    if(key==='ultimate') ui.cinematic={sourceId:unit.id,key,style,role:profile.role,identity:profile.identity,element:elCls,asset:unit.asset,name:unit.name,ability:ability?.name||'Tối thượng',side:ref.side,phase:'charge',signature,startedAt:effectNow(),releaseStartedAt:0};
    else if(key==='exclusive') ui.cinematic={sourceId:unit.id,key,style,role:profile.role,identity:profile.identity,element:elCls,asset:unit.asset,name:unit.name,ability:ability?.name||'Độc quyền',side:ref.side,phase:'charge',signature,startedAt:effectNow(),releaseStartedAt:0};
    addPulse(unit.id,key==='ultimate'?'ult':key==='exclusive'?'cast-ex':'cast',total+520);
    addFx({side:ref.side,slot:ref.slot,kind:'cast',text:ability?.name||'KỸ NĂNG',element:elCls,key},total+680);
    CombatAudio?.telegraph?.(unit,key,ability,profile);
    // 6.7.1: keep the battlefield physically stable during attacks.
    // Cinematic overlays still communicate Ultimate/Exclusive without moving the entire HUD.
    render();
    await sleep(charge);
    if(!ui.attackMotion || ui.attackMotion.sourceId!==unit.id)return {impactDelay:0,settleDelay:0,canceled:true};
    ui.attackMotion.phase='release';
    ui.attackMotion.releaseStartedAt=effectNow();
    setCameraDirectorPhase('release');
    if(ui.cinematic){ui.cinematic.phase='release';ui.cinematic.releaseStartedAt=effectNow();}
    CombatAudio?.release?.(unit,key,ability,profile);
    patchAttackPresentationDom();
    return {impactDelay,settleDelay,total,charge,release,canceled:false};
  }

  function consumeEvents(events=[],deferRender=false){
    if(!events?.length) return;
    ui.lastEvents=events;
    let changed=false;
    const suppressedBaseApply=new Set();
    for(const e of events){
      if(e.type==='status-apply' && e.kind==='custom' && STATUS_BASE_FOR_CUSTOM[e.status])suppressedBaseApply.add(`${e.targetId}|${STATUS_BASE_FOR_CUSTOM[e.status]}`);
    }
    for(const evt of events){
      recordBattleEvent(evt);
      CombatAudio?.playEvent?.(evt,{unitRef,statusMeta});
      if(evt.type==='battle-start'){ addBanner('BẮT ĐẦU CHIẾN ĐẤU','start',900); changed=true; }
      if(evt.type==='boss-phase'){
        const ref=unitRef(evt.bossId); const b=ref?.unit;
        addBanner(`BOSS CHUYỂN PHA ${evt.phase}`,'boss',1850);
        if(b){
          const entry={id:`boss-phase-${++fxSerial}`,bossId:b.id,name:b.name,asset:b.asset,element:fxElementClass(b.element),phase:Number(evt.phase||b.bossPhase||1),phaseName:evt.phaseName||'',max:bossMaxPhases(b.bossType||battle?.state?.bossType),startedAt:effectNow()};
          ui.bossPhaseCinematic=entry; addPulse(b.id,'boss-phase',1850); triggerCamera('boss-phase',1850);
          setTimeout(()=>{if(ui.bossPhaseCinematic?.id===entry.id){ui.bossPhaseCinematic=null;scheduleRender();}},1950);
        }
        changed=true;
      }
      if(evt.type==='boss-mechanic-arm'){
        const b=unitRef(evt.bossId)?.unit;const ids=(evt.targetIds||[]).filter(Boolean);
        ui.bossMechanicNotice={id:`boss-mech-${++fxSerial}`,bossId:evt.bossId,name:evt.name||'Boss Mechanic',mode:'arm',response:evt.responseLabel||evt.response||'PHẢN ỨNG',detail:evt.detail||'',targetIds:ids,startedAt:effectNow()};
        const noticeId=ui.bossMechanicNotice.id;addBanner(`⚠ ${evt.name} · ${evt.responseLabel||evt.response||'PHẢN ỨNG'}`,'boss',1750);if(b)addPulse(b.id,'boss-phase',1050);for(const id of ids)addPulse(id,'status-control',1050);triggerCamera('boss-threat',1150);
        setTimeout(()=>{if(ui.bossMechanicNotice?.id===noticeId){ui.bossMechanicNotice=null;scheduleRender();}},1900);changed=true;
      }
      if(evt.type==='boss-mechanic-progress'){
        const b=unitRef(evt.bossId)?.unit;if(b)addPulse(b.id,'shield-gain',620);changed=true;
      }
      if(evt.type==='boss-mechanic-outcome'){
        const good=evt.outcome==='interrupted'||evt.outcome==='cleansed';const b=unitRef(evt.bossId)?.unit;
        ui.bossMechanicNotice={id:`boss-mech-out-${++fxSerial}`,bossId:evt.bossId,name:evt.name||'Boss Mechanic',mode:good?'success':'fail',response:good?(evt.outcome==='cleansed'?'ĐÃ THANH TẨY':'ĐÃ NGẮT'):'BOSS KÍCH HOẠT',detail:evt.detail||'',targetIds:(evt.targetIds||[]).filter(Boolean),startedAt:effectNow()};
        addBanner(`${good?'✓':'⚠'} ${evt.name} · ${good?(evt.outcome==='cleansed'?'THANH TẨY':'NGẮT THÀNH CÔNG'):'KÍCH HOẠT'}`,good?'cleanse':'boss',1650);if(b)addPulse(b.id,good?'status-fade':'boss-phase',950);triggerHitStop(good?'light':'medium',good?75:115);const noticeId=ui.bossMechanicNotice.id;setTimeout(()=>{if(ui.bossMechanicNotice?.id===noticeId){ui.bossMechanicNotice=null;scheduleRender();}},1800);changed=true;
      }
      if(evt.type==='boss-enrage'){
        const b=unitRef(evt.bossId)?.unit;addBanner('BOSS · CUỒNG NỘ CUỐI CÙNG','boss',1900);if(b)addPulse(b.id,'boss-phase',1900);triggerCamera('boss-phase',1900);changed=true;
      }
      if(evt.type==='action'){
        const src=unitRef(evt.sourceId);
        const elCls=fxElementClass(src?.unit?.element);
        const targetIds=(evt.targetIds||[]).filter(Boolean);
        const aoe=targetIds.length>1;
        targetIds.forEach((id,idx)=>{
          const trg=unitRef(id); if(!trg) return;
          addFx({side:trg.side,slot:trg.slot,kind:aoe?'impact-aoe':'impact',element:elCls,key:evt.key,offset:idx}, evt.key==='ultimate'?1480:1180);
          changed=true;
        });
        if(evt.key==='ultimate' && evt.ability){ addBanner(evt.ability, 'ultimate', 1880); changed=true; }
        if(evt.key==='exclusive' && evt.ability){ addBanner(evt.ability, 'exclusive', 1540); changed=true; }
      }
      if(evt.type==='status-apply'){
        if(suppressedBaseApply.has(`${evt.targetId}|${evt.status}`))continue;
        const ref=unitRef(evt.targetId), meta=statusMeta(evt.status);
        if(ref){
          if(!evt.refresh)addFx({side:ref.side,slot:ref.slot,kind:'status-apply',text:`${meta.icon} ${meta.label}`,statusClass:meta.cls,statusTone:meta.tone},1450);
          else addFx({side:ref.side,slot:ref.slot,kind:'status-refresh',text:`${meta.icon}`,statusClass:meta.cls,statusTone:meta.tone},800);
          addPulse(evt.targetId,evt.refresh?'status-refresh':'status-new',evt.refresh?520:760);
          changed=true;
        }
      }
      if(evt.type==='status-expire'){
        const ref=unitRef(evt.targetId), meta=statusMeta(evt.status);
        if(ref){
          addFx({side:ref.side,slot:ref.slot,kind:'status-expire',text:`${meta.label} · HẾT`,statusClass:meta.cls,statusTone:meta.tone},1050);
          addPulse(evt.targetId,'status-fade',620);
          changed=true;
        }
      }
      if(evt.type==='status-tick'){
        const ref=unitRef(evt.unitId), e=evt.event||{}, meta=statusMeta(e.status||'');
        if(ref){
          if(e.type==='dot'){
            addFx({side:ref.side,slot:ref.slot,kind:'status-dot',text:`${meta.icon} -${Number(e.amount||0).toLocaleString('vi-VN')}`,statusClass:meta.cls,statusTone:'debuff'},1350);
            addPulse(evt.unitId,'status-dot',680);
            if(ref.unit?.defeated){addFx({side:ref.side,slot:ref.slot,kind:'kill',text:`HẠ GỤC · ${meta.label}`},1450);addPulse(evt.unitId,'death',880);}
          }else if(e.type==='heal'){
            addFx({side:ref.side,slot:ref.slot,kind:'status-heal',text:`${meta.icon} +${Number(e.amount||0).toLocaleString('vi-VN')}`,statusClass:meta.cls,statusTone:'buff'},1300);
            addPulse(evt.unitId,'heal',620);
          }else if(e.type==='skip'){
            addFx({side:ref.side,slot:ref.slot,kind:'status-control',text:`${meta.icon} ${meta.label} · MẤT LƯỢT`,statusClass:meta.cls,statusTone:'debuff'},1650);
            addPulse(evt.unitId,'status-control',980);
            triggerHitStop('medium',115);
          }
          changed=true;
        }
      }
      if(evt.type==='tamer-simple'){
        addBanner(`GIẢN DỊ LÃNH ĐỊA · ${evt.name}`,evt.kind==='assault'?'domain-assault':'domain-guard',1280);
        const cur=unitRef(evt.actorId); if(cur)addPulse(evt.actorId,evt.kind==='assault'?'domain-power':'domain-defense',920);
        changed=true;
      }
      if(evt.type==='tamer-expansion'){
        ui.domainVisualStartedAt=effectNow();
        ui.domainCinematic={id:evt.id,name:evt.name,short:evt.short,remainingRounds:evt.remainingRounds,startedAt:effectNow()};
        addBanner(`BÀNH TRƯỚNG LÃNH ĐỊA · ${evt.name}`,'domain-expansion',2300);
        triggerCamera('strong',1800);
        setTimeout(()=>{ if(ui.domainCinematic?.id===evt.id){ui.domainCinematic=null;scheduleRender();} },2200);
        changed=true;
      }
      if(evt.type==='tamer-domain-tick'){
        addFx({side:'center',slot:1,kind:'domain-tick',text:`${evt.remainingRounds} HIỆP`},1050);
        changed=true;
      }
      if(evt.type==='tamer-domain-end'){
        addBanner(`${evt.name} · TAN BIẾN`,'domain-end',1650); ui.domainCinematic=null; ui.domainVisualStartedAt=0; changed=true;
      }
      if(evt.type==='frostmaw-form'){
        const ref=unitRef(evt.sourceId);
        if(ref){
          const entry={id:`kunpeng-form-${++fxSerial}`,sourceId:evt.sourceId,from:evt.from,to:evt.to,fromAsset:evt.fromAsset,toAsset:evt.toAsset,label:evt.label,reason:evt.reason,side:ref.side,startedAt:effectNow()};
          ui.formCinematic=entry;
          addBanner(evt.to==='kun'?'BẮC MINH CHUYỂN ẤN · HÓA CÔN':'BẮC MINH HÓA BẰNG · PHÁ KHÔNG',evt.to==='kun'?'kun-form':'peng-form',1550);
          addPulse(evt.sourceId,evt.to==='kun'?'frost-transform-kun':'frost-transform-peng',1350);
          triggerCamera('strong',1450);
          setTimeout(()=>{if(ui.formCinematic?.id===entry.id){ui.formCinematic=null;scheduleRender();}},1550);
          changed=true;
        }
      }
      if(evt.type==='replacement'){
        const ref=unitRef(evt.unitId);
        if(ref){ addFx({side:ref.side==='reserve'?'player':ref.side,slot:ref.slot,kind:'replace',text:'VÀO SÂN'},1100); addPulse(evt.unitId,'replace',650); changed=true; }
      }
      if(evt.type==='guard'){
        if(ui.cameraDirector)setCameraDirectorPhase('guard',{guardId:evt.guardId,protectedId:evt.protectedId});
        const ref=unitRef(evt.guardId);
        const prot=unitRef(evt.protectedId);
        if(ref){
          addFx({side:ref.side,slot:ref.slot,kind:'guard',text:'BẢO HỘ'},1120);
          addPulse(evt.guardId,'guard-dash',980);
          if(prot){ addPulse(evt.protectedId,'guarded',820); const guardEntry={id:`guard-link-${++fxSerial}`,startedAt:effectNow(),from:{side:prot.side,slot:prot.slot},to:{side:ref.side,slot:ref.slot}}; ui.guardLink=guardEntry; setTimeout(()=>{ if(ui.guardLink?.id===guardEntry.id){ui.guardLink=null;scheduleRender();} }, 820); }
          changed=true;
        }
      }
      if(evt.type==='heal'){
        const ids=(evt.targetIds||[]).filter(Boolean);
        const exact=new Map((evt.impacts||[]).map(x=>[String(x.targetId||''),Math.max(0,Math.round(Number(x.amount??x.heal)||0))]));
        const fallback=ids.length?Math.max(0,Math.round((Number(evt.amount)||0)/ids.length)):0;
        for(const id of ids){
          const ref=unitRef(id); if(!ref) continue;
          const amount=exact.has(String(id))?exact.get(String(id)):fallback;
          if(amount>0)addFx({side:ref.side,slot:ref.slot,kind:'heal',text:`+${amount.toLocaleString('vi-VN')}`,sourceId:evt.sourceId,targetId:id},1200);
          addPulse(id,'heal',560); changed=true;
        }
      }
      if(evt.type==='shield'){
        const ref=unitRef(evt.targetId); const amount=Math.max(0,Math.round(Number(evt.amount)||0));
        if(ref&&amount>0){
          addFx({side:ref.side,slot:ref.slot,kind:'shield-gain',text:`⬡ +${amount.toLocaleString('vi-VN')}`,sourceId:evt.sourceId,targetId:evt.targetId},1280);
          addPulse(evt.targetId,'shield-gain',620); changed=true;
        }
      }
      if(evt.type==='damage'){
        const src=unitRef(evt.sourceId);
        const key=src?.unit?.lastAction?.key || 'basic';
        let strongest=key==='ultimate'?'strong':key==='exclusive'||key==='skill2'?'medium':'light';
        const sourceElement=fxElementClass(src?.unit?.element);
        (evt.impacts||[]).forEach((impact,idx)=>{
          const ref=unitRef(impact.targetId); if(!ref) return;
          const absorbed=Math.max(0,Math.round(Number(impact.absorbed)||0));
          const damage=Math.max(0,Math.round(Number(impact.damage)||0));
          if(impact.evaded){
            addFx({side:ref.side,slot:ref.slot,kind:'evade',text:'NÉ',offset:idx,key,element:sourceElement},1050);
            addPulse(impact.targetId,'evade',520); changed=true; return;
          }
          if(absorbed>0){ addFx({side:ref.side,slot:ref.slot,kind:'shield',text:`⬡ -${absorbed.toLocaleString('vi-VN')}`,offset:idx,key,element:sourceElement},1320); changed=true; }
          if(damage>0){
            const text=impact.crit?`BẠO KÍCH · -${damage.toLocaleString('vi-VN')}`:`-${damage.toLocaleString('vi-VN')}`;
            addFx({side:ref.side,slot:ref.slot,kind:impact.crit?'crit':'damage',text,crit:Boolean(impact.crit),offset:idx,key,element:sourceElement,sourceId:evt.sourceId,targetId:impact.targetId},impact.crit?1780:key==='ultimate'?1680:key==='exclusive'?1580:key==='skill2'?1500:1420);
          }else if(absorbed>0){
            addFx({side:ref.side,slot:ref.slot,kind:'blocked',text:'CHẶN ĐÒN',offset:idx,key,element:sourceElement},980);
          }
          if(idx===0 && damage>0 && ['skill2','exclusive','ultimate'].includes(key))addFx({side:ref.side,slot:ref.slot,kind:'element-hit',text:elementImpactIcon(src?.unit?.element),element:sourceElement,key},820);
          const reaction=impact.killed?'death-hit':impact.crit?'hit-crit':`hit-${key}`;
          if(damage>0||absorbed>0)addPulse(impact.targetId,reaction,impact.killed?620:impact.crit?980:key==='ultimate'?980:key==='exclusive'?900:key==='skill2'?840:key==='skill1'?760:680);
          if(impact.crit) strongest='strong';
          changed=true;
        });
        const impacts=evt.impacts||[];
        const hasCrit=impacts.some(x=>x.crit), hasKill=impacts.some(x=>x.killed);
        if(ui.cameraDirector && (!evt.sourceId || ui.cameraDirector.sourceId===evt.sourceId))setCameraDirectorPhase('impact',{impactKind:hasKill?'kill':hasCrit?'crit':'hit'});
        const stopMs=strongest==='strong'?(key==='ultimate'?205:185):strongest==='medium'?(key==='exclusive'?155:140):key==='skill1'?112:96;
        triggerHitStop(strongest,stopMs);
      }
      if(evt.type==='cleanse'){
        const ref=unitRef(evt.targetId), meta=statusMeta(evt.status||''); if(ref){ addFx({side:ref.side,slot:ref.slot,kind:'cleanse',text:`THANH TẨY${evt.status?` · ${meta.label}`:''}`,statusClass:meta.cls,statusTone:'buff'},1250); addPulse(evt.targetId,'status-cleanse',720); changed=true; }
      }
      if(evt.type==='break'){
        const ref=unitRef(evt.targetId);
        if(ref){ addFx({side:ref.side,slot:ref.slot,kind:'break',text:'PHÁ KHIÊN'},1250); addPulse(evt.targetId,'break',680); changed=true; }
      }
      if(evt.type==='kill'){
        if(ui.cameraDirector)setCameraDirectorPhase('kill',{killTargetId:evt.targetId});
        const ref=unitRef(evt.targetId);
        if(ref){
          addFx({side:ref.side,slot:ref.slot,kind:'kill',text:ref.unit?.boss?'BOSS BỊ HẠ':'HẠ GỤC'},ref.unit?.boss?1750:1450);
          addPulse(evt.targetId,'death',ref.unit?.boss?980:760);
          playDeathCompositorMotion(evt.targetId,Boolean(ref.unit?.boss));
          if(ref.unit?.boss){
            const entry={id:`boss-defeat-${++fxSerial}`,name:ref.unit.name,asset:ref.unit.asset,element:fxElementClass(ref.unit.element),startedAt:effectNow()};ui.bossDefeat=entry;
            setTimeout(()=>{if(ui.bossDefeat?.id===entry.id){ui.bossDefeat=null;scheduleRender();}},1900);
          }
          changed=true;
        }
      }
      if(evt.type==='battle-end'){ addBanner(evt.result==='win'?'CHIẾN THẮNG!':'THẤT BẠI',evt.result==='win'?'win':'loss',1900); changed=true; }
    }
    if(changed && !deferRender)render();
  }

  function syncPulseOnUnit(el,u){
    if(!el||!u)return;
    const entry=ui.unitPulse?.[u.id]||null;
    const nextId=entry&&typeof entry==='object'?entry.id:'';
    const nextKind=typeof entry==='string'?entry:(entry?.kind||'');
    const prevId=el.dataset.cv7PulseId||'';
    if(prevId!==nextId){
      [...el.classList].filter(c=>c.startsWith('pulse-')).forEach(c=>el.classList.remove(c));
      if(nextKind)el.classList.add(`pulse-${nextKind}`);
      el.dataset.cv7PulseId=nextId;
      if(nextId&&String(nextKind).startsWith('hit-'))playHitCompositorMotion(el,u,nextKind,nextId);
      else if(nextId)playFeedbackCompositor(el,u,nextKind,nextId);
    }
    if(entry&&typeof entry==='object')el.style.setProperty('--pulse-age',`${-effectAge(entry)}ms`);
    else el.style.removeProperty('--pulse-age');
  }

  function patchUnitVitals(el,u){
    if(!el||!u)return;
    syncPulseOnUnit(el,u);
    const hp=Math.max(0,Math.round(Number(u.hp)||0)),maxHp=Math.max(1,Math.round(Number(u.maxHp)||1));
    const mana=Math.max(0,Math.round(Number(u.mana)||0)),maxMana=Math.max(1,Math.round(Number(u.maxMana)||1));
    const rage=clamp(Math.round(Number(u.rage)||0),0,100),shield=Math.max(0,Math.round(Number(u.shield)||0));
    const sig=`${hp}|${maxHp}|${mana}|${maxMana}|${rage}|${shield}`;
    if(el.dataset.cv1860Vitals===sig){rendererV2.vitalSkips++;return;}
    el.dataset.cv1860Vitals=sig;rendererV2.vitalWrites++;
    const bars=el.querySelectorAll('.cv7-bars i span');
    if(bars[0])bars[0].style.width=`${clamp(Math.round(hp/maxHp*100),0,100)}%`;
    if(bars[1])bars[1].style.width=`${clamp(Math.round(mana/maxMana*100),0,100)}%`;
    if(bars[2])bars[2].style.width=`${rage}%`;
    const shieldBar=el.querySelector('.cv824-shield-bar'); if(shieldBar)shieldBar.style.width=`${clamp(Math.round(shield/maxHp*100),0,100)}%`;
    const info=el.querySelector('.cv7-unit-info'); info?.classList.toggle('has-virtual-shield',shield>0);
    const vals=el.querySelectorAll('.cv7-values span');
    if(vals[0])vals[0].innerHTML=`${hp.toLocaleString('vi-VN')}/${maxHp.toLocaleString('vi-VN')}${shield>0?` · <b class="cv824-shield-value">⬡ +${shield.toLocaleString('vi-VN')}</b>`:''}`;
    if(vals[1])vals[1].textContent=`🔹 ${mana}/${maxMana}`;
    if(vals[2])vals[2].textContent=`⚡ ${rage}`;
  }

  function ensureFxLayer(field){
    let layer=field?.querySelector(':scope > .cv7-fx-layer');
    if(layer)return layer;
    layer=document.createElement('div');layer.className='cv7-fx-layer';field?.appendChild(layer);rendererV2.fxNodesCreated++;return layer;
  }

  function patchFxLayer(){
    const field=mount?.querySelector('.cv7-field'); if(!field)return;
    const active=Boolean((ui.fx||[]).length||ui.banner||ui.guardLink||ui.hitStop);
    let layer=field.querySelector(':scope > .cv7-fx-layer');
    if(!active){if(layer)layer.replaceChildren();return;}
    layer=ensureFxLayer(field);
    const wanted=new Set((ui.fx||[]).map(f=>String(f.id)));
    for(const n of [...layer.querySelectorAll('[data-fx-id]')])if(!wanted.has(String(n.dataset.fxId||'')))n.remove();
    for(const f of (ui.fx||[])){
      let n=layer.querySelector(`[data-fx-id="${CSS.escape(String(f.id))}"]`);
      if(!n){n=nodeFromMarkup(fxItemMarkup(f));if(n){layer.appendChild(n);rendererV2.fxNodesCreated++;}}
      else rendererV2.fxNodesReused++;
      if(n)n.style.setProperty('--fx-age',`${-effectAge(f)}ms`);
    }
    let flash=layer.querySelector(':scope > .cv7-hitstop-flash');
    if(ui.hitStop){
      if(!flash){flash=document.createElement('div');layer.prepend(flash);rendererV2.fxNodesCreated++;}
      flash.className=`cv7-hitstop-flash ${String(ui.hitStop.kind||'light').replace(/[^a-z0-9_-]/gi,'')}`;flash.style.setProperty('--hit-age',`${-effectAge(ui.hitStop)}ms`);
    }else flash?.remove();
    let guard=layer.querySelector(':scope > .cv7-guard-link');
    if(ui.guardLink){
      const [x1,y1]=slotPos(ui.guardLink.from.side,ui.guardLink.from.slot),[x2,y2]=slotPos(ui.guardLink.to.side,ui.guardLink.to.slot);
      const dx=parseFloat(x2)-parseFloat(x1),dy=parseFloat(y2)-parseFloat(y1),angle=Math.atan2(dy,dx)*180/Math.PI,length=Math.max(64,Math.hypot(dx*12,dy*8));
      if(!guard){guard=document.createElement('div');guard.className='cv7-guard-link';guard.innerHTML='<div class="cv7-guard-beam"></div><div class="cv7-guard-shield from"></div><div class="cv7-guard-shield to"></div>';layer.appendChild(guard);rendererV2.fxNodesCreated++;}
      guard.style.cssText=`--x1:${x1};--y1:${y1};--x2:${x2};--y2:${y2};--guard-age:-${effectAge(ui.guardLink)}ms`;
      const beam=guard.querySelector('.cv7-guard-beam');if(beam){beam.style.width=`${length}px`;beam.style.transform=`translateY(-50%) rotate(${angle}deg)`;}
    }else guard?.remove();
    let banner=layer.querySelector(':scope > .cv7-banner');
    if(ui.banner){
      if(!banner){banner=document.createElement('div');layer.appendChild(banner);rendererV2.fxNodesCreated++;}
      banner.className=`cv7-banner ${String(ui.banner.tone||'info').replace(/[^a-z0-9_-]/gi,'')}`;banner.textContent=String(ui.banner.text||'');banner.style.setProperty('--banner-age',`${-effectAge(ui.banner)}ms`);
    }else banner?.remove();
  }

  function patchBossVitals(){
    const b=battle?.state?.mode==='boss'?battle.state.enemies?.[0]:null;
    const bar=mount?.querySelector('.cv7-bossbar-v2'); if(!b||!bar)return;
    const hpFill=bar.querySelector('.cv7-boss-hp > i > b');
    if(hpFill)hpFill.style.width=`${clamp(Math.round(b.hp/Math.max(1,b.maxHp)*100),0,100)}%`;
    const bossShield=bar.querySelector('.cv824-boss-shield'); if(bossShield)bossShield.style.width=`${clamp(Math.round((Number(b.shield)||0)/Math.max(1,b.maxHp)*100),0,100)}%`;
    const hpText=bar.querySelector('.cv7-boss-hp > strong');
    if(hpText)hpText.textContent=`${Math.max(0,Math.round(b.hp)).toLocaleString('vi-VN')} / ${Math.round(b.maxHp).toLocaleString('vi-VN')}`;
    const hpPctText=bar.querySelector('.cv77-boss-hp-meta > strong');
    if(hpPctText)hpPctText.textContent=`${clamp(Math.round(b.hp/Math.max(1,b.maxHp)*100),0,100)}%`;
    const rageFill=bar.querySelector('.cv7-boss-sub > span:first-child i b'); if(rageFill)rageFill.style.width=`${clamp(Number(b.rage)||0,0,100)}%`;
    const rageText=bar.querySelector('.cv7-boss-sub > span:first-child em'); if(rageText)rageText.textContent=`${Math.round(clamp(Number(b.rage)||0,0,100))}%`;
    const bossStatuses=bar.querySelector('.cv78-boss-statuses .cv7-statuses');
    if(bossStatuses){const sig=unitStatusSig(b);if(bossStatuses.dataset.cv78StatusSig!==sig){bossStatuses.dataset.cv78StatusSig=sig;updateMarkupInside(bossStatuses,statusChipsMarkup(b,6));}}
  }

  function syncAttackOverlay(selector,markup){
    const field=mount?.querySelector('.cv7-field'); if(!field)return;
    const old=field.querySelector(`:scope > ${selector}`);
    if(!markup){old?.remove();return;}
    if(old)return;
    const tpl=document.createElement('template');tpl.innerHTML=markup.trim();const node=tpl.content.firstElementChild;if(node)field.appendChild(node);
  }


  function patchCameraDirectorDom(){
    const field=mount?.querySelector('.cv7-field');if(!field)return;
    const d=ui.cameraDirector;
    let el=field.querySelector(':scope > .cv8-camera-director');
    if(!d){el?.remove();return;}
    if(!el){const tpl=document.createElement('template');tpl.innerHTML=cameraDirectorMarkup().trim();const node=tpl.content.firstElementChild;if(node)field.appendChild(node);return;}
    if(el.dataset.cameraId!==d.id){el.remove();const tpl=document.createElement('template');tpl.innerHTML=cameraDirectorMarkup().trim();const node=tpl.content.firstElementChild;if(node)field.appendChild(node);return;}
    [...el.classList].filter(c=>c.startsWith('phase-')||c.startsWith('impact-')).forEach(c=>el.classList.remove(c));
    el.classList.add(`phase-${d.phase||'charge'}`,`impact-${d.impactKind||'none'}`);
    el.dataset.cameraPhase=d.phase||'charge';
    el.style.setProperty('--camera-director-age',`${-effectAge(d)}ms`);
  }

  function patchAttackPresentationDom(){
    if(!mount)return;
    const field=mount.querySelector('.cv7-field'),scene=mount.querySelector('.cv7-scene'); if(!field||!scene)return;
    const m=ui.attackMotion;
    scene.classList.toggle('cv8-action-active',Boolean(m));
    if(m){
      const source=mount.querySelector(`.cv7-unit[data-cv7-unit="${CSS.escape(String(m.sourceId))}"]`);
      if(source){
        source.classList.toggle('motion-charge',m.phase==='charge');
        source.classList.toggle('motion-release',m.phase==='release');
        source.style.setProperty('--attack-step-ms',`${Number(m.release)||780}ms`);
        source.style.setProperty('--attack-hit-ms',`${Number(m.impactDelay)||420}ms`);
        const age=m.phase==='release'&&m.releaseStartedAt?Math.max(0,Math.round(effectNow()-m.releaseStartedAt)):0;
        source.style.setProperty('--attack-age',`${-age}ms`);
      }
      for(const t of (m.targetRefs||[])){
        const target=mount.querySelector(`.cv7-unit[data-cv7-unit="${CSS.escape(String(t.id))}"]`);target?.classList.add('telegraph-target');
      }
      if(m.phase==='release'){
        playAttackCompositorMotion(m);
        const age=m.releaseStartedAt?Math.max(0,Math.round(effectNow()-m.releaseStartedAt)):0;
        for(const flow of field.querySelectorAll(':scope > .cv7-attack-flow-layer .cv7-attack-flow'))flow.style.setProperty('--attack-age',`${-age}ms`);
      }
    }else{
      for(const el of mount.querySelectorAll('.cv7-unit')){
        el.classList.remove('motion-charge','motion-release','telegraph-target','signature-source');
        [...el.classList].filter(c=>c.startsWith('sig-')).forEach(c=>el.classList.remove(c));
        el.style.removeProperty('--attack-step-ms');el.style.removeProperty('--attack-hit-ms');el.style.removeProperty('--attack-age');
        const art=el.querySelector('.cv7-art');art?.removeAttribute('data-cv711-attack-token');art?.removeAttribute('data-cv711-hit-token');
      }
    }
    syncAttackOverlay('.cv7-attack-flow-layer',attackMotionMarkup());
    syncAttackOverlay('.cv7-attack-callout',attackCalloutMarkup());
    const cineMarkup=cinematicMarkup();
    let cine=field.querySelector(':scope > .cv7-cinematic');
    if(!cineMarkup)cine?.remove();
    else if(!cine){const tpl=document.createElement('template');tpl.innerHTML=cineMarkup.trim();const node=tpl.content.firstElementChild;if(node)field.appendChild(node);}
    else if(ui.cinematic){
      cine.classList.toggle('charge',ui.cinematic.phase==='charge');cine.classList.toggle('release',ui.cinematic.phase==='release');
      const age=Math.max(0,Math.round(effectNow()-Number(ui.cinematic.phase==='release'&&ui.cinematic.releaseStartedAt?ui.cinematic.releaseStartedAt:ui.cinematic.startedAt||effectNow())));
      cine.style.setProperty('--sig-cine-age',`${-age}ms`);
    }
    patchCameraDirectorDom();
  }

  function patchActionDom(){
    if(!mount||!battle)return;
    const all=[...(battle.state.team||[]),...(battle.state.enemies||[])];
    const nodes=new Map([...mount.querySelectorAll('.cv7-unit[data-cv7-unit]')].map(el=>[el.dataset.cv7Unit,el]));
    for(const u of all)patchUnitVitals(nodes.get(u.id),u);
    patchBossVitals();
    patchFxLayer();
    patchAttackPresentationDom();
    syncAttackOverlay('.cv7-boss-phase-cine',bossPhaseCinematicMarkup());
    syncAttackOverlay('.cv7-boss-defeat',bossDefeatMarkup());
    syncAttackOverlay('.cv114-form-cine',frostmawFormCinematicMarkup());
  }

  function turnForecast(limit=7){
    if(!battle||battle.state.phase==='ready')return [];
    return [...battle.living('player'),...battle.living('enemy')]
      .map(u=>({u,eta:(100-u.meter)/Math.max(1,battle.effective(u).speed),meter:clamp(Number(u.meter)||0,0,100)}))
      .sort((a,b)=>a.eta-b.eta || battle.effective(b.u).speed-battle.effective(a.u).speed)
      .slice(0,limit);
  }

  function tacticalTargetRef(){
    const id=ui.attackMotion?.targetIds?.[0] || ui.question?.targetId || null;
    return id?unitRef(id):null;
  }

  function skillState(unit,key,info){
    if(!info?.ability)return {label:'KHÔNG CÓ',cls:'missing',detail:''};
    if(info.available)return {label:'SẴN SÀNG',cls:'ready',detail:key==='exclusive'?'1 LẦN/TRẬN':''};
    if(key==='exclusive'&&unit.exclusiveUsed)return {label:'ĐÃ DÙNG',cls:'used',detail:'1 LẦN/TRẬN'};
    if(Number(info.cooldownRemaining)>0)return {label:'HỒI CHIÊU',cls:'cooldown',detail:`${Math.ceil(info.cooldownRemaining)} lượt`};
    const cost=Number(info.cost)||0;
    if(Number(unit.mana)<cost)return {label:'THIẾU MANA',cls:'mana',detail:`${Math.round(unit.mana)}/${cost}`};
    if(key==='ultimate'&&Number(unit.rage)<100)return {label:'CHƯA ĐỦ NỘ',cls:'rage',detail:`${Math.round(unit.rage)}/100`};
    if(key==='exclusive'&&Number(unit.rage)<90)return {label:'CHƯA ĐỦ NỘ',cls:'rage',detail:`${Math.round(unit.rage)}/90`};
    if(info.specialRequired){const r=info.specialResource;if(!r||Number(r.value)<Number(info.specialRequired))return {label:`THIẾU ${r?.name||'TÀI NGUYÊN'}`,cls:'special',detail:`${Number(r?.value)||0}/${info.specialRequired}`};if(info.specialReady===false)return {label:'CHƯA ĐỦ ĐIỀU KIỆN',cls:'special',detail:`${r.name} ${r.value}/${r.max}`};}
    return {label:'CHƯA SẴN SÀNG',cls:'locked',detail:''};
  }

  function tacticalHudMarkup(){
    return '';
  }


  function preBattlePowCard(u,kind,slot){
    if(!u)return '';
    const el=element(u.element); const guard=clamp((Number(u.guardChance)||0)+(Number(u.guardBonus)||0),0,100);
    const selected=ui.formationSelectedId===u.id;
    const position=kind==='active'?`XUẤT TRẬN ${slot+1}`:`DỰ BỊ ${slot+1}`;
    return `<button class="cv76-prep-pow ${kind} ${selected?'selected':''}" data-cv76-formation-unit="${esc(u.id)}" title="Nhấn hai Pow để đổi vị trí">
      <span class="cv76-prep-slot">${position}</span>
      <img src="${esc(combatAsset(u.asset))}" alt="${esc(u.name)}" decoding="async">
      <div class="cv76-prep-copy"><b>${esc(u.name)}</b><span><i style="--el:${esc(el.color)}">${esc(el.icon)}</i>${esc(u.roleLabel)}</span><small>Lv.${Number(u.owned?.level)||1} · ${esc(el.name||u.element)}</small></div>
      <div class="cv76-prep-stats"><span><small>HIỆN DIỆN</small><b>${Number(u.presence)||0}</b></span><span><small>BẢO HỘ</small><b>${guard}%</b></span></div>
    </button>`;
  }

  function preBattlePanelMarkup(){
    if(!battle||battle.state.phase!=='ready')return '';
    const active=battle.state.team||[], reserves=battle.state.reserves||[];
    const domains=Object.values(TAMER_EXPANSIONS).map(d=>{const v=DOMAIN_VISUAL[d.id]||{icon:'◉'};return `<span class="cv76-domain-ref"><i>${esc(v.icon)}</i><b>${esc(d.short||d.name)}</b><small>${esc(d.description)}</small></span>`;}).join('');
    return `<aside class="cv76-prebattle">
      <header><div><small>CHUẨN BỊ ĐỘI HÌNH</small><b>3 Pow xuất trận · 2 Pow dự bị</b><span>${ui.formationSelectedId?'Đã chọn 1 Pow · chọn Pow thứ hai để đổi vị trí':'Nhấn hai Pow để đổi vị trí trước khi bắt đầu trận.'}</span></div><div class="cv76-prep-rule"><b>KHÔNG ĐỔI LUẬT COMBAT</b><span>Chỉ sắp xếp 5 Pow hiện có.</span></div></header>
      <div class="cv76-prep-main"><section class="cv76-formation"><div class="cv76-active-row">${active.map((u,i)=>preBattlePowCard(u,'active',i)).join('')}</div><div class="cv76-reserve-row">${reserves.map((u,i)=>preBattlePowCard(u,'reserve',i)).join('')}</div></section><section class="cv76-tamer-loadout"><div><small>TAMER LOADOUT</small><b>3 Giản Dị · 1 Bành Trướng</b><span>Bành Trướng vẫn được chọn trong trận như hiện tại.</span></div><div class="cv76-domain-list">${domains}</div></section></div>
    </aside>`;
  }

  function swapReadyFormation(unitId){
    if(!battle||battle.state.phase!=='ready'||!unitId)return;
    if(!ui.formationSelectedId){ui.formationSelectedId=unitId;render();return;}
    const first=ui.formationSelectedId;
    if(first===unitId){ui.formationSelectedId=null;render();return;}
    const team=battle.state.team,res=battle.state.reserves;
    const aT=team.findIndex(u=>u.id===first), aR=res.findIndex(u=>u.id===first);
    const bT=team.findIndex(u=>u.id===unitId), bR=res.findIndex(u=>u.id===unitId);
    if(aT>=0&&bT>=0){[team[aT],team[bT]]=[team[bT],team[aT]];}
    else if(aR>=0&&bR>=0){[res[aR],res[bR]]=[res[bR],res[aR]];}
    else if(aT>=0&&bR>=0){const out=team[aT],incoming=res[bR];incoming.isReserve=false;out.isReserve=true;incoming.meter=0;out.meter=0;team[aT]=incoming;res[bR]=out;}
    else if(aR>=0&&bT>=0){const out=team[bT],incoming=res[aR];incoming.isReserve=false;out.isReserve=true;incoming.meter=0;out.meter=0;team[bT]=incoming;res[aR]=out;}
    ui.formationSelectedId=null;ui.battleStats=initBattleStats();ui.preloadPromise=preloadCombatAssets();render();
  }

  function reserveMarkup(u){
    return `<button class="cv7-reserve" data-cv7-reserve="${esc(u.id)}"><img src="${esc(combatAsset(u.asset))}" alt=""><span><b>${esc(u.name)}</b><small>${esc(u.roleLabel)} · Hiện diện ${u.presence}</small></span></button>`;
  }

  function skillMarkup(unit,key,label,icon){
    const info=battle.actionInfo(unit,key); const a=info.ability; if(!a)return '';
    const disabled=!info.available; const cls=key==='ultimate'?'ult':key==='exclusive'?'ex':'';
    const req=key==='ultimate'?'100 Nộ':key==='exclusive'?`90 Nộ${info.specialRequired&&info.specialResource?` · ${info.specialRequired} ${info.specialResource.name}`:''}`:`${info.cost} Mana`;
    const state=skillState(unit,key,info);
    const resource=key==='ultimate'?clamp(Number(unit.rage)||0,0,100):key==='exclusive'?clamp((Number(unit.rage)||0)/90*100,0,100):info.cost?clamp((Number(unit.mana)||0)/Math.max(1,Number(info.cost))*100,0,100):100;
    const desc=String(a.rulesText||a.description||'').trim();
    const art=window.POWDER_SKILL_ART?.get?.(a)||a?.skillArt||'';
    return `<button class="cv7-skill ${cls} cv73-${esc(key)} cv69-state-${esc(state.cls)} ${art?'has-skill-art':''}" data-cv7-skill="${key}" ${disabled?'disabled':''} title="${esc(desc)}
${esc(state.label)}${state.detail?` · ${esc(state.detail)}`:''}"><span class="cv7-skill-icon">${art?`<img src="${esc(combatAsset(art))}" alt="${esc(a.name)}">`:icon}</span><span class="cv73-skill-copy"><small>${label}</small><b>${esc(a.name)}</b><p>${esc(desc||'Kỹ năng chiến đấu')}</p></span><span class="cv73-skill-meta"><em>${req}</em><em>${info.plan.base}${info.plan.max>info.plan.base?`–${info.plan.max}`:''} câu</em></span><span class="cv69-skill-state">${esc(state.label)}${state.detail?` <i>${esc(state.detail)}</i>`:''}</span><span class="cv69-skill-resource"><i style="width:${resource}%"></i></span></button>`;
  }

  function domainHudMarkup(){
    const d=battle?.state?.tamer?.expansion;
    if(!d)return '';
    const cfg=TAMER_EXPANSIONS[d.id]||d; const visual=DOMAIN_VISUAL[d.id]||{icon:'◉',eyebrow:'BÀNH TRƯỚNG LÃNH ĐỊA',accent:''};
    const remaining=clamp(Number(d.remainingRounds)||0,0,5);
    const pips=Array.from({length:5},(_,i)=>`<i class="${i<remaining?'on':''}"></i>`).join('');
    return `<aside class="cv7-domain-hud domain-${esc(d.id)}"><div class="cv7-domain-sigil">${esc(visual.icon)}</div><div><small>${esc(visual.eyebrow)}</small><b>${esc(cfg.name||d.name)}</b><span>${esc(cfg.description||d.description||'')}</span><div class="cv66-domain-pips">${pips}</div></div><em>${remaining}<small>HIỆP</small></em></aside>`;
  }

  function domainCinematicMarkup(){
    const d=ui.domainCinematic;if(!d)return '';
    const visual=DOMAIN_VISUAL[d.id]||{icon:'◉',eyebrow:'TAMER TECHNIQUE',accent:''};
    return `<div class="cv7-domain-cinematic domain-${esc(d.id)}" style="--domain-age:-${effectAge(d)}ms"><div class="cv7-domain-rune"><i>${esc(visual.icon)}</i></div><div class="cv66-domain-cine-flare"></div><div class="cv7-domain-cinematic-copy"><small>${esc(visual.eyebrow)}</small><strong>BÀNH TRƯỚNG LÃNH ĐỊA</strong><i class="cv74-domain-ja">領域展開 · ${esc(DOMAIN_JP[d.id]||'RYŌIKI TENKAI')}</i><b>${esc(d.name)}</b><em>${esc(visual.accent)}</em><span>Hiệu ứng chiến trường duy trì ${Number(d.remainingRounds)||5} hiệp</span></div></div>`;
  }

  function domainWorldMarkup(){
    const d=battle?.state?.tamer?.expansion;
    if(!d)return '';
    if(!ui.domainVisualStartedAt)ui.domainVisualStartedAt=effectNow();
    const visual=DOMAIN_VISUAL[d.id]||{icon:'◉'};
    const age=Math.max(0,Math.round(effectNow()-ui.domainVisualStartedAt));
    const motes=Array.from({length:8},(_,i)=>`<i class="mote m${i+1}"></i>`).join('');
    return `<div class="cv66-domain-world domain-${esc(d.id)}" style="--domain-world-age:-${age}ms"><div class="cv66-domain-sky"></div><div class="cv66-domain-horizon"></div><div class="cv66-domain-ground"><i>${esc(visual.icon)}</i></div><div class="cv66-domain-structure"><i></i><i></i><i></i><i></i></div><div class="cv66-domain-particles">${motes}</div></div>`;
  }

  function tamerCommandMarkup(){
    if(!battle||battle.state.phase==='ready'||battle.state.finished)return '';
    const t=battle.state.tamer||{}; const cur=battle.state.current;
    const simpleDisabled=!cur||Number(t.simpleCharges)<=0||t.simpleActionLock;
    const expandDisabled=Boolean(t.expansionUsed)||!cur||cur.side!=='player';
    const pending=t.pendingSimple;
    const simpleOpen=ui.tamerMenu==='simple', expandOpen=ui.tamerMenu==='expansion';
    const simpleMenu=simpleOpen?`<div class="cv7-tamer-pop simple-pop"><button data-cv7-tamer-simple="assault" ${!battle.canUseTamerSimple?.('assault')?'disabled':''}><i>⚔</i><span><b>CƯỜNG CÔNG</b><small>+25% sát thương cho hành động tấn công hiện tại.</small></span></button><button data-cv7-tamer-simple="guard" ${!battle.canUseTamerSimple?.('guard')?'disabled':''}><i>⬡</i><span><b>KIÊN THỦ</b><small>-30% sát thương từ hành động địch hiện tại.</small></span></button></div>`:'';
    const expandMenu=expandOpen?`<div class="cv7-tamer-pop expansion-pop">${Object.values(TAMER_EXPANSIONS).map(x=>`<button data-cv7-domain="${esc(x.id)}" ${!battle.canExpandDomain?.(x.id)?'disabled':''}><i>◉</i><span><b>${esc(x.short||x.name)}</b><small>${esc(x.description)}</small></span></button>`).join('')}</div>`:'';
    return `<aside class="cv7-tamer-command ${pending?'has-pending':''}"><header><span>TAMER COMMAND</span><b>${pending?`ĐÃ KÍCH HOẠT · ${esc(TAMER_SIMPLE[pending.kind]?.name||pending.kind)}`:'CAN THIỆP CHIẾN TRƯỜNG'}</b></header><div class="cv7-tamer-actions"><button class="simple" data-cv7-tamer-menu="simple" ${simpleDisabled?'disabled':''}><i>◇</i><span><small>GIẢN DỊ LÃNH ĐỊA</small><b>${Number(t.simpleCharges)||0}/3</b></span></button><button class="expansion" data-cv7-tamer-menu="expansion" ${expandDisabled?'disabled':''}><i>◉</i><span><small>BÀNH TRƯỚNG</small><b>${t.expansionUsed?'ĐÃ DÙNG':'1/1'}</b></span></button></div>${simpleMenu}${expandMenu}</aside>`;
  }

  function commandDock(){
    const u=battle?.state.current; if(!u||u.side!=='player'||battle.state.phase!=='running')return '';
    if(!['command','target'].includes(ui.mode))return '';
    const sp=battle.v9SpecialInfo?.(u);const resourceLine=sp?.resource?` · ${esc(sp.resource.name)} ${sp.resource.value}/${sp.resource.max}`:sp?.aux?` · Phách Sấm ${sp.aux.thunderBeat} · Phách Gió ${sp.aux.windBeat}${sp.aux.stormHeart?' · TÂM BÃO SẴN SÀNG':''}`:'';const frostForm=u.powId==='frostmaw'?(u.combatForm==='kun'?' · DẠNG CÔN':' · DẠNG BẰNG'):'';const formLine=(sp?.breakthrough?' · ĐỘT PHÁ':'')+frostForm;const domainLine=sp?.domain?' · LÃNH VỰC':'';
    return `<section class="cv7-command cv73-command-v2 ${ui.mode==='target'?'is-targeting':''}"><div class="cv7-active"><img src="${esc(combatAsset(u.asset))}" alt=""><div><small>LƯỢT CỦA BẠN</small><b>${esc(u.name)}</b><span>${esc(u.roleLabel)}</span><em>Mana ${Math.round(u.mana)}/${u.maxMana} · Nộ ${Math.round(u.rage)}/100${resourceLine}${formLine}${domainLine}</em></div></div>
      <div class="cv7-skills">${skillMarkup(u,'basic','ĐÒN CƠ BẢN','⚔')}${skillMarkup(u,'skill1','KỸ NĂNG 1','✦')}${skillMarkup(u,'skill2','KỸ NĂNG 2','◆')}${u.rarity==='ancient'?skillMarkup(u,'exclusive','ĐỘC QUYỀN','◉'):''}${skillMarkup(u,'ultimate','TỐI THƯỢNG','★')}</div>
      ${ui.mode==='target'?`<div class="cv73-target-prompt"><small>ĐANG CHỌN MỤC TIÊU</small><b>Nhấn vào Pow hợp lệ</b><button class="cv7-cancel" data-cv7-cancel>HỦY</button></div>`:'<div class="cv73-command-tip"><small>CHỌN KỸ NĂNG</small><b>Hover để xem mô tả</b></div>'}</section>`;
  }

  function knowledgePreview(q){
    if(!q)return 1;
    return Number(Core.knowledgeScale?.(Number(q.baseWrong)||0,Number(q.extraCorrect)||0) ?? 1);
  }

  function knowledgeProgressMarkup(q){
    const dots=[];
    for(let i=0;i<q.max;i++){
      const isBase=i<q.base;
      const done=i<q.answered;
      const active=i===q.index && ui.mode==='question';
      dots.push(`<i class="${isBase?'base':'combo'} ${done?'done':''} ${active?'active':''}" title="${isBase?'Câu kích hoạt':'Câu Combo'} ${i+1}"></i>`);
    }
    return dots.join('');
  }

  function questionPanel(){
    const q=ui.question; if(!q)return '';
    const item=q.questions[q.index]; if(!item)return '';
    const answered=q.lastAnswer;
    const isBase=q.index<q.base;
    const scale=knowledgePreview(q);
    const bonus=Math.max(0,Math.round((scale-1)*100));
    const penalty=scale<1?Math.round((1-scale)*100):0;
    const feedback=answered
      ?(answered.correct
        ?`<div class="cv75-answer-feedback correct"><b>✓ CHÍNH XÁC</b><span>${esc(item.explain||'Đáp án đúng.')}</span></div>`
        :`<div class="cv75-answer-feedback wrong"><b>✕ CHƯA ĐÚNG</b><span>Đáp án: <strong>${esc(item.answer)}</strong>${item.explain?` · ${esc(item.explain)}`:''}</span></div>`)
      :'';
    return `<section class="cv7-question cv75-question-v2 ${isBase?'is-base':'is-combo'} ${answered?(answered.correct?'answered-correct':'answered-wrong'):''}">
      <header class="cv75-question-head">
        <div class="cv75-question-title"><small>${item.language==='ZH'?'TIẾNG TRUNG':'TIẾNG ANH'}</small><b>${isBase?'CÂU HỎI KÍCH HOẠT':'COMBO KIẾN THỨC'}</b><span>Câu ${q.index+1}/${q.max}</span></div>
        <div class="cv75-knowledge-power"><small>SỨC MẠNH HIỆN TẠI</small><b>x${scale.toFixed(2)}</b><span>${penalty?`-${penalty}% do câu sai`:bonus?`+${bonus}% từ Combo`:'Sức mạnh chuẩn'}</span></div>
      </header>
      <div class="cv75-question-progress"><div>${knowledgeProgressMarkup(q)}</div><span><b>${Math.min(q.answered,q.base)}/${q.base}</b> câu kích hoạt</span><span><b>${q.extraCorrect}</b> Combo đúng</span></div>
      <div class="cv75-question-body"><small class="cv75-question-hint">${isBase?'Trả lời để kích hoạt kỹ năng':'Câu thêm chỉ tăng sức mạnh khi chuỗi câu gốc hoàn hảo'}</small><h3>${esc(item.prompt)}</h3>
        <div class="cv7-options">${item.options.map((o,i)=>`<button data-cv7-answer="${i}" ${answered?'disabled':''} class="${answered?(o===item.answer?'correct':o===answered.value&&!answered.correct?'wrong':''):''}"><b>${String.fromCharCode(65+i)}.</b><span>${esc(o)}</span></button>`).join('')}</div>
        ${feedback}
      </div>
      <footer class="cv75-question-footer"><span>${answered?'Đang chuyển sang bước tiếp theo…':isBase?'Sai câu gốc sẽ làm giảm hệ số sức mạnh của hành động.':'Bạn có thể dừng Combo ở bước kế tiếp để ra chiêu.'}</span></footer>
    </section>`;
  }

  function comboPanel(){
    const q=ui.question; if(ui.mode!=='combo'||!q)return '';
    const scale=knowledgePreview(q);
    const next=q.index+1;
    const canContinue=next<q.max;
    return `<section class="cv7-combo-choice cv75-combo-v2"><div class="cv75-combo-copy"><small>CHUỖI KIẾN THỨC HOÀN HẢO</small><b>x${scale.toFixed(2)} sức mạnh</b><span>Đã đúng ${q.base}/${q.base} câu kích hoạt${q.extraCorrect?` + ${q.extraCorrect} Combo`:''}. ${canContinue?'Bạn có thể mạo hiểm thêm 1 câu để nhận +12%.':'Đã đạt số câu tối đa.'}</span></div><div class="cv75-combo-actions"><button class="cast" data-cv7-cast>⚔ RA CHIÊU <small>Giữ x${scale.toFixed(2)}</small></button>${canContinue?`<button class="continue" data-cv7-combo>✦ COMBO +1 <small>+12% nếu đúng</small></button>`:''}</div></section>`;
  }


  function replacementPanel(){
    if(!battle||battle.state.phase!=='replacement')return '';
    const slot=battle.state.replacementQueue[0]; const fallen=battle.state.team[slot];
    return `<section class="cv7-replacement"><div><small>THAY POW</small><h2>${fallen?`${esc(fallen.name)} đã bị hạ`:'Chọn Pow vào sân'}</h2><p>Chọn một Pow dự bị. Pow mới vào sân bắt đầu với thanh lượt 0%.</p></div><div>${battle.state.reserves.filter(r=>!r.defeated).map(reserveMarkup).join('')}</div></section>`;
  }

  function resultPanel(){
    if(!battle?.state.finished)return '';
    const win=battle.state.result==='win'; const summary=combatSummary(); const m=summary.mvp; const reward=ui.reward||{coins:0,exp:0};
    const maxDamage=Math.max(1,...summary.players.map(x=>Number(x.damageDealt)||0));
    const cards=summary.players.map(line=>{
      const unused=!line.entered&&!line.actions;
      const utility=(Number(line.statusesApplied)||0)+(Number(line.cleanses)||0);
      const dmgPct=clamp(Math.round((Number(line.damageDealt)||0)/maxDamage*100),0,100);
      return `<article class="cv70-stat-card ${m?.unitId===line.unitId?'mvp':''} ${unused?'unused':''}">
        <div class="cv70-card-head"><div class="cv70-card-art"><img src="${esc(combatAsset(line.asset))}" alt=""><i>${m?.unitId===line.unitId?'★':unused?'Z':'•'}</i></div><div><small>${unused?'DỰ BỊ CHƯA RA SÂN':esc(line.roleLabel)}</small><b>${esc(line.name)}</b><span>${line.mvpScore||0} ĐIỂM ĐÓNG GÓP</span></div></div>
        <div class="cv70-dmg-track"><i style="width:${dmgPct}%"></i></div>
        <div class="cv70-stat-grid"><span><small>DMG</small><b>${fmtStat(line.damageDealt)}</b></span><span><small>NHẬN</small><b>${fmtStat(line.damageTaken)}</b></span><span><small>HEAL</small><b>${fmtStat(line.healingDone)}</b></span><span><small>HẠ</small><b>${fmtStat(line.kills)}</b></span><span><small>CRIT</small><b>${fmtStat(line.crits)}</b></span><span><small>GUARD</small><b>${fmtStat(line.guards)}</b></span></div>
        <footer><span>Hiệu ứng <b>${utility}</b></span><span>Hệ số KT <b>${line.knowledgeActions?`x${line.knowledgeAvg.toFixed(2)}`:'—'}</b></span><span>Hành động <b>${line.actions}</b></span></footer>
      </article>`;
    }).join('');
    const domain=summary.tamer?.domainId?TAMER_EXPANSIONS[summary.tamer.domainId]:null;
    const tamerContribution=(Number(summary.tamer?.bonusDamage)||0)+(Number(summary.tamer?.damagePrevented)||0)+(Number(summary.tamer?.bonusHealing)||0);
    return `<section class="cv7-result cv70-result ${win?'win':'loss'}">
      <div class="cv70-result-shell">
        <header class="cv70-result-header"><div><small>${ui.storyStage?.bossChallengeId?(win?'COMBAT BOSS · CHIẾN THẮNG':'COMBAT BOSS · THẤT BẠI'):(win?'KẾT QUẢ CHIẾN ĐẤU · CHIẾN THẮNG':'KẾT QUẢ CHIẾN ĐẤU · THẤT BẠI')}</small><h2>${ui.storyStage?.bossChallengeId?(win?'BOSS ĐÃ BỊ HẠ':'THẤT BẠI TRƯỚC BOSS'):(win?'ĐỘI POW LÀM CHỦ CHIẾN TRƯỜNG':'ĐỘI POW BỊ ĐÁNH BẠI')}</h2><p>${summary.rounds} vòng · ${summary.turns} lượt · ${fmtDuration(summary.durationMs)}</p></div><div class="cv70-result-badge">${win?'VICTORY':'DEFEAT'}</div></header>
        ${m?`<section class="cv70-mvp"><div class="cv70-mvp-crown">♛</div><div class="cv70-mvp-art"><img src="${esc(combatAsset(m.asset))}" alt=""></div><div class="cv70-mvp-copy"><small>MVP · ${esc(m.roleLabel)}</small><h3>${esc(m.name)}</h3><p>${esc(lineHighlight(m))}</p><div class="cv70-mvp-score"><b>${m.mvpScore}</b><span>ĐIỂM MVP</span></div></div><div class="cv70-mvp-stats"><span><small>SÁT THƯƠNG</small><b>${fmtStat(m.damageDealt)}</b></span><span><small>HỒI PHỤC</small><b>${fmtStat(m.healingDone)}</b></span><span><small>HẠ GỤC</small><b>${fmtStat(m.kills)}</b></span><span><small>BẢO HỘ</small><b>${fmtStat(m.guards)}</b></span></div></section>`:''}
        <section class="cv70-overview"><div><small>DMG ĐỘI BẠN</small><b>${fmtStat(summary.teamDamage)}</b></div><div><small>DMG ĐỘI ĐỊCH</small><b>${fmtStat(summary.enemyDamage)}</b></div><div><small>HỒI PHỤC</small><b>${fmtStat(summary.teamHeal)}</b></div><div><small>BẢO HỘ</small><b>${fmtStat(summary.teamGuards)}</b></div><div><small>CRIT</small><b>${fmtStat(summary.teamCrits)}</b></div><div><small>HẠ GỤC</small><b>${fmtStat(summary.teamKills)}</b></div></section>
        <section class="cv70-team-section"><header><small>PHÂN TÍCH ĐỘI POW</small><b>Đóng góp từng Pow trong trận</b></header><div class="cv70-team-grid">${cards}</div></section>
        <section class="cv70-bottom-grid"><article class="cv70-tamer-summary"><header><small>TAMER COMMAND</small><b>Đóng góp Lãnh Địa</b></header><div class="cv70-tamer-main"><i>${domain?DOMAIN_VISUAL[domain.id]?.icon||'◉':'◇'}</i><div><b>${domain?esc(domain.name):'Chưa Bành Trướng Lãnh Địa'}</b><span>${domain?`${summary.tamer.domainRoundsUsed||0}/5 hiệp đã hoàn tất · ${summary.tamer.domainActions||0} hành động được ảnh hưởng`:'Trận này không sử dụng Bành Trướng Lãnh Địa.'}</span></div></div><div class="cv70-tamer-stats"><span><small>GIẢN DỊ</small><b>${summary.tamer.simpleUses||0}/3</b></span><span><small>DMG THÊM</small><b>+${fmtStat(summary.tamer.bonusDamage)}</b></span><span><small>DMG GIẢM</small><b>${fmtStat(summary.tamer.damagePrevented)}</b></span><span><small>HEAL THÊM</small><b>+${fmtStat(summary.tamer.bonusHealing)}</b></span>${summary.tamer.speedBoostedActions?`<span><small>TĂNG TỐC</small><b>${summary.tamer.speedBoostedActions} lượt</b></span>`:''}</div><footer>Giá trị Domain là thống kê đóng góp từ modifier đang hoạt động, không thay đổi công thức chiến đấu.</footer></article>
        <article class="cv70-reward"><header><small>${ui.storyStage?.entrySource==='event'?'PHẦN THƯỞNG SỰ KIỆN':ui.storyStage?.bossChallengeId?'PHẦN THƯỞNG BOSS':'PHẦN THƯỞNG PVE'}</small><b>${ui.storyStage?.entrySource==='event'?'Do Sự kiện quản lý':win?'Đã ghi nhận':'Không nhận thưởng'}</b></header><div><span><img class="currency-inline-icon" src="assets/items/ui-compact/military-coin.webp" alt=""> <b>${fmtStat(reward.coins||0)}</b><small>Military Coin</small></span>${ui.storyStage?.bossChallengeId?`<span>👑 <b>${fmtStat(reward.bossPoints||0)}</b><small>Boss Point</small></span><span>📦 <b>${fmtStat((reward.sameRankChests||0)+(reward.higherRankChests||0))}</b><small>PowBall thưởng</small></span>`:`<span>✦ <b>${fmtStat(reward.exp||0)}</b><small>EXP</small></span>`}</div><p>${ui.storyStage?.bossChallengeId?(reward.bossMessage||'Chỉ thắng Combat Boss mới được nhận thưởng.'):(win?'Kết quả và tiến độ trận đã được ghi nhận.':'Điều chỉnh đội hình rồi thử lại.')}</p></article></section>
        <div class="cv70-result-actions">${ui.storyStage?.entrySource==='event'?`<button data-cv177-event-hub>VỀ SỰ KIỆN</button>${!win?`<button data-cv81-story-retry>THỬ LẠI</button>`:''}`:ui.storyStage?.bossChallengeId?`<button data-cv923-boss-hub>VỀ KHU BOSS</button>${!win?`<button data-cv923-boss-retry disabled>CHỜ 5 PHÚT</button>`:''}`:ui.storyStage?`<button data-cv81-story-map>VỀ BẢN ĐỒ</button>${ui.storyStage?.practiceNoReward?'':win?`<button data-cv81-story-next>ẢI TIẾP THEO</button>`:`<button data-cv81-story-retry>THỬ LẠI</button>`}`:`<button data-cv7-home>VỀ CĂN CỨ</button>`}</div>
      </div>
    </section>`;
  }

  function objective(){
    if(!battle)return '';
    const s=battle.state; const alive=battle.living('enemy').length;
    return `<aside class="cv7-objective"><small>${ui.storyStage?.entrySource==='event'?'MỤC TIÊU SỰ KIỆN':ui.storyStage?.bossChallengeId?'MỤC TIÊU BOSS':ui.storyStage?'MỤC TIÊU PHÓ BẢN':'MỤC TIÊU'}</small><b>${s.mode==='boss'?'Đánh bại Boss':'Hạ toàn bộ Pow địch'}</b><span>${ui.storyStage?`Màn ${Number(ui.storyStage.number)||1} · ${alive}/${s.enemies.length} mục tiêu còn lại`:(s.mode==='boss'?`${alive?'Boss còn chiến đấu':'Boss đã bị hạ'}`:`${alive}/${s.enemies.length} Pow địch còn sống`)}</span></aside>`;
  }

  function turnOrder(){
    if(!battle||battle.state.phase==='ready')return '';
    const units=turnForecast(7);
    return `<aside class="cv7-turn-order cv69-turn-order"><small>THỨ TỰ LƯỢT</small>${units.map((x,i)=>`<span class="${x.u.side} ${battle.state.current?.id===x.u.id?'now':''}" title="${esc(x.u.name)} · SPEED ${battle.effective(x.u).speed} · Thanh lượt ${Math.round(x.meter)}%"><b>${i+1}</b><img src="${esc(combatAsset(x.u.asset))}" alt=""><em>${esc(x.u.name)}</em><i class="cv69-turn-meter"><b style="width:${x.meter}%"></b></i><small>${battle.state.current?.id===x.u.id?'NOW':`${Math.round(x.meter)}%`}</small></span>`).join('')}</aside>`;
  }

  function battleLog(){
    if(!battle||battle.state.phase==='ready')return '';
    const filter=ui.logFilter||'all';
    const all=Array.isArray(ui.combatFeed)?ui.combatFeed:[];
    const filtered=filter==='all'?all:all.filter(x=>x.kind===filter);
    const latest=[...filtered].slice(-24).reverse();
    const count=all.length;
    if(!ui.logOpen){
      const last=all[all.length-1];
      return `<aside class="cv7-log cv79-log is-collapsed"><button class="cv79-log-peek" data-cv79-log-toggle><span><small>NHẬT KÝ</small><b>${count}</b></span><em>${esc(last?.text||'Theo dõi diễn biến trận đấu')}</em><i>⌃</i></button></aside>`;
    }
    const tabs=[['all','TẤT CẢ'],['action','HÀNH ĐỘNG'],['status','HIỆU ỨNG'],['tamer','TAMER'],['system','HỆ THỐNG']];
    return `<aside class="cv7-log cv79-log is-open"><header><div><small>NHẬT KÝ CHIẾN ĐẤU</small><b>${count} SỰ KIỆN</b></div><button data-cv79-log-toggle title="Thu gọn">×</button></header><nav>${tabs.map(([k,l])=>`<button data-cv79-log-filter="${k}" class="${filter===k?'active':''}">${l}</button>`).join('')}</nav><div class="cv79-log-list">${latest.length?latest.map(x=>`<article class="tone-${esc(x.tone||'system')}"><span>R${x.round}</span><p>${esc(x.text)}</p></article>`).join(''):'<p class="cv79-log-empty">Chưa có sự kiện ở bộ lọc này.</p>'}</div></aside>`;
  }



  function bossMechanicState(boss){return window.POWDER_BOSS_COMBAT_V1861?.pendingFor?.(boss)||boss?.v9?.battleFlags?.bossMechanic1861||null;}
  function bossMechanicHudMarkup(boss){
    const p=bossMechanicState(boss);if(!p)return '';
    let progress=0,sub='';
    if(p.response==='shield-break'){
      const base=Math.max(0,Number(p.barrierBaseline)||0),amount=Math.max(1,Number(p.barrierAmount)||1),left=Math.max(0,(Number(boss.shield)||0)-base);progress=clamp(1-left/amount,0,1);sub=`CÒN ${Math.round(left).toLocaleString('vi-VN')} KHIÊN`;
    }else if(p.targetId){const t=battle?.allRosterUnits?.find?.(u=>u.id===p.targetId);const live=Boolean(t&&(t.customStatuses?.[p.mark]||t.statuses?.[p.mark]));progress=live?0:1;sub=t?`${esc(t.name)} · ${live?'CẦN THANH TẨY':'ĐÃ THANH TẨY'}`:'MỤC TIÊU KHÔNG CÒN';}
    const label=p.response==='shield-break'?'PHÁ KHIÊN':'THANH TẨY';
    return `<div class="cv1861-boss-mechanic response-${esc(p.response||'react')}"><header><small>⚠ CỬA SỔ PHẢN ỨNG</small><b>${esc(p.name||'Boss Mechanic')}</b><em>${label}</em></header><p>${esc(p.detail||'Phản ứng trước lượt Boss kế tiếp.')}</p><div><i><b style="width:${Math.round(progress*100)}%"></b></i><span>${esc(sub)}</span></div></div>`;
  }
  function bossMechanicNoticeMarkup(){const x=ui.bossMechanicNotice;if(!x)return '';const good=x.mode==='success';return `<div class="cv1861-boss-mechanic-notice ${good?'success':x.mode==='fail'?'fail':'arm'}"><small>${good?'PHẢN ỨNG THÀNH CÔNG':x.mode==='fail'?'BOSS MECHANIC':'⚠ BOSS MECHANIC'}</small><b>${esc(x.name)}</b><span>${esc(x.response||'')}</span>${x.detail?`<p>${esc(x.detail)}</p>`:''}</div>`;}

  function bossBarMarkup(boss){
    if(!boss)return '';
    const hpPct=clamp(Math.round(boss.hp/Math.max(1,boss.maxHp)*100),0,100); const max=bossMaxPhases(boss.bossType||battle?.state?.bossType); const phase=Number(boss.bossPhase||1);
    const thresholds=bossThresholds(boss.bossType||battle?.state?.bossType); const shield=Math.max(0,Number(boss.shield)||0); const rage=clamp(Number(boss.rage)||0,0,100); const el=element(boss.element);
    return `<div class="cv7-bossbar-v2 cv77-boss-hud phase-${phase}">
      <div class="cv77-boss-portrait"><img src="${esc(combatAsset(boss.asset))}" alt=""><span>${esc(el.icon)}</span></div>
      <div class="cv77-boss-core">
        <div class="cv7-boss-head"><div><small>${bossTypeLabel(boss.bossType||battle?.state?.bossType)} · ${esc(el.icon)} ${esc(el.name||boss.element)}</small><b>${esc(boss.name)}</b></div><div class="cv77-boss-phase"><small>PHASE</small><b>${phase}/${max}</b></div></div>
        <div class="cv77-boss-hp-meta"><span>HP BOSS</span><strong>${hpPct}%</strong></div>
        <div class="cv7-boss-hp"><i><b style="width:${hpPct}%"></b><em class="cv824-boss-shield" style="width:${clamp(Math.round(shield/Math.max(1,boss.maxHp)*100),0,100)}%"></em>${thresholds.map(t=>`<span style="left:${t}%"></span>`).join('')}</i><strong>${Math.round(boss.hp).toLocaleString('vi-VN')} / ${Math.round(boss.maxHp).toLocaleString('vi-VN')}</strong></div>
        <div class="cv7-boss-sub"><span>NỘ <i><b style="width:${rage}%"></b></i><em>${Math.round(rage)}%</em></span>${shield>0?`<span class="shield">⬡ KHIÊN <b>${Math.round(shield).toLocaleString('vi-VN')}</b></span>`:''}<span class="phase-pips">${Array.from({length:max},(_,i)=>`<i class="${i<phase?'on':''}">${i+1}</i>`).join('')}</span></div>
        ${bossMechanicHudMarkup(boss)}
        <div class="cv78-boss-statuses"><small>HIỆU ỨNG</small><div class="cv7-statuses">${statusChipsMarkup(boss,6)}</div></div>
      </div>
    </div>`;
  }


  function bossIntroMarkup(){
    const x=ui.bossIntro;if(!x)return ''; const age=effectAge(x);
    return `<div class="cv7-boss-intro el-${esc(x.element)}" style="--boss-intro-age:-${age}ms"><div class="cv7-boss-intro-bg"></div><div class="cv7-boss-intro-seal"></div><div class="cv7-boss-intro-art"><img src="${esc(combatAsset(x.asset))}" alt=""></div><div class="cv7-boss-intro-copy"><small>${esc(x.typeLabel)}</small><b>${esc(x.name)}</b><span>${esc(x.elementIcon)} ${esc(x.elementName)} · ${esc(x.role||'BOSS')}</span><em>${x.maxPhases>1?`${x.maxPhases} PHA CHIẾN ĐẤU`:'THỬ THÁCH BOSS'}</em></div><div class="cv7-boss-intro-line"></div></div>`;
  }

  function bossPhaseCinematicMarkup(){
    const x=ui.bossPhaseCinematic;if(!x)return ''; const age=effectAge(x);
    return `<div class="cv7-boss-phase-cine el-${esc(x.element)} phase-${x.phase}" style="--boss-phase-age:-${age}ms"><div class="cv7-boss-phase-flare"></div><img src="${esc(combatAsset(x.asset))}" alt=""><div><small>NGUY HIỂM GIA TĂNG</small><b>PHASE ${x.phase}</b><span>${x.phaseName?esc(x.phaseName):esc(x.name)}</span><em>${x.phaseName?esc(x.name)+' · ':''}ATK / AP / SPEED ↑ · NỘ ĐẦY · KHIÊN KÍCH HOẠT</em></div></div>`;
  }

  function bossWarningMarkup(){
    const x=ui.bossWarning;if(!x)return ''; const age=effectAge(x); const dur=Math.max(700,Number(x.duration)||1600);
    return `<div class="cv7-boss-warning ${esc(x.key)} el-${esc(x.element)}" style="--boss-warning-age:-${age}ms;--boss-warning-duration:${dur}ms"><img src="${esc(combatAsset(x.asset))}" alt=""><div><small>⚠ BOSS SẮP RA CHIÊU · ${esc(x.danger)}</small><b>${esc(x.name)}</b><span>${esc(x.ability)}</span>${x.pattern?`<strong>${esc(x.pattern)}</strong>`:''}${x.patternHint?`<p>${esc(x.patternHint)}</p>`:''}<i><b></b></i></div><em>PHA ${x.phase}${x.confidence?` · ${Math.round(x.confidence)}%`:''}</em></div>`;
  }

  function bossDefeatMarkup(){
    const x=ui.bossDefeat;if(!x)return ''; const age=effectAge(x);
    return `<div class="cv7-boss-defeat el-${esc(x.element)}" style="--boss-defeat-age:-${age}ms"><div class="cv7-boss-defeat-flash"></div><img src="${esc(combatAsset(x.asset))}" alt=""><div><small>BOSS BỊ HẠ</small><b>${esc(x.name)}</b><span>CHIẾN THẮNG ĐANG ĐƯỢC XÁC NHẬN</span></div></div>`;
  }

  function attackCalloutMarkup(){
    const a=ui.attackCallout; if(!a)return '';
    return `<div class="cv7-attack-callout ${esc(a.side)} role-${esc(a.roleKey||'marksman')} id-${esc(a.identity||'direct-strike')} ${a.key==='ultimate'?'ultimate':a.key==='exclusive'?'exclusive':''} ${a.signature?`signature sig-${esc(a.signature.id)} sig-${esc(a.signature.tier)}`:''}"><img src="${esc(combatAsset(a.asset))}" alt=""><div><small>${a.side==='enemy'?'POW ĐỊCH ĐANG RA CHIÊU':'POW CỦA BẠN RA CHIÊU'}</small><b>${esc(a.name)}</b><span>${esc(a.ability)}</span><em>${esc(a.roleFxIcon||'✦')} ${esc(a.roleFxLabel||a.role||'POW')}</em>${a.signature?`<strong>${esc(a.signature.icon)} ${esc(a.signature.title)}</strong>`:''}</div></div>`;
  }


  function attackMotionMarkup(){
    const m=ui.attackMotion; if(!m||m.phase!=='release')return '';
    const [sx,sy]=slotPos(m.side,m.slot); const attackAge=m.releaseStartedAt?Math.max(0,Math.round(effectNow()-m.releaseStartedAt)):0; const sig=m.signature||null;
    const targets=(m.targetRefs||[]).map((trg,i)=>{
      const [tx,ty]=slotPos(trg.side,trg.slot);
      const x1=parseFloat(sx),y1=parseFloat(sy),x2=parseFloat(tx),y2=parseFloat(ty);
      const dx=x2-x1,dy=y2-y1; const angle=Math.atan2(dy,dx)*180/Math.PI; const length=Math.max(90,Math.hypot(dx*13,dy*9));
      return `<div class="cv7-attack-flow ${esc(m.key)} role-${esc(m.role||'marksman')} id-${esc(m.identity||'direct-strike')} el-${esc(m.element)} ${sig?`signature sig-${esc(sig.id)} sig-${esc(sig.tier)} motif-${esc(sig.motif)}`:''}" style="--sx:${sx};--sy:${sy};--tx:${tx};--ty:${ty};--angle:${angle}deg;--counter-angle:${-angle}deg;--len:${length}px;--impact-delay:${Number(m.impactDelay)||420}ms;--flow-total:${Number(m.release)||780}ms;--delay:${i*55}ms;--attack-age:-${attackAge}ms"><i class="cv7-attack-trace"></i><i class="cv7-attack-hit"></i><i class="cv7-attack-hit-ring"></i>${sig?`<i class="cv7-signature-impact"><b>${esc(sig.icon)}</b></i>`:''}</div>`;
    }).join('');
    return `<div class="cv7-attack-flow-layer">${targets}</div>`;
  }


  function cameraDirectorMarkup(){
    const d=ui.cameraDirector;if(!d)return '';
    const source=d.source||{};
    const [sx,sy]=slotPos(source.side,source.slot);
    const first=(d.targets||[])[0]||source;
    const [tx,ty]=slotPos(first.side,first.slot);
    const x1=parseFloat(sx),y1=parseFloat(sy),x2=parseFloat(tx),y2=parseFloat(ty);
    const dx=x2-x1,dy=y2-y1,angle=Math.atan2(dy,dx)*180/Math.PI,len=Math.max(70,Math.hypot(dx*13,dy*9));
    const targets=(d.targets||[]).map((t,i)=>{const [x,y]=slotPos(t.side,t.slot);return `<i class="cv8-focus-target t${i+1}" style="--fx:${x};--fy:${y}"></i>`;}).join('');
    const targetCount=Math.max(1,(d.targets||[]).length);
    return `<div class="cv8-camera-director shot-${esc(d.shot)} phase-${esc(d.phase||'charge')} role-${esc(d.role||'marksman')} impact-${esc(d.impactKind||'none')} ${d.aoe?'is-aoe':''} ${d.support?'is-support':''}" data-camera-id="${esc(d.id)}" data-camera-phase="${esc(d.phase||'charge')}" style="--camera-director-age:-${effectAge(d)}ms;--source-x:${sx};--source-y:${sy};--target-x:${tx};--target-y:${ty};--cam-angle:${angle}deg;--cam-len:${len}px;--target-count:${targetCount}"><div class="cv8-camera-vignette"></div><div class="cv8-camera-rails"><i></i><i></i></div><i class="cv8-focus-source"></i>${targets}<div class="cv8-camera-vector"></div><small>${esc(d.label)}</small></div>`;
  }

  function frostmawFormCinematicMarkup(){
    const f=ui.formCinematic;if(!f)return '';
    const age=effectAge(f),toKun=f.to==='kun';
    return `<div class="cv114-form-cine ${toKun?'to-kun':'to-peng'} ${esc(f.side||'player')}" data-form-cine-id="${esc(f.id)}" style="--form-age:-${age}ms"><div class="cv114-form-vignette"></div><div class="cv114-form-ring r1"></div><div class="cv114-form-ring r2"></div><div class="cv114-form-surge"></div><div class="cv114-form-art"><img class="from" src="${esc(combatAsset(f.fromAsset))}" alt=""><img class="to" src="${esc(combatAsset(f.toAsset))}" alt=""></div><div class="cv114-form-copy"><small>HUYẾT MẠCH CÔN BẰNG · HỆ BĂNG</small><b>${toKun?'BẮC MINH HÓA CÔN':'THÁI CỔ HÓA BẰNG'}</b><span>${toKun?'Đại ngư Bắc Minh trồi lên giữa hàn triều':'Băng điểu thái cổ xé mây phá không'}</span></div></div>`;
  }

  function cinematicMarkup(){
    const c=ui.cinematic;if(!c)return '';
    const meta=ROLE_ANIMATION[c.role]||ROLE_ANIMATION.marksman; const sig=c.signature||null; const cineAge=Math.max(0,Math.round(effectNow()-Number(c.phase==='release'&&c.releaseStartedAt?c.releaseStartedAt:c.startedAt||effectNow())));
    return `<div class="cv7-cinematic ${esc(c.key)} ${esc(c.phase)} role-${esc(c.role||'marksman')} id-${esc(c.identity||'direct-strike')} el-${esc(c.element)} ${esc(c.side)} ${sig?`signature sig-${esc(sig.id)} sig-${esc(sig.tier)} motif-${esc(sig.motif)}`:''}" style="--sig-cine-age:-${cineAge}ms"><div class="cv7-letterbox top"></div><div class="cv7-letterbox bottom"></div><div class="cv7-cine-glow"></div>${sig?`<div class="cv7-signature-crest"><i></i><b>${esc(sig.icon)}</b><span>${esc(sig.title)}</span><em>${sig.tier==='ancient'?'THƯỢNG CỔ · CỔ THẦN':'THẦN THOẠI · HOÀNG ĐẾ'}</em></div>`:''}<div class="cv7-cine-role">${esc(meta.icon)} ${esc(meta.label)}</div><div class="cv7-cine-cut"><img src="${esc(combatAsset(c.asset))}" alt=""><div><small>${c.key==='ultimate'?'ULTIMATE':'EXCLUSIVE SKILL'}</small><b>${esc(c.name)}</b><span>${esc(c.ability)}</span></div></div></div>`;
  }

  function fxItemMarkup(f){
    const age=effectAge(f);
    const base=`${esc(f.kind||'damage')} ${esc(f.side||'player')} slot-${Number(f.slot)||0} ${f.offset!=null?`o-${Number(f.offset)%3}`:''} ${f.element?`el-${esc(f.element)}`:''} ${f.key?`key-${esc(f.key)}`:''} ${f.statusClass?`status-${esc(f.statusClass)}`:''} ${f.statusTone?`tone-${esc(f.statusTone)}`:''}`;
    const style=`--fx-age:-${age}ms`;
    if(f.kind==='cast') return `<div class="cv7-vfx cast ${base}" data-fx-id="${esc(f.id)}" style="${style}"><div class="cv7-vfx-core"></div><div class="cv7-vfx-ring"></div><div class="cv7-vfx-label">${esc(f.text||'')}</div></div>`;
    if(f.kind==='impact' || f.kind==='impact-aoe') return `<div class="cv7-vfx impact ${base}" data-fx-id="${esc(f.id)}" style="${style}"><div class="cv7-vfx-burst"></div><div class="cv7-vfx-shock"></div><div class="cv7-vfx-ripple"></div><div class="cv7-vfx-frag"></div><div class="cv7-vfx-spark a"></div><div class="cv7-vfx-spark b"></div><div class="cv7-vfx-spark c"></div></div>`;
    return `<div class="cv7-fx ${base}" data-fx-id="${esc(f.id)}" style="${style}">${esc(f.text||'')}</div>`;
  }

  function fxMarkup(){
    const items=ui.fx||[];
    if(!items.length && !ui.banner && !ui.guardLink && !ui.hitStop) return '';
    let guardLink='';
    if(ui.guardLink){
      const [x1,y1]=slotPos(ui.guardLink.from.side,ui.guardLink.from.slot); const [x2,y2]=slotPos(ui.guardLink.to.side,ui.guardLink.to.slot);
      const nx1=parseFloat(x1), ny1=parseFloat(y1), nx2=parseFloat(x2), ny2=parseFloat(y2);
      const dx=nx2-nx1, dy=ny2-ny1; const angle=Math.atan2(dy,dx)*180/Math.PI; const length=Math.max(64, Math.hypot(dx*12,dy*8)); const age=effectAge(ui.guardLink);
      guardLink = `<div class="cv7-guard-link" style="--x1:${x1};--y1:${y1};--x2:${x2};--y2:${y2};--guard-age:-${age}ms"><div class="cv7-guard-beam" style="width:${length}px; transform:translateY(-50%) rotate(${angle}deg)"></div><div class="cv7-guard-shield from"></div><div class="cv7-guard-shield to"></div></div>`;
    }
    const hitFlash = ui.hitStop ? `<div class="cv7-hitstop-flash ${esc(ui.hitStop.kind||'light')}" style="--hit-age:-${effectAge(ui.hitStop)}ms"></div>` : '';
    const banner=ui.banner?`<div class="cv7-banner ${esc(ui.banner.tone||'info')}" style="--banner-age:-${effectAge(ui.banner)}ms">${esc(ui.banner.text||'')}</div>`:'';
    return `<div class="cv7-fx-layer">${hitFlash}${guardLink}${banner}${items.map(fxItemMarkup).join('')}</div>`;
  }

  function markupSig(value=''){
    const s=String(value||'');let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(36);
  }

  function nodeFromMarkup(markup){
    if(!markup)return null;
    const tpl=document.createElement('template');tpl.innerHTML=String(markup).trim();return tpl.content.firstElementChild||null;
  }

  function syncRegion(parent,selector,markup){
    if(!parent)return null;
    const old=parent.querySelector(selector); const next=String(markup||'').trim();
    if(!next){old?.remove();return null;}
    const sig=markupSig(next);
    if(old?.dataset?.cv71Sig===sig)return old;
    const neo=nodeFromMarkup(next);if(!neo)return old||null;
    neo.dataset.cv71Sig=sig;
    if(old)old.replaceWith(neo);else parent.appendChild(neo);
    return neo;
  }

  function updateMarkupInside(el,markup){
    if(!el)return;
    const next=String(markup||'');const sig=markupSig(next);
    if(el.dataset.cv71InnerSig===sig)return;
    el.innerHTML=next;el.dataset.cv71InnerSig=sig;
  }

  function unitStatusSig(u){
    const names=orderedVisualStatuses(u);
    return names.map(name=>`${name}:${statusTurns(u,name)}:${statusStacks(u,name)}`).join('|')+`|shield:${Math.round(Number(u.shield)||0)}`;
  }

  function patchUnitPersistent(el,u,side,slot){
    if(!el||!u)return;
    patchUnitVitals(el,u);
    const artImg=el.querySelector('.cv7-art');const nextAsset=combatAsset(u.asset);if(artImg&&nextAsset&&artImg.getAttribute('src')!==nextAsset){artImg.src=nextAsset;artImg.alt=u.name||'';artImg.dataset.cv114Form=u.combatForm||'';}
    el.dataset.combatForm=u.combatForm||'';
    el.dataset.slot=String(slot);el.dataset.bossPhase=String(Number(u.bossPhase||1));
    el.disabled=Boolean(u.defeated);
    el.classList.toggle('dead',Boolean(u.defeated));
    const hpRatio=u.hp/Math.max(1,u.maxHp);
    el.classList.toggle('hp-critical',!u.defeated&&hpRatio<=0.25);
    el.classList.toggle('hp-wounded',!u.defeated&&hpRatio>0.25&&hpRatio<=0.50);
    el.classList.toggle('current',battle?.state?.current?.id===u.id);
    el.classList.toggle('targetable',ui.mode==='target'&&(ui.targetSide==='both'||ui.targetSide===side)&&!u.defeated);
    el.classList.toggle('cv69-locked-target',tacticalTargetRef()?.unit?.id===u.id);
    const active=orderedVisualStatuses(u);const wanted=new Set(active.map(s=>`has-status-${statusMeta(s).cls}`));
    [...el.classList].filter(c=>c.startsWith('has-status-')&&!wanted.has(c)).forEach(c=>el.classList.remove(c));
    for(const c of wanted)el.classList.add(c);
    const statusSig=unitStatusSig(u);
    if(el.dataset.cv71StatusSig!==statusSig){
      el.dataset.cv71StatusSig=statusSig;
      const art=el.querySelector('.cv7-art-wrap');
      art?.querySelector('.cv7-status-vfx')?.remove();art?.querySelector('.cv7-cc-lock')?.remove();
      if(art){
        const html=`${statusVfxMarkup(u)}${ccLockMarkup(u,active)}`;
        const ring=art.querySelector('.cv7-ring');
        if(html){const tpl=document.createElement('template');tpl.innerHTML=html;ring?.before(tpl.content);}
      }
      updateMarkupInside(el.querySelector('.cv7-statuses'),statusChipsMarkup(u));
    }
  }

  function syncRoster(side,units){
    const container=side==='enemy'?mount?.querySelector('.cv7-enemies > div'):mount?.querySelector('.cv7-players > div:last-child');
    if(!container)return;
    const existing=[...container.children].filter(n=>n.matches?.('.cv7-unit'));
    for(let i=0;i<units.length;i++){
      const u=units[i];let el=existing[i];
      if(!el||el.dataset.cv7Unit!==String(u.id)){
        const neo=nodeFromMarkup(unitMarkup(u,side,i));
        if(el)el.replaceWith(neo);else container.appendChild(neo);
        el=neo;rendererV2.rosterReplacements++;
      }
      patchUnitPersistent(el,u,side,i);
    }
    for(let i=existing.length-1;i>=units.length;i--)existing[i]?.remove();
  }

  function syncReserves(){
    const box=mount?.querySelector('.cv7-reserves');if(!box||!battle)return;
    const markup=`<small>DỰ BỊ</small>${battle.state.reserves.map(u=>`<span data-cv71-reserve-id="${esc(u.id)}"><img src="${esc(combatAsset(u.asset))}" alt=""><b>${esc(u.name)}</b></span>`).join('')}`;
    updateMarkupInside(box,markup);
  }

  function syncBossBarPersistent(scene){
    const boss=battle?.state?.mode==='boss'?battle.state.enemies?.[0]:null;
    let bar=scene?.querySelector('.cv7-bossbar-v2');
    if(!boss){bar?.remove();return;}
    const struct=`${boss.id}|${boss.bossType}|${Number(boss.bossPhase||1)}|${Number(boss.shield)>0}`;
    if(!bar||bar.dataset.cv71BossStruct!==struct){
      const neo=nodeFromMarkup(bossBarMarkup(boss));if(!neo)return;
      neo.dataset.cv71BossStruct=struct;
      if(bar)bar.replaceWith(neo);else scene.querySelector('.cv7-top')?.after(neo);
      bar=neo;
    }
    patchBossVitals();
    syncRegion(bar,'.cv1861-boss-mechanic',bossMechanicHudMarkup(boss));
  }

  function applySceneState(scene){
    if(!scene||!battle)return;
    const s=battle.state,boss=s.mode==='boss'?s.enemies[0]:null,domain=s.tamer?.expansion;
    [...scene.classList].filter(c=>/^mode-|^phase-|^boss-phase-|^boss-type-|^domain-|^camera-|^hitstop-/.test(c)).forEach(c=>scene.classList.remove(c));
    scene.classList.add(`mode-${s.mode}`,`phase-${s.phase}`);
    if(boss){scene.classList.add(`boss-phase-${Number(boss.bossPhase||1)}`,`boss-type-${boss.bossType||s.bossType||'daily'}`);}
    if(domain)scene.classList.add('domain-active',`domain-${domain.id}`);
    if(ui.camera?.kind)scene.classList.add(`camera-${ui.camera.kind}`);
    if(ui.hitStop?.kind)scene.classList.add(`hitstop-${ui.hitStop.kind}`);
    scene.classList.toggle('cv8-action-active',Boolean(ui.attackMotion));
    scene.style.setProperty('--camera-age',`${-(ui.camera?effectAge(ui.camera):0)}ms`);
  }

  function encounterLabel(){
    const stage=ui.storyStage||{};
    if(stage.entrySource==='event'||stage.eventCombat===true)return 'SỰ KIỆN · CHIẾN ĐẤU';
    if(stage.entrySource==='boss'||stage.bossChallengeId)return 'BOSS · KHIÊU CHIẾN';
    if(stage.entrySource==='map'||Number(stage.islandId)>=1)return `MAP · ĐẢO ${Number(stage.islandId)||1} · MÀN ${Number(stage.number)||1}`;
    return 'CHIẾN ĐẤU';
  }

  function encounterTitle(){
    const stage=ui.storyStage||{};
    if(stage.name)return String(stage.name);
    const s=battle?.state,boss=s?.mode==='boss'?s.enemies?.[0]:null;
    return s?.mode==='boss'?`${boss?.name||'Boss'} · Pha ${boss?.bossPhase||1}`:'Đội Pow của bạn';
  }

  function patchTopPersistent(scene){
    const s=battle?.state;if(!scene||!s)return;
    const boss=s.mode==='boss'?s.enemies[0]:null,stage=scene.querySelector('.cv7-stage');
    if(stage){
      const small=stage.querySelector('small'),strong=stage.querySelector('b'),span=stage.querySelector('span');
      if(small)small.textContent=encounterLabel();
      if(strong)strong.textContent=encounterTitle();
      if(span)span.textContent=`Vòng ${s.round} · ${s.phase==='ready'?'Chuẩn bị':'Đang chiến đấu'}`;
    }
    const audioButton=scene.querySelector('[data-cv7-audio-menu]');if(audioButton){const a=CombatAudio?.getSettings?.()||{};audioButton.textContent=a.muted||a.globalSound===false?'🔇':'🔊';}
  }

  function patchDomainWorldPersistent(field){
    const bg=field?.querySelector('.cv7-battle-bg');if(!bg||!battle)return;
    const id=battle.state.tamer?.expansion?.id||'';
    if(bg.dataset.cv71DomainId===id){
      const world=bg.querySelector(':scope > .cv66-domain-world');
      if(world&&id&&ui.domainVisualStartedAt)world.style.setProperty('--domain-world-age',`${-Math.max(0,Math.round(effectNow()-ui.domainVisualStartedAt))}ms`);
      return;
    }
    bg.dataset.cv71DomainId=id;
    const old=bg.querySelector(':scope > .cv66-domain-world');old?.remove();
    if(id){const neo=nodeFromMarkup(domainWorldMarkup());if(neo)bg.prepend(neo);}
  }

  function patchCenterPersistent(field){
    const center=field?.querySelector('.cv7-center-mark');if(!center||!battle)return;
    const s=battle.state;
    const markup=s.phase==='ready'?`<span>3 <b>VS</b> ${s.mode==='boss'?'BOSS':'3'}</span><button data-cv7-launch>BẮT ĐẦU CHIẾN ĐẤU<small>Sân chiến đấu mới · hiệu ứng sát thương rõ ràng hơn</small></button>`:`<span class="cv7-round">ROUND ${s.round}</span>`;
    updateMarkupInside(center,markup);
  }

  function patchPersistentScene(){
    if(!mount||!battle)return;
    const t0=performance.now();
    const scene=mount.querySelector('.cv7-scene'),field=mount.querySelector('.cv7-field');if(!scene||!field){fullRenderScene();return;}
    applySceneState(scene);patchTopPersistent(scene);syncBossBarPersistent(scene);
    syncRegion(scene,'.cv7-audio-panel',audioPanelMarkup());syncRegion(scene,'.cv7-env-notice',combatEnvironmentNotice());
    patchDomainWorldPersistent(field);
    syncRoster('enemy',battle.state.enemies||[]);syncRoster('player',battle.state.team||[]);syncReserves();
    const enemyTitle=mount.querySelector('.cv7-enemies > h3');if(enemyTitle)enemyTitle.textContent=battle.state.mode==='boss'?'BOSS':'POW ĐỊCH';
    patchCenterPersistent(field);
    syncRegion(field,'.cv7-turn-order',turnOrder());syncRegion(field,'.cv7-log',battleLog());syncRegion(field,'.cv7-objective',objective());
    syncRegion(field,'.cv76-prebattle',preBattlePanelMarkup());
    syncRegion(field,'.cv69-tactical-hud',tacticalHudMarkup());syncRegion(field,'.cv7-domain-hud',domainHudMarkup());syncRegion(field,'.cv7-domain-cinematic',domainCinematicMarkup());
    syncRegion(field,'.cv7-tamer-command',tamerCommandMarkup());syncRegion(field,'.cv7-boss-intro',bossIntroMarkup());syncRegion(field,'.cv7-boss-phase-cine',bossPhaseCinematicMarkup());syncRegion(field,'.cv1861-boss-mechanic-notice',bossMechanicNoticeMarkup());
    syncRegion(field,'.cv7-boss-warning',bossWarningMarkup());syncRegion(field,'.cv7-boss-defeat',bossDefeatMarkup());syncRegion(field,'.cv114-form-cine',frostmawFormCinematicMarkup());
    syncRegion(field,'.cv7-command',commandDock());syncRegion(field,'.cv7-question',questionPanel());syncRegion(field,'.cv7-combo-choice',comboPanel());
    syncRegion(field,'.cv7-replacement',replacementPanel());syncRegion(field,'.cv7-result',resultPanel());
    patchFxLayer();patchAttackPresentationDom();
    rendererV2.patches++;rendererV2.lastPatchMs=performance.now()-t0;rendererV2.maxPatchMs=Math.max(rendererV2.maxPatchMs,rendererV2.lastPatchMs);
    rendererV2.patchSamples.push(rendererV2.lastPatchMs);if(rendererV2.patchSamples.length>240)rendererV2.patchSamples.shift();
  }

  function applyFxBudget(tier){
    if(!mount||framePacing.tier===tier)return;
    framePacing.tier=tier;mount.classList.remove('cv71-fx-high','cv71-fx-medium','cv71-fx-low');mount.classList.add(`cv71-fx-${tier}`);
    CombatAudio?.setPerformanceTier?.(tier);
  }

  function percentile(arr,p){
    if(!arr.length)return 16.67;
    const a=[...arr].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.max(0,Math.ceil(a.length*p)-1))];
  }

  function combatFpsVisible(){
    const view=qs('#battleView');
    return !document.hidden && !!mount && !!view && !view.hidden && !document.documentElement.classList.contains('learning-focus');
  }

  function fpsTick(ts){
    framePacing.raf=0;
    if(!combatFpsVisible()){
      framePacing.lastTs=0;framePacing.samples.length=0;framePacing.actionSamples.length=0;framePacing.evalCounter=0;return;
    }
    framePacing.raf=requestAnimationFrame(fpsTick);
    if(framePacing.lastTs){
      const d=ts-framePacing.lastTs;
      if(d>0&&d<1000){
        framePacing.samples.push(d);if(framePacing.samples.length>180)framePacing.samples.shift();
        if(attackDomLocked()||ui.attackMotion?.phase==='charge'){
          framePacing.actionSamples.push(d);if(framePacing.actionSamples.length>120)framePacing.actionSamples.shift();
        }
      }
      if(framePacing.samples.length>=30 && (++framePacing.evalCounter%30===0)){
        const avg=framePacing.samples.reduce((a,b)=>a+b,0)/framePacing.samples.length;
        framePacing.frameMs=avg;framePacing.fps=1000/avg;
        const sorted=[...framePacing.samples].sort((a,b)=>a-b),at=p=>sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))];
        framePacing.p95=at(.95);framePacing.p99=at(.99);framePacing.max=sorted[sorted.length-1];
        framePacing.jank=framePacing.samples.filter(x=>x>22).length;
        if(framePacing.actionSamples.length>=8){
          const actionSorted=[...framePacing.actionSamples].sort((a,b)=>a-b),aat=p=>actionSorted[Math.min(actionSorted.length-1,Math.max(0,Math.ceil(actionSorted.length*p)-1))];
          framePacing.actionP95=aat(.95);framePacing.actionP99=aat(.99);framePacing.actionMax=actionSorted[actionSorted.length-1];
        }
        const severe=framePacing.actionP99>34||framePacing.p99>40;
        const stressed=framePacing.actionP95>22||framePacing.p95>24;
        if(severe){framePacing.bad++;framePacing.medium=0;framePacing.good=0;}
        else if(stressed){framePacing.medium++;framePacing.bad=Math.max(0,framePacing.bad-1);framePacing.good=0;}
        else {framePacing.good++;framePacing.bad=Math.max(0,framePacing.bad-1);framePacing.medium=Math.max(0,framePacing.medium-1);}
        if(framePacing.bad>=2){applyFxBudget('low');framePacing.good=0;}
        else if(framePacing.medium>=3){applyFxBudget(framePacing.tier==='low'?'low':'medium');framePacing.good=0;}
        else if(framePacing.good>=8){applyFxBudget('high');framePacing.good=0;}
        else if(framePacing.good>=4 && framePacing.tier==='low'){applyFxBudget('medium');framePacing.good=0;}
      }
    }
    framePacing.lastTs=ts;
  }

  function syncFpsMonitor(){
    if(combatFpsVisible()){
      if(!framePacing.raf)framePacing.raf=requestAnimationFrame(fpsTick);
      return;
    }
    if(framePacing.raf){cancelAnimationFrame(framePacing.raf);framePacing.raf=0;}
    framePacing.lastTs=0;framePacing.samples.length=0;framePacing.actionSamples.length=0;framePacing.evalCounter=0;
  }

  function startFpsMonitor(){
    if(framePacing.started){syncFpsMonitor();return;}
    framePacing.started=true;
    const view=qs('#battleView');
    if(view&&window.MutationObserver)new MutationObserver(syncFpsMonitor).observe(view,{attributes:true,attributeFilter:['hidden']});
    document.addEventListener('visibilitychange',syncFpsMonitor,{passive:true});
    document.addEventListener('powder:learning-focus',syncFpsMonitor,{passive:true});
    syncFpsMonitor();
  }

  function performanceSnapshot(){
    const ps=[...rendererV2.patchSamples].sort((a,b)=>a-b),pat=p=>ps.length?ps[Math.min(ps.length-1,Math.max(0,Math.ceil(ps.length*p)-1))]:0;
    return {fps:Number(framePacing.fps.toFixed(1)),frameMs:Number(framePacing.frameMs.toFixed(2)),p95:Number(framePacing.p95.toFixed(2)),p99:Number(framePacing.p99.toFixed(2)),maxFrame:Number(framePacing.max.toFixed(2)),actionP95:Number(framePacing.actionP95.toFixed(2)),actionP99:Number(framePacing.actionP99.toFixed(2)),actionMax:Number(framePacing.actionMax.toFixed(2)),jankFrames:framePacing.jank,fxTier:framePacing.tier,fullRebuilds:rendererV2.fullRebuilds,patches:rendererV2.patches,actionPatches:rendererV2.actionPatches,rosterReplacements:rendererV2.rosterReplacements,lastPatchMs:Number(rendererV2.lastPatchMs.toFixed(3)),maxPatchMs:Number(rendererV2.maxPatchMs.toFixed(3)),patchP95:Number(pat(.95).toFixed(3)),patchP99:Number(pat(.99).toFixed(3)),vitalWrites:rendererV2.vitalWrites,vitalSkips:rendererV2.vitalSkips,fxNodesCreated:rendererV2.fxNodesCreated,fxNodesReused:rendererV2.fxNodesReused,fxTimerWakeups:rendererV2.fxTimerWakeups,expiryQueue:uiExpiryQueue.length,audio:CombatAudio?.performanceSnapshot?.()||null};
  }

  function combatEnvironmentNotice(){
    const appSettings=save()?.settings||{};
    const audio=CombatAudio?.getSettings?.()||{};
    const notices=[];
    if(ui.storyStage?.serverCombatSessionId)notices.push('<span class="server">🛡 SERVER AUTHORITY · HP, damage, kết quả và reward do máy chủ quyết định.</span>');
    const cc=ui.storyStage?.combatContent||window.POWDER_COMBAT_CONTENT_V1890?.stageContent?.(ui.storyStage);if(cc){const tags=[cc.eliteAffix?.name,cc.dungeonModifier?.name,cc.weather?.name,cc.bossModifier?.name].filter(Boolean);if(tags.length)notices.push(`<span>⚔ 18.9.0 · ${tags.map(esc).join(' · ')}</span>`);}if(ui.storyStage?.practiceNoReward)notices.push('<span>🧪 CHALLENGE/GAUNTLET · Không phát thưởng, không ghi tiến trình cốt truyện.</span>');
    if(appSettings.reducedMotion)notices.push('<span class="fx">⚠ Giảm chuyển động đang bật · Combat dùng chế độ FX tĩnh an toàn.</span>');
    if(appSettings.sound===false)notices.push('<span class="audio">🔇 Âm thanh tổng đang tắt trong Cài đặt Powder.</span>');
    else if(audio.muted)notices.push('<span class="audio">🔇 Combat Audio đang bị tắt.</span>');
    return notices.length?`<div class="cv7-env-notice">${notices.join('')}</div>`:'';
  }

  function audioPanelMarkup(){
    if(!ui.audioMenu||!CombatAudio)return '';
    const s=CombatAudio.getSettings?.()||{}; const globalOff=s.globalSound===false;
    const icon=s.muted||globalOff?'🔇':'🔊';
    return `<aside class="cv7-audio-panel"><header><div><small>COMBAT AUDIO</small><b>${icon} Âm thanh chiến đấu</b></div><button data-cv7-audio-close>×</button></header>
      ${globalOff?`<p class="cv7-audio-warning">Âm thanh tổng đang tắt trong Cài đặt Powder.</p>`:''}
      ${s.canonicalBgmPresent===false?`<p class="cv7-audio-warning"><b>⚠ KHÔNG TẢI ĐƯỢC NHẠC NỀN COMBAT CỦA BẠN</b><br>Nhạc Heroic cũ đã bị xóa hẳn và game sẽ không tự phát nhạc thay thế.</p>`:''}
      <label><span>SFX <b>${Math.round((Number(s.sfx)||0)*100)}%</b></span><input type="range" min="0" max="100" value="${Math.round((Number(s.sfx)||0)*100)}" data-cv7-audio-volume="sfx"></label>
      <label><span>Music <b>${Math.round((Number(s.music)||0)*100)}%</b></span><input type="range" min="0" max="100" value="${Math.round((Number(s.music)||0)*100)}" data-cv7-audio-volume="music"></label>
      <label><span>Thoại Bành Trướng <b>${Math.round((Number(s.domainVoice)??.52)*100)}%</b></span><input type="range" min="0" max="100" value="${Math.round((Number(s.domainVoice)??.52)*100)}" data-cv7-audio-volume="domainVoice"></label>
      <div class="cv7-audio-actions"><button data-cv7-audio-mute>${s.muted?'BẬT ÂM':'TẮT ÂM'}</button><button data-cv7-audio-music>${s.musicEnabled===false?'BẬT NHẠC':'TẮT NHẠC'}</button><button data-cv7-audio-bgm-test>NGHE THỬ NHẠC</button><button data-cv7-audio-test>NGHE THỬ HIỆU ỨNG</button><button data-cv7-audio-reset>KHÔI PHỤC ÂM</button></div>
      <div class="cv74-domain-voice-settings"><small>THOẠI LÃNH ĐỊA · 4 MẪU</small><div><button data-cv7-domain-voice-toggle>${s.domainVoiceEnabled===false?'BẬT THOẠI':'TẮT THOẠI'}</button><button data-cv7-domain-voice-profile="auto" class="${s.domainVoiceProfile==='auto'?'on':''}">AUTO 4 MẪU</button><button data-cv7-domain-voice-profile="sample1" class="${s.domainVoiceProfile==='sample1'?'on':''}">MẪU 1</button><button data-cv7-domain-voice-profile="sample2" class="${s.domainVoiceProfile==='sample2'?'on':''}">MẪU 2</button><button data-cv7-domain-voice-profile="sample3" class="${s.domainVoiceProfile==='sample3'?'on':''}">MẪU 3</button><button data-cv7-domain-voice-profile="sample4" class="${s.domainVoiceProfile==='sample4'?'on':''}">MẪU 4</button><button data-cv7-domain-voice-profile="alternate" class="${s.domainVoiceProfile==='alternate'?'on':''}">LUÂN PHIÊN</button><button data-cv7-domain-voice-test>▶ NGHE THỬ</button></div></div>
      <small class="cv7-audio-note">AUTO gán lần lượt Mẫu 1→Cuồng Chiến, 2→Thành Trì, 3→Thời Lưu, 4→Sinh Mệnh. Bốn đoạn dùng đúng file bạn tự cắt. Âm lượng thoại có thanh chỉnh riêng, mặc định 22% để không lấn nhạc nền. Chỉ dùng 4 file thoại bạn gửi, không dùng giọng AI/system.<br>Audio engine: <b>${esc(s.contextState||'chưa khởi tạo')}</b>.</small></aside>`;
  }

  function fullRenderScene(){
    if(!mount)return;
    if(!battle){mount.innerHTML='<div class="cv7-loading">Đang chuẩn bị Combat V7…</div>';return;}
    const s=battle.state; const boss=s.mode==='boss'?s.enemies[0]:null; const domain=s.tamer?.expansion;
    const cameraKind=ui.camera?.kind||''; const hitStopKind=ui.hitStop?.kind||''; const cameraAge=ui.camera?effectAge(ui.camera):0;
    mount.innerHTML=`<section class="cv7-scene mode-${s.mode} phase-${s.phase} ${boss?`boss-phase-${Number(boss.bossPhase||1)} boss-type-${esc(boss.bossType||s.bossType||'daily')}`:''} ${domain?`domain-active domain-${esc(domain.id)}`:''} ${cameraKind?`camera-${esc(cameraKind)}`:''} ${hitStopKind?`hitstop-${esc(hitStopKind)}`:''} ${ui.attackMotion?'cv8-action-active':''}" style="--camera-age:-${cameraAge}ms">
      <header class="cv7-top">${rankHud()}<div class="cv7-stage"><small>${esc(encounterLabel())}</small><b>${esc(encounterTitle())}</b><span>Vòng ${s.round} · ${s.phase==='ready'?'Chuẩn bị':'Đang chiến đấu'}</span></div><div class="cv7-top-actions"><button data-cv7-audio-menu title="Âm thanh chiến đấu">${(()=>{const a=CombatAudio?.getSettings?.()||{};return a.muted||a.globalSound===false?'🔇':'🔊';})()}</button><button data-cv7-fullscreen title="Toàn màn hình">⛶</button><button data-cv7-exit title="Thoát">↪</button></div></header>
      ${audioPanelMarkup()}${combatEnvironmentNotice()}
      ${bossBarMarkup(boss)}
      <div class="cv7-field">
        <div class="cv7-battle-bg">${domainWorldMarkup()}<div class="cv7-domain-atmosphere"></div><div class="cv7-ambient-particles"></div><div class="cv7-battle-vignette"></div><div class="cv7-arena-floor"></div><div class="cv7-arena-floor enemy"></div></div>
        ${turnOrder()}${battleLog()}${objective()}${preBattlePanelMarkup()}${tacticalHudMarkup()}${domainHudMarkup()}${domainCinematicMarkup()}${tamerCommandMarkup()}${bossIntroMarkup()}${bossPhaseCinematicMarkup()}${bossWarningMarkup()}${bossMechanicNoticeMarkup()}${bossDefeatMarkup()}${frostmawFormCinematicMarkup()}${cameraDirectorMarkup()}${cinematicMarkup()}${attackMotionMarkup()}${attackCalloutMarkup()}${fxMarkup()}
        <section class="cv7-enemies"><h3>${s.mode==='boss'?'BOSS':'POW ĐỊCH'}</h3><div>${s.enemies.map((u,i)=>unitMarkup(u,'enemy',i)).join('')}</div></section>
        <div class="cv7-center-mark">${s.phase==='ready'?`<span>${s.team.length} <b>VS</b> ${s.mode==='boss'?'BOSS':s.enemies.length}</span><button data-cv7-launch>BẮT ĐẦU CHIẾN ĐẤU<small>${ui.storyStage?`Phó bản ${esc(ui.storyStage.difficultyLabel||'')}${Number(ui.storyMastery)>=90?' · Ngữ Ấn cộng hưởng':''}`:'Chiến đấu theo tiến trình Map, Boss hoặc Sự kiện'}</small></button>`:`<span class="cv7-round">ROUND ${s.round}</span>`}</div>
        <section class="cv7-players"><div class="cv7-reserves"><small>DỰ BỊ</small>${s.reserves.map(u=>`<span><img src="${esc(combatAsset(u.asset))}" alt=""><b>${esc(u.name)}</b></span>`).join('')}</div><h3>ĐỘI POW CỦA BẠN</h3><div>${s.team.map((u,i)=>unitMarkup(u,'player',i)).join('')}</div></section>
        ${commandDock()}${questionPanel()}${comboPanel()}${replacementPanel()}${resultPanel()}
      </div>
    </section>`;
    rendererV2.battleSerial=serial;rendererV2.fullRebuilds++;
    mount.classList.add(`cv71-fx-${framePacing.tier}`);
  }

  function render(force=false){
    if(!mount)return;
    if(!battle){fullRenderScene();return;}
    if(force||rendererV2.battleSerial!==serial||!mount.querySelector('.cv7-scene')){fullRenderScene();return;}
    if(attackDomLocked()){rendererV2.actionPatches++;patchActionDom();return;}
    patchPersistentScene();
  }

  async function launch(){
    if(!battle||battle.state.phase!=='ready')return;
    if(CombatAudio){
      try{CombatAudio.unlock?.();CombatAudio.startMusic?.();}catch(_){}
    }
    try{await (ui.preloadPromise||preloadCombatAssets());}catch(_){}
    try{CombatAudio?.ensureMusicRunning?.();}catch(_){}
    if(battle.state.mode==='boss'){
      const boss=battle.state.enemies[0]; const el=element(boss.element); const max=bossMaxPhases(boss.bossType||battle.state.bossType);
      const intro={id:`boss-intro-${++fxSerial}`,name:boss.name,asset:boss.asset,element:fxElementClass(boss.element),elementIcon:el.icon,elementName:el.name||boss.element,role:boss.roleLabel,typeLabel:bossTypeLabel(boss.bossType||battle.state.bossType),maxPhases:max,startedAt:effectNow()};
      ui.bossIntro=intro; ui.mode='boss-intro'; CombatAudio?.bossIntro?.(boss,boss.bossType||battle.state.bossType); render();
      await sleep((boss.bossType||battle.state.bossType)==='weekly'?2750:2350); if(ui.bossIntro?.id===intro.id)ui.bossIntro=null; render(); await sleep(180);
    }
    battle.start(); consumeEvents(battle.drainEvents(),true); ui.mode='flow'; render();
    await sleep(360); advanceFlow();
  }

  async function advanceFlow(){
    const token=++flowToken;
    if(!battle)return;
    while(token===flowToken && battle && !battle.state.finished){
      if(battle.state.phase==='replacement'){ui.mode='replacement';render();return;}
      if(battle.state.phase!=='running')return;
      const step=battle.beginTurn(); consumeEvents(battle.drainEvents(),true); render();
      if(step.type==='none')return;
      if(step.type==='skip'){
        await sleep(380); if(token!==flowToken)return;
        if(battle.state.phase==='replacement'){ui.mode='replacement';render();return;}
        continue;
      }
      if(step.type==='player'){
        ui.mode='command';ui.selectedKey=null;ui.targetSide=null;render();return;
      }
      if(step.type==='enemy'){
        const serverSessionId=ui.storyStage?.serverCombatSessionId||'';
        if(serverSessionId){
          // 18.6.2 server action already resolves the enemy response atomically.
          // Never simulate a second local enemy action: only reconcile authoritative state.
          if(ui.serverCombatState)SC()?.syncCore?.(battle,ui.serverCombatState);
          rewardIfFinished();
          if(battle.state.finished){render();return;}
          if(battle.state.phase==='replacement'){ui.mode='replacement';render();return;}
          for(const x of battle.living?.('player')||[])x.meter=100;
          for(const x of battle.living?.('enemy')||[])x.meter=0;
          ui.mode='flow';render();
          await sleep(240);if(token!==flowToken)return;
          continue;
        }
        ui.mode='enemy';render();await sleep(760);if(token!==flowToken)return;
        const d=battle.enemyDecision(step.unit);
        const decisionEvents=battle.drainEvents(); if(decisionEvents.length){consumeEvents(decisionEvents,true);render();}
        const prep=await preCastTelegraph(step.unit,d.key,d.ability,d.targetId,d); if(token!==flowToken||prep?.canceled)return;
        await sleep(prep?.impactDelay||0); if(token!==flowToken)return;
        let enemyResult=null;
        try{enemyResult=battle.performAction(step.unit,d.key,d.targetId,{baseWrong:0,extraCorrect:0});}catch(e){console.error('[Combat V7 enemy action recovered]',e);}
        const actionEvents=battle.drainEvents();
        consumeEvents(actionEvents,true);patchActionDom();
        await sleep(prep?.settleDelay||0); if(token!==flowToken)return;
        clearAttackPresentation(step.unit.id); patchAttackPresentationDom();
        await holdActionBeat(enemyResult?.key||d.key,actionEvents);if(token!==flowToken)return;
        rewardIfFinished();
        if(battle.state.finished){render();return;}
        if(battle.state.phase==='replacement'){ui.mode='replacement';render();return;}
        continue;
      }
    }
    rewardIfFinished();render();
  }

  function selectSkill(key){
    const u=battle?.state.current;if(!u||u.side!=='player'||ui.mode!=='command')return;
    const serverSessionId=ui.storyStage?.serverCombatSessionId||'';
    if(serverSessionId){const gate=SC()?.canUse?.(ui.serverCombatState,u.powId,key);if(gate&&!gate.ok){addBanner(`SERVER · ${gate.reason}`,'warning',1500);render();return;}}
    const info=battle.actionInfo(u,key);if(!info.available)return;
    ui.selectedKey=key;
    const targets=battle.legalTargets(u,info.ability,key);
    if(info.area || info.ability.target==='self' || info.ability.target==='team' || info.ability.target==='allies'){
      beginQuestions(key,targets[0]?.id||u.id);return;
    }
    ui.mode='target'; ui.targetSide=info.ability.target==='enemy-or-ally'?'both':(info.support?'player':'enemy'); render();
  }

  function chooseTarget(id){
    if(ui.mode!=='target'||!battle?.state.current)return;
    const target=[...battle.state.team,...battle.state.enemies].find(u=>u.id===id&&!u.defeated);if(!target||(ui.targetSide!=='both'&&target.side!==ui.targetSide))return;
    beginQuestions(ui.selectedKey,target.id);
  }

  function randomQuestions(count){
    const context={stage:ui.storyStage||null,mode:ui.storyStage?'story':(battle?.state?.mode||'pve')};
    const source=app()?.getCombatQuestionPool?.(context);
    const pool=[...(Array.isArray(source)?source:[])];
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const out=[];while(out.length<count&&pool.length)out.push(pool[out.length%pool.length]);return out;
  }

  function beginQuestions(key,targetId){
    const u=battle.state.current, info=battle.actionInfo(u,key), plan=info.plan,questions=randomQuestions(plan.max);
    if(!questions.length){
      addBanner('Hoàn thành ít nhất 1 Learning Unit để sử dụng Combat kiến thức.','warning',2200);
      ui.mode='command';ui.selectedKey=null;ui.targetSide=null;render();return;
    }
    ui.question={key,targetId,base:plan.base,max:plan.max,questions,index:0,answered:0,baseWrong:0,extraCorrect:0,lastAnswer:null};
    ui.mode='question'; render();
  }

  function answer(index){
    const q=ui.question;if(ui.mode!=='question'||!q||q.lastAnswer)return;
    const item=q.questions[q.index], value=item.options[Number(index)], correct=value===item.answer;
    q.lastAnswer={value,correct};q.answered+=1;
    if(q.index<q.base){if(!correct)q.baseWrong+=1;}else if(correct)q.extraCorrect+=1;
    app()?.grantLearningProgress?.({powId:battle.state.current?.powId,correct,source:'combat',question:item});
    render();
    const token=flowToken;
    setTimeout(()=>{
      if(token!==flowToken||!ui.question)return;
      if(q.index<q.base-1){q.index+=1;q.lastAnswer=null;render();return;}
      if(q.index<q.base){
        if(q.baseWrong>0 || q.max===q.base){castPending();return;}
        q.index+=1; q.lastAnswer=null; ui.mode='combo'; render(); return;
      }
      if(!correct || q.index>=q.max-1){castPending();return;}
      q.index+=1;q.lastAnswer=null;ui.mode='combo';render();
    },correct?420:650);
  }

  function continueCombo(){
    const q=ui.question;if(ui.mode!=='combo'||!q)return;
    ui.mode='question';render();
  }

  async function castPending(){
    const q=ui.question, u=battle?.state.current;if(!q||!u)return;
    ui.mode='casting'; ui.question=null;
    const ability=battle.actionInfo(u,q.key)?.ability;
    const prep=await preCastTelegraph(u,q.key,ability,q.targetId);
    if(prep?.canceled)return;
    await sleep(prep?.impactDelay||0);
    let serverState=null,actionEvents=[],playerResult=null;
    const serverSessionId=ui.storyStage?.serverCombatSessionId||'';
    if(serverSessionId){
      const target=[...battle.state.team,...battle.state.reserves,...battle.state.enemies,...battle.state.enemyReserves].find(x=>x.id===q.targetId);
      const lastServerEventId=Number(ui.serverCombatLastEventId)||0;
      try{
        serverState=await SC()?.act?.(serverSessionId,u.powId,target?.powId||u.powId,q.key);if(!serverState)throw new Error('Server Combat không trả state.');
        ui.serverCombatState=serverState;SC()?.syncCore?.(battle,serverState);actionEvents=serverVisualEvents(serverState,lastServerEventId);ui.serverCombatLastEventId=SC()?.maxEventId?.(serverState)||lastServerEventId;
      }catch(e){console.error('[Server Combat 18.6.2 action rejected]',e);addBanner(e?.message||'Server từ chối hành động Combat.','warning',2600);ui.mode='command';ui.selectedKey=null;ui.targetSide=null;render();return;}
      consumeEvents(actionEvents,true);patchActionDom();
    }else{
      try{playerResult=battle.performAction(u,q.key,q.targetId,{baseWrong:q.baseWrong,extraCorrect:q.extraCorrect});}catch(e){console.error('[Combat V7 player action recovered]',e);}
      actionEvents=battle.drainEvents();consumeEvents(actionEvents,true);patchActionDom();
    }
    await sleep(prep?.settleDelay||0);
    clearAttackPresentation(u.id); patchAttackPresentationDom();
    await holdActionBeat(playerResult?.key||q.key,actionEvents);
    rewardIfFinished();
    if(battle.state.finished){render();return;}
    if(serverSessionId){for(const x of battle.living?.('player')||[])x.meter=100;for(const x of battle.living?.('enemy')||[])x.meter=0;battle.state.current=null;battle.state.phase='running';}
    if(battle.state.phase==='replacement'){ui.mode='replacement';render();return;}
    ui.mode='flow';advanceFlow();
  }

  function replaceReserve(id){
    if(!battle||battle.state.phase!=='replacement')return;
    const slot=battle.state.replacementQueue[0];if(battle.replace(slot,id)){
      consumeEvents(battle.drainEvents(),true);render();
      if(battle.state.phase==='running'){ui.mode='flow';setTimeout(advanceFlow,250);}
    }
  }

  function rewardIfFinished(){
    const serverSessionId=ui.storyStage?.serverCombatSessionId||'';
    if(serverSessionId){const ss=ui.serverCombatState||SC()?.cached?.(serverSessionId);if(!ss||ss.status==='active'){if(battle?.state.finished&&ss)SC()?.syncCore?.(battle,ss);return;}ui.serverCombatState=ss;SC()?.syncCore?.(battle,ss);if(ui.storyStage)ui.storyStage.serverCombatState=ss;}
    if(!battle?.state.finished||ui.reward)return;
    const win=serverSessionId?(ui.serverCombatState?.status==='win'):(battle.state.result==='win');
    const challengeId=ui.storyStage?.bossChallengeId||null;
    const isEvent=ui.storyStage?.entrySource==='event'||ui.storyStage?.eventCombat===true;
    if(challengeId){
      const bossResult=app()?.onBossCombatFinished?.({id:challengeId,win,stage:JSON.parse(JSON.stringify(ui.storyStage||{})),summary:combatSummary()})||{};
      ui.reward={coins:Number(bossResult.reward?.coins)||0,exp:0,bossPoints:Number(bossResult.reward?.bossPoints)||0,sameRankChests:Number(bossResult.reward?.sameRankChests)||0,higherRankChests:Number(bossResult.reward?.higherRankChests)||0,artifactTickets:Number(bossResult.reward?.artifactTickets)||0,bossMessage:bossResult.message||''};
    }else if(isEvent){
      ui.reward={coins:0,exp:0,eventControlled:true,serverVerified:!!serverSessionId};
      try{window.dispatchEvent(new CustomEvent('powder:event-combat-finished',{detail:{eventId:ui.storyStage?.eventId||'',win,stage:JSON.parse(JSON.stringify(ui.storyStage||{})),summary:combatSummary(),serverVerified:!!serverSessionId}}));}catch(e){console.warn('[Event combat result hook]',e);}
    }else if(win){
      if(ui.storyStage?.practiceNoReward)ui.reward={coins:0,exp:0,practice:true};
      else{const base=ui.storyStage?{coins:Number(ui.storyStage.rewards?.coins)||180,exp:Number(ui.storyStage.rewards?.exp)||35}:(battle.state.mode==='boss'?{coins:500,exp:80}:{coins:180,exp:35});ui.reward=app()?.grantBattleRewards?.({...base,wins:1})||base;}
    }else ui.reward={coins:0,exp:0};
    ui.mode='finished';
    if(ui.storyStage&&!ui.storyStage.practiceNoReward&&!challengeId&&!isEvent&&!ui.storyStageResultSent){
      ui.storyStageResultSent=true;
      try{window.POWDER_ADVENTURE?.onBattleFinished?.({stage:JSON.parse(JSON.stringify(ui.storyStage)),win,summary:combatSummary(),reward:ui.reward});}catch(e){console.warn('[Adventure result hook]',e);}
    }
  }

  async function useTamerSimple(kind){
    if(!battle?.useTamerSimple?.(kind))return;
    ui.tamerMenu=null; const events=battle.drainEvents(); consumeEvents(events,true); render();
    await holdActionBeat('basic',events);
  }

  async function expandTamerDomain(id){
    if(!battle?.expandDomain?.(id))return;
    ui.tamerMenu=null; const events=battle.drainEvents(); consumeEvents(events,true); render();
    await holdActionBeat('exclusive',events);
  }

  function forfeitBattle(reason='navigation'){
    if(!battle||battle.state.finished)return false;
    const serverSessionId=ui.storyStage?.serverCombatSessionId||'';
    if(serverSessionId)SC()?.forfeit?.(serverSessionId).then(ss=>{ui.serverCombatState=ss;}).catch(e=>console.warn('[Server Combat forfeit]',e));
    flowToken+=1; resetUiExpiryScheduler();
    if(renderFrame){cancelAnimationFrame(renderFrame);renderFrame=0;}
    for(const [key,anim] of [...compositorAnimations]){try{anim.cancel();}catch(_){}compositorAnimations.delete(key);}
    if(framePacing.raf){cancelAnimationFrame(framePacing.raf);framePacing.raf=0;}
    battle.state.finished=true;
    battle.state.phase='finished';
    battle.state.result='loss';
    battle.state.current=null;
    battle.state.replacementQueue.length=0;
    battle.state.enemyReplacementQueue.length=0;
    battle.state.replacementSide=null;
    battle.pushLog?.('ĐÃ RÚT LUI KHỎI TRẬN.','danger');
    battle.pushEvent?.('battle-end',{result:'loss',reason:String(reason||'navigation'),forfeit:true});
    CombatAudio?.stopDomainVoice?.();
    CombatAudio?.stopMusic?.();
    rewardIfFinished();
    document.documentElement.classList.remove('combat-v7-session');
    return true;
  }

  function getExitCost(){ return 0; }

  function toggleTamerMenu(menu){
    ui.tamerMenu=ui.tamerMenu===menu?null:menu; render();
  }

  function toggleFullscreen(){
    const root=document.documentElement;
    if(!document.fullscreenElement)root.requestFullscreen?.({navigationUI:'hide'}).catch(()=>{});
    else document.exitFullscreen?.().catch(()=>{});
  }

  function handleClick(e){
    const b=e.target.closest('button');if(!b)return;
    if(b.matches('[data-cv7-launch]'))return launch();
    if(b.matches('[data-cv7-audio-menu]')){ui.audioMenu=!ui.audioMenu;CombatAudio?.unlock?.();CombatAudio?.ui?.('open');render();return;}
    if(b.matches('[data-cv7-audio-close]')){ui.audioMenu=false;CombatAudio?.ui?.('click');render();return;}
    if(b.matches('[data-cv7-audio-mute]')){CombatAudio?.toggleMute?.();render();return;}
    if(b.matches('[data-cv7-audio-music]')){const s=CombatAudio?.getSettings?.()||{};CombatAudio?.setMusicEnabled?.(s.musicEnabled===false);render();return;}
    if(b.matches('[data-cv7-audio-bgm-test]')){CombatAudio?.unlock?.();CombatAudio?.setMusicEnabled?.(true);CombatAudio?.startMusic?.();render();return;}
    if(b.matches('[data-cv7-audio-test]')){CombatAudio?.unlock?.();CombatAudio?.ui?.('confirm');CombatAudio?.impact?.({crit:true,element:'lightning',amount:999,strong:true});return;}
    if(b.matches('[data-cv7-audio-reset]')){CombatAudio?.resetSettings?.();CombatAudio?.unlock?.();render();return;}
    if(b.matches('[data-cv7-domain-voice-toggle]')){const s=CombatAudio?.getSettings?.()||{};CombatAudio?.setDomainVoiceEnabled?.(s.domainVoiceEnabled===false);render();return;}
    if(b.dataset.cv7DomainVoiceProfile){CombatAudio?.setDomainVoiceProfile?.(b.dataset.cv7DomainVoiceProfile);render();return;}
    if(b.matches('[data-cv7-domain-voice-test]')){CombatAudio?.speakJapaneseDomain?.('timeflow');return;}
    if(b.matches('[data-cv79-log-toggle]')){ui.logOpen=!ui.logOpen;CombatAudio?.ui?.('click');render();return;}
    if(b.dataset.cv79LogFilter){ui.logFilter=b.dataset.cv79LogFilter;ui.logOpen=true;CombatAudio?.ui?.('click');render();return;}
    if(b.matches('[data-cv177-event-hub]')){CombatAudio?.stopMusic?.();app()?.showView?.('home');setTimeout(()=>document.querySelector('#event167Panel')?.scrollIntoView?.({behavior:'smooth',block:'center'}),120);return;}
    if(b.matches('[data-cv81-story-map]')){CombatAudio?.stopMusic?.();app()?.showView?.('adventure');return;}
    if(b.matches('[data-cv923-boss-hub]')){CombatAudio?.stopMusic?.();app()?.showView?.('boss');return;}
    if(b.matches('[data-cv81-story-next]')){CombatAudio?.stopMusic?.();window.POWDER_ADVENTURE?.openNextStage?.(ui.storyStage?.id);app()?.showView?.('adventure');return;}
    if(b.matches('[data-cv81-story-retry]')){return prepareStory(ui.storyStage);}
    if(b.dataset.cv7TamerMenu)return toggleTamerMenu(b.dataset.cv7TamerMenu);
    if(b.dataset.cv7TamerSimple)return useTamerSimple(b.dataset.cv7TamerSimple);
    if(b.dataset.cv7Domain)return expandTamerDomain(b.dataset.cv7Domain);
    if(b.dataset.cv76FormationUnit)return swapReadyFormation(b.dataset.cv76FormationUnit);
    if(b.dataset.cv7Skill)return selectSkill(b.dataset.cv7Skill);
    if(b.dataset.cv7Unit)return chooseTarget(b.dataset.cv7Unit);
    if(b.dataset.cv7Answer!=null)return answer(b.dataset.cv7Answer);
    if(b.matches('[data-cv7-combo]'))return continueCombo();
    if(b.matches('[data-cv7-cast]'))return castPending();
    if(b.dataset.cv7Reserve)return replaceReserve(b.dataset.cv7Reserve);
    if(b.matches('[data-cv7-cancel]')){ui.mode='command';ui.selectedKey=null;ui.targetSide=null;render();return;}
    if(b.matches('[data-cv7-fullscreen]'))return toggleFullscreen();
    if(b.matches('[data-cv7-home]')||b.matches('[data-cv7-exit]')){CombatAudio?.stopMusic?.();if(document.fullscreenElement)document.exitFullscreen?.();app()?.showView?.('home');return;}
  }

  function handleInput(e){
    const input=e.target.closest?.('[data-cv7-audio-volume]');if(!input||!CombatAudio)return;
    CombatAudio.setVolume?.(input.dataset.cv7AudioVolume,Number(input.value)/100);
    const label=input.closest('label')?.querySelector('span b');if(label)label.textContent=`${Math.round(Number(input.value)||0)}%`;
  }

  function install(){
    if(mounted)return;
    const view=qs('#battleView');if(!view||!window.POWDER_APP){setTimeout(install,60);return;}
    view.innerHTML='<div id="combatV7Mount" class="combat-v7-mount"></div>';
    mount=qs('#combatV7Mount',view);mount.addEventListener('pointerdown',()=>{CombatAudio?.unlock?.();const st=CombatAudio?.getSettings?.()||{};if(battle&&battle.state.phase!=='ready'&&st.musicEnabled!==false)CombatAudio?.ensureMusicRunning?.();},{passive:true});mount.addEventListener('click',handleClick);mount.addEventListener('input',handleInput);
    document.addEventListener('fullscreenchange',()=>document.documentElement.classList.toggle('powder-combat-fullscreen',Boolean(document.fullscreenElement)));
    mounted=true;startFpsMonitor();
    function validEntry(stage,source){
      if(!stage||typeof stage!=='object')return false;
      if(source==='map')return Number(stage.islandId)>=1&&Boolean(stage.id);
      if(source==='boss')return Boolean(stage.bossChallengeId)&&stage.kind==='boss';
      if(source==='event')return stage.eventCombat===true&&Boolean(stage.eventId);
      return false;
    }
    const api={
      version:'18.6.2-server-combat-authority',
      startEncounter:(stage,source)=>{if(!validEntry(stage,source)){console.warn('[Powder Combat] blocked non-canonical entry',source);return false;}app()?.showView?.('battle');prepareStory({...stage,entrySource:source});return true;},
      launch,
      isActive:()=>Boolean(battle&&!battle.state.finished&&battle.state.phase!=='ready'),
      getState:()=>battle?.state||null,
      getCore:()=>battle,
      getPerformance:performanceSnapshot,
      forfeit:forfeitBattle,
      getExitCost
    };
    window.POWDER_BATTLE_PLAYER_V177=Object.freeze(api);
    console.info('[Powder Combat 18.6.2] Server Combat Authority ready · server action/state/winner bridge · entries: map/boss/event');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
