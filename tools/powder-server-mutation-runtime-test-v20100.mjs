import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
const root=path.resolve(process.argv[2]||process.cwd()),code=fs.readFileSync(path.join(root,'js/server-mutation-v20100.js'),'utf8');
let mode='prefer',session=true,requestImpl=async()=>({ok:true}),legacyCalls=0;const events=[];
class CustomEvent{constructor(type,opt={}){this.type=type;this.detail=opt.detail}}
const online={hasSession:()=>session,request:(...a)=>requestImpl(...a)};
const window={POWDER_CONFIG:{serverMutationGatewayV20100:{get mode(){return mode}}},POWDER_ONLINE_V150:online,dispatchEvent:e=>{events.push(e);return true}};
const context=vm.createContext({window,CustomEvent,Date,JSON,Object,String,Number,Array,RegExp,Promise,Error});vm.runInContext(code,context,{filename:'server-mutation-v20100.js'});
const api=window.POWDER_SERVER_MUTATION_V20100;if(!api)throw new Error('server mutation runtime missing');const checks={};
let seenBody=null;requestImpl=async(_p,o)=>{seenBody=JSON.parse(o.body);return{ok:true,atomic:true,idempotent:false,txKey:'tx:test:123456',handler:'public.real_handler',result:{coins:7}}};
const a=await api.mutate({scope:'economy',action:'buy_candy',txKey:'tx:test:123456',payload:{sku:'c1'},legacySend:async()=>{legacyCalls++;return{legacy:true}}});checks.atomicSuccessUnwrapped=a.coins===7&&a.__mutation20100?.atomic===true&&seenBody.txKey==='tx:test:123456'&&legacyCalls===0;
requestImpl=async()=>{throw new Error('MUTATION_20100_CONTRACT_NOT_READY')};const b=await api.mutate({scope:'economy',action:'buy_candy',txKey:'tx:test:abcdef',payload:{},legacySend:async()=>{legacyCalls++;return{legacy:true}}});checks.onlyContractNotReadyFallsBack=b.legacy===true&&legacyCalls===1&&events.some(e=>e.type==='powder:mutation-legacy-fallback');
let networkBlocked=false;requestImpl=async()=>{throw new Error('network timeout')};try{await api.mutate({scope:'reward',action:'claim_daily',txKey:'tx:test:network1',payload:{},legacySend:async()=>{legacyCalls++;return{legacy:true}}})}catch{networkBlocked=true}checks.uncertainNetworkNeverFallsBack=networkBlocked&&legacyCalls===1;
session=false;const c=await api.mutate({scope:'mail',action:'claim_mail',txKey:'tx:test:no-session',payload:{},legacySend:async()=>{legacyCalls++;return{noSession:true}}});checks.noSessionUsesLegacy=c.noSession===true&&legacyCalls===2;
session=true;mode='legacy';const d=await api.mutate({scope:'inventory',action:'item_lock',txKey:'tx:test:legacy',payload:{},legacySend:async()=>{legacyCalls++;return{forced:true}}});checks.explicitLegacyMode=d.forced===true&&legacyCalls===3;
const diag=api.diagnostics();checks.diagnostics=diag.gateway===1&&diag.legacyFallback===1&&diag.blocked===1;
const out={version:'20.10.0',checks,diagnostics:diag};out.pass=Object.values(checks).every(Boolean);console.log(JSON.stringify(out,null,2));if(!out.pass)process.exit(1);
