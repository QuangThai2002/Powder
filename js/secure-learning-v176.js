(()=>{'use strict';
const ON=()=>window.POWDER_ONLINE_V150;
const sessions=new Map();
function hasAccount(){return !!ON()?.hasSession?.()}
async function callAt(path,action,payload={}){const o=ON();if(!o?.hasSession?.())throw new Error('Đăng nhập Powder Online để dùng xác minh học tập.');const r=await o.request(path,{method:'POST',body:JSON.stringify({action,...payload,clientVersion:window.POWDER_CONFIG?.appVersion||'',deviceId:o.state?.()?.device||''}),retries:0});return r?.result??r}
function call(action,payload={}){return callAt('/functions/v1/powder-learning-secure',action,payload)}
const ids=(rows=[],limit=5000)=>[...new Set((Array.isArray(rows)?rows:[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,limit);
const canonical=id=>String(id||'').replace(/^rotq178:\d+:/,'');
async function start({type='lesson',lessonId='',language='',level='',questionIds=[],candidateQuestionIds=[],eventId=''}={}){
  if(type!=='lesson')return call('start',{type,lessonId,language,level,questionIds,candidateQuestionIds,eventId});
  const requested=ids(questionIds,200),candidates=ids(candidateQuestionIds,5000);
  const r=await callAt('/functions/v1/powder-learning-lesson-v1829','start',{lessonId,language,level,questionIds:requested,candidateQuestionIds:candidates});
  const serverIds=ids(r?.serverQuestionIds?.length?r.serverQuestionIds:r?.questionIds,200);
  if(!serverIds.length||!r?.sessionId)throw new Error('Máy chủ chưa tạo được bộ câu của bài học.');
  const candidateSet=new Set(candidates),aliases=Array.isArray(r?.questionAliases)?r.questionAliases.map(x=>({serverId:String(x?.serverId||''),clientId:String(x?.clientId||'')})):serverIds.map(serverId=>({serverId,clientId:candidateSet.has(serverId)?serverId:canonical(serverId)}));
  if(aliases.length!==serverIds.length||aliases.some((x,i)=>!x.serverId||x.serverId!==serverIds[i]||!x.clientId||(candidateSet.size&&!candidateSet.has(x.clientId))))throw new Error('Bộ câu Online chưa khớp dữ liệu bài học trên máy. Hãy tải lại trang sau khi cập nhật Powder.');
  sessions.set(String(r.sessionId),{aliases,index:0});
  return{...r,serverQuestionIds:serverIds,questionIds:aliases.map(x=>x.clientId),total:aliases.length,authority:r?.authority||'server-canonical-alias'}
}
async function answer(sessionId,questionId,selected,responseMs=0){const key=String(sessionId||''),s=sessions.get(key);if(!s)return call('answer',{sessionId,questionId,selected,responseMs});const pair=s.aliases[s.index];if(!pair||String(questionId)!==pair.clientId)throw new Error('Thứ tự câu hỏi Online đã lệch. Hãy mở lại bài học.');const r=await call('answer',{sessionId,questionId:pair.serverId,selected,responseMs});s.index++;return r}
async function finish(sessionId,durationSeconds=0){try{const r=await call('finish',{sessionId,durationSeconds});window.dispatchEvent(new CustomEvent('powder:secure-learning-finished',{detail:r||{}}));return r}finally{sessions.delete(String(sessionId||''))}}
const api={hasAccount,start,answer,finish,canonicalQuestionId:canonical,activeLessonSessions:()=>sessions.size};
window.POWDER_SECURE_LEARNING_V176=api;
})();
