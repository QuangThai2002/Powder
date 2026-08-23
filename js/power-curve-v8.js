(()=>{'use strict';
const D=window.POWDER_DATA,M=window.POWDER_MASTER_DATA_V9,W=window.POWDER_WORLD_DATA_V9;
if(!D||!W)return;
const RANK={common:0,rare:1,super_rare:2,epic:3,legendary:4,mythic:5,ancient:6};
const MAX_STARS={common:1,rare:2,super_rare:3,epic:4,legendary:5,mythic:6,ancient:7};
const CFG=Object.freeze({
  version:'8.0.0',rarityMainBase:1.42,levelMainBase:1.018,powStarBase:1.18,
  gearRarityBase:1.65,gearStarBase:1.16,
  artifactRarityBase:1.18,artifactStarBase:1.10,enemyGradeBase:1.35,
  speedRarityBase:1.20,speedLevelBase:1.004,speedStarBase:1.04,gearSpeedRarityBase:1.35,
  maxStars:MAX_STARS
});
window.POWDER_POWER_CURVE_V8=CFG;

// 1) Rebuild Pow Lv.1 base stats with a real rarity gap while preserving each Pow's individual profile inside its rarity.
const statKeys=['hp','atk','def','speed','ap'];
const byR={};for(const p of D.pows||[])(byR[p.rarity]||(byR[p.rarity]=[])).push(p);
const avg={};for(const [r,list] of Object.entries(byR)){avg[r]={};for(const k of statKeys)avg[r][k]=list.reduce((n,p)=>n+Number(p.stats?.[k]||0),0)/Math.max(1,list.length)}
const common=avg.common||{hp:300,atk:50,def:45,speed:55,ap:45};
for(const p of D.pows||[]){
  const r=RANK[p.rarity]||0, old={...(p.stats||{})}, target={};
  for(const k of ['hp','atk','def','ap']){
    const personal=Number(old[k]||1)/Math.max(1,Number(avg[p.rarity]?.[k]||old[k]||1));
    target[k]=Math.max(1,Math.round(Number(common[k]||1)*Math.pow(CFG.rarityMainBase,r)*personal));
  }
  const sp=Number(old.speed||1)/Math.max(1,Number(avg[p.rarity]?.speed||old.speed||1));
  target.speed=Math.max(1,Math.round(Number(common.speed||1)*Math.pow(CFG.speedRarityBase,r)*sp));
  target.critRate=Math.min(55,Math.max(0,Number(old.critRate||10)+r*2));
  target.critDamage=Math.max(100,Math.round(Number(old.critDamage||200)+r*10));
  p.v7BaseStats=old;p.stats=target;p.powerCurve='V8-EXP';
}

// 2) Gear 0★ main stats. Duplicate copies later refine the item through world-systems.
const SLOT_BASE={weapon:12,armor:18,pants:95,shoes:2};
for(const it of W.equipment||[]){
  const r=RANK[it.rarity]||0,slot=it.slot,base=Number(SLOT_BASE[slot]||1),curve=slot==='shoes'?CFG.gearSpeedRarityBase:CFG.gearRarityBase;
  const v=Math.max(1,Math.round(base*Math.pow(curve,r)));
  if(it.mainStat){it.mainStat.v7Value=Number(it.mainStat.value||0);it.mainStat.value=v;it.mainStat.v8BaseValue=v;}
  it.v8MaxStars=MAX_STARS[it.rarity]||1;
}

// 3) Stronger set identities. Mechanics remain the same; values become large enough to change builds.
const SET={
'Tân Binh':['+8% sát thương gây ra','Đòn cơ bản đầu tiên mỗi vòng +12% sát thương'],
'Tinh Nhuệ':['+12% sát thương Skill 1','Sau 2 Basic, Skill 1 kế tiếp +20% sát thương'],
'Cuồng Công':['+18% sát thương trực tiếp','Đánh cùng mục tiêu 2 hành động chính → hành động damage kế tiếp +30%; đổi mục tiêu reset'],
'Bền Bỉ':['+20% hiệu lực Khiên','Nhận/chuyển hướng đòn ≥15% Max HP → sát thương nhận kế tiếp -25%; tối đa 1 lần/vòng'],
'Truy Kích':['+25% sát thương lên mục tiêu <50% HP','Hạ mục tiêu → kỹ năng damage kế tiếp +40%; không extra turn'],
'Điều Nhịp':['Kỹ năng tiêu Mana +22% hiệu lực','Tiêu tổng 60 Mana → kỹ năng kế tiếp hoàn 18 Mana và +15% hiệu lực; tối đa 1 lần/vòng'],
'Phá Giáp':['+35% sát thương lên Khiên','Phá hoàn toàn Khiên → mục tiêu nhận +30% sát thương từ chính Pow trong 1 lượt'],
'Bách Chiến':['Từ vòng 3 +30% sát thương','Cứ thêm 2 vòng sau vòng 3 → +12% sát thương, tối đa +48% từ 4/4'],
'Nguyên Tố Cộng Hưởng':['+40% sát thương khi đánh khắc hệ','Sau 3 lần damage khắc hệ → hiệu ứng nguyên tố kế tiếp +60% hiệu lực; không tăng hard-CC duration'],
'Tuyệt Kỹ':['Ultimate +45% damage/heal/shield','Sau Ultimate → Skill 1 kế tiếp +65% hiệu lực; không hồi Nộ/reset CD'],
'Đột Phá':['Sau Đột Phá +50% damage hoặc support','2 hành động chính đầu tiên sau Đột Phá: Skill 1/2 +75% hiệu lực'],
'Thiên Hộ':['+65% Khiên và hồi máu','Lần đầu <35% HP: nhận Khiên = 30% Max HP; không bất tử/revive'],
'Cổ Thần Điều Hòa':['+60% hiệu lực Skill 2','Sau Ultimate/Exclusive, 2 đồng minh %HP thấp nhất nhận 35% giảm sát thương 1 lượt']};
for(const set of W.equipmentSets||[]){const x=SET[set.name];if(x){set.bonus2=x[0];set.bonus4=x[1]}set.v8MaxStars=MAX_STARS[set.rarity]||1}

// 4) Artifact 0★ functional values also grow by rarity. Stars are applied from duplicate mastery at runtime.
for(const a of W.artifacts||[]){
  const r=RANK[a.rarity]||0,old=Number(a.effect?.value||0);
  if(a.effect){a.effect.v7Value=old;a.effect.value=old*Math.pow(CFG.artifactRarityBase,r);a.effect.v8BaseValue=a.effect.value;}
  a.v8MaxStars=MAX_STARS[a.rarity]||1;
  if(a.statBonusPct){a.v8BaseStatBonusPct={...a.statBonusPct};}
}

W.version='10.6.0';W.notes=W.notes||{};W.notes.powerCurveV8='Pow stat curve + gear/artifact refinement. Skill scaling is owned exclusively by Fixed Skill V8.1.';
if(M){M.powerCurveVersion='8.0.0';M.version='10.6.0'}
})();
