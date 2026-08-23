import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION="18.8.1";
const TURN_SECONDS=45;
const RECONNECT_GRACE_SECONDS=90;
const MAX_AFK_STRIKES=3;
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-powder-device, x-powder-version",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};
const out=(d:unknown,s=200,extra:Record<string,string>={})=>new Response(JSON.stringify(d),{status:s,headers:{...cors,...extra,"X-Powder-PvP-Version":VERSION}});
function jwtIat(jwt:string){try{let x=jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');while(x.length%4)x+='=';return Number(JSON.parse(atob(x)).iat||0)}catch{return 0}}
function limitInt(v:unknown,min:number,max:number,fallback:number){const n=Math.floor(Number(v));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function identityDto(x:any){if(!x)return null;return{powId:x.pow_id,primaryRole:x.primary_role,secondaryRole:x.secondary_role,archetype:x.archetype,passiveName:x.passive_name,passiveIdentity:x.passive_summary,combo:x.combo,strengths:x.strengths||[],weakness:x.weakness,synergy:x.synergy,counter:x.counter,starIdentity:x.star_identity||[],signature:x.signature,sourceVersion:x.source_version}}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    if(!jwt)return out({error:'Bạn chưa đăng nhập.'},401);
    const {data:{user},error:ue}=await db.auth.getUser(jwt);
    if(ue||!user)return out({error:'Phiên đăng nhập không hợp lệ.'},401);
    const {data:profile}=await db.from('profiles').select('game_status,account_status,moderation_reason').eq('id',user.id).maybeSingle();
    if(profile?.game_status&&profile.game_status!=='active')return out({error:profile.moderation_reason||'Tài khoản Powder đang bị khóa.'},403);
    if(profile?.account_status&&profile.account_status!=='active')return out({error:'Tài khoản chưa sẵn sàng cho dịch vụ Online.'},403);

    const deviceId=String(req.headers.get('x-powder-device')||'').slice(0,120);
    const clientVersion=String(req.headers.get('x-powder-version')||'').slice(0,80);
    const iat=jwtIat(jwt);
    if(deviceId){
      const {data:d}=await db.from('account_devices').select('revoked_at').eq('user_id',user.id).eq('device_id',deviceId).maybeSingle();
      if(d?.revoked_at&&(!iat||iat*1000<=Date.parse(d.revoked_at)))return out({error:'Thiết bị này đã được đăng xuất từ thiết bị khác.',revoked:true},401);
    }

    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'state').toLowerCase();
    const limits:Record<string,[number,number]>={
      state:[180,60],challenge:[10,60],cancel_challenge:[20,60],respond_challenge:[20,60],lock_team:[12,60],
      act:[90,60],pass:[90,60],forfeit:[8,60],ack_result:[30,60],history:[30,60],replay:[20,60],rematch:[10,60],domain_activate:[24,60],domain_questions:[30,60],domain_answer:[30,60]
    };
    const lim=limits[action]||[30,60];
    const {data:guard,error:ge}=await db.rpc('powder_rate_guard_v1831',{
      p_user:user.id,p_action:`pvp:${action}`,p_limit:lim[0],p_window_seconds:lim[1],p_weight:1,
      p_context:{edge:'powder-pvp',edgeVersion:VERSION,deviceId,clientVersion}
    });
    if(ge)throw ge;
    if(guard?.allowed===false)return out({error:'Bạn thao tác quá nhanh. Hãy thử lại sau.',rateLimited:true,retryAfterSeconds:guard.retryAfterSeconds},429,{'Retry-After':String(guard.retryAfterSeconds||1)});

    async function hydrateMatch(m:any,eventLimit=80){
      if(!m)return null;
      const ids=[m.player_a,m.player_b];
      await db.from('pvp_match_players').update({last_seen_at:new Date().toISOString()}).eq('match_id',m.id).eq('user_id',user.id);
      const [{data:players},{data:pows},{data:profiles},{data:events}]=await Promise.all([
        db.from('pvp_match_players').select('*').eq('match_id',m.id),
        db.from('pvp_match_pows').select('*').eq('match_id',m.id).order('slot'),
        db.from('profiles').select('id,tamer_uid,display_name').in('id',ids),
        db.from('pvp_match_events').select('id,turn_no,actor_user_id,actor_pow_id,target_pow_id,event_type,payload,created_at').eq('match_id',m.id).order('id',{ascending:false}).limit(eventLimit)
      ]);
      const powIds=[...new Set((pows||[]).map((p:any)=>p.pow_id))];
      const [{data:catalog},{data:identities}]=powIds.length?await Promise.all([
        db.from('pvp_pow_catalog').select('pow_id,name,element,role,skills').in('pow_id',powIds),
        db.from('pvp_pow_identity_v1881').select('pow_id,primary_role,secondary_role,archetype,passive_name,passive_summary,combo,strengths,weakness,synergy,counter,star_identity,signature,source_version').in('pow_id',powIds)
      ]):[{data:[] as any[]},{data:[] as any[]}];
      const im=new Map((identities||[]).map((x:any)=>[x.pow_id,identityDto(x)]));
      const cm=new Map((catalog||[]).map((x:any)=>[x.pow_id,{...x,identity:im.get(x.pow_id)||null}]));
      const pm=new Map((profiles||[]).map((x:any)=>[x.id,x]));
      const pmap=new Map((players||[]).map((x:any)=>[x.user_id,x]));
      const all=(pows||[]).map((p:any)=>({...p,catalog:cm.get(p.pow_id)||null,active:false,reserve:true}));
      for(const uid of ids){
        all.filter((x:any)=>x.user_id===uid&&!x.eliminated&&x.hp>0).sort((a:any,b:any)=>a.slot-b.slot).slice(0,3).forEach((x:any)=>{x.active=true;x.reserve=false});
      }
      const now=Date.now(),turnStarted=m.turn_started_at?Date.parse(m.turn_started_at):0;
      const turnRemaining=m.status==='active'?Math.max(0,TURN_SECONDS-Math.floor((now-turnStarted)/1000)):0;
      const eventRows=(events||[]).reverse();
      const lastEventId=eventRows.length?Number(eventRows[eventRows.length-1]?.id||0):0;
      return {
        id:m.id,status:m.status,currentPlayer:m.current_player,turnNo:m.turn_no,turnStartedAt:m.turn_started_at||null,
        turnSeconds:TURN_SECONDS,turnRemaining,reconnectGraceSeconds:RECONNECT_GRACE_SECONDS,maxAfkStrikes:MAX_AFK_STRIKES,
        winnerId:m.winner_id,finishReason:m.finish_reason,createdAt:m.created_at,startedAt:m.started_at,completedAt:m.completed_at,
        updatedAt:m.updated_at,serverNow:new Date(now).toISOString(),stateVersion:`${m.id}:${m.status}:${m.turn_no}:${lastEventId}`,
        me:user.id,
        players:ids.map((id:string)=>{const q:any=pmap.get(id)||{},profile:any=pm.get(id)||{};const last=Date.parse(q.last_seen_at||0);return{id,...profile,ready:!!q.ready,team:q.team||[],connected:now-last<RECONNECT_GRACE_SECONDS*1000,lastSeenAt:q.last_seen_at,forfeited:!!q.forfeited,afkStrikes:Number(q.afk_strikes||0),simpleId:q.simple_id||null,simpleLevel:Number(q.simple_level||1),simpleCharges:Number(q.simple_charges??3),simpleState:q.simple_state||{},expansionId:q.expansion_id||null,expansionUsed:!!q.expansion_used,expansionState:q.expansion_state||{},domainLoadoutLocked:!!q.domain_loadout_locked}}),
        pows:all,events:eventRows
      };
    }

    async function state(){
      const nowIso=new Date().toISOString();
      await db.from('pvp_challenges').update({status:'expired',responded_at:nowIso}).eq('status','pending').lt('expires_at',nowIso);
      let {data:live}=await db.from('pvp_matches').select('*').or(`player_a.eq.${user.id},player_b.eq.${user.id}`).in('status',['lobby','active']).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(live?.status==='active'){
        // Resolve from the server clock before refreshing presence. This preserves the 90s reconnect grace semantics.
        const tr=await db.rpc('powder_pvp_resolve_timeout_v1831',{p_match:live.id});
        if(tr.error)throw tr.error;
        const refreshed=await db.from('pvp_matches').select('*').eq('id',live.id).maybeSingle();
        live=refreshed.data||live;
      }
      const [{data:inc},{data:outg}]=await Promise.all([
        db.from('pvp_challenges').select('id,challenger_id,challenged_id,status,created_at,expires_at').eq('challenged_id',user.id).eq('status','pending').order('created_at',{ascending:false}),
        db.from('pvp_challenges').select('id,challenger_id,challenged_id,status,created_at,expires_at').eq('challenger_id',user.id).eq('status','pending').order('created_at',{ascending:false})
      ]);
      const challengeIds=[...(inc||[]).map((x:any)=>x.challenger_id),...(outg||[]).map((x:any)=>x.challenged_id)];
      const {data:cprofiles}=challengeIds.length?await db.from('profiles').select('id,tamer_uid,display_name').in('id',[...new Set(challengeIds)]):{data:[] as any[]};
      const cp=new Map((cprofiles||[]).map((p:any)=>[p.id,p]));
      let m:any=live;
      if(!m){
        const {data:done}=await db.from('pvp_matches').select('*,pvp_match_players!inner(user_id,result_seen)').or(`player_a.eq.${user.id},player_b.eq.${user.id}`).eq('status','completed').eq('pvp_match_players.user_id',user.id).eq('pvp_match_players.result_seen',false).order('completed_at',{ascending:false}).limit(1).maybeSingle();
        m=done;
      }
      const match=await hydrateMatch(m,80);
      const {data:owned}=await db.from('player_pows').select('pow_id,level,stars,shiny').eq('user_id',user.id).order('obtained_at');
      const ownedIds=(owned||[]).map((x:any)=>x.pow_id);
      const [{data:cats},{data:ownedIdentity}]=ownedIds.length?await Promise.all([
        db.from('pvp_pow_catalog').select('pow_id,name,element,role,skills').in('pow_id',ownedIds),
        db.from('pvp_pow_identity_v1881').select('pow_id,primary_role,secondary_role,archetype,passive_name,passive_summary,combo,strengths,weakness,synergy,counter,star_identity,signature,source_version').in('pow_id',ownedIds)
      ]):[{data:[] as any[]},{data:[] as any[]}];
      const oim=new Map((ownedIdentity||[]).map((x:any)=>[x.pow_id,identityDto(x)]));
      const om=new Map((cats||[]).map((x:any)=>[x.pow_id,{...x,identity:oim.get(x.pow_id)||null}]));
      const {data:stats}=await db.from('pvp_player_stats').select('wins,losses,forfeits,matches').eq('user_id',user.id).maybeSingle();
      return {
        edgeVersion:VERSION,domainVersion:'18.8.0',identityVersion:'18.8.1',serverNow:new Date().toISOString(),myUserId:user.id,
        stats:stats||{wins:0,losses:0,forfeits:0,matches:0},
        incoming:(inc||[]).map((x:any)=>({...x,profile:cp.get(x.challenger_id)||null})),
        outgoing:(outg||[]).map((x:any)=>({...x,profile:cp.get(x.challenged_id)||null})),
        roster:(owned||[]).map((x:any)=>({...x,catalog:om.get(x.pow_id)||null})).filter((x:any)=>x.catalog),
        match
      };
    }

    async function history(){
      const wanted=limitInt(body.limit,1,30,15);
      const {data:matches,error:me}=await db.from('pvp_matches').select('id,player_a,player_b,status,winner_id,finish_reason,created_at,started_at,completed_at,turn_no').or(`player_a.eq.${user.id},player_b.eq.${user.id}`).eq('status','completed').order('completed_at',{ascending:false}).limit(wanted);
      if(me)throw me;
      const opponentIds=[...new Set((matches||[]).map((m:any)=>m.player_a===user.id?m.player_b:m.player_a))];
      const matchIds=(matches||[]).map((m:any)=>m.id);
      const [{data:profiles},{data:mp}]=await Promise.all([
        opponentIds.length?db.from('profiles').select('id,tamer_uid,display_name').in('id',opponentIds):Promise.resolve({data:[] as any[]}),
        matchIds.length?db.from('pvp_match_players').select('match_id,user_id,team,forfeited,afk_strikes').in('match_id',matchIds):Promise.resolve({data:[] as any[]})
      ]);
      const pmap=new Map((profiles||[]).map((p:any)=>[p.id,p]));
      const rows=(matches||[]).map((m:any)=>{
        const opponentId=m.player_a===user.id?m.player_b:m.player_a;
        const mine=(mp||[]).find((x:any)=>x.match_id===m.id&&x.user_id===user.id);
        const theirs=(mp||[]).find((x:any)=>x.match_id===m.id&&x.user_id===opponentId);
        return {id:m.id,opponentId,opponent:pmap.get(opponentId)||null,result:m.winner_id===user.id?'win':m.winner_id?'loss':'draw',winnerId:m.winner_id,finishReason:m.finish_reason,turnNo:m.turn_no,createdAt:m.created_at,startedAt:m.started_at,completedAt:m.completed_at,myTeam:mine?.team||[],opponentTeam:theirs?.team||[]};
      });
      return {ok:true,history:rows,serverNow:new Date().toISOString()};
    }

    async function replay(){
      const matchId=String(body.matchId||'');
      if(!matchId)throw new Error('Thiếu matchId replay.');
      const {data:m,error:me}=await db.from('pvp_matches').select('*').eq('id',matchId).maybeSingle();
      if(me)throw me;if(!m)throw new Error('Trận PvP không tồn tại.');
      if(user.id!==m.player_a&&user.id!==m.player_b)throw new Error('Bạn không có quyền xem replay trận này.');
      const ids=[m.player_a,m.player_b];
      const [{data:players},{data:pows},{data:profiles},{data:events}]=await Promise.all([
        db.from('pvp_match_players').select('user_id,team,forfeited,afk_strikes,simple_id,simple_level,simple_charges,simple_state,expansion_id,expansion_used,expansion_state,domain_loadout_locked').eq('match_id',matchId),
        db.from('pvp_match_pows').select('*').eq('match_id',matchId).order('user_id').order('slot'),
        db.from('profiles').select('id,tamer_uid,display_name').in('id',ids),
        db.from('pvp_match_events').select('id,turn_no,actor_user_id,actor_pow_id,target_pow_id,event_type,payload,created_at').eq('match_id',matchId).order('id',{ascending:true}).limit(1200)
      ]);
      const powIds=[...new Set((pows||[]).map((p:any)=>p.pow_id))];
      const [{data:catalog},{data:identities}]=powIds.length?await Promise.all([
        db.from('pvp_pow_catalog').select('pow_id,name,element,role,skills').in('pow_id',powIds),
        db.from('pvp_pow_identity_v1881').select('pow_id,primary_role,secondary_role,archetype,passive_name,passive_summary,combo,strengths,weakness,synergy,counter,star_identity,signature,source_version').in('pow_id',powIds)
      ]):[{data:[] as any[]},{data:[] as any[]}];
      const im=new Map((identities||[]).map((x:any)=>[x.pow_id,identityDto(x)]));
      const cm=new Map((catalog||[]).map((x:any)=>[x.pow_id,{...x,identity:im.get(x.pow_id)||null}]));
      return {ok:true,replay:{edgeVersion:VERSION,match:{id:m.id,status:m.status,playerA:m.player_a,playerB:m.player_b,winnerId:m.winner_id,finishReason:m.finish_reason,turnNo:m.turn_no,createdAt:m.created_at,startedAt:m.started_at,completedAt:m.completed_at},players:(players||[]).map((x:any)=>({...x,profile:(profiles||[]).find((p:any)=>p.id===x.user_id)||null})),pows:(pows||[]).map((x:any)=>({...x,catalog:cm.get(x.pow_id)||null})),events:events||[]}};
    }


    async function domainQuestions(){
      const matchId=String(body.matchId||'');const expectedTurnNo=Number(body.expectedTurnNo);
      if(!matchId||!Number.isInteger(expectedTurnNo))throw new Error('Thiếu trạng thái lượt cho câu hỏi Lãnh Địa.');
      const {data:m,error:me}=await db.from('pvp_matches').select('*').eq('id',matchId).maybeSingle();if(me)throw me;
      if(!m||m.status!=='active'||m.current_player!==user.id||Number(m.turn_no)!==expectedTurnNo)throw new Error('STALE_PVP_STATE: lượt Lãnh Địa đã thay đổi');
      const other=m.player_a===user.id?m.player_b:m.player_a;
      const {data:players,error:pe}=await db.from('pvp_match_players').select('user_id,expansion_state').eq('match_id',matchId).in('user_id',[user.id,other]);if(pe)throw pe;
      const mine=(players||[]).find((x:any)=>x.user_id===user.id),foe=(players||[]).find((x:any)=>x.user_id===other);
      const gates:Array<{gate:string,owner:string}>=[];
      if(mine?.expansion_state?.active&&mine.expansion_state?.id==='limitless_void')gates.push({gate:'owner',owner:user.id});
      if(foe?.expansion_state?.active&&foe.expansion_state?.id==='limitless_void')gates.push({gate:'hostile',owner:other});
      const packs:any[]=[];
      for(const g of gates){
        const {data:sess,error:se}=await db.rpc('powder_pvp_domain_question_open_v1880',{p_user:user.id,p_match:matchId,p_gate:g.gate,p_domain_owner:g.owner,p_expected_turn_no:expectedTurnNo});if(se)throw se;
        let questions:any[]=[];
        if(!sess?.answered&&Array.isArray(sess?.questionIds)&&sess.questionIds.length){
          const {data:qrows,error:qe}=await db.from('question_catalog').select('question_id,prompt,options,question_type,difficulty,category').in('question_id',sess.questionIds);if(qe)throw qe;
          const qm=new Map((qrows||[]).map((q:any)=>[q.question_id,q]));questions=sess.questionIds.map((id:string)=>qm.get(id)).filter(Boolean);
        }
        packs.push({sessionId:sess?.sessionId,gate:sess?.gate,domainOwner:sess?.domainOwner,answered:!!sess?.answered,correct:Number(sess?.correct||0),wrong:Number(sess?.wrong||0),questions});
      }
      return {ok:true,domainVersion:'18.8.0',packs,serverNow:new Date().toISOString()};
    }

    if(action==='state')return out({ok:true,state:await state()});
    if(action==='history')return out(await history());
    if(action==='replay')return out(await replay());
    if(action==='domain_questions')return out(await domainQuestions());

    let r:any;
    if(action==='challenge')r=await db.rpc('powder_pvp_create_challenge_v1831',{p_user:user.id,p_target:String(body.userId||'')});
    else if(action==='cancel_challenge')r=await db.rpc('powder_pvp_cancel_challenge',{p_user:user.id,p_challenge:String(body.challengeId||'')});
    else if(action==='respond_challenge')r=await db.rpc('powder_pvp_respond_challenge_v1831',{p_user:user.id,p_challenge:String(body.challengeId||''),p_decision:String(body.decision||'decline')});
    else if(action==='lock_team')r=await db.rpc('powder_pvp_lock_team_v1880',{p_user:user.id,p_match:String(body.matchId||''),p_team:Array.isArray(body.team)?body.team:[],p_domain:body.domainLoadout&&typeof body.domainLoadout==='object'?body.domainLoadout:{}});
    else if(action==='act'||action==='pass'){
      const clientActionId=String(body.clientActionId||'');
      const expectedTurnNo=Number(body.expectedTurnNo);
      const harden=clientActionId.length>=8&&Number.isInteger(expectedTurnNo)&&expectedTurnNo>0;
      if(harden){
        r=await db.rpc('powder_pvp_action_v1880',{
          p_user:user.id,p_match:String(body.matchId||''),p_actor:action==='pass'?'':String(body.actorPowId||''),
          p_target:action==='pass'?'':String(body.targetPowId||''),p_skill:action==='pass'?'pass':String(body.skillSlot||'basic'),
          p_client_action_id:clientActionId,p_expected_turn_no:expectedTurnNo
        });
      }else{
        // Compatibility path for 18.6.x clients; 18.7.0 always sends actionId + expectedTurnNo.
        r=await db.rpc('powder_pvp_action',{
          p_user:user.id,p_match:String(body.matchId||''),p_actor:action==='pass'?'':String(body.actorPowId||''),
          p_target:action==='pass'?'':String(body.targetPowId||''),p_skill:action==='pass'?'pass':String(body.skillSlot||'basic')
        });
      }
    }
    else if(action==='domain_activate')r=await db.rpc('powder_pvp_domain_activate_v1880',{p_user:user.id,p_match:String(body.matchId||''),p_kind:String(body.kind||''),p_id:String(body.id||''),p_client_action_id:String(body.clientActionId||''),p_expected_turn_no:Number(body.expectedTurnNo)});
    else if(action==='domain_answer')r=await db.rpc('powder_pvp_domain_question_answer_v1880',{p_user:user.id,p_session:String(body.sessionId||''),p_answers:Array.isArray(body.answers)?body.answers:[],p_expected_turn_no:Number(body.expectedTurnNo)});
    else if(action==='forfeit')r=await db.rpc('powder_pvp_forfeit',{p_user:user.id,p_match:String(body.matchId||'')});
    else if(action==='ack_result')r=await db.rpc('powder_pvp_ack_result',{p_user:user.id,p_match:String(body.matchId||'')});
    else if(action==='rematch')r=await db.rpc('powder_pvp_rematch_v1870',{p_user:user.id,p_match:String(body.matchId||'')});
    else return out({error:'PvP action không tồn tại.'},400);

    if(r.error)throw r.error;
    return out({ok:true,result:r.data,state:await state()});
  }catch(e:any){
    console.error(e);
    const msg=e?.message||'PvP server error';
    return out({error:msg,stale:String(msg).startsWith('STALE_PVP_STATE'),edgeVersion:VERSION},Number(e?.status)||400);
  }
});
