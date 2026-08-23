(()=>{'use strict';
const STORE='powder_secure_economy_queue_v152';
const st={last:null,busy:false,ready:false,syncPromise:null,lastSyncAt:0,syncJoined:0};
const online=()=>window.POWDER_ONLINE_V150;
const app=()=>window.POWDER_APP;
const txsafe=()=>window.POWDER_TX_SAFETY_V2090;
const gateway=()=>window.POWDER_SERVER_MUTATION_V20110;
const rel=()=>window.POWDER_RELIABILITY_V2080;
const READ=new Set(['state','bootstrap']);
const uid=()=>online()?.session?.()?.user?.id||'';
const tx=(prefix='tx')=>`${prefix}:${Date.now().toString(36)}:${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
const parse=(v,d)=>{try{return JSON.parse(v)||d}catch{return d}};
const loadQueue=()=>parse(localStorage.getItem(STORE),[]);
const saveQueue=q=>localStorage.setItem(STORE,JSON.stringify((q||[]).slice(-120)));
const hasAccount=()=>!!online()?.hasSession?.();
const isOnline=()=>hasAccount()&&navigator.onLine!==false&& !['offline','error'].includes(online()?.state?.().status||'');
function toast(text){let e=document.querySelector('#secureEconomyToastV152');if(!e){e=document.createElement('div');e.id='secureEconomyToastV152';e.className='secure-economy-toast-v152';document.body.appendChild(e)}e.textContent=text;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,2600)}
async function raw(action,payload={}){const o=online();if(!o?.hasSession?.())throw new Error('Chưa đăng nhập Powder Online.');if(navigator.onLine===false)throw new Error('Thiết bị đang ngoại tuyến.');if(!READ.has(action)&&rel()?.canEconomyWrite?.()===false)throw new Error('Economy đang tạm khóa ghi để bảo vệ dữ liệu.');try{return await o.request('/functions/v1/powder-economy',{method:'POST',body:JSON.stringify({action,...payload,clientVersion:'20.15.0'})})}catch(e){const m=String(e?.message||'');if(/Failed to fetch|không kết nối được máy chủ|NetworkError/i.test(m))throw new Error('Không kết nối được Economy Server. Hãy tải lại trang rồi thử lại.');throw e}}
async function syncState({save=true,force=false}={}){if(!hasAccount()||navigator.onLine===false)return null;if(st.syncPromise){st.syncJoined++;return st.syncPromise}if(!force&&st.last&&Date.now()-st.lastSyncAt<600)return st.last;st.syncPromise=(async()=>{const d=await raw('state');st.last=d;st.lastSyncAt=Date.now();st.ready=true;app()?.applySecureEconomyState?.(d,{save});window.dispatchEvent(new CustomEvent('powder:economy-state',{detail:d}));return d})();try{return await st.syncPromise}finally{st.syncPromise=null}}
function queue(action,payload={}){const q=loadQueue(),item={action,payload:{...payload,txKey:payload.txKey||tx(action)},at:Date.now()};q.push(item);saveQueue(q);return item}
async function flushQueue(){if(!hasAccount()||navigator.onLine===false||st.busy)return false;st.busy=true;try{const q=loadQueue();if(!q.length){await syncState({save:false});return true}let stop=-1;for(let i=0;i<q.length;i++){const item=q[i];try{const g=gateway();if(!g?.mutate)throw new Error('Canonical Mutation Gateway 20.14 chưa sẵn sàng.');const scope=item.action==='claim_daily'?'reward':'economy',txKey=item.payload?.txKey||tx(item.action),payload={...(item.payload||{})};delete payload.txKey;await g.mutate({scope,action:item.action,payload,txKey})}catch(e){console.warn('[Powder economy queue 20.14]',item.action,e);stop=i;break}}if(stop<0)saveQueue([]);else saveQueue(q.slice(stop));await syncState({save:true,force:true});await online()?.sync?.();return stop<0}finally{st.busy=false}}
async function run(action,payload={},opts={}){if(!hasAccount())return{local:true,ok:false,reason:'no-account'};const hinted=payload.txKey||'';if(navigator.onLine===false){const txKey=hinted||tx(action);if(opts.queue){queue(action,{...payload,txKey});return{ok:true,queued:true,txKey}}throw new Error('Tính năng này cần kết nối mạng để bảo vệ tài nguyên.')}const canonicalScope=action==='claim_daily'?'reward':'economy';const execute=async(txKey)=>{const g=gateway();if(!g?.mutate)throw new Error('Canonical Mutation Gateway 20.14 chưa sẵn sàng.');const d=await g.mutate({scope:canonicalScope,action,payload,txKey});await syncState({save:opts.save!==false,force:true});return{...d,txKey}};const T=txsafe();if(T?.mutate)return T.mutate({scope:canonicalScope,operation:action,payload,dedupeKey:opts.dedupeKey||`${action}:${JSON.stringify(payload)}`,stable:!!opts.stable,txKey:hinted,send:execute});return execute(hinted||tx(action))}
async function bootstrap(){if(!hasAccount()||navigator.onLine===false)return null;try{await raw('bootstrap');return await syncState({save:true,force:true})}catch(e){console.warn('[Powder economy bootstrap]',e);return null}}
const api={
 hasAccount,isOnline,state:()=>st.last,bootstrap,syncState,flushQueue,
 buyCandy:(count)=>run('buy_candy',{count}),
 consumeCandy:(count,candyType='common')=>run('consume_candy',{count,candyType}),
 feedCandy:(powId,count,candyType='common')=>run('feed_candy',{powId,count,candyType}),
 openPowBall:(ballId)=>run('open_powball',{ballId}),
 upgradePow:(powId,level)=>run('upgrade_pow',{powId,level}),
 claimDaily:(milestone,day)=>run('claim_daily',{milestone,day},{dedupeKey:`journey:${day}:${milestone}`,stable:true}),
 learningReward:()=>Promise.reject(new Error('Powder 17.7.2: Learning reward phải qua Secure Learning.')),
 chargeDailyBoss:()=>run('daily_boss_entry',{}),
 combatLearningExp:()=>Promise.reject(new Error('Powder 17.7.2: Combat EXP Online cần kết quả server-authoritative.')),
 battleReward:()=>Promise.reject(new Error('Powder 17.7.2: Battle reward Online đang khóa chống gian lận.')),
 fixedBattleReward:()=>Promise.reject(new Error('Powder 17.7.2: Reward do client tự khai đã bị vô hiệu hóa.')),
 bossReward:()=>Promise.reject(new Error('Powder 17.7.2: Boss reward Online cần bằng chứng chiến thắng từ server.')),
 toast,
 queueCount:()=>loadQueue().length,diagnostics:()=>({ready:st.ready,busy:st.busy,syncJoined:st.syncJoined,lastSyncAt:st.lastSyncAt,queue:loadQueue().length})
};
window.POWDER_SECURE_ECONOMY_V152=api;
let bootBound=false;function boot(tries=0){if(!bootBound){bootBound=true;window.addEventListener('online',()=>setTimeout(flushQueue,400));window.addEventListener('powder:online-login',()=>setTimeout(bootstrap,200))}if(window.POWDER_APP&&window.POWDER_ONLINE_V150){setTimeout(()=>{if(hasAccount()&&navigator.onLine!==false)bootstrap()},500);return}if(tries<100)setTimeout(()=>boot(tries+1),80)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
