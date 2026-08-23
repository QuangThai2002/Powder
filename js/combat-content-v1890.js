(()=>{'use strict';
const VERSION='18.9.0-combat-content-expansion';
const A=()=>window.POWDER_ADVENTURE_DATA;
const E=()=>window.POWDER_ENGINE;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const hash=s=>{let h=2166136261;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const ELITE_AFFIXES=Object.freeze([
 {id:'bulwark',icon:'🛡️',name:'Pháo Đài',desc:'+20% HP · +12% DEF · bắt đầu với Giáp 15% Max HP.'},
 {id:'ravager',icon:'⚔️',name:'Cuồng Chiến',desc:'+14% ATK/AP · +8% Speed · -6% DEF. Áp lực cao nhưng dễ bị phản công.'},
 {id:'hexer',icon:'🜏',name:'Kẻ Nguyền',desc:'+12% AP; mỗi 3 vòng gây Slow lên Pow nhanh nhất của bạn.'},
 {id:'regenerator',icon:'♻️',name:'Tái Sinh',desc:'Mỗi 2 vòng hồi 5% Max HP nếu còn sống.'},
 {id:'breaker',icon:'💥',name:'Phá Giáp',desc:'+10% ATK/AP; mỗi 3 vòng phá 25% Giáp hiện tại của đội bạn.'}
]);
const DUNGEON_MODIFIERS=Object.freeze([
 {id:'mana_drought',icon:'◇',name:'Khô Cạn Ma Lực',desc:'Đội bạn bắt đầu -18 Mana; địch bắt đầu +8 Mana.'},
 {id:'volatile_ground',icon:'♨️',name:'Địa Mạch Bất Ổn',desc:'Cuối mỗi vòng, tất cả Pow trên sân chịu 2% Max HP.'},
 {id:'fractured_guard',icon:'◫',name:'Giáp Nứt',desc:'DEF hai phe -8%; trận ngắn hơn và yêu cầu chọn mục tiêu chính xác.'},
 {id:'tempo_rift',icon:'⏱️',name:'Khe Nhịp',desc:'Địch +10 Thanh lượt mở trận; đội bạn +6 Nộ để có cơ hội phản nhịp.'}
]);
const WEATHER=Object.freeze({
 emberfront:{id:'emberfront',icon:'🔥',name:'Hỏa Tuyến',desc:'Lửa/Dung nham +8% ATK/AP; Nước/Băng +4% DEF.',elements:['fire','lava']},
 stormfront:{id:'stormfront',icon:'⚡',name:'Bão Cộng Hưởng',desc:'Sét/Bão/Gió +8% Speed và +8 Thanh lượt mở trận.',elements:['lightning','storm','wind']},
 whiteout:{id:'whiteout',icon:'❄️',name:'Bạch Phong',desc:'Băng +8% DEF; Pow không thuộc Băng -5% Speed.',elements:['ice']},
 toxic_mire:{id:'toxic_mire',icon:'☣️',name:'Độc Vụ',desc:'Độc/Lá +8% HP; Pow khác mất 1% Max HP mỗi 2 vòng.',elements:['poison','leaf']},
 eclipse:{id:'eclipse',icon:'◐',name:'Nhật Thực',desc:'Ánh sáng/Bóng tối +8% ATK/AP; các hệ khác không nhận bonus.',elements:['light','dark']}
});
const BOSS_MODIFIERS=Object.freeze([
 {id:'colossus',icon:'🗿',name:'Thể Chất Cự Thần',desc:'+24% Max HP · +10% DEF · -6% Speed.'},
 {id:'executioner',icon:'🩸',name:'Áp Lực Hành Quyết',desc:'+13% ATK/AP; mỗi 3 vòng tăng thêm 3% sức tấn công, tối đa 15%.'},
 {id:'arcane_fortress',icon:'🔷',name:'Thành Trì Ma Giáp',desc:'Bắt đầu với Giáp 22% Max HP và +8% DEF.'},
 {id:'cataclysm',icon:'☄️',name:'Chu Kỳ Đại Nạn',desc:'Mỗi 4 vòng gây 3% Max HP lên toàn đội người chơi.'}
]);
const WEATHER_BY_ISLAND=Object.freeze({2:'emberfront',6:'stormfront',7:'stormfront',8:'whiteout',9:'toxic_mire',11:'eclipse',12:'eclipse'});
const CHALLENGES=Object.freeze([
 {id:'challenge-glass-edge',name:'Lưỡi Dao Thủy Tinh',icon:'◆',rule:'Thắng trước vòng 8',desc:'Đội bạn -25% Max HP nhưng +12% ATK/AP. Nếu sang vòng 9 sẽ thất bại.',enemyIds:['umbrael','voltfang','nightclaw'],modifier:'fractured_guard',ruleId:'round_cap',roundCap:8},
 {id:'challenge-no-shelter',name:'Không Chốn Ẩn',icon:'⬡',rule:'Giáp bị triệt tiêu mỗi vòng',desc:'Mọi Giáp của đội bạn bị xóa khi sang vòng mới. Đòi hỏi hồi máu, CC và focus target.',enemyIds:['terrakor','glacior','ironmane'],modifier:'tempo_rift',ruleId:'no_player_shield'},
 {id:'challenge-attrition',name:'Chiến Tuyến Tiêu Hao',icon:'♻️',rule:'Địch hồi phục theo chu kỳ',desc:'Phe địch hồi 4% Max HP mỗi 2 vòng. Cần burst đúng thời điểm thay vì kéo dài.',enemyIds:['verdantis','luxarion','tidecrest'],modifier:'mana_drought',ruleId:'enemy_regen'}
]);
const GAUNTLETS=Object.freeze([
 {id:'gauntlet-scout',name:'Gauntlet · Trinh Sát',icon:'Ⅰ',desc:'5 Pow liên tiếp · 3 active + 2 reserve.',enemyIds:['ashmane','torrento','ferrolyn','skydart','toxiclaw'],scale:1.15,modifier:'tempo_rift'},
 {id:'gauntlet-veteran',name:'Gauntlet · Cựu Binh',icon:'Ⅱ',desc:'5 Pow có role khác nhau, pressure cao hơn.',enemyIds:['blazetalon','tidewarden','ironmantis','stormcoil','vilexis'],scale:1.35,modifier:'volatile_ground'},
 {id:'gauntlet-apex',name:'Gauntlet · Đỉnh Cao',icon:'Ⅲ',desc:'5 Pow cấp cao; reserve thay vào ngay khi active bị hạ.',enemyIds:['calderion','glacior','thunderos','umbrael','venomarch'],scale:1.58,modifier:'fractured_guard'}
]);
function pick(arr,key){return arr[hash(key)%arr.length]}
function stageContent(stage){if(!stage)return null;const c={version:VERSION,eliteAffix:null,dungeonModifier:null,weather:null,bossModifier:null};
 if(stage.kind==='elite'&&!stage.contentMode)c.eliteAffix=pick(ELITE_AFFIXES,stage.id);
 if(stage.kind==='boss'&&!stage.contentMode)c.bossModifier=pick(BOSS_MODIFIERS,`boss:${stage.id}`);
 const weatherId=WEATHER_BY_ISLAND[Number(stage.islandId)];if(weatherId&&!stage.contentMode&&(stage.kind==='elite'||stage.kind==='boss'))c.weather=WEATHER[weatherId];
 if(stage.kind==='normal'&&Number(stage.number)>1&&[4,8,12,16,19].includes(Number(stage.number)))c.dungeonModifier=pick(DUNGEON_MODIFIERS,`d:${stage.id}`);
 if(stage.contentModifier)c.dungeonModifier=DUNGEON_MODIFIERS.find(x=>x.id===stage.contentModifier)||c.dungeonModifier;
 return c;
}
function augmentAdventure(){const data=A();if(!data?.islands)return;for(const island of data.islands)for(const stage of island.stages||[]){stage.combatContent=stageContent(stage);stage.contentVersion='18.9.0';}}
function addShield(u,amount){const n=Math.max(0,Math.round(amount));u.shield=Math.max(0,Number(u.shield)||0)+n;return n}
function stat(u,key,m){if(!u?.stats||!Number.isFinite(Number(u.stats[key])))return;u.stats[key]=Math.max(1,Math.round(Number(u.stats[key])*m))}
function maxHp(u,m){const before=Math.max(1,Number(u.maxHp)||1),ratio=clamp((Number(u.hp)||before)/before,0,1);u.maxHp=Math.max(1,Math.round(before*m));u.hp=Math.max(1,Math.round(u.maxHp*ratio));}
function active(core,side){return core?.living?.(side)||[]}
function damagePct(core,u,pct,label){if(!u||u.defeated)return 0;const before=u.hp,amount=Math.max(1,Math.round(u.maxHp*pct)),dealt=E()?.damageTarget?.(u,amount)||{damage:Math.min(u.hp,amount),absorbed:0};if(!E()?.damageTarget)u.hp=Math.max(0,u.hp-amount);core.pushEvent?.('content-damage',{sourceId:null,targetId:u.id,amount:Number(dealt.damage)||amount,label,modifier:true});return Math.max(0,before-u.hp)}
function healPct(core,u,pct,label){if(!u||u.defeated)return 0;const before=u.hp;u.hp=Math.min(u.maxHp,u.hp+Math.max(1,Math.round(u.maxHp*pct)));const amount=u.hp-before;if(amount)core.pushEvent?.('content-heal',{sourceId:u.id,targetId:u.id,amount,label,modifier:true});return amount}
function applyWeather(core,w){if(!w)return;for(const u of core.allRosterUnits){if(w.id==='emberfront'){if(['fire','lava'].includes(u.element)){stat(u,'atk',1.08);stat(u,'ap',1.08)}if(['water','ice'].includes(u.element))stat(u,'def',1.04)}
 else if(w.id==='stormfront'&&['lightning','storm','wind'].includes(u.element)){stat(u,'speed',1.08);u.meter=Math.min(95,(Number(u.meter)||0)+8)}
 else if(w.id==='whiteout'){if(u.element==='ice')stat(u,'def',1.08);else stat(u,'speed',.95)}
 else if(w.id==='toxic_mire'&&['poison','leaf'].includes(u.element))maxHp(u,1.08);
 else if(w.id==='eclipse'&&['light','dark'].includes(u.element)){stat(u,'atk',1.08);stat(u,'ap',1.08)}}}
function applyDungeon(core,m){if(!m)return;if(m.id==='mana_drought'){for(const u of core.allRosterUnits){u.mana=clamp((Number(u.mana)||0)+(u.side==='player'?-18:8),0,u.maxMana||100)}}
 if(m.id==='fractured_guard')for(const u of core.allRosterUnits)stat(u,'def',.92);
 if(m.id==='tempo_rift'){for(const u of active(core,'enemy'))u.meter=Math.min(95,(Number(u.meter)||0)+10);for(const u of active(core,'player'))u.rage=Math.min(100,(Number(u.rage)||0)+6)}}
function applyElite(core,affix){if(!affix)return;for(const u of active(core,'enemy')){u.eliteAffix=affix.id;if(affix.id==='bulwark'){maxHp(u,1.20);stat(u,'def',1.12);addShield(u,u.maxHp*.15)}else if(affix.id==='ravager'){stat(u,'atk',1.14);stat(u,'ap',1.14);stat(u,'speed',1.08);stat(u,'def',.94)}else if(affix.id==='hexer'){stat(u,'ap',1.12)}else if(affix.id==='breaker'){stat(u,'atk',1.10);stat(u,'ap',1.10)}}}
function applyBoss(core,b){if(!b)return;const boss=active(core,'enemy').find(x=>x.boss)||active(core,'enemy')[0];if(!boss)return;boss.contentBossModifier=b.id;if(b.id==='colossus'){maxHp(boss,1.24);stat(boss,'def',1.10);stat(boss,'speed',.94)}else if(b.id==='executioner'){stat(boss,'atk',1.13);stat(boss,'ap',1.13)}else if(b.id==='arcane_fortress'){stat(boss,'def',1.08);addShield(boss,boss.maxHp*.22)}}
function applyChallengeInitial(core,stage){if(stage?.contentMode!=='challenge')return;if(stage.ruleId==='round_cap'){for(const u of core.allRosterUnits.filter(x=>x.side==='player')){maxHp(u,.75);stat(u,'atk',1.12);stat(u,'ap',1.12)}}}
function onRound(core,round){const ctx=core._content1890;if(!ctx||ctx.lastRound===round||core.state.finished)return;ctx.lastRound=round;const {content,stage}=ctx,m=content?.dungeonModifier,w=content?.weather,a=content?.eliteAffix,b=content?.bossModifier;
 if(m?.id==='volatile_ground')for(const u of [...active(core,'player'),...active(core,'enemy')])damagePct(core,u,.02,'Địa Mạch Bất Ổn');
 if(w?.id==='toxic_mire'&&round%2===0)for(const u of [...active(core,'player'),...active(core,'enemy')])if(!['poison','leaf'].includes(u.element))damagePct(core,u,.01,'Độc Vụ');
 if(a?.id==='regenerator'&&round%2===0)for(const u of active(core,'enemy'))healPct(core,u,.05,'Tái Sinh Tinh Anh');
 if(a?.id==='hexer'&&round%3===0){const t=[...active(core,'player')].sort((x,y)=>Number(y.stats?.speed||0)-Number(x.stats?.speed||0))[0];if(t){t.customStatuses=t.customStatuses||{};t.customStatuses.Slow={turns:1,kind:'debuff',sourceId:null};core.pushEvent?.('status-apply',{sourceId:null,targetId:t.id,status:'Slow',turns:1,modifier:true})}}
 if(a?.id==='breaker'&&round%3===0)for(const u of active(core,'player')){const lost=Math.round((Number(u.shield)||0)*.25);u.shield=Math.max(0,(Number(u.shield)||0)-lost);if(lost)core.pushEvent?.('content-shield-break',{targetId:u.id,amount:lost,label:'Phá Giáp Tinh Anh'})}
 const boss=active(core,'enemy').find(x=>x.boss)||active(core,'enemy')[0];if(b?.id==='executioner'&&boss&&round%3===0){const stacks=Math.min(5,Number(ctx.executionerStacks||0)+1);ctx.executionerStacks=stacks;stat(boss,'atk',1.03);stat(boss,'ap',1.03);core.pushEvent?.('content-boss-ramp',{bossId:boss.id,stacks,label:'Áp Lực Hành Quyết'})}
 if(b?.id==='cataclysm'&&round%4===0)for(const u of active(core,'player'))damagePct(core,u,.03,'Chu Kỳ Đại Nạn');
 if(stage?.ruleId==='no_player_shield')for(const u of active(core,'player')){const lost=Math.max(0,Number(u.shield)||0);u.shield=0;if(lost)core.pushEvent?.('content-shield-break',{targetId:u.id,amount:lost,label:'Không Chốn Ẩn'})}
 if(stage?.ruleId==='enemy_regen'&&round%2===0)for(const u of active(core,'enemy'))healPct(core,u,.04,'Chiến Tuyến Tiêu Hao');
 if(stage?.ruleId==='round_cap'&&round>Number(stage.roundCap||8)&&!core.state.finished){core.state.finished=true;core.state.phase='finished';core.state.result='loss';core.state.current=null;core.pushEvent?.('battle-end',{result:'loss',reason:'CHALLENGE_ROUND_CAP',roundCap:stage.roundCap,contentMode:'challenge'});core.pushLog?.(`THẤT BẠI · VƯỢT GIỚI HẠN ${stage.roundCap} VÒNG.`,'loss')}
 core.checkEnd?.();}
function attachBattle(core,stage){if(!core||!stage)return core;const server=Boolean(stage.serverCombatSessionId);const content=stage.combatContent||stageContent(stage);core._content1890={version:VERSION,stage:JSON.parse(JSON.stringify(stage)),content,lastRound:Number(core.state?.round)||1,serverAuthority:server};core.state.combatContent={version:'18.9.0',serverAuthority:server,eliteAffix:content?.eliteAffix?.id||null,dungeonModifier:content?.dungeonModifier?.id||null,weather:content?.weather?.id||null,bossModifier:content?.bossModifier?.id||null,contentMode:stage.contentMode||null};
 if(server){core.pushEvent?.('content-authority',{server:true,note:'Modifier combat do server/session quyết định; client không mutate state.'});return core}
 applyWeather(core,content?.weather);applyDungeon(core,content?.dungeonModifier);if(stage.kind==='elite')applyElite(core,content?.eliteAffix);if(stage.kind==='boss')applyBoss(core,content?.bossModifier);applyChallengeInitial(core,stage);
 core.pushEvent?.('content-start',{contentMode:stage.contentMode||stage.kind||'map',eliteAffix:content?.eliteAffix?.id||null,dungeonModifier:content?.dungeonModifier?.id||null,weather:content?.weather?.id||null,bossModifier:content?.bossModifier?.id||null,practiceNoReward:Boolean(stage.practiceNoReward)});return core;}
function virtualStage(template,mode){const ids=[...template.enemyIds];return {id:template.id,islandId:12,number:1,kind:'elite',name:template.name,enemyIds:ids,enemyCount:Math.min(5,ids.length),recommendedLevel:65,recommendedStars:4,scale:Number(template.scale)||1.28,adaptive:1.04,initiative:mode==='gauntlet'?14:10,manaStart:.84,rageStart:34,rewards:{coins:0,exp:0},difficultyLabel:mode==='gauntlet'?'GAUNTLET':'CHALLENGE',contentMode:mode,practiceNoReward:true,contentModifier:template.modifier,ruleId:template.ruleId||null,roundCap:template.roundCap||null,contentTemplateId:template.id,combatContent:null};}
function challengeStage(id){const t=CHALLENGES.find(x=>x.id===id);return t?virtualStage(t,'challenge'):null}
function gauntletStage(id){const t=GAUNTLETS.find(x=>x.id===id);return t?virtualStage(t,'gauntlet'):null}
function validate(){augmentAdventure();const stages=(A()?.islands||[]).flatMap(x=>x.stages||[]);return {ok:ELITE_AFFIXES.length>=5&&DUNGEON_MODIFIERS.length>=4&&BOSS_MODIFIERS.length>=4&&CHALLENGES.length===3&&GAUNTLETS.length===3,version:VERSION,eliteAffixes:ELITE_AFFIXES.length,dungeonModifiers:DUNGEON_MODIFIERS.length,bossModifiers:BOSS_MODIFIERS.length,weathers:Object.keys(WEATHER).length,challenges:CHALLENGES.length,gauntlets:GAUNTLETS.length,augmentedStages:stages.filter(x=>x.contentVersion==='18.9.0').length};}
augmentAdventure();
const Core=window.POWDER_COMBAT_CORE_V7?.BattleCore;if(Core&&!Core.prototype._content1890Patched){Core.prototype._content1890Patched=true;const orig=Core.prototype.finishCurrent;Core.prototype.finishCurrent=function(...args){const prev=Number(this.state?.round)||1,r=orig.apply(this,args);const now=Number(this.state?.round)||prev;if(now!==prev)onRound(this,now);return r;};}
const API=Object.freeze({version:VERSION,ELITE_AFFIXES,DUNGEON_MODIFIERS,WEATHER,BOSS_MODIFIERS,CHALLENGES,GAUNTLETS,stageContent,augmentAdventure,attachBattle,challengeStage,gauntletStage,validate});window.POWDER_COMBAT_CONTENT_V1890=API;window.POWDER_COMBAT_CONTENT=API;
})();
