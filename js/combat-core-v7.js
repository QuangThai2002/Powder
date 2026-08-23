(function(){
  'use strict';

  const D = window.POWDER_DATA;
  const E = window.POWDER_ENGINE;
  const BR = window.POWDER_COMBAT_BUFF_V164;
  if (!D || !E) throw new Error('Combat 24.0 requires POWDER_DATA and POWDER_ENGINE.');

  const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
  const clone = v=>JSON.parse(JSON.stringify(v));

  // 19.6 · deterministic battle RNG for PvP hardening + replay reproducibility.
  function seededRng(seed=1){
    let a=(Number(seed)>>>0)||0x6d2b79f5;
    return function(){
      a=(a+0x6D2B79F5)>>>0;
      let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function stableUnitCompare(core,a,b){
    const meter=(Number(b?.meter)||0)-(Number(a?.meter)||0);if(Math.abs(meter)>1e-9)return meter;
    const speed=(Number(core?.effective?.(b)?.speed)||0)-(Number(core?.effective?.(a)?.speed)||0);if(Math.abs(speed)>1e-9)return speed;
    return String(a?.id||'').localeCompare(String(b?.id||''));
  }
  function compactReplayEvent(evt){
    const keep=['type','seq','at','round','turn','sourceId','unitId','targetId','side','key','ability','status','label','name','id','expansionId','result','reason','message','amount','total','damage','heal','shield','chance','attempt','phase','from','maxPhase','bossId','bossType','remainingActions','remainingRounds','delta','before','after','max','spent','resourceName','simultaneousKO','extraCorrect','baseWrong','scale','effectScale','coreScale','interactionId','detail','cadence','signatureId','description','shieldBroken','totalDamage','remaining','bonusDamage','bonusShield','critical','personalityId','personalityLabel','intent','patternId','confidence','aiTier','targetRule','mechanicId','response','responseLabel','outcome','window','barrier','progress','remainingShield','interrupted','cleansed','enraged','meterLoss','rageLoss','ratio'];
    const out={};for(const k of keep)if(evt?.[k]!==undefined){const v=evt[k];if(k==='result'&&v&&typeof v==='object')out.result={damage:Number(v.damage)||0,heal:Number(v.heal)||0,shield:Number(v.shield)||0};else if(v==null||['string','number','boolean'].includes(typeof v))out[k]=v;}
    if(Array.isArray(evt?.targetIds))out.targetIds=evt.targetIds.map(String).slice(0,8);
    if(Array.isArray(evt?.statuses))out.statuses=evt.statuses.map(String).slice(0,8);
    if(Array.isArray(evt?.impacts))out.impacts=evt.impacts.slice(0,8).map(i=>({targetId:i?.targetId||null,damage:Number(i?.damage)||0,absorbed:Number(i?.absorbed)||0,crit:Boolean(i?.crit),evaded:Boolean(i?.evaded),killed:Boolean(i?.killed)}));
    return out;
  }

  // 20.6 · PvP Rule Set V2. Standalone build uses a local recovery packet; production server can persist the same shape.
  const PVP_RULES=Object.freeze({turnSeconds:45,afkStrikesToForfeit:3,reconnectGraceSeconds:90,maxRounds:60});
  function safeClone(v,fallback=null){try{return clone(v);}catch(_){return fallback;}}
  function packInitialEntry(entry){return{powId:entry?.pow?.id||entry?.powId||null,owned:safeClone(entry?.owned||{},{}),scale:Number(entry?.scale)||1,boss:Boolean(entry?.boss),bossType:entry?.bossType||null};}
  function reviveInitialEntry(row){const pow=powById(row?.powId);return pow?{pow,owned:safeClone(row?.owned||{},{}),scale:Number(row?.scale)||1,boss:Boolean(row?.boss),bossType:row?.bossType||null}:null;}
  function packRuntimeUnit(u){
    const resources=u?.resources instanceof Map?[...u.resources.entries()].map(([k,v])=>[k,safeClone(v,{})]):[];
    return{id:u.id,hp:Number(u.hp)||0,maxHp:Number(u.maxHp)||1,shield:Number(u.shield)||0,mana:Number(u.mana)||0,maxMana:Number(u.maxMana)||0,rage:Number(u.rage)||0,meter:Number(u.meter)||0,combo:Number(u.combo)||0,defeated:Boolean(u.defeated),turnsTaken:Number(u.turnsTaken)||0,isReserve:Boolean(u.isReserve),teamIndex:Number(u.teamIndex)||0,exclusiveUsed:Boolean(u.exclusiveUsed),coreReady:Boolean(u.coreReady),coreReadyAt:Number(u.coreReadyAt)||0,statuses:safeClone(u.statuses||{},{}),customStatuses:safeClone(u.customStatuses||{},{}),buffs:safeClone(u.buffs||[],[]),stats:safeClone(u.stats||{},{}),coreRuntime:safeClone(u.coreRuntime||{},{}),v9:safeClone(u.v9||{},{}),resources,boss:Boolean(u.boss),bossType:u.bossType||null,bossPhase:Number(u.bossPhase)||1,bossMaxPhase:Number(u.bossMaxPhase)||1,bossSigCounter:Number(u.bossSigCounter)||0,bossSigRemaining:Number(u.bossSigRemaining)||0,aiTier:u.aiTier||'standard',aiDecisionCount:Number(u.aiDecisionCount)||0,asset:u.asset||null,combatForm:u.combatForm||null};
  }
  function restoreRuntimeUnit(u,row){if(!u||!row)return;for(const k of ['hp','maxHp','shield','mana','maxMana','rage','meter','combo','turnsTaken','teamIndex','coreReadyAt','bossPhase','bossMaxPhase','bossSigCounter','bossSigRemaining','aiDecisionCount'])if(Number.isFinite(Number(row[k])))u[k]=Number(row[k]);for(const k of ['defeated','isReserve','exclusiveUsed','coreReady','boss'])if(row[k]!==undefined)u[k]=Boolean(row[k]);for(const k of ['bossType','aiTier','asset','combatForm'])if(row[k]!==undefined)u[k]=row[k];u.statuses=safeClone(row.statuses||{},{});u.customStatuses=safeClone(row.customStatuses||{},{});u.buffs=safeClone(row.buffs||[],[]);u.stats=safeClone(row.stats||u.stats||{},u.stats||{});u.coreRuntime=safeClone(row.coreRuntime||{},{});u.v9=safeClone(row.v9||{},{});if(u.resources instanceof Map){u.resources.clear();for(const [k,v] of row.resources||[])u.resources.set(k,safeClone(v,{}));}}

  const ROLE = Object.freeze({
    tank:      { label:'Đỡ đòn',   presence:100, guard:70 },
    knight:    { label:'Hiệp sĩ',  presence:68,  guard:25 },
    fighter:   { label:'Đấu sĩ',   presence:58,  guard:18 },
    enchanter: { label:'Thuật sư', presence:42,  guard:10 },
    musician:  { label:'Nhạc công', presence:42,  guard:10 },
    healer:    { label:'Trị liệu', presence:22,  guard:0  },
    mage:      { label:'Pháp sư',  presence:18,  guard:0  },
    marksman:  { label:'Xạ thủ',   presence:16,  guard:0  },
    assassin:  { label:'Sát thủ',  presence:12,  guard:0  }
  });

  const VALID_ACTION_KEYS = new Set(['basic','skill1','skill2','ultimate','exclusive']);
  const BENEFICIAL = new Set(['Defense Up','Attack Up','AP Up','Shield','Regeneration','Speed Up','Cleanse','Effect Resist','Guard']);
  const HARD_CC = new Set(['Stun','Freeze','Petrify','Sleep']);
  const AREA_TARGETS = new Set(['all','all-enemies','team','allies','two-enemies','two-allies','three-allies','front-row','back-row']);
  // Combat V7 pacing: the legacy engine returned raw stat-scaled damage that was tuned for much smaller HP pools.
  // This scalar is applied only inside V7 so a normal 3+2 PvE battle resolves in meaningful turns instead of hundreds.
  // Core V2 uses natural durability (HP/DEF/Crit Resist/Evasion) instead of per-skill hard caps.
  const DAMAGE_PACING = 1.55;

  // 21.9.6 · Rage pacing V2. Ultimate should become part of normal combat flow,
  // not something a Pow sees only after many personal turns. Kept centralized so
  // all 99 Pow follow the same readable rule unless a canonical skill explicitly changes Rage.
  const RAGE_PACING = Object.freeze({start:30,onBasic:32,onSkill:26,onUltimate:12,onExclusive:10,onHitTaken:15});
  function actionRageGain(key){return key==='basic'?RAGE_PACING.onBasic:key==='ultimate'?RAGE_PACING.onUltimate:key==='exclusive'?RAGE_PACING.onExclusive:RAGE_PACING.onSkill;}

  // 23.9.1 · Rarity Mana pacing. Skill costs remain canonical; recovery now scales by Pow rarity.
  const MANA_RARITY_REGEN = Object.freeze({
    common:Object.freeze({turnStart:4,basic:8}),
    rare:Object.freeze({turnStart:5,basic:10}),
    super_rare:Object.freeze({turnStart:6,basic:12}),
    epic:Object.freeze({turnStart:7,basic:14}),
    legendary:Object.freeze({turnStart:8,basic:16}),
    mythic:Object.freeze({turnStart:9,basic:18}),
    ancient:Object.freeze({turnStart:10,basic:20})
  });
  const MANA_PACING = Object.freeze({startRatio:.68,kill:30,rarity:MANA_RARITY_REGEN});
  function manaRarityKey(unit){
    const raw=String(unit?.rarity||'common').toLowerCase().trim().replace(/[\s-]+/g,'_');
    const alias={thuong:'common','thường':'common',hiem:'rare','hiếm':'rare',sieu_hiem:'super_rare','siêu_hiếm':'super_rare','siêu hiếm':'super_rare',su_thi:'epic','sử_thi':'epic','sử thi':'epic',huyen_thoai:'legendary','huyền_thoại':'legendary','huyền thoại':'legendary',than_thoai:'mythic','thần_thoại':'mythic','thần thoại':'mythic',thuong_co:'ancient','thượng_cổ':'ancient','thượng cổ':'ancient'};
    return MANA_RARITY_REGEN[raw]?raw:(alias[raw]||'common');
  }
  function manaPacingFor(unit){
    const rarity=manaRarityKey(unit),row=MANA_RARITY_REGEN[rarity]||MANA_RARITY_REGEN.common;
    return {rarity,turnStart:row.turnStart,basic:row.basic,kill:MANA_PACING.kill,startRatio:MANA_PACING.startRatio};
  }

  const TAMER_SIMPLE = Object.freeze({
    assault:{id:'assault',name:'Cường Công',description:'Hành động tấn công kế tiếp của Pow phe bạn gây +25% sát thương.',outgoing:1.25},
    guard:{id:'guard',name:'Kiên Thủ',description:'Hành động tấn công kế tiếp của địch gây -30% sát thương.',incoming:0.70}
  });

  const TAMER_EXPANSIONS = Object.freeze({
    frenzy:{id:'frenzy',name:'Lãnh Địa Cuồng Chiến',short:'CUỒNG CHIẾN',description:'Trong 5 hiệp, sát thương Pow phe bạn +35%.',outgoing:1.35},
    fortress:{id:'fortress',name:'Lãnh Địa Thành Trì',short:'THÀNH TRÌ',description:'Trong 5 hiệp, sát thương phe bạn nhận -30%.',incoming:0.70},
    timeflow:{id:'timeflow',name:'Lãnh Địa Thời Lưu',short:'THỜI LƯU',description:'Trong 5 hiệp, SPEED Pow phe bạn +30%.',speed:1.30},
    vitality:{id:'vitality',name:'Lãnh Địa Sinh Mệnh',short:'SINH MỆNH',description:'Trong 5 hiệp, lượng hồi máu phe bạn +45%.',healing:1.45}
  });

  const STATUS_MAP = Object.freeze({
    'Paralysis':'Slow',
    'Frostbite':'Freeze',
    'Magma Burn':'Burn',
    'Bind':'Stun'
  });

  function powById(id){ return D.pows.find(p=>p.id===id) || null; }
  function rarityRank(id){ return ['common','rare','super_rare','epic','legendary','mythic','ancient'].indexOf(id); }
  function roleOf(pow){
    const key = pow?.combatRole || pow?.roleTags?.[0] || 'marksman';
    return ROLE[key] ? key : 'marksman';
  }
  function roleProfile(key){ return ROLE[key] || ROLE.marksman; }
  function isHardControlled(unit){
    if (!unit || unit.defeated) return true;
    return [...HARD_CC].some(s=>Boolean(unit.statuses?.[s] || unit.customStatuses?.[s]));
  }
  function isArea(ability){ return Boolean(ability?.area || AREA_TARGETS.has(ability?.target)); }
  function isSupport(ability){
    if (!ability) return false;
    if (['ally','self','team','allies','two-allies','three-allies','self-and-ally','self-and-lowest-ally'].includes(ability.target)) return true;
    if (ability.type === 'support' && !['enemy','all','all-enemies','enemy-or-ally'].includes(ability.target)) return true;
    return BENEFICIAL.has(ability.status) && ability.target !== 'enemy';
  }
  function bypassGuard(unit, ability, key){
    if (!ability) return false;
    if (ability.pierceGuard || ability.bypassGuard) return true;
    // Legacy assassin skills marked as bypassing the old front line become Xuyên bảo hộ.
    if (unit?.combatRole === 'assassin' && key !== 'basic' && (ability.bypassFront || ability.targetRule === 'backline' || ability.targetRule === 'any')) return true;
    return false;
  }

  function maxManaFor(pow, stats){
    const abilities=[E.abilityFor(pow,'basic'),E.abilityFor(pow,'skill1'),E.abilityFor(pow,'skill2'),E.abilityFor(pow,'ultimate'),pow.exclusiveSkill].filter(Boolean);
    const magical = abilities.filter(a=>a.type==='magic' || a.type==='support' || a.type==='ultimate' || a.type==='exclusive').length;
    const apRatio = (stats?.ap||1)/Math.max(1,stats?.atk||1);
    return clamp(Math.round(78 + magical*7 + clamp(apRatio,0.6,2.2)*12),80,135);
  }

  function manaCost(ability,key){
    // Basic is the universal fallback action: it must NEVER consume Mana.
    // Keep this check before reading data-level manaCost so malformed/legacy data
    // cannot soft-lock a Pow when its Mana reaches 0.
    if (key === 'basic') return 0;
    if (Number.isFinite(Number(ability?.manaCost))) return Math.max(0,Number(ability.manaCost));
    if (key === 'ultimate') return ability?.type === 'physical' ? 12 : 22;
    if (key === 'exclusive') return ability?.type === 'physical' ? 22 : 34;
    if (ability?.type === 'physical') return key === 'skill2' ? 12 : 8;
    return key === 'skill2' ? 24 : 20;
  }

  function questionPlan(key){
    if (key === 'basic') return { base:1, max:1 };
    if (key === 'ultimate') return { base:2, max:5 };
    if (key === 'exclusive') return { base:2, max:4 };
    return { base:2, max:3 };
  }

  function knowledgeScale(baseWrong, extraCorrect){
    let scale = baseWrong <= 0 ? 1 : baseWrong === 1 ? 0.70 : 0.20;
    if (baseWrong === 0) scale += clamp(extraCorrect,0,3) * 0.12;
    return clamp(scale,0.20,1.36);
  }

  function knowledgeEffectScale(baseWrong, extraCorrect){
    let scale = baseWrong <= 0 ? 1 : baseWrong === 1 ? 0.70 : 0.20;
    if (baseWrong === 0) scale += clamp(extraCorrect,0,3) * 0.10;
    return clamp(scale,0.20,1.30);
  }

  // Deprecated compatibility export. Core V2 intentionally does NOT use a normal hard damage cap.
  const PVP_DIRECT_CAP = Object.freeze({ basic:Infinity, skill1:Infinity, skill2:Infinity, ultimate:Infinity, exclusive:Infinity });
  function pvpDirectCap(){ return Infinity; }
  function hasDamageSetup(attacker,target,key,knowledgeMultiplier,domain,simple){
    if(key==='exclusive')return true;
    if(Number(attacker?.combo||0)>0 || Number(knowledgeMultiplier||1)>1)return true;
    if(domain || simple?.kind==='assault')return true;
    const custom=target?.customStatuses||{}, statuses=target?.statuses||{};
    if(custom['Hunt Mark']||custom['Aim Mark'])return true;
    if(Object.keys(statuses).some(x=>/Defense Down|DEF Down|Mark|Curse|Vulnerability/i.test(x)))return true;
    return false;
  }
  function roundOneSafety(core,attacker,target,key,ability,amount,knowledgeMultiplier,domain,simple){
    if(!core||core.state.round>1||!target||target.hp/Math.max(1,target.maxHp)<=.80)return amount;
    if(hasDamageSetup(attacker,target,key,knowledgeMultiplier,domain,simple))return amount;
    // Lightweight coefficient-error safeguard only. A normal action from >80% HP
    // cannot delete more than 85% Max HP on Round 1 without setup.
    return Math.min(amount,Math.round(target.maxHp*.85));
  }

  function createUnit(entry, side, index, serial, scale=1){
    const pow=entry.pow;
    const owned=entry.owned || {level:1,stars:0,shiny:false};
    const unit=E.createCombatant(pow,owned,{ id:`v7-${serial}-${side}-${index}-${pow.id}`, teamIndex:index, scale });
    const role=roleOf(pow), profile=roleProfile(role);
    unit.side=side;
    unit.powId=pow.id;
    // createCombatant already resolves star-based evolution form; do not overwrite it with base art.
    unit.asset=unit.asset || pow.asset;
    if(pow.id==='frostmaw' && pow.combatForms){
      const defaultForm=pow.combatDefaultForm||'peng', form=pow.combatForms[defaultForm]||pow.combatForms.peng||pow.combatForms.kun;
      unit.combatForm=defaultForm;
      unit.combatFormLabel=form?.label||form?.name||defaultForm;
      unit.asset=form?.asset||unit.asset;
      unit.combatBaseAsset=pow.asset;
    }
    unit.rarity=unit.rarity || pow.rarity;
    unit.element=pow.element;
    unit.combatRole=role;
    unit.roleLabel=pow.rolePrimary || pow.role || profile.label;
    unit.presence=profile.presence;
    unit.guardChance=profile.guard;
    unit.guardBonus=0;
    unit.maxMana=maxManaFor(pow,unit.stats);
    unit.mana=Math.round(unit.maxMana*MANA_PACING.startRatio);
    unit.rage=RAGE_PACING.start;
    unit.meter=0;
    unit.combo=0;
    unit.exclusiveUsed=false;
    unit.owned=clone(owned);
    unit.customStatuses={};
    unit.lastAction=null;
    unit.lastDamage=0;
    unit.turnsTaken=0;
    unit.isReserve=false;
    unit.boss=Boolean(entry.boss);
    unit.bossType=entry.bossType || null;
    unit.aiTier=entry.aiTier || (unit.boss?'boss':'standard');
    unit.aiDecisionCount=0;
    unit.bossPhase=1;
    unit.bossMaxPhase=entry.boss?((entry.bossType||'daily')==='daily'?2:3):1;
    unit.bossSigCounter=0;
    unit.bossSigRemaining=entry.boss?3:0;
    unit.bossSigName='';
    unit.bossScale=scale;
    if (unit.boss) {
      unit.presence=100;
      unit.guardChance=0;
    }
    window.POWDER_MECHANICS_V2?.attachUnitCore?.(unit,pow);
    return unit;
  }

  function combatPressure(round=1){const level=Math.max(0,Math.min(12,(Number(round)||1)-15));return{level,damage:1+level*0.15,sustain:Math.max(0.15,1-level*0.10)};}
  const RANK_DAMAGE_PACING=Object.freeze([1.00,1.35,1.15,1.08,0.90,0.80,0.72]);
  function combatRankOf(unit){const lv=Number(unit?.owned?.level||unit?.level||1);return lv<=12?0:lv<=24?1:lv<=36?2:lv<=48?3:lv<=60?4:lv<=78?5:6;}
  function rankDamagePacing(unit){return Number(RANK_DAMAGE_PACING[combatRankOf(unit)]||1);}

  class BattleCore {
    constructor(options={}){
      this.seed=(Number(options.seed ?? options.serial ?? 1)>>>0)||1;
      this.rng=options.rng || seededRng(this.seed);
      this.mode=options.mode || 'pve';
      this.bossType=options.bossType || 'daily';
      this.serial=Number(options.serial)||1;
      this.events=[];
      this.replayEvents=[];
      this.eventSeq=0;
      this.replayStartedAt=Date.now();
      this._actionTxn=false;
      this.initialEntries={player:(options.playerEntries||[]).slice(0,5).map(packInitialEntry),enemy:(options.enemyEntries||[]).slice(0,5).map(packInitialEntry)};
      this.log=[];
      this.mechanicsBus=window.POWDER_MECHANICS_V2?.CombatEventBus?new window.POWDER_MECHANICS_V2.CombatEventBus():null;
      this.state={
        version:'24.0-integration-final', phase:'ready', mode:this.mode, bossType:this.bossType,
        team:[], reserves:[], enemies:[], enemyReserves:[], current:null, turnCount:0, round:1, roundActionSize:6,
        replacementQueue:[], enemyReplacementQueue:[], replacementSide:null, result:null, finished:false, rewardClaimed:false,
        tamer:{simpleCharges:3,simpleActionLock:false,pendingSimple:null,expansionUsed:false,expansion:null},
        exclusiveTeamLock:{player:null,enemy:null},
        pvp:this.mode==='pvp'?{rules:{...PVP_RULES},afk:{player:0,enemy:0},lastActiveSide:null,lastActionAt:Date.now(),surrendered:null}:null
      };
      const player=(options.playerEntries||[]).slice(0,5),enemyEntries=(options.enemyEntries||[]);
      const synergy=window.POWDER_TEAM_SYNERGY,playerSynergy=synergy?.calculate?.(player.map(x=>x.pow))||{active:false,roles:[]},enemySynergy=synergy?.calculate?.(enemyEntries.map(x=>x.pow))||{active:false,roles:[]};
      const full=player.map((entry,i)=>createUnit(entry,'player',i,this.serial,1));
      synergy?.applyUnits?.(full,playerSynergy);
      this.state.team=full.slice(0,3);
      this.state.reserves=full.slice(3,5).map(u=>{u.isReserve=true;u.meter=0;return u;});
      const enemyScale=Number(options.enemyScale)||1;
      const enemyFull=enemyEntries.slice(0,5).map((entry,i)=>createUnit(entry,'enemy',i,this.serial,entry.scale||enemyScale));
      synergy?.applyUnits?.(enemyFull,enemySynergy);
      this.state.enemies=enemyFull.slice(0,3);
      this.state.enemyReserves=enemyFull.slice(3,5).map(u=>{u.isReserve=true;u.meter=0;return u;});
      this.state.roundActionSize=Math.max(1,this.state.team.length+this.state.enemies.length);
      this.state.synergy={player:playerSynergy,enemy:enemySynergy};
      this.state.team.forEach((u,i)=>u.meter=Math.max(0,34-i*6));
      this.state.enemies.forEach((u,i)=>u.meter=Math.max(0,22-i*5));
      this.pushLog(this.mode==='boss'?'Boss PvE đã sẵn sàng.':'Đội PvE đã sẵn sàng.','system');const synText=window.POWDER_TEAM_SYNERGY?.summary?.(playerSynergy)||[];for(const x of synText)this.pushLog(`Cộng hưởng · ${x}`,'buff');
    }

    get allUnits(){ return [...this.state.team,...this.state.enemies]; }
    get allRosterUnits(){ return [...this.state.team,...this.state.reserves,...this.state.enemies,...this.state.enemyReserves]; }
    living(side){
      const list=side==='player'?this.state.team:this.state.enemies;
      return list.filter(u=>!u.defeated && u.hp>0);
    }
    pushEvent(type,payload={}){
      const evt={type,seq:++this.eventSeq,at:Date.now(),round:this.state?.round||1,turn:this.state?.turnCount||0,...payload};
      this.events.push(evt);
      this.replayEvents.push(compactReplayEvent(evt));
      // 19.9: bounded replay/event history. Live queue is drained by the UI; replay keeps a safe ring.
      if(this.replayEvents.length>1200)this.replayEvents.splice(0,this.replayEvents.length-1200);
      const map={ 'battle-start':'onBattleStart','damage':'onDamage','heal':'onHeal','status-apply':'onDebuff','shield':'onBuff','break':'onShieldBreak','kill':'onKill','evade':'onEvade' };
      const ev=map[type]; if(ev)this.mechanicsBus?.emit?.(ev,evt); return evt;
    }
    grantMana(unit,amount,reason='Hồi Mana',meta={}){
      if(!unit||!Number.isFinite(Number(amount))||Number(amount)<=0||!Number.isFinite(Number(unit.maxMana)))return 0;
      const before=Math.max(0,Number(unit.mana)||0),after=clamp(before+Number(amount),0,Number(unit.maxMana)||0),gained=Math.max(0,after-before);
      if(gained<=0)return 0;
      unit.mana=after;
      this.pushEvent('mana',{sourceId:meta.sourceId||unit.id,targetId:unit.id,amount:gained,source:reason,reason:meta.reason||reason,targetIdDefeated:meta.targetId||null});
      this.processMechanicEvent('MANA_CHANGE',{actorId:unit.id,sourceId:meta.sourceId||unit.id,targetId:unit.id,side:unit.side,delta:gained,before,after,reason:meta.reason||reason,round:this.state.round},this.allUnits);
      return gained;
    }
    finalizeKillManaRewards(){
      for(const evt of this.events||[]){
        if(evt?.type!=='kill'||evt._manaRewarded)continue;
        const target=this.allRosterUnits.find(x=>x.id===evt.targetId),source=this.allRosterUnits.find(x=>x.id===evt.sourceId);
        if(!target||!(target.defeated||Number(target.hp)<=0)){evt._manaRewarded=true;continue;}
        evt._manaRewarded=true;
        if(!source||source.side===target.side)continue;
        const gained=this.grantMana(source,MANA_PACING.kill,`Hạ gục ${target.name} · +${MANA_PACING.kill} MP`,{sourceId:source.id,targetId:target.id,reason:'KILL_REWARD'});
        evt.manaReward=gained;
      }
    }
    emitCoreResource(unit,change){
      if(!unit||!change||!change.resource||!Number.isFinite(Number(change.delta))||Number(change.delta)===0)return null;
      const evt={type:'core-resource',at:Date.now(),unitId:unit.id,sourceId:unit.id,powId:unit.powId,engine:unit.coreMechanic?.engine||null,passiveName:unit.coreMechanic?.name||'Nội tại',resourceId:change.resource.id,resourceName:change.resource.displayName,before:change.before,after:change.after,max:change.resource.max,delta:change.delta,reason:change.reason||'',full:Boolean(change.full)};
      this.events.push(evt);
      if(unit.v9){unit.v9.resource={value:Number(change.after)||0,current:Number(change.after)||0,max:Number(change.resource.max)||1,name:change.resource.displayName||'Core',engine:unit.coreMechanic?.engine||null};}
      const becameReady=Number(change.delta)>0 && Number(change.before)<Number(change.resource.max) && Number(change.after)>=Number(change.resource.max);
      if(becameReady){
        unit.coreReady=true;
        unit.coreReadyAt=Date.now();
        this.events.push({type:'core-ready',at:Date.now(),unitId:unit.id,sourceId:unit.id,powId:unit.powId,engine:unit.coreMechanic?.engine||null,passiveName:unit.coreMechanic?.name||'Nội tại',resourceName:change.resource.displayName,current:change.after,max:change.resource.max,reason:change.reason||''});
      }else if(Number(change.after)<Number(change.resource.max)) unit.coreReady=false;
      return evt;
    }
    processMechanicEvent(event,payload={},units=null){
      const M=window.POWDER_MECHANICS_V2;if(!M?.gainForEvent)return [];
      const actor=this.allRosterUnits?.find?.(x=>x.id===(payload.actorId||payload.sourceId)),target=this.allRosterUnits?.find?.(x=>x.id===payload.targetId);
      payload={round:this.state.round,actionSerial:this.state.turnCount,turnCount:this.state.turnCount,side:payload.side||actor?.side||null,targetSide:payload.targetSide||target?.side||null,...payload};
      const out=[];
      for(const u of (units||this.allUnits)){
        if(event==='DAMAGE_TAKEN' && u?.coreMechanic?.storedDamage && (payload.targetId===u.id)){
          const store=M.recordStoredDamage?.(u,payload.damage,payload.absorbed,'Nhận/chặn sát thương',{area:Boolean(payload.area),round:Number(payload.round||this.state.round)||1});
          if(store?.delta>0){
            this.pushEvent('core-store',{unitId:u.id,sourceId:u.id,powId:u.powId,resourceName:u.coreMechanic?.resourceName||'Sát thương lưu',before:store.before,after:store.after,cap:store.cap,delta:store.delta,rate:store.rate,reason:store.reason});
            out.push(store);
          }
        }
        const ch=M.gainForEvent(u,event,payload);const ev=this.emitCoreResource(u,ch);if(ev)out.push(ev);
      }
      return out;
    }
    drainEvents(){ const out=[...this.events]; this.events.length=0; return out; }
    pushLog(message,tone=''){ this.log.push({message,tone,at:Date.now()}); if(this.log.length>80)this.log.shift(); }
    statusSnapshot(unit){
      const out={};
      for(const [name,data] of Object.entries(unit?.statuses||{}))out[name]={turns:Number(data?.turns)||0,kind:'status'};
      for(const [name,data] of Object.entries(unit?.customStatuses||{}))if(!out[name])out[name]={turns:Number(data?.turns)||0,kind:'custom'};
      return out;
    }
    allStatusSnapshots(){
      const out={};
      for(const u of this.allUnits)out[u.id]=this.statusSnapshot(u);
      return out;
    }
    emitStatusApplications(before,sourceId=null){
      for(const u of this.allUnits){
        const prev=before?.[u.id]||{}, now=this.statusSnapshot(u);
        for(const [name,data] of Object.entries(now)){
          const old=prev[name];
          if(!old || Number(data.turns)>Number(old.turns)){
            this.pushEvent('status-apply',{sourceId,targetId:u.id,status:name,turns:data.turns,refresh:Boolean(old),kind:data.kind});
            const source=this.allUnits.find(x=>x.id===sourceId);
            if(source && source.id!==u.id){
              this.processMechanicEvent(name==='Shield'?'SHIELD':'DEBUFF',{actorId:source.id,sourceId:source.id,targetId:u.id,status:name},[source,u]);
            }
          }
        }
      }
    }
    emitStatusExpirations(unit,before,reason='duration'){
      const now=this.statusSnapshot(unit);
      for(const [name,data] of Object.entries(before||{})){
        if(!now[name])this.pushEvent('status-expire',{targetId:unit.id,status:name,reason,kind:data.kind});
      }
    }
    pow(unit){ return powById(unit?.powId); }
    ability(unit,key){
      if(!VALID_ACTION_KEYS.has(key))return null;
      const pow=this.pow(unit); if(!pow)return null;
      if(key==='exclusive') return pow.exclusiveSkill || null;
      const loadout=window.POWDER_SKILL_LOADOUT;
      if(unit.side==='player' && loadout?.getAbility) return loadout.getAbility(unit.powId,key) || E.abilityFor(pow,key);
      return E.abilityFor(pow,key);
    }
    abilityCost(unit,key){
      // Engine-level invariant: Basic is always 0 Mana regardless of source data.
      if(key==='basic')return 0;
      return manaCost(this.ability(unit,key),key);
    }
    canUse(unit,key){
      if(!unit || unit.defeated || this.state.finished)return false;
      const a=this.ability(unit,key); if(!a)return false;
      // Basic is the guaranteed fallback action. It ignores Mana/Rage gating and
      // cannot be disabled by a bad unlockStar imported from legacy data.
      if(key==='basic')return true;
      const ownedStars=Number(unit?.owned?.stars||0),unlockStar=Number(a.unlockStar||0);
      if(ownedStars<unlockStar)return false;
      if(unit.mana < this.abilityCost(unit,key))return false;
      const req=window.POWDER_MECHANICS_V2?.resourceRequirement?.(unit,key)||0;if(req>0){const r=unit?.resources?.get?.('core');if(!r||Number(r.current)<req)return false;}
      if(key==='ultimate' && unit.rage<100)return false;
      if(key==='exclusive'){
        if(unit.rage<90 || unit.exclusiveUsed)return false;
        const lock=this.state.exclusiveTeamLock?.[unit.side];
        if(lock && Number(lock.round)===Number(this.state.round) && lock.sourceId!==unit.id)return false;
      }
      return true;
    }
    actionInfo(unit,key){
      const ability=this.ability(unit,key);
      return { key, ability, cost:this.abilityCost(unit,key), plan:questionPlan(key), available:this.canUse(unit,key), bypassGuard:bypassGuard(unit,ability,key), area:isArea(ability), support:isSupport(ability) };
    }

    start(){
      if(this.state.phase!=='ready')return false;
      this.state.phase='running';
      this.pushLog('Trận chiến bắt đầu. 3 Pow ra sân, 2 Pow dự bị.','start');
      this.pushEvent('battle-start');
      for(const u of this.allUnits){
        const r=u?.resources instanceof Map?[...u.resources.values()].find(x=>x?.visible):null;
        if(r&&Number(r.current)>=Number(r.max)){
          u.coreReady=true;u.coreReadyAt=Date.now();
          this.pushEvent('core-ready',{unitId:u.id,sourceId:u.id,powId:u.powId,engine:u.coreMechanic?.engine||null,passiveName:u.coreMechanic?.name||'Nội tại',resourceName:r.displayName,current:r.current,max:r.max,reason:'Bắt đầu trận đã đủ tài nguyên'});
        }
      }
      return true;
    }

    effective(unit){
      const stats={...E.effectiveStats(unit,this.pow(unit)?.abilities?.passive?.id)};
      // Legacy single-side Domain is compatibility-only. The production v13 Domain system
      // owns tamerBySide; never let the old player-only state alter PvP/PvE stats.
      if(!this.state.tamerBySide){
        const domain=this.state.tamer?.expansion;
        if(unit?.side==='player' && domain?.id==='timeflow' && domain.remainingRounds>0)stats.speed=Math.max(1,Math.round(stats.speed*TAMER_EXPANSIONS.timeflow.speed));
      }
      return stats;
    }

    activeDomain(){
      const d=this.state.tamer?.expansion;
      return d && d.remainingRounds>0 ? d : null;
    }

    canUseTamerSimple(kind){
      const cfg=TAMER_SIMPLE[kind], t=this.state.tamer, cur=this.state.current;
      if(!cfg||!t||this.state.phase!=='running'||this.state.finished||!cur||t.simpleCharges<=0||t.simpleActionLock)return false;
      if(kind==='assault' && cur.side!=='player')return false;
      if(kind==='guard' && cur.side!=='enemy')return false;
      return true;
    }

    useTamerSimple(kind){
      if(!this.canUseTamerSimple(kind))return false;
      const cfg=TAMER_SIMPLE[kind], t=this.state.tamer, cur=this.state.current;
      t.simpleCharges-=1; t.simpleActionLock=true;
      t.pendingSimple={kind,actorId:cur.id,actorSide:cur.side,round:this.state.round};
      this.pushLog(`Tamer dùng Giản Dị Lãnh Địa · ${cfg.name}.`,'domain');
      this.pushEvent('tamer-simple',{kind,name:cfg.name,charges:t.simpleCharges,actorId:cur.id});
      return true;
    }

    canExpandDomain(id){
      return Boolean(TAMER_EXPANSIONS[id] && this.state.phase==='running' && !this.state.finished && this.state.current?.side==='player' && !this.state.tamer.expansionUsed);
    }

    expandDomain(id){
      if(!this.canExpandDomain(id))return false;
      const cfg=TAMER_EXPANSIONS[id], t=this.state.tamer;
      t.expansionUsed=true;
      t.expansion={id,name:cfg.name,short:cfg.short,description:cfg.description,remainingRounds:5,startedRound:this.state.round,turnsUntilTick:this.domainRoundSize()};
      this.pushLog(`BÀNH TRƯỚNG LÃNH ĐỊA · ${cfg.name} (5 hiệp).`,'domain');
      this.pushEvent('tamer-expansion',{id,name:cfg.name,short:cfg.short,remainingRounds:5});
      return true;
    }

    domainRoundSize(){
      return Math.max(1,this.living('player').length+this.living('enemy').length);
    }

    updateDomainTurn(){
      const d=this.activeDomain();
      if(!d)return;
      d.turnsUntilTick=Math.max(0,Number(d.turnsUntilTick||this.domainRoundSize())-1);
      if(d.turnsUntilTick>0)return;
      d.remainingRounds=Math.max(0,d.remainingRounds-1);
      if(d.remainingRounds<=0){
        const ended={...d}; this.state.tamer.expansion=null;
        this.pushLog(`${ended.name} tan biến.`,'domain');
        this.pushEvent('tamer-domain-end',{id:ended.id,name:ended.name});
      }else{
        d.turnsUntilTick=this.domainRoundSize();
        this.pushEvent('tamer-domain-tick',{id:d.id,name:d.name,remainingRounds:d.remainingRounds});
      }
    }

    nextReadyUnit(){
      const alive=[...this.living('player'),...this.living('enemy')];
      if(!alive.length)return null;
      const ready=alive.filter(u=>u.meter>=100).sort((a,b)=>stableUnitCompare(this,a,b));
      if(ready.length)return ready[0];
      let time=Infinity;
      for(const u of alive){ const speed=Math.max(1,this.effective(u).speed); time=Math.min(time,(100-u.meter)/speed); }
      for(const u of alive)u.meter=Math.min(100,u.meter+this.effective(u).speed*time);
      return alive.filter(u=>u.meter>=99.999).sort((a,b)=>stableUnitCompare(this,a,b))[0]||null;
    }

    turnForecast(limit=8){
      const alive=[...this.living('player'),...this.living('enemy')];
      if(!alive.length)return [];
      const currentId=this.state.current?.id||null;
      const sim=alive.map(u=>({
        unit:u,
        meter:u.id===currentId?0:clamp(Number(u.meter)||0,0,100),
        speed:Math.max(1,Number(this.effective(u)?.speed)||1)
      }));
      const out=[]; let elapsed=0;
      for(let step=0;step<Math.max(1,Number(limit)||8)&&sim.length;step++){
        let ready=sim.filter(x=>x.meter>=99.999).sort((a,b)=>b.meter-a.meter||b.speed-a.speed||String(a.unit?.id||'').localeCompare(String(b.unit?.id||'')));
        if(!ready.length){
          let dt=Infinity;
          for(const x of sim)dt=Math.min(dt,(100-x.meter)/x.speed);
          if(!Number.isFinite(dt))break;
          elapsed+=Math.max(0,dt);
          for(const x of sim)x.meter=Math.min(100,x.meter+x.speed*dt);
          ready=sim.filter(x=>x.meter>=99.999).sort((a,b)=>b.meter-a.meter||b.speed-a.speed||String(a.unit?.id||'').localeCompare(String(b.unit?.id||'')));
        }
        const chosen=ready[0]; if(!chosen)break;
        out.push({id:chosen.unit.id,name:chosen.unit.name,side:chosen.unit.side,speed:chosen.speed,eta:elapsed,order:step+1});
        chosen.meter=0;
      }
      return out;
    }

    beginTurn(){
      if(this.state.phase!=='running' || this.state.current || this.checkEnd())return {type:'none'};
      const unit=this.nextReadyUnit();
      if(!unit)return {type:'none'};
      if(!this.state.tamerBySide && this.state.tamer){
        this.state.tamer.simpleActionLock=false;
        if(this.state.tamer.pendingSimple && this.state.tamer.pendingSimple.actorId!==unit.id)this.state.tamer.pendingSimple=null;
      }
      this.state.current=unit; unit.meter=100; unit.turnsTaken+=1;
      const beforeTurnStatuses=this.statusSnapshot(unit);
      const tick=E.startTurn(unit);
      let fatalDotSourceId=null,fatalDotStatus=null;
      for(const e of tick.events||[]){
        const sourceId=unit.statuses?.[e.status]?.sourceId||unit.customStatuses?.[e.status]?.sourceId||null;
        if(e.type==='dot'&&sourceId){fatalDotSourceId=sourceId;fatalDotStatus=e.status||fatalDotStatus;}
        this.pushEvent('status-tick',{unitId:unit.id,sourceId,event:e});
        if(e.type==='dot')this.processMechanicEvent('DOT_TICK',{actorId:sourceId,sourceId,targetId:unit.id,status:e.status,amount:e.amount,anySide:true,round:this.state.round},this.allUnits);
        if(e.type==='heal'&&e.amount>0){const src=this.allUnits.find(x=>x.id===sourceId)||unit,poisoned=Boolean(unit.statuses?.Poison||Object.keys(unit.customStatuses||{}).some(x=>/Poison|Độc/i.test(x))),low=Number(unit.hp)/Math.max(1,Number(unit.maxHp))<.30;this.processMechanicEvent('HEAL',{actorId:src.id,sourceId:src.id,side:src.side,targetId:unit.id,targetIds:[unit.id],lowHpTargetIds:low?[unit.id]:[],poisonedTargetIds:poisoned?[unit.id]:[],amount:e.amount,round:this.state.round},this.allUnits);}
      }
      this.emitStatusExpirations(unit,beforeTurnStatuses,'start-turn');
      if(unit.defeated){
        this.pushLog(`${unit.name} bị hạ bởi hiệu ứng theo lượt.`,'danger');
        if(fatalDotSourceId)this.pushEvent('kill',{sourceId:fatalDotSourceId,targetId:unit.id,ability:fatalDotStatus||'DOT',dot:true,crit:false});
        this.finalizeKillManaRewards();
        this.queueReplacements();
        this.finishCurrent(true);
        return {type:'skip',unit,reason:'defeated'};
      }
      if(tick.skip){
        this.pushLog(`${unit.name} mất lượt vì khống chế.`,'status');
        this.finishCurrent(true);
        return {type:'skip',unit,reason:'control'};
      }
      const manaFlow=manaPacingFor(unit);
      this.grantMana(unit,manaFlow.turnStart,`Hồi đầu lượt · +${manaFlow.turnStart} MP · ${manaFlow.rarity}`,{reason:'TURN_REGEN',rarity:manaFlow.rarity});
      this.pushEvent('turn-start',{unitId:unit.id,side:unit.side});
      return {type:unit.side==='player'?'player':'enemy',unit};
    }

    finishCurrent(skipped=false){
      const unit=this.state.current; if(!unit)return;
      const beforeEndStatuses=this.statusSnapshot(unit);
      if(!unit.defeated)E.endTurn(unit);
      this.emitStatusExpirations(unit,beforeEndStatuses,'duration');
      const MM=window.POWDER_MECHANICS_V2;
      for(const source of this.allUnits){if(!source||source.defeated||source.side===unit.side||source.coreMechanic?.engine!=='TARGET_STACK')continue;const stacks=Number(MM?.targetStackValue?.(source,unit.id)||0);if(stacks<=0)continue;
        if(source.powId==='glacior'&&stacks>=3&&!unit.defeated){const before=Number(unit.meter)||0;unit.meter=Math.max(0,before-5);if(unit.meter!==before)this.pushEvent('meter-change',{sourceId:source.id,targetId:unit.id,before,after:unit.meter,delta:unit.meter-before,ability:'Hàn Khí'});this.processMechanicEvent('TARGET_TRIGGER',{actorId:source.id,sourceId:source.id,targetId:unit.id,reason:`Hàn Khí ${stacks} tầng kích hoạt`},[source]);}
        if(source.powId==='verdantis'&&!unit.defeated){const before=unit.hp,heal=Math.max(1,Math.round(unit.maxHp*.02*stacks));unit.hp=Math.min(unit.maxHp,unit.hp+heal);const amount=unit.hp-before;if(amount>0){this.pushEvent('heal',{sourceId:source.id,targetIds:[unit.id],amount,label:'Sinh Mầm nở'});this.processMechanicEvent('TARGET_TRIGGER',{actorId:source.id,sourceId:source.id,targetId:unit.id,reason:`Sinh Mầm nở · ${stacks} tầng`},[source]);}}
      }
      const targetTicks=MM?.tickTargetStacks?.(this.allRosterUnits,unit.id)||[];for(const ch of targetTicks)this.pushEvent('target-core-expire',{...ch,unitId:ch.sourceId,reason:'Hết thời lượng'});
      if(unit?.coreRuntime?.storeRateTurns>0){unit.coreRuntime.storeRateTurns-=1;if(unit.coreRuntime.storeRateTurns<=0){unit.coreRuntime.storeRateOverride=null;this.pushEvent('core-store-rate',{unitId:unit.id,sourceId:unit.id,rate:Number(unit.coreMechanic?.storedDamage?.rate)||0,turns:0,expired:true});}}
      if(unit.boss&&!unit.defeated&&!skipped)this.processBossSignature(unit);
      unit.meter=0;
      this.state.turnCount+=1;
      const roundSize=Math.max(1,Number(this.state.roundActionSize)||6),previousRound=this.state.round;
      this.state.round=1+Math.floor(this.state.turnCount/roundSize);for(const x of this.allRosterUnits)x.combatRound=this.state.round;
      if(this.state.round>previousRound){this.processMechanicEvent('ROUND',{round:this.state.round,previousRound},this.allUnits);const p=combatPressure(this.state.round);if(p.level>0)this.pushEvent('combat-pressure',{round:this.state.round,level:p.level,damageMultiplier:p.damage,sustainMultiplier:p.sustain});}
      if(!this.state.tamerBySide && this.state.tamer){
        if(this.state.tamer.pendingSimple?.actorId===unit.id)this.state.tamer.pendingSimple=null;
        this.state.tamer.simpleActionLock=false;
        this.updateDomainTurn();
      }
      this.state.current=null;
      this.pushEvent('turn-end',{unitId:unit.id,skipped});
      this.queueReplacements();
      this.checkBossPhase();
      this.checkEnd();
    }

    legalTargets(attacker,ability,key){
      if(ability?.target==='enemy-or-ally'){
        const allies=attacker.side==='player'?this.living('player'):this.living('enemy');
        const enemies=attacker.side==='player'?this.living('enemy'):this.living('player');
        return [...enemies,...allies];
      }
      if(isSupport(ability)){
        if(ability.target==='self')return [attacker];
        const allies=(attacker.side==='player'?this.living('player'):this.living('enemy'));
        if(ability.target==='ally')return allies.filter(u=>u.id!==attacker.id);
        return allies;
      }
      return attacker.side==='player'?this.living('enemy'):this.living('player');
    }

    weightedPresenceTarget(candidates){
      const list=candidates.filter(Boolean); if(!list.length)return null;
      const total=list.reduce((s,u)=>s+Math.max(1,Number(u.presence)||1),0);
      let roll=this.rng()*total;
      for(const u of list){ roll-=Math.max(1,Number(u.presence)||1); if(roll<=0)return u; }
      return list[list.length-1];
    }

    highestGuard(side,original){
      const list=(side==='player'?this.living('player'):this.living('enemy'))
        .filter(u=>u.id!==original?.id && !isHardControlled(u) && (Number(u.guardChance)||0)>0)
        .sort((a,b)=>(b.guardChance+b.guardBonus)-(a.guardChance+a.guardBonus));
      return list[0]||null;
    }

    resolveGuard(attacker,original,ability,key){
      if(!original || isSupport(ability) || isArea(ability) || bypassGuard(attacker,ability,key))return {target:original,guarded:false};
      const guard=this.highestGuard(original.side,original);
      if(!guard)return {target:original,guarded:false};
      const chance=clamp((Number(guard.guardChance)||0)+(Number(guard.guardBonus)||0),0,100);
      if(this.rng()*100>=chance)return {target:original,guarded:false,chance};
      this.pushEvent('guard',{guardId:guard.id,protectedId:original.id,chance});
      this.processMechanicEvent('GUARD',{actorId:guard.id,sourceId:guard.id,targetId:original.id,protectedId:original.id},[guard]);
      this.pushLog(`${guard.name} BẢO HỘ ${original.name} (${Math.round(chance)}%).`,'guard');
      return {target:guard,guarded:true,chance,original};
    }

    targetsFor(attacker,ability,key,requestedId){
      const legal=this.legalTargets(attacker,ability,key);
      if(!legal.length)return [];
      if(ability?.target==='enemy-or-ally'){
        const chosen=legal.find(u=>u.id===requestedId) || legal.find(u=>u.side!==attacker.side) || legal[0];
        return chosen?[chosen]:[];
      }
      if(isSupport(ability)){
        if(ability.target==='team' || ability.target==='allies')return legal;
        if(ability.target==='self')return [attacker];
        const sorted=[...legal].sort((a,b)=>a.hp/Math.max(1,a.maxHp)-b.hp/Math.max(1,b.maxHp));
        if(ability.target==='two-allies')return sorted.slice(0,2);
        if(ability.target==='three-allies')return sorted.slice(0,3);
        if(ability.target==='self-and-ally' || ability.target==='self-and-lowest-ally'){
          const others=sorted.filter(u=>u.id!==attacker.id);
          const requested=others.find(u=>u.id===requestedId);
          const ally=requested||others[0]||null;
          return ally?[attacker,ally]:[attacker];
        }
        const chosen=legal.find(u=>u.id===requestedId) || sorted[0];
        return chosen?[chosen]:[];
      }
      if(ability.target==='all' || ability.target==='all-enemies' || ability.target==='front-row' || ability.target==='back-row'){
        if(ability.target==='front-row'){const row=legal.filter(u=>Number(u.teamIndex)<2);return row.length?row:legal.slice(0,2);}
        if(ability.target==='back-row'){const row=legal.filter(u=>Number(u.teamIndex)>=2);return row.length?row:legal.slice(-1);}
        return legal;
      }
      let primary=legal.find(u=>u.id===requestedId) || (attacker.side==='enemy'?this.weightedPresenceTarget(legal):legal[0]);
      if(!primary)return [];
      if(ability.target==='two-enemies'){
        const other=legal.find(u=>u.id!==primary.id); return other?[primary,other]:[primary];
      }
      const guarded=this.resolveGuard(attacker,primary,ability,key);
      return [guarded.target];
    }

    emitStatusInteraction(attacker,target,status,refreshed=false){
      if(!target||target.defeated)return;
      const active=new Set([...Object.keys(target.statuses||{}),...Object.keys(target.customStatuses||{})]);
      const rows=[];
      if(active.has('Burn')&&active.has('Poison'))rows.push(['dual-dot','Song DOT','Thiêu Đốt + Nhiễm Độc cùng tồn tại: áp lực HP theo hai cơ chế khác nhau.']);
      if((active.has('Freeze')||active.has('Frostbite'))&&(active.has('Slow')||active.has('Shock')||active.has('Paralysis')))rows.push(['control-lock','Khóa nhịp','Đóng Băng kết hợp giảm SPEED/thanh lượt: mục tiêu bị kiểm soát nhịp hành động mạnh.']);
      if(active.has('Poison')&&(active.has('AntiHeal')||[...active].some(x=>/giảm hồi|AntiHeal/i.test(x))))rows.push(['heal-lock','Khóa hồi phục','Poison kết hợp giảm hồi máu: khả năng phục hồi của mục tiêu bị ép xuống rõ rệt.']);
      if((active.has('Guard')||[...active].some(x=>/Bảo Hộ|Guard/i.test(x)))&&Number(target.shield||0)>0)rows.push(['guard-shield','Thành phòng thủ','Guard + Giáp đang cùng hoạt động: damage đơn mục tiêu được bảo vệ nhiều lớp.']);
      if(refreshed)rows.push(['refresh','Làm mới hiệu ứng',`${status} được áp lại; thời lượng/cường độ được cập nhật theo luật của hiệu ứng.`]);
      const seen=new Set();
      for(const [id,label,detail] of rows){if(seen.has(id))continue;seen.add(id);this.pushEvent('status-interaction',{sourceId:attacker?.id||null,targetId:target.id,status,interactionId:id,label,detail});}
    }

    applyStatus(attacker,target,status,ability,context={}){
      if(!status || !target || target.defeated)return;
      const existed=Boolean(target.statuses?.[status]||target.customStatuses?.[status]);
      if(status==='Cleanse'){
        if(attacker.element!=='light' || target.side!==attacker.side)return;
        const bad=Object.keys(target.statuses||{}).filter(s=>!BENEFICIAL.has(s));
        if(bad[0]){ E.removeStatus(target,bad[0]); this.pushEvent('cleanse',{sourceId:attacker.id,targetId:target.id,status:bad[0]}); this.processMechanicEvent('CLEANSE',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,status:bad[0],round:this.state.round},[attacker]); }
        return;
      }
      if(status==='Curse' && attacker.element!=='dark')return;
      if(status==='Speed Up'){
        const effectMultiplier=clamp(Number(attacker?._knowledgeEffectScale)||1,0.20,1.30);
        E.addStatus(target,'Speed Up',attacker,2); target.meter=Math.min(100,target.meter+Math.round(10*effectMultiplier)); this.emitStatusInteraction(attacker,target,'Speed Up',existed); return;
      }
      if(status==='Shield'){
        const effectMultiplier=clamp(Number(attacker?._knowledgeEffectScale)||1,0.20,1.30);
        const ratio=clamp(Number(ability?.shieldRatio ?? 0.20)*effectMultiplier,0.03,0.54);
        const duration=Math.max(1,Number(ability?.shieldDuration)||2);
        E.addShield(target,Math.round(target.maxHp*ratio),attacker,duration,{capRatio:0.60}); this.emitStatusInteraction(attacker,target,'Shield',false); return;
      }
      if(status==='Burn'){
        const effectMultiplier=clamp(Number(attacker?._knowledgeEffectScale)||1,0.20,1.30);
        E.addStatus(target,'Burn',attacker,3,{effectMultiplier,seedDamage:Math.max(0,Number(context?.impactDamage)||0),burnRate:Number(ability?.burnRate||.30),tickCapRatio:Number(ability?.burnCapRatio||.12)}); this.emitStatusInteraction(attacker,target,'Burn',existed); return;
      }
      if(status==='Poison'){
        const effectMultiplier=clamp(Number(attacker?._knowledgeEffectScale)||1,0.20,1.30);
        const txt=String(ability?.description||ability?.rulesText||'');
        const poisonVariant=String(ability?.poisonVariant||(/Độc\s*Mòn/i.test(txt)?'Độc Mòn':/Độc\s*Tê/i.test(txt)?'Độc Tê':'Độc'));
        E.addStatus(target,'Poison',attacker,3,{effectMultiplier,poisonVariant,stackCap:Number(ability?.poisonStackCap||3),damagePerStack:Number(ability?.poisonDamagePerStack||.02),antiHealPerStack:Number(ability?.poisonAntiHealPerStack||.06)}); this.emitStatusInteraction(attacker,target,'Poison',existed); return;
      }
      if(status==='Defense Up' || status==='Attack Up' || status==='AP Up' || status==='Regeneration' || status==='Stun' || status==='Freeze' || status==='Slow'){
        E.addStatus(target,status,attacker,2); this.emitStatusInteraction(attacker,target,status,existed); return;
      }
      const mapped=STATUS_MAP[status];
      if(mapped){ E.addStatus(target,mapped,attacker,mapped==='Stun'||mapped==='Freeze'?1:2); target.customStatuses[status]={turns:2}; this.emitStatusInteraction(attacker,target,status,existed); return; }
      target.customStatuses[status]={turns:2}; this.emitStatusInteraction(attacker,target,status,existed);
    }

    applyCanonicalDispel(attacker,ability,key='skill1'){
      const d=String(ability?.description||ability?.rulesText||'');if(!/xóa[^.;]{0,35}buff/i.test(d))return [];
      const enemies=this.living(attacker.side==='player'?'enemy':'player');if(!enemies.length)return [];
      const perTarget=/xóa\s+tối đa\s*2\s*buff/i.test(d)?2:1,targetLimit=/tối đa\s*2\s*kẻ địch/i.test(d)?2:1,out=[];
      const candidates=enemies.filter(t=>(t.buffs||[]).some(b=>b?.dispellable!==false)||Object.keys(t.statuses||{}).some(x=>BENEFICIAL.has(x))).slice(0,targetLimit);
      for(const target of candidates){let removed=0;while(removed<perTarget){let label=null;if(Array.isArray(target.buffs)){const i=target.buffs.findIndex(b=>b?.dispellable!==false);if(i>=0){label=target.buffs[i]?.stat||target.buffs[i]?.id||'Buff';target.buffs.splice(i,1);}}if(!label){const st=Object.keys(target.statuses||{}).find(x=>BENEFICIAL.has(x));if(st){label=st;E.removeStatus(target,st);}}if(!label)break;removed++;this.pushEvent('dispel',{sourceId:attacker.id,targetId:target.id,status:label,key,ability:ability?.name||key});this.processMechanicEvent('DISPEL',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,status:label,key,round:this.state.round},[attacker]);out.push({targetId:target.id,status:label});}}
      return out;
    }

    applyCanonicalBuffs(attacker,ability,targets,key='skill1',effectMultiplier=1){
      if(!BR || !ability || !Array.isArray(ability.combatBuffs) || !ability.combatBuffs.length)return [];
      effectMultiplier=clamp(Number(effectMultiplier)||1,0.20,1.30);
      const out=[], legacyStat={'Attack Up':'ATK','AP Up':'AP','Defense Up':'DEF','Speed Up':'SPEED'}[ability.status]||null;
      for(const spec of ability.combatBuffs){
        let recipients=[];
        if(spec.scope==='team')recipients=this.living(attacker.side);
        else if(spec.scope==='action')recipients=(targets||[]).filter(t=>t&&!t.defeated&&t.side===attacker.side);
        else recipients=[attacker];
        if(!recipients.length && spec.scope==='action')recipients=[attacker];
        const seen=new Set();
        for(const target of recipients){
          if(!target||target.defeated||seen.has(target.id))continue;seen.add(target.id);
          const stat=BR.resolveStat(spec,target);
          // Legacy status already supplies a fixed +30/+20 buff. Avoid double-applying the same stat.
          if(legacyStat===stat && !ability.suppressLegacyStatus)continue;
          const buff=E.addCombatBuff(target,{id:`V163:${attacker.powId}:${ability.id||ability.name}:${stat}`,stat,value:Number(spec.value||0)*effectMultiplier,duration:spec.duration,sourcePowId:attacker.powId,stacking:'MAX',dispellable:true});
          if(!buff)continue;
          const evt={sourceId:attacker.id,targetId:target.id,key,ability:ability.name,stat,value:buff.value,duration:buff.duration,label:BR.label(stat),icon:BR.icon(stat)};
          this.pushEvent('buff-apply',evt);out.push(evt);
          this.processMechanicEvent('BUFF',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,stat,value:buff.value},[attacker,target]);
        }
      }
      return out;
    }

    supportEffect(attacker,ability,targets,key='skill1',knowledgeMultiplier=1){
      let totalHeal=0,totalOverheal=0;const lowHpTargetIds=[],poisonedTargetIds=[],healImpacts=[];
      const ap=this.effective(attacker).ap;
      for(const target of targets){
        if(Number(target.hp)/Math.max(1,Number(target.maxHp))<.30)lowHpTargetIds.push(target.id);
        if(target.statuses?.Poison||Object.keys(target.customStatuses||{}).some(x=>/Poison|Độc/i.test(x)))poisonedTargetIds.push(target.id);
        if(attacker.combatRole==='healer' || ability.mechanic==='role_healer_single'){
          const ratio=ability.mechanic==='role_healer_team'?0.08:0.14;
          let heal=Math.round((target.maxHp*ratio + ap*0.35 + Number(ability.power||0)*1.4)*combatPressure(this.state.round).sustain*clamp(Number(knowledgeMultiplier)||1,.20,1.36));
          const domain=this.activeDomain();
          if(attacker.side==='player' && domain?.id==='vitality')heal=Math.round(heal*TAMER_EXPANSIONS.vitality.healing);
          const missing=Math.max(0,Number(target.maxHp||0)-Number(target.hp||0));
          totalOverheal+=Math.max(0,heal-missing);
          const healed=E.healTarget(target,heal,{source:attacker,capRatio:(key==='ultimate'||key==='exclusive')?.50:.35});
          totalHeal+=healed;
          if(healed>0)healImpacts.push({targetId:target.id,amount:healed,hpAfter:target.hp});
        }
        const allySafeStatus=new Set(['Shield','Regeneration','Defense Up','Attack Up','AP Up','Speed Up','Cleanse']);
        if(ability.status && !ability.suppressLegacyStatus && allySafeStatus.has(ability.status))this.applyStatus(attacker,target,ability.status,ability);
        if(ability.mechanic==='role_enchanter_haste'){ target.customStatuses['Speed Up']={turns:2}; target.meter=Math.min(100,target.meter+Math.round(12*clamp(Number(knowledgeMultiplier)||1,.20,1.36))); }
        if(ability.mechanic==='role_tank_bulwark'){
          E.addStatus(attacker,'Defense Up',attacker,2); attacker.guardBonus=clamp(attacker.guardBonus+Math.round(20*clamp(Number(knowledgeMultiplier)||1,.20,1.36)),0,30);
        }
        if(ability.mechanic==='role_knight_guarded') E.addShield(attacker,Math.round(attacker.maxHp*0.06*clamp(Number(knowledgeMultiplier)||1,.20,1.36)),attacker,1,{capRatio:0.60});
      }
      if(totalHeal){
        this.pushEvent('heal',{sourceId:attacker.id,targetIds:targets.map(t=>t.id),amount:totalHeal,impacts:healImpacts});
        this.processMechanicEvent('HEAL',{actorId:attacker.id,sourceId:attacker.id,side:attacker.side,targetIds:targets.map(t=>t.id),lowHpTargetIds,poisonedTargetIds,amount:totalHeal},this.allUnits);
      }
      if(totalOverheal>0)this.processMechanicEvent('OVERHEAL',{actorId:attacker.id,sourceId:attacker.id,side:attacker.side,targetIds:targets.map(t=>t.id),amount:totalOverheal,round:this.state.round},this.allUnits);
      return {damage:0,heal:totalHeal,overheal:totalOverheal,targets};
    }

    offensiveEffect(attacker,ability,key,targets,knowledgeMultiplier,targetCorePayoff=null){
      let total=0; const impacts=[]; const breakEvents=[]; const killEvents=[];
      for(const target of targets){
        if(!target || target.defeated)continue;
        const calc=E.calculateDamage(attacker,target,ability,{key,area:isArea(ability),unavoidable:Boolean(ability?.sureHit||ability?.unavoidable||ability?.tags?.includes?.('UNAVOIDABLE')),combo:attacker.combo,sameElementAllies:(attacker.side==='player'?this.living('player'):this.living('enemy')).filter(u=>u.element===attacker.element).length-1,rng:this.rng});
        if(calc.evaded){
          impacts.push({targetId:target.id,damage:0,absorbed:0,crit:false,element:calc.element,hpBefore:target.hp,hpAfter:target.hp,shieldBefore:Math.max(0,Number(target.shield)||0),shieldAfter:Math.max(0,Number(target.shield)||0),shieldBreak:false,killed:false,evaded:true,hitChance:calc.hitChance});
          this.pushEvent('evade',{sourceId:attacker.id,targetId:target.id,key,ability:ability.name,hitChance:calc.hitChance});
          continue;
        }
        let amount=Math.max(1,Math.round(calc.amount*knowledgeMultiplier*DAMAGE_PACING));const tp=targetCorePayoff?.rows?.find?.(x=>x.targetId===target.id);if(tp&&Number(tp.scale)>1)amount=Math.max(1,Math.round(amount*Number(tp.scale)));
        if(ability.mechanic==='role_assassin_execute' && target.hp/target.maxHp<0.35)amount=Math.round(amount*1.30);
        const tamer=this.state.tamer, simple=tamer?.pendingSimple, domain=this.activeDomain();
        if(attacker.side==='player'){
          if(simple?.kind==='assault' && simple.actorId===attacker.id)amount=Math.round(amount*TAMER_SIMPLE.assault.outgoing);
          if(domain?.id==='frenzy')amount=Math.round(amount*TAMER_EXPANSIONS.frenzy.outgoing);
        }
        if(target.side==='player'){
          if(simple?.kind==='guard' && simple.actorId===attacker.id)amount=Math.max(1,Math.round(amount*TAMER_SIMPLE.guard.incoming));
          if(domain?.id==='fortress')amount=Math.max(1,Math.round(amount*TAMER_EXPANSIONS.fortress.incoming));
        }
        amount=Math.max(1,Math.round(amount*rankDamagePacing(attacker)*combatPressure(this.state.round).damage));amount=roundOneSafety(this,attacker,target,key,ability,amount,knowledgeMultiplier,domain,simple);
        const hpBefore=target.hp;
        const shieldBefore=Math.max(0,Number(target.shield)||0);
        const dealt=E.damageTarget(target,amount);
        const shieldBreak=shieldBefore>0 && Math.max(0,Number(target.shield)||0)<=0 && dealt.absorbed>0;
        const killed=Boolean(target.defeated || target.hp<=0);
        total+=dealt.damage; target.lastDamage=dealt.damage;
        impacts.push({targetId:target.id,damage:dealt.damage,absorbed:dealt.absorbed,crit:calc.crit,element:calc.element,hpBefore,hpAfter:target.hp,shieldBefore,shieldAfter:Math.max(0,Number(target.shield)||0),shieldBreak,killed,evaded:false,hitChance:calc.hitChance,critChance:calc.critChance,mitigation:calc.mitigation});
        this.processMechanicEvent('DAMAGE_TAKEN',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,damage:dealt.damage,absorbed:dealt.absorbed,hpBefore:hpBefore,hpAfter:target.hp,area:isArea(ability),key,round:this.state.round},[target]);
        if(!isArea(ability)&&dealt.damage>0)target.coreRuntime&&(target.coreRuntime.lastSingleHitTurn=this.state.turnCount);
        if(calc.crit)this.processMechanicEvent('CRIT_TAKEN',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,key,ability:ability.name},[target]);
        if(shieldBreak)breakEvents.push({sourceId:attacker.id,targetId:target.id,kind:'shield',ability:ability.name});
        if(killed)killEvents.push({sourceId:attacker.id,targetId:target.id,ability:ability.name,crit:Boolean(calc.crit)});
        target.rage=clamp(target.rage+RAGE_PACING.onHitTaken,0,100);
        let chance=key==='exclusive'?0.90:key==='ultimate'?0.75:0.50;
        const mappedStatus=STATUS_MAP[ability.status]||ability.status;
        if(HARD_CC.has(mappedStatus)){
          const tenacity=clamp(Number(this.effective(target)?.tenacity||0),0,60)/100;
          chance*=1-tenacity;
        }
        if(ability.status && !ability.suppressLegacyStatus && this.rng()<chance && !target.defeated)this.applyStatus(attacker,target,ability.status,ability,{impactDamage:Number(dealt.damage||0)+Number(dealt.absorbed||0),key});
        if(ability.mechanic==='role_marksman_focus' && !target.defeated)target.customStatuses['Aim Mark']={turns:2};
        if(ability.mechanic==='role_assassin_mark' && !target.defeated)target.customStatuses['Hunt Mark']={turns:2};
      }
      if(ability.mechanic==='role_knight_guarded')E.addShield(attacker,Math.round(attacker.maxHp*0.06),attacker,1,{capRatio:0.60});
      this.pushEvent('damage',{sourceId:attacker.id,key,ability:ability.name,impacts,total});
      if(impacts.some(x=>!x.evaded&&Number(x.damage)>0)){
        const targetHasSlow=impacts.some(imp=>{const t=this.allRosterUnits.find(x=>x.id===imp.targetId);return t&&Object.keys(t.statuses||{}).concat(Object.keys(t.customStatuses||{})).some(x=>/Slow|SPEED Down|Hàn|Chậm|Frost|Ice/i.test(x));});
        this.processMechanicEvent('DAMAGE_DEALT',{actorId:attacker.id,sourceId:attacker.id,key,ability:ability.name,damageType:ability.type||null,targetHasSlow,impacts,total},[attacker]);
        for(const imp of impacts.filter(x=>!x.evaded&&Number(x.damage)>0)){
          this.processMechanicEvent('ALLY_DAMAGE',{actorId:attacker.id,sourceId:attacker.id,targetId:imp.targetId,key,ability:ability.name,damage:imp.damage,impacts:[imp]},this.allUnits);
          for(const owner of this.allUnits.filter(u=>u.powId==='starter_water_aquelion'&&u.side===attacker.side&&['water','ice'].includes(attacker.element))){const stacks=Number(window.POWDER_MECHANICS_V2?.targetStackValue?.(owner,imp.targetId)||0);if(stacks>0)this.processMechanicEvent('ALLY_ELEMENT_HIT',{actorId:owner.id,sourceId:owner.id,targetId:imp.targetId,triggerActorId:attacker.id,key,ability:ability.name},[owner]);}
        }
        for(const owner of this.allUnits.filter(u=>u.powId==='noxabyss'))for(const imp of impacts){const t=this.allRosterUnits.find(x=>x.id===imp.targetId);if(!t||t.side===owner.side||t.defeated)continue;const cursed=Object.keys(t.statuses||{}).concat(Object.keys(t.customStatuses||{})).some(x=>/Nguyền|Curse|Tử Chú|Suy Vong/i.test(x));if(cursed&&Number(imp.hpBefore)>0&&Number(imp.hpBefore)/Math.max(1,t.maxHp)>=.30&&Number(t.hp)/Math.max(1,t.maxHp)<.30)this.processMechanicEvent('CURSED_LOW_HP',{actorId:owner.id,ownerId:owner.id,sourceId:owner.id,targetId:t.id},[owner]);}
      }
      if(impacts.some(x=>x.crit)){this.processMechanicEvent('CRIT',{actorId:attacker.id,sourceId:attacker.id,key,ability:ability.name,bonus:1,round:this.state.round},[attacker]);this.processMechanicEvent('ALLY_CRIT',{actorId:attacker.id,sourceId:attacker.id,side:attacker.side,key,ability:ability.name,round:this.state.round},this.allUnits);}
      breakEvents.forEach(e=>{this.pushEvent('break',e);this.processMechanicEvent('SHIELD_BREAK',{actorId:attacker.id,sourceId:attacker.id,targetId:e.targetId,ownerId:e.targetId,key,ability:ability.name,round:this.state.round},this.allUnits);});
      killEvents.forEach(e=>{this.pushEvent('kill',e);this.processMechanicEvent('KILL',{actorId:attacker.id,sourceId:attacker.id,targetId:e.targetId,bonus:1},this.allUnits);window.POWDER_MECHANICS_V2?.purgeTargetStacks?.(this.allRosterUnits,e.targetId);});
      return {damage:total,heal:0,targets,impacts};
    }

    resolveTargetCoreReactions(actor,key){
      if(!actor||key==='basic'||actor.defeated)return [];
      const M=window.POWDER_MECHANICS_V2,out=[];
      for(const source of this.allUnits){
        if(!source||source.defeated||source.side===actor.side||source.coreMechanic?.engine!=='TARGET_STACK')continue;
        if(source.powId==='umbrael'&&key!=='basic'){
          const cursed=Object.keys(actor.statuses||{}).concat(Object.keys(actor.customStatuses||{})).some(x=>/Nguyền|Curse|Tử Chú|Suy Vong/i.test(x));
          if(cursed){const ch=M?.gainTargetStack?.(source,actor.id,1,'Nguyền kích hoạt khi dùng kỹ năng',2,{sourceKey:'core',sourceAbility:'Luật Hắc Ám'});if(ch?.delta>0)this.pushEvent('target-core',{sourceId:source.id,unitId:source.id,targetId:actor.id,powId:source.powId,resourceName:ch.resourceName,before:ch.before,after:ch.after,max:ch.max,delta:ch.delta,reason:ch.reason,payoff:false,reaction:true});this.processMechanicEvent('CURSE_TRIGGER',{actorId:source.id,sourceId:source.id,targetId:actor.id,reason:'Nguyền gây hiệu ứng'},[source]);}
        }
        const stacks=Number(M?.targetStackValue?.(source,actor.id)||0);if(stacks<=0)continue;
        let desc='',skillKey='';
        const stackRow=M?.targetStackData?.(source,actor.id)||null;
        const preferred=stackRow?.sourceKey?[stackRow.sourceKey]:[];
        const order=[...preferred,...['basic','skill1','skill2','ultimate'].filter(k=>!preferred.includes(k))];
        for(const k of order){const d=String(M?.canonicalSkill?.(source,k)?.description||'');if(/khi mục tiêu[^.;]{0,55}dùng kỹ năng|khi mục tiêu có [^.;]{0,30} dùng kỹ năng|khi mục tiêu dùng kỹ năng/i.test(d)){desc=d;skillKey=k;break;}}
        if(!desc)continue;
        const pctM=desc.match(/(?:gây|nhận)\s*(\d+(?:\.\d+)?)%\s*(AP|ATK|DEF)(?:\s*mỗi tầng)?/i);if(!pctM)continue;
        const perStack=/mỗi tầng/i.test(desc),pct=(Number(pctM[1])||0)*(perStack?stacks:1),stat=String(pctM[2]||'AP').toUpperCase(),pseudo={name:`${source.coreMechanic.targetResourceName||'Bẫy'} · Phản ứng`,power:pct,type:stat==='ATK'?'physical':'elemental'};
        const calc=E.calculateDamage(source,actor,pseudo,{key:skillKey||'skill1',area:false,rng:this.rng});
        let dealt={damage:0,absorbed:0};
        if(!calc.evaded&&!actor.defeated){const before=actor.hp,shieldBefore=Math.max(0,Number(actor.shield)||0),amount=Math.max(1,Math.round(calc.amount*DAMAGE_PACING*rankDamagePacing(source)));dealt=E.damageTarget(actor,amount);this.pushEvent('damage',{sourceId:source.id,key:skillKey||'skill1',ability:pseudo.name,impacts:[{targetId:actor.id,damage:dealt.damage,absorbed:dealt.absorbed,crit:false,hpBefore:before,hpAfter:actor.hp,shieldBefore,shieldAfter:Math.max(0,Number(actor.shield)||0),shieldBreak:shieldBefore>0&&Number(actor.shield)<=0,killed:actor.defeated,evaded:false,hitChance:calc.hitChance,mitigation:calc.mitigation}],total:dealt.damage,targetCoreReaction:true});}
        let meterDelta=0;const meterM=desc.match(/mất\s*(\d+(?:\.\d+)?)%\s*thanh lượt/i);if(meterM&&!actor.defeated){const before=Number(actor.meter)||0,m=Number(meterM[1])||0;actor.meter=clamp(before-m,0,100);meterDelta=actor.meter-before;if(meterDelta){this.pushEvent('meter-change',{sourceId:source.id,targetId:actor.id,before,after:actor.meter,delta:meterDelta,ability:pseudo.name});this.processMechanicEvent('METER_CHANGE',{actorId:source.id,sourceId:source.id,targetId:actor.id,side:source.side,before,after:actor.meter,delta:meterDelta,round:this.state.round},this.allUnits);}}
        const speedM=desc.match(/giảm\s*(\d+(?:\.\d+)?)%\s*SPEED[^.;]{0,20}?(\d+)\s*lượt/i);if(speedM&&!actor.defeated){const value=-(Number(speedM[1])||0)/100,duration=Math.max(1,Number(speedM[2])||1),buff=E.addCombatBuff(actor,{id:`CORETRAP:${source.id}:${actor.id}:SPEED`,stat:'SPEED',value,duration,sourcePowId:source.powId,stacking:'MAX',dispellable:true});if(buff)this.pushEvent('buff-apply',{sourceId:source.id,targetId:actor.id,key:skillKey,ability:pseudo.name,stat:'SPEED',value:buff.value,duration:buff.duration,label:'SPEED',icon:'⌛'});}
        const change=M?.spendTargetStack?.(source,actor.id,1,'Bẫy/Khe kích hoạt');if(change?.delta)this.pushEvent('target-core',{sourceId:source.id,unitId:source.id,targetId:actor.id,powId:source.powId,resourceName:change.resourceName,before:change.before,after:change.after,max:change.max,delta:change.delta,reason:change.reason,payoff:true,reaction:true});
        this.pushEvent('target-core-reaction',{sourceId:source.id,targetId:actor.id,resourceName:source.coreMechanic.targetResourceName||'Bẫy',stacksBefore:stacks,damage:dealt.damage||0,meterDelta,ability:pseudo.name});
        if(actor.defeated){this.pushEvent('kill',{sourceId:source.id,targetId:actor.id,ability:pseudo.name,crit:false});M?.purgeTargetStacks?.(this.allRosterUnits,actor.id);}
        out.push({source,damage:dealt.damage||0});
      }
      return out;
    }

    executeAction(attacker,key,requestedTargetId,knowledge={baseWrong:0,extraCorrect:0}){
      if(!attacker || attacker.defeated || attacker.id!==this.state.current?.id)throw new Error('Invalid current actor.');
      if(!this.canUse(attacker,key))throw new Error(`Ability ${key} is not available.`);
      const ability=this.ability(attacker,key);
      const cost=this.abilityCost(attacker,key);
      const joltailCounter=attacker.powId==='joltail'?Number(attacker?.resources?.get?.('core')?.current)||0:0;
      const joltailThird=attacker.powId==='joltail'&&joltailCounter>=2&&(key==='basic'||key==='skill1');
      const manaBefore=Number(attacker.mana)||0, rageBefore=Number(attacker.rage)||0, comboBefore=Number(attacker.combo)||0;
      attacker.mana=Math.max(0,attacker.mana-cost);
      if(key==='ultimate')attacker.rage=0;
      else if(key==='exclusive'){attacker.rage=Math.max(0,Number(attacker.rage||0)-90);attacker.exclusiveUsed=true;}
      this.resolveTargetCoreReactions(attacker,key);
      if(attacker.defeated){this.pushEvent('action-cancelled',{sourceId:attacker.id,key,ability:ability.name,reason:'Bị Core phản ứng hạ gục trước khi thi triển'});this.queueReplacements();this.checkEnd();return{ability,key,targets:[],result:{damage:0,heal:0,targets:[]},scale:1,cancelled:true};}
      const targets=this.targetsFor(attacker,ability,key,requestedTargetId);
      const supportAction=isSupport(ability)||(ability?.target==='enemy-or-ally'&&targets[0]?.side===attacker.side);
      const statusBefore=this.allStatusSnapshots();
      const scale=knowledgeScale(Number(knowledge.baseWrong)||0,Number(knowledge.extraCorrect)||0);
      const effectScale=knowledgeEffectScale(Number(knowledge.baseWrong)||0,Number(knowledge.extraCorrect)||0);
      attacker._knowledgeEffectScale=effectScale;
      const M=window.POWDER_MECHANICS_V2;
      const payoff=M?.consumeCorePayoff?.(attacker,key)||null;
      if(payoff?.change?.delta)this.emitCoreResource(attacker,payoff.change);
      const targetPayoff=M?.consumeTargetPayoff?.(attacker,key,targets)||null;
      if(targetPayoff?.changes?.length){
        for(const row of targetPayoff.changes){const ch=row.change;if(!ch||!ch.delta)continue;this.pushEvent('target-core',{sourceId:attacker.id,unitId:attacker.id,targetId:row.targetId,powId:attacker.powId,resourceName:ch.resourceName,before:ch.before,after:ch.after,max:ch.max,delta:ch.delta,reason:ch.reason,payoff:true,scale:row.scale,perPct:row.perPct});}
      }
      const storedPlan=M?.storedPayoffPlan?.(attacker,key)||null;
      const coreScale=payoff?.scale||1,finalScale=scale*coreScale,finalEffectScale=effectScale*coreScale;
      if(payoff)this.pushEvent('core-payoff',{unitId:attacker.id,sourceId:attacker.id,powId:attacker.powId,key,ability:ability.name,resourceName:payoff.change?.resource?.displayName||attacker.coreMechanic?.resourceName||'Nội tại',spent:Math.abs(Number(payoff.change?.delta)||0),before:payoff.change?.before,after:payoff.change?.after,max:payoff.change?.resource?.max||0,kind:payoff.kind,perPct:payoff.perPct,coreScale});
      if(key==='exclusive'){
        this.state.exclusiveTeamLock=this.state.exclusiveTeamLock||{player:null,enemy:null};
        this.state.exclusiveTeamLock[attacker.side]={round:this.state.round,sourceId:attacker.id,powId:attacker.powId};
        this.pushEvent('exclusive-lock',{sourceId:attacker.id,side:attacker.side,round:this.state.round,untilRound:this.state.round+1,ability:ability.name});
      }
      let result;
      if(supportAction)result=this.supportEffect(attacker,ability,targets,key,finalEffectScale,finalScale);
      else result=this.offensiveEffect(attacker,ability,key,targets,finalScale,targetPayoff,effectScale);
      if(joltailThird&&!supportAction){
        const target=(targets||[])[0];
        if(target&&!target.defeated){
          const pct=key==='skill1'?78:65,pseudo={name:key==='skill1'?'Phát Thứ Ba Cưỡng Chế · Tia phụ':'Lôi Tiễn Đếm Nhịp · Tia thứ ba',power:pct,type:'physical',target:'enemy'};
          const calc=E.calculateDamage(attacker,target,pseudo,{key,area:false,combo:attacker.combo,rng:this.rng});
          if(!calc.evaded){const hpBefore=target.hp,shieldBefore=Math.max(0,Number(target.shield)||0),amount=Math.max(1,Math.round(calc.amount*DAMAGE_PACING*rankDamagePacing(attacker)*finalScale)),dealt=E.damageTarget(target,amount),impact={targetId:target.id,damage:dealt.damage,absorbed:dealt.absorbed,crit:Boolean(calc.crit),element:calc.element,hpBefore,hpAfter:target.hp,shieldBefore,shieldAfter:Math.max(0,Number(target.shield)||0),shieldBreak:shieldBefore>0&&Number(target.shield)<=0,killed:Boolean(target.defeated),evaded:false,hitChance:calc.hitChance,mitigation:calc.mitigation};this.pushEvent('damage',{sourceId:attacker.id,key,ability:pseudo.name,impacts:[impact],total:dealt.damage,followup:true,joltailThird:true});this.processMechanicEvent('DAMAGE_TAKEN',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,damage:dealt.damage,absorbed:dealt.absorbed,hpBefore,hpAfter:target.hp,area:false,key,round:this.state.round},[target]);this.processMechanicEvent('ALLY_DAMAGE',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,key,ability:pseudo.name,damage:dealt.damage,impacts:[impact]},this.allUnits);if(impact.shieldBreak)this.processMechanicEvent('SHIELD_BREAK',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,ownerId:target.id,key,ability:pseudo.name,round:this.state.round},this.allUnits);if(impact.killed){this.pushEvent('kill',{sourceId:attacker.id,targetId:target.id,ability:pseudo.name,crit:Boolean(calc.crit)});this.processMechanicEvent('KILL',{actorId:attacker.id,sourceId:attacker.id,targetId:target.id,bonus:1},this.allUnits);M?.purgeTargetStacks?.(this.allRosterUnits,target.id);}}
        }
      }
      if(storedPlan){
        const consumed=M?.consumeStoredDamage?.(attacker,1,`Kích hoạt ${storedPlan.skillName}`);
        if(consumed?.used>0){
          let bonusDamage=0,bonusShield=0;
          if(storedPlan.damagePct>0 && !supportAction){
            const liveTargets=(targets||[]).filter(t=>t&&!t.defeated);
            const each=Math.round(consumed.used*storedPlan.damagePct/100);
            for(const target of liveTargets){const before=target.hp,hit=E.damageTarget(target,each);bonusDamage+=hit.damage;this.pushEvent('damage',{sourceId:attacker.id,key,ability:`${ability.name} · Phản trả`,impacts:[{targetId:target.id,damage:hit.damage,absorbed:hit.absorbed,crit:false,hpBefore:before,hpAfter:target.hp,shieldBefore:0,shieldAfter:Math.max(0,Number(target.shield)||0),shieldBreak:false,killed:target.defeated,evaded:false}],total:hit.damage,storedPayoff:true});}
          }
          if(storedPlan.teamShieldPct>0){for(const ally of this.living(attacker.side)){const r=E.addShield(ally,Math.round(consumed.used*storedPlan.teamShieldPct/100),attacker,2,{capRatio:ally.combatRole==='tank'?.80:.60});if(r?.added){bonusShield+=r.added;this.pushEvent('shield',{sourceId:attacker.id,targetId:ally.id,amount:r.added,label:`${storedPlan.skillName} · Tích trữ`});}}}
          if(storedPlan.selfShieldPct>0){const r=E.addShield(attacker,Math.round(consumed.used*storedPlan.selfShieldPct/100),attacker,2,{capRatio:attacker.combatRole==='tank'?.80:.60});if(r?.added){bonusShield+=r.added;this.pushEvent('shield',{sourceId:attacker.id,targetId:attacker.id,amount:r.added,label:`${storedPlan.skillName} · Tích trữ`});}}
          this.pushEvent('core-store-payoff',{unitId:attacker.id,sourceId:attacker.id,powId:attacker.powId,resourceName:attacker.coreMechanic?.resourceName||'Sát thương lưu',spent:consumed.used,before:consumed.before,after:consumed.after,cap:consumed.cap,damagePct:storedPlan.damagePct,teamShieldPct:storedPlan.teamShieldPct,selfShieldPct:storedPlan.selfShieldPct,bonusDamage,bonusShield,key,ability:ability.name});
        }
      }
      const targetGains=M?.targetStackGainPlan?.(attacker,key,result,targets)||[];
      for(const row of targetGains){const ch=M?.gainTargetStack?.(attacker,row.target.id,row.amount,`Kỹ năng ${ability.name}`,row.duration||0,{sourceKey:row.sourceKey||key,sourceAbility:ability.name});if(ch?.delta>0)this.pushEvent('target-core',{sourceId:attacker.id,unitId:attacker.id,targetId:row.target.id,powId:attacker.powId,resourceName:ch.resourceName,before:ch.before,after:ch.after,max:ch.max,delta:ch.delta,reason:ch.reason,payoff:false});}
      if(attacker?.coreMechanic?.storedDamage){const d=String(M?.canonicalSkill?.(attacker,key)?.description||'');const m=d.match(/trong\s*(\d+)\s*lượt[^.;]{0,90}?→\s*(\d+(?:\.\d+)?)%/i);if(m){attacker.coreRuntime.storeRateTurns=Math.max(1,Number(m[1])||1);attacker.coreRuntime.storeRateOverride=Math.max(0,Math.min(.8,(Number(m[2])||0)/100));this.pushEvent('core-store-rate',{unitId:attacker.id,sourceId:attacker.id,rate:attacker.coreRuntime.storeRateOverride,turns:attacker.coreRuntime.storeRateTurns,expired:false});}}
      this.applyCanonicalBuffs(attacker,ability,targets,key,effectScale);
      this.applyCanonicalDispel(attacker,ability,key);
      this.emitStatusApplications(statusBefore,attacker.id);
      attacker._knowledgeEffectScale=1;
      if(key==='basic'){const manaFlow=manaPacingFor(attacker);this.grantMana(attacker,manaFlow.basic,`Đòn cơ bản · +${manaFlow.basic} MP`,{reason:'BASIC_REGEN',rarity:manaFlow.rarity});}
      attacker.rage=clamp(attacker.rage+actionRageGain(key),0,100);
      attacker.combo = Number(knowledge.baseWrong||0)===0 ? clamp(attacker.combo+1+Number(knowledge.extraCorrect||0),0,5) : 0;
      this.processMechanicEvent('SELF_ACTION',{actorId:attacker.id,sourceId:attacker.id,side:attacker.side,key,ability,cost,actorElement:attacker.element,extraCorrect:Number(knowledge.extraCorrect)||0,result,targetIds:targets.map(t=>t.id),round:this.state.round},[attacker]);
      this.processMechanicEvent('ALLY_ACTION',{actorId:attacker.id,sourceId:attacker.id,side:attacker.side,key,ability,cost,actorElement:attacker.element,round:this.state.round},this.allUnits);
      if(key!=='basic')this.processMechanicEvent('ALLY_SKILL',{actorId:attacker.id,sourceId:attacker.id,side:attacker.side,key,ability,cost,requiresMana:true,actorElement:attacker.element,round:this.state.round},this.allUnits);
      const manaDelta=(Number(attacker.mana)||0)-manaBefore;if(manaDelta!==0)this.processMechanicEvent('MANA_CHANGE',{actorId:attacker.id,sourceId:attacker.id,side:attacker.side,key,cost,delta:manaDelta,before:manaBefore,after:Number(attacker.mana)||0,round:this.state.round},this.allUnits);
      this.processMechanicEvent('END_TURN',{actorId:attacker.id,sourceId:attacker.id,side:attacker.side,key,cost},[attacker]);
      attacker.lastAction={key,abilityName:ability.name,scale,effectScale,coreScale:payoff?.scale||1,finalScale:scale*(payoff?.scale||1),finalEffectScale:effectScale*(payoff?.scale||1),at:Date.now()};
      if(this.state.pvp){this.state.pvp.lastActiveSide=attacker.side;this.state.pvp.lastActionAt=Date.now();}
      this.pushLog(`${attacker.name} dùng ${ability.name}${scale!==1||effectScale!==1?` · Kiến thức DMG x${scale.toFixed(2)} · FX x${effectScale.toFixed(2)}`:''}.`,attacker.side==='player'?'player':'enemy');
      this.pushEvent('action',{sourceId:attacker.id,key,ability:ability.name,targetIds:targets.map(t=>t.id),scale,effectScale,coreScale:payoff?.scale||1,finalScale:scale*(payoff?.scale||1),finalEffectScale:effectScale*(payoff?.scale||1),coreSpent:payoff?Math.abs(Number(payoff.change?.delta)||0):0,result,cost,manaBefore,manaAfter:Number(attacker.mana)||0,rageBefore,rageAfter:Number(attacker.rage)||0,comboBefore,comboAfter:Number(attacker.combo)||0,baseWrong:Number(knowledge.baseWrong)||0,extraCorrect:Number(knowledge.extraCorrect)||0,tamerSimple:this.activeSimple?.(attacker.side)?.id||null,domain:this.activeDomain?.(attacker.side)?.id||null});
      this.queueReplacements();
      this.checkEnd();
      return {ability,key,targets,result,scale};
    }

    performAction(attacker,key,requestedTargetId,knowledge={baseWrong:0,extraCorrect:0}){
      // 19.6: one action transaction at a time. Prevents double-click/double-dispatch from spending resources twice.
      if(this._actionTxn){this.pushEvent('action-rejected',{sourceId:attacker?.id||null,key,reason:'ACTION_TRANSACTION_BUSY'});return null;}
      this._actionTxn=true;
      let result=null, error=null;
      try{
        result=this.executeAction(attacker,key,requestedTargetId,knowledge);
      }catch(err){
        error=err;
        this.pushLog(`${attacker?.name||'Pow'} gặp lỗi dữ liệu kỹ năng; lượt được kết thúc an toàn.`,'danger');
        this.pushEvent('action-error',{sourceId:attacker?.id||null,key,message:String(err?.message||err)});
      }finally{
        if(attacker)attacker._knowledgeEffectScale=1;
        if(this.state.current?.id===attacker?.id)this.finishCurrent(Boolean(error));
        this.finalizeKillManaRewards();
        this._actionTxn=false;
      }
      if(error)throw error;
      return result;
    }

    aiAbilityScore(unit,key){
      if(!this.canUse(unit,key))return -9999;
      const ability=this.ability(unit,key), role=unit.combatRole||'marksman', text=`${ability?.name||''} ${ability?.description||ability?.rulesText||''}`.toLowerCase();
      const allies=unit.side==='player'?this.living('player'):this.living('enemy');
      const enemies=unit.side==='player'?this.living('enemy'):this.living('player');
      const hpRatio=u=>u.hp/Math.max(1,u.maxHp), effectiveRatio=u=>(u.hp+Math.max(0,Number(u.shield)||0))/Math.max(1,u.maxHp);
      const allyLow=allies.reduce((m,u)=>Math.min(m,hpRatio(u)),1), allyEffectiveLow=allies.reduce((m,u)=>Math.min(m,effectiveRatio(u)),1), enemyLow=enemies.reduce((m,u)=>Math.min(m,hpRatio(u)),1);
      const support=isSupport(ability), hardCC=new Set(['Stun','Freeze','Paralysis','Bind','Silence']), allyCC=allies.some(a=>Object.keys(a.statuses||{}).concat(Object.keys(a.customStatuses||{})).some(x=>hardCC.has(x)));
      const manaRatio=unit.mana/Math.max(1,unit.maxMana), core=[...(unit.resources instanceof Map?unit.resources.values():[])].find(r=>r?.visible), coreReady=Boolean(core&&core.current>=core.max);
      let score=key==='ultimate'?74:key==='exclusive'?70:key==='skill2'?52:key==='skill1'?36:20;
      const pressureLevel=Number(combatPressure(this.state.round)?.level)||0;
      // Late anti-stall pressure must also change AI intent: heal/tank teams should stop
      // endlessly refreshing sustain and actively seek a finish as the battlefield escalates.
      if(pressureLevel>0)score+=support?-pressureLevel*6:pressureLevel*5;
      if(key==='basic' && manaRatio<0.22)score+=34;
      if(key!=='basic' && manaRatio<0.18)score-=26;
      if(key==='ultimate' && enemyLow<0.18 && !['assassin','marksman'].includes(role))score-=18;
      if(coreReady && /đủ|tầng|ấn|phách|nhịp|tiêu|kích hoạt|bùng nổ|cường hóa/.test(text))score+=26;
      if(support){
        score-=20;
        const shieldSkill=/shield|giáp|khiên|bảo hộ|guard/.test(text)||ability?.status==='Shield';
        const cleanseSkill=/cleanse|thanh tẩy|giải|xóa.*debuff/.test(text)||ability?.status==='Cleanse';
        const healSkill=/heal|hồi|trị liệu|regeneration|regen/.test(text)||ability?.status==='Regeneration';
        if(cleanseSkill)score+=allyCC?72:-30;
        if(healSkill){
          if(role==='healer')score+=allyLow<0.38?82:allyLow<0.62?52:allyLow<0.80?14:-34;
          else score+=allyLow<0.45?44:allyLow<0.70?12:-22;
        }
        if(shieldSkill)score+=allyEffectiveLow<0.46?56:allyEffectiveLow<0.72?24:4;
        if(role==='tank')score+=allyEffectiveLow<0.52?28:4;
        if(role==='knight')score+=allyEffectiveLow<0.50?24:3;
        if(role==='enchanter'||role==='musician')score+=12;
        if(ability?.status==='Speed Up' && allies.some(a=>!a.statuses?.['Speed Up']&&!a.customStatuses?.['Speed Up']))score+=18;
      }else{
        if(role==='assassin')score+=enemyLow<0.35?44:16;
        if(role==='marksman')score+=enemyLow<0.45?28:12;
        if(role==='mage' && isArea(ability) && enemies.length>1)score+=26;
        if(isArea(ability) && enemies.length>=3)score+=14;
        if(ability.status){
          const redundant=enemies.every(t=>Boolean(t.statuses?.[ability.status]||t.customStatuses?.[ability.status]));
          score+=redundant?-18:12;
        }
        if(unit.boss){
          const phase=Number(unit.bossPhase||1);if(key==='ultimate')score+=phase>=3?64:phase===2?40:24; else if(key==='skill2')score+=phase>=2?30:16; else if(key==='skill1')score+=phase>=2?16:8;
          if(phase>=2&&isArea(ability))score+=18;if(phase>=3&&!support)score+=18;score+=phase*6;
        }
      }
      const M=window.POWDER_MECHANICS_V2;
      if(unit?.coreMechanic?.engine==='TARGET_STACK'){
        const totalStacks=enemies.reduce((sum,t)=>sum+Number(M?.targetStackValue?.(unit,t.id)||0),0),capacity=Math.max(1,(Number(unit.coreMechanic.targetMax)||3)*Math.max(1,enemies.length));
        if(/tiêu|nổ|kích nổ|xóa toàn bộ|mất 1/.test(text))score+=Math.min(46,totalStacks*10);
        if(/đặt|tạo|gieo/.test(text)&&totalStacks<capacity*.45)score+=14;
      }
      if(unit?.coreMechanic?.storedDamage){const cur=Math.max(0,Number(unit.coreRuntime?.storedDamage)||0),cap=Math.max(1,Math.round(unit.maxHp*(Number(unit.coreMechanic.storedDamage.capRatio)||.2))),ratio=cur/cap;if(/tiêu toàn bộ/.test(text)){score+=Math.round(ratio*60);if(ratio<.12)score-=24;}if(/tỷ lệ lưu|lưu vào/.test(text)&&ratio<.65)score+=18;}
      const enemyShield=enemies.reduce((s,u)=>s+Math.max(0,Number(u.shield)||0),0);
      if(enemyShield>0 && /phá giáp|shield break|xuyên|pierce|break/.test(text))score+=20;
      const personality=window.POWDER_AI_PERSONALITY_V22?.abilityAdjustment?.(unit,ability,key,{core:this,round:this.state.round,enemyLow,allyLow,debuffs:allies.reduce((n,a)=>n+Object.keys(a.statuses||{}).filter(s=>!BENEFICIAL.has(s)).length,0),avgShield:allies.reduce((n,a)=>n+Math.min(1,(Number(a.shield)||0)/Math.max(1,a.maxHp)),0)/Math.max(1,allies.length),allies:allies.length,enemies:enemies.length,alliesList:allies,enemiesList:enemies,selfHp:hpRatio(unit),bossPhase:Number(unit.bossPhase||1),aiTier:unit.aiTier||'standard'});if(personality)score+=Number(personality.score)||0;
      return score + this.rng()*6;
    }

    aiTargetFor(unit,ability,key,legal){
      if(!legal?.length)return null;
      const role=unit.combatRole||'marksman';
      if(isSupport(ability)){
        if(ability.target==='self')return unit;
        const sorted=[...legal].sort((a,b)=>(a.hp/Math.max(1,a.maxHp))-(b.hp/Math.max(1,b.maxHp)));
        if(role==='healer')return sorted[0]||unit;
        if(role==='tank' || role==='knight'){
          const self=legal.find(x=>x.id===unit.id);
          return self && unit.hp/unit.maxHp<0.72 ? self : (sorted[0]||self||unit);
        }
        return sorted[0]||unit;
      }
      if(isArea(ability))return legal[0];
      const coreText=String(ability?.description||ability?.rulesText||'').toLowerCase();
      if(unit?.coreMechanic?.engine==='TARGET_STACK' && /tiêu|nổ|kích nổ|xóa|mất 1/.test(coreText)){
        const M=window.POWDER_MECHANICS_V2,marked=[...legal].sort((a,b)=>Number(M?.targetStackValue?.(unit,b.id)||0)-Number(M?.targetStackValue?.(unit,a.id)||0));
        if(Number(M?.targetStackValue?.(unit,marked[0]?.id)||0)>0)return marked[0];
      }
      if(role==='assassin'){
        // Assassins hunt fragile, injured backline-style targets instead of blindly following Presence.
        return [...legal].sort((a,b)=>{
          const ra=a.hp/Math.max(1,a.maxHp), rb=b.hp/Math.max(1,b.maxHp);
          const fragileA=['mage','marksman','healer','enchanter'].includes(a.combatRole)?0.16:0;
          const fragileB=['mage','marksman','healer','enchanter'].includes(b.combatRole)?0.16:0;
          const markA=a.customStatuses?.['Hunt Mark']?0.18:0, markB=b.customStatuses?.['Hunt Mark']?0.18:0;
          const scoreA=(1-ra)*0.72 + fragileA + markA - (Number(a.presence)||0)/1000;
          const scoreB=(1-rb)*0.72 + fragileB + markB - (Number(b.presence)||0)/1000;
          return scoreB-scoreA;
        })[0];
      }
      if(role==='marksman'){
        const marked=legal.filter(x=>x.customStatuses?.['Aim Mark']);
        if(marked.length)return [...marked].sort((a,b)=>a.hp-b.hp)[0];
        if(key==='ultimate' || key==='skill2')return [...legal].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
      }
      if(role==='mage' && ability.status){
        return [...legal].sort((a,b)=>(Number(b.meter)||0)-(Number(a.meter)||0))[0];
      }
      if(unit.boss){
        const marked=legal.filter(x=>x.customStatuses?.['Boss Mark']);if(marked.length)return [...marked].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
      }
      if(unit.boss && key==='ultimate'){
        const injured=legal.filter(x=>x.hp/x.maxHp<0.45);
        if(injured.length)return [...injured].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
      }
      const base=this.weightedPresenceTarget(legal),AI=window.POWDER_AI_PERSONALITY_V22,ctx={core:this,round:this.state.round,alliesList:unit.side==='player'?this.living('player'):this.living('enemy'),enemiesList:unit.side==='player'?this.living('enemy'):this.living('player'),aiTier:unit.aiTier||'standard'};if(AI?.targetAdjustment&&legal.length>1){const baseAdj=Number(AI.targetAdjustment(unit,base,ability,key,ctx)?.score)||0,best=[...legal].map(x=>({x,s:Number(AI.targetAdjustment(unit,x,ability,key,ctx)?.score)||0})).sort((a,b)=>b.s-a.s)[0];const margin=unit.aiTier==='elite'?4:unit.boss?2:8;if(best&&best.s>baseAdj+margin)return best.x;}return base;
    }

    enemyDecision(unit){
      const options=['ultimate','exclusive','skill2','skill1','basic'].filter(k=>this.canUse(unit,k));
      const ranked=options.map(key=>({key,score:this.aiAbilityScore(unit,key)})).sort((a,b)=>b.score-a.score);
      let pick=ranked[0]||{key:'basic',score:0};
      // Standard PvE keeps a little human-readable imperfection. Elite/Boss use the best tactical line.
      if(!unit.boss && unit.aiTier==='standard' && ranked[1] && ranked[0].score-ranked[1].score<7 && this.rng()<.24)pick=ranked[1];
      const key=pick.key||'basic';
      const ability=this.ability(unit,key);
      const legal=this.legalTargets(unit,ability,key);
      const target=this.aiTargetFor(unit,ability,key,legal);
      const decision={key,targetId:target?.id||null,ability,aiScore:pick.score||0,candidates:ranked.slice(0,3)};
      unit.aiDecisionCount=(Number(unit.aiDecisionCount)||0)+1;
      const AI=window.POWDER_AI_PERSONALITY_V22,summary=AI?.decisionSummary?.(this,unit,decision)||null;
      if(summary)Object.assign(decision,{aiTier:summary.tier,aiIntent:summary.intent,aiHint:summary.hint,aiPatternId:summary.patternId,aiConfidence:summary.confidence});
      if(unit.boss&&summary){this.pushEvent('boss-pattern-telegraph',{bossId:unit.id,bossType:this.bossType,phase:Number(unit.bossPhase||1),patternId:summary.patternId,intent:summary.intent,detail:summary.hint,key,targetId:target?.id||null,confidence:summary.confidence});}
      else this.pushEvent('ai-decision',{sourceId:unit.id,key,targetId:target?.id||null,intent:summary?.intent||'',aiTier:unit.aiTier||'standard',confidence:summary?.confidence||0});
      return decision;
    }

    replacementScore(side,slot,u){
      const line=side==='enemy'?this.state.enemies:this.state.team,others=line.filter((x,i)=>i!==Number(slot)&&x&&!x.defeated),dead=line[Number(slot)],roles=others.map(x=>x.combatRole),foes=side==='enemy'?this.living('player'):this.living('enemy');let score=Math.max(0,Math.min(1,u.hp/Math.max(1,u.maxHp)))*30;
      if(dead?.combatRole===u.combatRole)score+=16;if(!roles.some(r=>['tank','knight'].includes(r))&&['tank','knight'].includes(u.combatRole))score+=24;if(!roles.includes('healer')&&u.combatRole==='healer')score+=22;if(foes.some(x=>x.hp/Math.max(1,x.maxHp)<.35)&&['assassin','marksman'].includes(u.combatRole))score+=15;
      const core=[...(u.resources instanceof Map?u.resources.values():[])].find(r=>r?.visible);if(core&&Number(core.current)>=Number(core.max))score+=18;if(Number(u.rage)>=80)score+=10;return score;
    }

    autoReplaceEnemy(){
      if(this.state.finished||this.state.current)return false;
      let changed=false;
      for(let i=0;i<this.state.enemies.length;i++){
        const dead=this.state.enemies[i];if(!dead?.defeated)continue;if(this.mode==='boss'&&dead.boss)continue;
        const ranked=this.state.enemyReserves.map((r,idx)=>({r,idx,score:r&&!r.defeated?this.replacementScore('enemy',i,r):-9999})).filter(x=>x.score>-9000).sort((a,b)=>b.score-a.score),idx=ranked[0]?.idx??-1;if(idx<0)break;
        const incoming=this.state.enemyReserves.splice(idx,1)[0];incoming.isReserve=false;incoming.meter=0;incoming.rage=Math.max(20,incoming.rage||20);incoming.teamIndex=i;
        this.state.enemies[i]=incoming;changed=true;
        this.pushLog(`${incoming.name} vào sân từ dự bị AI.`,'replace');this.pushEvent('replacement',{side:'enemy',slot:i,unitId:incoming.id,replacedId:dead.id});
      }
      return changed;
    }

    queueReplacements(){
      if(this.state.finished)return;
      if(this.mode!=='pvp')this.autoReplaceEnemy();
      const existing=new Set(this.state.replacementQueue),enemyExisting=new Set(this.state.enemyReplacementQueue);
      for(let i=0;i<this.state.team.length;i++){
        const unit=this.state.team[i];
        if(unit?.defeated && this.state.reserves.some(r=>!r.defeated) && !existing.has(i)){this.state.replacementQueue.push(i);existing.add(i);}
      }
      if(this.mode==='pvp')for(let i=0;i<this.state.enemies.length;i++){
        const unit=this.state.enemies[i];
        if(unit?.defeated && this.state.enemyReserves.some(r=>!r.defeated) && !enemyExisting.has(i)){this.state.enemyReplacementQueue.push(i);enemyExisting.add(i);}
      }
      if(!this.state.current && (this.state.replacementQueue.length||this.state.enemyReplacementQueue.length)){
        const entering=this.state.phase!=='replacement';
        this.state.phase='replacement';
        if(!this.state.replacementSide)this.state.replacementSide=this.state.replacementQueue.length?'player':'enemy';
        if(entering)this.pushEvent('replacement-needed',{side:this.state.replacementSide,slots:[...(this.state.replacementSide==='player'?this.state.replacementQueue:this.state.enemyReplacementQueue)]});
      }
    }

    replace(slot,reserveId,side='player'){
      if(this.state.phase!=='replacement')return false;
      side=side==='enemy'?'enemy':'player';
      if(this.state.replacementSide && side!==this.state.replacementSide)return false;
      const queue=side==='player'?this.state.replacementQueue:this.state.enemyReplacementQueue;
      const reserves=side==='player'?this.state.reserves:this.state.enemyReserves;
      const line=side==='player'?this.state.team:this.state.enemies;
      const expected=queue[0]; if(Number(slot)!==Number(expected))return false;
      const idx=reserves.findIndex(r=>r.id===reserveId && !r.defeated); if(idx<0)return false;
      const incoming=reserves.splice(idx,1)[0]; incoming.isReserve=false; incoming.meter=0; incoming.rage=Math.max(20,incoming.rage||20); incoming.teamIndex=Number(slot);
      line[slot]=incoming; queue.shift();
      // If several active slots died but fewer reserves remain, stale queued slots must
      // be discarded or the battle can soft-lock forever in replacement phase.
      if(!reserves.some(r=>!r.defeated))queue.length=0;
      this.pushLog(`${incoming.name} vào sân thay thế.`,'replace'); this.pushEvent('replacement',{side,slot,unitId:incoming.id});
      if(!queue.length){
        const other=side==='player'?this.state.enemyReplacementQueue:this.state.replacementQueue;
        if(other.length){this.state.replacementSide=side==='player'?'enemy':'player';this.pushEvent('replacement-needed',{side:this.state.replacementSide,slots:[...other]});}
        else{this.state.replacementSide=null;this.state.phase='running';}
      }
      return true;
    }

    bossSignatureProfile(boss){
      const type=this.bossType||boss?.bossType||'daily',phase=Math.max(1,Number(boss?.bossPhase)||1);
      if(type==='weekly')return{id:'cataclysm',name:'Đại Nạn',icon:'☄',cadence:phase>=3?2:3,description:'Đếm ngược theo hành động Boss; khi kích hoạt gây 8% Max HP lên toàn đội, bỏ qua DEF.'};
      if(type==='promotion')return{id:'formation_break',name:'Phá Trận',icon:'⛓',cadence:phase>=2?2:3,description:'Phá 30% Giáp hiện tại của toàn đội và áp giảm hồi máu trong 2 lượt.'};
      return{id:'blood_hunt',name:'Huyết Liệp',icon:'🎯',cadence:phase>=2?2:3,description:'Đánh dấu Pow thấp HP nhất; AI Boss sẽ săn mục tiêu bị đánh dấu.'};
    }

    processBossSignature(boss){
      if(this.mode!=='boss'||!boss||boss.defeated)return;
      const sig=this.bossSignatureProfile(boss),cadence=Math.max(1,Number(sig.cadence)||3);boss.bossSigName=sig.name;boss.bossSigCounter=(Number(boss.bossSigCounter)||0)+1;
      const ready=boss.bossSigCounter>=cadence,remaining=ready?0:cadence-boss.bossSigCounter;boss.bossSigRemaining=remaining;
      if(!ready){this.pushEvent('boss-signature-charge',{bossId:boss.id,bossType:this.bossType,signatureId:sig.id,name:sig.name,remaining,cadence,description:sig.description});return;}
      boss.bossSigCounter=0;boss.bossSigRemaining=cadence;
      if(sig.id==='blood_hunt'){
        const legal=this.living('player');const target=[...legal].sort((a,b)=>a.hp/Math.max(1,a.maxHp)-b.hp/Math.max(1,b.maxHp))[0];
        if(target){target.customStatuses['Boss Mark']={turns:2,kind:'debuff',sourceId:boss.id};this.pushEvent('status-apply',{sourceId:boss.id,targetId:target.id,status:'Boss Mark',turns:2,kind:'debuff'});this.pushEvent('boss-signature',{bossId:boss.id,bossType:this.bossType,signatureId:sig.id,name:sig.name,targetIds:[target.id],detail:`${target.name} bị đánh dấu săn.`});}
      }else if(sig.id==='formation_break'){
        const targetIds=[];let broken=0;
        for(const u of this.living('player')){targetIds.push(u.id);const before=Math.max(0,Number(u.shield)||0),lost=Math.round(before*.30);u.shield=Math.max(0,before-lost);broken+=lost;u.customStatuses['AntiHeal']={turns:2,kind:'debuff',sourceId:boss.id,healingReceived:-.25};this.pushEvent('status-apply',{sourceId:boss.id,targetId:u.id,status:'AntiHeal',turns:2,kind:'debuff'});}
        this.pushEvent('boss-signature',{bossId:boss.id,bossType:this.bossType,signatureId:sig.id,name:sig.name,targetIds,shieldBroken:broken,detail:`Phá ${broken} Giáp · hồi máu nhận -25% trong 2 lượt.`});
      }else{
        const targetIds=[];let total=0;
        for(const u of this.living('player')){const before=u.hp,shieldBefore=Math.max(0,Number(u.shield)||0),amount=Math.max(1,Math.round(u.maxHp*.08)),dealt=E.damageTarget(u,amount);targetIds.push(u.id);total+=Number(dealt.damage)||0;const shieldAfter=Math.max(0,Number(u.shield)||0);this.pushEvent('damage',{sourceId:boss.id,key:'boss-signature',ability:'Đại Nạn',impacts:[{targetId:u.id,damage:dealt.damage,absorbed:dealt.absorbed||0,crit:false,hpBefore:before,hpAfter:u.hp,shieldBefore,shieldAfter,shieldBreak:shieldBefore>0&&shieldAfter<=0,killed:u.defeated,evaded:false,hitChance:100,mitigation:0}],total:dealt.damage,bossSignature:true});if(u.defeated)this.pushEvent('kill',{sourceId:boss.id,targetId:u.id,ability:'Đại Nạn',crit:false});}
        this.pushEvent('boss-signature',{bossId:boss.id,bossType:this.bossType,signatureId:sig.id,name:sig.name,targetIds,totalDamage:total,detail:`Toàn đội chịu 8% Max HP · tổng ${total} damage.`});this.queueReplacements();this.checkEnd();
      }
    }

    checkBossPhase(){
      const boss=this.state.enemies.find(u=>u.boss && !u.defeated); if(!boss)return;
      const ratio=boss.hp/Math.max(1,boss.maxHp),type=this.bossType||boss.bossType||'daily',policy=window.POWDER_AI_PERSONALITY_V22?.bossPolicy?.(type),thresholds=Array.isArray(policy?.thresholds)?policy.thresholds:(type==='daily'?[.50]:type==='weekly'?[.70,.35]:[.55]),maxPhase=thresholds.length+1;boss.bossMaxPhase=maxPhase;
      let desired=1;for(let i=0;i<thresholds.length;i++)if(ratio<=thresholds[i])desired=i+2;
      const nextThreshold=thresholds[Math.max(0,Number(boss.bossPhase||1)-1)];
      if(desired===boss.bossPhase && nextThreshold!=null && ratio<=nextThreshold+.10 && ratio>nextThreshold && boss._phaseWarned!==boss.bossPhase+1){boss._phaseWarned=boss.bossPhase+1;this.pushEvent('boss-phase-warning',{bossId:boss.id,phase:boss.bossPhase,nextPhase:boss.bossPhase+1,maxPhase,threshold:nextThreshold,hpRatio:ratio});}
      if(desired>boss.bossPhase){
        const from=boss.bossPhase;boss.bossPhase=desired;boss._phaseWarned=null;boss.bossSigCounter=0;boss.bossSigRemaining=this.bossSignatureProfile(boss).cadence;const power=type==='weekly'?1.16:type==='promotion'?1.14:1.12,speed=type==='weekly'?1.08:1.06;boss.stats.atk=Math.round(boss.stats.atk*power);boss.stats.ap=Math.round(boss.stats.ap*power);boss.stats.speed=Math.round(boss.stats.speed*speed);boss.rage=100;boss.meter=Math.min(85,(Number(boss.meter)||0)+12);
        const shield=Math.max(1,Math.round(boss.maxHp*(type==='weekly'?.12:type==='promotion'?.10:.08)));boss.shield=Math.max(0,Number(boss.shield)||0)+shield;this.pushEvent('shield',{sourceId:boss.id,targetId:boss.id,amount:shield,label:'Giáp chuyển pha'});
        const phaseName=desired>=3?'Cuồng Nộ Tối Hậu':desired===2?'Gia Tốc Chiến Thuật':'Thức Tỉnh';this.pushLog(`${boss.name} chuyển sang Pha ${desired}/${maxPhase}.`,'boss');this.pushEvent('boss-phase',{phase:desired,from,maxPhase,bossId:boss.id,bossType:type,phaseName,hpRatio:ratio,shield});
      }
    }

    registerAFK(side='player'){
      if(this.mode!=='pvp'||this.state.finished||!this.state.pvp)return 0;side=side==='enemy'?'enemy':'player';const n=(Number(this.state.pvp.afk?.[side])||0)+1;this.state.pvp.afk[side]=n;this.pushEvent('pvp-afk',{side,strikes:n,max:PVP_RULES.afkStrikesToForfeit});if(n>=PVP_RULES.afkStrikesToForfeit)this.surrender(side,'AFK_LIMIT');return n;
    }
    clearAFK(side='player'){if(this.state.pvp?.afk)this.state.pvp.afk[side==='enemy'?'enemy':'player']=0;}
    surrender(side='player',reason='SURRENDER'){
      if(this.mode!=='pvp'||this.state.finished)return false;side=side==='enemy'?'enemy':'player';this.state.finished=true;this.state.phase='finished';this.state.current=null;this.state.replacementQueue.length=0;this.state.enemyReplacementQueue.length=0;this.state.replacementSide=null;this.state.pvp.surrendered=side;this.state.result=side==='player'?'loss':'win';this.pushLog(`${side==='player'?'PLAYER A':'PLAYER B'} đầu hàng.`,'danger');this.pushEvent('pvp-surrender',{side,reason,result:this.state.result});this.pushEvent('battle-end',{result:this.state.result,surrendered:side,reason});return true;
    }
    integrationRecoverySnapshot(){
      const units=this.allRosterUnits.map(packRuntimeUnit),now=Date.now();return{format:'powder-combat-recovery-v1',combatVersion:'beta-final-1.1',createdAt:now,seed:this.seed,serial:this.serial,mode:this.mode,bossType:this.bossType,initial:safeClone(this.initialEntries,{player:[],enemy:[]}),runtime:{phase:this.state.phase,result:this.state.result,finished:this.state.finished,turnCount:this.state.turnCount,round:this.state.round,roundActionSize:this.state.roundActionSize,currentId:this.state.current?.id||null,replacementQueue:[...this.state.replacementQueue],enemyReplacementQueue:[...this.state.enemyReplacementQueue],replacementSide:this.state.replacementSide,exclusiveTeamLock:safeClone(this.state.exclusiveTeamLock,{}),tamerBySide:safeClone(this.state.tamerBySide||null,null),pvp:safeClone(this.state.pvp||null,null),teamIds:this.state.team.map(u=>u.id),reserveIds:this.state.reserves.map(u=>u.id),enemyIds:this.state.enemies.map(u=>u.id),enemyReserveIds:this.state.enemyReserves.map(u=>u.id),units},replay:this.replaySnapshot()};
    }
    recoverySnapshot(){
      if(this.mode!=='pvp'||!this.state.pvp)return null;const pack=this.integrationRecoverySnapshot(),now=Date.now();return{...pack,format:'powder-pvp-recovery-v2',expiresAt:now+PVP_RULES.reconnectGraceSeconds*1000};
    }

    checkEnd(){
      if(this.state.finished)return true;
      if(this.mode==='pvp' && Number(this.state.round)>PVP_RULES.maxRounds){this.state.finished=true;this.state.phase='finished';this.state.result='draw';this.state.current=null;this.pushLog(`HÒA · CHẠM GIỚI HẠN ${PVP_RULES.maxRounds} VÒNG.`,'draw');this.pushEvent('battle-end',{result:'draw',reason:'ROUND_LIMIT',maxRounds:PVP_RULES.maxRounds});return true;}
      const enemyAlive=this.living('enemy').length;
      const playerAlive=this.living('player').length;
      const futurePlayer=playerAlive + this.state.reserves.filter(r=>!r.defeated).length;
      const futureEnemy=enemyAlive + this.state.enemyReserves.filter(r=>!r.defeated).length;
      const boss=this.mode==='boss'?this.state.enemies.find(u=>u.boss):null;
      if(this.mode==='boss' && boss && (boss.defeated||boss.hp<=0)){this.state.finished=true;this.state.phase='finished';this.state.result='win';this.state.current=null;this.pushLog('BOSS ĐÃ BỊ HẠ!','win');this.pushEvent('battle-end',{result:'win',bossId:boss.id});return true;}
      // 19.6: simultaneous PvP KO is a draw, never a side-order-dependent win.
      if(this.mode==='pvp' && futureEnemy<=0 && futurePlayer<=0){this.state.finished=true;this.state.phase='finished';this.state.result='draw';this.state.current=null;this.state.replacementQueue.length=0;this.state.enemyReplacementQueue.length=0;this.state.replacementSide=null;this.pushLog('HÒA · HAI PHE CÙNG BỊ HẠ.','draw');this.pushEvent('battle-end',{result:'draw',simultaneousKO:true});return true;}
      if(futureEnemy<=0){ this.state.finished=true;this.state.phase='finished';this.state.result='win';this.state.current=null;this.pushLog('CHIẾN THẮNG!','win');this.pushEvent('battle-end',{result:'win'});return true; }
      if(futurePlayer<=0){ this.state.finished=true;this.state.phase='finished';this.state.result='loss';this.state.current=null;this.pushLog('THẤT BẠI.','loss');this.pushEvent('battle-end',{result:'loss'});return true; }
      return false;
    }

    validateState(){
      const issues=[]; const s=this.state;
      if(!['ready','running','replacement','finished'].includes(s.phase))issues.push(`phase:${s.phase}`); if(!Number.isFinite(Number(s.roundActionSize))||s.roundActionSize<1)issues.push('invalid-round-size');
      if(s.team.length!==3)issues.push(`team-slots:${s.team.length}`);
      if(s.reserves.length>2)issues.push(`reserves:${s.reserves.length}`);
      if(!Array.isArray(s.enemies)||s.enemies.length<1)issues.push('no-enemies');
      if(!Array.isArray(s.enemyReserves)||s.enemyReserves.length>2)issues.push(`enemy-reserves:${s.enemyReserves?.length}`);
      if(s.phase==='replacement' && !s.replacementQueue.length && !s.enemyReplacementQueue.length)issues.push('replacement-without-queue');
      if(s.replacementQueue.some(i=>i<0||i>=s.team.length))issues.push('invalid-replacement-slot'); if(s.enemyReplacementQueue.some(i=>i<0||i>=s.enemies.length))issues.push('invalid-enemy-replacement-slot');
      if(s.current && !this.allUnits.some(u=>u.id===s.current.id))issues.push('current-not-active');
      if(s.finished && s.phase!=='finished')issues.push('finished-phase-mismatch');
      if(!s.finished && s.phase==='finished')issues.push('phase-finished-without-flag');
      if(!s.tamer||s.tamer.simpleCharges<0||s.tamer.simpleCharges>3)issues.push('invalid-tamer-simple-charges');
      if(s.tamer?.expansion && (s.tamer.expansion.remainingRounds<1||s.tamer.expansion.remainingRounds>5))issues.push('invalid-domain-rounds');
      if(this.mode==='pvp'&&(!s.pvp||!s.pvp.rules||Number(s.pvp.rules.turnSeconds)!==PVP_RULES.turnSeconds))issues.push('invalid-pvp-rules');
      if(this.replayEvents.length>1200)issues.push('replay-over-cap');
      return {ok:issues.length===0,issues};
    }

    replaySnapshot(){
      const packUnit=u=>({id:u.id,powId:u.powId,name:u.name,side:u.side,owned:u.owned,teamIndex:u.teamIndex,boss:Boolean(u.boss),bossType:u.bossType||null});
      return {format:'powder-combat-replay-v2',combatVersion:'24.0',rules:this.mode==='pvp'?{...PVP_RULES}:null,seed:this.seed,serial:this.serial,mode:this.mode,bossType:this.bossType,startedAt:this.replayStartedAt,result:this.state.result,round:this.state.round,turnCount:this.state.turnCount,units:this.allRosterUnits.map(packUnit),events:this.replayEvents.slice(),finalState:{player:this.state.team.map(u=>({id:u.id,hp:u.hp,maxHp:u.maxHp,defeated:u.defeated})),enemy:this.state.enemies.map(u=>({id:u.id,hp:u.hp,maxHp:u.maxHp,defeated:u.defeated}))}};
    }
    snapshot(){ return this.state; }
  }

  function restoreBattleRecovery(packet){
    if(!packet||!['powder-combat-recovery-v1','powder-pvp-recovery-v2'].includes(packet.format))throw new Error('Recovery packet không hợp lệ.');
    if(Number(packet.expiresAt)&&Date.now()>Number(packet.expiresAt))throw new Error('Recovery packet đã hết thời gian khôi phục.');
    const player=(packet.initial?.player||[]).map(reviveInitialEntry).filter(Boolean),enemy=(packet.initial?.enemy||[]).map(reviveInitialEntry).filter(Boolean);if(player.length<3||enemy.length<3)throw new Error('Recovery packet thiếu đội hình.');
    const mode=['pve','pvp','boss'].includes(packet.mode)?packet.mode:'pve',core=new BattleCore({mode,bossType:packet.bossType||'daily',serial:Number(packet.serial)||1,seed:Number(packet.seed)||1,playerEntries:player,enemyEntries:enemy});core.start();const all=new Map(core.allRosterUnits.map(u=>[u.id,u]));for(const row of packet.runtime?.units||[])restoreRuntimeUnit(all.get(row.id),row);
    const ids=(arr)=>arr.map(id=>all.get(id)).filter(Boolean),r=packet.runtime||{};core.state.team=ids(r.teamIds||[]);core.state.reserves=ids(r.reserveIds||[]);core.state.enemies=ids(r.enemyIds||[]);core.state.enemyReserves=ids(r.enemyReserveIds||[]);core.state.phase=r.phase||'running';core.state.result=r.result||null;core.state.finished=Boolean(r.finished);core.state.turnCount=Number(r.turnCount)||0;core.state.round=Number(r.round)||1;core.state.roundActionSize=Math.max(1,Number(r.roundActionSize)||6);core.state.replacementQueue=[...(r.replacementQueue||[])];core.state.enemyReplacementQueue=[...(r.enemyReplacementQueue||[])];core.state.replacementSide=r.replacementSide||null;core.state.exclusiveTeamLock=safeClone(r.exclusiveTeamLock||{player:null,enemy:null},{player:null,enemy:null});if(mode==='pvp')core.state.pvp=safeClone(r.pvp||core.state.pvp,core.state.pvp);if(r.tamerBySide){core.state.tamerBySide=safeClone(r.tamerBySide,null);core.state.tamer=core.state.tamerBySide?.player||core.state.tamer;}core.state.current=r.currentId?all.get(r.currentId)||null:null;core.events.length=0;core.replayEvents=Array.isArray(packet.replay?.events)?packet.replay.events.slice(-1200):[];core.eventSeq=core.replayEvents.reduce((m,e)=>Math.max(m,Number(e.seq)||0),0);core.replayStartedAt=Number(packet.replay?.startedAt)||Date.now();return core;
  }
  function restoreRecovery(packet){if(packet?.format!=='powder-pvp-recovery-v2')throw new Error('Recovery PvP packet không hợp lệ.');return restoreBattleRecovery(packet);}

  window.POWDER_COMBAT_CORE_V7={
    version:'beta-final-1.1', seededRng, restoreRecovery, restoreBattleRecovery, PVP_RULES, BattleCore, ROLE, DAMAGE_PACING, RAGE_PACING, MANA_PACING, MANA_RARITY_REGEN, manaPacingFor, TAMER_SIMPLE, TAMER_EXPANSIONS, roleProfile, roleOf, isHardControlled, isArea, isSupport, bypassGuard, manaCost, questionPlan, knowledgeScale, knowledgeEffectScale, PVP_DIRECT_CAP, pvpDirectCap, roundOneSafety, combatPressure, RANK_DAMAGE_PACING, combatRankOf, rankDamagePacing
  };
})();
