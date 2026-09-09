(()=>{'use strict';
const definitions={
  missing_hp_atk:{description:'Tăng ATK theo lượng HP đã mất, tối đa +40% ATK khi mất toàn bộ HP.',trigger:'BEFORE_HIT',condition:{kind:'missingHpRatio'},effect:{kind:'statMultiplier',stat:'attack',coefficient:0.4},runtime:'LIVE'},
  missing_hp_def:{description:'Tăng DEF theo lượng HP đã mất, tối đa +40% DEF khi mất toàn bộ HP.',trigger:'BEFORE_HIT',condition:{kind:'missingHpRatio'},effect:{kind:'statMultiplier',stat:'defense',coefficient:0.4},runtime:'LIVE'},
  combo_bonus_damage:{description:'Mỗi điểm combo tăng 8% sát thương, tối đa 32%.',trigger:'BEFORE_HIT',condition:{kind:'minimumCombo',value:1},effect:{kind:'damageMultiplierPerStack',coefficient:0.08,maxBonus:0.32},runtime:'LIVE'},
  element_team_boost:{description:'Khi có ít nhất 1 đồng minh còn sống cùng nguyên tố, tăng 10% sát thương gây ra.',trigger:'BEFORE_HIT',condition:{kind:'minimumSameElementAllies',value:1},effect:{kind:'damageMultiplier',coefficient:0.1},runtime:'LIVE'},
  combo_stun:{description:'Sau hành động ở từ 3 combo, có 35% xác suất gây Choáng mục tiêu trong 1 lượt.',trigger:'AFTER_ACTION',condition:{kind:'minimumCombo',value:3},effect:{kind:'applyStatus',status:'stun',chance:0.35,duration:1},runtime:'LIVE'},
  combo_heal:{description:'Sau hành động ở từ 3 combo, hồi 8% HP tối đa cho toàn bộ đồng minh còn sống.',trigger:'AFTER_ACTION',condition:{kind:'minimumCombo',value:3},effect:{kind:'healMaxHp',targetRule:'allLivingAllies',coefficient:0.08},runtime:'LIVE'},
  combo_team_buff:{description:'Sau hành động ở từ 3 combo, buff toàn đội trong 2 lượt; loại buff luân phiên theo combo giữa ATK, DEF và AP.',trigger:'AFTER_ACTION',condition:{kind:'minimumCombo',value:3},effect:{kind:'rotatingTeamBuff',targetRule:'allLivingAllies',duration:2,sequence:['attack','defense','ability-power']},runtime:'LIVE'},
  low_hp_heal:{description:'Sau hành động, nếu HP còn tối đa 35%, hồi 20% HP tối đa. Chỉ kích hoạt 1 lần mỗi trận.',trigger:'AFTER_ACTION',condition:{kind:'hpRatioAtMost',value:0.35},effect:{kind:'healMaxHp',targetRule:'self',coefficient:0.2,perBattleLimit:1},runtime:'LIVE'},
  combo_extra_turn:{description:'Khi đủ điều kiện lượt phụ do SPEED, tăng thêm 12% xác suất; tổng xác suất vẫn tối đa 35%.',trigger:'AFTER_ACTION',condition:{kind:'speedRatioAbove',value:1.15},effect:{kind:'extraTurnChance',coefficient:0.12,maxChance:0.35},runtime:'LIVE'},
  revive_ally_once:{description:'Khi một đồng minh bị hạ, hồi sinh đồng minh đó với 30% HP tối đa. Chỉ kích hoạt 1 lần mỗi trận.',trigger:'ON_ALLY_DEATH',condition:{kind:'livingOwnerAndFallenAlly'},effect:{kind:'revive',targetRule:'firstFallenActiveAlly',coefficient:0.3,perBattleLimit:1},runtime:'LIVE'}
};
function get(id){return definitions[String(id||'').trim().toLowerCase()]||null}
window.POWDER_PASSIVE_CATALOG={version:'1.0-legacy-evidence',definitions:Object.freeze(definitions),get};
})();
