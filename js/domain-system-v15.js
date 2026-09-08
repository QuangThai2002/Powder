(()=>{'use strict';
const C=window.POWDER_COMBAT_CORE_V7,E=window.POWDER_ENGINE;
if(!C?.BattleCore||!E)return;
const FEATURE_FLAGS=window.POWDER_COMBAT_FEATURE_FLAGS_V1||{};
const SIMPLE_DOMAIN_ENABLED=FEATURE_FLAGS.SIMPLE_DOMAIN_ENABLED!==false;
const DOMAIN_EXPANSION_ENABLED=FEATURE_FLAGS.DOMAIN_EXPANSION_ENABLED===true;
const P=C.BattleCore.prototype,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const FRONT_ROLES=new Set(['knight','fighter','tank']);
const HARD_CC=new Set(['Stun','Freeze']);
const LEVELS={
  1:{id:1,name:'Sơ cấp',resist:.30},
  2:{id:2,name:'Trung cấp',resist:.40},
  3:{id:3,name:'Cao cấp',resist:.50}
};
const SIMPLE={
  crimson:{id:'crimson',name:'Xích Viêm Sát Giới',short:'XÍCH VIÊM',branch:'fire',description:'Bạo kích · bùng nổ. 3 lần/trận, hiệu lực 1 vòng hành động của Pow kích hoạt.',tiers:{1:{damage:.25,crit:10,critDamage:50},2:{damage:.35,crit:15,critDamage:75},3:{damage:.45,crit:20,critDamage:100}}},
  tide:{id:'tide',name:'Huyền Thủy Trấn Giới',short:'HUYỀN THỦY',branch:'water',description:'Công thủ cân bằng · HP/DEF. 3 lần/trận.',tiers:{1:{damage:.25,def:.25,hp:.25},2:{damage:.35,def:.35,hp:.35},3:{damage:.45,def:.45,hp:.45}}},
  verdant:{id:'verdant',name:'Thanh Mộc Huyết Giới',short:'THANH MỘC',branch:'leaf',description:'Hút máu · hút máu thừa chuyển thành Giáp. 3 lần/trận.',tiers:{1:{damage:.25,lifesteal:.20,shieldCap:.25},2:{damage:.35,lifesteal:.30,shieldCap:.35},3:{damage:.45,lifesteal:.40,shieldCap:.50}}}
};
const EXP={
  nine_suns:{id:'nine_suns',name:'Cửu Nhật Phần Thiên Giới',short:'CỬU NHẬT PHẦN THIÊN',branch:'fire',kind:'normal',icon:'☀',durationActions:4,description:'4 hành động. Mở Lãnh Địa: toàn địch nhận 1 Phần Ấn. Burn Tất Trúng, mạnh +50% và có thể Crit. Mỗi hit +1 Ấn; Pow Hỏa +2 Ấn/hit. Đủ 4 → Bạo Viêm cực mạnh. Kẻ chết khi còn Burn → Burn lan tối đa 3 địch.',stats:{damage:.60,crit:28,critDamage:130}},
  infinite_strike:{id:'infinite_strike',name:'Thiên Kích Vô Tận Giới',short:'THIÊN KÍCH VÔ TẬN',branch:'fire',kind:'normal',icon:'✦',durationActions:4,description:'4 hành động. Bắt đầu sẵn 1 Liên Kích. Đủ 4 hit → Truy Kích gây 45% damage của chuỗi, tối đa 16% Max HP. Mỗi Truy Kích thứ 2 → Thiên Kích Bạo Liên quét toàn địch 6% Max HP.',stats:{damage:.60,crit:28,critDamage:130}},
  limitless_void:{id:'limitless_void',name:'Vô Lượng Không Xứ',short:'VÔ LƯỢNG KHÔNG XỨ',branch:'fire',kind:'special',icon:'∞',durationActions:2,description:'Địch thêm 5 câu mỗi hành động: sai 1 → damage ×0.5, sai ≥2 → damage = 0. Chủ Lãnh Địa thêm 5 câu: mỗi câu đúng +20% damage; đủ 10 câu đúng → toàn đội địch mất 50% Max HP.',stats:{damage:.50,crit:22,critDamage:110}},
  frozen_silence:{id:'frozen_silence',name:'Huyền Băng Tịch Diệt Giới',short:'HUYỀN BĂNG TỊCH DIỆT',branch:'water',kind:'normal',icon:'❄',durationActions:4,description:'4 hành động. Mở Lãnh Địa: toàn địch nhận 1 Hàn Khí. Mỗi tầng giảm 10% SPEED + 7% damage. 3/3 → Đông Kết; đánh mục tiêu Frozen → Phá Băng 15% Max HP + giảm 30% DEF và phát tán Hàn Khí.',stats:{damage:.60,def:.55,hp:.55}},
  diamond_guard:{id:'diamond_guard',name:'Bất Động Kim Cương Giới',short:'BẤT ĐỘNG KIM CƯƠNG',branch:'water',kind:'normal',icon:'⬡',durationActions:4,description:'4 hành động. Mở Lãnh Địa: toàn đội nhận Giáp 12% Max HP. Kim Cương Thể giảm 30% damage nhận, tăng Khiên/Đỡ Đòn. Mỗi đòn chịu vào tích Trấn Khí; 3/3 → Giáp 12% Max HP toàn đội + giải 1 debuff. Damage bị Khiên chặn còn phản chấn.',stats:{damage:.45,def:.60,hp:.60},incomingReduction:.30,shieldPower:40,guardBonus:20},
  jackpot_bagua:{id:'jackpot_bagua',name:'Tọa Sát Bát Đồ',short:'TỌA SÁT BÁT ĐỒ',branch:'water',kind:'special',icon:'八',durationActions:3,description:'Jackpot 25%; thất bại +5% cho lần sau, tối đa 1 lần thử/lượt. Jackpot tồn tại 1 lượt đội (3 hành động đồng minh): Bất Tử + Mana luôn đầy + Tất Trúng. Hết Jackpot reset 25%.',stats:{damage:.50,def:.50,hp:.50},sureHit:true,multiAttempt:true},
  myriad_poison:{id:'myriad_poison',name:'Vạn Độc Phệ Sinh Giới',short:'VẠN ĐỘC PHỆ SINH',branch:'leaf',kind:'normal',icon:'☣',durationActions:4,description:'4 hành động. Mở Lãnh Địa: toàn địch nhận 1 tầng Poison. Poison tối đa 6 tầng; mỗi hit +1 tầng và giảm hồi máu. Mỗi Poison tick +1 Độc Ấn; 3/3 → toàn bộ Poison tick thêm 1 lần và tăng thêm 1 tầng. Đủ 6 tầng → Độc Thực giảm DEF/damage. Kẻ chết làm Độc lan 2 mục tiêu.',stats:{damage:.55,lifesteal:.55,shieldCap:.65},poisonStackCap:6,antiHeal:.30},
  rebirth_wood:{id:'rebirth_wood',name:'Vạn Mộc Luân Sinh Giới',short:'VẠN MỘC LUÂN SINH',branch:'leaf',kind:'normal',icon:'❧',durationActions:4,description:'4 hành động. Mở Lãnh Địa có sẵn 25 Sinh Khí. Hồi máu và Overheal đều nạp Sinh Khí. 25: hồi phục +20%; 50: hồi 6% HP + HoT toàn đội; 75: +20% damage; 100: Luân Sinh hồi 20% HP + Giáp 15% + giải 2 debuff +25% damage. Tiêu 20 Sinh Khí có thể cứu Pow ở 15% HP.',stats:{damage:.60,lifesteal:.60,shieldCap:.70}},
  draw_swords:{id:'draw_swords',name:'Rút Kiếm Ra',short:'RÚT KIẾM RA',branch:'leaf',kind:'special',icon:'⚔',durationActions:5,description:'5 hành động. Pow không phải Hiệp sĩ/Đấu sĩ/Đỡ đòn: +30% Damage, +30% Max HP, +30% Hút máu. Mỗi hành động xuất 1 trong 5 kiếm không lặp, Tất Trúng, gây 20% Max HP + Burn/Poison/Shock/Anti-Heal/Freeze.',stats:{damage:.30,hp:.30,lifesteal:.30,shieldCap:.50},swordsSureHit:true,roleRestricted:true}
};
const BRANCH={fire:['nine_suns','infinite_strike','limitless_void'],water:['frozen_silence','diamond_guard','jackpot_bagua'],leaf:['myriad_poison','rebirth_wood','draw_swords']};
// Validate the owned catalog before exposing it to legacy runtime patches.
const __domainIds=Object.getOwnPropertyNames(EXP),__specialIds=__domainIds.filter(id=>EXP[id]?.kind==='special');
if(__domainIds.length!==9||__specialIds.length!==3)throw new Error('POWDER_DOMAIN_LOCK_V1880');
const SWORDS=[
  {id:'flame',name:'Xích Diệm Phần Thiên Kiếm',status:'Burn',icon:'🔥'},
  {id:'poison',name:'Vạn Độc Phệ Tâm Kiếm',status:'Poison',icon:'☣'},
  {id:'thunder',name:'Thiên Lôi Trấn Phá Kiếm',status:'Shock',icon:'⚡'},
  {id:'sever',name:'Đoạn Sinh Tuyệt Mạch Kiếm',status:'AntiHeal',icon:'⛧'},
  {id:'ice',name:'Huyền Băng Phong Ngục Kiếm',status:'Freeze',icon:'❄'}
];
const PVP_CAP={normal:{basic:Infinity,skill1:Infinity,skill2:Infinity,ultimate:Infinity,exclusive:Infinity},limitless_void:{basic:Infinity,skill1:Infinity,skill2:Infinity,ultimate:Infinity,exclusive:Infinity},draw_swords:{basic:Infinity,skill1:Infinity,skill2:Infinity,ultimate:Infinity,exclusive:Infinity},jackpot_bagua:{basic:Infinity,skill1:Infinity,skill2:Infinity,ultimate:Infinity,exclusive:Infinity}};
function pvpCap(){return Infinity}
function freshSide(){return{simpleCharges:3,simpleActive:null,simpleLevel:1,equippedSimple:'crimson',equippedExpansion:'nine_suns',expansion:null,expansionUsed:false,jackpotAttempts:0,lastAttemptKey:'',pendingActionScale:1,limitlessCorrect:0,limitlessBurstDone:false}}
function ensure(core){const s=core.state;s.tamerBySide=s.tamerBySide||{};for(const side of ['player','enemy']){if(!s.tamerBySide[side])s.tamerBySide[side]=freshSide();else{const d=freshSide();for(const [k,v] of Object.entries(d))if(s.tamerBySide[side][k]===undefined)s.tamerBySide[side][k]=v;}}s.tamer=s.tamerBySide.player;return s.tamerBySide}
function sideState(core,side){return ensure(core)[side==='enemy'?'enemy':'player']}
function units(core,side,includeReserve=true){return side==='player'?[...(core.state.team||[]),...(includeReserve?core.state.reserves||[]:[])]:[...(core.state.enemies||[]),...(includeReserve?core.state.enemyReserves||[]:[])]}
function foeSide(side){return side==='player'?'enemy':'player'}
function activeSimple(core,side){return SIMPLE_DOMAIN_ENABLED?sideState(core,side).simpleActive:null}
function activeExpansion(core,side){return DOMAIN_EXPANSION_ENABLED?sideState(core,side).expansion:null}
function simpleCfg(core,side){const a=activeSimple(core,side);return a?SIMPLE[a.id]||null:null}
function expansionCfg(core,side){const a=activeExpansion(core,side);return a?EXP[a.id]||null:null}
function simpleResist(core,side){const a=activeSimple(core,side);return a?Number(LEVELS[a.level]?.resist||0):0}
function currentHpBoost(core,u){const side=u.side,sp=simpleCfg(core,side),sa=activeSimple(core,side),ep=expansionCfg(core,side);if(ep){if(ep.id==='draw_swords')return FRONT_ROLES.has(u.combatRole)?0:.30;return Number(ep.stats?.hp||0)}if(sp&&sa)return Number(sp.tiers?.[sa.level]?.hp||0);return 0}
function refreshHp(core,side){
  for(const u of units(core,side,true)){
    if(!u)continue;
    if(!Number.isFinite(u._domainBaseMaxHp))u._domainBaseMaxHp=Number(u.maxHp)||1;
    const base=Math.max(1,u._domainBaseMaxHp),old=Math.max(1,Number(u.maxHp)||base),boost=currentHpBoost(core,u),next=Math.max(1,Math.round(base*(1+boost)));
    const wasDefeated=Boolean(u.defeated||Number(u.hp)<=0);
    if(wasDefeated){u.maxHp=next;u.hp=0;u.defeated=true;continue;}
    const hp=Math.max(1,Number(u.hp)||1);
    if(next>old)u.hp=Math.min(next,hp+(next-old));
    else if(next<old)u.hp=Math.min(next,hp);
    u.maxHp=next;
  }
}
function simpleDamage(core,side){const a=activeSimple(core,side),cfg=simpleCfg(core,side);return a&&cfg?Number(cfg.tiers?.[a.level]?.damage||0):0}
function expansionDamage(core,side,att){const cfg=expansionCfg(core,side);if(!cfg)return 0;if(cfg.id==='draw_swords'&&FRONT_ROLES.has(att?.combatRole))return 0;return Number(cfg.stats?.damage||0)}
function lifesteal(core,att){const side=att.side,sa=activeSimple(core,side),sc=simpleCfg(core,side),ep=expansionCfg(core,side);if(ep){if(ep.id==='draw_swords'&&FRONT_ROLES.has(att.combatRole))return{rate:0,cap:0};return{rate:Number(ep.stats?.lifesteal||0),cap:Number(ep.stats?.shieldCap||0)}}if(sa&&sc){const t=sc.tiers?.[sa.level]||{};return{rate:Number(t.lifesteal||0),cap:Number(t.shieldCap||0)}}return{rate:0,cap:0}}
function addShield(target,amount,capRatio=.6){amount=Math.max(0,Math.round(amount||0));if(!amount)return 0;const cap=Math.max(1,Math.round(target.maxHp*capRatio)),before=Number(target.shield)||0;target.shield=Math.min(cap,before+amount);return target.shield-before}
function rawDamage(core,source,target,amount,label,{ignoreShield=false}={}){if(!target||target.defeated)return 0;amount=Math.max(1,Math.round(amount||0));const before=target.hp,shieldBefore=Number(target.shield)||0;let dealt;if(ignoreShield){const hp=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-hp);if(target.hp<=0)target.defeated=true;dealt={damage:hp,absorbed:0}}else dealt=E.damageTarget(target,amount);const shieldAfter=Number(target.shield)||0,shieldBreak=shieldBefore>0&&shieldAfter<=0&&Number(dealt.absorbed)>0;let immortal=false;if(activeExpansion(core,target.side)?.id==='jackpot_bagua'&&(target.hp<=0||target.defeated)){target.defeated=false;target.hp=1;immortal=true}const killed=!immortal&&Boolean(target.defeated||target.hp<=0);core.pushEvent?.('damage',{sourceId:source?.id||null,domain:true,label,impacts:[{targetId:target.id,damage:dealt.damage,absorbed:dealt.absorbed,crit:false,element:1,hpBefore:before,hpAfter:target.hp,shieldBefore,shieldAfter,killed,shieldBreak}],total:dealt.damage});if(shieldBreak)core.pushEvent?.('break',{sourceId:source?.id||null,targetId:target.id,kind:'shield',ability:label,domain:true});if(killed)core.pushEvent?.('kill',{sourceId:source?.id||null,targetId:target.id,ability:label,domain:true});if(immortal){core.pushEvent?.('domain-immortal',{side:target.side,targetId:target.id,hp:1});core.pushLog?.(`Tọa Sát Bát Đồ · ${target.name}: BẤT TỬ — tử vong bị chặn ở 1 HP.`,'win')}return dealt.damage}
function domainHpDamage(core,source,target,ratio,label,opts={}){if(!target||target.defeated)return 0;const resist=simpleResist(core,target.side),amount=Math.max(1,Math.round(target.maxHp*ratio*(1-resist)));return rawDamage(core,source,target,amount,label,opts)}
function clearSimple(core,side,reason=''){const st=sideState(core,side);if(!st.simpleActive)return;const old=st.simpleActive;st.simpleActive=null;refreshHp(core,side);core.pushLog?.(`${old.name||SIMPLE[old.id]?.name||'Giản Dị Lãnh Địa'} kết thúc.`,'domain');core.pushEvent?.('domain-simple-end',{side,id:old.id,reason})}
function clearExpansion(core,side,reason=''){const st=sideState(core,side);if(!st.expansion)return;const old=st.expansion;st.expansion=null;if(old.id==='jackpot_bagua')st.jackpotAttempts=0;st.pendingActionScale=1;refreshHp(core,side);core.pushLog?.(`${old.name} kết thúc.`,'domain');core.pushEvent?.('domain-expansion-end',{side,id:old.id,reason})}
function shuffle(core,a){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(core.rng()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function statusResisted(core,target,status,{force=false}={}){const resist=simpleResist(core,target.side);if(force||resist<=0||!HARD_CC.has(status))return false;if(core.rng()<resist){core.pushEvent?.('status-resist',{targetId:target.id,status,domain:true,resist});core.pushLog?.(`${target.name} kháng ${Math.round(resist*100)}% hiệu ứng ${status} từ Bành Trướng.`,'domain');return true}return false}
function applyDomainStatus(core,source,target,status,{duration=null,potency=1,force=false,stack=false,stackCap=1,antiHeal=null,seedDamage=0,burnRate=null,tickCapRatio=null}={}){
  if(!target||target.defeated)return false;
  const resist=simpleResist(core,target.side),effect=Math.max(.10,Number(potency||1)*(1-resist));
  if(statusResisted(core,target,status,{force}))return false;
  if(status==='AntiHeal'){
    target.customStatuses=target.customStatuses||{};
    const v=Math.max(0,Number(antiHeal??.50)*(1-resist));
    target.customStatuses.AntiHeal={turns:Math.max(1,Number(duration)||2),healingReceived:-v,kind:'debuff',sourceId:source?.id||null,domain:true};
    core.pushEvent?.('domain-status',{sourceId:source?.id||null,targetId:target.id,status:'AntiHeal',turns:duration||2,potency:v});
    return true;
  }
  if(status==='Shock'){
    target.customStatuses=target.customStatuses||{};
    target.customStatuses.Shock={turns:Math.max(1,Number(duration)||2),stat:'speed',pct:-.20*(1-resist),kind:'debuff',sourceId:source?.id||null,domain:true};
    const before=Number(target.meter||0),cut=Math.round(10*(1-resist));
    target.meter=Math.max(0,before-cut);
    core.pushEvent?.('domain-status',{sourceId:source?.id||null,targetId:target.id,status:'Shock',turns:duration||2,potency:1-resist});
    return true;
  }
  const previousStacks=stack?Number(target.statuses?.[status]?.stacks||0):0;
  const turns=Math.max(1,Number(duration)||(status==='Freeze'?1:3));
  E.addStatus(target,status,source,turns,{effectMultiplier:effect,seedDamage:Math.max(0,Number(seedDamage)||0),burnRate:status==='Burn'&&burnRate!=null?Number(burnRate):undefined,tickCapRatio:status==='Burn'&&tickCapRatio!=null?Number(tickCapRatio):undefined,stackCap:status==='Poison'?Math.max(1,Number(stackCap)||3):undefined});
  const row=target.statuses?.[status];
  if(row){
    row.domain=true;
    row.domainId=activeExpansion(core,source?.side)?.id||null;
    row.effectMultiplier=effect;
    if(stack)row.stacks=clamp(previousStacks+1,1,Math.max(1,Number(stackCap)||1));
  }
  core.pushEvent?.('domain-status',{sourceId:source?.id||null,targetId:target.id,status,turns,potency:effect,stacks:row?.stacks||1});
  return true;
}
function burnSpread(core,side,source,deadTarget,maxTargets=3){const burn=deadTarget?.statuses?.Burn;if(!burn)return;const foes=core.living(foeSide(side)).filter(x=>x.id!==deadTarget.id).sort((a,b)=>Number(Boolean(a.statuses?.Burn))-Number(Boolean(b.statuses?.Burn)));let n=0;for(const t of foes){if(n>=maxTargets)break;applyDomainStatus(core,source,t,'Burn',{duration:Math.max(2,Number(burn.turns)||2),potency:1,force:true,seedDamage:Number(burn.seedDamage||0),burnRate:.45,tickCapRatio:.16});core.pushLog?.(`Cửu Nhật · Burn từ ${deadTarget.name} lan sang ${t.name}.`,'domain');n++}if(n)core.pushEvent?.('domain-burn-spread',{side,sourceId:source?.id||null,fromId:deadTarget.id,count:n})}
function poisonSpread(core,side,source,deadTarget,maxTargets=2){const poison=deadTarget?.statuses?.Poison;if(!poison)return;const foes=core.living(foeSide(side)).filter(x=>x.id!==deadTarget.id);if(!foes.length)return;const stacks=Math.max(1,Math.ceil(Number(poison.stacks||1)/2)),picked=[];for(const t of foes.sort(()=>core.rng()-.5).slice(0,maxTargets)){for(let i=0;i<stacks;i++)applyDomainStatus(core,source,t,'Poison',{duration:Math.max(2,Number(poison.turns)||2),potency:1,force:true,stack:true,stackCap:EXP.myriad_poison.poisonStackCap});picked.push(t.id);core.pushLog?.(`Vạn Độc · Poison từ ${deadTarget.name} lan ${stacks} tầng sang ${t.name}.`,'domain')}if(picked.length)core.pushEvent?.('domain-poison-spread',{side,sourceId:source?.id||null,fromId:deadTarget.id,targetIds:picked,stacks})}
function bạoViêm(core,att,target){const burn=target.statuses?.Burn,turns=Math.max(0,Number(burn?.turns)||0),atk=Math.max(1,Number(core.effective?.(att)?.atk||att.stats?.atk||1)),cap=Math.round(target.maxHp*.22),raw=Math.round(target.maxHp*(.10+.012*Math.min(3,turns))+atk*.45),resist=simpleResist(core,target.side),damage=rawDamage(core,att,target,Math.min(cap,Math.round(raw*(1-resist))),'Bạo Viêm');if(!target.defeated)applyDomainStatus(core,att,target,'Burn',{duration:3,potency:1,force:true,seedDamage:Math.max(Number(burn?.seedDamage||0),damage),burnRate:.45,tickCapRatio:.16});core.pushLog?.(`Cửu Nhật · ${target.name}: 4/4 Phần Ấn → BẠO VIÊM ${damage.toLocaleString('vi-VN')} sát thương + làm mới Burn.`,'win');core.pushEvent?.('domain-burst',{side:att.side,id:'nine_suns',sourceId:att.id,targetId:target.id,damage})}
function pursuit(core,att,target,result){if(!target||target.defeated)return 0;const base=Math.max(1,Math.round((Number(result?.damage)||0)*.45)),cap=Math.max(1,Math.round(target.maxHp*.16)),resist=simpleResist(core,target.side),amount=Math.max(1,Math.round(Math.min(base,cap)*(1-resist)));const damage=rawDamage(core,att,target,amount,'Truy Kích');core.pushLog?.(`Thiên Kích · 4 hit → TRUY KÍCH gây ${damage.toLocaleString('vi-VN')} sát thương.`,'win');return damage}
function nominalHits(ability,result){if(Number.isFinite(Number(ability?.hits)))return Math.max(1,Number(ability.hits));const text=`${ability?.name||''} ${ability?.description||ability?.rulesText||''}`;const candidates=[];for(const re of [/(?:bắn|tung|chém|đánh|gây)\s*(\d+)\s*(?:phát|nhát|hit|đòn)/ig,/(\d+)\s*(?:phát|nhát|hit)\b/ig]){let m;while((m=re.exec(text)))candidates.push(Number(m[1]))}const best=candidates.filter(n=>n>=2&&n<=20).sort((a,b)=>b-a)[0];if(best)return best;return Math.max(1,(result?.impacts||[]).filter(x=>!x.evaded&&Number(x.damage||0)>0).length||1)}
function coldKey(side){return `Hàn Khí ${side}`}
function addCold(core,att,target){target.customStatuses=target.customStatuses||{};const k=coldKey(att.side),x=target.customStatuses[k]||{stacks:0,turns:4,kind:'debuff',sourceId:att.id,domain:true};x.stacks=clamp(Number(x.stacks||0)+1,1,3);x.turns=4;const potency=1-simpleResist(core,target.side);x.stat='speed';x.pct=-.10*x.stacks*potency;x.outgoingPenalty=.07*x.stacks*potency;x.sourceId=att.id;x.domain=true;target.customStatuses[k]=x;core.pushLog?.(`Huyền Băng · ${target.name}: Hàn Khí ${x.stacks}/3 · SPEED −${x.stacks*10}% · Damage −${x.stacks*7}%.`,'domain');core.pushEvent?.('domain-cold',{side:att.side,sourceId:att.id,targetId:target.id,stacks:x.stacks});if(x.stacks>=3){delete target.customStatuses[k];if(target.boss){const potency=1-simpleResist(core,target.side);target.customStatuses['Hàn Phong']={turns:2,stat:'speed',pct:-.30*potency,outgoingPenalty:.20*potency,kind:'debuff',sourceId:att.id,domain:true};core.pushEvent?.('domain-status',{sourceId:att.id,targetId:target.id,status:'Hàn Phong',turns:2});core.pushLog?.(`Huyền Băng · ${target.name}: 3/3 Hàn Khí → HÀN PHONG: SPEED −30% · Damage −20%.`,'win')}else if(applyDomainStatus(core,att,target,'Freeze',{duration:1,potency:1})){core.pushLog?.(`Huyền Băng · ${target.name}: 3/3 Hàn Khí → ĐÔNG KẾT.`,'win')}}}
function shatter(core,att,target){E.removeStatus?.(target,'Freeze');const damage=domainHpDamage(core,att,target,.15,'Phá Băng');target.customStatuses=target.customStatuses||{};target.customStatuses['Phá Băng DEF']={turns:2,stat:'def',pct:-.30*(1-simpleResist(core,target.side)),kind:'debuff',sourceId:att.id,domain:true};const spread=core.living(target.side).filter(x=>x.id!==target.id&&!x.defeated).slice(0,2);for(const t of spread)addCold(core,att,t);core.pushLog?.(`Huyền Băng · ${target.name}: PHÁ BĂNG ${damage.toLocaleString('vi-VN')} + DEF −30%; Hàn Khí phát tán ${spread.length} mục tiêu.`,'win');core.pushEvent?.('domain-shatter',{side:att.side,sourceId:att.id,targetId:target.id,damage,spread:spread.map(x=>x.id)})}
function gainTrấnKhí(core,side,source,target,amount=1){const d=activeExpansion(core,side);if(!d||d.id!=='diamond_guard')return;d.guardMarks=Number(d.guardMarks||0)+Math.max(1,Number(amount)||1);core.pushLog?.(`Bất Động · ${target.name}: Trấn Khí ${Math.min(3,d.guardMarks)}/3.`,'domain');while(d.guardMarks>=3){d.guardMarks-=3;let cleansed=0;for(const u of core.living(side)){const g=addShield(u,Math.round(u.maxHp*.12),.40);if(g>0)core.pushEvent?.('shield',{sourceId:source?.id||target.id,targetId:u.id,amount:g,label:'Kim Cương Hộ Giáp'});if(cleanseOne(core,u,source?.id||target.id))cleansed++}core.pushLog?.(`Bất Động · 3/3 Trấn Khí → toàn đội nhận Giáp 12% Max HP${cleansed?` + giải ${cleansed} debuff`:''}.`,'win');core.pushEvent?.('domain-diamond-guard',{side,sourceId:source?.id||target.id,cleansed})}}
function counterBlocked(core,defender,attacker,absorbed){if(!defender||!attacker||attacker.defeated||absorbed<=0)return 0;const cap=Math.round(attacker.maxHp*.10),amount=Math.min(cap,Math.max(1,Math.round(absorbed*.55))),damage=rawDamage(core,defender,attacker,amount,'Kim Cương Phản Chấn');if(damage>0){core.pushLog?.(`Bất Động · ${defender.name} phản chấn ${damage.toLocaleString('vi-VN')} sát thương.`,'domain');core.pushEvent?.('domain-counter',{side:defender.side,sourceId:defender.id,targetId:attacker.id,damage})}return damage}
function cleanseOne(core,u,sourceId=null){const beneficial=new Set(['Defense Up','Attack Up','AP Up','Shield','Regeneration','Speed Up']);const key=Object.keys(u.statuses||{}).find(k=>!beneficial.has(k));if(key){E.removeStatus?.(u,key);core.pushEvent?.('cleanse',{sourceId,targetId:u.id,status:key,domain:true});return key}const ckey=Object.keys(u.customStatuses||{}).find(k=>u.customStatuses[k]?.kind==='debuff');if(ckey){delete u.customStatuses[ckey];core.pushEvent?.('cleanse',{sourceId,targetId:u.id,status:ckey,domain:true});return ckey}return null}
function gainSinhQi(core,side,amount,label='Overheal'){const d=activeExpansion(core,side);if(!d||d.id!=='rebirth_wood'||amount<=0)return;const before=clamp(Number(d.sinhQi||0),0,100),gain=Math.max(1,Math.round(amount)),total=Math.min(100,before+gain);d.sinhQi=total;const source=core.living(side)[0]||null;if(before<25&&total>=25){d.healStage=true;core.pushLog?.('Vạn Mộc · Sinh Khí 25/100 → Mộc Dưỡng: hiệu quả hồi phục +20%.','win');core.pushEvent?.('domain-rebirth-stage',{side,stage:25})}if(before<50&&total>=50){for(const u of core.living(side)){const healed=E.healTarget(u,Math.round(u.maxHp*.06));if(healed>0)core.pushEvent?.('heal',{sourceId:source?.id||null,targetIds:[u.id],amount:healed,label:'Sinh Mạch'});applyDomainStatus(core,source||u,u,'Regeneration',{duration:3,potency:1,force:true})}core.pushLog?.('Vạn Mộc · Sinh Khí 50/100 → Sinh Mạch: hồi ngay 6% HP + HoT 3 lượt toàn đội.','win');core.pushEvent?.('domain-rebirth-stage',{side,stage:50})}if(before<75&&total>=75){for(const u of core.living(side)){E.addCombatBuff?.(u,{id:`DOMAIN:REBIRTH:75:${side}`,stat:'DAMAGE_AMP',value:.20,duration:3,sourcePowId:source?.powId||null,stacking:'MAX',dispellable:true})}core.pushLog?.('Vạn Mộc · Sinh Khí 75/100 → Vạn Mộc Hưng Thịnh: toàn đội +20% Damage trong 3 lượt.','win');core.pushEvent?.('domain-rebirth-stage',{side,stage:75})}if(before<100&&total>=100){for(const u of core.living(side)){const healed=E.healTarget(u,Math.round(u.maxHp*.20)),shield=addShield(u,Math.round(u.maxHp*.15),.50),cleaned=[];for(let i=0;i<2;i++){const c=cleanseOne(core,u,source?.id||null);if(c)cleaned.push(c)}E.addCombatBuff?.(u,{id:`DOMAIN:REBIRTH:100:${side}`,stat:'DAMAGE_AMP',value:.25,duration:2,sourcePowId:source?.powId||null,stacking:'MAX',dispellable:true});if(healed>0)core.pushEvent?.('heal',{sourceId:source?.id||null,targetIds:[u.id],amount:healed,label:'Luân Sinh'});if(shield>0)core.pushEvent?.('shield',{sourceId:source?.id||null,targetId:u.id,amount:shield,label:'Luân Sinh'});if(cleaned.length)core.pushLog?.(`Vạn Mộc · ${u.name} được giải ${cleaned.join(' + ')}.`,'domain')}core.pushLog?.('Vạn Mộc · Sinh Khí 100/100 → LUÂN SINH: hồi 20% HP + Giáp 15% + giải 2 debuff +25% Damage.','win');core.pushEvent?.('domain-rebirth',{side});d.sinhQi=0;d.healStage=false}else core.pushLog?.(`Vạn Mộc · ${label}: Sinh Khí ${Math.round(d.sinhQi)}/100.`,'domain')}
function rescueBySinhQi(core,side){const d=activeExpansion(core,side);if(!d||d.id!=='rebirth_wood'||Number(d.sinhQi||0)<20)return[];const saved=[];for(const u of units(core,side,true)){if(!(u.hp<=0||u.defeated)||Number(d.sinhQi||0)<20)continue;d.sinhQi=Math.max(0,Number(d.sinhQi||0)-20);u.defeated=false;u.hp=Math.max(1,Math.round(u.maxHp*.15));saved.push(u);core.pushEvent?.('domain-rebirth-save',{side,targetId:u.id,hp:u.hp,sinhQi:d.sinhQi});core.pushLog?.(`Vạn Mộc · tiêu 20 Sinh Khí cứu ${u.name} ở 15% HP (${u.hp.toLocaleString('vi-VN')} HP).`,'win')}if(saved.length){const ids=new Set(saved.map(x=>x.id));for(const evt of core.events||[]){if(evt?.type==='damage')for(const imp of evt.impacts||[])if(ids.has(imp.targetId)){imp.killed=false;imp.hpAfter=core.allUnits.find(x=>x.id===imp.targetId)?.hp||1}}for(let i=(core.events?.length||0)-1;i>=0;i--)if(core.events[i]?.type==='kill'&&ids.has(core.events[i]?.targetId))core.events.splice(i,1)}return saved}
function healAndShield(core,att,damage){const ls=lifesteal(core,att);if(!ls.rate||damage<=0)return;const raw=Math.max(0,Math.round(damage*ls.rate)),missing=Math.max(0,att.maxHp-att.hp),heal=Math.min(raw,missing);let healed=0;if(heal>0){healed=E.healTarget(att,heal);if(healed>0)core.pushEvent?.('heal',{sourceId:att.id,targetIds:[att.id],amount:healed,label:'Hút máu'})}const excess=Math.max(0,raw-heal);if(excess>0){const got=addShield(att,excess,ls.cap||.5);if(got>0)core.pushEvent?.('shield',{sourceId:att.id,targetId:att.id,amount:got,label:'Hút máu thừa → Giáp'})}if(activeExpansion(core,att.side)?.id==='rebirth_wood'){const qi=Math.max(0,(healed/Math.max(1,att.maxHp))*50+(excess/Math.max(1,att.maxHp))*100);if(qi>0)gainSinhQi(core,att.side,qi,excess>0?'Hút máu + Overheal':'Hút máu')}}
function healFromPoisonTick(core,side,amount,source){const cfg=EXP.myriad_poison,allies=core.living(side);if(!allies.length||amount<=0)return;const t=[...allies].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0],raw=Math.max(1,Math.round(amount*Number(cfg.stats.lifesteal||0))),healed=E.healTarget(t,raw);if(healed>0)core.pushEvent?.('heal',{sourceId:source?.id||null,targetIds:[t.id],amount:healed,label:'Thực Sinh · Hút Máu Poison'})}
function poisonExtraTick(core,side,source,target,label='Vạn Độc'){
  const p=target?.statuses?.Poison;
  if(!p||target.defeated)return 0;
  const stacks=clamp(Number(p.stacks||1),1,EXP.myriad_poison.poisonStackCap);
  const effect=clamp(Number(p.effectMultiplier)||1,.20,1.30);
  const amount=Math.max(1,Math.round(target.maxHp*Number(p.damagePerStack||.02)*stacks*effect));
  const damage=rawDamage(core,source,target,amount,label);
  healFromPoisonTick(core,side,damage,source);
  return damage;
}
function processDomainTicks(core,newEvents,beforeStatuses){
  for(const evt of newEvents||[]){
    if(evt?.type!=='status-tick'||evt?.event?.type!=='dot')continue;
    const target=core.allUnits.find(x=>x.id===evt.unitId),status=evt.event.status;
    const source=core.allUnits.find(x=>x.id===evt.sourceId)||null;
    if(!target)continue;
    const sourceSide=source?.side||foeSide(target.side),d=activeExpansion(core,sourceSide);
    if(!d)continue;

    if(d.id==='nine_suns'&&status==='Burn'){
      const burn=beforeStatuses?.[target.id]?.Burn||target.statuses?.Burn;
      if(burn?.domainId==='nine_suns'){
        const sourceStats=source?core.effective?.(source):null;
        const critRate=clamp(Number(sourceStats?.critRate||source?.stats?.critRate||0),0,100);
        const critDmg=Math.max(150,Number(sourceStats?.critDamage||source?.stats?.critDamage||150));
        if(source&&core.rng()*100<critRate&&!target.defeated){
          const bonus=Math.max(1,Math.round(Number(evt.event.amount||0)*(critDmg/100-1)));
          const damage=rawDamage(core,source,target,bonus,'Burn Crit');
          core.pushLog?.(`Cửu Nhật · Burn CRIT trên ${target.name}: +${damage.toLocaleString('vi-VN')}.`,'domain');
        }
        if(target.defeated)burnSpread(core,sourceSide,source,target,3);
      }
    }

    if(d.id==='myriad_poison'&&status==='Poison'){
      const p=beforeStatuses?.[target.id]?.Poison||target.statuses?.Poison;
      if(p?.domainId==='myriad_poison'){
        const stacks=clamp(Number(p.stacks||1),1,EXP.myriad_poison.poisonStackCap);
        // Engine V17.9 đã tự tính toàn bộ tầng Poison (2% Max HP mỗi tầng),
        // Domain chỉ theo dõi Độc Ấn / hút máu / tick phụ để tránh nhân đôi sát thương.
        const totalTick=Math.max(0,Number(evt.event.amount)||0);
        d.poisonMarks=Number(d.poisonMarks||0)+1;
        healFromPoisonTick(core,sourceSide,totalTick,source);
        core.pushLog?.(`Vạn Độc · Poison tick ${stacks} tầng → Độc Ấn ${Math.min(3,d.poisonMarks)}/3.`,'domain');
        if(target.defeated)poisonSpread(core,sourceSide,source,target);
        while(d.poisonMarks>=3){
          d.poisonMarks-=3;
          let total=0,stacked=0;
          for(const foe of core.living(foeSide(sourceSide)))if(foe.statuses?.Poison){total+=poisonExtraTick(core,sourceSide,source,foe,'Vạn Độc · Tick Phụ');applyDomainStatus(core,source,foe,'Poison',{duration:3,potency:1,force:true,stack:true,stackCap:EXP.myriad_poison.poisonStackCap});stacked++}
          core.pushLog?.(`Vạn Độc · 3/3 Độc Ấn → Poison tick thêm 1 lần + tăng 1 tầng trên ${stacked} mục tiêu (${total.toLocaleString('vi-VN')} damage).`,'win');
          core.pushEvent?.('domain-poison-burst',{side:sourceSide,sourceId:source?.id||null,total,stacked});
        }
      }
    }
  }
}
function swordStrike(core,side){const d=activeExpansion(core,side);if(!d||d.id!=='draw_swords'||!d.swords?.length)return;const sword=d.swords.shift(),foes=core.living(foeSide(side));if(!foes.length)return;const t=foes[Math.floor(core.rng()*foes.length)],src=core.living(side)[0]||units(core,side,false)[0],damage=domainHpDamage(core,src,t,.20,sword.name);if(!t.defeated){if(sword.status==='Burn')applyDomainStatus(core,src,t,'Burn',{duration:3,potency:1,force:true,seedDamage:damage});else if(sword.status==='Poison')applyDomainStatus(core,src,t,'Poison',{duration:3,potency:1,force:true,stack:true,stackCap:3});else if(sword.status==='Shock')applyDomainStatus(core,src,t,'Shock',{duration:2,force:true});else if(sword.status==='AntiHeal')applyDomainStatus(core,src,t,'AntiHeal',{duration:2,antiHeal:.50,force:true});else if(sword.status==='Freeze')applyDomainStatus(core,src,t,'Freeze',{duration:1,potency:1,force:false})}core.pushLog?.(`${sword.name} xuất kiếm · ${t.name} chịu 20% Max HP · ${sword.status}.`,'domain');core.pushEvent?.('domain-sword',{side,sourceId:src?.id||null,sword,targetId:t.id,damage,killed:Boolean(t.defeated),remaining:d.swords.length,sureHit:true})}
function normalDomainAfterAction(core,att,a,result,pre={}){
  const d=activeExpansion(core,att.side);if(!d)return;
  const targets=(result?.targets||[]).filter(Boolean),liveHits=(result?.impacts||[]).filter(x=>!x.evaded&&Number(x.damage||0)>0);
  if(d.id==='nine_suns'){
    for(const imp of liveHits){
      const t=core.allUnits.find(x=>x.id===imp.targetId);if(!t)continue;
      if(!t.defeated)applyDomainStatus(core,att,t,'Burn',{duration:3,potency:1,force:true,seedDamage:Number(imp.damage||0)+Number(imp.absorbed||0),burnRate:.45,tickCapRatio:.16});
      t.customStatuses=t.customStatuses||{};
      const k=`Phần Ấn ${att.side}`,x=t.customStatuses[k]||{stacks:0,turns:4,kind:'debuff',sourceId:att.id,domain:true};
      const gain=Math.max(1,nominalHits(a,result))*(att.element==='fire'?2:1);
      x.stacks=clamp(Number(x.stacks||0)+gain,0,4);x.turns=4;t.customStatuses[k]=x;
      core.pushLog?.(`Cửu Nhật · ${t.name}: Phần Ấn ${x.stacks}/4 · +${gain} Ấn${att.element==='fire'?' (Pow Hỏa ×2)':''}.`,'domain');
      if(x.stacks>=4&&!t.defeated){delete t.customStatuses[k];bạoViêm(core,att,t)}
      if(imp.killed||t.defeated)burnSpread(core,att.side,att,t,3);
    }
  }
  if(d.id==='infinite_strike'&&liveHits.length){
    const hits=nominalHits(a,result);d.comboHits=Number(d.comboHits||0)+hits;
    core.pushLog?.(`Thiên Kích · Liên Kích +${hits} → ${d.comboHits}/4 hit.`,'domain');
    const primary=targets.find(x=>!x.defeated)||targets[0];
    while(d.comboHits>=4&&primary&&!primary.defeated){
      d.comboHits-=4;const dealt=pursuit(core,att,primary,result);d.pursuitBursts=Number(d.pursuitBursts||0)+1;
      core.pushEvent?.('domain-pursuit',{side:att.side,sourceId:att.id,targetId:primary.id,damage:dealt,count:d.pursuitBursts});
      if(d.pursuitBursts%2===0){
        let total=0;for(const foe of core.living(foeSide(att.side)))total+=domainHpDamage(core,att,foe,.06,'Thiên Kích Bạo Liên');
        core.pushLog?.(`Thiên Kích · Truy Kích thứ ${d.pursuitBursts} → THIÊN KÍCH BẠO LIÊN quét ${total.toLocaleString('vi-VN')} damage.`,'win');
        core.pushEvent?.('domain-infinite-burst',{side:att.side,sourceId:att.id,total,count:d.pursuitBursts});
      }
    }
  }
  if(d.id==='frozen_silence'){
    for(const imp of liveHits){const t=core.allUnits.find(x=>x.id===imp.targetId);if(!t||t.defeated)continue;if(pre?.[t.id]?.Freeze){shatter(core,att,t);continue}addCold(core,att,t)}
  }
  if(d.id==='myriad_poison'){
    for(const imp of liveHits){
      const t=core.allUnits.find(x=>x.id===imp.targetId);if(!t)continue;
      if(!t.defeated){
        applyDomainStatus(core,att,t,'Poison',{duration:3,potency:1,force:true,stack:true,stackCap:EXP.myriad_poison.poisonStackCap});
        applyDomainStatus(core,att,t,'AntiHeal',{duration:2,antiHeal:EXP.myriad_poison.antiHeal,force:true});
        const stacks=t.statuses?.Poison?.stacks||1;
        if(stacks>=EXP.myriad_poison.poisonStackCap){
          t.customStatuses=t.customStatuses||{};const resist=1-simpleResist(core,t.side);
          t.customStatuses['Độc Thực']={turns:2,stat:'def',pct:-.15*resist,outgoingPenalty:.10*resist,kind:'debuff',sourceId:att.id,domain:true};
          core.pushEvent?.('domain-poison-corrosion',{side:att.side,sourceId:att.id,targetId:t.id,stacks});
        }
        core.pushLog?.(`Vạn Độc · ${t.name}: Poison ${stacks}/${EXP.myriad_poison.poisonStackCap} + giảm hồi máu 30%${stacks>=EXP.myriad_poison.poisonStackCap?' + Độc Thực':''}.`,'domain');
      }
      if(imp.killed||t.defeated)poisonSpread(core,att.side,att,t,2);
    }
  }
}
function afterIncomingDefense(core,result,targetSide,attacker){const d=activeExpansion(core,targetSide);if(!d)return;if(d.id==='diamond_guard'){for(const imp of result?.impacts||[]){const t=core.allUnits.find(u=>u.id===imp.targetId);if(t?.side!==targetSide)continue;const pressure=(Number(imp.damage)||0)+(Number(imp.absorbed)||0);if(pressure>0)gainTrấnKhí(core,targetSide,t,t,1);if((Number(imp.absorbed)||0)>0&&attacker)counterBlocked(core,t,attacker,Number(imp.absorbed)||0)}}if(d.id==='rebirth_wood')rescueBySinhQi(core,targetSide)}
function immortalCheck(core){const saved=[];for(const side of ['player','enemy']){const d=activeExpansion(core,side);if(!d||d.id!=='jackpot_bagua')continue;for(const u of units(core,side,true)){if(u.hp<=0||u.defeated){u.defeated=false;u.hp=1;saved.push(u)}u.mana=u.maxMana}}if(saved.length){const ids=new Set(saved.map(u=>u.id));for(const evt of core.events||[]){if(evt?.type==='damage')for(const imp of evt.impacts||[])if(ids.has(imp.targetId)){imp.killed=false;imp.hpAfter=1}}for(let i=(core.events?.length||0)-1;i>=0;i--)if(core.events[i]?.type==='kill'&&ids.has(core.events[i]?.targetId))core.events.splice(i,1);for(const u of saved){core.pushEvent?.('domain-immortal',{side:u.side,targetId:u.id,hp:1});core.pushLog?.(`Tọa Sát Bát Đồ · ${u.name}: BẤT TỬ — tử vong bị chặn ở 1 HP.`,'win')}}return saved}
function normalDomainOpening(core,side,actor){
  const st=sideState(core,side),d=st.expansion,cfg=d&&EXP[d.id];if(!d||cfg?.kind!=='normal')return;
  const foes=core.living(foeSide(side)),allies=core.living(side),src=actor||allies[0]||null;
  if(d.id==='nine_suns'){
    for(const t of foes){t.customStatuses=t.customStatuses||{};const k=`Phần Ấn ${side}`;t.customStatuses[k]={stacks:1,turns:4,kind:'debuff',sourceId:src?.id||null,domain:true}}
    core.pushLog?.(`Cửu Nhật mở giới → ${foes.length} kẻ địch nhận sẵn 1/4 Phần Ấn.`,'win');
    core.pushEvent?.('domain-normal-opening',{side,id:d.id,effect:'sun-mark',targets:foes.map(x=>x.id)});
  }
  if(d.id==='infinite_strike'){
    d.comboHits=1;d.pursuitBursts=0;
    core.pushLog?.('Thiên Kích mở giới → bắt đầu sẵn 1/4 Liên Kích.','win');
    core.pushEvent?.('domain-normal-opening',{side,id:d.id,effect:'combo-seed',value:1});
  }
  if(d.id==='frozen_silence'){
    for(const t of foes)if(src)addCold(core,src,t);
    core.pushLog?.(`Huyền Băng mở giới → toàn địch nhận 1 tầng Hàn Khí.`,'win');
    core.pushEvent?.('domain-normal-opening',{side,id:d.id,effect:'cold-wave',targets:foes.map(x=>x.id)});
  }
  if(d.id==='diamond_guard'){
    let total=0;for(const u of allies){const g=addShield(u,Math.round(u.maxHp*.12),.40);total+=g;if(g>0)core.pushEvent?.('shield',{sourceId:src?.id||null,targetId:u.id,amount:g,label:'Kim Cương Khai Giới'})}
    core.pushLog?.(`Bất Động mở giới → toàn đội nhận Giáp 12% Max HP (${total.toLocaleString('vi-VN')} tổng Giáp).`,'win');
    core.pushEvent?.('domain-normal-opening',{side,id:d.id,effect:'diamond-shield',total});
  }
  if(d.id==='myriad_poison'){
    for(const t of foes){applyDomainStatus(core,src,t,'Poison',{duration:3,potency:1,force:true,stack:true,stackCap:EXP.myriad_poison.poisonStackCap});applyDomainStatus(core,src,t,'AntiHeal',{duration:2,antiHeal:EXP.myriad_poison.antiHeal,force:true})}
    core.pushLog?.(`Vạn Độc mở giới → toàn địch nhận 1 tầng Poison + giảm hồi máu.`,'win');
    core.pushEvent?.('domain-normal-opening',{side,id:d.id,effect:'poison-wave',targets:foes.map(x=>x.id)});
  }
  if(d.id==='rebirth_wood'){
    gainSinhQi(core,side,25,'Mở Lãnh Địa');
    core.pushEvent?.('domain-normal-opening',{side,id:d.id,effect:'sinh-qi',value:25});
  }
}
function consumeExpansionAction(core,side,{skipped=false}={}){const d=activeExpansion(core,side);if(!d)return;if(d.id==='draw_swords'&&!skipped)swordStrike(core,side);d.remainingActions=Math.max(0,Number(d.remainingActions||1)-1);if(d.remainingActions<=0)clearExpansion(core,side,'duration')}
C.TAMER_SIMPLE=SIMPLE;C.TAMER_EXPANSIONS=EXP;C.DOMAIN_LEVELS=LEVELS;C.DOMAIN_BRANCHES=BRANCH;C.DOMAIN_SWORDS=SWORDS;C.PVP_DOMAIN_DIRECT_CAP=PVP_CAP;
const oldStart=P.start,oldBegin=P.beginTurn,oldFinish=P.finishCurrent,oldEffective=P.effective,oldOff=P.offensiveEffect,oldSupport=P.supportEffect,oldExec=P.executeAction,oldResolveGuard=P.resolveGuard;
P.configureDomainLoadout=function(side,{simpleId,simpleLevel,expansionId}={}){const st=sideState(this,side),sid=SIMPLE[simpleId]?simpleId:st.equippedSimple,level=LEVELS[simpleLevel]?Number(simpleLevel):st.simpleLevel,branch=SIMPLE[sid]?.branch,eid=EXP[expansionId]&&EXP[expansionId].branch===branch?expansionId:(BRANCH[branch]?.[0]||st.equippedExpansion);st.equippedSimple=sid;st.simpleLevel=level;st.equippedExpansion=eid;return{...st}};
P.getDomainState=function(side='player'){return sideState(this,side)};
P.getDomainLoadout=function(side='player'){const st=sideState(this,side);return{simple:SIMPLE[st.equippedSimple],level:LEVELS[st.simpleLevel],expansion:EXP[st.equippedExpansion]}};
P.activeSimple=function(side=null){side=side||this.state.current?.side||'player';return activeSimple(this,side)};
P.activeDomain=function(side=null){side=side||this.state.current?.side||'player';return activeExpansion(this,side)};
P.updateDomainTurn=function(){};
P.canUseTamerSimple=function(sideOrId,idMaybe,levelMaybe){let side='player',id=idMaybe;if(SIMPLE[sideOrId]){id=sideOrId;side=this.state.current?.side||'player'}else side=sideOrId||'player';const st=sideState(this,side),cur=this.state.current;if(!SIMPLE_DOMAIN_ENABLED||!SIMPLE[id]||!cur||cur.side!==side||this.state.phase!=='running'||this.state.finished||st.simpleCharges<=0||activeExpansion(this,side)||st.simpleActive)return false;return true};
P.useTamerSimple=function(sideOrId,idMaybe,levelMaybe){let side='player',id=idMaybe,level=levelMaybe;if(SIMPLE[sideOrId]){id=sideOrId;side=this.state.current?.side||'player'}else side=sideOrId||'player';const st=sideState(this,side);id=id||st.equippedSimple;level=LEVELS[level]?Number(level):st.simpleLevel;if(!this.canUseTamerSimple(side,id,level))return false;st.simpleCharges--;st.simpleActive={id,level,name:SIMPLE[id].name,actorId:this.state.current.id,actorTurn:Number(this.state.current.turnsTaken||0),hasCompletedCycle:false,actionsElapsed:0};st.equippedSimple=id;st.simpleLevel=level;refreshHp(this,side);this.pushLog?.(`Giản Dị Lãnh Địa · ${SIMPLE[id].name} · ${LEVELS[level].name}.`,'domain');this.pushEvent?.('domain-simple',{side,id,level,charges:st.simpleCharges});return true};
P.canExpandDomain=function(sideOrId,idMaybe){if(!DOMAIN_EXPANSION_ENABLED)return false;let side='player',id=idMaybe;if(EXP[sideOrId]){id=sideOrId;side=this.state.current?.side||'player'}else side=sideOrId||'player';const st=sideState(this,side),cur=this.state.current;id=id||st.equippedExpansion;if(this.mode!=='pvp'||!EXP[id]||!cur||cur.side!==side||this.state.phase!=='running'||this.state.finished||st.expansion)return false;if(EXP[id].branch!==SIMPLE[st.equippedSimple]?.branch)return false;const turnKey=`${cur.id}:${cur.turnsTaken}`;if(EXP[id].multiAttempt)return st.lastAttemptKey!==turnKey;return !st.expansionUsed};
P.expandDomain=function(sideOrId,idMaybe){let side='player',id=idMaybe;if(EXP[sideOrId]){id=sideOrId;side=this.state.current?.side||'player'}else side=sideOrId||'player';const st=sideState(this,side);id=id||st.equippedExpansion;if(!this.canExpandDomain(side,id))return false;const cfg=EXP[id],cur=this.state.current;clearSimple(this,side,'expansion');st.equippedExpansion=id;if(id==='jackpot_bagua'){const turnKey=`${cur.id}:${cur.turnsTaken}`,chance=Math.min(.95,.25+st.jackpotAttempts*.05);st.lastAttemptKey=turnKey;st.jackpotAttempts++;const hit=this.rng()<chance;this.pushEvent?.(hit?'domain-jackpot':'domain-jackpot-fail',{side,id,chance,attempt:st.jackpotAttempts});this.pushLog?.(`Tọa Sát Bát Đồ · ${Math.round(chance*100)}% ${hit?'— JACKPOT!':'— chưa kích hoạt.'}`,hit?'win':'domain');if(!hit)return{ok:false,jackpot:false,chance,attempt:st.jackpotAttempts}}else st.expansionUsed=true;st.expansion={id,name:cfg.name,branch:cfg.branch,kind:cfg.kind,remainingActions:cfg.durationActions,startedAt:Date.now(),comboHits:0,sinhQi:0,poisonMarks:0,guardMarks:0,swords:id==='draw_swords'?shuffle(this,SWORDS):null};st.limitlessCorrect=0;st.limitlessBurstDone=false;st.pendingActionScale=1;refreshHp(this,side);if(id==='jackpot_bagua')for(const u of units(this,side,true))u.mana=u.maxMana;this.pushLog?.(`BÀNH TRƯỚNG LÃNH ĐỊA · ${cfg.name}.`,'domain');this.pushEvent?.('domain-expansion',{side,id,name:cfg.name,kind:cfg.kind,remainingActions:cfg.durationActions});normalDomainOpening(this,side,cur);return{id,name:cfg.name,jackpot:id==='jackpot_bagua'?true:undefined}};
P.setPendingDomainActionScale=function(side,scale=1){const st=sideState(this,side);if(!DOMAIN_EXPANSION_ENABLED){st.pendingActionScale=1;return 1}const v=clamp(Number(scale)||0,0,3);st.pendingActionScale=clamp(Number(st.pendingActionScale??1)*v,0,3);return st.pendingActionScale};
P.clearPendingDomainActionScale=function(side){sideState(this,side).pendingActionScale=1};
P.addLimitlessCorrect=function(side,count=0){if(!DOMAIN_EXPANSION_ENABLED)return false;const st=sideState(this,side),d=st.expansion;if(!d||d.id!=='limitless_void')return false;st.limitlessCorrect=Math.min(10,Number(st.limitlessCorrect||0)+Math.max(0,Number(count)||0));if(st.limitlessCorrect>=10&&!st.limitlessBurstDone){st.limitlessBurstDone=true;const src=this.living(side)[0];let total=0;for(const t of this.living(foeSide(side)))total+=domainHpDamage(this,src,t,.50,'Vô Lượng Quá Tải');this.pushLog?.(`Vô Lượng · đủ 10 câu đúng → toàn đội địch chịu 50% Max HP (${total.toLocaleString('vi-VN')} damage).`,'win');this.pushEvent?.('domain-limitless-burst',{side,correct:st.limitlessCorrect,total});return true}return false};
P.start=function(){ensure(this);return oldStart.call(this)};
P.beginTurn=function(){ensure(this);const beforeLen=(this.events||[]).length,beforeStatuses={};for(const u of this.allUnits||[])beforeStatuses[u.id]=Object.fromEntries(Object.entries(u.statuses||{}).map(([k,v])=>[k,{...v}]));const r=oldBegin.call(this);const newEvents=(this.events||[]).slice(beforeLen);processDomainTicks(this,newEvents,beforeStatuses);const cur=this.state.current;if(cur){for(const side of ['player','enemy']){const st=sideState(this,side),a=activeSimple(this,side);if(a){a.actionsElapsed=Number(a.actionsElapsed||0)+1;const activator=units(this,side,true).find(u=>u.id===a.actorId&&!u.defeated);if(!activator||((cur.id===a.actorId)&&a.hasCompletedCycle)||a.actionsElapsed>12)clearSimple(this,side,'turn')}const d=activeExpansion(this,side);if(d?.id==='jackpot_bagua')for(const u of units(this,side,true))u.mana=u.maxMana}refreshHp(this,cur.side)}immortalCheck(this);for(const side of ['player','enemy'])rescueBySinhQi(this,side);const chosen=r?.unit;if(chosen&&(chosen.defeated||Number(chosen.hp)<=0)){if(this.state.current?.id===chosen.id)this.finishCurrent(true);return{type:'skip',unit:chosen,reason:'defeated-by-domain-tick'}}return r};
P.finishCurrent=function(skipped=false){const actor=this.state.current,side=actor?.side;if(actor){const st=sideState(this,side),a=st.simpleActive;if(a&&a.actorId===actor.id)a.hasCompletedCycle=true}const r=oldFinish.call(this,skipped);if(actor&&activeExpansion(this,side))consumeExpansionAction(this,side,{skipped:Boolean(skipped)});immortalCheck(this);rescueBySinhQi(this,side);return r};
P.effective=function(u){const s=oldEffective.call(this,u);const side=u.side,sa=activeSimple(this,side),sc=simpleCfg(this,side),ep=expansionCfg(this,side);if(sa&&sc){const t=sc.tiers?.[sa.level]||{};if(t.def)s.def=Math.max(1,Math.round(s.def*(1+t.def)));if(t.crit)s.critRate=clamp(Number(s.critRate||0)+t.crit,0,100);if(t.critDamage)s.critDamage=Math.max(100,Number(s.critDamage||100)+t.critDamage)}if(ep){if(ep.id!=='draw_swords'){if(ep.stats?.def)s.def=Math.max(1,Math.round(s.def*(1+ep.stats.def)));if(ep.stats?.crit)s.critRate=clamp(Number(s.critRate||0)+ep.stats.crit,0,100);if(ep.stats?.critDamage)s.critDamage=Math.max(100,Number(s.critDamage||100)+ep.stats.critDamage)}if(ep.id==='diamond_guard')s.shieldPower=clamp(Number(s.shieldPower||0)+Number(ep.shieldPower||0),0,60)}return s};
P.resolveGuard=function(attacker,original,ability,key){if(!original||activeExpansion(this,original.side)?.id!=='diamond_guard')return oldResolveGuard.call(this,attacker,original,ability,key);const guards=(original.side==='player'?this.living('player'):this.living('enemy')).filter(u=>u.id!==original.id);for(const g of guards)g.guardBonus=Number(g.guardBonus||0)+Number(EXP.diamond_guard.guardBonus||0);try{return oldResolveGuard.call(this,attacker,original,ability,key)}finally{for(const g of guards)g.guardBonus=Number(g.guardBonus||0)-Number(EXP.diamond_guard.guardBonus||0)}};
P.offensiveEffect=function(att,a,key,targets,know,targetCorePayoff=null,effectKnow=1){
  ensure(this);
  const st=sideState(this,att.side),d=activeExpansion(this,att.side),cfg=d?EXP[d.id]:null;
  const ownBonus=d?expansionDamage(this,att.side,att):simpleDamage(this,att.side);
  const pending=clamp(Number(st.pendingActionScale??1),0,3);
  const pre={};
  for(const t of targets||[])pre[t.id]=Object.fromEntries(Object.entries(t.statuses||{}).map(([k,v])=>[k,{...v}]));

  const sure=Boolean(cfg?.sureHit),aa=sure?{...a,unavoidable:true,sureHit:true}:a;
  const targetSide=(targets||[]).find(Boolean)?.side||foeSide(att.side);
  const resist=d?simpleResist(this,targetSide):0;
  const domainFactor=1+ownBonus*(1-resist);
  const cold=Object.values(att.customStatuses||{}).find(x=>x?.domain&&Number(x?.outgoingPenalty)>0);
  const coldFactor=1-clamp(Number(cold?.outgoingPenalty)||0,0,.50);
  const damageScale=domainFactor*pending*coldFactor;

  // Bất Động phải giảm damage thật ở lớp incoming(), không chỉ tăng một thuộc tính mà engine không đọc.
  const tempDiamond=[];
  if(activeExpansion(this,targetSide)?.id==='diamond_guard'){
    for(const u of this.living(targetSide)){
      u.customStatuses=u.customStatuses||{};
      const k='__DOMAIN_DIAMOND_DR__',old=u.customStatuses[k];
      tempDiamond.push([u,k,old]);
      u.customStatuses[k]={turns:1,incomingDR:Number(EXP.diamond_guard.incomingReduction||0),kind:'buff',domain:true,sourceId:null};
    }
  }

  // Vô Lượng sai >=2 phải là 0 damage tuyệt đối. Core cũ ép damage tối thiểu 1,
  // vì vậy chặn damageTarget trong đúng action này nhưng vẫn cho hiệu ứng kỹ năng chạy.
  const originalDamageTarget=E.damageTarget;
  if(pending<=0)E.damageTarget=()=>({damage:0,absorbed:0});
  this._domainAttackContext={attackerSide:att.side,sureHit:sure};
  let res;
  try{
    res=oldOff.call(this,att,aa,key,targets,Number(know||1)*damageScale,targetCorePayoff,effectKnow);
  }finally{
    E.damageTarget=originalDamageTarget;
    for(const [u,k,old] of tempDiamond){if(old===undefined)delete u.customStatuses[k];else u.customStatuses[k]=old;}
    this._domainAttackContext=null;
    st.pendingActionScale=1;
  }

  healAndShield(this,att,Number(res?.damage)||0);
  normalDomainAfterAction(this,att,a,res,pre);
  afterIncomingDefense(this,res,targetSide,att);
  immortalCheck(this);
  rescueBySinhQi(this,targetSide);
  return res;
};
P.supportEffect=function(att,a,targets,key='skill1',effectKnow=1,damageKnow=1){
  ensure(this);
  const st=sideState(this,att.side),d=activeExpansion(this,att.side),rebirth=d?.id==='rebirth_wood';
  const foe=foeSide(att.side),ownBonus=d?expansionDamage(this,att.side,att):simpleDamage(this,att.side);
  const resist=d?simpleResist(this,foe):0,pending=clamp(Number(st.pendingActionScale??1),0,3);
  const cold=Object.values(att.customStatuses||{}).find(x=>x?.domain&&Number(x?.outgoingPenalty)>0);
  const damageFactor=(1+ownBonus*(1-resist))*pending*(1-clamp(Number(cold?.outgoingPenalty)||0,0,.50));
  const pre={};for(const u of this.living(foe))pre[u.id]=Object.fromEntries(Object.entries(u.statuses||{}).map(([k,v])=>[k,{...v}]));

  const originalHeal=E.healTarget,originalDamage=E.damageTarget;
  let qiGain=0;
  if(rebirth){
    E.healTarget=(target,amount,options={})=>{
      const sameSide=target?.side===att.side&&!target?.defeated;
      const boosted=sameSide&&d.healStage?Math.round(Number(amount||0)*1.20):amount;
      const missing=sameSide?Math.max(0,target.maxHp-target.hp):0;
      const healed=originalHeal(target,boosted,options);
      if(sameSide){
        const attempted=Math.max(0,Number(boosted)||0),excess=Math.max(0,attempted-missing);
        qiGain+=(Math.max(0,Number(healed)||0)/Math.max(1,target.maxHp))*50+(excess/Math.max(1,target.maxHp))*100;
      }
      return healed;
    };
  }
  // Hybrid support (ví dụ vừa hồi vừa gây damage) vẫn phải chịu luật Vô Lượng/cường hóa Lãnh Địa.
  E.damageTarget=(target,amount)=>target?.side===foe?originalDamage(target,Math.max(0,Math.round(Number(amount||0)*damageFactor))):originalDamage(target,amount);

  const tempDiamond=[];
  if(activeExpansion(this,foe)?.id==='diamond_guard'){
    for(const u of this.living(foe)){
      u.customStatuses=u.customStatuses||{};const k='__DOMAIN_DIAMOND_DR__',old=u.customStatuses[k];
      tempDiamond.push([u,k,old]);u.customStatuses[k]={turns:1,incomingDR:Number(EXP.diamond_guard.incomingReduction||0),kind:'buff',domain:true,sourceId:null};
    }
  }

  let res;
  try{res=oldSupport.call(this,att,a,targets,key,effectKnow,damageKnow)}finally{
    E.healTarget=originalHeal;E.damageTarget=originalDamage;
    for(const [u,k,old] of tempDiamond){if(old===undefined)delete u.customStatuses[k];else u.customStatuses[k]=old;}
    st.pendingActionScale=1;
  }
  if(rebirth&&qiGain>0)gainSinhQi(this,att.side,qiGain,'Overheal');

  const impacts=res?.secondaryImpacts||res?.impacts||[];
  if(impacts.length){
    const damagedTargets=impacts.map(x=>this.allUnits.find(u=>u.id===x.targetId)).filter(Boolean);
    const pseudo={...res,impacts,targets:damagedTargets};
    healAndShield(this,att,Number(res?.damage)||0);
    normalDomainAfterAction(this,att,a,pseudo,pre);
    afterIncomingDefense(this,pseudo,foe,att);
  }
  immortalCheck(this);rescueBySinhQi(this,foe);
  return res;
};
P.executeAction=function(att,key,req,knowledge={baseWrong:0,extraCorrect:0}){try{return oldExec.call(this,att,key,req,knowledge)}finally{if(att?.side)sideState(this,att.side).pendingActionScale=1;immortalCheck(this);for(const side of ['player','enemy'])rescueBySinhQi(this,side)}};
P.domainBalanceSnapshot=function(){const out={};for(const side of ['player','enemy']){const st=sideState(this,side);out[side]={simpleCharges:st.simpleCharges,simple:activeSimple(this,side),expansion:activeExpansion(this,side),equippedSimple:st.equippedSimple,simpleLevel:st.simpleLevel,equippedExpansion:st.equippedExpansion,jackpotAttempts:st.jackpotAttempts,limitlessCorrect:st.limitlessCorrect,pendingActionScale:DOMAIN_EXPANSION_ENABLED?st.pendingActionScale:1}}return out};
window.POWDER_DOMAIN_SYSTEM_V15={version:'15.0.0',SIMPLE,EXPANSIONS:EXP,LEVELS,BRANCH,SWORDS,PVP_CAP,pvpCap,lockedExpansionCount:9,normalExpansionCount:6,specialExpansionCount:3,lockedExpansionIds:[...__domainIds],serverVerifiedOnline:['limitless_void','draw_swords','jackpot_bagua'],features:{simpleEnabled:SIMPLE_DOMAIN_ENABLED,expansionEnabled:DOMAIN_EXPANSION_ENABLED},policy:{simpleModes:['pve','boss'],expansionModes:DOMAIN_EXPANSION_ENABLED?['pvp']:[],normalExpansionActions:4,limitlessActions:2,drawSwordActions:5,jackpotActions:3,sureHit:'Cửu Nhật Burn và 5 kiếm của Rút Kiếm Ra được server xác nhận; Jackpot Tất Trúng trong thời gian hiệu lực; không bỏ qua DEF toàn cục.',simpleResistance:'Sơ/Trung/Cao giảm 30/40/50% phần damage/effect do Bành Trướng tạo thêm.',onlineAuthority:'18.8.0: damage/heal/CC/terrain/swords/question impact được xác minh phía server.'}};
window.POWDER_DOMAIN_SYSTEM_V14=window.POWDER_DOMAIN_SYSTEM_V15;window.POWDER_DOMAIN_SYSTEM_V13=window.POWDER_DOMAIN_SYSTEM_V15;
})();
