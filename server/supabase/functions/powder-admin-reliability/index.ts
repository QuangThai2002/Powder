import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";
const VERSION='20.8.0',BUILD='powder-20.9.0-data-integrity-transaction-safety';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Reliability-Version':VERSION}});
const txt=(v:unknown,n=800)=>String(v??'').trim().slice(0,n);
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:ue}=await db.auth.getUser(jwt);if(ue||!user?.email)return out({error:'Phiên Admin không hợp lệ.'},401);
    const email=user.email.toLowerCase();const {data:allow}=await db.from('admin_allowlist').select('role,active').eq('email',email).maybeSingle();
    if(!allow?.active)return out({error:'Không có quyền Reliability.'},403);const role=String(allow.role||'support');
    const body=await req.json().catch(()=>({})),action=String(body.action||'state'),channel=String(body.channel)==='staging'?'staging':'production',buildId=txt(body.buildId||BUILD,160);
    const need=(roles:string[])=>{if(!roles.includes(role))throw Object.assign(new Error('Không đủ quyền Reliability mutation.'),{status:403})};
    const owner=()=>need(['owner']);
    const audit=async(name:string,details:any)=>db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,details:{version:VERSION,channel,buildId,...details}});
    async function state(){
      const [{data:snap,error:se},{data:cfg,error:ce},{data:st,error:te},{data:events,error:ee}]=await Promise.all([
        db.rpc('powder_reliability_snapshot_v2080',{p_channel:channel,p_build:buildId}),
        db.from('reliability_config_v2080').select('*').eq('channel',channel).single(),
        db.from('reliability_state_v2080').select('*').eq('channel',channel).single(),
        db.from('reliability_events_v2080').select('*').eq('channel',channel).order('created_at',{ascending:false}).limit(40)
      ]);if(se||ce||te||ee)throw se||ce||te||ee;
      return{ok:true,edgeVersion:VERSION,role,channel,buildId,snapshot:snap,config:cfg,state:st,events:events||[],serverTime:new Date().toISOString()};
    }
    await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-reliability',action:action});
    if(action==='state')return out(await state());
    if(action==='watchdog'){
      need(['owner','admin']);const {data,error}=await db.rpc('powder_reliability_watchdog_v2080',{p_channel:channel,p_build:buildId,p_actor:email});if(error)throw error;
      await audit('reliability2080_watchdog',{result:{mode:data?.mode,circuitState:data?.circuitState,reason:data?.reason}});return out({ok:true,result:data,state:await state()});
    }
    if(action==='set_config'){
      owner();const x=body.config&&typeof body.config==='object'?body.config:{};const patch:any={updated_at:new Date().toISOString(),updated_by:email};
      if(typeof x.enabled==='boolean')patch.enabled=x.enabled;if(typeof x.automationArmed==='boolean')patch.automation_armed=x.automationArmed;
      if(x.windowMinutes!==undefined)patch.watchdog_window_minutes=Math.max(5,Math.min(120,Math.trunc(Number(x.windowMinutes)||10)));
      if(x.badChecks!==undefined)patch.bad_checks_to_degrade=Math.max(1,Math.min(10,Math.trunc(Number(x.badChecks)||2)));
      if(x.goodChecks!==undefined)patch.good_checks_to_recover=Math.max(1,Math.min(20,Math.trunc(Number(x.goodChecks)||3)));
      if(x.cooldownMinutes!==undefined)patch.recovery_cooldown_minutes=Math.max(1,Math.min(240,Math.trunc(Number(x.cooldownMinutes)||15)));
      if(typeof x.blockCloudSave==='boolean')patch.block_cloud_save_on_critical=x.blockCloudSave;if(typeof x.blockEconomy==='boolean')patch.block_economy_on_critical=x.blockEconomy;
      const before=(await db.from('reliability_config_v2080').select('*').eq('channel',channel).single()).data;
      const {error}=await db.from('reliability_config_v2080').update(patch).eq('channel',channel);if(error)throw error;
      await audit('reliability2080_config',{before,patch});return out(await state());
    }
    if(action==='set_mode'){
      owner();const mode=String(body.mode||'');if(!['normal','degraded','read_only','emergency'].includes(mode))return out({error:'Reliability mode không hợp lệ.'},400);
      const reason=txt(body.reason,800);if(reason.length<8)return out({error:'Manual transition cần lý do tối thiểu 8 ký tự.'},400);
      const {data:snap,error:se}=await db.rpc('powder_reliability_snapshot_v2080',{p_channel:channel,p_build:buildId});if(se)throw se;
      const {data,error}=await db.rpc('powder_reliability_apply_mode_v2080',{p_channel:channel,p_mode:mode,p_reason:'MANUAL: '+reason,p_build:buildId,p_actor:email,p_health:snap});if(error)throw error;
      await audit('reliability2080_manual_mode',{mode,reason,generation:data?.generation});return out({ok:true,result:data,state:await state()});
    }
    return out({error:'Reliability action không tồn tại.'},400);
  }catch(e:any){console.error(e);return out({error:e?.message||'Admin Reliability error'},Number(e?.status)||400)}
});
