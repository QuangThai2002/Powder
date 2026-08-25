(()=>{'use strict';
if(window.POWDER_COMBAT_DOMAIN_TURN_ECONOMY_V2165)return;
const VERSION='21.6.5';
const CSS_ID='powderCombatDomainTurnEconomy2165Css',CSS_HREF='css/combat-domain-turn-economy-v2165.css?v=2165';
const BRANCH=Object.freeze({nine_suns:'fire',infinite_strike:'fire',limitless_void:'fire',frozen_silence:'water',diamond_guard:'water',jackpot_bagua:'water',myriad_poison:'leaf',rebirth_wood:'leaf',draw_swords:'leaf'});
const ELEMENT_GROUP=Object.freeze({fire:'fire',lava:'fire',lightning:'fire',light:'fire',water:'water',ice:'water',storm:'water',steel:'water',leaf:'leaf',poison:'leaf',wind:'leaf',earth:'leaf',dark:'leaf'});
const ROLE_AFFINITY=Object.freeze({fire:new Set(['marksman','mage','fighter','assassin']),water:new Set(['tank','knight','healer','musician']),leaf:new Set(['enchanter','healer','musician','assassin'])});
const GAIN=Object.freeze({high:20,normal:14,low:8});
const st={patched:false,actions:0,rounds:0,chargeEvents:0,blockedRepeat:0,blockedExpansion:0,lastCore:null,lastAt:0};let raf=0;
function css(){if(document.getElementById(CSS_ID))return;const l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';l.href=CSS_HREF;document.head.appendChild(l)}
function econ(core){if(!core?.state)return null;const s=core.state;s.domainEconomyV2165=s.domainEconomyV2165||{round:1,seen:{player:[],enemy:[]},charge:{player:{},enemy:{}},lastGainRound:{player:{},enemy:{}},lastDomain:{player:'',enemy:''}};return s.domainEconomyV2165}
function sideState(core,side){return core?.state?.tamerBySide?.[side]||null}
function equipped(core,side){return String(sideState(core,side)?.equippedExpansion||econ(core)?.lastDomain?.[side]||'')}
function elementKey(u){return String(u?.element||u?.pow?.element||'').toLowerCase().trim().replace(/[\s_-]+/g,'')}
function compatibility(unit,domainId){const branch=BRANCH[domainId]||'';if(!branch)return{tier:'normal',scale:.7,gain:GAIN.normal};const e=elementKey(unit),group=ELEMENT_GROUP[e]||'';if(group===branch)return{tier:'high',scale:1,gain:GAIN.high};const role=String(unit?.combatRole||'');if(ROLE_AFFINITY[branch]?.has(role))return{tier:'normal',scale:.7,gain:GAIN.normal};return{tier:'low',scale:.4,gain:GAIN.low}}
function chargeOf(core,side,unitId){const e=econ(core);return Math.max(0,Math.min(100,Number(e?.charge?.[side]?.[unitId])||0))}
function setCharge(core,side,unitId,value){const e=econ(core);if(!e)return 0;e.charge[side][unitId]=Math.max(0,Math.min(100,Math.round(Number(value)||0)));return e.charge[side][unitId]}
function activeIds(core,side){try{return (core.living?.(side)||[]).filter(u=>!u?.isReserve&&!u?.defeated).map(u=>String(u.id))}catch(_){return[]}}
function roundComplete(core){const e=econ(core);if(!e)return false;for(const side of ['player','enemy']){const live=activeIds(core,side);if(live.some(id=>!e.seen[side].includes(id)))return false}return true}
function advanceRound(core,rawPush){const e=econ(core);if(!e)return;e.round++;e.seen={player:[],enemy:[]};st.rounds++;rawPush.call(core,'domain-round',{round:e.round,label:'VÒNG LÃNH ĐỊA',rule:'Mỗi Pow chỉ nhận charge tối đa 1 lần mỗi Vòng Lãnh Địa'});}
function onAction(core,evt,rawPush){if(!evt?.sourceId)return;const unit=core?.allRosterUnits?.find?.(u=>String(u.id)===String(evt.sourceId));if(!unit||unit.defeated||unit.isReserve)return;const side=unit.side==='enemy'?'enemy':'player',e=econ(core);if(!e)return;st.actions++;const uid=String(unit.id),domainId=equipped(core,side);e.lastDomain[side]=domainId||e.lastDomain[side]||'';
 if(e.seen[side].includes(uid)){st.blockedRepeat++;if(roundComplete(core))advanceRound(core,rawPush);return;}
 e.seen[side].push(uid);
 if(e.lastGainRound[side][uid]===e.round){st.blockedRepeat++;if(roundComplete(core))advanceRound(core,rawPush);return;}
 e.lastGainRound[side][uid]=e.round;
 const c=compatibility(unit,domainId),before=chargeOf(core,side,uid),after=setCharge(core,side,uid,before+c.gain);st.chargeEvents++;st.lastAt=Date.now();
 rawPush.call(core,'domain-charge',{side,unitId:uid,powId:unit.powId||null,domainId,round:e.round,before,after,delta:after-before,compatibility:c.tier,cap:100});
 if(after>=100&&before<100)rawPush.call(core,'domain-ready',{side,unitId:uid,powId:unit.powId||null,domainId,round:e.round,charge:100});
 if(roundComplete(core))advanceRound(core,rawPush);
}
function patchCore(){const C=window.POWDER_COMBAT_CORE_V7,P=C?.BattleCore?.prototype;if(!P||P.__domainTurnEconomy2165)return false;P.__domainTurnEconomy2165=true;const rawPush=P.pushEvent,rawCan=P.canExpandDomain,rawExpand=P.expandDomain;if(typeof rawPush!=='function'||typeof rawExpand!=='function')return false;
 P.pushEvent=function(type,data={}){const out=rawPush.call(this,type,data);if(type==='battle-start')econ(this);if(type==='action')onAction(this,{type,...data},rawPush);return out};
 P.domainCharge=function(side='player',unitId){return chargeOf(this,side==='enemy'?'enemy':'player',unitId)};
 P.domainCompatibility=function(unit,domainId){return compatibility(unit,domainId)};
 P.canExpandDomain=function(id){const base=typeof rawCan==='function'?rawCan.call(this,id):true,cur=this.state?.current;if(!base||!cur)return false;const side=cur.side==='enemy'?'enemy':'player';if(this.mode!=='pvp'&&!this.state?.domainPracticeMode)return false;const ok=chargeOf(this,side,cur.id)>=100;if(!ok)st.blockedExpansion++;return ok};
 P.expandDomain=function(id){const cur=this.state?.current;if(!cur||!this.canExpandDomain(id))return false;const side=cur.side==='enemy'?'enemy':'player',ok=rawExpand.call(this,id);if(ok){setCharge(this,side,cur.id,0);rawPush.call(this,'domain-charge-spent',{side,unitId:cur.id,powId:cur.powId||null,domainId:id,round:econ(this)?.round||1,before:100,after:0});}return ok};
 st.patched=true;return true;
}
function coreNow(){try{return window.POWDER_BATTLE_PLAYER_V177?.getCore?.()||st.lastCore||null}catch(_){return st.lastCore||null}}
function decorate(){raf=0;const core=coreNow(),mount=document.querySelector('.combat-v7-mount');if(!core||!mount)return;st.lastCore=core;const e=econ(core);for(const el of mount.querySelectorAll('.cv7-unit[data-cv7-unit]')){const id=el.dataset.cv7Unit,u=core?.allRosterUnits?.find?.(x=>String(x.id)===String(id));if(!u)continue;let meter=el.querySelector(':scope > .cfx2165-domain-charge');if(!meter){meter=document.createElement('div');meter.className='cfx2165-domain-charge';meter.innerHTML='<i><b></b></i><span></span>';el.appendChild(meter);}const side=u.side==='enemy'?'enemy':'player',v=chargeOf(core,side,u.id),dom=equipped(core,side),c=compatibility(u,dom);meter.className=`cfx2165-domain-charge ${c.tier} ${v>=100?'ready':''}`;meter.style.setProperty('--charge',String(v));meter.querySelector('i b').style.width=`${v}%`;meter.querySelector('span').textContent=`LĐ ${v}%`;meter.title=`Vòng Lãnh Địa ${e?.round||1} · Tương thích ${c.tier==='high'?'cao':c.tier==='normal'?'thường':'thấp'} · +${c.gain}% tối đa 1 lần/vòng`;}}
function schedule(){if(!raf)raf=requestAnimationFrame(decorate)}
['powder:rendered','powder:combat-state','powder:view-changed','powder:performance-director'].forEach(n=>window.addEventListener(n,schedule,{passive:true}));window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);raf=0},{once:true});
function snapshot(){const core=coreNow(),e=econ(core);return{version:VERSION,...st,round:e?.round||1,charge:e?.charge||null,gain:{high:20,normal:14,low:8},rules:['Pow nhanh vẫn được lợi thứ tự/nhịp Combat nhưng lặp hành động trong cùng Vòng Lãnh Địa không tăng thêm charge','Charge theo từng Pow, không phải thanh chung','Bành Trướng production chỉ cho PvP, Admin practice có thể bật domainPracticeMode','Đủ 100% mới được expandDomain'],performance:'event-driven pushEvent hook + rAF HUD; no polling/MutationObserver',gameplayMutation:true,damageFormulaMutation:false,skillDataMutation:false,serverMutation:false,audioMutation:false,scrollMutation:false}}
window.POWDER_COMBAT_DOMAIN_TURN_ECONOMY_V2165={version:VERSION,snapshot,chargeOf:(side,id)=>chargeOf(coreNow(),side,id),compatibility,refresh:schedule};css();patchCore();schedule();
})();