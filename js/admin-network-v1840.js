(()=>{'use strict';
const VERSION='18.7.1',rawFetch=window.fetch.bind(window),inflight=new Map(),SAFE=new Set(['state','status','summary','report','catalog','list','settings','get','load','preview','history','health','due']),TRANSIENT=new Set([408,425,429,500,502,503,504]);
const stats={started:0,joined:0,completed:0,failed:0,retried:0,offlineFastFail:0};
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function urlOf(input){try{return typeof input==='string'?input:input.url||String(input)}catch{return ''}}
function bodyOf(init){try{return typeof init?.body==='string'?JSON.parse(init.body):init?.body||{}}catch{return {}}}
function classify(input,init={}){const method=String(init.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase(),body=bodyOf(init),action=String(body?.action||'').toLowerCase();return{method,action,safe:['GET','HEAD','OPTIONS'].includes(method)||(method==='POST'&&SAFE.has(action))}}
function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}'}
function keyOf(input,init={}){const c=classify(input,init);return `${c.method}:${urlOf(input)}:${stable(bodyOf(init))}`}
function isSupabase(url){return /^https:\/\/[^/]+\.supabase\.co\//i.test(url)}
async function once(input,init={},timeoutMs=12000){
  const controller=new AbortController(),external=init.signal,relay=()=>controller.abort();if(external){if(external.aborted)relay();else external.addEventListener('abort',relay,{once:true})}
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await rawFetch(input,{...init,signal:controller.signal})}finally{clearTimeout(timer);if(external)external.removeEventListener('abort',relay)}
}
async function transport(input,init={}){
  const c=classify(input,init),retries=c.safe?2:0;let last;
  for(let attempt=0;attempt<=retries;attempt++){
    if(navigator.onLine===false){stats.offlineFastFail++;const e=new TypeError('Powder Admin đang ngoại tuyến.');e.code='OFFLINE';throw e}
    try{const r=await once(input,init,12000);if(!TRANSIENT.has(r.status)||attempt>=retries)return r;last=new Error(`HTTP ${r.status}`)}catch(e){last=e;if(attempt>=retries||(!c.safe)||e?.name==='AbortError'&&init.signal?.aborted)throw e}
    stats.retried++;await sleep(Math.min(1400,240*(2**attempt)+Math.floor(Math.random()*100)));
  }
  throw last||new Error('Admin network error');
}
window.fetch=function(input,init={}){
  const url=urlOf(input);if(!isSupabase(url))return rawFetch(input,init);
  const key=keyOf(input,init),prior=inflight.get(key);if(prior){stats.joined++;return prior.then(r=>r.clone())}
  stats.started++;const p=transport(input,init).then(r=>{stats.completed++;return r},e=>{stats.failed++;throw e}).finally(()=>inflight.delete(key));inflight.set(key,p);return p.then(r=>r.clone());
};
function activateAdminLearningEventControl2127(){if(typeof document!=='object'||window.POWDER_ADMIN_LEARNING_EVENT_CONTROL_V2127||document.getElementById('powderAdminLearningEventRuntime2127'))return false;const s=document.createElement('script');s.id='powderAdminLearningEventRuntime2127';s.src='js/admin-learning-event-control-v2127.js?v=2127';s.async=true;document.head.appendChild(s);return true}
window.POWDER_ADMIN_NETWORK_V1832={version:VERSION,stats:()=>({...stats,inflight:inflight.size,online:navigator.onLine!==false}),activateAdminLearningEventControl2127};window.POWDER_ADMIN_NETWORK_V1831=window.POWDER_ADMIN_NETWORK_V1832;window.POWDER_ADMIN_NETWORK_V1830=window.POWDER_ADMIN_NETWORK_V1832;window.POWDER_ADMIN_NETWORK_V1827=window.POWDER_ADMIN_NETWORK_V1832;
activateAdminLearningEventControl2127();
})();
