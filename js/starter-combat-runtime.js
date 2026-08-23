(()=>{'use strict';
const C=window.POWDER_COMBAT_CORE_V7,E=window.POWDER_ENGINE,D=window.POWDER_DATA,R=window.POWDER_FORM_RESOLVER;
if(!C?.BattleCore||!E||!D||!R)return;
const P=C.BattleCore.prototype;
const oldAbility=P.ability, oldOffensive=P.offensiveEffect, oldSupport=P.supportEffect, oldExecute=P.executeAction, oldBegin=P.beginTurn;
const ID_W='starter_water_aquelion',ID_L='starter_leaf_sylvion';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pOf=id=>D.pows.find(p=>p.id===id)||null;
const star=u=>Math.max(1,Math.min(6,Number(u?.owned?.stars||1)));
const sideAllies=(core,u)=>u.side==='player'?core.living('player'):core.living('enemy');
const sideFoes=(core,u)=>u.side==='player'?core.living('enemy'):core.living('player');
const unitById=(core,id)=>core.allUnits.find(x=>x.id===id)||null;
const diag=()=>window.POWDER_COMBAT_V9_DIAGNOSTICS;
const elemMult=(a,t)=>diag()?.elementMultiplier?.(a,t)??1;
function ensureV9(u){u.v9=u.v9||{};u.v9.starter=u.v9.starter||{};return u.v9.starter}
function byStar(map,s){return Number(map?.[String(s)]??map?.['1']??0)}
function chill(t){return !!(t?.statuses?.Slow||t?.statuses?.Freeze||Object.keys(t?.customStatuses||{}).some(k=>/chill|hàn khí|frost/i.test(k)))}
function frozen(t){return !!t?.statuses?.Freeze}
function direct(core,u,target,pct,stat='ap',label='Starter follow-up'){
 if(!u||!target||target.defeated||pct<=0)return 0;
 const as=core.effective(u),ds=core.effective(target),raw=(stat==='atk'?as.atk:as.ap)*(pct/100),factor=E.scaledDefenseFactor(stat==='atk'?as.atk:as.ap,ds.def,stat==='atk'?.85:.70),crit=core.rng()*100<as.critRate;
 const amount=Math.max(1,Math.round(raw*factor*elemMult(u,target)*(crit?as.critDamage/100:1)*C.DAMAGE_PACING));
 const before=target.hp,dealt=E.damageTarget(target,amount);
 core.pushEvent('damage',{sourceId:u.id,secondary:true,label,impacts:[{targetId:target.id,damage:dealt.damage,absorbed:dealt.absorbed,crit,element:elemMult(u,target),hpBefore:before,hpAfter:target.hp,secondary:true}],total:dealt.damage});
 return dealt.damage;
}

// ---------- Aquelion ----------
function aqState(u){const root=ensureV9(u);root.aquelion=root.aquelion||{coldTide:0,awakenedUsed:false,awakenedActions:0,fieldUntilRound:-1,fieldWater:0,fieldIce:0,echoCounter:0,echoRound:-1,roundFirst:{},nextWaterBoost:false};return root.aquelion}
function aqPow(u){return pOf(u?.powId===ID_W?ID_W:ID_W)}
function aqSealKey(aq){return `Aquelion Thủy Ấn ${aq.id}`}
function aqSeal(target,aq){return Number(target?.customStatuses?.[aqSealKey(aq)]?.stacks||0)}
function aqSealCap(aq){const p=pOf(ID_W),m=p?.coreMechanic?.waterSeal?.maxByStar||{};return byStar(m,star(aq))||6}
function addAqSeal(target,aq,n=1){if(!target||!aq||target.defeated)return 0;target.customStatuses=target.customStatuses||{};const key=aqSealKey(aq),before=aqSeal(target,aq),next=Math.min(aqSealCap(aq),before+Math.max(0,Number(n)||0));target.customStatuses[key]={turns:9999,sourceId:aq.id,kind:'mark',stacks:next,label:`Thủy Ấn ×${next}`};return next-before}
function aqColdCap(aq){const p=pOf(ID_W),m=p?.coreMechanic?.coldTide?.maxByStar||{};return byStar(m,star(aq))||8}
function addCold(core,aq,n=1){const s=aqState(aq),before=s.coldTide;s.coldTide=Math.min(aqColdCap(aq),s.coldTide+Math.max(0,Number(n)||0));if(star(aq)>=6&&!s.awakenedUsed&&s.coldTide>=12){s.awakenedUsed=true;s.awakenedActions=3;aq.customStatuses=aq.customStatuses||{};aq.customStatuses['Thần Hải Cửu Triều']={turns:9999,sourceId:aq.id,kind:'buff',stat:'ap',pct:.70};core.pushEvent('starter-awaken',{sourceId:aq.id,name:'Thần Hải Cửu Triều'});}return s.coldTide-before}
function aqMarked(target,aq,min=1){return aqSeal(target,aq)>=min}
function aqFieldActive(core,aq){return aqState(aq).fieldUntilRound>=core.state.round}
function transferSeal(core,aq,from){const n=aqSeal(from,aq);if(n<=0)return;const other=sideFoes(core,aq).filter(x=>x.id!==from.id&&!x.defeated).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(!other)return;const moved=Math.max(1,Math.floor(n*.5));from.customStatuses[aqSealKey(aq)].stacks=Math.max(0,n-moved);addAqSeal(other,aq,moved)}
function aqBonus(core,att,target,key){let b=0;const allies=sideAllies(core,att),aqs=allies.filter(x=>x.powId===ID_W);
 for(const aq of aqs){const n=aqSeal(target,aq),s=aqState(aq),st=star(aq),p=pOf(ID_W);if(n>0&&att.element==='water'){const per=byStar(p?.coreMechanic?.waterSeal?.waterDamageTakenPerStackPct,st)/100;b+=n*per}
   if(aqFieldActive(core,aq)){if(att.element==='water')b+=Number(s.fieldWater||0);if(att.element==='ice')b+=Number(s.fieldIce||0)}
   if(st>=2&&n>0&&['water','ice'].includes(att.element)){const rk=`${core.state.round}:${att.id}`;if(!s.roundFirst[rk]){s.roundFirst[rk]=true;b+=.15}}
 }
 if(att.powId===ID_W){const s=aqState(att);if(s.awakenedActions>0){b+=.60;if(chill(target))b+=.50}if(att._aqNextWaterActive)b+=.50;if(key==='ultimate'&&star(att)>=3){const total=sideFoes(core,att).reduce((n,t)=>n+aqSeal(t,att),0);if(total>=15)b+=.25}}
 return b;
}
function aqAfter(core,att,key,a,res){const allies=sideAllies(core,att),targets=res?.targets||[];
 // Ice/Water allies feed Aquelion's core mechanics.
 if(['ice','water'].includes(att.element))for(const aq of allies.filter(x=>x.powId===ID_W)){
   const st=star(aq),s=aqState(aq),marked=targets.filter(t=>aqMarked(t,aq,1));if(!marked.length)continue;
   if(att.element==='ice'){
     const eligible=marked.filter(t=>aqMarked(t,aq,2));if(eligible.length)addCold(core,aq,Math.min(2,eligible.length));
     if(st>=3){const t=marked.find(t=>aqMarked(t,aq,3));if(t)direct(core,aq,t,140,'ap','Băng Thủy Cộng Minh')}
     const fr=marked.find(frozen);if(fr){addCold(core,aq,2);if(st>=4)transferSeal(core,aq,fr);if(st>=6&&aqState(aq).awakenedActions>0)s.nextWaterBoost=true}
   }
   if(st>=5){if(s.echoRound!==core.state.round){s.echoRound=core.state.round;s.echoCounter=0}s.echoCounter++;if(s.echoCounter>=4){s.echoCounter=0;const t=[...sideFoes(core,aq)].sort((x,y)=>aqSeal(y,aq)-aqSeal(x,aq)||x.hp/x.maxHp-y.hp/y.maxHp)[0];const sk=R.resolveAbility(pOf(ID_W),pOf(ID_W).officialAbilities.skills[0],st);if(t)direct(core,aq,t,Number(sk.adjacentAp||sk.power||0)*.40,'ap','Hải Nguyệt Phản Chiếu')}}
 }
 if(att.powId!==ID_W)return;
 const st=star(att),s=aqState(att),primary=targets[0];if(key==='basic'&&primary){addAqSeal(primary,att,Number(a.waterSealApply||1));if(chill(primary))direct(core,att,primary,Number(a.chillBonusAp||0),'ap','Thủy Tinh Đạn · Hàn Khí')}
 if(key==='skill1'&&primary){addAqSeal(primary,att,Number(a.waterSealApply||2));if(chill(primary))direct(core,att,primary,Number(a.chillBonusAp||0),'ap','Hải Triều · Chill');if(frozen(primary))direct(core,att,primary,Number(a.frozenShatterAp||0)*(st>=5&&aqSeal(primary,att)>=10?1.5:1),'ap','Thủy Toái');const foes=sideFoes(core,att).filter(x=>x.id!==primary.id).sort((x,y)=>Math.abs((x.teamIndex||0)-(primary.teamIndex||0))-Math.abs((y.teamIndex||0)-(primary.teamIndex||0))).slice(0,2);for(const t of foes){direct(core,att,t,Number(a.adjacentAp||0),'ap','Hải Triều Phân Lưu');addAqSeal(t,att,2);if(chill(t))direct(core,att,t,Number(a.chillBonusAp||0),'ap','Hải Triều · Chill')}if(st>=6&&s.awakenedActions>0){direct(core,att,primary,360,'ap','Ngũ Hải Phân Lưu');direct(core,att,primary,360,'ap','Ngũ Hải Phân Lưu')}}
 if(key==='skill2'){s.fieldUntilRound=core.state.round+Math.max(1,Number(a.durationTurns||2))-1;s.fieldWater=Number(a.waterDamageBonusPct||0)/100;s.fieldIce=Number(a.iceDamageBonusPct||0)/100;core.pushEvent('starter-field',{sourceId:att.id,name:st>=6&&s.awakenedActions>0?'Thần Hải · Hàn Hải':'Hàn Hải Kết Giới',untilRound:s.fieldUntilRound})}
 if(key==='ultimate'){
   for(const t of sideFoes(core,att)){const n=aqSeal(t,att);if(n)direct(core,att,t,Number(a.perWaterSealAp||0)*n,'ap','Nguyệt Hải · Thủy Ấn')}
   const live=sideFoes(core,att).filter(x=>!x.defeated);const fin=[...live].sort((x,y)=>aqSeal(y,att)-aqSeal(x,att)||x.hp/x.maxHp-y.hp/y.maxHp)[0];if(fin){let coeff=Number(a.finisherBaseAp||0)+Number(a.perColdTideAp||0)*s.coldTide;if(st>=5&&s.coldTide>=aqColdCap(att))coeff*=1.5;if(st>=6&&s.awakenedActions>0)coeff*=1.8;if(st>=6&&s.awakenedActions>0&&frozen(fin))coeff*=1.5;direct(core,att,fin,coeff,'ap',st>=6&&s.awakenedActions>0?'Vạn Hải Băng Nguyệt':'Nguyệt Hải Thiên Triều');if(fin.defeated&&st>=4)transferSeal(core,att,fin);if(st>=5&&s.coldTide>=aqColdCap(att))s.coldTide=Math.ceil(s.coldTide*.5);else s.coldTide=0}
 }
 if(s.awakenedActions>0){s.awakenedActions--;if(s.awakenedActions<=0){delete att.customStatuses?.['Thần Hải Cửu Triều'];core.pushEvent('starter-awaken-end',{sourceId:att.id,name:'Thần Hải Cửu Triều'})}}
}

// ---------- Sylvion ----------
function syState(u){const root=ensureV9(u);root.sylvion=root.sylvion||{prosperity:0,fieldUntilRound:-1,fieldLeaf:0,fieldHealing:0,yearRings:0,lastRound:-1,roundContrib:{},firstHeal:{},eternalUsed:false,eternalUntilRound:-1,ultLeafUntilRound:-1};return root.sylvion}
function syLifeKey(sy){return `Sylvion Sinh Mạch ${sy.id}`}
function syBloomKey(sy){return `Sylvion Sinh Hoa ${sy.id}`}
function lifeStacks(target,sy){return Number(target?.customStatuses?.[syLifeKey(sy)]?.stacks||0)}
function lifeCap(sy){return byStar(pOf(ID_L)?.coreMechanic?.lifeVein?.maxByStar,star(sy))||6}
function addLife(target,sy,n=1){if(!target||target.defeated)return 0;target.customStatuses=target.customStatuses||{};const key=syLifeKey(sy),before=lifeStacks(target,sy),next=Math.min(lifeCap(sy),before+Math.max(0,Number(n)||0));target.customStatuses[key]={turns:9999,sourceId:sy.id,kind:'buff',stacks:next,label:`Sinh Mạch ×${next}`};return next-before}
function syProsCap(sy){return byStar(pOf(ID_L)?.coreMechanic?.prosperity?.maxByStar,star(sy))||10}
function addPros(core,sy,target,n=1,force=false){const s=syState(sy),rk=`${core.state.round}:${target?.id||'self'}`;s.roundContrib[rk]=Number(s.roundContrib[rk]||0);const room=force?99:Math.max(0,2-s.roundContrib[rk]),take=Math.min(Math.max(0,Number(n)||0),room,syProsCap(sy)-s.prosperity);if(take<=0)return 0;s.prosperity+=take;if(!force)s.roundContrib[rk]+=take;if(star(sy)>=6&&!s.eternalUsed&&s.prosperity>=20){s.eternalUsed=true;s.eternalUntilRound=core.state.round+2;core.pushEvent('starter-awaken',{sourceId:sy.id,name:'Thế Giới Thụ · Vĩnh Sinh Giới'})}return take}
function syFieldActive(core,sy){return syState(sy).fieldUntilRound>=core.state.round}
function syEternal(core,sy){return syState(sy).eternalUntilRound>=core.state.round}
function syHealMultiplier(core,sy,target,isSkill=true){let m=1,s=syState(sy),st=star(sy),p=pOf(ID_L);m*=1+s.prosperity*(Number(p?.coreMechanic?.prosperity?.selfHealingEffectPerStackPct||0)/100);if(syFieldActive(core,sy))m*=1+Number(s.fieldHealing||0);if(syEternal(core,sy)){m*=1.80;if(isSkill)m*=1.40}
 const lk=target?.customStatuses?.[syLifeKey(sy)],ls=Number(lk?.stacks||0),per=byStar(p?.coreMechanic?.lifeVein?.healingReceivedPerStackPctByStar,st)/100;if(ls)m*=1+ls*per;for(const v of Object.values(target?.customStatuses||{}))if(v?.sourceId===sy.id&&v?.kind==='bloom'&&Number(v.healingReceived))m*=1+Number(v.healingReceived);return m}
function activateBloom(core,sy,target){const st=star(sy),p=pOf(ID_L),b=p?.coreMechanic?.bloomState||{},damage=byStar(b.damageBonusPctByStar,st)/100,heal=byStar(b.healingReceivedPctByStar,st)/100,skill=byStar(b.skillEffectivenessPctByStar,st)/100;target.customStatuses=target.customStatuses||{};target.customStatuses[`Sylvion Nở Rộ ${sy.id}`]={turns:Number(b.durationMainActions||2),sourceId:sy.id,kind:'bloom',outgoingDamage:damage,healingReceived:heal,skillEffectiveness:skill,label:'Nở Rộ'};if(st>=4&&syFieldActive(core,sy)){const low=sideAllies(core,sy).filter(x=>x.id!==target.id).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,2);for(const t of low){const attempted=Math.round(core.effective(sy).ap*1.20),healed=E.healTarget(t,attempted);if(healed>0)core.pushEvent('heal',{sourceId:sy.id,targetIds:[t.id],amount:healed,secondary:true,label:'Nở Rộ · Hồi Phụ'})}}core.pushEvent('starter-bloom',{sourceId:sy.id,targetId:target.id})}
function addBloomFromOverheal(core,sy,target,overheal){if(overheal<=0)return;const st=star(sy),p=pOf(ID_L),conv=byStar(p?.coreMechanic?.lifeBloom?.overhealConversionPctByStar,st)/100,points=overheal*conv;if(points<=0)return;target.customStatuses=target.customStatuses||{};const key=syBloomKey(sy),obj=target.customStatuses[key]||{turns:9999,sourceId:sy.id,kind:'resource',points:0};obj.points=Number(obj.points||0)+points;target.customStatuses[key]=obj;addPros(core,sy,target,1);const threshold=target.maxHp*(Number(p?.coreMechanic?.lifeBloom?.thresholdPctOfMaxHp||20)/100);if(obj.points>=threshold){obj.points-=threshold;activateBloom(core,sy,target)}}
function syHeal(core,sy,target,attempted,{hot=false,echo=false,isSkill=true}={}){if(!target||target.defeated||attempted<=0)return 0;const before=target.hp,missing=Math.max(0,target.maxHp-before),scaled=Math.max(1,Math.round(attempted*syHealMultiplier(core,sy,target,isSkill))),actual=E.healTarget(target,scaled),over=Math.max(0,scaled-missing);if(!echo){addLife(target,sy,1);if(over>0)addBloomFromOverheal(core,sy,target,over);if(hot&&actual>0)addPros(core,sy,target,1);const st=star(sy),s=syState(sy),fk=`${core.state.round}:${target.id}`;if(st>=2&&!s.firstHeal[fk]){s.firstHeal[fk]=true;target.customStatuses=target.customStatuses||{};target.customStatuses[`Sylvion Mầm Sống ${sy.id}`]={turns:1,sourceId:sy.id,kind:'buff',outgoingDamage:target.element==='leaf'?.15:.10}}}core.pushEvent('heal',{sourceId:sy.id,targetIds:[target.id],amount:actual,secondary:hot||echo});return actual}
function syEcho(core,sy,exclude,amount){if(star(sy)<3||amount<=0)return;const t=sideAllies(core,sy).filter(x=>x.id!==exclude?.id&&!x.defeated).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(t)syHeal(core,sy,t,amount*.35,{echo:true,isSkill:true})}
function syBonus(core,att,target,key){let b=0;const sys=sideAllies(core,att).filter(x=>x.powId===ID_L);for(const sy of sys){const s=syState(sy),st=star(sy),p=pOf(ID_L),ls=lifeStacks(att,sy),per=byStar(p?.coreMechanic?.lifeVein?.damagePerStackPctByStar,st)/100;if(ls)b+=ls*per;for(const v of Object.values(att?.customStatuses||{}))if(v?.sourceId===sy.id&&Number(v.outgoingDamage))b+=Number(v.outgoingDamage);if(syFieldActive(core,sy)&&att.element==='leaf')b+=Number(s.fieldLeaf||0);if(att.element==='leaf'){b+=Math.floor(s.prosperity/5)*(Number(p?.coreMechanic?.prosperity?.leafTeamDamageBonusPer5StacksPct||10)/100);if(st>=5)b+=s.yearRings*(Number(p?.coreMechanic?.timeGrowth?.leafTeamDamagePerStackPct||8)/100);if(s.ultLeafUntilRound>=core.state.round)b+=.25}if(syEternal(core,sy)){b+=.70;if(key!=='basic')b+=.40;if(att.element==='leaf')b+=ls*.05}}
 return b}
function sySupport(core,att,a,targets,know=1){const st=star(att),s=syState(att),as=core.effective(att);let heal=0;if(a.id==='sylvion_skill1'){const t=targets[0]||sideAllies(core,att).sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0];if(t){const attempted=(as.ap*(Number(a.instantHealAp||0)/100)+t.maxHp*(Number(a.instantMaxHpPct||0)/100))*clamp(Number(know)||1,.20,1.36),actual=syHeal(core,att,t,attempted,{isSkill:true});heal+=actual;syEcho(core,att,t,actual);t.customStatuses=t.customStatuses||{};t.customStatuses[`Sylvion HoT ${att.id}`]={turns:Number(a.hotTurns||2),sourceId:att.id,kind:'hot',apPerTick:Number(a.hotApPerTick||0),label:'Mầm Sống'}}}
 else if(a.id==='sylvion_skill2'){s.fieldUntilRound=core.state.round+Math.max(1,Number(a.durationRounds||2))-1;s.fieldLeaf=Number(a.leafDamageBonusPct||0)/100;s.fieldHealing=Number(a.healingBonusPct||0)/100;core.pushEvent('starter-field',{sourceId:att.id,name:st>=6&&syEternal(core,att)?'Thánh Lâm Thế Giới':'Rừng Sinh Mệnh',untilRound:s.fieldUntilRound})}
 else if(a.id==='sylvion_ultimate'){let bloomCount=0,echoBase=0,echoExclude=null;for(const t of sideAllies(core,att)){const attempted=(as.ap*(Number(a.healAp||0)/100)+t.maxHp*(Number(a.healMaxHpPct||0)/100))*clamp(Number(know)||1,.20,1.36),actual=syHeal(core,att,t,attempted,{isSkill:true});heal+=actual;if(actual>echoBase){echoBase=actual;echoExclude=t}if(st>=3&&t.hp/t.maxHp<.5)addLife(t,att,2);if(Object.values(t.customStatuses||{}).some(v=>v?.sourceId===att.id&&v?.kind==='bloom'))bloomCount++}syEcho(core,att,echoExclude,echoBase);if(st>=4&&bloomCount>=3)s.ultLeafUntilRound=core.state.round+1;let effective=s.prosperity,consume=s.prosperity;if(st>=5&&s.prosperity>=20){effective=20;consume=10}const pct=Number(a.nextHitFinalDamagePerProsperityPct||0)/100*effective;if(pct>0)for(const t of sideAllies(core,att)){t.customStatuses=t.customStatuses||{};t.customStatuses[`Sylvion Đại Nở ${att.id}`]={turns:1,sourceId:att.id,kind:'buff',outgoingDamage:pct}}s.prosperity=Math.max(0,s.prosperity-consume)}
 return{damage:0,heal,targets};}
