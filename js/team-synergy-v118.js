(()=>{'use strict';
const D=window.POWDER_DATA;if(!D)return;
const ROLE_LABEL={marksman:'Xạ thủ',mage:'Pháp sư',tank:'Đỡ đòn',fighter:'Đấu sĩ',knight:'Hiệp sĩ',enchanter:'Thuật sư',healer:'Trị liệu',musician:'Nhạc công',assassin:'Sát thủ'};
const ELEMENT_CORE={2:{core:.03,speed:.01},3:{core:.06,speed:.02},4:{core:.09,speed:.03},5:{core:.13,speed:.05}};
const TIER_INDEX=n=>Math.max(0,Math.min(3,n-2));
const pct=(arr,n)=>Number(arr?.[TIER_INDEX(n)]||0);
const ROLE={
 marksman:{stats:{atk:[.06,.10,.15,.21]},critRate:[3,5,8,12],extra:{},text:n=>`ATK +${Math.round(pct([.06,.10,.15,.21],n)*100)}% · CRIT +${pct([3,5,8,12],n)}%`},
 mage:{stats:{ap:[.05,.09,.13,.18]},extra:{manaPct:[.05,.09,.13,.18]},text:n=>`AP +${Math.round(pct([.05,.09,.13,.18],n)*100)}% · Mana +${Math.round(pct([.05,.09,.13,.18],n)*100)}%`},
 tank:{stats:{hp:[.05,.09,.14,.20],def:[.05,.09,.14,.20]},extra:{},text:n=>`HP/DEF +${Math.round(pct([.05,.09,.14,.20],n)*100)}%`},
 fighter:{stats:{hp:[.04,.07,.11,.16],atk:[.04,.07,.11,.16]},extra:{},text:n=>`HP/ATK +${Math.round(pct([.04,.07,.11,.16],n)*100)}%`},
 knight:{stats:{def:[.05,.09,.13,.18],hp:[.03,.05,.08,.12]},extra:{shieldPct:[.08,.14,.20,.28]},text:n=>`DEF +${Math.round(pct([.05,.09,.13,.18],n)*100)}% · Khiên +${Math.round(pct([.08,.14,.20,.28],n)*100)}%`},
 enchanter:{stats:{ap:[.04,.07,.11,.16],speed:[.025,.04,.06,.08]},extra:{},text:n=>`AP +${Math.round(pct([.04,.07,.11,.16],n)*100)}% · SPEED +${Math.round(pct([.025,.04,.06,.08],n)*100)}%`},
 healer:{stats:{ap:[.05,.09,.13,.18],hp:[.03,.05,.08,.12]},extra:{healingPct:[.08,.14,.20,.28]},text:n=>`AP +${Math.round(pct([.05,.09,.13,.18],n)*100)}% · Hồi phục +${Math.round(pct([.08,.14,.20,.28],n)*100)}%`},
 musician:{stats:{speed:[.03,.05,.08,.12],ap:[.03,.05,.08,.12]},extra:{manaPct:[.04,.07,.11,.16]},text:n=>`SPEED/AP +${Math.round(pct([.03,.05,.08,.12],n)*100)}% · Mana +${Math.round(pct([.04,.07,.11,.16],n)*100)}%`},
 assassin:{stats:{atk:[.04,.07,.11,.16]},critDamage:[10,18,28,40],extra:{},text:n=>`ATK +${Math.round(pct([.04,.07,.11,.16],n)*100)}% · CRIT DMG +${pct([10,18,28,40],n)}%`}
};
function roleKey(p){return p?.combatRole||p?.officialRoleKey||p?.roleTags?.[0]||''}
function elementName(id){return D.elements?.[id]?.name||id}
function elementIcon(id){return D.elements?.[id]?.icon||'✦'}
function calculate(pows=[]){
 const list=pows.filter(Boolean).slice(0,5),ec={},rc={};
 for(const p of list){if(p.element)ec[p.element]=(ec[p.element]||0)+1;const r=roleKey(p);if(r)rc[r]=(rc[r]||0)+1}
 let dominant=null;for(const [id,count] of Object.entries(ec)){if(!dominant||count>dominant.count)dominant={id,count}}
 const eTier=dominant&&dominant.count>=2?ELEMENT_CORE[Math.min(5,dominant.count)]||null:null;
 const statPct={hp:eTier?.core||0,atk:eTier?.core||0,def:eTier?.core||0,ap:eTier?.core||0,speed:eTier?.speed||0};
 let critRate=0,critDamage=0,healingPct=0,shieldPct=0,manaPct=0;
 const roles=[];
 for(const [key,count] of Object.entries(rc)){
   if(count<2||!ROLE[key])continue;const cfg=ROLE[key];
   for(const [stat,arr] of Object.entries(cfg.stats||{}))statPct[stat]=(statPct[stat]||0)+pct(arr,count);
   critRate+=pct(cfg.critRate,count);critDamage+=pct(cfg.critDamage,count);
   healingPct+=pct(cfg.extra?.healingPct,count);shieldPct+=pct(cfg.extra?.shieldPct,count);manaPct+=pct(cfg.extra?.manaPct,count);
   roles.push({key,label:ROLE_LABEL[key]||key,count,text:cfg.text(count)});
 }
 return{size:list.length,element:dominant&&eTier?{...dominant,name:elementName(dominant.id),icon:elementIcon(dominant.id),corePct:eTier.core,speedPct:eTier.speed}:null,roles,statPct,critRate,critDamage,healingPct,shieldPct,manaPct,active:Boolean(eTier||roles.length),elementCounts:ec,roleCounts:rc};
}
function applyStats(stats,profile){const out={...(stats||{})};if(!profile?.active)return out;for(const k of ['hp','atk','def','ap','speed'])if(out[k]!=null&&profile.statPct?.[k])out[k]=Math.max(1,Math.round(Number(out[k])*(1+Number(profile.statPct[k]))));if(out.critRate!=null)out.critRate=Math.min(90,Math.round((Number(out.critRate)+Number(profile.critRate||0))*10)/10);if(out.critDamage!=null)out.critDamage=Math.max(100,Math.round(Number(out.critDamage)+Number(profile.critDamage||0)));return out}
function applyUnits(units,profile){for(const u of units||[]){if(!u||!profile?.active)continue;const hpRatio=u.maxHp?u.hp/u.maxHp:1;u.stats=applyStats(u.stats,profile);u.maxHp=Math.max(1,Number(u.stats.hp)||u.maxHp||1);u.hp=Math.max(1,Math.round(u.maxHp*hpRatio));u.teamSynergy={healingPct:profile.healingPct||0,shieldPct:profile.shieldPct||0,manaPct:profile.manaPct||0,element:profile.element,roles:profile.roles};if(u.maxMana&&profile.manaPct){const manaRatio=u.maxMana?u.mana/u.maxMana:1;u.maxMana=Math.max(1,Math.round(u.maxMana*(1+profile.manaPct)));u.mana=Math.round(u.maxMana*manaRatio)}}return units}
function summary(profile){if(!profile?.active)return[];const out=[];if(profile.element)out.push(`${profile.element.icon} ${profile.element.name} ×${profile.element.count} · Toàn đội HP/ATK/DEF/AP +${Math.round(profile.element.corePct*100)}% · SPEED +${Math.round(profile.element.speedPct*100)}%`);for(const r of profile.roles)out.push(`${r.label} ×${r.count} · ${r.text}`);return out}
window.POWDER_TEAM_SYNERGY={version:'11.8',calculate,applyStats,applyUnits,summary,roleLabel:ROLE_LABEL};
})();
