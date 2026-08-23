(()=>{'use strict';
const modules=new Map();
const LIMITS=Object.freeze({moduleEvents:160,securityAudit:96,securityChecksums:32,networkHistory:96,balanceRows:1200,metaRows:40});
function stable(value,depth=0){if(depth>7)return '"[depth]"';if(value===null||value===undefined)return JSON.stringify(value??null);if(typeof value==='number'||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);if(Array.isArray(value))return '['+value.slice(0,64).map(x=>stable(x,depth+1)).join(',')+']';if(value instanceof Map)return stable([...value.entries()],depth+1);if(typeof value==='object'){const keys=Object.keys(value).sort().slice(0,96);return '{'+keys.map(k=>JSON.stringify(k)+':'+stable(value[k],depth+1)).join(',')+'}';}return JSON.stringify(String(value));}
function hashText(text){let h=2166136261>>>0;for(let i=0;i<String(text).length;i++){h^=String(text).charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');}
function hash(value){return hashText(stable(value));}
function compactResourceMap(u){if(!(u?.resources instanceof Map))return[];return [...u.resources.entries()].slice(0,16).map(([id,r])=>[id,Number(r?.current)||0,Number(r?.max)||0]);}
function compactUnit(u){return{id:u?.id||'',powId:u?.powId||'',side:u?.side||'',hp:Math.round(Number(u?.hp)||0),maxHp:Math.round(Number(u?.maxHp)||0),shield:Math.round(Number(u?.shield)||0),mana:Math.round(Number(u?.mana)||0),maxMana:Math.round(Number(u?.maxMana)||0),rage:Math.round(Number(u?.rage)||0),meter:Math.round((Number(u?.meter)||0)*1000)/1000,defeated:Boolean(u?.defeated),statuses:Object.keys(u?.statuses||{}).sort(),custom:Object.keys(u?.customStatuses||{}).sort(),resources:compactResourceMap(u)};}
function compactCore(core){if(!core)return null;return{seed:Number(core.seed)||0,serial:Number(core.serial)||0,mode:core.mode||'',phase:core.state?.phase||'',round:Number(core.state?.round)||0,turn:Number(core.state?.turnCount)||0,currentId:core.state?.current?.id||null,result:core.state?.result||null,units:(core.allRosterUnits||core.allUnits||[]).slice(0,10).map(compactUnit)};}
function coreHash(core){return hash(compactCore(core));}
function register(name,api){if(!name||!api)return api;modules.set(String(name),api);return api;}
function get(name){return modules.get(String(name));}
function list(){return [...modules.keys()];}
async function batched(total,worker,{chunk=4,onProgress}={}){total=Math.max(0,Number(total)||0);chunk=Math.max(1,Number(chunk)||1);for(let i=0;i<total;i++){await worker(i);onProgress?.(i+1,total);if((i+1)%chunk===0)await new Promise(resolve=>(typeof requestAnimationFrame==='function'?requestAnimationFrame(()=>resolve()):setTimeout(resolve,0)));}}
const API={version:'21.9',LIMITS,stable,hashText,hash,compactUnit,compactCore,coreHash,register,get,list,batched};
window.POWDER_COMBAT_RUNTIME_V21=API;register('runtime',API);
})();