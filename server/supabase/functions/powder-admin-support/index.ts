import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAdminAccessV20160 } from "../_shared/admin-security-v20160.ts";
const VERSION='20.5.0';
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...H,'X-Powder-Support-Version':VERSION}});
const txt=(v:unknown,n=500)=>String(v??'').trim().slice(0,n);
const mask=(v:unknown)=>{const s=String(v??'');return s.length<=8?s:(s.slice(0,4)+'…'+s.slice(-4))};
const safeObj=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:H});
 if(req.method!=='POST')return out({error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:{user},error:ue}=await db.auth.getUser(jwt);if(ue||!user?.email)return out({error:'Phiên Admin không hợp lệ.'},401);
  const email=user.email.toLowerCase();const {data:a}=await db.from('admin_allowlist').select('role,active').eq('email',email).maybeSingle();
  if(!a?.active||!['owner','admin','support'].includes(String(a.role)))return out({error:'Không có quyền Player Support.'},403);
  const role=String(a.role),body=await req.json().catch(()=>({})),action=String(body.action||'state');
  const need=(roles:string[])=>{if(!roles.includes(role))throw Object.assign(new Error('Bạn không có quyền thực hiện thao tác này.'),{status:403})};
  const audit=async(name:string,target:string|null,details:any={})=>{await db.from('admin_audit_logs').insert({admin_user_id:user.id,admin_email:email,action:name,target_user_id:target,details:{version:VERSION,role,...details}})};
  const resolveUser=async(q0:unknown)=>{const q=txt(q0,120);if(!q)throw Object.assign(new Error('Nhập Tamer UID, email hoặc user ID.'),{status:400});let r:any;
    if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(q))r=await db.from('profiles').select('*').eq('id',q).maybeSingle();
    else if(q.includes('@'))r=await db.from('profiles').select('*').eq('email',q.toLowerCase()).maybeSingle();
    else r=await db.from('profiles').select('*').eq('tamer_uid',q).maybeSingle();
    if(r?.error)throw r.error;if(!r?.data)throw Object.assign(new Error('Không tìm thấy người chơi.'),{status:404});return r.data;};
  const compactRewards=(v:any)=>{const p=safeObj(v),r:any={};for(const k of ['coins','knowledge','powCandyCommon','powCandyRare','powCandyLegendary','artifactTickets','elementCoin']){const n=Math.max(0,Math.trunc(Number(p[k]||0)));if(n)r[k]=n}if(p.powballs&&typeof p.powballs==='object'){const b:any={};for(const k of ['common','rare','super_rare','epic','legendary','mythic','ancient']){const n=Math.max(0,Math.trunc(Number(p.powballs[k]||0)));if(n)b[k]=n}if(Object.keys(b).length)r.powballs=b}return r};
  const summary=async(p:any)=>{const id=p.id;const [sv,ec,tp,pc,ac,eqc]=await Promise.all([
    db.from('player_saves').select('revision,schema_version,app_version,device_id,updated_at').eq('user_id',id).maybeSingle(),
    db.from('player_economy').select('coins,knowledge,pow_candy,pow_candy_rare,pow_candy_legendary,artifact_tickets,element_coin,powballs,updated_at').eq('user_id',id).maybeSingle(),
    db.from('tamer_progress').select('rank,tamer_exp,wins,mastery,first_zh,first_en,promotion_pending,updated_at').eq('user_id',id).maybeSingle(),
    db.from('player_pows').select('pow_id',{count:'exact',head:true}).eq('user_id',id),
    db.from('player_artifacts').select('instance_id',{count:'exact',head:true}).eq('user_id',id),
    db.from('player_equipment').select('equipment_id',{count:'exact',head:true}).eq('user_id',id)
  ]);return{profile:{id:p.id,tamerUid:p.tamer_uid,displayName:p.display_name,email:p.email,gameStatus:p.game_status,accountStatus:p.account_status,moderationReason:p.moderation_reason,createdAt:p.created_at,updatedAt:p.updated_at},save:sv.data?{revision:sv.data.revision,schemaVersion:sv.data.schema_version,appVersion:sv.data.app_version,device:mask(sv.data.device_id),updatedAt:sv.data.updated_at}:null,economy:ec.data||null,progress:tp.data||null,counts:{pows:pc.count||0,artifacts:ac.count||0,equipment:eqc.count||0}}};
  await enforceAdminAccessV20160({req,db,jwt,userId:user.id,email,role:role,functionName:'powder-admin-support',action:action});
  if(action==='state'){
    const [{data:posture,error:pe},{count:open},{count:pending},{count:critical}]=await Promise.all([
      db.rpc('powder_support_posture_v2050'),db.from('support_cases_v2050').select('id',{count:'exact',head:true}).in('status',['open','investigating','waiting_player','waiting_admin']),db.from('support_compensation_requests_v2050').select('id',{count:'exact',head:true}).eq('status','pending'),db.from('support_cases_v2050').select('id',{count:'exact',head:true}).eq('priority','critical').in('status',['open','investigating','waiting_admin'])
    ]);if(pe)throw pe;return out({ok:true,edgeVersion:VERSION,role,posture,stats:{openCases:open||0,pendingCompensations:pending||0,criticalCases:critical||0}})
  }
  if(action==='cases'){
    const status=String(body.status||'active'),priority=String(body.priority||'all');let q=db.from('support_cases_v2050').select('*').order('updated_at',{ascending:false}).limit(100);if(status==='active')q=q.in('status',['open','investigating','waiting_player','waiting_admin']);else if(status!=='all')q=q.eq('status',status);if(['low','normal','high','critical'].includes(priority))q=q.eq('priority',priority);const {data,error}=await q;if(error)throw error;const ids=[...new Set((data||[]).map((x:any)=>x.user_id))];const {data:ps,error:pe}=ids.length?await db.from('profiles').select('id,tamer_uid,display_name,email,game_status').in('id',ids):{data:[],error:null} as any;if(pe)throw pe;const pm=new Map((ps||[]).map((x:any)=>[x.id,x]));return out({ok:true,cases:(data||[]).map((x:any)=>({...x,player:pm.get(x.user_id)||null}))})
  }
  if(action==='compensations'){
    const status=String(body.status||'pending');let q=db.from('support_compensation_requests_v2050').select('*').order('requested_at',{ascending:false}).limit(100);if(status!=='all')q=q.eq('status',status);const {data,error}=await q;if(error)throw error;const ids=[...new Set((data||[]).map((x:any)=>x.user_id))];const {data:ps,error:pe}=ids.length?await db.from('profiles').select('id,tamer_uid,display_name,email,game_status').in('id',ids):{data:[],error:null} as any;if(pe)throw pe;const pm=new Map((ps||[]).map((x:any)=>[x.id,x]));return out({ok:true,requests:(data||[]).map((x:any)=>({...x,player:pm.get(x.user_id)||null}))})
  }
  if(action==='search'){
    const q=txt(body.query,120);if(!q)return out({ok:true,players:[]});let x=db.from('profiles').select('id,tamer_uid,display_name,email,game_status,account_status,created_at,updated_at').order('updated_at',{ascending:false}).limit(20);
    const safe=q.replace(/[(),%_]/g,' ');x=x.or(`tamer_uid.ilike.%${safe}%,display_name.ilike.%${safe}%,email.ilike.%${safe}%`);const {data,error}=await x;if(error)throw error;return out({ok:true,players:data||[]})
  }
  if(action==='player'){
    const p=await resolveUser(body.player||body.userId);const id=p.id;const [base,tx,mail,claims,pvp,eventClaims,eventProgress,mon,sec,acc,devices,logs,backups,cases,comp]=await Promise.all([
      summary(p),
      db.from('economy_transactions').select('id,tx_type,delta,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(40),
      db.from('mail_campaigns').select('id,title,audience,rewards,starts_at,expires_at,active,created_by,created_at').eq('recipient_user_id',id).order('created_at',{ascending:false}).limit(30),
      db.from('mail_claims').select('campaign_id,claimed_at,transaction_id').eq('user_id',id).order('claimed_at',{ascending:false}).limit(30),
      db.from('pvp_matches').select('id,status,player_a,player_b,winner_id,finish_reason,turn_no,created_at,started_at,completed_at').or(`player_a.eq.${id},player_b.eq.${id}`).order('created_at',{ascending:false}).limit(30),
      db.from('learning_event_claims_v167').select('event_id,claim_key,reward,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(30),
      db.from('learning_event_progress_v167').select('event_id,progress,claimed,currency_earned,currency_spent,updated_at').eq('user_id',id).order('updated_at',{ascending:false}).limit(20),
      db.from('monitoring_events').select('id,event_type,severity,message,client_version,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(30),
      db.from('security_incidents').select('id,severity,incident_type,source,status,created_at,resolved_at').eq('user_id',id).order('created_at',{ascending:false}).limit(20),
      db.from('account_events').select('id,event_type,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(30),
      db.from('account_devices').select('id,device_id,label,platform,browser,first_seen_at,last_seen_at,revoked_at').eq('user_id',id).order('last_seen_at',{ascending:false}).limit(20),
      db.from('admin_audit_logs').select('id,admin_email,action,details,created_at').eq('target_user_id',id).order('created_at',{ascending:false}).limit(30),
      db.from('player_backups').select('id,kind,reason,checksum,created_by,created_at,restored_at,restored_by').eq('user_id',id).order('created_at',{ascending:false}).limit(20),
      db.from('support_cases_v2050').select('*').eq('user_id',id).order('updated_at',{ascending:false}).limit(30),
      db.from('support_compensation_requests_v2050').select('*').eq('user_id',id).order('requested_at',{ascending:false}).limit(30)
    ]);
    const claimMap=new Map((claims.data||[]).map((x:any)=>[x.campaign_id,x]));const mails=(mail.data||[]).map((m:any)=>({...m,claim:claimMap.get(m.id)||null}));
    const dev=(devices.data||[]).map((d:any)=>({...d,device_id:mask(d.device_id)}));
    return out({ok:true,role,player:base,timeline:{transactions:tx.data||[],mails,pvp:pvp.data||[],eventClaims:eventClaims.data||[],eventProgress:eventProgress.data||[],monitoring:mon.data||[],security:sec.data||[],account:acc.data||[],devices:dev,adminLogs:logs.data||[],backups:backups.data||[],cases:cases.data||[],compensations:comp.data||[]}})
  }
  if(action==='create_case'){
    const p=await resolveUser(body.player||body.userId),category=['account','save','reward','pvp','event','technical','report','general'].includes(String(body.category))?String(body.category):'general',priority=['low','normal','high','critical'].includes(String(body.priority))?String(body.priority):'normal',subject=txt(body.subject,160),description=txt(body.description,3000);if(subject.length<3)return out({error:'Tiêu đề case quá ngắn.'},400);
    const {data,error}=await db.from('support_cases_v2050').insert({user_id:p.id,category,priority,subject,description,status:'open',created_by:email,assigned_to:email}).select().single();if(error)throw error;await audit('support2050_create_case',p.id,{caseId:data.id,category,priority,subject});return out({ok:true,case:data})
  }
  if(action==='add_note'){
    const caseId=txt(body.caseId,80),note=txt(body.note,2000);if(!caseId||!note)return out({error:'Thiếu case hoặc nội dung ghi chú.'},400);const {data:c}=await db.from('support_cases_v2050').select('id,user_id').eq('id',caseId).maybeSingle();if(!c)return out({error:'Không tìm thấy support case.'},404);const {data,error}=await db.from('support_case_notes_v2050').insert({case_id:caseId,author_email:email,author_role:role,note}).select().single();if(error)throw error;await db.from('support_cases_v2050').update({updated_at:new Date().toISOString()}).eq('id',caseId);await audit('support2050_note',c.user_id,{caseId,noteId:data.id});return out({ok:true,note:data})
  }
  if(action==='update_case'){
    const caseId=txt(body.caseId,80),status=['open','investigating','waiting_player','waiting_admin','resolved','closed'].includes(String(body.status))?String(body.status):'investigating';const {data:c}=await db.from('support_cases_v2050').select('*').eq('id',caseId).maybeSingle();if(!c)return out({error:'Không tìm thấy support case.'},404);const patch:any={status,updated_at:new Date().toISOString(),assigned_to:txt(body.assignedTo||c.assigned_to||email,160)};if(status==='resolved'||status==='closed'){patch.resolved_at=new Date().toISOString();patch.resolved_by=email}const {data,error}=await db.from('support_cases_v2050').update(patch).eq('id',caseId).select().single();if(error)throw error;await audit('support2050_case_status',c.user_id,{caseId,before:c.status,after:status});return out({ok:true,case:data})
  }
  if(action==='request_compensation'){
    const p=await resolveUser(body.player||body.userId),caseId=txt(body.caseId,80)||null,title=txt(body.title||'Bồi thường hỗ trợ Powder',120),reason=txt(body.reason,1000),rewards=compactRewards(body.rewards);if(!reason)return out({error:'Compensation cần lý do.'},400);const {data:valid,error:ve}=await db.rpc('powder_support_reward_valid_v2050',{p:rewards});if(ve)throw ve;if(!valid)return out({error:'Gói compensation vượt giới hạn Support hoặc có loại quà không được phép.'},400);if(caseId){const {data:c}=await db.from('support_cases_v2050').select('id,user_id').eq('id',caseId).maybeSingle();if(!c||c.user_id!==p.id)return out({error:'Support case không thuộc người chơi này.'},409)}const {data,error}=await db.from('support_compensation_requests_v2050').insert({case_id:caseId,user_id:p.id,title,reason,rewards,status:'pending',requested_by:email}).select().single();if(error)throw error;await audit('support2050_comp_request',p.id,{requestId:data.id,caseId,rewards});return out({ok:true,request:data})
  }
  if(action==='review_compensation'){
    need(['owner','admin']);const requestId=txt(body.requestId,80),decision=String(body.decision||'reject'),note=txt(body.note,1000);const {data:r}=await db.from('support_compensation_requests_v2050').select('*').eq('id',requestId).maybeSingle();if(!r)return out({error:'Không tìm thấy compensation request.'},404);
    if(decision==='approve'){const {data,error}=await db.rpc('powder_support_approve_compensation_v2050',{p_request:requestId,p_admin:email,p_note:note});if(error)throw error;await audit('support2050_comp_approved',r.user_id,{requestId,result:data});return out({ok:true,result:data})}
    if(r.status!=='pending')return out({error:'Request không còn ở trạng thái pending.'},409);const {error}=await db.from('support_compensation_requests_v2050').update({status:'rejected',reviewed_by:email,reviewed_at:new Date().toISOString(),review_note:note}).eq('id',requestId);if(error)throw error;await audit('support2050_comp_rejected',r.user_id,{requestId,note});return out({ok:true})
  }
  if(action==='moderate'){
    need(['owner','admin']);const p=await resolveUser(body.player||body.userId),status=['active','suspended','banned'].includes(String(body.status))?String(body.status):'active',reason=txt(body.reason,500);if(status!=='active'&&!reason)return out({error:'Khóa/cấm cần lý do.'},400);const before=p.game_status;const {error}=await db.from('profiles').update({game_status:status,moderation_reason:status==='active'?'':reason,moderation_until:null,last_admin_action_at:new Date().toISOString()}).eq('id',p.id);if(error)throw error;await audit('support2050_moderate',p.id,{before,after:status,reason});return out({ok:true,status})
  }
  if(action==='case_notes'){
    const caseId=txt(body.caseId,80);const {data,error}=await db.from('support_case_notes_v2050').select('*').eq('case_id',caseId).order('created_at',{ascending:false}).limit(100);if(error)throw error;return out({ok:true,notes:data||[]})
  }
  return out({error:'Support action không tồn tại.'},400)
 }catch(e:any){console.error(e);return out({error:e?.message||'Player Support server error'},Number(e?.status)||400)}
});
