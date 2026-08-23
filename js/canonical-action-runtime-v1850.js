(()=>{'use strict';
const D=window.POWDER_DATA;if(!D?.pows)return;
const BAD_ALLY_STATUS=new Set(['Burn','Poison','Stun','Freeze','Slow','Curse','Paralysis','Bind']);
const OFFENSIVE_TARGETS=new Set(['enemy','all','all-enemies','two-enemies','front-row','back-row']);
const SUPPORT_TARGETS=new Set(['self','ally','allies','team','two-allies','three-allies','self-and-ally','self-and-lowest-ally']);
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function text(a){return clean(a?.rulesText||a?.description||a?.v81Description||'')}
function stripCost(s){return clean(String(s||'').replace(/^\s*(?:100\s*Nộ\s*,?\s*)?(?:\d+\s*Mana\s*,?\s*)?(?:CD\s*\d+\s*[.;,]?\s*)?/i,'').replace(/^\s*\d+\s*Mana\s*,\s*CD\s*\d+\s*[.;]\s*/i,''))}
function clauses(s){return stripCost(s).split(/[.;]/).map(clean).filter(Boolean)}
function conditionalClause(c){c=clean(c);return /^(?:khi|nếu|mỗi khi|lần đầu|trong khi|sau khi|có\s+\d+[^.;]{0,35}?thì|đủ\s+\d+|phát\s+(?:cuối|thứ)|mỗi\s+tầng|kẻ\s+[^.;]{0,32}?bị\s|mục tiêu\s+(?:đang|có|[^.;]{0,28}?(?:đang|có|bị))|tiêu\s+tối đa|tổng\s+hệ số|đòn\s+[^,;]{0,35}?kế tiếp|khiên\s+(?:vỡ|bị phá))/i.test(c)||/(?:phản kích|phản chấn)[^.;]{0,45}?(?:khi|nếu)/i.test(c)}
function directClause(c){c=clean(c);if(!c||conditionalClause(c))return false;
  // Numeric canonical damage. Exclude obvious stat buffs/heals/shields using the same coefficient syntax.
  if(/^(?:tăng|hồi|khiên|giảm)\s+\d+(?:\.\d+)?%\s*(?:ATK|AP|DEF|HP)\b/i.test(c)&&!/\b(?:gây|đánh|bắn|chém|tung|lao|đâm|liên kích|sát thương|AOE)\b/i.test(c))return false;
  if(/\btổng\s+\d+(?:\.\d+)?%\s*(?:ATK|AP|DEF|HP)\b/i.test(c))return true;
  if(/\bgây\s+(?:thêm\s+)?\d+(?:\.\d+)?%\s*(?:ATK|AP|DEF|HP)\b/i.test(c))return true;
  if(/(?:^|\s)\d+(?:\.\d+)?%\s*(?:ATK|AP|DEF)\b[^.;]{0,45}?(?:lên\s+(?:địch|mục tiêu|tuyến)|toàn\s+(?:địch|tuyến)|[,+]|$)/i.test(c)&&!/^(?:hồi|tăng|khiên)/i.test(c))return true;
  if(/\b(?:đánh|bắn|chém|tung|lao|đâm|liên kích|quét|húc|vuốt)[^.;]{0,95}?\d+(?:\.\d+)?%\s*(?:ATK|AP|DEF|HP)\b/i.test(c))return true;
  if(/\b(?:hai|ba|bốn|năm|sáu|2|3|4|5|6|7|8|9|10)\s*(?:hit|nhát|phát|lần)[^.;]{0,70}?\d+(?:\.\d+)?%\s*(?:ATK|AP|DEF|HP)\b/i.test(c))return true;
  if(/^\d+\s*(?:hit|nhát|phát)[^.;]{0,65}?\d+(?:\.\d+)?%\s*(?:ATK|AP|DEF|HP)/i.test(c))return true;
  // Starter/custom canonical kits can intentionally omit numeric coefficients in the prose.
  if(/^(?:bắn|đánh|gây\s+(?:AOE|sát thương)|vuốt|húc|quét|gọi|triệu hồi[^.;]{0,40}?(?:giáng|quét))\b/i.test(c)&&/(?:mục tiêu|địch|AOE|sát thương|finisher|hit|đòn chính)/i.test(c))return true;
  if(/\bgây\s+(?:đại\s+)?sát thương\b|\bgây\s+AOE\b|\bgây\s+Finisher\b/i.test(c))return true;
  return false;
}
function directClauses(a){return clauses(text(a)).filter(directClause)}
function hasDirectDamage(a){return directClauses(a).length>0}
function dualMode(a){const d=text(a);return /(?:gây|\d+(?:\.\d+)?%\s*(?:ATK|AP|DEF))[^.;]{0,65}?\bhoặc\s+hồi\b/i.test(d)}
function enemyUtilityIntent(a){const d=stripCost(text(a));return /^(?:đặt\s+[^.;]{0,35}?lên\s+(?:một\s+)?kẻ địch|chọn\s+(?:một\s+)?mục tiêu[^.;]{0,30}?(?:giảm|đặt)|giảm\s+\d+(?:\.\d+)?%\s+thanh lượt\s+(?:(?:một\s+)?kẻ địch|mục tiêu)|hai\s+kẻ địch[^.;]{0,55}?giảm|đặt\s+(?:bẫy|dấu|nguyền|khóa)[^.;]{0,45}?mục tiêu)/i.test(d)}
function supportTargetFromText(a){const d=text(a);
  if(/\bchọn\s+(?:một\s+)?đồng minh\s+làm\b/i.test(d))return 'ally';
  if(/^\s*Tuyến sau\s+giảm\s+\d+(?:\.\d+)?%\s+sát thương trực tiếp/i.test(stripCost(d)))return 'team';
  if(/\b(?:toàn đội|hồi đội|hồi toàn đội|khiên đội|khiên\s+[^.;]{0,24}?toàn đội|cho toàn đội|đồng minh Lá tăng|đội\s*\+)/i.test(d))return 'team';
  if(/\b(?:ba|3)\s+đồng minh\b|\bba đồng minh thấp HP\b/i.test(d))return 'three-allies';
  if(/\b(?:hai|2)\s+đồng minh\b|\bhai đồng minh thấp HP\b|\bcho hai đồng minh\b/i.test(d))return 'two-allies';
  if(/\b(?:chọn\s+)?(?:bản thân|[\p{L}Đđ]+)\s+và\s+đồng minh(?:\s+tuyến sau)?\s+thấp HP(?:\s+nhất)?\b/iu.test(d))return 'self-and-lowest-ally';
  if(/\b(?:bản thân|\w+)\s+và\s+(?:Đồng Minh Lời Thề|Lời Thề)\b/i.test(d)||/\b(?:Rimehorn|Umbrael|Nightclaw|Venomtail|Gearbit)\s+và\s+Lời Thề/i.test(d))return 'self-and-ally';
  if(enemyUtilityIntent(a))return null;
  if(/\bchọn\s+bản thân\s+hoặc\s+(?:một\s+)?đồng minh\b/i.test(d))return 'ally';
  if(/\b(?:chọn\s+(?:một\s+)?đồng minh|một\s+đồng minh|đồng minh\s+(?:có\s+)?(?:%?HP\s+)?thấp(?:\s+nhất)?|Đồng Minh Lời Thề|Lời Thề|bảo hộ\s+(?:một\s+)?đồng minh|tuyến sau\s+\d+(?:\.\d+)?%\s*AP|hồi\s+(?:mạnh\s+)?một\s+đồng minh)/i.test(d))return 'ally';
  if(/\b(?:nhận\s+\d+\s+(?:Đà|Điểm|Ẩn|Phong)|tăng\s+\d+(?:\.\d+)?%\s*(?:SPEED|Né|ATK|AP|DEF)|\+\s*\d+(?:\.\d+)?%\s*(?:SPEED|Né)|tạo\s+\d+\s+Phiến|khiên\s+bằng|đặt\s+Phản Trục\s+lên\s+\w+|tiêu\s+\d+\s+[^.;]{0,20}?để\s+nhận)/i.test(stripCost(d))&&!/\b(?:kẻ địch|mục tiêu)\b[^.;]{0,45}?(?:giảm|đặt)/i.test(stripCost(d)))return 'self';
  if(/^(?:hồi|phục hồi|tạo\s+khiên|khiên)\b/i.test(stripCost(d))){const orig=String(a?.target||'');return SUPPORT_TARGETS.has(orig)?orig:'ally';}
  {const orig=String(a?.target||'');if(SUPPORT_TARGETS.has(orig)&&a?.type==='support')return orig;}
  return null;
}
function enemyTargetFromText(a){const d=text(a),orig=String(a?.target||'');
  if(/\b(?:toàn bộ kẻ địch|toàn địch|toàn đội địch|toàn chiến trường địch|AOE\s+(?:lên\s+)?toàn|gây\s+AOE)\b/i.test(d))return 'all-enemies';
  if(/\b(?:hai|2)\s+kẻ địch\b/i.test(d))return 'two-enemies';
  if(/\b(?:tuyến trước địch|toàn tuyến trước|lên tuyến trước)\b/i.test(d))return 'front-row';
  if(/\b(?:tuyến sau địch|đột kích tuyến sau)\b/i.test(d)&&!/nếu|có ≥|có ít nhất/i.test(d))return 'back-row';
  if(OFFENSIVE_TARGETS.has(orig))return orig;
  return 'enemy';
}
function primaryDamageText(a){const rows=directClauses(a);if(!rows.length)return'';let s=rows[0];
  // A mixed line such as "73% AP lên địch và hồi ... 55% AP" must not add the heal coefficient to damage.
  s=s.split(/\b(?:hoặc|và)\s+(?:hồi|phục hồi)\b/i)[0];
  return clean(s);
}
function parseDamageCoefficients(a){const d=primaryDamageText(a);if(!d)return null;
  const total=d.match(/\btổng\s+(\d+(?:\.\d+)?)%\s*(ATK|AP|DEF|HP)\b/i);if(total)return{[total[2].toLowerCase()]:Number(total[1])};
  const multi=d.match(/(?:bắn|đánh|chém|tung|liên kích)?\s*(\d+)\s*(?:phát|nhát|lần)[^.;]{0,70}?mỗi\s*(?:phát|nhát|lần)[^.;]{0,30}?(\d+(?:\.\d+)?)%\s*(ATK|AP|DEF|HP)/i);if(multi)return{[multi[3].toLowerCase()]:Number(multi[1])*Number(multi[2])};
  const out={};for(const m of d.matchAll(/(\d+(?:\.\d+)?)%\s*(ATK|AP|DEF)\b/gi)){const k=m[2].toLowerCase(),v=Number(m[1]);if(!Number.isFinite(v))continue;out[k]=(out[k]||0)+v;}
  return Object.keys(out).length?out:null;
}
function offensiveType(a,coeff){if(a?.type&&a.type!=='support'&&a.type!=='ultimate')return a.type;if(coeff?.ap&&!coeff?.atk&&!coeff?.def)return 'magic';if(coeff?.atk||coeff?.def)return 'physical';return a?.slotType==='ultimate'?'ultimate':'magic'}
function hasHealWord(d){const x=String(d||'').replace(/triệu\s+hồi/gi,'triệu_hồi');return /(?:^|\s)(?:hồi|phục hồi)(?:\s|$)/i.test(x)}
function hasActualStatBuff(d,stat){const S=String(stat||'').toUpperCase();return new RegExp(`(?:tăng|\\+)\\s*\\d+(?:\\.\\d+)?%\\s*${S}\\b|${S}\\s*\\+\\s*\\d+(?:\\.\\d+)?%`,'i').test(String(d||'').replace(/Khiên[^.;]*/gi,''))}
const audit={version:'18.5.0',pows:0,slots:0,classes:{offense:0,support:0,'enemy-utility':0,hybrid:0,'dual-mode':0},targets:{},normalized:0,zeroed:0,statusSuppressed:0,healSanitized:0,buffSanitized:0,suspicious:[]};
function normalizeAbility(p,slot,a,track=true){
  if(!a)return a;
  const d=text(a),direct=hasDirectDamage(a),dual=dualMode(a),supportTarget=supportTargetFromText(a),damageCoeff=direct?parseDamageCoefficients(a):null;let actionClass,target;
  if(dual){actionClass='dual-mode';target='enemy-or-ally';a.canonicalDualMode=true;}
  else{delete a.canonicalDualMode;
    if(direct){actionClass=supportTarget?'hybrid':'offense';target=enemyTargetFromText(a);}
    else if(supportTarget){actionClass='support';target=supportTarget;}
    else{actionClass='enemy-utility';target=enemyTargetFromText(a);}
  }
  a.canonicalDirectDamage=direct;a.canonicalActionClass=actionClass;a.canonicalTarget=target;a.target=target;
  if(/đồng minh tuyến sau thấp HP/i.test(d))a.canonicalAllySelector='back-lowest';
  else if(target==='self-and-lowest-ally')a.canonicalAllySelector='lowest';
  else delete a.canonicalAllySelector;
  if(damageCoeff)a.canonicalDamageCoefficients=damageCoeff;else delete a.canonicalDamageCoefficients;
  let normalized=0,zeroed=0,statusSuppressed=0,healSanitized=0,buffSanitized=0;
  if(actionClass==='support'){if(a.type!=='support'){a.type='support';normalized++;}}
  else{const t=offensiveType(a,damageCoeff);if(a.type==='support'){a.type=t;normalized++;}}
  if(!direct&&(Number(a.power)||Object.keys(a.coefficients||{}).length)){a.power=0;a.coefficients={};zeroed++;}
  if(actionClass==='support'&&BAD_ALLY_STATUS.has(a.status)){a.suppressLegacyStatus=true;statusSuppressed++;}else delete a.suppressLegacyStatus;
  if(a.masterEffects&&!hasHealWord(d)&&(a.masterEffects.healHpPct||a.masterEffects.healApPct)){delete a.masterEffects.healHpPct;delete a.masterEffects.healApPct;healSanitized++;}
  if(Array.isArray(a.masterEffects?.buffs)&&a.masterEffects.buffs.length){const before=a.masterEffects.buffs.length;a.masterEffects.buffs=a.masterEffects.buffs.filter(b=>hasActualStatBuff(d,b.stat));if(a.masterEffects.buffs.length!==before)buffSanitized+=before-a.masterEffects.buffs.length;}
  if(track){
    audit.slots++;audit.normalized+=normalized;audit.zeroed+=zeroed;audit.statusSuppressed+=statusSuppressed;audit.healSanitized+=healSanitized;audit.buffSanitized+=buffSanitized;
    audit.classes[actionClass]=(audit.classes[actionClass]||0)+1;audit.targets[target]=(audit.targets[target]||0)+1;
    if(!a.id||!a.name||!d)audit.suspicious.push({powId:p?.id,slot,reason:'missing-canonical-metadata'});
    if(direct&&Number(a.power)===0&&!a.canonicalDamageCoefficients&&!/^starter_/.test(p?.id||''))audit.suspicious.push({powId:p?.id,slot,reason:'direct-damage-without-coefficient',name:a.name});
    if(actionClass==='support'&&!SUPPORT_TARGETS.has(target))audit.suspicious.push({powId:p?.id,slot,reason:'invalid-support-target',target,name:a.name});
  }
  return a;
}
for(const p of D.pows){
  audit.pows++;
  const skills=[['basic',p?.abilities?.basic],['skill1',p?.abilities?.skills?.[0]],['skill2',p?.abilities?.skills?.[1]],['ultimate',p?.abilities?.ultimate]];
  for(const [slot,a] of skills)normalizeAbility(p,slot,a,true);
}
window.POWDER_CANONICAL_ACTION_RUNTIME_V1850={version:'18.5.0',audit,normalizeAbility,hasDirectDamage,directClause,directClauses,supportTargetFromText,enemyTargetFromText,parseDamageCoefficients};
// Compatibility: callers that only check the old capability name still receive the corrected classifier.
window.POWDER_CANONICAL_ACTION_RUNTIME_V18=window.POWDER_CANONICAL_ACTION_RUNTIME_V1850;
})();
