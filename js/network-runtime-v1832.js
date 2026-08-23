(()=>{'use strict';
const VERSION='18.7.1';
const inflight=new Map(),recentReads=new Map(),breakers=new Map();
const stats={joined:0,started:0,completed:0,failed:0,mutationsJoined:0,readsJoined:0,offlineFastFail:0,reconnects:0,readCacheHits:0,circuitFastFail:0,circuitOpened:0};
const READ_ACTIONS=new Set(['state','status','summary','report','catalog','list','settings','get','load','preview','history','replay','health','due']);
const READ_TTL=280,FAIL_WINDOW=12000,OPEN_MS=2200;
function clone(v){try{return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}catch{return v}}
function parseBody(opt){try{return typeof opt?.body==='string'?JSON.parse(opt.body):opt?.body||{}}catch{return {}}}
function classify(path,opt={}){const method=String(opt.method||'GET').toUpperCase(),body=parseBody(opt),action=String(body?.action||'').toLowerCase();const read=['GET','HEAD','OPTIONS'].includes(method)||(method==='POST'&&String(path).startsWith('/functions/v1/')&&READ_ACTIONS.has(action));return{method,action,read,mutation:!read}}
function stable(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stable).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}'}
function keyFor(path,opt={}){const kind=classify(path,opt),body=parseBody(opt);return `${kind.method}:${path}:${stable(body)}`}
function endpointKey(path,opt={}){const info=classify(path,opt);return `${path}:${info.action||info.method}`}
function transient(error){return error?.transient===true||['TIMEOUT','NETWORK','OFFLINE'].includes(String(error?.code||''))||[408,425,429,500,502,503,504].includes(Number(error?.status)||0)}
function openError(until){const e=new Error('Máy chủ Powder đang hồi phục sau lỗi mạng. Hãy thử lại sau ít giây.');e.code='CIRCUIT_OPEN';e.transient=true;e.retryAfter=Math.max(1,Math.ceil((until-Date.now())/1000));return e}
function onFailure(ep,error){if(!transient(error))return;const now=Date.now(),b=breakers.get(ep)||{fails:0,first:now,until:0};if(now-b.first>FAIL_WINDOW){b.fails=0;b.first=now}b.fails++;if(b.fails>=3){b.until=now+OPEN_MS;stats.circuitOpened++}breakers.set(ep,b)}
function onSuccess(ep){breakers.delete(ep)}
function clearReadCache(){recentReads.clear()}
function install(){
 const online=window.POWDER_ONLINE_V150;if(!online||online.__network1832||typeof online.request!=='function')return false;
 const original=online.request.bind(online);
 online.request=(path,opt={})=>{
  if(navigator.onLine===false){stats.offlineFastFail++;const e=new Error('Thiết bị đang ngoại tuyến. Yêu cầu Online chưa được gửi.');e.code='OFFLINE';e.transient=true;return Promise.reject(e)}
  const info=classify(path,opt),key=keyFor(path,opt),ep=endpointKey(path,opt),now=Date.now();
  if(info.read){const cached=recentReads.get(key);if(cached&&now-cached.at<=READ_TTL){stats.readCacheHits++;return Promise.resolve(clone(cached.value))}const br=breakers.get(ep);if(br?.until>now){stats.circuitFastFail++;return Promise.reject(openError(br.until))}}
  else clearReadCache();
  const prior=inflight.get(key);if(prior){stats.joined++;if(info.mutation)stats.mutationsJoined++;else stats.readsJoined++;return prior.then(clone)}
  stats.started++;
  const p=Promise.resolve().then(()=>original(path,opt)).then(value=>{stats.completed++;onSuccess(ep);if(info.read)recentReads.set(key,{at:Date.now(),value:clone(value)});return value},error=>{stats.failed++;onFailure(ep,error);throw error}).finally(()=>inflight.delete(key));
  inflight.set(key,p);return p.then(clone);
 };
 online.__network1832=true;online.__network1827=true;online.__network1823=true;
 const api={version:VERSION,stats:()=>({...stats,inflight:inflight.size,readCache:recentReads.size,breakers:[...breakers.values()].filter(x=>x.until>Date.now()).length,online:navigator.onLine!==false}),clear:()=>{inflight.clear();recentReads.clear();breakers.clear()},inflight:()=>inflight.size};
 window.POWDER_NETWORK_V1832=api;window.POWDER_NETWORK_V1827=api;window.POWDER_NETWORK_V1823=api;
 window.addEventListener('powder:network-reconnected',()=>{stats.reconnects++;recentReads.clear();breakers.clear()},{passive:true});
 window.addEventListener('offline',()=>recentReads.clear(),{passive:true});
 return true;
}
function boot(){if(install())return;let n=0;const retry=()=>{if(install()||++n>100)return;setTimeout(retry,40)};retry()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
