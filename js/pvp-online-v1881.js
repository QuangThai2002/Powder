(()=>{'use strict';
const VERSION='18.8.1';
const SIMPLE_DOMAINS=[['crimson','Xích Viêm Sát Giới','Hỏa'],['tide','Huyền Thủy Trấn Giới','Thủy'],['verdant','Thanh Mộc Huyết Giới','Mộc']];
const EXPANSIONS=[['nine_suns','Cửu Nhật Phần Thiên Giới','Thường'],['infinite_strike','Thiên Kích Vô Tận Giới','Thường'],['limitless_void','Vô Lượng Không Xứ','Đặc biệt'],['frozen_silence','Huyền Băng Tịch Diệt Giới','Thường'],['diamond_guard','Bất Động Kim Cương Giới','Thường'],['jackpot_bagua','Tọa Sát Bát Đồ','Đặc biệt'],['myriad_poison','Vạn Độc Phệ Sinh Giới','Thường'],['rebirth_wood','Vạn Mộc Luân Sinh Giới','Thường'],['draw_swords','Rút Kiếm Ra','Đặc biệt']];
if(EXPANSIONS.length!==9||EXPANSIONS.filter(x=>x[2]==='Thường').length!==6||EXPANSIONS.filter(x=>x[2]==='Đặc biệt').length!==3)throw new Error('POWDER_DOMAIN_LOCK_V1880');
const domainName=id=>EXPANSIONS.find(x=>x[0]===id)?.[1]||SIMPLE_DOMAINS.find(x=>x[0]===id)?.[1]||String(id||'—');
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const online=()=>window.POWDER_ONLINE_V150, app=()=>window.POWDER_APP, data=()=>window.POWDER_DATA;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const st={data:null,busy:false,poll:0,clock:0,offline:navigator.onLine===false,teamDraft:[],simpleDraftId:'crimson',simpleDraftLevel:1,expansionDraftId:'nine_suns',selectedActor:'',selectedTarget:'',selectedSkill:'basic',actionBusy:false,domainBusy:false,notice:'',history:[],historyLoadedAt:0,replay:null,replayCursor:0,lastMatchId:'',restoring:false,lastResponseAt:0};

function toast(text){let e=$('#pvp1870Toast');if(!e){e=document.createElement('div');e.id='pvp1870Toast';e.className='pvp1870-toast';e.hidden=true;document.body.appendChild(e)}e.textContent=String(text||'');e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,3200)}
function isSocialVisible(){const v=$('#socialView');return !!v&&!v.hidden}
function isLiveMatch(m=st.data?.match){return !!m&&['lobby','active'].includes(String(m.status||''))}
function isInMatch(){return isLiveMatch()}
function uuid(){return crypto.randomUUID?.()||`act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`}
function powMeta(id){return data()?.pows?.find(x=>String(x.id)===String(id))||null}
function artFor(id){const p=powMeta(id),raw=p?.asset||'';return window.POWDER_THUMBNAILS?.[raw]||raw}
function powName(rowOrId){if(rowOrId&&typeof rowOrId==='object')return rowOrId.catalog?.name||powMeta(rowOrId.pow_id)?.name||rowOrId.pow_id||'Pow';return powMeta(rowOrId)?.name||String(rowOrId||'Pow')}
function playerOf(id,m=st.data?.match){return (m?.players||[]).find(x=>String(x.id)===String(id))||null}
function me(m=st.data?.match){return playerOf(m?.me,m)}
function opponent(m=st.data?.match){return (m?.players||[]).find(x=>String(x.id)!==String(m?.me))||null}
function myPows(m=st.data?.match){return (m?.pows||[]).filter(x=>String(x.user_id)===String(m?.me))}
function enemyPows(m=st.data?.match){return (m?.pows||[]).filter(x=>String(x.user_id)!==String(m?.me))}
function active(rows){return rows.filter(x=>x.active&&!x.eliminated&&Number(x.hp)>0).sort((a,b)=>Number(a.slot)-Number(b.slot))}
function reserves(rows){return rows.filter(x=>!x.active&&!x.eliminated&&Number(x.hp)>0).sort((a,b)=>Number(a.slot)-Number(b.slot))}
function fmtTime(v){const d=new Date(v);return Number.isNaN(+d)?'—':d.toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'})}
function reasonLabel(v){return({knockout:'Hạ toàn bộ đội hình',forfeit:'Đầu hàng',afk_limit:'3 lần AFK',disconnect_timeout:'Mất kết nối quá thời gian',round_limit:'Giới hạn vòng'})[v]||String(v||'Kết thúc trận')}
function resultLabel(v){return v==='win'?'THẮNG':v==='loss'?'THUA':'HÒA'}
function roleLabel(v){return({marksman:'Xạ thủ',mage:'Pháp sư',tank:'Đỡ đòn',fighter:'Đấu sĩ',knight:'Hiệp sĩ',enchanter:'Thuật sư',healer:'Trị liệu',musician:'Nhạc công',assassin:'Sát thủ'})[String(v||'').toLowerCase()]||v||'—'}
function identityOf(rowOrId){const row=rowOrId&&typeof rowOrId==='object'?rowOrId:null,id=row?row.pow_id:rowOrId;return row?.identity||row?.catalog?.identity||window.POWDER_COMBAT_IDENTITY_V1881?.get?.(id)||powMeta(id)?.combatIdentity||null}function pvpArchetype(row){const identity=identityOf(row);if(identity?.archetype)return identity.archetype;const r=String(row?.catalog?.role||''),t=JSON.stringify(row?.catalog?.skills||{});const cc=/Stun|Freeze|Paralysis/.test(t),dot=/Burn|Poison|Curse|Magma Burn/.test(t),shield=/Shield/.test(t),sustain=/Regeneration|Cleanse/.test(t);if(r==='Xạ thủ')return cc?'Control Marksman':'Pressure Marksman';if(r==='Pháp sư')return cc?'Control Mage':dot?'Attrition Mage':'Burst Mage';if(r==='Đỡ đòn')return shield?'Fortress Tank':'Control Tank';if(r==='Đấu sĩ')return sustain||shield?'Sustain Bruiser':'Pressure Bruiser';if(r==='Hiệp sĩ')return 'Guard Knight';if(r==='Thuật sư')return cc?'Control Caster':'Attrition Caster';if(r==='Trị liệu')return shield?'Barrier Healer':'Sustain Healer';if(r==='Nhạc công')return cc?'Control Support':'Tempo Support';if(r==='Sát thủ')return 'Pick Assassin';return 'Flex'}
function statusBadges(s={},row={}){return Object.entries(s||{}).filter(([k,v])=>k!=='shield'&&Number(v)>0).map(([k,v])=>`<span>${esc(k)} ${Number(v)}</span>`).join('')+(Number(s?.shield)>0?`<span>Shield ${Number(s.shield)}</span>`:'')+(Number(row?.pvp_cc_dr)>0?`<span>CC DR ${Number(row.pvp_cc_dr)}</span>`:'')+(Number(row?.pvp_heal_fatigue)>0?`<span>Heal fatigue ${Number(row.pvp_heal_fatigue)}</span>`:'')+(Number(row?.pvp_shield_fatigue)>0?`<span>Shield fatigue ${Number(row.pvp_shield_fatigue)}</span>`:'')}

async function raw(action,payload={},opt={}){
  if(!online()?.hasSession?.())throw new Error('Hãy đăng nhập Powder Online trước.');
  if(navigator.onLine===false)throw Object.assign(new Error('Thiết bị đang ngoại tuyến. Trận vẫn được giữ trên server.'),{code:'OFFLINE'});
  return online().request('/functions/v1/powder-pvp',{method:'POST',body:JSON.stringify({action,...payload}),...opt});
}

function ensureRoot(){
  const shell=$('#socialHubV154');if(!shell)return null;
  let root=$('#pvpOnline1870');
  if(!root){root=document.createElement('section');root.id='pvpOnline1870';root.className='pvp1870-shell';const hero=shell.querySelector('.soc154-hero');if(hero)hero.insertAdjacentElement('afterend',root);else shell.prepend(root)}
  return root;
}
function injectChallengeButtons(){
  const disabled=!!isLiveMatch();
  $$('#socialHubV154 .soc154-friends [data-soc154-profile]').forEach(profileBtn=>{
    const actions=profileBtn.closest('.soc154-user-actions');if(!actions)return;
    const id=profileBtn.dataset.soc154Profile;if(!id)return;
    let b=actions.querySelector(`[data-pvp1870-challenge="${CSS.escape(id)}"]`);
    if(!b){b=document.createElement('button');b.className='pvp1870-friend-challenge';b.dataset.pvp1870Challenge=id;b.textContent='⚔ Giao lưu';actions.appendChild(b);b.addEventListener('click',()=>challenge(id))}
    b.disabled=disabled;b.title=disabled?'Bạn đang có trận PvP chưa kết thúc':'Mời Tamer này giao lưu PvP';
  });
}

function serverClockRemaining(){
  const m=st.data?.match;if(!m||m.status!=='active')return 0;
  const base=Math.max(0,Number(m.turnRemaining)||0),elapsed=Math.max(0,(performance.now()-st.lastResponseAt)/1000);
  return Math.max(0,base-elapsed);
}
function updateClockDom(){
  const e=$('#pvp1870TimerValue');if(!e)return;
  const n=Math.ceil(serverClockRemaining());e.textContent=`${n}s`;e.parentElement?.classList.toggle('is-danger',n<=10);e.parentElement?.classList.toggle('is-zero',n<=0);
  const sub=$('#pvp1870TimerSub');if(sub)sub.textContent=n>0?'đồng hồ server':'đang xác nhận timeout…';
  if(n<=0&&!st.busy&&navigator.onLine!==false)setTimeout(()=>loadState({quiet:true}),180);
}
function armClock(){clearInterval(st.clock);st.clock=0;if(st.data?.match?.status!=='active')return;updateClockDom();st.clock=setInterval(updateClockDom,250)}
function armPoll(){clearTimeout(st.poll);st.poll=0;if(document.hidden||!online()?.hasSession?.())return;const m=st.data?.match;if(isLiveMatch(m)||isSocialVisible()){const delay=m?.status==='active'?1100:m?.status==='lobby'?1800:5000;st.poll=setTimeout(()=>loadState({quiet:true}),delay)}}

function syncSelections(){
  const m=st.data?.match;if(!m)return;
  if(m.id!==st.lastMatchId){st.lastMatchId=m.id;st.selectedActor='';st.selectedTarget='';st.selectedSkill='basic';st.teamDraft=[];st.simpleDraftId='crimson';st.simpleDraftLevel=1;st.expansionDraftId='nine_suns'}
  if(m.status==='lobby'){
    const mine=me(m);if(mine?.domainLoadoutLocked){st.simpleDraftId=mine.simpleId||st.simpleDraftId;st.simpleDraftLevel=Number(mine.simpleLevel||1);st.expansionDraftId=mine.expansionId||st.expansionDraftId}if(mine?.ready&&Array.isArray(mine.team))st.teamDraft=[...mine.team];
    if(!st.teamDraft.length){
      const rosterIds=new Set((st.data?.roster||[]).map(x=>String(x.pow_id)));
      const saveTeam=(app()?.getSave?.()?.team||[]).filter(x=>rosterIds.has(String(x)));
      st.teamDraft=[...new Set(saveTeam)].slice(0,5);
      for(const row of st.data?.roster||[]){if(st.teamDraft.length>=5)break;if(!st.teamDraft.includes(row.pow_id))st.teamDraft.push(row.pow_id)}
    }
  }
  if(m.status==='active'){
    const mine=active(myPows(m)),foe=active(enemyPows(m));
    if(!mine.some(x=>String(x.pow_id)===String(st.selectedActor)))st.selectedActor=mine[0]?.pow_id||'';
    if(!foe.some(x=>String(x.pow_id)===String(st.selectedTarget)))st.selectedTarget=foe[0]?.pow_id||'';
    if(!['basic','s1','s2','ult'].includes(st.selectedSkill))st.selectedSkill='basic';
  }
}

async function loadState({quiet=false,forceView=false}={}){
  if(!online()?.hasSession?.()){st.data=null;render();return null}
  if(st.busy)return st.data;st.busy=true;
  try{
    const d=await raw('state',{}, {timeoutMs:9000,retries:quiet?1:2});
    st.data=d?.state||null;st.offline=false;st.lastResponseAt=performance.now();st.notice='';syncSelections();render();armClock();
    if(forceView&&isLiveMatch(st.data?.match))app()?.showView?.('social');
    if((!st.historyLoadedAt||Date.now()-st.historyLoadedAt>30000)&&(!st.data?.match||st.data.match.status==='completed'))loadHistory(true);
    return st.data;
  }catch(e){
    st.offline=navigator.onLine===false||e?.code==='OFFLINE';st.notice=e?.message||'Không lấy được trạng thái PvP.';if(!quiet)toast(st.notice);render();return st.data;
  }finally{st.busy=false;armPoll()}
}

async function loadHistory(quiet=false){
  if(!online()?.hasSession?.()||navigator.onLine===false)return;
  try{const d=await raw('history',{limit:15},{timeoutMs:8000,retries:1});st.history=Array.isArray(d?.history)?d.history:[];st.historyLoadedAt=Date.now();render()}catch(e){if(!quiet)toast(e.message||'Không tải được lịch sử PvP.')}
}

async function challenge(userId){
  if(isLiveMatch())return toast('Bạn đang có trận PvP chưa kết thúc.');
  try{st.notice='Đang gửi lời mời giao lưu…';render();const d=await raw('challenge',{userId});st.data=d?.state||st.data;st.notice='Đã gửi lời mời PvP.';toast('Đã gửi lời mời PvP.');syncSelections();render();armPoll()}catch(e){st.notice='';toast(e.message)}
}
async function challengeResponse(id,decision){try{const d=await raw('respond_challenge',{challengeId:id,decision});st.data=d?.state||st.data;syncSelections();render();if(decision==='accept')toast('Đã vào phòng PvP. Chọn đúng 5 Pow và khóa đội hình.');armPoll()}catch(e){toast(e.message)}}
async function cancelChallenge(id){try{const d=await raw('cancel_challenge',{challengeId:id});st.data=d?.state||st.data;render();toast('Đã hủy lời mời PvP.')}catch(e){toast(e.message)}}

function toggleTeam(id){const m=st.data?.match;if(m?.status!=='lobby'||me(m)?.ready)return;const s=String(id),i=st.teamDraft.findIndex(x=>String(x)===s);if(i>=0)st.teamDraft.splice(i,1);else if(st.teamDraft.length<5)st.teamDraft.push(id);else return toast('PvP chỉ dùng 5 Pow: 3 chính + 2 dự bị.');render()}
function moveTeam(id,delta){const i=st.teamDraft.findIndex(x=>String(x)===String(id));if(i<0)return;const j=Math.max(0,Math.min(st.teamDraft.length-1,i+delta));if(i===j)return;const [x]=st.teamDraft.splice(i,1);st.teamDraft.splice(j,0,x);render()}
async function lockTeam(){const m=st.data?.match;if(!m||m.status!=='lobby')return;if(st.teamDraft.length!==5)return toast('Cần đúng 5 Pow trước khi khóa đội hình.');try{const d=await raw('lock_team',{matchId:m.id,team:st.teamDraft,domainLoadout:{simpleId:st.simpleDraftId,simpleLevel:st.simpleDraftLevel,expansionId:st.expansionDraftId}});st.data=d?.state||st.data;st.lastResponseAt=performance.now();syncSelections();render();armClock();toast(st.data?.match?.status==='active'?'Cả hai đã sẵn sàng · trận bắt đầu.':'Đã khóa đội hình · đang chờ đối thủ.');armPoll()}catch(e){toast(e.message)}}

function abilityOf(row,key){return row?.catalog?.skills?.[key]||null}
function skillCost(k){return k==='ult'?100:k==='s2'?30:k==='s1'?20:0}
function skillReady(row,key){const cost=skillCost(key),cd=Math.max(0,Number(row?.cooldowns?.[key])||0),energy=Math.max(0,Number(row?.energy)||0);return{ok:cd===0&&energy>=cost,cost,cd,energy}}
function selectActor(id){if(st.actionBusy)return;st.selectedActor=id;st.selectedSkill='basic';render()}
function selectTarget(id){if(st.actionBusy)return;st.selectedTarget=id;render()}
function selectSkill(k){if(st.actionBusy)return;st.selectedSkill=k;render()}

function domainState(p){return p?.expansionState||{}}
function simpleState(p){return p?.simpleState||{}}
function territorySummary(p){const es=domainState(p),ss=simpleState(p);if(es?.active)return `Bành Trướng: ${domainName(es.id)} · còn ${Number(es.remainingActions)||0} hành động`;if(ss?.active)return `Giản Dị: ${domainName(ss.id)} Lv.${Number(p?.simpleLevel)||1}`;return `Chờ kích hoạt · ${Number(p?.simpleCharges??3)} Giản Dị còn lại`}
async function activateTerritory(kind,id){const m=st.data?.match;if(!m||m.status!=='active'||String(m.currentPlayer)!==String(m.me)||st.domainBusy)return;st.domainBusy=true;try{const d=await raw('domain_activate',{matchId:m.id,kind,id,clientActionId:uuid(),expectedTurnNo:Number(m.turnNo)},{timeoutMs:10000,retries:0});st.data=d?.state||st.data;st.lastResponseAt=performance.now();syncSelections();render();armClock();toast(kind==='simple'?`Đã mở ${domainName(id)}.`:`Đã kích hoạt ${domainName(id)}.`)}catch(e){toast(e.message||'Server từ chối Lãnh Địa.');await loadState({quiet:true})}finally{st.domainBusy=false;render()}}
function ensureDomainQuestionModal(){let modal=$('#pvp1880QuestionModal');if(!modal){modal=document.createElement('section');modal.id='pvp1880QuestionModal';modal.className='pvp1880-question-modal';modal.hidden=true;modal.innerHTML='<article id="pvp1880QuestionCard"></article>';document.body.appendChild(modal)}return modal}
function askDomainPack(pack){return new Promise(resolve=>{const modal=ensureDomainQuestionModal(),card=$('#pvp1880QuestionCard');modal.hidden=false;const title=pack.gate==='owner'?'Vô Lượng · Chủ Lãnh Địa':'Vô Lượng · Xâm nhập Lãnh Địa';card.innerHTML=`<div class="pvp1880-qhead"><div><small>SERVER VERIFIED · 5 CÂU</small><h2>${esc(title)}</h2><p>Đáp án đúng chỉ nằm trên server. Phải hoàn thành trước khi hành động.</p></div></div><form id="pvp1880QuestionForm">${(pack.questions||[]).map((q,i)=>`<fieldset><legend>${i+1}. ${esc(q.prompt)}</legend>${(q.options||[]).map(o=>`<label><input type="radio" name="q${i}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</fieldset>`).join('')}<div class="pvp1880-qactions"><button class="btn primary" type="submit">Xác nhận 5 câu</button><button class="btn secondary" type="button" data-q-cancel>Đóng</button></div></form>`;const form=$('#pvp1880QuestionForm',card);form.onsubmit=e=>{e.preventDefault();const answers=(pack.questions||[]).map((_,i)=>form.querySelector(`input[name="q${i}"]:checked`)?.value||'');if(answers.some(x=>!x))return toast('Hãy trả lời đủ 5 câu.');modal.hidden=true;resolve(answers)};$('[data-q-cancel]',card).onclick=()=>{modal.hidden=true;resolve(null)}})}
async function ensureDomainQuestions(m){try{const d=await raw('domain_questions',{matchId:m.id,expectedTurnNo:Number(m.turnNo)},{timeoutMs:10000,retries:0});for(const pack of d?.packs||[]){if(pack.answered)continue;const answers=await askDomainPack(pack);if(!answers)return false;const r=await raw('domain_answer',{sessionId:pack.sessionId,answers,expectedTurnNo:Number(m.turnNo)},{timeoutMs:10000,retries:0});toast(`Vô Lượng: ${Number(r?.result?.correct??r?.correct??0)}/5 câu đúng.`)}return true}catch(e){if(String(e?.message||'').includes('STALE_PVP_STATE'))await loadState({quiet:true});else toast(e.message||'Không mở được câu hỏi Vô Lượng.');return false}}
function renderDomainPanel(m,mine,opp,turnMine){const ms=simpleState(mine),me=domainState(mine),oe=domainState(opp),simpleOn=!!ms.active,expOn=!!me.active,oppExp=!!oe.active;return `<div class="pvp1880-domain-grid"><article class="${simpleOn?'is-active':''}"><small>GIẢN DỊ · ${Number(mine?.simpleCharges??3)}/3 LẦN</small><b>${esc(domainName(mine?.simpleId||st.simpleDraftId))} Lv.${Number(mine?.simpleLevel)||1}</b><span>${simpleOn?'Đang hoạt động 1 lượt':'Không coexist với Bành Trướng'}</span><button data-domain-simple="${esc(mine?.simpleId||st.simpleDraftId)}" ${!turnMine||st.domainBusy||simpleOn||expOn||Number(mine?.simpleCharges??0)<=0?'disabled':''}>Kích hoạt Giản Dị</button></article><article class="${expOn?'is-active':''}"><small>BÀNH TRƯỚNG · SERVER AUTHORITY</small><b>${esc(domainName(mine?.expansionId||st.expansionDraftId))}</b><span>${expOn?`Còn ${Number(me.remainingActions)||0} hành động`:mine?.expansionUsed&&mine?.expansionId!=='jackpot_bagua'?'Đã dùng trong trận':'Sẵn sàng kích hoạt'}</span><button data-domain-expansion="${esc(mine?.expansionId||st.expansionDraftId)}" ${!turnMine||st.domainBusy||expOn||(mine?.expansionUsed&&mine?.expansionId!=='jackpot_bagua')?'disabled':''}>${mine?.expansionId==='jackpot_bagua'&&!expOn?'Thử Jackpot':'Bành Trướng'}</button></article><article class="${oppExp?'is-hostile':''}"><small>LÃNH ĐỊA ĐỐI THỦ</small><b>${oppExp?esc(domainName(oe.id)):'Chưa kích hoạt'}</b><span>${oppExp?`Còn ${Number(oe.remainingActions)||0} hành động · ${oe.id==='limitless_void'?'hành động của bạn cần 5 câu server':''}`:'Theo dõi terrain / CC / heal / damage tại đây'}</span></article></div>`}

async function actNow(){
  const m=st.data?.match;if(!m||m.status!=='active'||String(m.currentPlayer)!==String(m.me)||st.actionBusy)return;
  const actor=active(myPows(m)).find(x=>String(x.pow_id)===String(st.selectedActor));if(!actor)return toast('Hãy chọn Pow đang ở sân.');
  const ab=abilityOf(actor,st.selectedSkill),support=String(ab?.type||'').toLowerCase()==='support';
  const target=support?actor:active(enemyPows(m)).find(x=>String(x.pow_id)===String(st.selectedTarget));if(!target)return toast('Hãy chọn mục tiêu đang ở sân.');
  const ready=skillReady(actor,st.selectedSkill);if(!ready.ok)return toast(ready.cd?`Kỹ năng còn hồi ${ready.cd} lượt.`:`Cần ${ready.cost} Năng lượng.`);
  if(!(await ensureDomainQuestions(m)))return;
  const payload={matchId:m.id,actorPowId:actor.pow_id,targetPowId:target.pow_id,skillSlot:st.selectedSkill,clientActionId:uuid(),expectedTurnNo:Number(m.turnNo)};
  st.actionBusy=true;st.notice='Đang chờ server xác nhận hành động…';render();
  try{
    const d=await raw('act',payload,{timeoutMs:10000,retries:0});st.data=d?.state||st.data;st.lastResponseAt=performance.now();st.notice='';syncSelections();render();armClock();armPoll();
  }catch(e){
    st.notice='';if(String(e?.message||'').includes('STALE_PVP_STATE')){toast('Trạng thái client đã cũ · đang đồng bộ lượt mới.');await loadState({quiet:true})}else{toast(e.message||'Server chưa xác nhận hành động.');await loadState({quiet:true})}
  }finally{st.actionBusy=false;render()}
}
async function passTurn(){const m=st.data?.match;if(!m||m.status!=='active'||String(m.currentPlayer)!==String(m.me)||st.actionBusy)return;st.actionBusy=true;try{const d=await raw('pass',{matchId:m.id,clientActionId:uuid(),expectedTurnNo:Number(m.turnNo)},{timeoutMs:10000,retries:0});st.data=d?.state||st.data;st.lastResponseAt=performance.now();syncSelections();render();armClock();armPoll()}catch(e){toast(e.message);await loadState({quiet:true})}finally{st.actionBusy=false;render()}}
async function surrender(){const m=st.data?.match;if(!m||!['lobby','active'].includes(m.status))return;if(!confirm('Đầu hàng trận PvP này? Kết quả sẽ được server ghi nhận.'))return;try{const d=await raw('forfeit',{matchId:m.id});st.data=d?.state||st.data;st.lastResponseAt=performance.now();render();armClock();loadHistory(true)}catch(e){toast(e.message)}}
async function ackResult(){const m=st.data?.match;if(!m||m.status!=='completed')return;try{const d=await raw('ack_result',{matchId:m.id});st.data=d?.state||null;st.lastMatchId='';render();loadHistory(true);armPoll()}catch(e){toast(e.message)}}
async function rematch(){const m=st.data?.match;if(!m||m.status!=='completed')return;try{const d=await raw('rematch',{matchId:m.id});st.data=d?.state||null;st.lastMatchId='';render();toast('Đã gửi lời mời tái đấu.');armPoll()}catch(e){toast(e.message)}}

function pvpUnit(row,{enemy=false,selectable=false,selected=false,reserve=false}={}){
  const max=Math.max(1,Number(row.max_hp)||1),hp=Math.max(0,Number(row.hp)||0),pct=Math.max(0,Math.min(100,hp/max*100));
  const art=artFor(row.pow_id);return `<button type="button" class="pvp1870-unit ${enemy?'is-enemy':'is-mine'} ${selected?'is-selected':''} ${reserve?'is-reserve':''} ${row.eliminated||hp<=0?'is-ko':''}" ${selectable?'':'disabled'} data-${enemy?'pvp-target':'pvp-actor'}="${esc(row.pow_id)}"><span class="pvp1870-unit-art">${art?`<img src="${esc(art)}" alt="">`:'<i>POW</i>'}<b>${reserve?'DỰ BỊ':row.active?'ACTIVE':'KO'}</b></span><span class="pvp1870-unit-copy"><strong>${esc(powName(row))}</strong><small>${esc(row.catalog?.element||'—')} · ${esc(roleLabel(row.catalog?.role))}</small><span class="pvp1870-hp"><i style="width:${pct.toFixed(1)}%"></i></span><small>${Math.round(hp)}/${Math.round(max)} HP · ⚡ ${Math.round(Number(row.energy)||0)}</small><span class="pvp1870-statuses">${statusBadges(row.statuses,row)}</span></span></button>`}
function playerHeader(p,isMe=false){const strikes=Math.max(0,Math.min(3,Number(p?.afkStrikes)||0));return `<div class="pvp1870-player-head ${p?.connected?'is-online':'is-offline'}"><div><small>${isMe?'BẠN':'ĐỐI THỦ'}</small><b>${esc(p?.display_name||p?.displayName||'Tamer')}</b><span>${p?.connected?'● Kết nối':'○ Mất kết nối'}</span></div><div class="pvp1870-afk" title="3 AFK strike = xử thua"><small>AFK STRIKE</small><b>${'●'.repeat(strikes)}${'○'.repeat(3-strikes)}</b></div></div>`}

function eventText(e,m=st.data?.match){
  const pp=e?.payload||{},powBy=id=>(m?.pows||[]).find(x=>String(x.pow_id)===String(id));const actor=powName(powBy(e?.actor_pow_id)||e?.actor_pow_id||'');const target=powName(powBy(e?.target_pow_id)||e?.target_pow_id||'');
  if(e.event_type==='skill'){const bits=[];if(Number(pp.damage)>0)bits.push(`-${Number(pp.damage)} HP`);if(Number(pp.heal)>0)bits.push(`+${Number(pp.heal)} HP`);if(Number(pp.absorbed)>0)bits.push(`Shield chặn ${Number(pp.absorbed)}`);if(pp.crit)bits.push('CRIT');if(pp.statusApplied&&pp.status)bits.push(pp.status);return `${actor} · ${pp.skillName||pp.skillSlot||'Skill'} → ${target}${bits.length?' · '+bits.join(' · '):''}`}
  if(e.event_type==='turn_tick')return `${actor} · tick lượt${pp.burn?` · Burn ${pp.burn}`:''}${pp.poison?` · Poison ${pp.poison}`:''}${pp.regen?` · Regen ${pp.regen}`:''}`;
  if(e.event_type==='afk_timeout')return `AFK timeout · strike ${pp.strikes||'?'} / ${pp.maxStrikes||3}${pp.disconnected?' · mất kết nối':''}`;
  if(e.event_type==='battle_started')return 'Trận bắt đầu · server đã chọn người đi trước.';
  if(e.event_type==='forfeit')return 'Một Tamer đã đầu hàng.';
  if(e.event_type==='pass')return 'Bỏ lượt vì toàn bộ Pow đang bị hard CC.';
  if(e.event_type==='rematch_requested')return 'Đã gửi lời mời tái đấu.';
  if(e.event_type==='domain_simple')return `Giản Dị · ${domainName(pp.id)} Lv.${pp.level||1} · còn ${pp.charges??'?'} lần`;
  if(e.event_type==='domain_expansion')return `Bành Trướng · ${domainName(pp.id)} · server verified`;
  if(e.event_type==='domain_expansion_end')return `Kết thúc ${domainName(pp.id)} · ${pp.reason||'duration'}`;
  if(e.event_type==='domain_question_result')return `Vô Lượng · ${pp.gate==='owner'?'chủ':'đối thủ'} trả lời ${pp.correct||0}/5`;
  if(e.event_type==='domain_limitless_burst')return `Vô Lượng · đủ 10 câu đúng · bùng nổ 50% Max HP toàn đội`;
  if(e.event_type==='domain_sword')return `Rút Kiếm Ra · ${pp.name||'Kiếm'} → ${target} · ${pp.damage||0} damage · ${pp.status||''}`;
  if(e.event_type==='domain_damage')return `${pp.label||'Lãnh Địa'} → ${target} · ${pp.damage||0} damage${pp.resist?` · kháng ${Math.round(Number(pp.resist)*100)}%`:''}`;
  if(e.event_type==='domain_guard')return `Lãnh Địa guard · ${pp.kind||''} · ${pp.requested||0} → ${pp.applied||0}`;
  if(e.event_type==='domain_immortal')return `Tọa Sát Bát Đồ · bất tử · giữ 1 HP`;
  if(e.event_type==='domain_jackpot_fail')return `Tọa Sát Bát Đồ · trượt Jackpot · lần ${pp.attempt||1} · ${Math.round(Number(pp.chance||0)*100)}%`;
  if(e.event_type==='domain_burst'||e.event_type==='domain_pursuit')return `${domainName(pp.id||'infinite_strike')} · truy kích/bùng nổ ${pp.damage||''}`;
  if(e.event_type==='balance_guard'){const k=pp.kind||'guard';if(k==='damage_cap')return `PvP Balance · chặn one-shot: ${pp.requested||0} → ${pp.applied||0}`;if(k==='heal_fatigue')return `PvP Balance · heal fatigue: ${pp.requested||0} → ${pp.applied||0}`;if(k==='shield_guard')return `PvP Balance · shield guard: ${pp.requested||0} → ${pp.applied||0}`;if(k==='hard_cc_dr'||k==='hard_cc_refresh_block')return `PvP Balance · hard CC bị kháng/chặn chuỗi · DR ${pp.dr||0}`;return `PvP Balance · ${k}`;}
  return `${e.event_type||'event'}${actor?` · ${actor}`:''}`;
}

function renderChallenges(d){const inc=d?.incoming||[],out=d?.outgoing||[];return `<div class="pvp1870-challenges"><div><small>LỜI MỜI ĐẾN</small>${inc.map(x=>`<article><span><b>${esc(x.profile?.display_name||'Tamer')}</b><small>${esc(x.profile?.tamer_uid||'')}</small></span><div><button data-pvp-accept="${x.id}">Đồng ý</button><button data-pvp-decline="${x.id}">Từ chối</button></div></article>`).join('')||'<p>Không có lời mời.</p>'}</div><div><small>ĐÃ GỬI</small>${out.map(x=>`<article><span><b>${esc(x.profile?.display_name||'Tamer')}</b><small>${esc(x.profile?.tamer_uid||'')}</small></span><div><button data-pvp-cancel="${x.id}">Hủy</button></div></article>`).join('')||'<p>Chưa gửi lời mời.</p>'}</div></div>`}
function renderHistory(){return `<div class="pvp1870-history"><div class="pvp1870-subhead"><div><small>MATCH HISTORY</small><h3>Lịch sử PvP</h3></div><button data-pvp-history>↻</button></div>${st.history.length?st.history.map(h=>`<article><span class="pvp1870-history-result is-${h.result}">${resultLabel(h.result)}</span><div><b>${esc(h.opponent?.display_name||'Tamer')}</b><small>${fmtTime(h.completedAt)} · ${esc(reasonLabel(h.finishReason))} · ${Number(h.turnNo)||0} lượt</small></div><button data-pvp-replay="${h.id}">Replay</button></article>`).join(''):'<p class="pvp1870-empty">Chưa có trận PvP đã hoàn thành.</p>'}</div>`}

function renderIdle(root,d){const s=d?.stats||{};root.innerHTML=`<div class="pvp1870-head"><div><p class="eyebrow">PVP ONLINE 2.0 · IDENTITY 18.8.1 · BÀNH TRƯỚNG 18.8.0</p><h2>Giao lưu Tamer</h2><p>Thách đấu bạn bè Online. Timer, hành động, HP, kết quả và event log đều do server quyết định.</p></div><div class="pvp1870-badges"><span>45s / lượt</span><span>90s reconnect</span><span>3 active + 2 reserve</span><span>CC DR + anti-loop</span><span>82% one-shot guard</span><span>9 Bành Trướng server-authoritative</span></div></div>${st.offline?'<div class="pvp1870-network is-offline">Mất mạng · không có trận local nào được tạo. Khi có mạng Powder sẽ nối lại đúng session server.</div>':''}<div class="pvp1870-stats"><article><small>TRẬN</small><b>${Number(s.matches)||0}</b></article><article><small>THẮNG</small><b>${Number(s.wins)||0}</b></article><article><small>THUA</small><b>${Number(s.losses)||0}</b></article><article><small>FORFEIT / AFK</small><b>${Number(s.forfeits)||0}</b></article></div>${renderChallenges(d)}<div class="pvp1870-tip">⚔ Nút <b>Giao lưu</b> đã được thêm trực tiếp vào danh sách Bạn bè Online bên dưới.</div>${renderHistory()}`;bindCommon(root)}

function renderLobby(root,d,m){const mine=me(m),opp=opponent(m),roster=d?.roster||[];const ready=!!mine?.ready;root.innerHTML=`<div class="pvp1870-head"><div><p class="eyebrow">PVP LOBBY · ${esc(m.id.slice(0,8))}</p><h2>Khóa đội hình 3 + 2</h2><p>Ba vị trí đầu là active. Hai vị trí cuối là dự bị và server tự đưa vào sân khi có chỗ trống.</p></div><button class="pvp1870-danger" data-pvp-surrender>Rời trận</button></div><div class="pvp1870-lobby-players">${playerHeader(mine,true)}<strong>VS</strong>${playerHeader(opp,false)}</div><div class="pvp1870-team-order">${st.teamDraft.map((id,i)=>{const row=roster.find(x=>String(x.pow_id)===String(id));return `<article><span>${i<3?`ACTIVE ${i+1}`:`RESERVE ${i-2}`}</span><b>${esc(row?.catalog?.name||powName(id))}</b>${ready?'':`<div><button data-pvp-move="${esc(id)}" data-d="-1" ${i===0?'disabled':''}>←</button><button data-pvp-move="${esc(id)}" data-d="1" ${i===st.teamDraft.length-1?'disabled':''}>→</button><button data-pvp-remove="${esc(id)}">×</button></div>`}</article>`}).join('')}</div><div class="pvp1870-roster">${roster.map(row=>{const on=st.teamDraft.some(x=>String(x)===String(row.pow_id));return `<button ${ready?'disabled':''} class="${on?'is-picked':''}" data-pvp-pick="${esc(row.pow_id)}"><img src="${esc(artFor(row.pow_id))}" alt=""><span><b>${esc(row.catalog?.name||row.pow_id)}</b><small>Lv.${Number(row.level)||1} · ${Number(row.stars)||0}★ · ${esc(row.catalog?.element||'—')}</small><small class="pvp1871-niche">${esc(pvpArchetype(row))}</small>${identityOf(row)?`<small class="pvp1881-rolepair">${esc(identityOf(row).primaryRole)} · ${esc(identityOf(row).secondaryRole)}</small><small class="pvp1881-core" title="${esc(identityOf(row).passiveIdentity)}">Core: ${esc(identityOf(row).passiveName)}</small>`:''}</span><i>${on?st.teamDraft.findIndex(x=>String(x)===String(row.pow_id))+1:'+'}</i></button>`}).join('')}</div><div class="pvp1880-loadout"><div><small>GIẢN DỊ · PvE/PvP</small><select data-domain-simple-select ${ready?'disabled':''}>${SIMPLE_DOMAINS.map(x=>`<option value="${x[0]}" ${st.simpleDraftId===x[0]?'selected':''}>${esc(x[1])} · ${x[2]}</option>`).join('')}</select><select data-domain-level ${ready?'disabled':''}>${[1,2,3].map(n=>`<option value="${n}" ${st.simpleDraftLevel===n?'selected':''}>Cấp ${n} · kháng Bành Trướng ${n===1?30:n===2?40:50}%</option>`).join('')}</select></div><div><small>BÀNH TRƯỚNG · đúng 9 loại</small><select data-domain-expansion-select ${ready?'disabled':''}>${EXPANSIONS.map(x=>`<option value="${x[0]}" ${st.expansionDraftId===x[0]?'selected':''}>${esc(x[1])} · ${x[2]}</option>`).join('')}</select><span>6 thường + 3 đặc biệt · không có loại thứ 10</span></div></div><div class="pvp1870-lobby-actions"><span>${ready?'✓ Đội hình + Lãnh Địa đã khóa':`${st.teamDraft.length}/5 Pow đã chọn`}</span>${ready?`<b>${opp?.ready?'Đối thủ đã sẵn sàng · đang vào trận':'Đang chờ đối thủ khóa đội hình…'}</b>`:`<button class="btn primary" data-pvp-lock ${st.teamDraft.length!==5?'disabled':''}>Khóa đội hình & sẵn sàng</button>`}</div>`;bindCommon(root);$$('[data-pvp-pick]',root).forEach(b=>b.onclick=()=>toggleTeam(b.dataset.pvpPick));$$('[data-pvp-remove]',root).forEach(b=>b.onclick=()=>toggleTeam(b.dataset.pvpRemove));$$('[data-pvp-move]',root).forEach(b=>b.onclick=()=>moveTeam(b.dataset.pvpMove,Number(b.dataset.d)||0));$('[data-domain-simple-select]',root)?.addEventListener('change',e=>{st.simpleDraftId=e.target.value});$('[data-domain-level]',root)?.addEventListener('change',e=>{st.simpleDraftLevel=Math.max(1,Math.min(3,Number(e.target.value)||1))});$('[data-domain-expansion-select]',root)?.addEventListener('change',e=>{st.expansionDraftId=e.target.value});$('[data-pvp-lock]',root)?.addEventListener('click',lockTeam)}

function renderBattle(root,d,m){const mine=me(m),opp=opponent(m),mineRows=myPows(m),enemyRows=enemyPows(m),myActive=active(mineRows),enemyActive=active(enemyRows),actor=myActive.find(x=>String(x.pow_id)===String(st.selectedActor))||myActive[0],ability=abilityOf(actor,st.selectedSkill),support=String(ability?.type||'').toLowerCase()==='support',turnMine=String(m.currentPlayer)===String(m.me),ready=skillReady(actor,st.selectedSkill),canPass=myActive.length>0&&myActive.every(x=>Number(x.statuses?.Stun||0)>0||Number(x.statuses?.Freeze||0)>0);root.innerHTML=`<div class="pvp1870-battle-head"><div><p class="eyebrow">PVP ONLINE 2.0 · IDENTITY 18.8.1 · LÃNH ĐỊA 18.8.0 · TURN ${Number(m.turnNo)||1}</p><h2>${turnMine?'Lượt của bạn':'Lượt đối thủ'}</h2><small>State ${esc(m.stateVersion||'')}</small></div><div class="pvp1870-server-timer"><small>SERVER TIMER</small><b id="pvp1870TimerValue">${Math.ceil(Number(m.turnRemaining)||0)}s</b><span id="pvp1870TimerSub">đồng hồ server</span></div><button class="pvp1870-danger" data-pvp-surrender>Đầu hàng</button></div>${st.offline?'<div class="pvp1870-network is-offline">Mất kết nối · trận không reset. Powder sẽ lấy lại state server khi mạng trở lại.</div>':''}${st.notice?`<div class="pvp1870-network">${esc(st.notice)}</div>`:''}${renderDomainPanel(m,mine,opp,turnMine)}${actor&&identityOf(actor)?`<div class="pvp1881-identity-summary"><b>⚔ ${esc(identityOf(actor).passiveName)} · ${esc(identityOf(actor).primaryRole)} / ${esc(identityOf(actor).secondaryRole)}</b><p>${esc(identityOf(actor).passiveIdentity)}</p><p><strong>Synergy:</strong> ${esc(identityOf(actor).synergy)}</p></div>`:''}<div class="pvp1870-arena"><section>${playerHeader(opp,false)}<div class="pvp1870-active-row enemy">${enemyActive.map(x=>pvpUnit(x,{enemy:true,selectable:turnMine&&!support&&!st.actionBusy,selected:String(x.pow_id)===String(st.selectedTarget)})).join('')}</div><div class="pvp1870-reserve-row">${reserves(enemyRows).map(x=>pvpUnit(x,{enemy:true,reserve:true})).join('')}${enemyRows.filter(x=>x.eliminated||Number(x.hp)<=0).map(x=>pvpUnit(x,{enemy:true,reserve:true})).join('')}</div></section><div class="pvp1870-vs-mark">VS</div><section>${playerHeader(mine,true)}<div class="pvp1870-active-row mine">${myActive.map(x=>pvpUnit(x,{selectable:turnMine&&!st.actionBusy,selected:String(x.pow_id)===String(st.selectedActor)})).join('')}</div><div class="pvp1870-reserve-row">${reserves(mineRows).map(x=>pvpUnit(x,{reserve:true})).join('')}${mineRows.filter(x=>x.eliminated||Number(x.hp)<=0).map(x=>pvpUnit(x,{reserve:true})).join('')}</div></section></div><div class="pvp1870-command ${turnMine?'':'is-locked'}"><div class="pvp1870-selected"><small>ACTOR</small><b>${esc(powName(actor||''))}</b><span>${support?'Mục tiêu: bản thân':`Mục tiêu: ${esc(powName(enemyActive.find(x=>String(x.pow_id)===String(st.selectedTarget))||enemyActive[0]||''))}`}</span></div><div class="pvp1870-skills">${['basic','s1','s2','ult'].map(k=>{const a=abilityOf(actor,k),r=skillReady(actor,k);return `<button data-pvp-skill="${k}" class="${st.selectedSkill===k?'is-selected':''}" ${!turnMine||st.actionBusy||!r.ok?'disabled':''}><small>${k==='basic'?'BASIC':k==='ult'?'ULTIMATE':k.toUpperCase()}</small><b>${esc(a?.name||k)}</b><span>${r.cd?`CD ${r.cd}`:r.cost?`⚡ ${r.cost}`:'Miễn phí'}</span></button>`}).join('')}</div><div class="pvp1870-action-row"><button class="btn primary" data-pvp-act ${!turnMine||st.actionBusy||!actor||(!support&&!st.selectedTarget)||!ready.ok?'disabled':''}>${st.actionBusy?'Đang xác nhận…':`Dùng ${esc(ability?.name||st.selectedSkill)}`}</button>${canPass?`<button class="btn secondary" data-pvp-pass ${!turnMine||st.actionBusy?'disabled':''}>Bỏ lượt do hard CC</button>`:''}<span>${turnMine?'Chỉ server mới có quyền áp dụng damage / HP / lượt.':'Đang chờ hành động từ đối thủ.'}</span></div></div><div class="pvp1870-log"><div class="pvp1870-subhead"><div><small>SERVER EVENT LOG</small><h3>Debug / replay ledger</h3></div><button data-pvp-replay="${m.id}">Mở full replay</button></div><div>${(m.events||[]).slice(-14).reverse().map(e=>`<article><small>#${e.id} · T${e.turn_no}</small><span>${esc(eventText(e,m))}</span></article>`).join('')||'<p class="pvp1870-empty">Chưa có event.</p>'}</div></div>`;bindCommon(root);$$('[data-pvp-actor]',root).forEach(b=>b.onclick=()=>selectActor(b.dataset.pvpActor));$$('[data-pvp-target]',root).forEach(b=>b.onclick=()=>selectTarget(b.dataset.pvpTarget));$$('[data-pvp-skill]',root).forEach(b=>b.onclick=()=>selectSkill(b.dataset.pvpSkill));$('[data-pvp-act]',root)?.addEventListener('click',actNow);$('[data-domain-simple]',root)?.addEventListener('click',e=>activateTerritory('simple',e.currentTarget.dataset.domainSimple));$('[data-domain-expansion]',root)?.addEventListener('click',e=>activateTerritory('expansion',e.currentTarget.dataset.domainExpansion));$('[data-pvp-pass]',root)?.addEventListener('click',passTurn);armClock()}

function renderResult(root,d,m){const win=String(m.winnerId)===String(m.me),opp=opponent(m);root.innerHTML=`<div class="pvp1870-result ${win?'is-win':'is-loss'}"><small>BATTLE RESULT · SERVER VERIFIED</small><h2>${win?'CHIẾN THẮNG':'THẤT BẠI'}</h2><p>${esc(reasonLabel(m.finishReason))} · đối thủ ${esc(opp?.display_name||'Tamer')} · ${Number(m.turnNo)||0} lượt.</p><div class="pvp1870-result-actions"><button class="btn primary" data-pvp-rematch>↻ Tái đấu</button><button class="btn secondary" data-pvp-replay="${m.id}">Xem replay</button><button class="btn secondary" data-pvp-ack>Đóng kết quả</button></div></div><div class="pvp1870-log"><div class="pvp1870-subhead"><div><small>FINAL EVENT LEDGER</small><h3>Nhật ký trận</h3></div></div><div>${(m.events||[]).slice(-20).reverse().map(e=>`<article><small>#${e.id} · T${e.turn_no}</small><span>${esc(eventText(e,m))}</span></article>`).join('')}</div></div>${renderHistory()}`;bindCommon(root);$('[data-pvp-rematch]',root)?.addEventListener('click',rematch);$('[data-pvp-ack]',root)?.addEventListener('click',ackResult)}

function bindCommon(root){
  $$('[data-pvp-accept]',root).forEach(b=>b.onclick=()=>challengeResponse(b.dataset.pvpAccept,'accept'));
  $$('[data-pvp-decline]',root).forEach(b=>b.onclick=()=>challengeResponse(b.dataset.pvpDecline,'decline'));
  $$('[data-pvp-cancel]',root).forEach(b=>b.onclick=()=>cancelChallenge(b.dataset.pvpCancel));
  $$('[data-pvp-replay]',root).forEach(b=>b.onclick=()=>openReplay(b.dataset.pvpReplay));
  $('[data-pvp-history]',root)?.addEventListener('click',()=>loadHistory(false));
  $('[data-pvp-surrender]',root)?.addEventListener('click',surrender);
}
function render(){const root=ensureRoot();if(!root)return;injectChallengeButtons();if(!online()?.hasSession?.()){root.innerHTML='<div class="pvp1870-login"><b>⚔ PvP Online 2.0</b><p>Đăng nhập Powder Online để giao lưu với bạn bè.</p></div>';return}if(!st.data){root.innerHTML=`<div class="pvp1870-login"><b>⚔ PvP Online 2.0</b><p>${st.notice?esc(st.notice):'Đang lấy trạng thái PvP server…'}</p><button class="btn secondary" data-pvp-load>Làm mới</button></div>`;$('[data-pvp-load]',root)?.addEventListener('click',()=>loadState());return}const m=st.data.match;if(!m)return renderIdle(root,st.data);if(m.status==='lobby')return renderLobby(root,st.data,m);if(m.status==='active')return renderBattle(root,st.data,m);return renderResult(root,st.data,m)}

function ensureReplayModal(){let m=$('#pvp1870ReplayModal');if(!m){m=document.createElement('section');m.id='pvp1870ReplayModal';m.className='pvp1870-replay-modal';m.hidden=true;m.innerHTML='<article id="pvp1870ReplayCard"></article>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)m.hidden=true})}return m}
async function openReplay(matchId){const modal=ensureReplayModal(),card=$('#pvp1870ReplayCard');modal.hidden=false;card.innerHTML='<div class="pvp1870-replay-loading">Đang tải full event ledger từ server…</div>';try{const d=await raw('replay',{matchId},{timeoutMs:10000,retries:1});st.replay=d?.replay||null;st.replayCursor=Math.max(0,(st.replay?.events?.length||1)-1);renderReplayModal()}catch(e){card.innerHTML=`<div class="pvp1870-replay-loading">${esc(e.message||'Không tải được replay.')}</div>`}}
function replayPlayer(id){return st.replay?.players?.find(x=>String(x.user_id)===String(id))?.profile||null}
function replayPow(id){return st.replay?.pows?.find(x=>String(x.pow_id)===String(id))||null}
function replayEventText(e){const pp=e?.payload||{},actor=powName(replayPow(e?.actor_pow_id)||e?.actor_pow_id||''),target=powName(replayPow(e?.target_pow_id)||e?.target_pow_id||'');if(e?.event_type==='skill'){const bits=[];if(pp.damage)bits.push(`damage ${pp.damage}`);if(pp.heal)bits.push(`heal ${pp.heal}`);if(pp.crit)bits.push('CRIT');if(pp.statusApplied&&pp.status)bits.push(pp.status);return `${actor} · ${pp.skillName||pp.skillSlot||'Skill'} → ${target}${bits.length?' · '+bits.join(' · '):''}`}return eventText(e,{pows:st.replay?.pows||[]})}
function renderReplayModal(){const modal=ensureReplayModal(),card=$('#pvp1870ReplayCard'),r=st.replay;if(!r){modal.hidden=true;return}const events=r.events||[],idx=Math.max(0,Math.min(events.length-1,st.replayCursor)),cur=events[idx],pa=replayPlayer(r.match.playerA),pb=replayPlayer(r.match.playerB);card.innerHTML=`<div class="pvp1870-replay-head"><div><p class="eyebrow">SERVER EVENT REPLAY · ${esc(r.match.id.slice(0,8))}</p><h2>${esc(pa?.display_name||'Tamer A')} vs ${esc(pb?.display_name||'Tamer B')}</h2><small>${events.length} events · ${esc(reasonLabel(r.match.finishReason))}</small></div><button data-pvp-replay-close>×</button></div><div class="pvp1870-replay-focus"><button data-pvp-replay-prev ${idx<=0?'disabled':''}>←</button><div><small>EVENT ${events.length?idx+1:0}/${events.length}${cur?` · TURN ${cur.turn_no}`:''}</small><b>${cur?esc(replayEventText(cur)):'Không có event'}</b>${cur?`<code>${esc(JSON.stringify(cur.payload||{}))}</code>`:''}</div><button data-pvp-replay-next ${idx>=events.length-1?'disabled':''}>→</button></div><div class="pvp1870-replay-tools"><button class="btn secondary" data-pvp-replay-copy>📋 Sao chép JSON log</button><span>Event log này là dữ liệu server, dùng để debug hoặc đối chiếu trận.</span></div><div class="pvp1870-replay-list">${events.slice(Math.max(0,idx-60),Math.min(events.length,idx+61)).map((e,i)=>{const real=Math.max(0,idx-60)+i;return `<button class="${real===idx?'is-current':''}" data-pvp-replay-jump="${real}"><small>#${e.id} · T${e.turn_no}</small><span>${esc(replayEventText(e))}</span></button>`}).join('')}</div>`;$('[data-pvp-replay-close]',card).onclick=()=>modal.hidden=true;$('[data-pvp-replay-prev]',card)?.addEventListener('click',()=>{st.replayCursor=Math.max(0,idx-1);renderReplayModal()});$('[data-pvp-replay-next]',card)?.addEventListener('click',()=>{st.replayCursor=Math.min(events.length-1,idx+1);renderReplayModal()});$$('[data-pvp-replay-jump]',card).forEach(b=>b.onclick=()=>{st.replayCursor=Number(b.dataset.pvpReplayJump)||0;renderReplayModal()});$('[data-pvp-replay-copy]',card)?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(r,null,2));toast('Đã sao chép full PvP replay JSON.')}catch{toast('Trình duyệt không cho phép sao chép tự động.')}})}

async function restoreIfLive(){if(st.restoring||!online()?.hasSession?.()||navigator.onLine===false)return;st.restoring=true;try{await loadState({quiet:true,forceView:true})}finally{st.restoring=false}}
function boot(){
  window.addEventListener('powder:social-render',()=>{render();injectChallengeButtons();armPoll()});
  window.addEventListener('powder:view-changed',e=>{if(e?.detail?.view==='social'){render();loadState({quiet:true});}armPoll()});
  window.addEventListener('powder:online-login',()=>setTimeout(()=>restoreIfLive(),400));
  window.addEventListener('powder:network-reconnected',()=>restoreIfLive());
  window.addEventListener('online',()=>{st.offline=false;restoreIfLive()});
  window.addEventListener('offline',()=>{st.offline=true;clearTimeout(st.poll);st.poll=0;render()},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(isInMatch())loadState({quiet:true});armPoll()}else{clearTimeout(st.poll);st.poll=0}},{passive:true});
  setTimeout(()=>{render();if(online()?.hasSession?.())restoreIfLive()},900);
}
const api={version:VERSION,load:loadState,challenge,isInMatch,state:()=>st.data,history:()=>[...st.history],openReplay,reconnect:restoreIfLive,diagnostics:()=>({version:VERSION,matchId:st.data?.match?.id||null,status:st.data?.match?.status||null,turnNo:st.data?.match?.turnNo||0,stateVersion:st.data?.match?.stateVersion||null,offline:st.offline,actionBusy:st.actionBusy,pollArmed:!!st.poll,clockArmed:!!st.clock})};
window.POWDER_PVP_V1881=api;window.POWDER_PVP_V1880=api;window.POWDER_PVP_V1871=api;window.POWDER_PVP_V1870=api;window.POWDER_PVP_V155=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
