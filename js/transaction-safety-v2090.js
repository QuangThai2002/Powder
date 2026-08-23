(()=>{'use strict';
const VERSION='20.9.0',STORE='powder_tx_journal_v2090',MAX=120,PENDING_TTL=15*60*1000;
const active=new Map();let lastError='',reused=0,committed=0,blocked=0;
const rel=()=>window.POWDER_RELIABILITY_V2080;
const now=()=>Date.now();
const parse=(v,d)=>{try{return JSON.parse(v)||d}catch{return d}};
const load=()=>{const x=parse(localStorage.getItem(STORE),[]);return Array.isArray(x)?x:[]};
const save=x=>{try{localStorage.setItem(STORE,JSON.stringify((x||[]).slice(-MAX)))}catch(_){}};
function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}'}
function hash(v){let a=2166136261>>>0,b=0x9e3779b9>>>0;for(const ch of String(v)){const c=ch.charCodeAt(0);a^=c;a=Math.imul(a,16777619)>>>0;b^=(c+((b<<6)>>>0)+(b>>>2));b=Math.imul(b,2246822519)>>>0}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')}
function clean(v,n=48){return String(v??'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,n)||'op'}
function random(){return crypto.randomUUID?.().replace(/-/g,'')||Math.random().toString(36).slice(2)+Date.now().toString(36)}
function fingerprint(scope,operation,payload){return hash(`${scope}|${operation}|${stable(payload||{})}`)}
function keyOf(scope,operation,dedupeKey,fp,isStable){const p=`tx2090:${clean(scope,20)}:${clean(operation,34)}`;return isStable?`${p}:s:${hash(dedupeKey||fp)}`:`${p}:r:${random().slice(0,32)}`}
function uncertain(e){const m=String(e?.message||e||'');const s=Number(e?.status||0);return !s||s===408||s===425||s===429||s>=500||/failed to fetch|network|timeout|aborted|không kết nối|offline/i.test(m)}
function canWrite(scope){if(['economy','inventory','reward','purchase','mail','event'].includes(String(scope)))return rel()?.canEconomyWrite?.()!==false;return true}
function dispatch(type,detail){try{window.dispatchEvent(new CustomEvent(type,{detail}))}catch(_){}}
function prune(j){const t=now();return (j||[]).filter(x=>x.stable||x.status==='pending'||t-Number(x.updatedAt||x.createdAt||0)<24*60*60*1000).slice(-MAX)}
function findReusable(j,{scope,operation,dedupeKey,fp,stable:isStable}){if(isStable){return [...j].reverse().find(x=>x.stable&&x.scope===scope&&x.operation===operation&&x.dedupeKey===dedupeKey&&x.fingerprint===fp&&x.status!=='failed')||null}return [...j].reverse().find(x=>x.scope===scope&&x.operation===operation&&x.dedupeKey===dedupeKey&&x.fingerprint===fp&&x.status==='pending'&&now()-Number(x.updatedAt||0)<=PENDING_TTL)||null}
async function mutate({scope='economy',operation='mutation',payload={},dedupeKey='',stable:isStable=false,txKey='',send}={}){
 if(typeof send!=='function')throw new Error('TX 20.9: thiếu hàm gửi mutation.');
 scope=clean(scope,24);operation=clean(operation,48);dedupeKey=String(dedupeKey||operation).slice(0,180);
 if(!canWrite(scope)){blocked++;const e=new Error('Máy chủ đang khóa ghi tài nguyên để bảo vệ dữ liệu. Giao dịch chưa được thực hiện.');e.code='TX_2090_RELIABILITY_BLOCKED';lastError=e.message;dispatch('powder:transaction-blocked',{version:VERSION,scope,operation,reason:'reliability'});throw e}
 const fp=fingerprint(scope,operation,payload),journal=prune(load());let entry=findReusable(journal,{scope,operation,dedupeKey,fp,stable:isStable});
 if(entry&&entry.status==='committed'&&isStable){reused++;return{...(entry.result||{}),txKey:entry.txKey,idempotent:true,clientReceipt:true}}
 if(!entry){entry={txKey:txKey||keyOf(scope,operation,dedupeKey,fp,isStable),scope,operation,dedupeKey,fingerprint:fp,stable:!!isStable,status:'pending',attempts:0,createdAt:now(),updatedAt:now(),result:null};journal.push(entry);save(journal)}else reused++;
 if(active.has(entry.txKey))return active.get(entry.txKey);
 const work=(async()=>{entry.attempts=Number(entry.attempts||0)+1;entry.updatedAt=now();save(prune(journal));dispatch('powder:transaction-pending',{version:VERSION,...entry});
  try{const result=await send(entry.txKey);entry.status='committed';entry.result=result&&typeof result==='object'?result:{ok:true};entry.updatedAt=now();entry.committedAt=now();committed++;lastError='';save(prune(journal));dispatch('powder:transaction-committed',{version:VERSION,scope,operation,txKey:entry.txKey,idempotent:entry.attempts>1});return{...(result&&typeof result==='object'?result:{ok:true}),txKey:entry.txKey,clientReceipt:true,idempotent:entry.attempts>1};}
  catch(e){lastError=String(e?.message||e);entry.updatedAt=now();entry.lastError=lastError.slice(0,500);if(uncertain(e)){entry.status='pending';save(prune(journal));dispatch('powder:transaction-uncertain',{version:VERSION,scope,operation,txKey:entry.txKey,error:lastError});}else{entry.status='failed';save(prune(journal));dispatch('powder:transaction-failed',{version:VERSION,scope,operation,txKey:entry.txKey,error:lastError});}throw e}
  finally{active.delete(entry.txKey)}})();active.set(entry.txKey,work);return work;
}
function diagnostics(){const j=prune(load()),t=now();return{version:VERSION,pending:j.filter(x=>x.status==='pending').length,stalePending:j.filter(x=>x.status==='pending'&&t-Number(x.updatedAt||0)>PENDING_TTL).length,committed:j.filter(x=>x.status==='committed').length,failed:j.filter(x=>x.status==='failed').length,active:active.size,reused,committedThisSession:committed,blocked,lastError}}
function clearResolved(){const j=load().filter(x=>x.status==='pending'||x.stable&&x.status==='committed');save(prune(j));return diagnostics()}
function boot(){window.addEventListener('powder:reliability-mode',e=>{if(e.detail?.economyWritesAllowed!==false&&e.detail?.mode!=='emergency')dispatch('powder:transaction-retry-available',{version:VERSION,at:now()})},{passive:true})}
window.POWDER_TX_SAFETY_V2090=Object.freeze({version:VERSION,mutate,diagnostics,clearResolved,fingerprint});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
