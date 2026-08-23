import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {decodeAdminClaimsV20160,hashAdminTokenV20160,enforceAdminAccessV20160} from '../server/supabase/functions/_shared/admin-security-v20160.ts';

const checks={};
const ok=(k,fn)=>{try{fn();checks[k]=true}catch(e){checks[k]=false;checks[k+'Error']=String(e?.message||e)}};
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=`${b64({alg:'none',typ:'JWT'})}.${b64({sub:'u1',iat:now-30,exp:now+1800,aal:'aal2'})}.sig`;
const claims=decodeAdminClaimsV20160(jwt);
ok('claimsDecode',()=>{assert.equal(claims.sub,'u1');assert.equal(claims.aal,'aal2');assert.equal(claims.iat,now-30)});
const h=await hashAdminTokenV20160(jwt);
ok('tokenSha256',()=>{assert.match(h,/^[0-9a-f]{64}$/);assert.equal(h,crypto.createHash('sha256').update(jwt).digest('hex'))});
let captured=null;
const db={rpc:async(name,args)=>{captured={name,args};return{data:{allowed:true,code:'OK'},error:null}}};
const req=new Request('https://admin.example.test/api',{headers:{Origin:'https://admin.example.test'}});
const pass=await enforceAdminAccessV20160({req,db,jwt,userId:'00000000-0000-0000-0000-000000000001',email:'owner@example.test',role:'owner',functionName:'powder-admin-official-launch',action:'activate_canary'});
ok('guardRpcWiring',()=>{assert.equal(pass.allowed,true);assert.equal(captured.name,'powder_security_admin_access_v20160');assert.equal(captured.args.p_origin,'https://admin.example.test');assert.equal(captured.args.p_aal,'aal2');assert.equal(captured.args.p_token_sha256,h);assert.equal(captured.args.p_token_iat,now-30);assert.equal(captured.args.p_token_exp,now+1800)});
const errDb={rpc:async()=>({data:null,error:{message:'db unavailable'}})};
let e1=null;try{await enforceAdminAccessV20160({req,db:errDb,jwt,userId:'u',email:'e',role:'owner',functionName:'powder-admin-security',action:'state'})}catch(e){e1=e}
ok('guardFailClosedUnavailable',()=>{assert.equal(e1?.status,503);assert.equal(e1?.code,'SEC20160_GUARD_UNAVAILABLE')});
for(const [name,code,status] of [['tokenDenied','SEC20160_SESSION_REVOKED',401],['originDenied','SEC20160_ORIGIN_DENIED',403],['aal2Denied','SEC20160_AAL2_REQUIRED',403]]){
  const denyDb={rpc:async()=>({data:{allowed:false,code},error:null})};let er=null;
  try{await enforceAdminAccessV20160({req,db:denyDb,jwt,userId:'u',email:'e',role:'owner',functionName:'powder-admin-official-launch',action:'activate_canary'})}catch(e){er=e}
  ok(name,()=>{assert.equal(er?.status,status);assert.equal(er?.code,code)});
}
const only=Object.fromEntries(Object.entries(checks).filter(([k])=>!k.endsWith('Error'))),passAll=Object.values(only).every(Boolean);
console.log(JSON.stringify({version:'20.16.0',checks:only,pass:passAll},null,2));
if(!passAll)process.exit(1);
