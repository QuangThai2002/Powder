(()=>{'use strict';
const ON=()=>window.POWDER_ONLINE_V150;
function hasAccount(){return !!ON()?.hasSession?.()}
async function call(action,payload={}){const o=ON();if(!o?.hasSession?.())throw new Error('Đăng nhập Powder Online để dùng Rank Authority.');const r=await o.request('/functions/v1/powder-rank',{method:'POST',body:JSON.stringify({action,...payload}),retries:0});return r?.result??r}
function emit(r){try{window.dispatchEvent(new CustomEvent('powder:rank-server-state',{detail:r||{}}))}catch{}return r}
const api={
  version:'18.6.2',hasAccount,
  state:()=>call('state'),
  startExam:()=>call('exam_start'),
  submitExam:async(sessionId,answers={})=>emit(await call('exam_submit',{sessionId,answers})),
  startPromotionBoss:()=>call('boss_start'),
  submitPromotionBoss:async(sessionId,answers={})=>emit(await call('boss_submit',{sessionId,answers}))
};
window.POWDER_RANK_AUTHORITY_V1862=api;window.POWDER_RANK_AUTHORITY_V1861=api;window.POWDER_RANK_AUTHORITY_V1860=api;window.POWDER_RANK_AUTHORITY_V1852=api;window.POWDER_RANK_AUTHORITY_V1851=api;window.POWDER_RANK_AUTHORITY_V1850=api;window.POWDER_RANK_AUTHORITY_V1840=api;window.POWDER_RANK_AUTHORITY_V1832=api;window.POWDER_RANK_AUTHORITY_V1831=api;window.POWDER_RANK_AUTHORITY_V1830=api;window.POWDER_RANK_AUTHORITY_V1829=api;
})();
