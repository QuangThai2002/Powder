(()=>{'use strict';
const online=()=>window.POWDER_ONLINE_V150;
const runtime=()=>window.POWDER_COMBAT_RUNTIME_V21;
const RAGE_READY=4,RAGE_MAX=8;
const st={sessions:new Map(),lastError:'',actions:0,syncs:0,domainClashBegins:0,domainClashAnswers:0};
const pvpCompat={installed:false,me:'',opponent:'',points:new Map(),observer:null,patchQueued:false,responses:0};
const hasAccount=()=>!!online()?.hasSession?.();
const isOnline=()=>hasAccount()&&navigator.onLine!==false&&!['offline','error'].includes(online()?.state?.().status||'');
const ragePointsOf=u=>Math.min(RAGE_MAX,Math.max(0,Math.floor(Number(u?.ragePoints??u?.energy)||0)));
async function raw(action,payload={}){const o=online();if(!o?.hasSession?.())throw new Error('Server Combat cần đăng nhập Powder Online.');if(navigator.onLine===false)throw new Error('Server Combat cần kết nối mạng.');try{return await o.request('/functions/v1/powder-combat-v1862',{method:'POST',body:JSON.stringify({action,...payload})})}catch(e){st.lastError=String(e?.message||e);throw e}}
function remember(d){const s=d?.state;if(s?.sessionId){st.sessions.set(String(s.sessionId),s);st.syncs++;}return s||null}
function latestSessionId(){const keys=[...st.sessions.keys()];return keys.length?keys[keys.length-1]:''}
async function syncTeam(){window.POWDER_APP?.saveNow?.('server-combat-team-sync');const o=online();if(!o?.sync)throw new Error('Cloud Save chưa sẵn sàng cho Server Combat.');const ok=await o.sync();if(ok===false)throw new Error('Chưa đồng bộ được đội hình lên server. Hãy thử lại khi Cloud Save ổn định.');return true}
async function startEvent(eventId){await syncTeam();const d=await raw('start_event',{eventId});return remember(d)}
async function startBoss(kind){await syncTeam();const d=await raw('start_boss',{kind});return remember(d)}
async function state(sessionId){const d=await raw('state',{sessionId});return remember(d)}
function skillSlot(key){return key==='skill1'?'s1':key==='skill2'?'s2':key==='ultimate'||key==='exclusive'?'ult':'basic'}
async function act(sessionId,actorPowId,targetPowId,key){const d=await raw('act',{sessionId,actorPowId,targetPowId,skillSlot:skillSlot(key)});st.actions++;return remember(d)}
async function forfeit(sessionId){const d=await raw('forfeit',{sessionId});return remember(d)}
async function domainClashBegin(payload={}){const sessionId=String(payload.sessionId||latestSessionId()||'');if(!sessionId)throw new Error('Domain Clash cần Server Combat sessionId.');const d=await raw('domain_clash_begin',{...payload,sessionId,questionCount:10,questionMs:5000});st.domainClashBegins++;return d}
async function domainClashAnswer(payload={}){const sessionId=String(payload.sessionId||latestSessionId()||'');if(!sessionId)throw new Error('Domain Clash cần Server Combat sessionId.');const d=await raw('domain_clash_answer',{...payload,sessionId});st.domainClashAnswers++;return d}
async function domainClashState(payload={}){const sessionId=String(payload.sessionId||latestSessionId()||'');if(!sessionId)throw new Error('Domain Clash cần Server Combat sessionId.');return raw('domain_clash_state',{...payload,sessionId})}
function cached(sessionId){return st.sessions.get(String(sessionId||''))||null}
function serverUnit(state,side,powId){return (state?.units||[]).find(x=>x.side===side&&String(x.powId)===String(powId))||null}
function syncCore(core,state,side='all'){
 if(!core||!state)return false;
 const all=[...(core.state?.team||[]),...(core.state?.reserves||[]),...(core.state?.enemies||[]),...(core.state?.enemyReserves||[])];let n=0;
 for(const u of all){
   if(side!=='all'&&u.side!==side)continue;const su=serverUnit(state,u.side,u.powId);if(!su)continue;
   u.maxHp=Math.max(1,Number(su.maxHp)||u.maxHp||1);u.hp=Math.max(0,Math.min(u.maxHp,Number(su.hp)||0));u.defeated=!!su.eliminated||u.hp<=0;u.shield=Math.max(0,Number(su.statuses?.shield)||0);
   u.ragePoints=ragePointsOf(su);u.serverEnergy=u.ragePoints;u.mana=0;u.maxMana=0;runtime()?.syncLegacyRageUnit?.(u);
   u.serverCooldowns={...(su.cooldowns||{})};const mapped={};for(const [k,v] of Object.entries(su.statuses||{})){if(k==='shield')continue;const turns=Math.max(0,Number(v)||0);if(turns)mapped[k]={turns,sourceId:null};}u.statuses=mapped;n++;
 }
 if(state.status&&state.status!=='active'){
   core.state.finished=true;core.state.phase='finished';core.state.result=state.status==='win'?'win':'loss';core.state.current=null;core.state.replacementQueue?.splice?.(0);core.state.enemyReplacementQueue?.splice?.(0);core.state.replacementSide=null;
 }else{
   const align=(side,mainKey,reserveKey)=>{const current=[...(core.state?.[mainKey]||[]),...(core.state?.[reserveKey]||[])];const byPow=new Map(current.map(u=>[String(u.powId),u]));const serverSide=(state.units||[]).filter(x=>x.side===side).sort((a,b)=>Number(a.slot)-Number(b.slot));const active=serverSide.filter(x=>x.active&&!x.eliminated).map(x=>byPow.get(String(x.powId))).filter(Boolean);const used=new Set(active.map(u=>u.id));const fillers=current.filter(u=>!used.has(u.id)&&u.defeated).slice(0,Math.max(0,3-active.length));const mains=[...active,...fillers].slice(0,3);const mainIds=new Set(mains.map(u=>u.id));const reserves=current.filter(u=>!mainIds.has(u.id)).slice(0,2);mains.forEach((u,i)=>{u.isReserve=false;u.teamIndex=i;});reserves.forEach(u=>{u.isReserve=true;u.meter=0;});core.state[mainKey]=mains;core.state[reserveKey]=reserves;};
   align('player','team','reserves');align('enemy','enemies','enemyReserves');core.state.finished=false;core.state.result=null;core.state.phase='running';core.state.current=null;core.state.replacementQueue?.splice?.(0);core.state.enemyReplacementQueue?.splice?.(0);core.state.replacementSide=null;
 }
 return n>0;
}
function eventId(e){return Math.max(0,Number(e?.id)||0)}
function maxEventId(state){return Math.max(0,...(state?.events||[]).map(eventId))}
function eventsSince(state,lastId=0){const n=Math.max(0,Number(lastId)||0);return (state?.events||[]).filter(e=>eventId(e)>n).sort((a,b)=>eventId(a)-eventId(b))}
function rewardOf(state){return state?.rewardResult&&typeof state.rewardResult==='object'?state.rewardResult:{}}
function canUse(state,powId,key){
 const u=(state?.units||[]).find(x=>x.side==='player'&&String(x.powId)===String(powId)&&x.active&&!x.eliminated);if(!u)return{ok:false,reason:'Pow không ở sân'};
 const slot=skillSlot(key),ragePoints=ragePointsOf(u),cd=Math.max(0,Number(u.cooldowns?.[slot])||0),cost=slot==='ult'?RAGE_READY:0;
 if(cd>0)return{ok:false,reason:`Hồi ${cd} lượt`,ragePoints,cooldown:cd,cost,resourceSystem:'rage-points-v1'};
 if(ragePoints<cost)return{ok:false,reason:`Cần ${cost} Nộ`,ragePoints,cooldown:0,cost,resourceSystem:'rage-points-v1'};
 return{ok:true,ragePoints,cooldown:0,cost,resourceSystem:'rage-points-v1'};
}

function pvpPointKey(userId,powId){return `${String(userId||'')}::${String(powId||'')}`}
function rememberPvpRow(row){if(!row)return;const points=ragePointsOf(row);row.ragePoints=points;pvpCompat.points.set(pvpPointKey(row.user_id,row.pow_id),points);row.energy=points>=RAGE_READY?100:99;}
function transformPvpPayload(payload){
 const match=payload?.state?.match;if(match){pvpCompat.me=String(match.me||'');pvpCompat.opponent=String((match.players||[]).find(p=>String(p?.id)!==pvpCompat.me)?.id||'');for(const row of match.pows||[])rememberPvpRow(row);}
 const replay=payload?.replay;if(replay){for(const row of replay.pows||[])rememberPvpRow(row);}
 pvpCompat.responses++;schedulePvpPatch();return payload;
}
function installPvpRequestBridge(){
 const o=online();if(!o?.request||o.__powderRagePointsV240)return false;
 const original=o.request.bind(o);
 o.request=async(path,opt={})=>{const result=await original(path,opt);return String(path||'').includes('/functions/v1/powder-pvp')?transformPvpPayload(result):result;};
 try{Object.defineProperty(o,'__powderRagePointsV240',{value:true,configurable:false,enumerable:false});}catch(_){o.__powderRagePointsV240=true;}
 pvpCompat.installed=true;return true;
}
function pvpMarkerStates(points){const fn=runtime()?.rageMarkerStates;if(typeof fn==='function')return fn(points);const p=ragePointsOf({ragePoints:points}),red=Math.max(0,p-RAGE_READY),blue=Math.max(0,p-red*2),empty=Math.max(0,4-blue-red);return[...Array(blue).fill('blue'),...Array(red).fill('red'),...Array(empty).fill('empty')].slice(0,4);}
function ensurePvpRageStyle(){
 if(typeof document==='undefined'||document.getElementById('powder-pvp-rage-v240-style'))return;
 const style=document.createElement('style');style.id='powder-pvp-rage-v240-style';style.textContent=`
 #pvpOnline1870 .pvp240-rage{display:flex;gap:4px;align-items:center;margin-top:4px;min-height:9px}
 #pvpOnline1870 .pvp240-rage i{display:block;width:8px;height:8px;border-radius:50%;border:1px solid rgba(225,237,244,.35);background:rgba(58,72,84,.5);box-sizing:border-box}
 #pvpOnline1870 .pvp240-rage i.blue{background:#52c8ff;border-color:#a6e8ff;box-shadow:0 0 6px rgba(82,200,255,.5)}
 #pvpOnline1870 .pvp240-rage i.red{background:#ff5f67;border-color:#ffc0c3;box-shadow:0 0 7px rgba(255,95,103,.56)}
 #pvpOnline1870 .pvp1870-skills [data-pvp-skill] span{font-weight:800;letter-spacing:.02em}
 `;document.head?.appendChild(style);
}
function pvpPointsForButton(button){const powId=button?.dataset?.pvpActor||button?.dataset?.pvpTarget||'';const userId=button?.dataset?.pvpActor?pvpCompat.me:pvpCompat.opponent;return pvpCompat.points.get(pvpPointKey(userId,powId));}
function patchPvpUnit(button){
 const points=pvpPointsForButton(button);if(!Number.isFinite(Number(points)))return;
 const copy=button.querySelector('.pvp1870-unit-copy');if(!copy)return;
 for(const small of copy.querySelectorAll('small')){if(/HP\s*·\s*⚡/i.test(small.textContent||''))small.textContent=String(small.textContent||'').replace(/⚡\s*\d+/i,`NỘ ${points}`);}
 const hp=copy.querySelector('.pvp1870-hp');if(!hp)return;let markers=copy.querySelector('.pvp240-rage');if(!markers){markers=document.createElement('span');markers.className='pvp240-rage';hp.insertAdjacentElement('afterend',markers);}
 const states=pvpMarkerStates(points),sig=states.join('|');if(markers.dataset.sig!==sig){markers.dataset.sig=sig;markers.title=`Nộ ${points}`;markers.innerHTML=states.map(state=>`<i class="${state}"></i>`).join('');}
}
function patchPvpSkills(root){
 for(const button of root.querySelectorAll('[data-pvp-skill]')){const key=button.dataset.pvpSkill||'basic',span=button.querySelector('span');if(!span||/^CD\s/i.test(span.textContent||''))continue;span.textContent=key==='ult'?`TỐN ${RAGE_READY} NỘ`:'+2 NỘ';}
 const head=root.querySelector('.pvp1870-battle-head .eyebrow');if(head&&/PVP ONLINE 2\.0/i.test(head.textContent||''))head.textContent=String(head.textContent).replace('PVP ONLINE 2.0','PVP ONLINE 2.4 · NỘ 4 ĐIỂM');
}
function patchPvpUi(){pvpCompat.patchQueued=false;if(typeof document==='undefined')return;const root=document.querySelector('#pvpOnline1870');if(!root)return;ensurePvpRageStyle();for(const button of root.querySelectorAll('[data-pvp-actor],[data-pvp-target]'))patchPvpUnit(button);patchPvpSkills(root);}
function schedulePvpPatch(){if(pvpCompat.patchQueued||typeof document==='undefined')return;pvpCompat.patchQueued=true;(typeof requestAnimationFrame==='function'?requestAnimationFrame:setTimeout)(patchPvpUi);}
function startPvpUiBridge(){
 if(typeof document==='undefined')return;ensurePvpRageStyle();const start=()=>{installPvpRequestBridge();try{pvpCompat.observer=new MutationObserver(schedulePvpPatch);pvpCompat.observer.observe(document.documentElement,{childList:true,subtree:true});}catch(_){/* observer unavailable */}schedulePvpPatch();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}

startPvpUiBridge();
window.POWDER_SERVER_COMBAT_V1862=Object.freeze({version:'24.0-server-combat-rage-points',resourceSystem:'rage-points-v1',rageReady:RAGE_READY,rageMax:RAGE_MAX,hasAccount,isOnline,syncTeam,startEvent,startBoss,state,act,forfeit,domainClashBegin,domainClashAnswer,domainClashState,latestSessionId,cached,syncCore,rewardOf,skillSlot,eventId,maxEventId,eventsSince,canUse,bossPlayerReady:()=>false,bossAuthorityStatus:()=>({sessionFoundation:true,mechanicParity:false,qualificationAuthority:false,playerBridge:false,rewardFailClosed:true}),domainClashAuthorityStatus:()=>({clientProtocol:true,serverRequired:true,questionCount:10,questionMs:5000,clientSelfResolution:false}),diagnostics:()=>({sessions:st.sessions.size,actions:st.actions,syncs:st.syncs,domainClashBegins:st.domainClashBegins,domainClashAnswers:st.domainClashAnswers,lastError:st.lastError,bossPlayerReady:false,resourceSystem:'rage-points-v1',pvpCompatInstalled:pvpCompat.installed,pvpCompatResponses:pvpCompat.responses})});
})();