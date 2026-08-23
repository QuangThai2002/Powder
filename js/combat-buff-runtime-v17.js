(()=>{'use strict';
const D=window.POWDER_DATA;
if(!D)return;
const STAT_LABEL={ATK:'ATK',AP:'AP',DEF:'DEF',SPEED:'SPEED',CRIT_RATE:'CRIT',EVASION:'NÉ',ACCURACY:'CHÍNH XÁC',TENACITY:'KHÁNG HIỆU ỨNG'};
const ICON={ATK:'⚔',AP:'✦',DEF:'🛡',SPEED:'➚',CRIT_RATE:'✧',EVASION:'↯',ACCURACY:'🎯',TENACITY:'⛨'};
function durationFrom(text){const m=String(text||'').match(/(?:trong\s*)?(\d+)\s*(?:lượt|vòng)/i);return m?Math.max(1,Number(m[1])||1):2;}
function scopeFor(sentence,ability,powName,fullText=''){const x=String(sentence||''),all=String(fullText||''),lx=x.toLowerCase(),pn=String(powName||'').toLowerCase();if(/toàn đội|cả đội|Đội\s*(?:\+|tăng|nhận)/i.test(x))return'team';if(pn&&(lx.includes(`${pn} tăng`)||lx.includes(`${pn} nhận`)||lx.includes(`cho ${pn}`)||lx.includes(`của ${pn}`)))return'self';if(/hai đồng minh|ba đồng minh|\d+\s+đồng minh|chọn một đồng minh|một đồng minh|mục tiêu.*(?:tăng|\+)/i.test(x))return'action';if(/chọn\s+(?:một|hai|2|ba|3)\s+đồng minh/i.test(all))return'action';if(/toàn đội|cả đội|Đội\s*(?:\+|tăng|nhận)/i.test(all)&&/toàn đội|cả đội|Đội/i.test(x))return'team';if(['ally','two-allies','allies'].includes(String(ability?.target||'')))return'action';if(String(ability?.target||'')==='team')return'team';return'self';}
function tokenStats(token){const t=String(token||'');if(/ATK\/AP\/DEF/i.test(t))return['ATK','AP','DEF'];if(/ATK\/AP/i.test(t))return['PRIMARY_OFFENSE'];if(/^ATK$/i.test(t))return['ATK'];if(/^AP$/i.test(t))return['AP'];if(/^DEF$/i.test(t))return['DEF'];if(/^SPEED$/i.test(t))return['SPEED'];if(/chí mạng/i.test(t))return['CRIT_RATE'];if(/Né/i.test(t))return['EVASION'];if(/chính xác/i.test(t))return['ACCURACY'];if(/kháng hiệu ứng/i.test(t))return['TENACITY'];return[];}
function statSpecs(ability,pow){
 const text=String(ability?.v81Description||ability?.description||'');if(!text)return[];
 const out=[],token='(ATK\\/AP\\/DEF|ATK\\/AP|ATK|AP|DEF|SPEED|Tỷ lệ chí mạng|tỷ lệ chí mạng|chí mạng|Né|né|chính xác|kháng hiệu ứng)';
 const clauses=text.split(/(?<=[.;])/g);
 for(const raw of clauses){
  const clause=raw.trim();if(!clause)continue;
  const scope=scopeFor(clause,ability,pow?.name,text),dur=durationFrom(clause),found=[];
  const hasDuration=/\d+\s*(?:lượt|vòng)/i.test(clause);
  let m,hasDirect=false;
  const direct=new RegExp('(?:tăng|nhận\\s+thêm)\\s+(\\d+(?:[.,]\\d+)?)%\\s*'+token,'gi');
  while((m=direct.exec(clause))){found.push({value:Number(String(m[1]).replace(',','.'))/100,token:m[2]});hasDirect=true;}
  if(hasDirect&&hasDuration){const allPct=new RegExp('(\\d+(?:[.,]\\d+)?)%\\s*'+token,'gi');while((m=allPct.exec(clause)))found.push({value:Number(String(m[1]).replace(',','.'))/100,token:m[2]});}
  const clearPlus=/(?:toàn đội|cả đội|Đội\s*\+|đội\s*\+|đồng minh|mục tiêu|nhận\s+\d+[^,;]*,|nhận buff|trong\s+\d+\s*(?:lượt|vòng))/i.test(clause)||Boolean(pow?.name&&new RegExp(pow.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\+','i').test(clause));
  if(clearPlus){const plus=new RegExp('\\+(\\d+(?:[.,]\\d+)?)%\\s*'+token,'gi');while((m=plus.exec(clause)))found.push({value:Number(String(m[1]).replace(',','.'))/100,token:m[2]});}
  if(/nhận buff/i.test(clause)){const bare=new RegExp('(\\d+(?:[.,]\\d+)?)%\\s*'+token,'gi');while((m=bare.exec(clause)))found.push({value:Number(String(m[1]).replace(',','.'))/100,token:m[2]});}
  const persistentContext=hasDuration||scope==='team'||(String(ability?.type||'')==='support'&&['ally','two-allies','allies','team'].includes(String(ability?.target||'')));
  for(const f of found){if(!(f.value>0&&f.value<=.60)||!persistentContext)continue;for(const stat of tokenStats(f.token))out.push({stat,value:f.value,duration:dur,scope,sentence:clause});}
 }
 const map=new Map();for(const x of out){const k=`${x.stat}|${x.scope}`;const old=map.get(k);if(!old||x.value>old.value)map.set(k,x);else if(x.duration>old.duration)old.duration=x.duration;}
 return [...map.values()];
}
function normalizeAbility(ability,pow){if(!ability)return ability;ability.combatBuffs=statSpecs(ability,pow);const desc=String(ability.v81Description||ability.description||'');const beneficial=new Set(['Attack Up','AP Up','Defense Up','Speed Up','Shield','Regeneration']);const harmful=new Set(['Slow','Stun','Freeze','Burn','Poison']);const status=ability.status;let mentioned=true;if(status==='Attack Up')mentioned=/tăng[^.]{0,60}ATK|\+\s*\d+(?:[.,]\d+)?%\s*ATK/i.test(desc);else if(status==='AP Up')mentioned=/tăng[^.]{0,60}AP|\+\s*\d+(?:[.,]\d+)?%\s*AP/i.test(desc);else if(status==='Defense Up')mentioned=/tăng[^.]{0,60}DEF|\+\s*\d+(?:[.,]\d+)?%\s*DEF/i.test(desc);else if(status==='Speed Up')mentioned=/tăng[^.]{0,60}SPEED|\+\s*\d+(?:[.,]\d+)?%\s*SPEED/i.test(desc);else if(status==='Shield')mentioned=/Khiên/i.test(desc);else if(status==='Regeneration')mentioned=/Hồi phục theo lượt|Tái sinh|Regen/i.test(desc);else if(status==='Slow')mentioned=/giảm[^.]{0,45}SPEED|Chậm/i.test(desc);else if(status==='Stun')mentioned=/Choáng/i.test(desc);else if(status==='Freeze')mentioned=/Đóng băng|Freeze/i.test(desc);else if(status==='Burn')mentioned=/Thiêu đốt|Burn/i.test(desc);else if(status==='Poison')mentioned=/Độc|Poison/i.test(desc);ability.suppressLegacyStatus=Boolean(status&&((beneficial.has(status)||harmful.has(status))&&!mentioned));return ability;}
function normalizeAll(){let abilities=0,buffs=0;for(const p of D.pows||[]){const abs=[p.abilities?.basic,...(p.abilities?.skills||[]),p.abilities?.ultimate,p.exclusiveSkill].filter(Boolean);for(const a of abs){normalizeAbility(a,p);abilities++;buffs+=a.combatBuffs?.length||0;}}return{abilities,buffs};}
function resolveStat(spec,target){if(spec.stat!=='PRIMARY_OFFENSE')return spec.stat;const s=target?.stats||{};return Number(s.ap||0)>Number(s.atk||0)?'AP':'ATK';}
function label(stat){return STAT_LABEL[stat]||stat;}
function icon(stat){return ICON[stat]||'✦';}
const audit=normalizeAll();
window.POWDER_COMBAT_BUFF_V164={version:'18.0.0',audit,parse:statSpecs,normalizeAbility,resolveStat,label,icon};
})();
