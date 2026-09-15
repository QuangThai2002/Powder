(()=>{
  'use strict';
  const STAR_CAPS=Object.freeze([10,20,30,40,50,60,80,100]);
  const CANDY_EXP=60,CANDY_EXP_BY_TYPE=Object.freeze({common:60,rare:300,legendary:1200});
  const DIFFICULTY_BASE=Object.freeze({easy:160,standard:220,hard:320,deep:460});
  function levelCapForStars(stars){const s=Math.max(0,Math.min(7,Math.floor(Number(stars)||0)));return STAR_CAPS[s]||10}
  function xpToNextLevel(level){
    const l=Math.max(1,Math.min(99,Math.floor(Number(level)||1)));
    if(l<=4)return [0,50,70,90,110][l];
    if(l<=19)return 140+(l-5)*20;
    if(l<=39)return 500+(l-20)*35;
    if(l<=59)return 1200+(l-40)*60;
    if(l<=79)return 2500+(l-60)*100;
    return 5000+(l-80)*180;
  }
  function xpFromLevelToLevel(fromLevel,toLevel){let sum=0;const a=Math.max(1,Math.floor(Number(fromLevel)||1)),b=Math.max(a,Math.min(100,Math.floor(Number(toLevel)||a)));for(let l=a;l<b;l++)sum+=xpToNextLevel(l);return sum}
  function xpFromOneToLevel(level){return xpFromLevelToLevel(1,level)}
  function gradeMultiplier(score){const s=Number(score)||0;return s>=90?1.25:s>=80?1.1:s>=70?1:0}
  function lessonModeMultiplier(mode){return mode==='first'?1:mode==='srs'?0.45:0.10}
  function lessonExp({lesson,score=0,mode='replay'}={}){
    if(Number(score)<70)return 0;
    const meta=lesson?.learningMeta||{},difficulty=String(meta.Difficulty||'standard').toLowerCase(),rank=Math.max(0,Math.min(6,Number(meta.Rank)||0));
    const base=DIFFICULTY_BASE[difficulty]||DIFFICULTY_BASE.standard;
    return Math.max(0,Math.round(base*(1+rank*.22)*gradeMultiplier(score)*lessonModeMultiplier(mode)));
  }
  function combatExp(rank=0){const r=Math.max(0,Math.min(6,Math.floor(Number(rank)||0)));return{primary:12+r*2,team:4+r}}
  function normalizePowProgress(pow,owned){if(!pow||!owned)return owned;const cap=levelCapForStars(owned.stars);owned.level=Math.max(1,Math.min(cap,Math.floor(Number(owned.level)||1)));owned.powExp=Math.max(0,Math.floor(Number(owned.powExp)||0));if(owned.level>=cap)owned.powExp=0;else owned.powExp=Math.min(owned.powExp,xpToNextLevel(owned.level)-1);return owned}
  function addPowExperience(pow,owned,amount){if(!pow||!owned)return{gained:0,levels:0,level:0,cap:0};normalizePowProgress(pow,owned);let remaining=Math.max(0,Math.floor(Number(amount)||0)),gained=0,levels=0,cap=levelCapForStars(owned.stars);while(remaining>0&&owned.level<cap){const need=xpToNextLevel(owned.level),take=Math.min(remaining,need-owned.powExp);owned.powExp+=take;remaining-=take;gained+=take;if(owned.powExp>=need){owned.level++;owned.powExp=0;levels++}}if(owned.level>=cap)owned.powExp=0;return{gained,levels,level:owned.level,cap,overflow:remaining}}
  function stageForLevel(level){const l=Math.max(1,Math.floor(Number(level)||1));if(l<=5)return{key:'quick',name:'Khởi động',range:'Lv.1–5'};if(l<=20)return{key:'foundation',name:'Nền tảng',range:'Lv.6–20'};if(l<=40)return{key:'training',name:'Rèn luyện',range:'Lv.21–40'};if(l<=60)return{key:'advanced',name:'Nâng cao',range:'Lv.41–60'};if(l<=80)return{key:'master',name:'Tinh thông',range:'Lv.61–80'};return{key:'apex',name:'Đỉnh cao',range:'Lv.81–100'}}
  const bands=Object.freeze([
    {range:'Lv.1–5',xp:xpFromLevelToLevel(1,5),note:'Lên nhanh để thử Pow mới.'},
    {range:'Lv.6–20',xp:xpFromLevelToLevel(5,20),note:'Bắt đầu cần học đều và Combat kiến thức.'},
    {range:'Lv.21–40',xp:xpFromLevelToLevel(20,40),note:'Learning First Clear trở thành nguồn EXP chính.'},
    {range:'Lv.41–60',xp:xpFromLevelToLevel(40,60),note:'Mastery, SRS và phó bản cần được duy trì.'},
    {range:'Lv.61–80',xp:xpFromLevelToLevel(60,80),note:'PowCandy chỉ còn là nguồn bổ trợ.'},
    {range:'Lv.81–100',xp:xpFromLevelToLevel(80,100),note:'Cấp cao phản ánh thời gian học thực sự.'}
  ]);
  window.POWDER_GROWTH_V143={version:'17.7.2',STAR_CAPS,CANDY_EXP,CANDY_EXP_BY_TYPE,DIFFICULTY_BASE,levelCapForStars,xpToNextLevel,xpFromLevelToLevel,xpFromOneToLevel,gradeMultiplier,lessonModeMultiplier,lessonExp,combatExp,normalizePowProgress,addPowExperience,stageForLevel,bands};
})();
