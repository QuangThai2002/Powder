(()=>{'use strict';
const VERSION='18.8.1';
const D=window.POWDER_DATA,V=window.POWDER_SKILL_V81,M=window.POWDER_MASTER_DATA_V9;
if(!D?.pows||!V?.pows||!window.POWDER_ROLE_SYSTEM_V9)return;
const ROLE_LABELS={marksman:'Xạ thủ',mage:'Pháp sư',tank:'Đỡ đòn',fighter:'Đấu sĩ',knight:'Hiệp sĩ',enchanter:'Thuật sư',healer:'Trị liệu',musician:'Nhạc công',assassin:'Sát thủ'};
const EXPLICIT_CORE_REGISTRY=Object.freeze({
 aquabub:{engine:'STANCE',visible:false},
 zephyroo:{engine:'FIELD',visible:false,rules:['METER_CHANGE']},
 mosshorn:{engine:'GROWTH',visible:false,rules:['HEAL','OVERHEAL']},
 mudram:{engine:'GUARD_STORE',visible:false,rules:['DAMAGE_TAKEN']},
 rivetoad:{engine:'BOND',visible:false,rules:['SHIELD','SHIELD_BREAK','COUNTER']},
 streami:{engine:'STANCE',visible:false,rules:['SHIELD','METER_CHANGE']},
 budtail:{engine:'FIELD',visible:false,rules:['BUFF']},
 windlet:{engine:'FIELD',visible:false,rules:['METER_CHANGE']},
 brookfin:{engine:'GROWTH',visible:false,rules:['HEAL']},
 spriggle:{engine:'GROWTH',visible:false,rules:['HEAL']},
 quakeback:{engine:'GUARD_STORE',visible:false,rules:['DAMAGE_TAKEN']},
 ferrolyn:{engine:'BOND',visible:false,rules:['GUARD','COUNTER']},
 steelpaw:{engine:'BOND',visible:false,rules:['SHIELD','SHIELD_BREAK']},
 toxiclaw:{engine:'DOT_CURSE',visible:false,rules:['DEBUFF','DOT_TICK']},
 frostfeather:{engine:'GROWTH',visible:false,rules:['HEAL','OVERHEAL','SHIELD']},
 hydripple:{engine:'GROWTH',visible:false,rules:['HEAL','MANA_CHANGE']},
 mirefang:{engine:'DOT_CURSE',visible:false,rules:['DEBUFF','DOT_TICK','KILL']},
 bloomlord:{engine:'GROWTH',visible:false,rules:['HEAL','OVERHEAL','BUFF']},
 starter_fire_flarion:{engine:'DOT_CURSE',visible:false,rules:['DEBUFF','DOT_TICK']}
});
function hash32(input=''){let h=2166136261;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}return('00000000'+(h>>>0).toString(16)).slice(-8)}
function text(v){return String(v||'').replace(/\s+/g,' ').trim()}
function roleKey(pow){return pow?.officialRoleKey||pow?.combatRole||Object.keys(ROLE_LABELS).find(k=>ROLE_LABELS[k]===pow?.role)||'flex'}
function secondaryRole(pow,v){const all=text([v?.archetype,v?.teamRole,v?.coreDescription,...Object.values(v?.skills||{}).map(x=>x?.description)].join(' ')).toLowerCase();if(/kết liễu|finisher|execute|tuyến sau|đột kích/.test(all))return'Kết liễu';if(/khống chế|freeze|đóng băng|choáng|stun|giảm speed|giảm thanh lượt/.test(all))return'Khống chế';if(/khiên|bảo hộ|phản kích|thành lũy|hộ vệ/.test(all))return'Bảo hộ';if(/hồi|sustain|overheal|hồi phục/.test(all))return'Duy trì';if(/độc|poison|thiêu đốt|burn|dot|anti-heal/.test(all))return'Bào mòn';if(/thanh lượt|tempo|speed|nhịp/.test(all))return'Điều lượt';if(/crit|chí mạng|burst|bùng nổ/.test(all))return'Dồn sát thương';const map={marksman:'Áp lực',mage:'Bùng nổ',tank:'Bảo hộ',fighter:'Duy trì',knight:'Hộ vệ',enchanter:'Tiện ích',healer:'Duy trì',musician:'Điều lượt',assassin:'Kết liễu'};return map[roleKey(pow)]||'Linh hoạt'}
function strengthTags(pow,v){const all=text([v?.archetype,v?.teamRole,v?.coreDescription,...Object.values(v?.skills||{}).map(x=>x?.description)].join(' '));const rules=[[/Burn|Thiêu Đốt|Thiêu đốt/i,'Thiêu đốt'],[/Poison|Độc|anti-heal|giảm hồi/i,'DoT / anti-heal'],[/Freeze|Đóng Băng|Choáng|Stun|Paralysis/i,'Khống chế'],[/Khiên|bảo hộ|hộ vệ/i,'Khiên / bảo hộ'],[/hồi máu|Hồi phục|overheal|sustain/i,'Hồi phục'],[/thanh lượt|SPEED|tempo|nhịp/i,'Điều lượt'],[/Mana/i,'Nhịp Mana'],[/chí mạng|crit/i,'Chí mạng'],[/phản kích|Counter/i,'Phản kích'],[/tuyến sau|Đột Kích|Phá Tuyến/i,'Áp lực hậu tuyến'],[/AOE|toàn đội địch|toàn bộ địch/i,'Sát thương diện rộng'],[/kết liễu|Finisher|execute/i,'Kết liễu']];const out=[];for(const [re,label]of rules)if(re.test(all)&&!out.includes(label))out.push(label);if(!out.length)out.push(secondaryRole(pow,v));return out.slice(0,4)}
function signature(pow,v){return hash32(JSON.stringify({id:pow.id,role:roleKey(pow),element:pow.element,core:v.coreDescription||v.core,skills:Object.fromEntries(Object.entries(v.skills||{}).map(([k,s])=>[k,[s.id,s.name,s.description]]))}))}
function starIdentity(v){return(v?.starProgression||[]).map(x=>({star:Number(x.star)||0,stage:text(x.stage),core:text(x.core),coefficient:Number(x.coefficient)||1,effect:Number(x.effect)||1}))}
const masterById=new Map((M?.pows||[]).map(x=>[x.id,x]));
const profiles={};
for(const pow of D.pows){const v=V.pows[pow.id];if(!v)continue;const md=masterById.get(pow.id),primary=pow.rolePrimary||pow.officialRole||pow.role||ROLE_LABELS[roleKey(pow)]||'Pow',secondary=secondaryRole(pow,v);const p={version:VERSION,powId:pow.id,name:pow.name,rarity:pow.rarity,element:pow.element,primaryRole:primary,secondaryRole:secondary,archetype:text(v.archetype)||secondary,combo:`Vận hành ${text(v.core)||'core riêng'} → ${text(v.skills?.skill1?.name)||'Skill 1'} → ${text(v.skills?.skill2?.name)||'Skill 2'} → chốt nhịp bằng ${text(v.skills?.ultimate?.name)||'Ultimate'}.`,strengths:strengthTags(pow,v),weakness:text(v.badPartners)||text(md?.counter)||'Cần đội hình khai thác đúng nhịp core.',synergy:text(v.goodPartners)||text(v.teamRole)||'Phối hợp theo core riêng.',counter:text(md?.counter)||text(v.badPartners)||'Phá nhịp core và ép đổi mục tiêu/tempo.',passiveName:text(v.core)||'Core riêng',passiveIdentity:text(v.coreDescription)||text(v.core),teamRole:text(v.teamRole),reasonToUse:text(v.teamRole)||`${primary} thiên ${secondary.toLowerCase()}.`,starIdentity:starIdentity(v),fixedKit:true,signature:signature(pow,v)};profiles[pow.id]=Object.freeze(p);pow.combatIdentity=p;pow.roleSecondary=secondary;pow.identitySignature=p.signature;pow.identityVersion=VERSION}
const sigMap=new Map();for(const p of Object.values(profiles)){if(!sigMap.has(p.signature))sigMap.set(p.signature,[]);sigMap.get(p.signature).push(p.powId)}const duplicates=[...sigMap.values()].filter(x=>x.length>1),missing=D.pows.filter(x=>!profiles[x.id]).map(x=>x.id);const roleCounts={};for(const p of Object.values(profiles))roleCounts[p.primaryRole]=(roleCounts[p.primaryRole]||0)+1;
const audit=Object.freeze({version:VERSION,expected:99,profileCount:Object.keys(profiles).length,explicitRegistryExtension:Object.keys(EXPLICIT_CORE_REGISTRY).length,uniqueSignatures:sigMap.size,duplicateSignatures:duplicates,missing,roleCounts,assassinCount:Number(roleCounts['Sát thủ']||0),pass:Object.keys(profiles).length===99&&sigMap.size===99&&!missing.length&&Number(roleCounts['Sát thủ']||0)===10});
window.POWDER_COMBAT_IDENTITY_V1881=Object.freeze({version:VERSION,profiles:Object.freeze(profiles),coreRegistry:EXPLICIT_CORE_REGISTRY,audit,get:id=>profiles[String(id)]||null});
if(!audit.pass)console.error('[Combat Identity 18.8.1] audit failed',audit);else console.info('[Combat Identity 18.8.1] 99/99 unique identities',audit);
})();