function syAfter(core,att,key,a,res){if(att.powId!==ID_L||key!=='basic')return;const allies=sideAllies(core,att),t=[...allies].sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0];if(!t)return;const actual=syHeal(core,att,t,core.effective(att).ap*(Number(a.healAp||0)/100),{isSkill:false});syEcho(core,att,t,actual)}
function syRound(core,sy){const s=syState(sy);if(s.lastRound===core.state.round)return;s.lastRound=core.state.round;if(star(sy)>=5&&sideAllies(core,sy).length>=3)s.yearRings=Math.min(Number(pOf(ID_L)?.coreMechanic?.timeGrowth?.maxStacks||5),s.yearRings+1);if(syEternal(core,sy))for(const t of sideAllies(core,sy)){const healed=E.healTarget(t,Math.round(t.maxHp*.12));if(healed>0)core.pushEvent('heal',{sourceId:sy.id,targetIds:[t.id],amount:healed,secondary:true,label:'Vĩnh Sinh Giới'})}}
function processHot(core,u){for(const [k,v] of Object.entries(u?.customStatuses||{})){if(v?.kind!=='hot'||!v.sourceId||Number(v.apPerTick)<=0)continue;const sy=unitById(core,v.sourceId);if(!sy||sy.defeated||sy.powId!==ID_L)continue;const actual=syHeal(core,sy,u,core.effective(sy).ap*(Number(v.apPerTick)/100),{hot:true,isSkill:true});if(star(sy)>=3)syEcho(core,sy,u,actual)}}

