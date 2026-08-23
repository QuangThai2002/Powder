import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";
const VERSION='20.17.0';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Integrity-Version':VERSION}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return out({error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:{user},error:ue}=await db.auth.getUser(jwt);if(ue||!user?.email)return out({error:'Phiên Admin không hợp lệ.'},401);
  const email=user.email.toLowerCase();const {data:allow}=await db.from('admin_allowlist').select('role,active').eq('email',email).maybeSingle();
  if(!allow?.active||!['owner','admin'].includes(String(allow.role)))return out({error:'Không đủ quyền Integrity Gate.'},403);
  const role=String(allow.role),body=await req.json().catch(()=>({})),action=String(body.action||'state');
  await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role,functionName:'powder-admin-integrity',action});
  const owner=()=>{if(role!=='owner')throw Object.assign(new Error('Thao tác này chỉ Owner được phép.'),{status:403})};
  const saveState=async()=>{const [{data:posture,error:pe},{data:incidents,error:ie},{data:scans,error:se}]=await Promise.all([
    db.rpc('powder_save_integrity_posture_v20170'),
    db.from('save_integrity_incidents_v20170').select('id,user_id,revision,severity,code,details,resolved,resolved_at,resolved_by,created_at').order('created_at',{ascending:false}).limit(50),
    db.from('save_integrity_scan_runs_v20170').select('*').order('checked_at',{ascending:false}).limit(20)
  ]);if(pe||ie||se)throw pe||ie||se;return{ok:true,edgeVersion:VERSION,posture,incidents:incidents||[],scans:scans||[]}};
  if(action==='state'){
    const [{data:snap,error:se},{data:roll,error:re}]=await Promise.all([db.rpc('powder_integrity_snapshot_v1960'),db.from('release_rollout_v1950').select('channel,rollout_percent,emergency_mode,rollback_target_build,updated_at').eq('channel','production').single()]);
    if(se||re)throw se||re;return out({ok:true,edgeVersion:VERSION,snapshot:snap,rollout:roll});
  }
  if(action==='probe_one'){
    const t0=performance.now();const {data,error}=await db.rpc('powder_integrity_probe_v1960');const ms=Math.max(0,performance.now()-t0);if(error)throw error;
    return out({ok:true,edgeVersion:VERSION,dbMs:Number(ms.toFixed(2)),probe:data});
  }
  if(action==='cas_probe'){
    const id=`probe-${crypto.randomUUID()}`;const {data:reset,error:r0}=await db.rpc('powder_integrity_cas_reset_v1960',{p_id:id});if(r0)throw r0;
    const base=Number(reset?.revision||1);
    const [a,b]=await Promise.all([db.rpc('powder_integrity_cas_commit_v1960',{p_id:id,p_expected:base,p_payload:{writer:'A'}}),db.rpc('powder_integrity_cas_commit_v1960',{p_id:id,p_expected:base,p_payload:{writer:'B'}})]);
    await db.from('integrity_cas_probe_v1960').delete().eq('id',id);if(a.error||b.error)throw a.error||b.error;
    const rows=[a.data,b.data],wins=rows.filter((x:any)=>x?.ok===true&&!x?.conflict).length,conflicts=rows.filter((x:any)=>x?.conflict===true).length;
    return out({ok:wins===1&&conflicts===1,edgeVersion:VERSION,baseRevision:base,wins,conflicts,results:rows});
  }
  if(action==='save_integrity_state')return out(await saveState());
  if(action==='save_integrity_scan'){
    const {data,error}=await db.rpc('powder_save_integrity_scan_v20170',{p_actor:email});if(error)throw error;
    return out({...await saveState(),scan:data});
  }
  if(action==='save_integrity_arm'){
    owner();if(typeof body.armed!=='boolean')return out({error:'armed phải là boolean.'},400);
    const {error}=await db.rpc('powder_save_integrity_arm_v20170',{p_armed:body.armed,p_actor:email});if(error)throw error;
    return out(await saveState());
  }
  if(action==='save_integrity_resolve'){
    owner();const id=Math.trunc(Number(body.id)||0),note=String(body.note||'').trim();if(id<=0||note.length<8)return out({error:'Incident id/note chưa hợp lệ.'},400);
    const {data,error}=await db.rpc('powder_save_integrity_resolve_v20170',{p_id:id,p_actor:email,p_note:note});if(error)throw error;
    return out({...await saveState(),resolved:data});
  }
  return out({error:'Integrity action không tồn tại.'},400);
 }catch(e:any){console.error(e);return out({error:e?.message||'Integrity server error'},Number(e?.status)||400)}
});
