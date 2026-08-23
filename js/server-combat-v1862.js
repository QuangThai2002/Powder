(()=>{'use strict';
const online=()=>window.POWDER_ONLINE_V150;
const st={sessions:new Map(),lastError:'',actions:0,syncs:0};
const hasAccount=()=>!!online()?.hasSession?.();
const isOnline=()=>hasAccount()&&navigator.onLine!==false&&!['offline','error'].includes(online()?.state?.().status||'');
async function raw(action,payload={}){const o=online();if(!o?.hasSession?.())throw new Error('Server Combat cần đăng nhập Powder Online.');if(navigator.onLine===false)throw new Error('Server Combat cần kết nối mạng.');try{return await o.request('/functions/v1/powder-combat-v1862',{method:'POST',body:JSON.stringify({action,...payload})})}catch(e){st.lastError=String(e?.message||e);throw e}}
function remember(d){const s=d?.state;if(s?.sessionId){st.sessions.set(String(s.sessionId),s);st.syncs++;}return s||null}
async function syncTeam(){window.POWDER_APP?.saveNow?.('server-combat-team-sync');const o=online();if(!o?.sync)throw new Error('Cloud Save chưa sẵn sàng cho Server Combat.');const ok=await o.sync();if(ok===false)throw new Error('Chưa đồng bộ được đội hình lên server. Hãy thử lại khi Cloud Save ổn định.');return true}
async function startEvent(eventId){await syncTeam();const d=await raw('start_event',{eventId});return remember(d)}
async function startBoss(kind){await syncTeam();const d=await raw('start_boss',{kind});return remember(d)}
async function state(sessionId){const d=await raw('state',{sessionId});return remember(d)}
function skillSlot(key){return key==='skill1'?'s1':key==='skill2'?'s2':key==='ultimate'||key==='exclusive'?'ult':'basic'}
async function act(sessionId,actorPowId,targetPowId,key){const d=await raw('act',{sessionId,actorPowId,targetPowId,skillSlot:skillSlot(key)});st.actions++;return remember(d)}
async function forfeit(sessionId){const d=await raw('forfeit',{sessionId});return remember(d)}
function cached(sessionId){return st.sessions.get(String(sessionId||''))||null}
function serverUnit(state,side,powId){return (state?.units||[]).find(x=>x.side===side&&String(x.powId)===String(powId))||null}
function syncCore(core,state,side='all'){if(!core||!state)return false;const all=[...(core.state?.team||[]),...(core.state?.reserves||[]),...(core.state?.enemies||[]),...(core.state?.enemyReserves||[])];let n=0;for(const u of all){if(side!=='all'&&u.side!==side)continue;const su=serverUnit(state,u.side,u.powId);if(!su)continue;u.maxHp=Math.max(1,Number(su.maxHp)||u.maxHp||1);u.hp=Math.max(0,Math.min(u.maxHp,Number(su.hp)||0));u.defeated=!!su.eliminated||u.hp<=0;u.shield=Math.max(0,Number(su.statuses?.shield)||0);const energy=Math.max(0,Math.min(100,Number(su.energy)||0));u.rage=energy;if(Number.isFinite(Number(u.maxMana)))u.mana=Math.min(Math.max(0,Number(u.maxMana)||100),energy);u.serverEnergy=energy;u.serverCooldowns={...(su.cooldowns||{})};const mapped={};for(const [k,v] of Object.entries(su.statuses||{})){if(k==='shield')continue;const turns=Math.max(0,Number(v)||0);if(turns)mapped[k]={turns,sourceId:null};}u.statuses=mapped;n++;}
 if(state.status&&state.status!=='active'){
   core.state.finished=true;core.state.phase='finished';core.state.result=state.status==='win'?'win':'loss';core.state.current=null;core.state.replacementQueue?.splice?.(0);core.state.enemyReplacementQueue?.splice?.(0);core.state.replacementSide=null;
 }else{
   // Server Combat owns reserve promotion. Mirror its active slots instead of opening a local replacement choice.
   const align=(side,mainKey,reserveKey)=>{
     const current=[...(core.state?.[mainKey]||[]),...(core.state?.[reserveKey]||[])];
     const byPow=new Map(current.map(u=>[String(u.powId),u]));
     const serverSide=(state.units||[]).filter(x=>x.side===side).sort((a,b)=>Number(a.slot)-Number(b.slot));
     const active=serverSide.filter(x=>x.active&&!x.eliminated).map(x=>byPow.get(String(x.powId))).filter(Boolean);
     const used=new Set(active.map(u=>u.id));
     const fillers=current.filter(u=>!used.has(u.id)&&u.defeated).slice(0,Math.max(0,3-active.length));
     const mains=[...active,...fillers].slice(0,3);const mainIds=new Set(mains.map(u=>u.id));
     const reserves=current.filter(u=>!mainIds.has(u.id)).slice(0,2);
     mains.forEach((u,i)=>{u.isReserve=false;u.teamIndex=i;});reserves.forEach(u=>{u.isReserve=true;u.meter=0;});
     core.state[mainKey]=mains;core.state[reserveKey]=reserves;
   };
   align('player','team','reserves');align('enemy','enemies','enemyReserves');
   core.state.finished=false;core.state.result=null;core.state.phase='running';core.state.current=null;core.state.replacementQueue?.splice?.(0);core.state.enemyReplacementQueue?.splice?.(0);core.state.replacementSide=null;
 }
 return n>0}
function eventId(e){return Math.max(0,Number(e?.id)||0)}
function maxEventId(state){return Math.max(0,...(state?.events||[]).map(eventId))}
function eventsSince(state,lastId=0){const n=Math.max(0,Number(lastId)||0);return (state?.events||[]).filter(e=>eventId(e)>n).sort((a,b)=>eventId(a)-eventId(b))}
function rewardOf(state){return state?.rewardResult&&typeof state.rewardResult==='object'?state.rewardResult:{}}
function canUse(state,powId,key){const u=(state?.units||[]).find(x=>x.side==='player'&&String(x.powId)===String(powId)&&x.active&&!x.eliminated);if(!u)return{ok:false,reason:'Pow không ở sân'};const slot=skillSlot(key),energy=Math.max(0,Number(u.energy)||0),cd=Math.max(0,Number(u.cooldowns?.[slot])||0),cost=slot==='ult'?100:slot==='s2'?30:slot==='s1'?20:0;if(cd>0)return{ok:false,reason:`Hồi ${cd} lượt`,energy,cooldown:cd,cost};if(energy<cost)return{ok:false,reason:`Cần ${cost} năng lượng`,energy,cooldown:0,cost};return{ok:true,energy,cooldown:0,cost}}
window.POWDER_SERVER_COMBAT_V1862=Object.freeze({version:'18.6.2-server-combat-authority',hasAccount,isOnline,syncTeam,startEvent,startBoss,state,act,forfeit,cached,syncCore,rewardOf,skillSlot,eventId,maxEventId,eventsSince,canUse,bossPlayerReady:()=>false,bossAuthorityStatus:()=>({sessionFoundation:true,mechanicParity:false,qualificationAuthority:false,playerBridge:false,rewardFailClosed:true}),diagnostics:()=>({sessions:st.sessions.size,actions:st.actions,syncs:st.syncs,lastError:st.lastError,bossPlayerReady:false})});
})();