// Player and enemy special starters both resolve their form-scaled official kit.
P.ability=function(u,key){const a=oldAbility.call(this,u,key),p=this.pow?.(u);if(!p||!R.isEvolutionPow?.(p))return a;const resolved=R.resolveAbility(p,a,u?.owned?.stars||p.startStars),canon=window.POWDER_CANONICAL_ACTION_RUNTIME_V1850;return canon?.normalizeAbility?canon.normalizeAbility(p,key,resolved,false):resolved};

// Apply all special team multipliers as an exact final-damage follow-up instead of mutating the stable core formula.
P.offensiveEffect=function(att,a,key,targets,know,targetCorePayoff=null,effectKnow=1){const out=oldOffensive.call(this,att,a,key,targets,know,targetCorePayoff,effectKnow);for(const imp of out?.impacts||[]){const t=unitById(this,imp.targetId);if(!t||t.defeated||Number(imp.damage)<=0)continue;const bonus=aqBonus(this,att,t,key)+syBonus(this,att,t,key);if(bonus<=0)continue;const extra=Math.max(0,Math.round(Number(imp.damage)*bonus));if(extra<=0)continue;const before=t.hp,dealt=E.damageTarget(t,extra);out.damage=(Number(out.damage)||0)+dealt.damage;this.pushEvent('damage',{sourceId:att.id,secondary:true,label:'Cộng hưởng Starter',impacts:[{targetId:t.id,damage:dealt.damage,absorbed:dealt.absorbed,crit:false,element:1,hpBefore:before,hpAfter:t.hp,secondary:true}],total:dealt.damage})}return out};

P.supportEffect=function(att,a,targets,key='skill1',effectKnow=1,damageKnow=1){if(att?.powId===ID_L)return sySupport(this,att,a,targets,effectKnow);return oldSupport.call(this,att,a,targets,key,effectKnow,damageKnow)};

P.executeAction=function(att,key,req,knowledge={baseWrong:0,extraCorrect:0}){if(att?.powId===ID_W){const s=aqState(att);att._aqNextWaterActive=!!s.nextWaterBoost}const out=oldExecute.call(this,att,key,req,knowledge);const a=this.ability(att,key);if(att?.powId===ID_W&&att._aqNextWaterActive){aqState(att).nextWaterBoost=false;att._aqNextWaterActive=false}aqAfter(this,att,key,a,out);syAfter(this,att,key,a,out);return out};

P.beginTurn=function(){const r=oldBegin.call(this);if(r?.unit){for(const sy of this.allUnits.filter(x=>x.powId===ID_L&&!x.defeated))syRound(this,sy);processHot(this,r.unit)}return r};

window.POWDER_STARTER_COMBAT_V105={version:'10.8-origin-trio-core18.0',waterId:ID_W,leafId:ID_L};
})();
