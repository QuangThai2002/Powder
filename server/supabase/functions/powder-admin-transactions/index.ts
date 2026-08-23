import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";
const VERSION='20.9.0',BUILD='powder-20.9.0-data-integrity-transaction-safety';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Transaction-Version':VERSION}});
const txt=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n);
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return out({error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');const {data:{user},error:ue}=await db.auth.getUser(jwt);if(ue||!user?.email)return out({error:'Phiên Admin không hợp lệ.'},401);
  const email=user.email.toLowerCase(),{data:allow}=await db.from('admin_allowlist').select('role,active').eq('email',email).maybeSingle();if(!allow?.active)return out({error:'Không có quyền Transaction Safety.'},403);const role=String(allow.role||'support');
  const body=await req.json().catch(()=>({})),action=String(body.action||'state');
  const need=(roles:string[])=>{if(!roles.includes(role))throw Object.assign(new Error('Không đủ quyền Transaction Safety mutation.'),{status:403})};
  const audit=async(name:string,details:any)=>db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,details:{version:VERSION,buildId:BUILD,...details}});
  async function state(){
   const [{data:posture,error:pe},{data:receipts,error:re},{data:queue,error:qe},{data:events,error:ee}]=await Promise.all([
    db.rpc('powder_transaction_posture_v2090'),
    db.from('transaction_receipts_v2090').select('user_id,scope,tx_key,operation,status,attempt_count,error_code,created_at,updated_at,committed_at').order('updated_at',{ascending:false}).limit(80),
    db.from('transaction_recovery_queue_v2090').select('*').order('created_at',{ascending:false}).limit(80),
    db.from('transaction_integrity_events_v2090').select('*').order('created_at',{ascending:false}).limit(60)
   ]);if(pe||re||qe||ee)throw pe||re||qe||ee;return{ok:true,edgeVersion:VERSION,buildId:BUILD,role,posture,receipts:receipts||[],recovery:queue||[],events:events||[],serverTime:new Date().toISOString()};
  }
  await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-transactions',action:action});
  if(action==='state')return out(await state());
  if(action==='scan'){need(['owner','admin']);const limit=Math.max(1,Math.min(500,Math.trunc(Number(body.limit)||100)));const {data,error}=await db.rpc('powder_transaction_reconcile_scan_v2090',{p_limit:limit,p_actor:email});if(error)throw error;await audit('transaction2090_reconcile_scan',{limit,result:data});return out({ok:true,result:data,state:await state()});}
  if(action==='resolve'){
   need(['owner']);const recoveryId=txt(body.recoveryId,80),resolution=txt(body.resolution,32),note=txt(body.note,1200);if(!/^[0-9a-f-]{36}$/i.test(recoveryId))return out({error:'Recovery ID không hợp lệ.'},400);if(!['committed','not_committed','cancelled'].includes(resolution))return out({error:'Resolution không hợp lệ.'},400);if(note.length<12)return out({error:'Resolution cần ghi chú điều tra tối thiểu 12 ký tự.'},400);
   const {data,error}=await db.rpc('powder_transaction_resolve_v2090',{p_recovery_id:recoveryId,p_resolution:resolution,p_actor:email,p_note:note});if(error)throw error;await audit('transaction2090_resolve',{recoveryId,resolution,note});return out({ok:true,result:data,state:await state()});
  }
  return out({error:'Transaction Safety action không tồn tại.'},400);
 }catch(e:any){console.error(e);return out({error:e?.message||'Admin Transaction Safety error'},Number(e?.status)||400)}
});
