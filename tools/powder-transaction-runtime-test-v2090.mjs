import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
const root=path.resolve(process.argv[2]||process.cwd()),code=fs.readFileSync(path.join(root,'js/transaction-safety-v2090.js'),'utf8');
const mem=new Map(),events=[];let seq=0,write=true;
const localStorage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
class CustomEvent{constructor(type,opt={}){this.type=type;this.detail=opt.detail}}
const window={POWDER_RELIABILITY_V2080:{canEconomyWrite:()=>write},addEventListener(){},dispatchEvent:e=>{events.push(e);return true}};
const document={readyState:'complete',addEventListener(){}};
const context=vm.createContext({window,document,localStorage,CustomEvent,Date,Math,JSON,Map,Set,Promise,Error,String,Number,Array,Object,RegExp,crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`}});
vm.runInContext(code,context,{filename:'transaction-safety-v2090.js'});const tx=window.POWDER_TX_SAFETY_V2090;if(!tx)throw new Error('runtime not exported');
const checks={};
let stableCalls=0;const a=await tx.mutate({scope:'reward',operation:'claim_mail',payload:{id:'m1'},dedupeKey:'mail:m1',stable:true,send:async key=>{stableCalls++;return{ok:true,value:7,serverKey:key}}});const b=await tx.mutate({scope:'reward',operation:'claim_mail',payload:{id:'m1'},dedupeKey:'mail:m1',stable:true,send:async()=>{stableCalls++;return{ok:true,value:99}}});checks.stableClaimExecutesOnce=stableCalls===1&&a.txKey===b.txKey&&b.idempotent===true&&b.value===7;
let attempts=0,firstKey='',secondKey='';try{await tx.mutate({scope:'economy',operation:'purchase',payload:{sku:'x'},dedupeKey:'purchase:x',send:async key=>{attempts++;firstKey=key;const e=new Error('network timeout');e.status=0;throw e}})}catch{}const c=await tx.mutate({scope:'economy',operation:'purchase',payload:{sku:'x'},dedupeKey:'purchase:x',send:async key=>{attempts++;secondKey=key;return{ok:true}}});checks.uncertainRetryReusesKey=attempts===2&&firstKey===secondKey&&c.idempotent===true;
let thirdKey='';await tx.mutate({scope:'economy',operation:'purchase',payload:{sku:'x'},dedupeKey:'purchase:x',send:async key=>{thirdKey=key;return{ok:true}}});checks.completedPurchaseGetsNewKey=thirdKey!==secondKey;
write=false;let blockedSend=0,blocked=false;try{await tx.mutate({scope:'inventory',operation:'equip',payload:{id:1},dedupeKey:'equip:1',send:async()=>{blockedSend++;return{ok:true}}})}catch(e){blocked=e?.code==='TX_2090_RELIABILITY_BLOCKED'}checks.reliabilityFailClosed=blocked&&blockedSend===0;
checks.eventsEmitted=events.some(e=>e.type==='powder:transaction-uncertain')&&events.some(e=>e.type==='powder:transaction-committed')&&events.some(e=>e.type==='powder:transaction-blocked');
const out={version:'20.9.0',checks,diagnostics:tx.diagnostics()};out.pass=Object.values(checks).every(Boolean);console.log(JSON.stringify(out,null,2));if(!out.pass)process.exit(1);
