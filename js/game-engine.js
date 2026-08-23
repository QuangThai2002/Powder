(function () {
  "use strict";

  const D = window.POWDER_DATA;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const clone = value => JSON.parse(JSON.stringify(value));

  // Combat Core V2 balance rules. These are intentionally centralized so 99 Pow
  // share one stat/durability model instead of ad-hoc per-Pow arithmetic.
  const ROLE_HP_MULT = Object.freeze({assassin:.95,marksman:1,mage:1,enchanter:1.08,musician:1.10,healer:1.20,fighter:1.35,knight:1.50,tank:1.75});
  const ROLE_DEF_MULT = Object.freeze({assassin:.90,marksman:.92,mage:.95,enchanter:1.05,musician:1.08,healer:1.12,fighter:1.30,knight:1.50,tank:1.80});
  const ROLE_CRIT_RESIST = Object.freeze({assassin:2,marksman:4,mage:4,enchanter:6,musician:6,healer:8,fighter:10,knight:15,tank:20});
  const ROLE_EVASION = Object.freeze({assassin:10,marksman:6,mage:5,enchanter:5,musician:5,healer:4,fighter:4,knight:3,tank:2});
  const ROLE_TENACITY = Object.freeze({assassin:4,marksman:4,mage:5,enchanter:7,musician:7,healer:8,fighter:10,knight:15,tank:20});
  const ROLE_HEAL_POWER = Object.freeze({assassin:0,marksman:0,mage:0,enchanter:8,musician:10,healer:15,fighter:0,knight:0,tank:0});
  const ROLE_SHIELD_POWER = Object.freeze({assassin:0,marksman:0,mage:0,enchanter:8,musician:5,healer:5,fighter:4,knight:10,tank:15});
  const SPECIAL_EVA_ELEMENTS = new Set(['wind','storm','dark']);
  const POSITIVE_BUFF_CAP = .60;
  const DEF_REDUCTION_CAP = .50;
  const DEF_PEN_CAP = .45;
  const DEF_PEN_SPECIAL_CAP = .60;
  const CRIT_DMG_CAP = 250;
  const CRIT_RESIST_CAP = 50;
  const TENACITY_CAP = 60;
  const DAMAGE_REDUCTION_CAP = .45;
  const NORMAL_SHIELD_CAP = .60;
  const TANK_SHIELD_CAP = .80;
  function combatRoleOf(pow){const key=pow?.combatRole||pow?.roleTags?.[0]||'marksman';return ROLE_HP_MULT[key]!=null?key:'marksman';}
  const EXTERNAL_MAIN_STATS=Object.freeze(['hp','atk','ap','def','speed']);
  const EXTERNAL_SECONDARY_STATS=Object.freeze(['critRate','critDamage','evasion','accuracy','critResist','defPen','healPower','shieldPower','tenacity']);
  function numericStatMap(raw,keys){const out={};for(const k of keys){const v=Number(raw?.[k]);if(Number.isFinite(v))out[k]=v;}return out;}
  function normalizeExternalOwnedState(ownedState={}){
    const add=numericStatMap(ownedState.statAdd||ownedState.flatStats||{},[...EXTERNAL_MAIN_STATS,...EXTERNAL_SECONDARY_STATS]);
    const pct=numericStatMap(ownedState.statPct||{},EXTERNAL_MAIN_STATS);
    const percent=numericStatMap(ownedState.statPercent||{},EXTERNAL_MAIN_STATS);
    for(const k of EXTERNAL_MAIN_STATS)if(Number.isFinite(percent[k]))pct[k]=(pct[k]||0)+percent[k]/100;
    return{add,pct};
  }
  function applyExternalCombatStats(stats,ownedState={}){
    const {add,pct}=normalizeExternalOwnedState(ownedState),out={...stats};
    for(const k of EXTERNAL_MAIN_STATS){const base=Math.max(1,Number(out[k])||1),flat=Number(add[k])||0,rate=clamp(Number(pct[k])||0,-.80,3);out[k]=Math.max(1,Math.round((base+flat)*(1+rate)));}
    for(const k of EXTERNAL_SECONDARY_STATS)if(Number.isFinite(Number(add[k])))out[k]=Number(out[k]||0)+Number(add[k]);
    out.critRate=clamp(Number(out.critRate)||0,0,100);out.critDamage=clamp(Number(out.critDamage)||150,100,CRIT_DMG_CAP);out.evasion=clamp(Number(out.evasion)||0,0,75);out.accuracy=clamp(Number(out.accuracy)||100,25,200);out.critResist=clamp(Number(out.critResist)||0,0,CRIT_RESIST_CAP);out.defPen=clamp(Number(out.defPen)||0,0,DEF_PEN_SPECIAL_CAP);out.healPower=clamp(Number(out.healPower)||0,0,60);out.shieldPower=clamp(Number(out.shieldPower)||0,0,60);out.tenacity=clamp(Number(out.tenacity)||0,0,TENACITY_CAP);
    return out;
  }

  function getStats(pow, ownedState = {}) {
    const R=window.POWDER_FORM_RESOLVER;const specialBase=R&&pow?.evolutionForms?.length?R.statsAt(pow,ownedState.stars??pow.startStars):null;const base = specialBase || pow.stats || { hp: 1, atk: 1, def: 1, speed: 1, ap: 1, critRate: 0, critDamage: 200 };
    const cfg = window.POWDER_POWER_CURVE_V8 || { levelMainBase:1.018, powStarBase:1.18, speedLevelBase:1.004, speedStarBase:1.04 };
    const level = Math.max(1, Number(ownedState.level) || 1);
    const stars = clamp(Number(ownedState.stars) || 0, 0, Number(pow.maxStars) || 0);
    const shiny = Boolean(ownedState.shiny);
    const levelScale = Math.pow(Number(cfg.levelMainBase)||1.018, level - 1);
    const starScale = specialBase ? 1 : Math.pow(Number(cfg.powStarBase)||1.18, stars);
    const shinyScale = shiny ? 1.25 : 1;
    const scale = levelScale * starScale * shinyScale;
    const speedScale = Math.pow(Number(cfg.speedLevelBase)||1.004, level - 1) * (specialBase?1:Math.pow(Number(cfg.speedStarBase)||1.04, stars)) * shinyScale;
    const role=combatRoleOf(pow), hpRole=ROLE_HP_MULT[role]||1, defRole=ROLE_DEF_MULT[role]||1;
    // Higher ranks intentionally gain durability slightly faster than offense so
    // equal-power matches grow from short onboarding fights into longer tactical fights.
    const durabilityScale=clamp(.63+level*.011,.72,1.65);
    const defenseProgress=clamp(.92+(durabilityScale-1)*.30,.82,1.20);
    const elementEva=SPECIAL_EVA_ELEMENTS.has(pow?.element)?12:0;
    const evasionBase=Math.max(elementEva,ROLE_EVASION[role]||0);
    // MASTER data historically used 200% as the default Crit Damage. Core V2
    // normalizes the combat baseline to 150% and lets stars/builds grow from there.
    const legacyCrit=Math.max(100,Number(base.critDamage||200));
    const critDamage=clamp(150 + Math.max(0,legacyCrit-200)*.35 + (specialBase?0:stars*3) + (shiny?10:0),150,CRIT_DMG_CAP);
    const out={
      hp: Math.max(1, Math.round(base.hp * scale * hpRole * durabilityScale)),
      atk: Math.max(1, Math.round(base.atk * scale)),
      ap: Math.max(1, Math.round((base.ap || base.atk) * scale)),
      def: Math.max(1, Math.round(base.def * scale * defRole * defenseProgress)),
      speed: Math.max(1, Math.round(base.speed * speedScale)),
      critRate: clamp(Math.round((Number(base.critRate||0) + (specialBase?0:stars * 2)) * shinyScale * 10) / 10, 0, 100),
      critDamage: Math.round(critDamage*10)/10,
      evasion: clamp(Number(base.evasion??evasionBase),0,SPECIAL_EVA_ELEMENTS.has(pow?.element)?75:60),
      accuracy: Math.max(25,Number(base.accuracy??100)),
      critResist: clamp(Number(base.critResist??ROLE_CRIT_RESIST[role]??0),0,CRIT_RESIST_CAP),
      defPen: clamp(Number(base.defPen??0),0,DEF_PEN_SPECIAL_CAP),
      healPower: clamp(Number(base.healPower??ROLE_HEAL_POWER[role]??0),0,60),
      shieldPower: clamp(Number(base.shieldPower??ROLE_SHIELD_POWER[role]??0),0,60),
      tenacity: clamp(Number(base.tenacity??ROLE_TENACITY[role]??0),0,TENACITY_CAP)
    };
    return applyExternalCombatStats(out,ownedState);
  }

  function createCombatant(pow, ownedState = {}, options = {}) {
    const scale = Math.max(0.1, Number(options.scale) || 1);
    const stats = getStats(pow, ownedState);
    const R=window.POWDER_FORM_RESOLVER,form=R&&pow?.evolutionForms?.length?R.formAt(pow,ownedState.stars??pow.startStars):null;
    for (const key of ["hp", "atk", "def", "speed", "ap"]) stats[key] = Math.max(1, Math.round(stats[key] * scale));
    return {
      id: options.id || pow.id,
      powId: pow.id,
      name: options.name || form?.name || pow.name,
      element: pow.element,
      rarity: form?.rarity || pow.rarity,
      role: pow.role,
      combatRole: combatRoleOf(pow),
      asset: form?.asset || pow.asset,
      owned: { level: Math.max(1, Number(ownedState.level)||1), stars: clamp(Number(ownedState.stars)||0,0,Number(pow.maxStars)||0), shiny: Boolean(ownedState.shiny), statAdd:numericStatMap(ownedState.statAdd||ownedState.flatStats||{},[...EXTERNAL_MAIN_STATS,...EXTERNAL_SECONDARY_STATS]), statPct:numericStatMap(ownedState.statPct||{},EXTERNAL_MAIN_STATS), statPercent:numericStatMap(ownedState.statPercent||{},EXTERNAL_MAIN_STATS), externalId:ownedState.externalId||null, equipmentIds:Array.isArray(ownedState.equipmentIds)?ownedState.equipmentIds.slice(0,4):[], artifactIds:Array.isArray(ownedState.artifactIds)?ownedState.artifactIds.slice(0,8):[] },
      stats,
      maxHp: stats.hp,
      hp: stats.hp,
      statuses: {},
      buffs: [],
      resources: new Map(),
      shield: 0,
      damageReduction: 0,
      defeated: false,
      revived: false,
      passiveUsed: false,
      extraTurnUsed: false,
      teamIndex: options.teamIndex || 0
    };
  }

  function elementMultiplier(attackerElement, defenderElement) {
    const element = D.elements[attackerElement];
    if (!element) return 1;
    const multipliers = element.damageMultiplier || { strong: 1.5, neutral: 1, resist: 0.75, weak: 0.67, immune: 0 };
    if ((element.immune || []).includes(defenderElement)) return multipliers.immune ?? 0;
    if ((element.strong || []).includes(defenderElement)) return multipliers.strong ?? 1.5;
    if ((element.resist || []).includes(defenderElement)) return multipliers.resist ?? 0.75;
    if ((element.weak || []).includes(defenderElement)) return multipliers.weak ?? 0.67;
    return multipliers.neutral ?? 1;
  }

  function statusInfo(name) {
    return D.statusEffects?.[name] || { name, icon: "✦", duration: 1, description: "" };
  }

  function addShield(target, amount = null, source = null, duration = null, options = {}) {
    if (!target || target.defeated) return false;
    const info = statusInfo("Shield");
    const turns = Math.max(1, Number(duration) || info.duration || 2);
    const before = Math.max(0, Number(target.shield) || 0);
    const sourceStats=source?effectiveStats(source):null;
    const shieldPower=clamp(Number(sourceStats?.shieldPower||0),0,60)/100;
    const rawBase = amount == null ? Math.round(target.maxHp * 0.20) : Math.max(1, Math.round(Number(amount) || 0));
    const raw=Math.max(1,Math.round(rawBase*(1+shieldPower)));
    const roleCap=target.combatRole==='tank'?TANK_SHIELD_CAP:NORMAL_SHIELD_CAP;
    const capRatio = clamp(Number(options.capRatio ?? roleCap), 0.10, target.combatRole==='tank'?TANK_SHIELD_CAP:NORMAL_SHIELD_CAP);
    const cap = Math.max(1, Math.round(target.maxHp * capRatio));
    target.shield = clamp(before + raw, 0, cap);
    const current = target.statuses.Shield;
    target.statuses.Shield = {name:"Shield",turns:Math.max(turns,current?.turns||0),sourceId:source?.id||null,amount:target.shield,cap,tags:['BUFF','SHIELD']};
    return { added: Math.max(0, target.shield - before), total: target.shield, cap, turns };
  }

  function addStatus(target, name, source = null, duration = null, options = {}) {
    if (!name || !target || target.defeated) return false;
    if (name === "Shield") {
      const amount = options?.amount ?? (options?.ratio != null ? Math.round(target.maxHp * Number(options.ratio)) : null);
      return Boolean(addShield(target, amount, source, duration, options));
    }
    const info = statusInfo(name);
    const turns = Math.max(1, Number(duration) || info.duration || 1);
    const current = target.statuses[name];
    const effectMultiplier=clamp(Number(options?.effectMultiplier ?? source?._knowledgeEffectScale ?? 1),0.20,1.30);
    // DOT identity V17.9:
    // Burn = residual damage tied to the hit that ignited the target. It does not stack;
    // a stronger ignition replaces a weaker one and refreshes duration.
    if(name==='Burn'){
      const seedDamage=Math.max(0,Math.round(Number(options?.seedDamage ?? options?.impactDamage ?? 0)||0));
      const burnRate=clamp(Number(options?.burnRate ?? .30),.10,.60);
      const tickBase=Math.max(1,Math.round(seedDamage*burnRate));
      const prevBase=Math.max(0,Number(current?.tickBase)||0);
      const useNew=!current||tickBase>=prevBase;
      target.statuses.Burn={
        name:'Burn',turns:Math.max(turns,current?.turns||0),sourceId:useNew?(source?.id||null):(current?.sourceId||null),
        effectMultiplier:useNew?effectMultiplier:Math.max(Number(current?.effectMultiplier)||1,effectMultiplier),
        tickBase:Math.max(prevBase,tickBase),seedDamage:useNew?seedDamage:Number(current?.seedDamage||0),burnRate,
        tickCapRatio:clamp(Number(options?.tickCapRatio ?? current?.tickCapRatio ?? .12),.04,.20),
        tags:['DEBUFF','BURN']
      };
      return true;
    }
    // Poison = stack/ramp DOT. Re-applying adds one stack (normally 3 max), refreshes duration,
    // ignores DEF at tick time and passively reduces healing received per stack.
    if(name==='Poison'){
      const cap=Math.max(1,Math.round(Number(options?.stackCap ?? current?.stackCap ?? 3)||3));
      const add=Math.max(1,Math.round(Number(options?.stackGain ?? 1)||1));
      const before=Math.max(0,Number(current?.stacks||0));
      const stacks=clamp(before+add,1,cap),delta=Math.max(0,stacks-before);
      const variant=String(options?.poisonVariant||'Độc').trim()||'Độc';
      const variants={...(current?.variants||{})};
      if(delta>0)variants[variant]=Math.max(0,Number(variants[variant]||0))+delta;
      // Keep variant counters bounded by the shared Poison stack count. Variants are identity metadata;
      // they do NOT change the common Poison damage/healing formula.
      let totalVariants=Object.values(variants).reduce((a,b)=>a+Math.max(0,Number(b)||0),0);
      if(totalVariants>stacks){
        let overflow=totalVariants-stacks;
        for(const k of Object.keys(variants).reverse()){
          if(overflow<=0)break;
          const take=Math.min(overflow,Math.max(0,Number(variants[k])||0));
          variants[k]-=take;overflow-=take;
          if(variants[k]<=0)delete variants[k];
        }
      }
      target.statuses.Poison={
        name:'Poison',turns:Math.max(turns,current?.turns||0),sourceId:source?.id||current?.sourceId||null,
        effectMultiplier:Math.max(Number(current?.effectMultiplier)||0,effectMultiplier),stacks,stackCap:cap,variants,
        damagePerStack:clamp(Number(options?.damagePerStack ?? current?.damagePerStack ?? .02),.005,.04),
        antiHealPerStack:clamp(Number(options?.antiHealPerStack ?? current?.antiHealPerStack ?? .06),0,.12),
        tags:['DEBUFF','POISON']
      };
      return true;
    }
    target.statuses[name] = {
      name,
      turns: Math.max(turns, current?.turns || 0),
      sourceId: source?.id || null,
      effectMultiplier: current ? Math.max(Number(current?.effectMultiplier)||effectMultiplier,effectMultiplier) : effectMultiplier,
      tags: [isBeneficialStatus(name)?'BUFF':'DEBUFF', name.toUpperCase().replace(/\s+/g,'_')]
    };
    return true;
  }

  function removeStatus(target, name) {
    if (target?.statuses) delete target.statuses[name];
  }

  function effectiveStats(combatant, passiveId = null) {
    const stats = { ...combatant.stats };
    const status = combatant.statuses || {};
    const buffs=Array.isArray(combatant.buffs)?combatant.buffs:[];
    const customs=Object.values(combatant.customStatuses||{});
    const statAlias={atk:'ATK',attack:'ATK',ap:'AP',def:'DEF',speed:'SPEED',crit_rate:'CRIT_RATE',crit:'CRIT_RATE',evasion:'EVASION',eva:'EVASION',accuracy:'ACCURACY',tenacity:'TENACITY',damage_amp:'DAMAGE_AMP',heal_power:'HEAL_POWER',shield_power:'SHIELD_POWER'};
    const sumStat=(stat)=>{const structured=buffs.filter(b=>b?.stat===stat).reduce((a,b)=>a+Number(b.value||0),0);const legacy=customs.filter(x=>statAlias[String(x?.stat||'').toLowerCase()]===stat).reduce((a,x)=>a+Number(x.pct||0),0);return clamp(structured+legacy,-DEF_REDUCTION_CAP,POSITIVE_BUFF_CAP);};
    let atkBuff=sumStat('ATK'),apBuff=sumStat('AP'),defBuff=sumStat('DEF'),speedBuff=sumStat('SPEED'),critBuff=sumStat('CRIT_RATE'),evaBuff=sumStat('EVASION'),accBuff=sumStat('ACCURACY'),tenBuff=sumStat('TENACITY'),damageAmp=sumStat('DAMAGE_AMP'),healBuff=sumStat('HEAL_POWER'),shieldBuff=sumStat('SHIELD_POWER');
    if (status["Attack Up"]) atkBuff=clamp(atkBuff+.30*clamp(Number(status["Attack Up"]?.effectMultiplier)||1,.20,1.30),-DEF_REDUCTION_CAP,POSITIVE_BUFF_CAP);
    if (status["Defense Up"]) defBuff=clamp(defBuff+.30*clamp(Number(status["Defense Up"]?.effectMultiplier)||1,.20,1.30),-DEF_REDUCTION_CAP,POSITIVE_BUFF_CAP);
    if (status["AP Up"]) apBuff=clamp(apBuff+.30*clamp(Number(status["AP Up"]?.effectMultiplier)||1,.20,1.30),-DEF_REDUCTION_CAP,POSITIVE_BUFF_CAP);
    if (status["Speed Up"] || combatant.customStatuses?.["Speed Up"]) speedBuff=clamp(speedBuff+.20*clamp(Number(status["Speed Up"]?.effectMultiplier)||1,.20,1.30),-DEF_REDUCTION_CAP,POSITIVE_BUFF_CAP);
    stats.atk=Math.max(1,Math.round(stats.atk*(1+atkBuff)));
    stats.ap=Math.max(1,Math.round(stats.ap*(1+apBuff)));
    stats.def=Math.max(0,Math.round(stats.def*(1+defBuff)));
    stats.speed=Math.max(1,Math.round(stats.speed*(1+speedBuff)));
    stats.healPower=clamp(Number(stats.healPower||0)+healBuff*100,0,60);
    stats.shieldPower=clamp(Number(stats.shieldPower||0)+shieldBuff*100,0,60);
    stats.critRate=clamp(Number(stats.critRate||0)+critBuff*100,0,100);
    stats.evasion=clamp(Number(stats.evasion||0)+evaBuff*100,0,SPECIAL_EVA_ELEMENTS.has(combatant.element)?75:60);
    stats.accuracy=Math.max(25,Number(stats.accuracy||100)+accBuff*100);
    stats.tenacity=clamp(Number(stats.tenacity||0)+tenBuff*100,0,TENACITY_CAP);
    stats.damageAmp=clamp(Number(damageAmp||0),0,POSITIVE_BUFF_CAP);
    if (status.Slow) stats.speed = Math.round(stats.speed * (1-clamp(.25*clamp(Number(status.Slow?.effectMultiplier)||1,.20,1.30),.05,.40)));
    if (status.Freeze) stats.speed = Math.round(stats.speed * 0.6);
    const missing = clamp(1 - combatant.hp / combatant.maxHp, 0, 1);
    if (passiveId === "missing_hp_atk") stats.atk = Math.round(stats.atk * (1 + missing * 0.4));
    if (passiveId === "missing_hp_def") stats.def = Math.round(stats.def * (1 + missing * 0.4));
    stats.critDamage=clamp(Number(stats.critDamage||150),150,CRIT_DMG_CAP);
    stats.critResist=clamp(Number(stats.critResist||0),0,CRIT_RESIST_CAP);
    stats.evasion=clamp(Number(stats.evasion||0),0,SPECIAL_EVA_ELEMENTS.has(combatant.element)?75:60);
    stats.accuracy=Math.max(25,Number(stats.accuracy||100));
    stats.defPen=clamp(Number(stats.defPen||0),0,DEF_PEN_SPECIAL_CAP);
    stats.tenacity=clamp(Number(stats.tenacity||0),0,TENACITY_CAP);
    return stats;
  }

  function addCombatBuff(target,buff){
    if(!target||!buff?.id||!buff?.stat)return false;
    if(!Array.isArray(target.buffs))target.buffs=[];
    const normalized={id:String(buff.id),stat:String(buff.stat),value:Number(buff.value)||0,duration:Math.max(1,Number(buff.duration)||1),sourcePowId:buff.sourcePowId||null,stacking:buff.stacking||'ADD',dispellable:buff.dispellable!==false,tags:['BUFF']};
    const old=target.buffs.find(x=>x.id===normalized.id);
    if(old){old.value=normalized.stacking==='MAX'?Math.max(old.value,normalized.value):normalized.value;old.duration=Math.max(old.duration,normalized.duration);}
    else target.buffs.push(normalized);
    return normalized;
  }

  function startTurn(combatant) {
    const events = [];
    if (!combatant || combatant.defeated) return { skip: true, events };
    if (combatant.statuses.Burn) {
      const burn=combatant.statuses.Burn,effect=clamp(Number(burn.effectMultiplier)||1,.20,1.30);
      const base=Math.max(1,Math.round(Number(burn.tickBase)||Math.max(1,Number(burn.seedDamage||0)*Number(burn.burnRate||.30))));
      const cap=Math.max(1,Math.round(combatant.maxHp*clamp(Number(burn.tickCapRatio)||.12,.04,.20)));
      const amount=Math.max(1,Math.min(cap,Math.round(base*effect)));
      damageTarget(combatant, amount);
      events.push({ type: "dot", status: "Burn", amount, sourceId:burn.sourceId||null, mechanism:'hit-linked', seedDamage:Number(burn.seedDamage||0), rate:Number(burn.burnRate||.30), cap });
    }
    if (combatant.statuses.Poison) {
      const poison=combatant.statuses.Poison,effect=clamp(Number(poison.effectMultiplier)||1,.20,1.30),stacks=clamp(Number(poison.stacks||1),1,Math.max(1,Number(poison.stackCap||3)));
      const perStack=clamp(Number(poison.damagePerStack)||.02,.005,.04);
      const amount=Math.max(1,Math.round(combatant.maxHp*perStack*stacks*effect));
      damageTarget(combatant, amount);
      events.push({ type: "dot", status: "Poison", amount, sourceId:poison.sourceId||null, mechanism:'stack-ramp', stacks, perStack });
    }
    if (combatant.statuses.Regeneration && !combatant.defeated) {
      const amount = healTarget(combatant, Math.round(combatant.maxHp * 0.06 * clamp(Number(combatant.statuses.Regeneration?.effectMultiplier)||1,.20,1.30)));
      events.push({ type: "heal", status: "Regeneration", amount });
    }
    let skip = false;
    if (combatant.statuses.Stun) {
      skip = true;
      events.push({ type: "skip", status: "Stun" });
      removeStatus(combatant, "Stun");
    } else if (combatant.statuses.Freeze) {
      skip = true;
      events.push({ type: "skip", status: "Freeze" });
      removeStatus(combatant, "Freeze");
    }
    if (combatant.hp <= 0) combatant.defeated = true;
    return { skip: skip || combatant.defeated, events };
  }

  function endTurn(combatant) {
    if (!combatant?.statuses) return;
    if(Array.isArray(combatant.buffs)){for(const b of combatant.buffs)b.duration-=1;combatant.buffs=combatant.buffs.filter(b=>b.duration>0);}
    for (const [name, status] of Object.entries(combatant.statuses)) {
      if (name === "Stun" || name === "Freeze") continue;
      status.turns -= 1;
      if (status.turns <= 0) {
        delete combatant.statuses[name];
        if (name === "Shield") combatant.shield = 0;
      }
    }
  }

  function damageTarget(target, amount) {
    let remaining = Math.max(0, Math.round(amount));
    let absorbed = 0;
    if (target.shield > 0) {
      absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
      if (target.shield <= 0) removeStatus(target, "Shield");
    }
    target.hp = Math.max(0, target.hp - remaining);
    if (target.hp <= 0) target.defeated = true;
    return { damage: remaining, absorbed };
  }

  function healTarget(target, amount, options={}) {
    if (!target || target.defeated) return 0;
    const source=options.source||null, sourceStats=source?effectiveStats(source):null;
    const healPower=clamp(Number(sourceStats?.healPower||0),0,60)/100;
    const capRatio=clamp(Number(options.capRatio??.35),0.01,.50);
    const raw=Math.max(0,Math.round((Number(amount)||0)*(1+healPower)));
    const customAnti=Object.values(target.customStatuses||{}).reduce((a,x)=>a+Math.max(0,-Number(x?.healingReceived||0)),0);
    const poison=target.statuses?.Poison,poisonAnti=poison?clamp(Number(poison.stacks||1)*Number(poison.antiHealPerStack||.06)*clamp(Number(poison.effectMultiplier)||1,.20,1.30),0,.45):0;
    const antiHealCap=target.boss ? .15 : .40;
    const antiHeal=clamp(Number(target.antiHeal||0)+customAnti+poisonAnti,0,antiHealCap);
    const final=Math.min(Math.round(target.maxHp*capRatio),Math.round(raw*(1-antiHeal)));
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + final);
    return target.hp - before;
  }

  function abilityFor(pow, key) {
    const abilities = pow.abilities || {};
    if (key === "basic") return abilities.basic || { name: `${pow.name} Strike`, power: 100, type: "physical" };
    if (key === "skill1") return abilities.skills?.[0] || { name: pow.skillName || "Element Skill", power: 120, type: "elemental" };
    if (key === "skill2") return abilities.skills?.[1] || { name: "Tactical Skill", power: 105, type: "support" };
    if (key === "ultimate") return abilities.ultimate || { name: "Ultimate", power: 180, type: "ultimate" };
    if (key === "exclusive") return pow.exclusiveSkill || abilities.exclusive || { name: "Kỹ năng độc quyền", power: 220, type: "exclusive" };
    return abilityFor(pow, "basic");
  }

  function isBeneficialStatus(name) {
    return ["Defense Up", "Attack Up", "AP Up", "Speed Up", "Shield", "Regeneration"].includes(name);
  }

  function mitigationFromDefense(offense,defense){
    const off=Math.max(1,Number(offense)||1),def=Math.max(0,Number(defense)||0);
    const ratio=def/(def+.8*off);
    return clamp(ratio*.75,.10,.70);
  }

  // Legacy compatibility alias: returns the post-DEF damage multiplier.
  function scaledDefenseFactor(attackStat,defense,coefficient=.8){return 1-mitigationFromDefense(attackStat,defense);}

  function calculateDamage(attacker, defender, ability, options = {}) {
    const attackerPow = D.pows.find(p => p.id === attacker.powId);
    const passiveId = attackerPow?.abilities?.passive?.id;
    const aStats = effectiveStats(attacker, passiveId);
    const defenderPow = D.pows.find(p => p.id === defender.powId);
    const dStats = effectiveStats(defender, defenderPow?.abilities?.passive?.id);
    const key=options.key||'skill1';
    const type=String(ability?.type||'physical').toLowerCase();
    const usePhysical = type === 'physical';
    const useMagic = ['magic','elemental','support','ultimate','exclusive'].includes(type) && !ability?.mixed;
    const offense=usePhysical?aStats.atk:useMagic?aStats.ap:Math.max(aStats.atk,aStats.ap);
    const specialPen=key==='ultimate'||key==='exclusive';
    const penCap=specialPen?DEF_PEN_SPECIAL_CAP:DEF_PEN_CAP;
    const defPen=clamp(Number(aStats.defPen||0),0,penCap);
    const effectiveDEF=Math.max(0,dStats.def*(1-defPen)-Math.max(0,Number(options.defPenFlat||0)));
    const mitigation=mitigationFromDefense(offense,effectiveDEF);
    const area=Boolean(options.area);
    const unavoidable=Boolean(options.unavoidable||ability?.unavoidable||ability?.sureHit||ability?.tags?.includes?.('UNAVOIDABLE'));
    let effectiveEvasion=clamp(Number(dStats.evasion||0),0,SPECIAL_EVA_ELEMENTS.has(defender.element)?75:60);
    if(area)effectiveEvasion*=.70;
    let accuracyBonus=(Number(aStats.accuracy||100)-100)+(key==='ultimate'?10:key==='exclusive'?15:0);
    const hitChance=unavoidable?100:clamp(100+accuracyBonus-effectiveEvasion,25,100);
    const rng = options.rng || Math.random;
    const hit=unavoidable || rng()*100<hitChance;
    if(!hit)return {amount:0,crit:false,hit:false,evaded:true,hitChance,element:1,attackStat:offense,defense:effectiveDEF,mitigation,critMultiplier:1};
    const power = Math.max(1, Number(ability.power) || 100) / 100;
    const element = usePhysical ? 1 : elementMultiplier(attacker.element, defender.element);
    let comboMultiplier = 1;
    const combo = Math.max(0, Number(options.combo) || 0);
    if (passiveId === 'combo_bonus_damage') comboMultiplier += Math.min(0.32, combo * 0.08);
    if (passiveId === 'element_team_boost' && options.sameElementAllies > 0) comboMultiplier += 0.1;
    const critChance=clamp(Number(aStats.critRate||0)-Number(dStats.critResist||0),0,100);
    const crit = rng() * 100 < critChance;
    const critMultiplier = crit ? clamp(Number(aStats.critDamage||150),150,CRIT_DMG_CAP) / 100 : 1;
    const variance = 0.94 + rng() * 0.12;
    const dr=clamp(Number(defender.damageReduction||0),0,DAMAGE_REDUCTION_CAP);
    const amount = Math.max(1, Math.round(power * offense * (1-mitigation) * element * critMultiplier * comboMultiplier * (1+clamp(Number(aStats.damageAmp||0),0,POSITIVE_BUFF_CAP)) * variance * (1-dr)));
    return { amount, crit, hit:true, evaded:false, hitChance, critChance, element, attackStat:offense, defense:effectiveDEF, mitigation, critMultiplier };
  }

  function applyPassiveAfterAction(attacker, defender, context, result) {
    const pow = D.pows.find(p => p.id === attacker.powId);
    const passive = pow?.abilities?.passive?.id;
    const combo = context.combo || 0;
    const events = result.events;
    if (passive === "combo_stun" && combo >= 3 && (context.rng || Math.random)() < 0.35) {
      addStatus(defender, "Stun", attacker, 1);
      events.push({ type: "status", target: defender.id, status: "Stun" });
    }
    if (passive === "combo_heal" && combo >= 3 && Array.isArray(context.allies)) {
      for (const ally of context.allies.filter(x => !x.defeated)) {
        const amount = healTarget(ally, Math.round(ally.maxHp * 0.08));
        if (amount) events.push({ type: "heal", target: ally.id, amount, passive });
      }
    }
    if (passive === "combo_team_buff" && combo >= 3 && Array.isArray(context.allies)) {
      const buff = ["Attack Up", "Defense Up", "AP Up"][combo % 3];
      for (const ally of context.allies.filter(x => !x.defeated)) addStatus(ally, buff, attacker, 2);
      events.push({ type: "teamBuff", status: buff, passive });
    }
    if (passive === "low_hp_heal" && !attacker.passiveUsed && attacker.hp > 0 && attacker.hp / attacker.maxHp <= 0.35) {
      attacker.passiveUsed = true;
      const amount = healTarget(attacker, Math.round(attacker.maxHp * 0.2));
      events.push({ type: "heal", target: attacker.id, amount, passive });
    }
  }

  function executeAction(attacker, defender, ability, context = {}) {
    const result = { ability: clone(ability), events: [], damage: 0, crit: false, element: 1, extraTurn: false };
    if (!attacker || attacker.defeated || !defender || defender.defeated) return result;
    const status = ability.status;
    const beneficial = isBeneficialStatus(status);
    if (ability.type === "support" && beneficial) {
      addStatus(attacker, status, attacker, statusInfo(status).duration);
      const healed = status === "Regeneration" ? healTarget(attacker, Math.round(attacker.maxHp * 0.1)) : 0;
      result.events.push({ type: "status", target: attacker.id, status, healed });
      if ((ability.power || 0) < 50) return result;
    }
    const damage = calculateDamage(attacker, defender, ability, context);
    const dealt = damageTarget(defender, damage.amount);
    result.damage = dealt.damage;
    result.absorbed = dealt.absorbed;
    result.crit = damage.crit;
    result.element = damage.element;
    result.events.push({ type: "damage", target: defender.id, amount: dealt.damage, absorbed: dealt.absorbed, crit: damage.crit, element: damage.element });

    if (status) {
      const chance = ability.type === "exclusive" ? 0.9 : ability.type === "ultimate" ? 0.75 : ability.type === "support" ? 0.65 : 0.45;
      if (beneficial) {
        addStatus(attacker, status, attacker, statusInfo(status).duration);
        result.events.push({ type: "status", target: attacker.id, status });
      } else if ((context.rng || Math.random)() < chance && !defender.defeated) {
        addStatus(defender, status, attacker, statusInfo(status).duration);
        result.events.push({ type: "status", target: defender.id, status });
      }
    }
    applyPassiveAfterAction(attacker, defender, context, result);
    return result;
  }

  function speedExtraTurnChance(attacker, defender, passiveId = null) {
    const a = effectiveStats(attacker, passiveId).speed;
    const d = Math.max(1, effectiveStats(defender).speed);
    if (a <= d * 1.15) return 0;
    let chance = clamp(((a / d) - 1.15) * 0.42, 0, 0.35);
    if (passiveId === "combo_extra_turn") chance = clamp(chance + 0.12, 0, 0.35);
    return chance;
  }

  function tryRevive(team) {
    const reviver = team.find(c => {
      const pow = D.pows.find(p => p.id === c.powId);
      return !c.defeated && !c.passiveUsed && pow?.abilities?.passive?.id === "revive_ally_once";
    });
    const target = team.find(c => c.defeated && !c.revived);
    if (!reviver || !target) return null;
    reviver.passiveUsed = true;
    target.defeated = false;
    target.revived = true;
    target.hp = Math.max(1, Math.round(target.maxHp * 0.3));
    return { reviverId: reviver.id, targetId: target.id, hp: target.hp };
  }

  function chooseEnemyAbility(pow, turn = 1, rng = Math.random) {
    if (turn % 5 === 0) return abilityFor(pow, "ultimate");
    const roll = rng();
    if (roll < 0.35) return abilityFor(pow, "basic");
    if (roll < 0.72) return abilityFor(pow, "skill1");
    return abilityFor(pow, "skill2");
  }

  function statusBadges(combatant) {
    return Object.values(combatant?.statuses || {}).map(status => {
      const info = statusInfo(status.name);
      return { name: status.name, label: info.name, icon: info.icon, turns: status.turns };
    });
  }

  // Spaced repetition ------------------------------------------------------
  function ensureQuestionState(save, questionId) {
    save.questionProgress = save.questionProgress || {};
    if (!save.questionProgress[questionId]) {
      save.questionProgress[questionId] = { seen: 0, correct: 0, wrong: 0, streak: 0, mastery: 0, nextReview: 0, lastSeen: 0 };
    }
    return save.questionProgress[questionId];
  }

  function recordQuestionResult(save, question, correct, now = Date.now()) {
    const state = ensureQuestionState(save, question.id);
    state.seen += 1;
    state.lastSeen = now;
    if (correct) {
      state.correct += 1;
      state.streak += 1;
      state.mastery = clamp(state.mastery + (D.learningConfig?.masteryCorrectWeight || 4), 0, 100);
      const intervals = D.learningConfig?.intervalsMinutes || [60, 1440, 4320, 10080, 20160, 43200];
      const interval = intervals[Math.min(state.streak - 1, intervals.length - 1)];
      state.nextReview = now + interval * 60 * 1000;
    } else {
      state.wrong += 1;
      state.streak = 0;
      state.mastery = clamp(state.mastery - (D.learningConfig?.masteryWrongPenalty || 6), 0, 100);
      state.nextReview = now + (D.learningConfig?.retryWrongAfterMinutes || 5) * 60 * 1000;
    }
    return state;
  }

  function questionPriority(save, question, now = Date.now()) {
    const state = ensureQuestionState(save, question.id);
    const due = state.nextReview <= now ? 100 : 0;
    const unseen = state.seen === 0 ? 65 : 0;
    const weakness = (100 - state.mastery) * 0.7 + state.wrong * 5 - state.correct * 0.5;
    const recentPenalty = state.lastSeen ? Math.max(0, 20 - (now - state.lastSeen) / 60000) : 0;
    return due + unseen + weakness - recentPenalty;
  }

  function selectQuestions(save, questions, count, options = {}) {
    const now = options.now || Date.now();
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    shuffled.sort((a, b) => questionPriority(save, b, now) - questionPriority(save, a, now));
    if (shuffled.length >= count) return shuffled.slice(0, count).map(clone);
    const result = [];
    while (result.length < count && shuffled.length) result.push(clone(shuffled[result.length % shuffled.length]));
    return result;
  }

  function learningSummary(save) {
    const states = Object.values(save.questionProgress || {});
    const now = Date.now();
    const due = states.filter(s => (s.nextReview || 0) <= now).length;
    const weak = states.filter(s => (s.mastery || 0) < 40 && s.seen > 0).length;
    const average = states.length ? Math.round(states.reduce((sum, s) => sum + (s.mastery || 0), 0) / states.length) : 0;
    return { tracked: states.length, due, weak, average };
  }

  window.POWDER_ENGINE = {
    getStats,
    createCombatant,
    elementMultiplier,
    statusInfo,
    addStatus,
    addShield,
    removeStatus,
    effectiveStats,
    addCombatBuff, mitigationFromDefense,
    startTurn,
    endTurn,
    damageTarget,
    healTarget,
    abilityFor,
    calculateDamage,
    COMBAT_V2_RULES:{ROLE_HP_MULT,ROLE_DEF_MULT,POSITIVE_BUFF_CAP,DEF_REDUCTION_CAP,DEF_PEN_CAP,DEF_PEN_SPECIAL_CAP,CRIT_DMG_CAP,CRIT_RESIST_CAP,TENACITY_CAP,DAMAGE_REDUCTION_CAP,NORMAL_SHIELD_CAP,TANK_SHIELD_CAP},
    scaledDefenseFactor,
    executeAction,
    speedExtraTurnChance,
    tryRevive,
    chooseEnemyAbility,
    statusBadges,
    ensureQuestionState,
    recordQuestionResult,
    questionPriority,
    selectQuestions,
    learningSummary
  };
})();
