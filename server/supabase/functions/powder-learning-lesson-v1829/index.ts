import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-powder-device, x-powder-version","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const out=(d:unknown,s=200,extra:Record<string,string>={})=>new Response(JSON.stringify(d),{status:s,headers:{...cors,...extra}});
const str=(v:unknown,n=180)=>String(v??'').trim().slice(0,n);
const ids=(v:unknown,n=5000)=>[...new Set((Array.isArray(v)?v:[]).map(x=>str(x,220)).filter(Boolean))].slice(0,n);
const canonical=(id:string)=>String(id||'').replace(/^rotq178:\d+:/,'');
function jwtIat(jwt:string){try{let x=jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');while(x.length%4)x+='=';return Number(JSON.parse(atob(x)).iat||0)}catch{return 0}}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return out({error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:{user},error:ue}=await db.auth.getUser(jwt);
  if(ue||!user)return out({error:'Phiên đăng nhập không hợp lệ.'},401);
  const {data:profile}=await db.from('profiles').select('game_status,account_status,moderation_reason').eq('id',user.id).maybeSingle();
  if(profile?.game_status&&profile.game_status!=='active')return out({error:profile.moderation_reason||'Tài khoản Powder chưa sẵn sàng.'},403);
  if(profile?.account_status&&profile.account_status!=='active')return out({error:'Tài khoản chưa sẵn sàng cho dịch vụ Online.'},403);

  const deviceId=str(req.headers.get('x-powder-device'),120),clientVersion=str(req.headers.get('x-powder-version'),80),iat=jwtIat(jwt);
  if(deviceId){const {data:d}=await db.from('account_devices').select('revoked_at').eq('user_id',user.id).eq('device_id',deviceId).maybeSingle();if(d?.revoked_at&&(!iat||iat*1000<=Date.parse(d.revoked_at)))return out({error:'Thiết bị này đã được đăng xuất từ thiết bị khác.',revoked:true},401)}
  const {data:g,error:ge}=await db.rpc('powder_rate_guard_v1831',{p_user:user.id,p_action:'learning:lesson_start',p_limit:30,p_window_seconds:60,p_weight:1,p_context:{edge:'powder-learning-lesson-v1829',deviceId,clientVersion}});
  if(ge)throw ge;
  if(g?.allowed===false)return out({error:'Bạn mở bài học quá nhanh. Hãy thử lại sau.',rateLimited:true,retryAfterSeconds:g.retryAfterSeconds},429,{'Retry-After':String(g.retryAfterSeconds||1)});

  const b=await req.json().catch(()=>({})),lessonId=str(b.lessonId,180);
  if(!lessonId)return out({error:'LessonID không hợp lệ.'},400);
  const requestedCandidates=ids(b.candidateQuestionIds,5000),preferred=ids(b.questionIds,200);
  const [{data:tp,error:te},{data:lesson,error:le}]=await Promise.all([
   db.from('tamer_progress').select('rank').eq('user_id',user.id).maybeSingle(),
   db.from('lesson_catalog').select('lesson_id,language,rank,difficulty,enabled').eq('lesson_id',lessonId).maybeSingle()
  ]);
  if(te)throw te;if(le)throw le;
  if(!lesson?.enabled)return out({error:'Bài học không tồn tại hoặc đang tắt.'},404);
  const rank=Math.max(0,Math.min(6,Number(tp?.rank)||0));
  if(rank<Number(lesson.rank||0))return out({error:'Bài học chưa mở ở Rank hiện tại.'},409);

  const {data:bank,error:be}=await db.from('learning_question_bank_v176').select('question_id').eq('lesson_id',lessonId).eq('language',String(lesson.language||'')).eq('enabled',true).neq('content_hash','').lte('rank',rank).limit(5000);
  if(be)throw be;
  const serverIds=[...new Set((bank||[]).map((x:any)=>String(x.question_id||'')).filter(Boolean))];
  const lo=lesson.difficulty==='hard'?40:lesson.difficulty==='deep'?55:30;
  const candidateSet=new Set(requestedCandidates);
  const eligible=requestedCandidates.length?serverIds.filter(id=>candidateSet.has(id)||candidateSet.has(canonical(id))):serverIds;
  if(eligible.length<lo){
   return out({error:`Bộ câu Online chưa khớp bản game hiện tại (${eligible.length}/${lo}). Hãy cập nhật trang rồi thử lại.`,code:'CLIENT_BANK_MISMATCH',required:lo,serverAvailable:serverIds.length,clientCandidates:requestedCandidates.length,overlap:eligible.length},409);
  }
  const eligibleSet=new Set(eligible),used=new Set<string>(),core:string[]=[];
  for(const clientId of preferred){
   const exact=eligibleSet.has(clientId)?clientId:eligible.find(id=>!used.has(id)&&canonical(id)===clientId);
   if(exact&&!used.has(exact)){used.add(exact);core.push(exact)}
   if(core.length>=65)break;
  }
  const {data,error}=await db.rpc('powder_learning_session_start_v176',{p_user:user.id,p_type:'lesson',p_lesson:lessonId,p_language:String(lesson.language||''),p_level:str(b.level,40),p_question_ids:{core,pool:eligible},p_client:str(b.clientVersion||clientVersion,100),p_device:str(b.deviceId||deviceId,120)});
  if(error)throw error;
  const serverQuestionIds=ids((data as any)?.questionIds,65);
  const aliases=serverQuestionIds.map(serverId=>({serverId,clientId:candidateSet.has(serverId)?serverId:canonical(serverId)}));
  if(aliases.some(x=>!candidateSet.has(x.clientId)))return out({error:'Máy chủ tạo phiên có câu không tồn tại trong bản game hiện tại.',code:'SESSION_ALIAS_MISMATCH'},409);
  return out({ok:true,result:{...(data||{}),difficulty:lesson.difficulty,authority:'server-canonical-alias-v21210',eligibleCount:eligible.length,preferredCount:core.length,questionAliases:aliases}});
 }catch(e:any){console.error(e);return out({error:e?.message||'Secure lesson server error'},Number(e?.status)||400)}
});
