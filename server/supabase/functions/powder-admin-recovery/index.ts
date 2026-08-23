import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";
const VERSION='20.4.0', DEFAULT_BUILD='powder-20.4.0-disaster-recovery-backup-integrity';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Recovery-Version':VERSION}});
const txt=(v:unknown,n=500)=>String(v??'').trim().slice(0,n);
const sha=(v:unknown)=>/^[0-9a-fA-F]{64}$/.test(String(v||''));
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:ue}=await db.auth.getUser(jwt);if(ue||!user?.email)return out({error:'Phiên Admin không hợp lệ.'},401);
    const email=user.email.toLowerCase();const {data:allow}=await db.from('admin_allowlist').select('role,active').eq('email',email).maybeSingle();
    if(!allow?.active||!['owner','admin','support'].includes(String(allow.role)))return out({error:'Không có quyền Recovery Console.'},403);
    const role=String(allow.role), body=await req.json().catch(()=>({})), action=String(body.action||'state'), channel=String(body.channel)==='staging'?'staging':'production', buildId=txt(body.buildId||DEFAULT_BUILD,160);
    const canWrite=['owner','admin'].includes(role);const owner=()=>{if(role!=='owner')throw Object.assign(new Error('Chỉ Owner được ghi Real Restore evidence hoặc thay đổi Recovery target.'),{status:403})};
    const audit=async(name:string,details:any)=>db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,details:{version:VERSION,channel,buildId,...details}});
    const state=async()=>{
      const [{data:posture,error:pe},{data:evidence,error:ee},{data:snapshots,error:se},{data:cfg,error:ce}]=await Promise.all([
        db.rpc('powder_recovery_posture_v2040',{p_channel:channel,p_build:buildId}),
        db.from('recovery_restore_evidence_v2040').select('id,channel,build_id,backup_provider,backup_id,backup_created_at,incident_at,restore_environment,restore_started_at,restore_completed_at,rpo_minutes,rto_minutes,schema_compatible,cloud_save_verified,economy_verified,pows_verified,inventory_verified,rollback_verified,status,checked_at,checked_by,notes').eq('channel',channel).eq('build_id',buildId).order('checked_at',{ascending:false}).limit(20),
        db.from('recovery_posture_snapshots_v2040').select('id,channel,build_id,posture,created_at,created_by').eq('channel',channel).order('created_at',{ascending:false}).limit(12),
        db.from('recovery_config_v2040').select('*').eq('channel',channel).single()
      ]);if(pe||ee||se||ce)throw pe||ee||se||ce;
      return{ok:true,edgeVersion:VERSION,role,channel,buildId,config:cfg,posture,evidence:evidence||[],snapshots:snapshots||[],serverTime:new Date().toISOString()};
    };
    await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-recovery',action:action});
    if(action==='state')return out(await state());
    if(action==='run_sandbox'){
      if(!canWrite)return out({error:'Support chỉ được xem Recovery Posture.'},403);
      const {data,error}=await db.rpc('powder_recovery_sandbox_drill_v2040');if(error)throw error;await audit('recovery2040_sandbox',{result:data});return out({ok:true,result:data,state:await state()});
    }
    if(action==='snapshot'){
      if(!canWrite)return out({error:'Support chỉ được xem Recovery Posture.'},403);const {data:posture,error:pe}=await db.rpc('powder_recovery_posture_v2040',{p_channel:channel,p_build:buildId});if(pe)throw pe;const {error}=await db.from('recovery_posture_snapshots_v2040').insert({channel,build_id:buildId,posture,created_by:email});if(error)throw error;await audit('recovery2040_snapshot',{ready:posture?.ready===true});return out(await state());
    }
    if(action==='record_real_restore'){
      owner();const backupSha=txt(body.backupSha256,64),evidenceSha=txt(body.evidenceSha256,64);if(!sha(backupSha)||!sha(evidenceSha))return out({error:'Backup/Evidence SHA-256 phải đủ 64 ký tự hex.'},400);
      const args={p_channel:channel,p_build:buildId,p_backup_provider:txt(body.backupProvider,80),p_backup_id:txt(body.backupId,180),p_backup_created_at:String(body.backupCreatedAt||''),p_backup_sha256:backupSha,p_evidence_sha256:evidenceSha,p_incident_at:String(body.incidentAt||''),p_restore_environment:txt(body.restoreEnvironment,120),p_restore_started_at:String(body.restoreStartedAt||''),p_restore_completed_at:String(body.restoreCompletedAt||''),p_schema_compatible:body.schemaCompatible===true,p_cloud_save_verified:body.cloudSaveVerified===true,p_economy_verified:body.economyVerified===true,p_pows_verified:body.powsVerified===true,p_inventory_verified:body.inventoryVerified===true,p_rollback_verified:body.rollbackVerified===true,p_notes:txt(body.notes,1200),p_admin:email};
      if(!args.p_backup_provider||!args.p_backup_id||!args.p_restore_environment||!args.p_backup_created_at||!args.p_incident_at||!args.p_restore_started_at||!args.p_restore_completed_at)return out({error:'Thiếu metadata Real Restore Drill.'},400);
      const {data,error}=await db.rpc('powder_recovery_record_real_restore_v2040',args);if(error)throw error;await audit('recovery2040_real_restore',{result:data,backupProvider:args.p_backup_provider,backupId:args.p_backup_id,evidenceSha256:evidenceSha});return out({ok:true,result:data,state:await state()});
    }
    if(action==='set_targets'){
      owner();const rpo=Math.trunc(Number(body.rpoMinutes)),rto=Math.trunc(Number(body.rtoMinutes)),age=Math.trunc(Number(body.maxAgeDays));if(!(rpo>=1&&rpo<=10080&&rto>=1&&rto<=1440&&age>=1&&age<=90))return out({error:'Recovery target không hợp lệ.'},400);const {error}=await db.from('recovery_config_v2040').update({target_rpo_minutes:rpo,target_rto_minutes:rto,max_real_restore_age_days:age,require_real_restore:body.requireRealRestore!==false,updated_at:new Date().toISOString(),updated_by:email}).eq('channel',channel);if(error)throw error;await audit('recovery2040_targets',{rpoMinutes:rpo,rtoMinutes:rto,maxAgeDays:age,requireRealRestore:body.requireRealRestore!==false});return out(await state());
    }
    return out({error:'Recovery action không tồn tại.'},400);
  }catch(e:any){console.error(e);return out({error:e?.message||'Recovery server error'},Number(e?.status)||400)}
});
