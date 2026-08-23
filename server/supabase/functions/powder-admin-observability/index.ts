import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";
const VERSION='20.2.0';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Admin-Observability-Version':VERSION}});
const txt=(v:unknown,n=200)=>String(v??'').trim().slice(0,n);
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return out({error:'Method not allowed'},405);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');const {data:{user},error:ue}=await db.auth.getUser(jwt);if(ue||!user?.email)return out({error:'Phiên Admin không hợp lệ.'},401);
    const email=user.email.toLowerCase();const {data:allow}=await db.from('admin_allowlist').select('role,active').eq('email',email).maybeSingle();if(!allow?.active)return out({error:'Không có quyền Observability.'},403);const role=String(allow.role||'support');
    const body=await req.json().catch(()=>({})),action=String(body.action||'state'),channel=String(body.channel)==='staging'?'staging':'production',buildId=txt(body.buildId,140);
    const audit=async(name:string,details:any)=>db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,details:{version:VERSION,channel,buildId,...details}});
    async function state(){const [{data:cfg,error:ce},{data:health,error:he},{data:snaps,error:se},{data:rollout,error:re}]=await Promise.all([db.from('observability_config_v2020').select('*').eq('channel',channel).single(),db.rpc('powder_observability_health_v2020',{p_channel:channel,p_build:buildId,p_minutes:30}),db.from('observability_snapshots_v2020').select('*').eq('channel',channel).order('created_at',{ascending:false}).limit(20),db.from('release_rollout_v1950').select('*').eq('channel',channel).single()]);if(ce||he||se||re)throw ce||he||se||re;return{ok:true,edgeVersion:VERSION,role,channel,buildId,config:cfg,health,snapshots:snaps||[],rollout,serverTime:new Date().toISOString()}}
    await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-observability',action:action});
    if(action==='state')return out(await state());
    if(action==='set_config'){
      if(channel==='production'&&role!=='owner')return out({error:'Chỉ Owner được bật/tắt Production Observability.'},403);if(!['owner','admin'].includes(role))return out({error:'Không đủ quyền thay Observability config.'},403);
      const {data:old}=await db.from('observability_config_v2020').select('*').eq('channel',channel).single();const x=body.config&&typeof body.config==='object'?body.config:{},patch:any={updated_at:new Date().toISOString(),updated_by:email};
      if(typeof x.enabled==='boolean')patch.enabled=x.enabled;if(x.sampleRate!==undefined)patch.sample_rate=Math.max(0,Math.min(1,Number(x.sampleRate)));if(x.minRequests!==undefined)patch.min_requests=Math.max(20,Math.min(1000000,Math.trunc(Number(x.minRequests))));if(x.maxErrorRate!==undefined)patch.max_error_rate=Math.max(0,Math.min(1,Number(x.maxErrorRate)));if(x.maxP95Ms!==undefined)patch.max_p95_ms=Math.max(100,Math.min(120000,Math.trunc(Number(x.maxP95Ms))));if(x.maxP99Ms!==undefined)patch.max_p99_ms=Math.max(100,Math.min(120000,Math.trunc(Number(x.maxP99Ms))));if(x.maxCrashes!==undefined)patch.max_crashes=Math.max(0,Math.min(100000,Math.trunc(Number(x.maxCrashes))));if(x.maxSaveConflicts!==undefined)patch.max_save_conflicts=Math.max(0,Math.min(100000,Math.trunc(Number(x.maxSaveConflicts))));
      const {error}=await db.from('observability_config_v2020').update(patch).eq('channel',channel);if(error)throw error;await audit('observability2020_config',{before:old,patch});return out(await state());
    }
    if(action==='snapshot'){
      if(!['owner','admin'].includes(role))return out({error:'Không đủ quyền tạo snapshot.'},403);const kind=['baseline','checkpoint','rollback_before','rollback_after'].includes(String(body.kind))?String(body.kind):'checkpoint',label=txt(body.label,160);const {data:health,error:he}=await db.rpc('powder_observability_health_v2020',{p_channel:channel,p_build:buildId,p_minutes:30});if(he)throw he;const {data,error}=await db.from('observability_snapshots_v2020').insert({channel,build_id:buildId,label,kind,health,created_by:email}).select().single();if(error)throw error;await audit('observability2020_snapshot',{kind,label,snapshotId:data.id});return out({ok:true,snapshot:data,state:await state()});
    }
    if(action==='compare'){
      const {data:base,error:be}=await db.from('observability_snapshots_v2020').select('*').eq('channel',channel).eq('build_id',buildId).eq('kind','baseline').order('created_at',{ascending:false}).limit(1).maybeSingle();if(be)throw be;const {data:current,error:ce}=await db.rpc('powder_observability_health_v2020',{p_channel:channel,p_build:buildId,p_minutes:30});if(ce)throw ce;if(!base)return out({ok:true,baseline:null,current,comparison:null});const b=base.health||{},c=current||{},comparison={errorRateDelta:Number(c.errorRate||0)-Number(b.errorRate||0),p95DeltaMs:Number(c.p95Ms||0)-Number(b.p95Ms||0),p99DeltaMs:Number(c.p99Ms||0)-Number(b.p99Ms||0),crashDelta:Number(c.crashes||0)-Number(b.crashes||0),saveConflictDelta:Number(c.saveConflicts||0)-Number(b.saveConflicts||0),regressed:(Number(c.errorRate||0)>Number(b.errorRate||0)+0.005)||(Number(c.p95Ms||0)>Number(b.p95Ms||0)+300)||(Number(c.p99Ms||0)>Number(b.p99Ms||0)+500)||(Number(c.crashes||0)>Number(b.crashes||0))};return out({ok:true,baseline:base,current,comparison});
    }
    return out({error:'Observability action không tồn tại.'},400);
  }catch(e:any){console.error(e);return out({error:e?.message||'Admin Observability error'},Number(e?.status)||400)}
});
