(()=>{'use strict';
const D=window.POWDER_DATA,W=window.POWDER_WORLD_DATA_V9,M=window.POWDER_MASTER_DATA_V9,V=window.POWDER_SKILL_V81;if(!D||!W||!M||!V)return;
const clone=x=>typeof structuredClone==='function'?structuredClone(x):JSON.parse(JSON.stringify(x));
const starterOld=new Set(['pyroon','aquabub','mosshorn']);
function fixedAbility(src,skillMeta,ownerId,slot,unlockStar){
  const out=clone(src||{});out.id=skillMeta?.id||out.id;out.name=skillMeta?.name||out.name;out.ownerId=ownerId;out.fixedSkill=true;out.transferable=false;out.learnable=false;out.copyable=false;out.replaceable=false;out.v81Slot=slot;out.unlockStar=unlockStar;out.v81Description=skillMeta?.description||out.description||'';out.masterVersion='V8.1';return out;
}
for(const md of M.pows){
  const p=D.pows.find(x=>x.id===md.id),v=V.pows?.[md.id];if(!p||!v)continue;
  p.officialRole=md.roleLabel;p.officialRoleKey=md.role;p.combatRole=md.role;p.rolePrimary=md.roleLabel;p.role=md.roleLabel;p.roleTags=[md.role];p.element=md.element;p.rarity=md.rarity;
  const native=Math.max(1,Number(v.nativeStar)||Number(md.star)||1),isOldStarter=starterOld.has(p.id);
  p.startStars=isOldStarter?0:native;p.initialStar=p.startStars;p.nativeStar=native;p.maxStars=isOldStarter?1:Math.max(native,Number(v.maxStarWorkbook)||native);
  p.fixedSkillKit=true;p.fixedSkillVersion='8.1';p.skillSource=v.source;p.skillArchetype=v.archetype;p.teamRoleText=v.teamRole;p.goodPartners=v.goodPartners;p.badPartners=v.badPartners;
  p.coreName=v.core;p.coreMechanic=v.coreDescription||md.coreMechanic;p.progressionText=md.progression;p.counterText=md.counter;p.bossRuleText=md.bossRule;p.aiText=v.ai||md.ai;p.masterStatus=v.status||md.status;
  p.skillStarProgression=clone(v.starProgression||[]);
  const unlockCore=isOldStarter?1:native, a=md.abilities||{};p.abilities=p.abilities||{};
  p.abilities.basic=fixedAbility(a.basic,v.skills?.basic,p.id,'basic',isOldStarter?0:unlockCore);
  p.abilities.skills=[fixedAbility(a.skill1,v.skills?.skill1,p.id,'skill1',unlockCore),fixedAbility(a.skill2,v.skills?.skill2,p.id,'skill2',unlockCore)];
  p.abilities.ultimate=fixedAbility(a.ultimate,v.skills?.ultimate,p.id,'ultimate',unlockCore);
  p.abilities.passive={id:`${p.id}.core`,name:v.core,description:v.coreDescription||v.core,fixedCore:true,ownerId:p.id,rules:{summary:v.coreDescription||v.core,activation:'Cơ chế bẩm sinh của chính Pow; không phải kỹ năng có thể thay.',effect:v.coreDescription||v.core,notCounted:'Không thể học, copy, chuyển hoặc cấp từ Trang bị/Cổ vật.',limit:'Chỉ thuộc đúng Pow này.',build:v.goodPartners||v.teamRole||'Phối hợp theo core riêng của Pow.'}};
  delete p.learnedSkills;delete p.inheritedSkills;delete p.copySkill;delete p.skillBook;
  if(p.rarity!=='ancient'){delete p.exclusiveSkill;delete p.abilities.exclusive;}
  const anc=M.ancients?.[p.id];if(anc?.exclusiveAbility){p.exclusiveSkill=clone(anc.exclusiveAbility);p.exclusiveSkill.unlockStar=7;p.exclusiveSkill.ownerId=p.id;p.exclusiveSkill.fixedSkill=true;p.exclusiveSkill.transferable=false;p.exclusiveSkill.learnable=false;p.exclusiveSkill.copyable=false;p.exclusiveSkill.replaceable=false;p.exclusiveSkill.masterVersion='V8.1';p.ancientLaw=anc['Luật/Cơ chế lõi'];p.breakthrough={condition:anc['Điều kiện Đột Phá'],effect:anc['Đột Phá Cổ Thần']};}
  const my=M.mythics?.[p.id];if(my){p.mythicLaw={name:my['Luật Bản Nguyên']?.split(':')[0]||'Luật Bản Nguyên',description:my['Luật Bản Nguyên']};p.breakthrough={condition:my['Điều kiện Đột Phá'],effect:my['Đột Phá Thần Thoại']};p.mythicDomain={condition:my['Điều kiện Lãnh Vực'],description:my['Lãnh Vực / Siêu Việt']};p.teamResonance=my['Cộng hưởng đội hình'];}
}
D.combatRoles={marksman:'Xạ thủ',mage:'Pháp sư',tank:'Đỡ đòn',fighter:'Đấu sĩ',knight:'Hiệp sĩ',enchanter:'Thuật sư',healer:'Trị liệu',musician:'Nhạc công',assassin:'Sát thủ'};
D.skillIdentityVersion='8.1-fixed-kit';
window.POWDER_ROLE_SYSTEM_V9={version:'10.6-fixed-skill-v8.1',labels:D.combatRoles,fixed:true};
})();
