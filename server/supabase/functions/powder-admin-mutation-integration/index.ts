import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";

const VERSION='20.11.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Mutation-Admin-Version':VERSION}});
const clean=(v:unknown,n=500)=>String(v??'').trim().slice(0,n);
const isSha=(v:unknown)=>/^[0-9a-fA-F]{64}$/.test(String(v||''));

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
    if(!allow?.active||!['owner','admin'].includes(String(allow.role)))return out({error:'Không đủ quyền Canonical Mutation Adapters.'},403);
    const role=String(allow.role),body=await req.json().catch(()=>({})),action=String(body.action||'state');
    const owner=()=>{if(role!=='owner')throw Object.assign(new Error('Chỉ Owner được chạy mutation reconciliation/drill hoặc nhập CI evidence.'),{status:403})};
    const audit=async(name:string,details:any={})=>{await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,details:{version:VERSION,...details}})};
    const state=async()=>{
      const [{data:adapterPosture,error:ape},{data:atomicPosture,error:atpe},{data:routes,error:re},{data:dispatch,error:de},{data:evidence,error:ee},{data:runs,error:rune},{data:drills,error:dre}]=await Promise.all([
        db.rpc('powder_mutation_adapter_posture_v20110'),
        db.rpc('powder_mutation_posture_v20100'),
        db.from('mutation_adapter_routes_v20110').select('*').order('required_for_launch',{ascending:false}).order('scope').order('action'),
        db.from('mutation_adapter_dispatch_v20110').select('user_id,scope,tx_key,action,status,target_edge,legacy_action,http_status,error_code,error_message,created_at,updated_at').in('status',['pending','failed','unknown','investigating']).order('updated_at',{ascending:false}).limit(100),
        db.from('mutation_adapter_evidence_v20110').select('*').order('checked_at',{ascending:false}).limit(100),
        db.from('mutation_reconciliation_runs_v20100').select('*').order('created_at',{ascending:false}).limit(20),
        db.from('mutation_chaos_drills_v20100').select('*').order('created_at',{ascending:false}).limit(20)
      ]);
      if(ape||atpe||re||de||ee||rune||dre)throw ape||atpe||re||de||ee||rune||dre;
      return{ok:true,version:VERSION,role,adapterPosture,atomicPosture,routes:routes||[],openDispatch:dispatch||[],adapterEvidence:evidence||[],reconciliationRuns:runs||[],chaosDrills:drills||[],serverTime:new Date().toISOString()};
    };
    await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-mutation-integration',action:action});
    if(action==='state')return out(await state());
    if(action==='reconcile'){
      owner();const limit=Math.max(1,Math.min(500,Number(body.limit)||100));
      const [{data:a,error:ae},{data:m,error:me}]=await Promise.all([
        db.rpc('powder_mutation_adapter_reconcile_v20110',{p_limit:limit,p_actor:email}),
        db.rpc('powder_mutation_reconcile_v20100',{p_limit:limit,p_actor:email})
      ]);if(ae||me)throw ae||me;
      await audit('mutation20110_reconcile',{limit,adapter:a,atomic:m});return out({ok:true,result:{adapter:a,atomic:m},state:await state()});
    }
    if(action==='chaos_drill'){
      owner();const {data,error}=await db.rpc('powder_mutation_chaos_drill_v20100',{p_actor:email});if(error)throw error;
      await audit('mutation20110_atomic_chaos_drill',{result:data});return out({ok:true,result:data,state:await state()});
    }
    if(action==='record_adapter_evidence'){
      owner();const scope=clean(body.scope,24).toLowerCase(),adapterAction=clean(body.adapterAction||body.mutationAction,80).toLowerCase(),rev=clean(body.targetRevision,160),evidenceSha=clean(body.evidenceSha256,64).toLowerCase(),checkedAt=new Date(String(body.checkedAt||''));
      if(!scope||!adapterAction||!rev||!isSha(evidenceSha)||!Number.isFinite(checkedAt.getTime()))return out({error:'CI evidence cần scope/action/targetRevision/SHA-256/checkedAt hợp lệ.'},400);
      if(body.idempotencyPass!==true||body.businessAtomicPass!==true||body.directWriteBlockedPass!==true)return out({error:'Chỉ evidence PASS đủ cả 3 kiểm tra mới được nhập.'},400);
      const {data,error}=await db.rpc('powder_mutation_adapter_record_evidence_v20110',{p_scope:scope,p_action:adapterAction,p_target_revision:rev,p_evidence_sha256:evidenceSha,p_idempotency_pass:true,p_business_atomic_pass:true,p_direct_write_blocked_pass:true,p_checked_at:checkedAt.toISOString(),p_actor:email,p_details:body.details&&typeof body.details==='object'?body.details:{}});if(error)throw error;
      await audit('mutation20110_adapter_evidence',{scope,action:adapterAction,targetRevision:rev,evidenceSha256:evidenceSha,checkedAt:checkedAt.toISOString()});return out({ok:true,result:data,state:await state()});
    }
    return out({error:'Action không hợp lệ.'},400);
  }catch(e:any){console.error('[powder-admin-mutation-integration 20.11]',e);return out({error:String(e?.message||e)},Number(e?.status)||500)}
});
