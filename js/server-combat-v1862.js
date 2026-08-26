(()=>{'use strict';
const online=()=>window.POWDER_ONLINE_V150;
const runtime=()=>window.POWDER_COMBAT_RUNTIME_V21;
const RAGE_READY=4,RAGE_MAX=8;
const st={sessions:new Map(),lastError:'',actions:0,syncs:0,domainClashBegins:0,domainClashAnswers:0};
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
window.POWDER_SERVER_COMBAT_V1862=Object.freeze({version:'24.0-server-combat-rage-points',resourceSystem:'rage-points-v1',rageReady:RAGE_READY,rageMax:RAGE_MAX,hasAccount,isOnline,syncTeam,startEvent,startBoss,state,act,forfeit,domainClashBegin,domainClashAnswer,domainClashState,latestSessionId,cached,syncCore,rewardOf,skillSlot,eventId,maxEventId,eventsSince,canUse,bossPlayerReady:()=>false,bossAuthorityStatus:()=>({sessionFoundation:true,mechanicParity:false,qualificationAuthority:false,playerBridge:false,rewardFailClosed:true}),domainClashAuthorityStatus:()=>({clientProtocol:true,serverRequired:true,questionCount:10,questionMs:5000,clientSelfResolution:false}),diagnostics:()=>({sessions:st.sessions.size,actions:st.actions,syncs:st.syncs,domainClashBegins:st.domainClashBegins,domainClashAnswers:st.domainClashAnswers,lastError:st.lastError,bossPlayerReady:false,resourceSystem:'rage-points-v1'})});
})();