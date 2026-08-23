import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";
const VERSION='19.5.0';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Rollout-Version':VERSION}});
const text=(v:unknown,n=400)=>String(v??'').trim().slice(0,n);
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:ue}=await db.auth.getUser(jwt);
    if(ue||!user?.email)return out({error:'Phiên Admin không hợp lệ.'},401);
    const email=user.email.toLowerCase();
    const {data:allow}=await db.from('admin_allowlist').select('role,active').eq('email',email).maybeSingle();
    if(!allow?.active||!['owner','admin'].includes(String(allow.role)))return out({error:'Không đủ quyền Safe Rollout.'},403);
    const role=String(allow.role), body=await req.json().catch(()=>({})), action=String(body.action||'state');
    const channel=String(body.channel)==='staging'?'staging':'production';
    const ownerForProd=()=>{if(channel==='production'&&role!=='owner')throw Object.assign(new Error('Production emergency/rollback chỉ Owner được phép.'),{status:403})};
    const audit=async(name:string,details:any)=>{await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,details:{version:VERSION,channel,...details}})};
    const state=async()=>{
      const [{data:rollout,error:re},{data:release,error:ce},{data:manifest,error:me},{data:deploys,error:de}]=await Promise.all([
        db.from('release_rollout_v1950').select('*').eq('channel',channel).single(),
        db.from('release_channels').select('*').eq('channel',channel).single(),
        db.rpc('powder_release_manifest',{p_channel:channel}),
        db.from('release_deployments').select('id,action,version,build_id,previous_version,created_at,created_by,details').eq('channel',channel).order('created_at',{ascending:false}).limit(12)
      ]);
      if(re||ce||me||de)throw re||ce||me||de;
      let rollback:any=null;
      if(release?.build_id){const {data}=await db.rpc('powder_release_rollback_dry_run_v1840',{p_channel:channel,p_build:release.build_id});rollback=data||null}
      return {ok:true,edgeVersion:VERSION,channel,rollout,release,manifest,rollback,recentDeployments:deploys||[]};
    };
    await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-rollout',action:action});
    if(action==='state')return out(await state());
    if(action==='set_rollout'){
      const raw=Number(body.percent);if(!Number.isFinite(raw))return out({error:'Rollout percent không hợp lệ.'},400);
      const p=Math.max(0,Math.min(100,Math.floor(raw)));
      const {data:before}=await db.from('release_rollout_v1950').select('*').eq('channel',channel).single();
      const salt=text(body.salt||before?.cohort_salt||`powder-${channel}-v1950`,120)||`powder-${channel}-v1950`;
      const {error}=await db.from('release_rollout_v1950').update({rollout_percent:p,cohort_salt:salt,updated_at:new Date().toISOString(),updated_by:email}).eq('channel',channel);if(error)throw error;
      await audit('safe_rollout_percent',{before:Number(before?.rollout_percent||100),after:p});return out(await state());
    }
    if(action==='set_rollback_target'){
      ownerForProd();const buildId=text(body.buildId,120);
      if(buildId){const {data:b,error}=await db.from('release_builds').select('build_id,checksum,status').eq('channel',channel).eq('build_id',buildId).maybeSingle();if(error)throw error;if(!b||!/^[0-9a-fA-F]{64}$/.test(String(b.checksum||'')))return out({error:'Rollback target không tồn tại hoặc thiếu checksum hợp lệ.'},400)}
      const {error}=await db.from('release_rollout_v1950').update({rollback_target_build:buildId,updated_at:new Date().toISOString(),updated_by:email}).eq('channel',channel);if(error)throw error;
      await audit('safe_rollout_target',{buildId});return out(await state());
    }
    if(action==='rollback_target'){
      ownerForProd();
      const {data:ro,error:roe}=await db.from('release_rollout_v1950').select('*').eq('channel',channel).single();if(roe)throw roe;
      const targetId=text(ro?.rollback_target_build,120);if(!targetId)return out({error:'Chưa khóa rollback target.'},409);
      const {data:cur,error:ce}=await db.from('release_channels').select('*').eq('channel',channel).single();if(ce)throw ce;
      if(targetId===cur?.build_id)return out({error:'Rollback target đang là build active.'},409);
      const {data:target,error:te}=await db.from('release_builds').select('*').eq('channel',channel).eq('build_id',targetId).maybeSingle();if(te)throw te;
      if(!target||!/^[0-9a-fA-F]{64}$/.test(String(target.checksum||'')))return out({error:'Rollback target không có checksum SHA-256 hợp lệ.'},409);
      const now=new Date().toISOString();
      const {error:u1}=await db.from('release_builds').update({status:'rolled_back'}).eq('channel',channel).eq('build_id',cur?.build_id||'');if(u1)throw u1;
      const {error:u2}=await db.from('release_builds').update({status:'active',activated_at:now}).eq('id',target.id);if(u2)throw u2;
      const {error:u3}=await db.from('release_channels').update({current_version:target.version,build_id:target.build_id,asset_epoch:Number(cur?.asset_epoch||0)+1,updated_at:now,updated_by:email}).eq('channel',channel);if(u3)throw u3;
      await db.from('release_deployments').insert({channel,action:'rollback_target_v1950',version:target.version,build_id:target.build_id,previous_version:cur?.current_version||'',created_by:email,details:{fromBuild:cur?.build_id||'',targetChecksum:target.checksum}});
      await audit('safe_rollout_rollback_target',{from:cur?.build_id||'',to:target.build_id,version:target.version});
      return out(await state());
    }
    if(action==='emergency_stop'){
      ownerForProd();const msg=text(body.message||'Powder Online tạm dừng để bảo vệ dữ liệu người chơi.',300);
      const t=new Date().toISOString();
      const r1=await db.from('release_rollout_v1950').update({emergency_mode:'halt',emergency_message:msg,updated_at:t,updated_by:email}).eq('channel',channel);if(r1.error)throw r1.error;
      const r2=await db.from('release_channels').update({hard_maintenance:true,maintenance_message:msg,maintenance_until:null,updated_at:t,updated_by:email}).eq('channel',channel);if(r2.error)throw r2.error;
      try{await db.from('release_deployments').insert({channel,action:'emergency_stop_v1950',version:'',build_id:'',created_by:email,details:{message:msg}})}catch(_){}
      await audit('safe_rollout_emergency_stop',{message:msg});return out(await state());
    }
    if(action==='emergency_resume'){
      ownerForProd();const t=new Date().toISOString();
      const r1=await db.from('release_rollout_v1950').update({emergency_mode:'normal',emergency_message:'',updated_at:t,updated_by:email}).eq('channel',channel);if(r1.error)throw r1.error;
      const r2=await db.from('release_channels').update({hard_maintenance:false,maintenance_until:null,updated_at:t,updated_by:email}).eq('channel',channel);if(r2.error)throw r2.error;
      await audit('safe_rollout_emergency_resume',{});return out(await state());
    }
    return out({error:'Rollout action không tồn tại.'},400);
  }catch(e:any){console.error(e);return out({error:e?.message||'Safe rollout server error'},Number(e?.status)||400)}
});
