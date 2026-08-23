import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";

const VERSION='21.0.0';
const BUILD='powder-21.0.0-official-production';
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store"
};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Official-Launch-Version':VERSION}});
const text=(v:unknown,n=500)=>String(v??'').trim().slice(0,n);
const isSha=(v:unknown)=>/^[0-9a-fA-F]{64}$/.test(String(v||''));
const isManifest=(v:unknown)=>/^[0-9a-fA-F]{16,64}$/.test(String(v||''));
const iso=(v:unknown)=>{const d=new Date(String(v||''));return Number.isFinite(d.getTime())?d:null};

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
    if(!allow?.active||!['owner','admin'].includes(String(allow.role)))return out({error:'Không đủ quyền Production Launch Control.'},403);
    const role=String(allow.role);
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'state');
    const channel=String(body.channel)==='staging'?'staging':'production';
    const buildId=text(body.buildId||BUILD,120);
    const manifestHash=text(body.manifestHash,80);
    if(buildId!==BUILD)return out({error:'Build ID 21.0.0 không hợp lệ.'},400);
    const owner=()=>{if(role!=='owner')throw Object.assign(new Error('Chỉ Owner được thực hiện thao tác Production mutation.'),{status:403})};
    const audit=async(name:string,details:any)=>{await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,details:{version:VERSION,channel,buildId,...details}})};
    const state=async()=>{
      const [{data:pf,error:pe},{data:evidence,error:ee},{data:stages,error:se},{data:auth,error:ae},{data:deploys,error:de},{data:launch,error:le},{data:rcEvidence,error:rce},{data:rollbackDrills,error:rde},{data:gmEvidence,error:gme}]=await Promise.all([
        db.rpc('powder_official_launch_preflight_v21000',{p_channel:channel,p_build:buildId,p_manifest_hash:manifestHash}),
        db.from('official_launch_evidence_v2000').select('*').eq('channel',channel).eq('build_id',buildId).order('check_key'),
        db.from('release_canary_stage_evidence_v21000').select('*').eq('channel',channel).eq('build_id',buildId).order('rollout_percent'),
        db.from('official_release_authorization_v2070').select('*').eq('channel',channel).eq('build_id',buildId).maybeSingle(),
        db.from('release_deployments').select('id,action,version,build_id,previous_version,created_at,created_by,details').eq('channel',channel).order('created_at',{ascending:false}).limit(24),
        db.from('launch_config_v170').select('*').eq('id',1).maybeSingle(),
        db.from('release_candidate_evidence_v21000').select('*').eq('channel',channel).eq('build_id',buildId).order('created_at',{ascending:false}).limit(1),
        db.from('release_canary_rollback_drills_v21000').select('*').eq('channel',channel).eq('source_build',buildId).order('created_at',{ascending:false}).limit(3),
        db.from('official_production_evidence_v21000').select('*').eq('channel',channel).eq('build_id',buildId).order('created_at',{ascending:false}).limit(1)
      ]);
      if(pe||ee||se||ae||de||le||rce||rde||gme)throw pe||ee||se||ae||de||le||rce||rde||gme;
      return{ok:true,edgeVersion:VERSION,role,channel,buildId,manifestHash,preflight:pf,evidence:evidence||[],stageEvidence:stages||[],authorization:auth||null,launch:launch||null,recentDeployments:deploys||[],releaseCandidateEvidence:rcEvidence?.[0]||null,officialProductionEvidence:gmEvidence?.[0]||null,goldMasterEvidence:gmEvidence?.[0]||null,rollbackDrills:rollbackDrills||[],serverTime:new Date().toISOString()};
    };

    await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-official-launch',action:action});
    if(action==='state')return out(await state());

    if(action==='register_candidate'){
      const checksum=text(body.checksum,64),artifactUrl=text(body.artifactUrl,500);
      if(!isSha(checksum))return out({error:'ZIP SHA-256 phải đủ 64 ký tự hex.'},400);
      const {data,error}=await db.from('release_builds').upsert({channel,version:VERSION,build_id:buildId,checksum,artifact_url:artifactUrl,created_by:email,status:'candidate'},{onConflict:'channel,build_id'}).select().single();
      if(error)throw error;
      await db.from('release_deployments').insert({channel,action:'official_register_v21000',version:VERSION,build_id:buildId,details:{checksum,artifactUrl},created_by:email});
      await audit('official20200_register',{checksum,artifactUrl});
      return out({ok:true,build:data,state:await state()});
    }

    if(action==='record_evidence'){
      const key=text(body.checkKey,40),status=String(body.status||'pass'),evidenceSha=text(body.evidenceSha256,64),mh=text(body.manifestHash,80),details=body.details&&typeof body.details==='object'?body.details:{};
      if(!['load_1960','recovery_1940','polish_1980','freeze_1990'].includes(key))return out({error:'Evidence key không hợp lệ.'},400);
      if(status!=='pass')return out({error:'20.20 chỉ nhận evidence PASS đã được local gate xác minh.'},400);
      if(!isSha(evidenceSha)||!isManifest(mh))return out({error:'Evidence PASS cần SHA-256 và manifest hash hợp lệ.'},400);
      const {error}=await db.from('official_launch_evidence_v2000').upsert({channel,build_id:buildId,check_key:key,status:'pass',manifest_hash:mh,evidence_sha256:evidenceSha,details,checked_at:new Date().toISOString(),checked_by:email},{onConflict:'channel,build_id,check_key'});
      if(error)throw error;
      await audit('official2070_evidence',{key,evidenceSha256:evidenceSha,manifestHash:mh});
      return out(await state());
    }

    if(action==='save_plan'){
      const candidate=(await db.from('release_builds').select('checksum,status,version').eq('channel',channel).eq('build_id',buildId).maybeSingle()).data;
      if(!candidate||candidate.version!==VERSION||!isSha(candidate.checksum))return out({error:'Hãy register Official Production 21.0.0 với checksum hợp lệ trước.'},409);
      if(!isManifest(manifestHash))return out({error:'Manifest hash chưa hợp lệ.'},409);
      const start=iso(body.windowStart),end=iso(body.windowEnd),note=text(body.releaseNote,1200);
      if(!start||!end||end<=start)return out({error:'Change window không hợp lệ.'},400);
      const duration=end.getTime()-start.getTime(),now=Date.now();
      if(duration<60*60*1000||duration>24*60*60*1000)return out({error:'Change window phải dài từ 1 đến 24 giờ.'},400);
      if(start.getTime()>now+7*24*60*60*1000||end.getTime()<now-5*60*1000)return out({error:'Change window phải nằm trong phạm vi 7 ngày tới.'},400);
      if(note.length<12)return out({error:'Release note cần mô tả mục tiêu/rủi ro tối thiểu 12 ký tự.'},400);
      const {data:ch,error:ce}=await db.from('release_channels').select('build_id').eq('channel',channel).single();if(ce)throw ce;
      const rollback=text(body.rollbackTarget||ch.build_id,120);
      if(rollback===buildId)return out({error:'Rollback target không được là Official Production 21.0.0.'},409);
      const {data:rb,error:re}=await db.from('release_builds').select('build_id,checksum').eq('channel',channel).eq('build_id',rollback).maybeSingle();if(re)throw re;
      if(!rb||!isSha(rb.checksum))return out({error:'Rollback target không có checksum hợp lệ.'},409);
      const existing=(await db.from('official_release_authorization_v2070').select('status,revision').eq('channel',channel).eq('build_id',buildId).maybeSingle()).data;
      if(existing&&['submitted','approved','armed','consumed'].includes(String(existing.status)))return out({error:'Plan đã submit/approve; hãy revoke trước khi sửa.'},409);
      const revision=Math.max(1,Number(existing?.revision||0)+1);
      const {error}=await db.from('official_release_authorization_v2070').upsert({channel,build_id:buildId,manifest_hash:manifestHash,artifact_checksum:candidate.checksum,rollback_target_build:rollback,release_note:note,window_start:start.toISOString(),window_end:end.toISOString(),status:'draft',revision,created_by:email,updated_at:new Date().toISOString(),updated_by:email},{onConflict:'channel,build_id'});
      if(error)throw error;
      await audit('official2070_plan_saved',{revision,rollbackTarget:rollback,windowStart:start.toISOString(),windowEnd:end.toISOString()});
      return out(await state());
    }

    if(action==='submit_plan'){
      const {data:a,error:ae}=await db.from('official_release_authorization_v2070').select('*').eq('channel',channel).eq('build_id',buildId).maybeSingle();if(ae)throw ae;
      if(!a||a.status!=='draft')return out({error:'Chỉ Draft plan mới được Submit.'},409);
      const {error}=await db.from('official_release_authorization_v2070').update({status:'submitted',submitted_at:new Date().toISOString(),submitted_by:email,updated_at:new Date().toISOString(),updated_by:email}).eq('channel',channel).eq('build_id',buildId).eq('revision',a.revision);if(error)throw error;
      await audit('official2070_plan_submitted',{revision:a.revision});
      return out(await state());
    }

    if(action==='approve_plan'){
      owner();
      const {data:a,error:ae}=await db.from('official_release_authorization_v2070').select('*').eq('channel',channel).eq('build_id',buildId).maybeSingle();if(ae)throw ae;
      if(!a||a.status!=='submitted')return out({error:'Plan phải ở trạng thái Submitted.'},409);
      const {data:b,error:be}=await db.from('release_builds').select('checksum').eq('channel',channel).eq('build_id',buildId).single();if(be)throw be;
      if(a.manifest_hash!==manifestHash||a.artifact_checksum!==b.checksum)return out({error:'Candidate/manifest đã drift sau khi Submit.'},409);
      const {error}=await db.from('official_release_authorization_v2070').update({status:'approved',approved_at:new Date().toISOString(),approved_by:email,updated_at:new Date().toISOString(),updated_by:email}).eq('channel',channel).eq('build_id',buildId).eq('revision',a.revision);if(error)throw error;
      await audit('official2070_plan_approved',{revision:a.revision});
      return out(await state());
    }

    if(action==='arm_plan'){
      owner();
      const {data:a,error:ae}=await db.from('official_release_authorization_v2070').select('*').eq('channel',channel).eq('build_id',buildId).maybeSingle();if(ae)throw ae;
      if(!a||a.status!=='approved')return out({error:'Plan phải được Owner Approve trước khi ARM.'},409);
      if(a.manifest_hash!==manifestHash)return out({error:'Manifest hash đã thay đổi; không thể ARM.'},409);
      const {data:b,error:be}=await db.from('release_builds').select('checksum').eq('channel',channel).eq('build_id',buildId).single();if(be)throw be;
      if(a.artifact_checksum!==b.checksum)return out({error:'Artifact checksum đã thay đổi; không thể ARM.'},409);
      const {data:ch,error:ce}=await db.from('release_channels').select('build_id').eq('channel',channel).single();if(ce)throw ce;
      if(a.rollback_target_build!==ch.build_id)return out({error:'Active build đã thay đổi so với rollback target; cần tạo lại plan.'},409);
      const {error:ue}=await db.from('release_rollout_v1950').update({rollback_target_build:a.rollback_target_build,updated_at:new Date().toISOString(),updated_by:email}).eq('channel',channel);if(ue)throw ue;
      const {error}=await db.from('official_release_authorization_v2070').update({status:'armed',armed_at:new Date().toISOString(),armed_by:email,updated_at:new Date().toISOString(),updated_by:email}).eq('channel',channel).eq('build_id',buildId).eq('revision',a.revision);if(error)throw error;
      const {error:rce}=await db.from('release_candidate_config_v21000').update({enabled:true,updated_at:new Date().toISOString(),updated_by:email}).eq('id',1);if(rce)throw rce;
      const {error:gme}=await db.from('official_production_config_v21000').update({enabled:true,updated_at:new Date().toISOString(),updated_by:email}).eq('id',1);if(gme)throw gme;
      await audit('official2070_plan_armed',{revision:a.revision,rollbackTarget:a.rollback_target_build});
      return out(await state());
    }

    if(action==='revoke_plan'){
      owner();
      const {data:a,error:ae}=await db.from('official_release_authorization_v2070').select('status,revision').eq('channel',channel).eq('build_id',buildId).maybeSingle();if(ae)throw ae;
      if(!a||a.status==='consumed')return out({error:'Không thể revoke plan đã consumed hoặc chưa tồn tại.'},409);
      const {error}=await db.from('official_release_authorization_v2070').update({status:'revoked',updated_at:new Date().toISOString(),updated_by:email}).eq('channel',channel).eq('build_id',buildId);if(error)throw error;
      await db.from('release_candidate_config_v21000').update({enabled:false,updated_at:new Date().toISOString(),updated_by:email}).eq('id',1);
      await db.from('official_production_config_v21000').update({enabled:false,updated_at:new Date().toISOString(),updated_by:email}).eq('id',1);
      await audit('official2070_plan_revoked',{revision:a.revision,previousStatus:a.status});
      return out(await state());
    }

    if(action==='capture_stage_health'){
      const pct=Math.trunc(Number(body.rolloutPercent));
      if(![5,20,50,100].includes(pct))return out({error:'Rollout stage không hợp lệ.'},400);
      const {data:ch,error:ce}=await db.from('release_channels').select('build_id').eq('channel',channel).single();if(ce)throw ce;
      const {data:ro,error:re}=await db.from('release_rollout_v1950').select('rollout_percent').eq('channel',channel).single();if(re)throw re;
      if(ch.build_id!==buildId||Number(ro.rollout_percent)!==pct)return out({error:'Chỉ được capture health cho stage đang active.'},409);
      const {data,error}=await db.rpc('powder_capture_canary_stage_health_v21000',{p_channel:channel,p_build:buildId,p_manifest_hash:manifestHash,p_rollout_percent:pct});if(error)throw error;
      await audit('official20200_stage_health_capture',{rolloutPercent:pct,status:data?.status||'unknown'});
      return out({ok:true,result:data,state:await state()});
    }

    if(action==='record_stage_health')return out({error:'20.19 khóa hoàn toàn nhập tay Stage Health. Hãy dùng capture_stage_health để server tự tính từ Observability.'},410);

    if(action==='activate_canary'){
      owner();
      const {data,error}=await db.rpc('powder_official_activate_canary_v21000',{p_channel:channel,p_build:buildId,p_manifest_hash:manifestHash,p_admin:email});if(error)throw error;
      await audit('official20200_activate_canary',{result:data});
      return out({ok:true,result:data,state:await state()});
    }
    if(action==='advance_rollout'){
      owner();
      const {data,error}=await db.rpc('powder_official_advance_rollout_v21000',{p_channel:channel,p_build:buildId,p_manifest_hash:manifestHash,p_admin:email});if(error)throw error;
      await audit('official20200_advance',{result:data});
      return out({ok:true,result:data,state:await state()});
    }
    if(action==='finalize_live'){
      owner();
      const {data,error}=await db.rpc('powder_official_finalize_live_v21000',{p_channel:channel,p_build:buildId,p_manifest_hash:manifestHash,p_admin:email});if(error)throw error;
      await audit('official20200_finalize',{result:data});
      return out({ok:true,result:data,state:await state()});
    }
    return out({error:'Production Launch Control action không tồn tại.'},400);
  }catch(e:any){console.error(e);return out({error:e?.message||'Production Launch Control server error'},Number(e?.status)||400)}
});
