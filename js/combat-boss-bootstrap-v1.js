(()=>{
  'use strict';
  const VERSION='boss-bootstrap-v1';
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):min));
  const clone=value=>{try{return value==null?null:JSON.parse(JSON.stringify(value));}catch{return null;}};
  const catalog=()=>Array.isArray(window.POWDER_DATA?.pows)?window.POWDER_DATA.pows:[];
  const findPow=id=>catalog().find(pow=>String(pow?.id||'').toLowerCase()===String(id||'').toLowerCase())||null;
  const own=(pow,save)=>{
    const raw=save?.owned?.[pow?.id]||{};
    return{level:Math.max(1,Number(raw.level)||1),stars:Math.max(0,Number(raw.stars)||0),shiny:Boolean(raw.shiny),
      ...(raw.statAdd?{statAdd:clone(raw.statAdd)}:{}),...(raw.statPct?{statPct:clone(raw.statPct)}:{}),
      ...(raw.statPercent?{statPercent:clone(raw.statPercent)}:{}),...(Array.isArray(raw.equipmentIds)?{equipmentIds:raw.equipmentIds.slice(0,4)}:{}),
      ...(Array.isArray(raw.artifactIds)?{artifactIds:raw.artifactIds.slice(0,8)}:{})};
  };
  const legacyRageToCanonical=oldRage=>clamp(Math.floor(Math.max(0,Number(oldRage)||0)/25),0,4);
  function stats(pow,owned,scale=1){
    const engine=window.POWDER_ENGINE;
    const combatant=typeof engine?.createCombatant==='function'?engine.createCombatant(pow,owned,{scale}):null;
    const raw=combatant?.stats||pow?.stats||{};
    const out={};
    for(const [key,value] of Object.entries(raw)){if(Number.isFinite(Number(value)))out[key]=Number(value);}
    if(!Number.isFinite(out.hp))out.hp=Math.max(1,Number(pow?.stats?.hp)||1);
    out.maxHp=out.hp;
    return out;
  }
  function row(pow,owned,extra={}){
    const scale=Math.max(.1,Number(extra.scale)||1);
    return{powId:String(pow.id),level:owned.level,stars:owned.stars,shiny:Boolean(owned.shiny),owned:clone(owned),scale,
      stats:stats(pow,owned,scale),...extra};
  }
  function playerRows(ids,save){return ids.map(id=>{const pow=findPow(id);return pow?row(pow,own(pow,save),{boss:false,aiTier:'standard',initialRage:0,initialInitiative:0}):null;}).filter(Boolean);}
  function adaptiveEnemyRows(players,stage){
    const avgL=Math.max(1,Math.round(players.reduce((sum,item)=>sum+Number(item.owned.level||1),0)/Math.max(1,players.length)));
    const avgS=Math.max(0,Math.round(players.reduce((sum,item)=>sum+Number(item.owned.stars||0),0)/Math.max(1,players.length)));
    const adaptive=Math.max(Number(stage?.recommendedLevel)||1,Math.round(avgL*(Number(stage?.adaptive)||1)));
    const targetLevel=Math.max(1,Math.min(100,adaptive));
    const adaptiveStars=avgS+(stage?.kind==='boss'?1:stage?.kind==='elite'?1:0);
    const targetStars=Math.max(Number(stage?.recommendedStars)||0,Math.min(7,adaptiveStars));
    const ids=(stage?.enemyIds||[]).slice(0,Math.max(1,Number(stage?.enemyCount)||1));
    const gradeBase=Number(window.POWDER_POWER_CURVE_V8?.enemyGradeBase)||1.35;
    return ids.map((id,index)=>{
      const pow=findPow(id)||catalog()[(Number(stage?.storyIndex)||0+index)%Math.max(1,catalog().length)];
      if(!pow)return null;
      const boss=stage?.kind==='boss'&&index===0;
      const combatGrade=clamp((Math.max(1,Number(stage?.islandId)||1)-1)+(boss?1:0),0,10);
      const gradeScale=Math.pow(gradeBase,combatGrade);
      const scale=(Number(stage?.scale)||1)*gradeScale*(boss?1:1+(index*.025));
      const owned={level:targetLevel,stars:Math.min(Number(pow.maxStars||0),targetStars),shiny:false};
      return row(pow,owned,{boss,bossType:boss?'story':null,aiTier:boss?'boss':stage?.kind==='elite'?'elite':'standard',combatGrade,gradeScale,initialRage:legacyRageToCanonical(Math.max(20,Math.min(80,Number(stage?.rageStart)||20))),initialInitiative:Math.max(0,Math.min(92,(Number(stage?.initiative)||0)-Math.min(4,index*2)))});
    }).filter(Boolean);
  }
  function fixedBossRows(players,stage){
    const candidates={daily:['terrakor','thunderhorn','volcarnos','bloomlord'],promotion:['tempestrix','noxabyss','luxarion','calderion'],weekly:['noxabyss','tempestrix','luxarion','magmorax']};
    const type=String(stage?.bossChallengeId||'daily').toLowerCase();
    const pow=(stage?.enemyIds||[]).map(findPow).find(Boolean)||((candidates[type]||[]).map(findPow).find(Boolean));
    if(!pow)return[];
    const avgL=Math.round(players.reduce((sum,item)=>sum+Number(item.owned.level||1),0)/Math.max(1,players.length));
    const scale=type==='weekly'?3.4:type==='promotion'?2.65:2.15;
    const owned={level:Math.max(avgL,50),stars:Number(pow.maxStars||0),shiny:false};
    return[row(pow,owned,{boss:true,bossType:type,aiTier:'boss',scale,gradeScale:1,combatGrade:0,initialRage:legacyRageToCanonical(Math.max(20,Math.min(80,Number(stage?.rageStart)||20))),initialInitiative:Math.max(0,Math.min(92,Number(stage?.initiative)||0))})];
  }
  function build(stage,{playerIds=[],enemyIds=[],save={}}={}){
    const players=playerRows(playerIds,save);
    const hasAdaptiveFields=['recommendedLevel','recommendedStars','adaptive','islandId'].some(key=>stage?.[key]!=null);
    const enemies=hasAdaptiveFields&&enemyIds.length?adaptiveEnemyRows(players,{...stage,enemyIds}):fixedBossRows(players,{...stage,enemyIds});
    if(!players.length||!enemies.length)return null;
    const initialRageByPowId={},initialInitiativeByPowId={};
    for(const item of players) { initialRageByPowId[item.powId]=0; initialInitiativeByPowId[item.powId]=0; }
    for(const item of enemies) { initialRageByPowId[item.powId]=clamp(item.initialRage,0,8); initialInitiativeByPowId[item.powId]=clamp(item.initialInitiative,0,92); }
    const avgLevel=Math.max(1,Math.round(players.reduce((sum,item)=>sum+Number(item.level||1),0)/players.length));
    const avgStars=Math.max(0,Math.round(players.reduce((sum,item)=>sum+Number(item.stars||0),0)/players.length));
    const adaptive=Math.max(Number(stage?.recommendedLevel)||1,Math.round(avgLevel*(Number(stage?.adaptive)||1)));
    return{version:VERSION,source:'legacy-boss-boundary',recommendedLevel:Number(stage?.recommendedLevel)||null,adaptive:Number(stage?.adaptive)||1,recommendedStars:Number(stage?.recommendedStars)||0,targetLevel:Math.max(1,Math.min(100,adaptive)),targetStars:Math.max(Number(stage?.recommendedStars)||0,Math.min(7,avgStars+(stage?.kind==='boss'?1:0))),stageScale:Number(stage?.scale)||1,gradeBase:Number(window.POWDER_POWER_CURVE_V8?.enemyGradeBase)||1.35,initiative:Number(stage?.initiative)||0,legacyManaStart:clamp(Number(stage?.manaStart)||.74,.5,1),legacyRageStart:clamp(Number(stage?.rageStart)||20,20,80),playerRoster:players,enemyRoster:enemies,initialRageByPowId,initialInitiativeByPowId};
  }
  window.POWDER_COMBAT2_BOSS_BOOTSTRAP=Object.freeze({version:VERSION,legacyRageToCanonical,build});
})();
