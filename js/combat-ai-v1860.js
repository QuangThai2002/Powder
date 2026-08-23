(()=>{
'use strict';
const E=window.POWDER_ENGINE;
const VERSION='18.6.0-pve-intelligence';
const BENEFICIAL=new Set(['Defense Up','Attack Up','AP Up','Shield','Regeneration','Speed Up','Cleanse','Effect Resist','Guard']);
const NEGATIVE_HINT=/(stun|freeze|poison|burn|slow|petr|sleep|antiheal|defense down|attack down|ap down|accuracy|mark|curse|debuff|choáng|đóng băng|độc|thiêu|giảm)/i;
const HEAL_HINT=/(heal|hồi|trị liệu|regeneration|regen|tái sinh)/i;
const SHIELD_HINT=/(shield|giáp|khiên|bảo hộ|guard)/i;
const CLEANSE_HINT=/(cleanse|thanh tẩy|giải|xóa.*debuff)/i;
const CONTROL_HINT=/(stun|freeze|petr|sleep|paralysis|bind|silence|choáng|đóng băng)/i;
const AREA_TARGETS=new Set(['all','all-enemies','team','allies','two-enemies','two-allies','three-allies','front-row','back-row']);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ratio=u=>Math.max(0,Number(u?.hp)||0)/Math.max(1,Number(u?.maxHp)||1);
const effectiveHp=u=>Math.max(0,Number(u?.hp)||0)+Math.max(0,Number(u?.shield)||0);
const textOf=a=>`${a?.name||''} ${a?.description||a?.rulesText||''}`.toLowerCase();
const negativeCount=u=>Object.entries({...u?.statuses,...u?.customStatuses}).reduce((n,[k,v])=>n+((!BENEFICIAL.has(k)&&NEGATIVE_HINT.test(`${k} ${JSON.stringify(v||{})}`))?1:0),0);
const hasStatus=(u,s)=>Boolean(u?.statuses?.[s]||u?.customStatuses?.[s]);
const area=a=>Boolean(a?.area||AREA_TARGETS.has(a?.target));
const support=a=>['ally','self','team','allies','two-allies','three-allies','self-and-ally','self-and-lowest-ally'].includes(a?.target)||((a?.type==='support')&&!['enemy','all','all-enemies','enemy-or-ally'].includes(a?.target))||(BENEFICIAL.has(a?.status)&&a?.target!=='enemy');
function elementMult(attacker,target){try{return Number(E?.elementMultiplier?.(attacker?.element,target?.element))||1}catch(_){return 1}}
function expectedDamage(core,unit,target,ability,key){
  if(!unit||!target||!ability||support(ability))return 0;
  try{
    const fixed=()=>.5;
    const calc=E?.calculateDamage?.(unit,target,ability,{key,area:area(ability),unavoidable:Boolean(ability?.sureHit||ability?.unavoidable||ability?.tags?.includes?.('UNAVOIDABLE')),combo:Number(unit.combo)||0,sameElementAllies:0,rng:fixed});
    let amount=Math.max(0,Number(calc?.damage??calc?.amount)||0);
    if(amount>0)return amount;
  }catch(_){}
  const stats=core?.effective?.(unit)||unit.stats||{},def=core?.effective?.(target)?.def||target.stats?.def||1;
  const p=Math.max(0,Number(ability?.power)||0),stat=(ability?.type==='physical'?Number(stats.atk):Number(stats.ap||stats.atk))||1;
  if(p<=0)return 0;
  const factor=E?.scaledDefenseFactor?.(stat,def,ability?.type==='physical'?.85:.70)||100/(100+Math.max(0,def)*.65);
  return Math.max(1,Math.round(stat*(p/100)*factor*elementMult(unit,target)));
}
function rolePriority(attacker,target){
  const role=attacker?.combatRole||'marksman',tr=target?.combatRole||'marksman';
  if(role==='assassin')return ['healer','mage','marksman','enchanter','musician'].includes(tr)?18:tr==='tank'?-12:0;
  if(role==='marksman')return ['mage','healer','enchanter'].includes(tr)?10:0;
  if(role==='fighter'||role==='knight')return ['tank','fighter','knight'].includes(tr)?8:0;
  if(role==='mage')return ['tank','knight'].includes(tr)?6:0;
  return 0;
}
const BOSS_POLICY=Object.freeze({
  daily:Object.freeze({thresholds:[.50],patterns:[
    {id:'probe',label:'THĂM DÒ ĐỘI HÌNH',hint:'Ép tuyến trước và tìm Pow thấp HP.',prefer:{skill1:10,skill2:8,basic:4},target:'weakest'},
    {id:'blood_pressure',label:'HUYẾT LIỆP TĂNG ÁP',hint:'Ưu tiên mục tiêu bị đánh dấu và đòn kết liễu.',prefer:{ultimate:34,skill2:20,skill1:10},target:'marked-low'}
  ]}),
  weekly:Object.freeze({thresholds:[.70,.35],patterns:[
    {id:'formation_probe',label:'THĂM DÒ TRẬN TUYẾN',hint:'Ưu tiên kỹ năng diện rộng để ép cả đội.',prefer:{skill2:12,skill1:10,basic:2},areaBonus:18,target:'presence'},
    {id:'line_break',label:'PHÁ VỠ TRẬN TUYẾN',hint:'Ưu tiên khống chế, phá khiên và mục tiêu đang suy yếu.',prefer:{skill2:28,ultimate:12,skill1:12},controlBonus:18,shieldBreakBonus:18,target:'weakest'},
    {id:'cataclysm',label:'ĐẠI NẠN TỐI HẬU',hint:'Tích cực dùng Tối thượng và kỹ năng diện rộng để kết thúc trận.',prefer:{ultimate:54,skill2:24,skill1:10},areaBonus:24,target:'marked-low'}
  ]}),
  promotion:Object.freeze({thresholds:[.50],patterns:[
    {id:'evaluation',label:'THẨM ĐỊNH ĐỘI HÌNH',hint:'Đánh cân bằng, ưu tiên kỹ năng tạo lợi thế.',prefer:{skill1:10,skill2:12,basic:3},target:'presence'},
    {id:'breakthrough',label:'PHÁ TRẬN THĂNG HẠNG',hint:'Ưu tiên phá khiên, khống chế và kết liễu Pow yếu.',prefer:{ultimate:30,skill2:26,skill1:10},controlBonus:14,shieldBreakBonus:20,target:'weakest'}
  ]}),
  story:Object.freeze({thresholds:[.55],patterns:[
    {id:'guardian',label:'THẾ THỦ HỘ VỆ',hint:'Boss thăm dò và gây áp lực theo vai trò.',prefer:{skill1:10,skill2:10,basic:3},target:'presence'},
    {id:'enrage',label:'BẠO PHÁT CỐT TRUYỆN',hint:'Boss chuyển sang nhịp tấn công mạnh, săn Pow thấp HP.',prefer:{ultimate:32,skill2:22,skill1:10},areaBonus:12,target:'weakest'}
  ]})
});
function bossPolicy(type='daily'){return BOSS_POLICY[type]||BOSS_POLICY.story}
function bossPlan(core,boss){
  const type=String(core?.bossType||boss?.bossType||'daily'),policy=bossPolicy(type),phase=clamp(Math.max(1,Number(boss?.bossPhase)||1),1,policy.patterns.length),pattern=policy.patterns[phase-1]||policy.patterns.at(-1);
  return {...pattern,type,phase,maxPhase:policy.patterns.length,thresholds:[...policy.thresholds]};
}
function abilityAdjustment(unit,ability,key,ctx={}){
  const t=textOf(ability),allies=Array.isArray(ctx.alliesList)?ctx.alliesList:[],enemies=Array.isArray(ctx.enemiesList)?ctx.enemiesList:[];
  const tier=unit?.boss?'boss':(unit?.aiTier||'standard');
  const scale=tier==='boss'?1:tier==='elite'?.86:.68;
  let score=0;const reasons=[];
  const heal=HEAL_HINT.test(t)||ability?.status==='Regeneration',shield=SHIELD_HINT.test(t)||ability?.status==='Shield',cleanse=CLEANSE_HINT.test(t)||ability?.status==='Cleanse';
  const low=Math.min(1,...allies.map(ratio)),avg=allies.length?allies.reduce((n,u)=>n+ratio(u),0)/allies.length:1,debuffs=allies.reduce((n,u)=>n+negativeCount(u),0);
  if(cleanse){if(debuffs>0){score+=Math.min(76,28+debuffs*18);reasons.push('cleanse-needed')}else{score-=42;reasons.push('avoid-empty-cleanse')}}
  if(heal){if(low<.30){score+=70;reasons.push('critical-heal')}else if(low<.52){score+=42;reasons.push('heal-window')}else if(avg>.90){score-=48;reasons.push('avoid-overheal')}else if(low>.78){score-=24;reasons.push('save-heal')}}
  if(shield){const uncovered=allies.filter(u=>(Number(u.shield)||0)<u.maxHp*.08).length;if(low<.50){score+=34;reasons.push('protect-low')}else if(uncovered===0){score-=34;reasons.push('avoid-reshield')}else score+=Math.min(22,uncovered*6)}
  if(key==='ultimate'){
    const enemyLow=Math.min(1,...enemies.map(ratio)),allyCrisis=low<.35;
    if(enemyLow>.68&&!allyCrisis&&Number(ctx.round||1)<4){score-=36;reasons.push('hold-ultimate')}
    if(enemyLow<.32){score+=28;reasons.push('ultimate-finish-window')}
  }
  if(CONTROL_HINT.test(t)&&enemies.length){const available=enemies.filter(u=>!hasStatus(u,'Stun')&&!hasStatus(u,'Freeze')&&!hasStatus(u,'Petrify')&&!hasStatus(u,'Sleep')).length;if(!available){score-=26;reasons.push('avoid-redundant-cc')}else score+=Math.min(20,available*5)}
  if(unit?.boss){const p=bossPlan(ctx.core,unit);score+=Number(p.prefer?.[key]||0);if(p.areaBonus&&area(ability))score+=p.areaBonus;if(p.controlBonus&&CONTROL_HINT.test(t))score+=p.controlBonus;if(p.shieldBreakBonus&&/(phá giáp|shield break|xuyên|pierce|break)/i.test(t))score+=p.shieldBreakBonus;reasons.push(`boss:${p.id}`)}
  return {score:Math.round(score*scale),reasons};
}
function targetAdjustment(unit,target,ability,key,ctx={}){
  if(!target)return{score:0,reasons:[]};const same=unit?.side===target?.side,t=textOf(ability),reasons=[];let score=0;
  if(same){
    const hp=ratio(target),missing=1-hp,neg=negativeCount(target),shieldRatio=(Number(target.shield)||0)/Math.max(1,target.maxHp);
    if(CLEANSE_HINT.test(t)||ability?.status==='Cleanse'){score+=neg*28+(neg?18:-45);if(neg)reasons.push('debuffed-ally')}
    if(HEAL_HINT.test(t)||ability?.status==='Regeneration'){score+=missing*82;if(hp>.94)score-=60;if(hp<.32)score+=34;reasons.push('missing-hp')}
    if(SHIELD_HINT.test(t)||ability?.status==='Shield'){score+=(1-clamp(shieldRatio,0,1))*30;if(shieldRatio>.30)score-=26;if(hp<.45)score+=20;reasons.push('shield-need')}
    if(target.id===unit.id&&hp>.88&&ability?.target!=='self')score-=8;
    return{score,reasons};
  }
  const ehp=effectiveHp(target),expected=expectedDamage(ctx.core,unit,target,ability,key),hp=ratio(target),elem=elementMult(unit,target);
  if(expected>0){const lethal=expected>=ehp*.94;if(lethal){score+=84;reasons.push('lethal')}else if(expected>=ehp*.68){score+=30;reasons.push('near-lethal')}score+=(1-hp)*34;}
  if(elem>1.001){score+=26*(elem-1)/.25;reasons.push('element-weakness')}else if(elem<.999){score-=16*(1-elem)/.25;reasons.push('element-resist')}
  score+=rolePriority(unit,target);
  if(target.customStatuses?.['Boss Mark']||target.customStatuses?.['Hunt Mark']||target.customStatuses?.['Aim Mark']){score+=26;reasons.push('marked')}
  if(unit?.boss){const p=bossPlan(ctx.core,unit);if(p.target==='weakest')score+=(1-hp)*28;if(p.target==='marked-low'&&(target.customStatuses?.['Boss Mark']||hp<.42))score+=32;}
  return{score,reasons,expectedDamage:Math.round(expected),lethal:expected>=ehp*.94,elementMultiplier:elem};
}
function decisionSummary(core,unit,decision){
  const plan=unit?.boss?bossPlan(core,unit):null,top=decision?.candidates?.[0],second=decision?.candidates?.[1],confidence=top&&second?clamp(Math.round((top.score-second.score)*4+58),55,96):70;
  return {tier:unit?.aiTier||'standard',intent:plan?.label||(decision?.key==='ultimate'?'DỒN SÁT THƯƠNG':support(decision?.ability)?'HỖ TRỢ ĐỘI':'GÂY ÁP LỰC'),hint:plan?.hint||'',patternId:plan?.id||'',confidence};
}
window.POWDER_AI_PERSONALITY_V22={version:VERSION,abilityAdjustment,targetAdjustment,bossPolicy,bossPlan,decisionSummary,expectedDamage,negativeCount};
window.POWDER_PVE_AI_V1860=window.POWDER_AI_PERSONALITY_V22;
})();
