import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";

const VERSION='20.12.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Reconciliation-Version':VERSION}});
const clean=(v:unknown,n=1200)=>String(v??'').trim().slice(0,n);

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
    if(!allow?.active||!['owner','admin'].includes(String(allow.role)))return out({error:'Không đủ quyền Reconciliation.'},403);
    const role=String(allow.role),body=await req.json().catch(()=>({})),action=String(body.action||'state');
    const owner=()=>{if(role!=='owner')throw Object.assign(new Error('Chỉ Owner được chạy drill hoặc phê duyệt/apply repair.'),{status:403})};
    const audit=async(name:string,details:any={})=>{await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,details:{version:VERSION,...details}})};
    const state=async()=>{
      const [{data:posture,error:pe},{data:cases,error:ce},{data:runs,error:re},{data:drills,error:de},{data:repairs,error:rpe}]=await Promise.all([
        db.rpc('powder_reconciliation_posture_v20120'),
        db.from('reconciliation_cases_v20120').select('*').in('status',['open','investigating','repair_proposed','repair_approved']).order('severity',{ascending:false}).order('last_seen_at',{ascending:false}).limit(150),
        db.from('reconciliation_runs_v20120').select('*').order('created_at',{ascending:false}).limit(20),
        db.from('reconciliation_drills_v20120').select('*').order('created_at',{ascending:false}).limit(20),
        db.from('reconciliation_repair_audit_v20120').select('*').order('created_at',{ascending:false}).limit(100)
      ]);
      if(pe||ce||re||de||rpe)throw pe||ce||re||de||rpe;
      return{ok:true,version:VERSION,role,posture,cases:cases||[],runs:runs||[],drills:drills||[],repairAudit:repairs||[],serverTime:new Date().toISOString()};
    };
    await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-reconciliation',action:action});
    if(action==='state')return out(await state());
    if(action==='scan'){
      const limit=Math.max(1,Math.min(1000,Number(body.limit)||200));
      const {data,error}=await db.rpc('powder_reconciliation_scan_v20120',{p_limit:limit,p_actor:email});if(error)throw error;
      await audit('reconciliation20120_scan',{limit,result:data});return out({ok:true,result:data,state:await state()});
    }
    if(action==='drill'){
      owner();const {data,error}=await db.rpc('powder_reconciliation_drill_v20120',{p_actor:email});if(error)throw error;
      await audit('reconciliation20120_drill',{result:data});return out({ok:true,result:data,state:await state()});
    }
    if(action==='propose_repair'){
      const caseId=clean(body.caseId,80),kind=clean(body.repairKind,80),note=clean(body.note,1200);
      if(!caseId||!kind||note.length<8)return out({error:'Repair cần caseId, repairKind và ghi chú tối thiểu 8 ký tự.'},400);
      const {data,error}=await db.rpc('powder_reconciliation_propose_repair_v20120',{p_case:caseId,p_kind:kind,p_note:note,p_actor:email});if(error)throw error;
      await audit('reconciliation20120_repair_proposed',{caseId,repairKind:kind,note});return out({ok:true,result:data,state:await state()});
    }
    if(action==='approve_repair'){
      owner();const caseId=clean(body.caseId,80);if(!caseId)return out({error:'Thiếu caseId.'},400);
      const {data,error}=await db.rpc('powder_reconciliation_approve_repair_v20120',{p_case:caseId,p_actor:email});if(error)throw error;
      await audit('reconciliation20120_repair_approved',{caseId});return out({ok:true,result:data,state:await state()});
    }
    if(action==='apply_repair'){
      owner();const caseId=clean(body.caseId,80);if(!caseId)return out({error:'Thiếu caseId.'},400);
      const {data,error}=await db.rpc('powder_reconciliation_apply_repair_v20120',{p_case:caseId,p_actor:email});if(error)throw error;
      await audit('reconciliation20120_repair_applied',{caseId,result:data});return out({ok:true,result:data,state:await state()});
    }
    if(action==='resource_adjustment')return out({error:'20.12 không cho phép tự động sửa Coin/Inventory/Mail/Reward. Cần canonical business proof ở bản sau.'},410);
    return out({error:'Reconciliation action không hợp lệ.'},400);
  }catch(e:any){console.error('[powder-admin-reconciliation 20.12]',e);return out({error:String(e?.message||e)},Number(e?.status)||500)}
});
