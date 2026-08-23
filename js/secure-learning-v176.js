(()=>{'use strict';
const ON=()=>window.POWDER_ONLINE_V150;
function hasAccount(){return !!ON()?.hasSession?.()}
async function callAt(path,action,payload={}){const o=ON();if(!o?.hasSession?.())throw new Error('Đăng nhập Powder Online để dùng xác minh học tập.');const r=await o.request(path,{method:'POST',body:JSON.stringify({action,...payload,clientVersion:window.POWDER_CONFIG?.appVersion||'',deviceId:o.state?.()?.device||''}),retries:0});return r?.result??r}
function call(action,payload={}){return callAt('/functions/v1/powder-learning-secure',action,payload)}
async function start({type='lesson',lessonId='',language='',level='',questionIds=[],candidateQuestionIds=[],eventId=''}={}){if(type==='lesson')return callAt('/functions/v1/powder-learning-lesson-v1829','start',{lessonId,language,level});return call('start',{type,lessonId,language,level,questionIds,candidateQuestionIds,eventId})}
const api={hasAccount,start,answer:(sessionId,questionId,selected,responseMs=0)=>call('answer',{sessionId,questionId,selected,responseMs}),finish:async(sessionId,durationSeconds=0)=>{const r=await call('finish',{sessionId,durationSeconds});window.dispatchEvent(new CustomEvent('powder:secure-learning-finished',{detail:r||{}}));return r}};
window.POWDER_SECURE_LEARNING_V176=api;
})();
