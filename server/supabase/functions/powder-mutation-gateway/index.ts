import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION='21.0.4';
const ADAPTER='20.11.0';
const RECON='20.12.0';
const ANTI='20.13.0';
const CAPACITY='21.0.4';
const ALLOWED_TARGETS=new Set(['powder-economy','powder-inventory','powder-liveops','powder-learning-events']);
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-powder-device, x-powder-version',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store'
};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Mutation-Version':VERSION}});
const clean=(v:unknown,n=180)=>String(v??'').trim().slice(0,n);
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.keys(v).sort().reduce((o:any,k)=>(o[k]=canonical(v[k]),o),{}):v;
const sha=async(v:unknown)=>{const b=new TextEncoder().encode(JSON.stringify(canonical(v)));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('')};

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const auth=req.headers.get('Authorization')||'',jwt=auth.replace(/^Bearer\s+/i,'');
    const {data:{user},error:ue}=await db.auth.getUser(jwt);
    if(ue||!user?.id)return out({error:'Phiên Powder Online không hợp lệ.',code:'MUTATION_20110_AUTH_REQUIRED'},401);
    const contentLength=Number(req.headers.get('content-length')||0);
    if(contentLength>16384)return out({error:'Payload vượt giới hạn Mutation Gateway.',code:'ABUSE_20130_BODY_TOO_LARGE'},413);
    const raw=await req.text();if(raw.length>16384)return out({error:'Payload vượt giới hạn Mutation Gateway.',code:'ABUSE_20130_BODY_TOO_LARGE'},413);
    let b:any={};try{b=raw?JSON.parse(raw):{}}catch{return out({error:'JSON không hợp lệ.',code:'ABUSE_20130_JSON_INVALID'},400);}
    const action=clean(b.action,80).toLowerCase();
    if(action==='capability'){
      const [{data:adapters,error:ae},{data:atomic,error:me},{data:anti,error:abe}]=await Promise.all([
        db.rpc('powder_mutation_adapter_posture_v20110'),
        db.rpc('powder_mutation_posture_v20100'),
        db.rpc('powder_mutation_abuse_posture_v20130')
      ]);
      if(ae)throw ae;
      return out({ok:true,version:VERSION,adapterVersion:ADAPTER,reconciliationVersion:RECON,antiAbuseVersion:ANTI,posture:adapters,atomicPosture:me?{ready:false,error:String(me.message||me)}:atomic,antiAbusePosture:abe?{ready:false,error:String(abe.message||abe)}:anti});
    }
    const scope=clean(b.scope,24).toLowerCase(),txKey=clean(b.txKey,180),payload=b.payload&&typeof b.payload==='object'&&!Array.isArray(b.payload)?b.payload:{};
    if(!scope||!action||!txKey)return out({error:'Thiếu scope/action/txKey.',code:'MUTATION_20110_REQUEST_INVALID'},400);

    const priority=['event','reward','mail','purchase'].includes(scope)?'low':scope==='support'?'critical':'normal';
    const {data:capacity,error:ce}=await db.rpc('powder_capacity_admit_v21004',{p_operation:`mutation:${scope}:${action}`,p_priority:priority});
    if(ce)throw ce;
    if(capacity?.allowed===false){const retry=Math.max(1,Number(capacity?.retryAfterSeconds||5));return new Response(JSON.stringify({error:'Máy chủ đang giảm tải có kiểm soát. Hãy thử lại sau.',code:String(capacity?.reason||'CAP21004_BACKPRESSURE'),capacityMode:String(capacity?.mode||'soft'),retryAfterSeconds:retry}),{status:503,headers:{...cors,'Retry-After':String(retry),'X-Powder-Capacity':CAPACITY}});}

    const {data:route,error:re}=await db.rpc('powder_mutation_adapter_route_v20110',{p_scope:scope,p_action:action});
    if(re)throw re;
    if(!route?.ok)return out({error:'Canonical adapter chưa được cấu hình cho thao tác này.',code:'MUTATION_20110_ROUTE_NOT_READY'},503);
    const requestHash=await sha({scope,action,payload});
    const {data:abuse,error:abe}=await db.rpc('powder_mutation_abuse_guard_v20130',{p_user:user.id,p_scope:scope,p_action:action,p_tx_key:txKey,p_payload:payload,p_request_sha256:requestHash});
    if(abe)throw abe;
    if(abuse?.allowed!==true){const code=String(abuse?.code||'ABUSE_20130_BLOCKED');const status=code==='ABUSE_20130_RATE_LIMIT'?429:code.includes('TX_KEY_REUSE')?409:422;return out({error:code==='ABUSE_20130_RATE_LIMIT'?'Bạn thao tác quá nhanh. Hãy thử lại sau.':'Yêu cầu đã bị Anti-Abuse 20.13 từ chối.',code,retryAfterSeconds:abuse?.retryAfterSeconds||0},status);}

    if(route.routeKind==='sql_atomic'){
      const {data,error}=await db.rpc('powder_mutation_execute_v20100',{p_user:user.id,p_scope:scope,p_action:action,p_tx_key:txKey,p_payload:payload});
      if(error){
        const m=String(error.message||error.details||error.code||'Mutation failed');
        if(/CONTRACT_NOT_READY|HANDLER_MISSING/i.test(m))return out({error:'SQL canonical handler chưa sẵn sàng.',code:'MUTATION_20110_SQL_HANDLER_NOT_READY'},503);
        if(/RELIABILITY_WRITE_BLOCKED/i.test(m))return out({error:'Máy chủ đang khóa ghi để bảo vệ dữ liệu.',code:'MUTATION_20110_RELIABILITY_BLOCKED'},423);
        if(/KEY_REUSE_MISMATCH|EXECUTOR_CONFLICT|LEGACY_RECEIPT/i.test(m))return out({error:m,code:'MUTATION_20110_INTEGRITY_CONFLICT'},409);
        throw error;
      }
      if(data?.ok===false)return out(data,422);
      return out({...data,canonicalAdapterVersion:ADAPTER,antiAbuseVersion:ANTI,capacityVersion:CAPACITY,antiAbuseVerified:!!abuse?.adapterEvidenceVerified,routeKind:'sql_atomic'});
    }

    if(route.routeKind!=='legacy_edge_bridge'||!ALLOWED_TARGETS.has(String(route.targetEdge||'')))return out({error:'Canonical route bị từ chối bởi allowlist.',code:'MUTATION_20110_ROUTE_DENIED'},503);
    const {data:begin,error:be}=await db.rpc('powder_mutation_adapter_begin_v20110',{p_user:user.id,p_scope:scope,p_action:action,p_tx_key:txKey,p_request_sha256:requestHash});
    if(be){
      const m=String(be.message||be.details||be.code||'Adapter begin failed');
      if(/RELIABILITY_WRITE_BLOCKED/i.test(m))return out({error:'Máy chủ đang khóa ghi để bảo vệ dữ liệu.',code:'MUTATION_20110_RELIABILITY_BLOCKED'},423);
      if(/KEY_REUSE_MISMATCH/i.test(m))return out({error:'txKey đã được dùng cho payload khác.',code:'MUTATION_20110_INTEGRITY_CONFLICT'},409);
      throw be;
    }
    if(begin?.state==='replay')return out({ok:true,canonical:true,idempotent:true,routeKind:'legacy_edge_bridge',txKey,result:begin.result,antiAbuseVersion:ANTI,capacityVersion:CAPACITY,antiAbuseVerified:!!abuse?.adapterEvidenceVerified});
    if(begin?.state!=='dispatch')return out({error:begin?.message||'Transaction đang cần reconciliation trước khi retry.',code:begin?.code||'MUTATION_20110_AMBIGUOUS_TX',status:begin?.status||'unknown'},409);

    const target=String(begin.targetEdge||route.targetEdge),legacyAction=String(begin.legacyAction||route.legacyAction||action);
    if(!ALLOWED_TARGETS.has(target))return out({error:'Adapter target không nằm trong allowlist.',code:'MUTATION_20110_TARGET_DENIED'},503);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const rr=await fetch(`${url}/functions/v1/${target}`,{
        method:'POST',signal:controller.signal,
        headers:{apikey:serviceKey,Authorization:auth,'Content-Type':'application/json','X-Powder-Mutation-Gateway':VERSION,'X-Powder-Anti-Abuse':ANTI,'X-Powder-Capacity':CAPACITY,'X-Powder-Tx-Key':txKey,'X-Powder-Reconciliation':RECON,'X-Powder-Request-SHA256':requestHash},
        body:JSON.stringify({action:legacyAction,...payload,txKey,clientVersion:VERSION,canonicalAdapter:ADAPTER,reconciliationVersion:RECON,antiAbuseVersion:ANTI,canonicalRequestSha256:requestHash})
      });
      const text=await rr.text();let result:any={};try{result=text?JSON.parse(text):{}}catch{result={error:text||`HTTP ${rr.status}`}};
      if(!rr.ok){
        await db.rpc('powder_mutation_adapter_finish_v20110',{p_user:user.id,p_scope:scope,p_tx_key:txKey,p_status:'failed',p_http_status:rr.status,p_result:null,p_result_sha256:'',p_error_code:String(result?.code||`HTTP_${rr.status}`),p_error_message:String(result?.error||result?.message||text||`HTTP ${rr.status}`)});
        return out({error:String(result?.error||result?.message||`Adapter target HTTP ${rr.status}`),code:'MUTATION_20110_TARGET_REJECTED',targetStatus:rr.status},rr.status===401||rr.status===403?rr.status:422);
      }
      const resultHash=await sha(result);
      const {error:fe}=await db.rpc('powder_mutation_adapter_finish_v20110',{p_user:user.id,p_scope:scope,p_tx_key:txKey,p_status:'succeeded',p_http_status:rr.status,p_result:result,p_result_sha256:resultHash,p_error_code:'',p_error_message:''});
      if(fe)throw fe;
      return out({ok:true,canonical:true,idempotent:false,routeKind:'legacy_edge_bridge',txKey,result,adapterVerified:!!begin.verified,antiAbuseVersion:ANTI,capacityVersion:CAPACITY,antiAbuseVerified:!!abuse?.adapterEvidenceVerified});
    }catch(e:any){
      const msg=String(e?.name==='AbortError'?'Adapter target timeout':e?.message||e);
      await db.rpc('powder_mutation_adapter_finish_v20110',{p_user:user.id,p_scope:scope,p_tx_key:txKey,p_status:'unknown',p_http_status:null,p_result:null,p_result_sha256:'',p_error_code:e?.name==='AbortError'?'TARGET_TIMEOUT':'TARGET_NETWORK_UNKNOWN',p_error_message:msg}).catch(()=>{});
      return out({error:'Kết quả transaction chưa xác định; hệ thống đã khóa retry tự động để tránh cấp/trừ tài nguyên hai lần.',code:'MUTATION_20110_RESULT_UNKNOWN'},409);
    }finally{clearTimeout(timer)}
  }catch(e:any){
    console.error('[powder-mutation-gateway 20.13]',e);
    return out({error:String(e?.message||e),code:'MUTATION_20110_SERVER_ERROR'},500);
  }
});
