(()=>{'use strict';
const RT=window.POWDER_COMBAT_RUNTIME_V21,C=window.POWDER_COMBAT_CORE_V7,E=window.POWDER_ENGINE,ENC=window.POWDER_BOSS_ENCOUNTER_V1860;
if(!RT||!C?.BattleCore||!E||!ENC)throw new Error('Boss Combat 18.6.1 requires Runtime/Core/Engine/Boss Encounter 18.6.0.');
const P=C.BattleCore.prototype,oldExec=P.executeAction,oldPhase=P.checkBossPhase,oldCheckEnd=P.checkEnd;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pendingOf=b=>b?.v9?.battleFlags?.bossMechanic1861||null;
const clearPending=b=>{if(b?.v9?.battleFlags)delete b.v9.battleFlags.bossMechanic1861;};
const ensureV9=b=>{b.v9=b.v9||{};b.v9.battleFlags=b.v9.battleFlags||{};return b.v9.battleFlags;};
const livingPlayer=core=>core.living('player');
const statusExists=(u,name)=>Boolean(u?.statuses?.[name]||u?.customStatuses?.[name]);
const removeStatus=(u,name)=>{if(u?.statuses?.[name])delete u.statuses[name];if(u?.customStatuses?.[name])delete u.customStatuses[name];};
const bossByCore=core=>core?.state?.enemies?.find?.(u=>u?.boss&&!u.defeated)||null;
const phase=b=>Math.max(1,Number(b?.bossPhase)||1);
const hpRatio=u=>Number(u?.hp||0)/Math.max(1,Number(u?.maxHp)||1);
function afterMechanicDamage(core,b,target,dealt,meta={}){const damage=Math.max(0,Number(dealt?.damage)||0),absorbed=Math.max(0,Number(dealt?.absorbed)||0);target.lastDamage=damage;target.rage=clamp((Number(target.rage)||0)+15,0,100);core.processMechanicEvent?.('DAMAGE_TAKEN',{actorId:b.id,sourceId:b.id,targetId:target.id,damage,absorbed,hpBefore:meta.hpBefore,hpAfter:target.hp,area:!!meta.area,key:'boss-mechanic',round:core.state.round},[target]);if(meta.shieldBreak)core.processMechanicEvent?.('SHIELD_BREAK',{actorId:b.id,sourceId:b.id,targetId:target.id,ownerId:target.id,key:'boss-mechanic',ability:meta.ability||'Boss Mechanic',round:core.state.round},core.allUnits);if(target.defeated)core.processMechanicEvent?.('KILL',{actorId:b.id,sourceId:b.id,targetId:target.id,bonus:1},core.allUnits);}
function responseLabel(kind){return kind==='cleanse'?'THANH TẨY':kind==='shield-break'?'PHÁ KHIÊN':'PHẢN ỨNG';}
function emitArm(core,b,p){
 core.pushEvent('boss-mechanic-arm',{bossId:b.id,bossType:core.bossType,mechanicId:p.id,name:p.name,phase:phase(b),response:p.response,responseLabel:responseLabel(p.response),targetIds:p.targetId?[p.targetId]:[],barrier:Number(p.barrierAmount)||0,window:1,detail:p.detail||''});
}
function emitOutcome(core,b,p,outcome,detail='',extra={}){
 core.pushEvent('boss-mechanic-outcome',{bossId:b.id,bossType:core.bossType,mechanicId:p.id,name:p.name,phase:phase(b),outcome,response:p.response,targetIds:p.targetId?[p.targetId]:[],detail,...extra});
}
function addBarrier(core,b,ratio,label){
 const baseline=Math.max(0,Number(b.shield)||0),amount=Math.max(1,Math.round(b.maxHp*ratio));b.shield=baseline+amount;
 core.pushEvent('shield',{sourceId:b.id,targetId:b.id,amount,label});return{baseline,amount};
}
function removeBarrierRemainder(b,p){
 if(!p||!Number.isFinite(Number(p.barrierBaseline))||!Number.isFinite(Number(p.barrierAmount)))return 0;
 const baseline=Math.max(0,Number(p.barrierBaseline)||0),current=Math.max(0,Number(b.shield)||0),remaining=Math.max(0,current-baseline),remove=Math.min(remaining,Math.max(0,Number(p.barrierAmount)||0));
 b.shield=Math.max(baseline,current-remove);return remove;
}
function cleanupPending(core,b,p){if(!p)return;if(p.response==='shield-break')removeBarrierRemainder(b,p);if(p.mark&&p.targetId){const t=core?.allRosterUnits?.find?.(u=>u.id===p.targetId);if(t)removeStatus(t,p.mark);}}
function armDaily(core,b,sig){
 const target=[...livingPlayer(core)].sort((a,z)=>hpRatio(a)-hpRatio(z)||Number(a.hp)-Number(z.hp))[0];if(!target)return null;
 target.customStatuses=target.customStatuses||{};target.customStatuses['Boss Mark']={turns:2,kind:'debuff',sourceId:b.id,bossMechanic:true};
 core.pushEvent('status-apply',{sourceId:b.id,targetId:target.id,status:'Boss Mark',turns:2,kind:'debuff'});
 return{id:'blood_hunt_window',signatureId:sig.id,name:'Huyết Liệp · Truy Sát',response:'cleanse',targetId:target.id,mark:'Boss Mark',armedTurn:Number(core.state.turnCount)||0,detail:`${target.name} bị đánh dấu. Thanh tẩy trước lượt Boss kế tiếp để hủy Truy Sát.`};
}
function armPromotion(core,b,sig){
 const x=addBarrier(core,b,phase(b)>=2?.10:.08,'Khiên Phá Trận');
 return{id:'formation_break_window',signatureId:sig.id,name:'Phá Trận · Khiên Chấn',response:'shield-break',barrierBaseline:x.baseline,barrierAmount:x.amount,armedTurn:Number(core.state.turnCount)||0,detail:`Phá ${x.amount.toLocaleString('vi-VN')} Khiên Chấn trước lượt Boss kế tiếp để ngắt Phá Trận.`};
}
function armWeekly(core,b,sig){
 const x=addBarrier(core,b,phase(b)>=3?.12:.10,'Khiên Đại Nạn');
 return{id:'cataclysm_window',signatureId:sig.id,name:'Đại Nạn · Tụ Năng',response:'shield-break',barrierBaseline:x.baseline,barrierAmount:x.amount,armedTurn:Number(core.state.turnCount)||0,detail:`Phá ${x.amount.toLocaleString('vi-VN')} Khiên Tụ Năng trước lượt Boss kế tiếp để ngắt Đại Nạn.`};
}
function armStory(core,b,sig){
 const target=[...livingPlayer(core)].sort((a,z)=>Number(core.effective?.(z)?.speed||z.stats?.speed||0)-Number(core.effective?.(a)?.speed||a.stats?.speed||0))[0];if(!target)return null;
 target.customStatuses=target.customStatuses||{};target.customStatuses['Suppression Mark']={turns:2,kind:'debuff',sourceId:b.id,bossMechanic:true};
 core.pushEvent('status-apply',{sourceId:b.id,targetId:target.id,status:'Suppression Mark',turns:2,kind:'debuff'});
 return{id:'suppression_window',signatureId:sig.id,name:'Trấn Áp · Khóa Nhịp',response:'cleanse',targetId:target.id,mark:'Suppression Mark',armedTurn:Number(core.state.turnCount)||0,detail:`${target.name} bị khóa nhịp. Thanh tẩy dấu ấn trước lượt Boss kế tiếp.`};
}
function armMechanic(core,b,sig){
 const type=core.bossType||b.bossType||'daily';let p=type==='weekly'?armWeekly(core,b,sig):type==='promotion'?armPromotion(core,b,sig):type==='story'?armStory(core,b,sig):armDaily(core,b,sig);
 if(!p)return null;p.bossType=type;p.phase=phase(b);p.armedAt=Date.now();ensureV9(b).bossMechanic1861=p;b.bossSigCounter=0;b.bossSigRemaining=1;emitArm(core,b,p);return p;
}
function barrierInterrupted(b,p){return Math.max(0,Number(b.shield)||0)<=Math.max(0,Number(p.barrierBaseline)||0)+1;}
function resolveDaily(core,b,p){
 const target=core.allRosterUnits.find(u=>u.id===p.targetId);if(!target||target.defeated||!statusExists(target,p.mark)){if(target)removeStatus(target,p.mark);emitOutcome(core,b,p,'cleansed','Dấu săn đã được thanh tẩy. Huyết Liệp bị vô hiệu.',{cleansed:true});return;}
 removeStatus(target,p.mark);const ratio=phase(b)>=2?.11:.085,before=target.hp,shieldBefore=Math.max(0,Number(target.shield)||0),amount=Math.max(1,Math.round(target.maxHp*ratio)),dealt=E.damageTarget(target,amount),shieldAfter=Math.max(0,Number(target.shield)||0);
 core.pushEvent('damage',{sourceId:b.id,key:'boss-mechanic',ability:'Huyết Liệp · Truy Sát',impacts:[{targetId:target.id,damage:dealt.damage,absorbed:dealt.absorbed||0,crit:false,hpBefore:before,hpAfter:target.hp,shieldBefore,shieldAfter,shieldBreak:shieldBefore>0&&shieldAfter<=0,killed:target.defeated,evaded:false,hitChance:100,mitigation:0}],total:dealt.damage,bossSignature:true,bossMechanic:true});afterMechanicDamage(core,b,target,dealt,{hpBefore:before,shieldBreak:shieldBefore>0&&shieldAfter<=0,ability:'Huyết Liệp · Truy Sát'});
 if(target.defeated)core.pushEvent('kill',{sourceId:b.id,targetId:target.id,ability:'Huyết Liệp · Truy Sát',crit:false,bossMechanic:true});emitOutcome(core,b,p,'resolved',`${target.name} chịu Truy Sát ${Math.round(ratio*100)}% Max HP.`,{totalDamage:Number(dealt.damage)||0,ratio});core.queueReplacements();core.checkEnd();
}
function resolvePromotion(core,b,p){
 if(barrierInterrupted(b,p)){b.meter=Math.max(0,(Number(b.meter)||0)-24);b.rage=Math.max(0,(Number(b.rage)||0)-25);emitOutcome(core,b,p,'interrupted','Khiên Chấn bị phá. Boss mất 24% Thanh lượt và 25 Nộ.',{interrupted:true,meterLoss:24,rageLoss:25});return;}
 removeBarrierRemainder(b,p);const ids=[];let broken=0;for(const u of livingPlayer(core)){ids.push(u.id);const before=Math.max(0,Number(u.shield)||0),lost=Math.round(before*.30);u.shield=Math.max(0,before-lost);broken+=lost;u.customStatuses=u.customStatuses||{};u.customStatuses.AntiHeal={turns:2,kind:'debuff',sourceId:b.id,healingReceived:-.25};core.pushEvent('status-apply',{sourceId:b.id,targetId:u.id,status:'AntiHeal',turns:2,kind:'debuff'});}emitOutcome(core,b,{...p,targetId:null},'resolved',`Phá ${broken} Giáp · hồi máu nhận -25% trong 2 lượt.`,{targetIds:ids,shieldBroken:broken});
}
function resolveWeekly(core,b,p){
 if(barrierInterrupted(b,p)){b.meter=Math.max(0,(Number(b.meter)||0)-30);b.rage=Math.max(0,(Number(b.rage)||0)-30);emitOutcome(core,b,p,'interrupted','Khiên Tụ Năng bị phá. Đại Nạn bị ngắt; Boss mất 30% Thanh lượt và 30 Nộ.',{interrupted:true,meterLoss:30,rageLoss:30});return;}
 removeBarrierRemainder(b,p);const ratio=phase(b)>=3?.10:.08,ids=[];let total=0;for(const u of livingPlayer(core)){const before=u.hp,shieldBefore=Math.max(0,Number(u.shield)||0),amount=Math.max(1,Math.round(u.maxHp*ratio)),dealt=E.damageTarget(u,amount),shieldAfter=Math.max(0,Number(u.shield)||0);ids.push(u.id);total+=Number(dealt.damage)||0;core.pushEvent('damage',{sourceId:b.id,key:'boss-mechanic',ability:'Đại Nạn',impacts:[{targetId:u.id,damage:dealt.damage,absorbed:dealt.absorbed||0,crit:false,hpBefore:before,hpAfter:u.hp,shieldBefore,shieldAfter,shieldBreak:shieldBefore>0&&shieldAfter<=0,killed:u.defeated,evaded:false,hitChance:100,mitigation:0}],total:dealt.damage,bossSignature:true,bossMechanic:true});afterMechanicDamage(core,b,u,dealt,{hpBefore:before,shieldBreak:shieldBefore>0&&shieldAfter<=0,ability:'Đại Nạn',area:true});if(u.defeated)core.pushEvent('kill',{sourceId:b.id,targetId:u.id,ability:'Đại Nạn',crit:false,bossMechanic:true});}
 emitOutcome(core,b,{...p,targetId:null},'resolved',`Đại Nạn gây ${Math.round(ratio*100)}% Max HP lên toàn đội.`,{targetIds:ids,totalDamage:total,ratio});core.queueReplacements();core.checkEnd();
}
function resolveStory(core,b,p){
 const target=core.allRosterUnits.find(u=>u.id===p.targetId);if(!target||target.defeated||!statusExists(target,p.mark)){if(target)removeStatus(target,p.mark);emitOutcome(core,b,p,'cleansed','Dấu Trấn Áp đã được thanh tẩy.',{cleansed:true});return;}
 removeStatus(target,p.mark);const loss=phase(b)>=2?18:14;target.customStatuses=target.customStatuses||{};target.customStatuses.Slow={turns:2,kind:'debuff',sourceId:b.id};target.meter=Math.max(0,(Number(target.meter)||0)-loss);core.pushEvent('status-apply',{sourceId:b.id,targetId:target.id,status:'Slow',turns:2,kind:'debuff'});core.pushEvent('turn-meter',{sourceId:b.id,targetId:target.id,delta:-loss,reason:'BOSS_SUPPRESSION'});emitOutcome(core,b,p,'resolved',`${target.name} bị Chậm và mất ${loss}% Thanh lượt.`,{meterLoss:loss});
}
function resolvePending(core,b,p){
 if(!p)return;clearPending(b);const type=core.bossType||b.bossType||p.bossType||'daily';if(type==='weekly')resolveWeekly(core,b,p);else if(type==='promotion')resolvePromotion(core,b,p);else if(type==='story')resolveStory(core,b,p);else resolveDaily(core,b,p);
 b.bossSigRemaining=Math.max(1,Number(core.bossSignatureProfile?.(b)?.cadence)||3);
}
P.processBossSignature=function(b){
 if(this.mode!=='boss'||!b||b.defeated||this.state.finished)return;
 const active=pendingOf(b);if(active){resolvePending(this,b,active);return;}
 const sig=this.bossSignatureProfile(b),cadence=Math.max(2,Number(sig.cadence)||3);b.bossSigName=sig.name;b.bossSigCounter=(Number(b.bossSigCounter)||0)+1;
 const remaining=Math.max(0,cadence-b.bossSigCounter);b.bossSigRemaining=remaining;
 if(b.bossSigCounter>=cadence-1){armMechanic(this,b,sig);return;}
 this.pushEvent('boss-signature-charge',{bossId:b.id,bossType:this.bossType,signatureId:sig.id,name:sig.name,remaining,cadence,description:sig.description});
};
P.executeAction=function(att,key,req,knowledge){
 const res=oldExec.call(this,att,key,req,knowledge);if(this.mode!=='boss'||att?.side!=='player'||this.state.finished)return res;
 const b=bossByCore(this),p=pendingOf(b);if(!b||!p)return res;
 if(p.response==='shield-break'&&barrierInterrupted(b,p)){this.pushEvent('boss-mechanic-progress',{bossId:b.id,bossType:this.bossType,mechanicId:p.id,name:p.name,response:p.response,progress:1,detail:'Khiên phản ứng đã bị phá. Boss mechanic sẽ bị ngắt.'});}
 else if(p.response==='shield-break'){const base=Math.max(0,Number(p.barrierBaseline)||0),amount=Math.max(1,Number(p.barrierAmount)||1),left=Math.max(0,(Number(b.shield)||0)-base),progress=clamp(1-left/amount,0,1);this.pushEvent('boss-mechanic-progress',{bossId:b.id,bossType:this.bossType,mechanicId:p.id,name:p.name,response:p.response,progress,remainingShield:Math.max(0,Math.round(left)),detail:`Tiến độ phá Khiên: ${Math.round(progress*100)}%.`});}
 else if(p.response==='cleanse'&&p.targetId){const t=this.allRosterUnits.find(u=>u.id===p.targetId);if(t&&!statusExists(t,p.mark))this.pushEvent('boss-mechanic-progress',{bossId:b.id,bossType:this.bossType,mechanicId:p.id,name:p.name,response:p.response,progress:1,targetId:t.id,detail:'Dấu ấn đã được thanh tẩy. Boss mechanic sẽ bị hủy.'});}
 return res;
};
P.checkEnd=function(){const ended=oldCheckEnd.call(this);if(this.state?.finished){const b=this.state.enemies?.find?.(u=>u?.boss);if(b){const p=pendingOf(b);cleanupPending(this,b,p);clearPending(b);}}return ended;};
P.checkBossPhase=function(){
 const b=bossByCore(this),before=Number(b?.bossPhase)||1;oldPhase.call(this);if(!b||b.defeated)return;const after=Number(b.bossPhase)||1;if(after<=before)return;
 const max=Math.max(1,Number(b.bossMaxPhase)||1),final=after>=max;if(final){b.bossEnraged=true;b.v9=b.v9||{};b.v9.battleFlags=b.v9.battleFlags||{};b.v9.battleFlags.bossEnrage1861={phase:after,turn:Math.max(0,Number(this.state.turnCount)||0)};b.rage=100;b.meter=Math.min(90,(Number(b.meter)||0)+8);this.pushEvent('boss-enrage',{bossId:b.id,bossType:this.bossType,phase:after,maxPhase:max,enraged:true,detail:'Pha cuối: cadence mechanic rút ngắn, Boss bắt đầu dồn áp lực kết thúc trận.'});}
 const p=pendingOf(b);if(p){cleanupPending(this,b,p);clearPending(b);this.pushEvent('boss-mechanic-outcome',{bossId:b.id,bossType:this.bossType,mechanicId:p.id,name:p.name,phase:after,outcome:'phase-cancel',detail:'Mechanic cũ bị hủy khi Boss chuyển pha.'});}
};
function validate(){const issues=[];for(const t of ['daily','weekly','promotion','story']){const cfg=ENC.encounter(t);if(!cfg?.signature?.id)issues.push(`${t}:signature`);if(!Array.isArray(cfg?.thresholds))issues.push(`${t}:thresholds`);}return{ok:!issues.length,issues,mechanics:4,responses:['cleanse','shield-break'],recoveryState:'v9.battleFlags.bossMechanic1861'};}
const API={version:'18.6.1-boss-combat-2',pendingFor:pendingOf,validate,responseLabel};window.POWDER_BOSS_COMBAT_V1861=API;RT.register('boss-combat-2',API);
})();
