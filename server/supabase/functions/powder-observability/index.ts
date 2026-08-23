import { createClient } from "npm:@supabase/supabase-js@2";
const VERSION='20.2.0';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-powder-device, x-powder-version","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'X-Powder-Observability-Version':VERSION}});
const txt=(v:unknown,n=120)=>String(v??'').trim().slice(0,n);
const num=(v:unknown,min=0,max=120000)=>{const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):0};
async function hexHash(v:string){const b=new TextEncoder().encode(v),d=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return out({error:'Bạn chưa đăng nhập.'},401);
    const {data:{user},error:ue}=await db.auth.getUser(jwt);if(ue||!user)return out({error:'Phiên đăng nhập không hợp lệ.'},401);
    const {data:profile}=await db.from('profiles').select('game_status,account_status').eq('id',user.id).maybeSingle();if(profile?.game_status&&profile.game_status!=='active')return out({error:'Tài khoản Powder chưa sẵn sàng.'},403);if(profile?.account_status&&profile.account_status!=='active')return out({error:'Tài khoản Online chưa sẵn sàng.'},403);
    const body=await req.json().catch(()=>({}));const channel=String(body.channel)==='staging'?'staging':'production';
    const {data:cfg,error:ce}=await db.from('observability_config_v2020').select('*').eq('channel',channel).single();if(ce)throw ce;if(!cfg?.enabled)return out({ok:true,enabled:false,accepted:0});
    const deviceId=txt(req.headers.get('x-powder-device')||body.deviceId,160);if(!deviceId)return out({error:'Thiếu device ID.'},400);
    const digest=await hexHash(`${user.id}|${deviceId}|${cfg.sample_salt||''}`),bucket=parseInt(digest.slice(0,8),16)/0xffffffff,rate=Math.max(0,Math.min(1,Number(cfg.sample_rate||0)));
    if(bucket>=rate)return out({ok:true,enabled:true,eligible:false,accepted:0});
    const {data:guard,error:ge}=await db.rpc('powder_rate_guard_v1831',{p_user:user.id,p_action:'observability:report',p_limit:4,p_window_seconds:60,p_weight:1,p_context:{edge:'powder-observability',version:VERSION}});if(ge)throw ge;if(guard?.allowed===false)return out({error:'Observability đang gửi quá nhanh.',rateLimited:true,retryAfterSeconds:guard.retryAfterSeconds},429);
    const buildId=txt(body.buildId,140),appVersion=txt(req.headers.get('x-powder-version')||body.appVersion,60),rollout=Math.max(0,Math.min(100,Math.trunc(Number(body.rolloutPercent)||100))),network=txt(body.networkType,24),deviceHash=digest.slice(0,24);
    const input=Array.isArray(body.samples)?body.samples.slice(0,80):[],rows:any[]=[];
    for(const s of input){const endpoint=txt(s?.endpoint,80).toLowerCase();if(!/^powder-[a-z0-9-]{1,64}$/.test(endpoint))continue;rows.push({channel,user_id:user.id,device_hash:deviceHash,app_version:appVersion,build_id:buildId,rollout_percent:rollout,endpoint,status_code:Math.trunc(num(s?.status,0,999)),latency_ms:Math.trunc(num(s?.latencyMs,0,120000)),ok:s?.ok===true,network_type:network});}
    if(rows.length){const {error}=await db.from('observability_api_samples_v2020').insert(rows);if(error)throw error;}
    const h=body.health&&typeof body.health==='object'?body.health:{};
    const healthRow={channel,user_id:user.id,device_hash:deviceHash,app_version:appVersion,build_id:buildId,rollout_percent:rollout,runtime_errors:Math.trunc(num(h.runtimeErrors,0,100000)),suspected_crashes:Math.trunc(num(h.suspectedCrashes,0,100000)),reconnects:Math.trunc(num(h.reconnects,0,100000)),save_conflicts:Math.trunc(num(h.saveConflicts,0,100000)),network_type:network};
    const {error:he}=await db.from('observability_client_health_v2020').insert(healthRow);if(he)throw he;
    return out({ok:true,enabled:true,eligible:true,accepted:rows.length,at:new Date().toISOString()});
  }catch(e:any){console.error(e);return out({error:e?.message||'Observability server error'},Number(e?.status)||400)}
});
