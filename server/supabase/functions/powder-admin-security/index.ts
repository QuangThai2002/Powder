import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";

const VERSION='20.16.0';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Security-Version':VERSION}});
const txt=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n);
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
const isSha=(v:unknown)=>/^[0-9a-f]{64}$/i.test(String(v||''));

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:ue}=await db.auth.getUser(jwt);
    if(ue||!user?.email)return out({error:'Phiên Admin không hợp lệ.'},401);
    const email=user.email.toLowerCase();
    const {data:a}=await db.from('admin_allowlist').select('role,active').eq('email',email).maybeSingle();
    if(!a?.active||!['owner','admin','support'].includes(String(a.role)))return out({error:'Không có quyền Security Review.'},403);
    const role=String(a.role),b=await req.json().catch(()=>({})),action=String(b.action||'state');
    await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role,functionName:'powder-admin-security',action});
    const posture=async()=>{const {data,error}=await db.rpc('powder_security_posture_v20160');if(error)throw error;return data};
    const state=async()=>{
      const [{data:config,error:ce},{data:surfaces,error:se},{data:revocations,error:re},{data:denied,error:de}]=await Promise.all([
        db.from('security_config_v20160').select('*').eq('id',1).single(),
        db.from('security_admin_surfaces_v20160').select('*').order('function_name'),
        db.from('security_revocations_v20160').select('id,user_id,token_sha256,revoked_after,reason,active,created_by,created_at').eq('active',true).order('created_at',{ascending:false}).limit(30),
        db.from('security_access_audit_v20160').select('id,email,role,function_name,action,origin,allowed,code,token_age_seconds,aal,created_at').eq('allowed',false).order('created_at',{ascending:false}).limit(40)
      ]);if(ce||se||re||de)throw ce||se||re||de;
      return{ok:true,edgeVersion:VERSION,role,posture:await posture(),config,surfaces:surfaces||[],revocations:revocations||[],recentDenied:denied||[],serverTime:new Date().toISOString()};
    };
    if(action==='state')return out(await state());
    if(action==='run_probe'){
      if(!['owner','admin'].includes(role))return out({error:'Support chỉ được xem Security posture.'},403);
      const {data,error}=await db.rpc('powder_security_duplicate_probe_v2030');if(error)throw error;
      return out({ok:true,probe:data,state:await state()});
    }
    if(action==='configure'){
      if(role!=='owner')return out({error:'Chỉ Owner được cấu hình Security 20.16.'},403);
      const origins=Array.isArray(b.allowedOrigins)?b.allowedOrigins.map((x:any)=>txt(x,300)).filter(Boolean).slice(0,20):[];
      const {data,error}=await db.rpc('powder_security_configure_v20160',{p_allowed_origins:origins,p_enabled:b.enabled===true,p_actor:email});if(error)throw error;
      await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:'security20160_configure',details:{version:VERSION,enabled:b.enabled===true,allowedOrigins:origins}});
      return out({ok:true,result:data,state:await state()});
    }
    if(action==='revoke_user'){
      if(role!=='owner')return out({error:'Chỉ Owner được revoke toàn bộ phiên Admin của tài khoản.'},403);
      const target=txt(b.userId,80),reason=txt(b.reason,1000);if(!isUuid(target)||reason.length<8)return out({error:'Cần userId hợp lệ và lý do tối thiểu 8 ký tự.'},400);
      const {data,error}=await db.rpc('powder_security_revoke_user_v20160',{p_user:target,p_reason:reason,p_actor:email});if(error)throw error;
      await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:'security20160_revoke_user',target_user_id:target,details:{version:VERSION,reason}});
      return out({ok:true,result:data,state:await state()});
    }
    if(action==='revoke_token'){
      if(role!=='owner')return out({error:'Chỉ Owner được revoke token hash.'},403);
      const tokenSha=txt(b.tokenSha256,64).toLowerCase(),reason=txt(b.reason,1000);if(!isSha(tokenSha)||reason.length<8)return out({error:'Cần SHA-256 token hợp lệ và lý do tối thiểu 8 ký tự.'},400);
      const {data,error}=await db.rpc('powder_security_revoke_token_v20160',{p_token_sha256:tokenSha,p_reason:reason,p_actor:email});if(error)throw error;
      await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:'security20160_revoke_token',details:{version:VERSION,tokenSha256:tokenSha,reason}});
      return out({ok:true,result:data,state:await state()});
    }
    if(action==='snapshot'){
      if(role!=='owner')return out({error:'Chỉ Owner được lưu Production Security snapshot.'},403);
      const p=await posture();const {data,error}=await db.from('security_review_snapshots_v20160').insert({posture:p,created_by:email}).select('id,created_at').single();if(error)throw error;
      await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:'security20160_snapshot',details:{version:VERSION,ready:p?.ready===true,critical:p?.counts?.critical,high:p?.counts?.high}});
      return out({ok:true,snapshot:data,posture:p});
    }
    return out({error:'Security action không tồn tại.'},400);
  }catch(e:any){console.error('[powder-admin-security 20.16]',e);return out({error:e?.message||'Security server error',code:e?.code||''},Number(e?.status)||400)}
});
