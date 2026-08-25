(()=>{'use strict';
if(window.POWDER_COMBAT_SKILL_INSPECTOR_V2187)return;
const VERSION='21.8.7',PANEL_ID='cv2187SkillInspector';
const state={selectedKey:'basic',renders:0,hovers:0,clicks:0,lastPowId:'',lastSkill:'',lastAt:0};
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const core=()=>{try{return window.POWDER_BATTLE_PLAYER_V177?.getCore?.()||null}catch(_){return null}};
function keyLabel(key){return({basic:'ĐÒN CƠ BẢN',skill1:'KỸ NĂNG 1',skill2:'KỸ NĂNG 2',exclusive:'ĐỘC QUYỀN',ultimate:'TỐI THƯỢNG'})[key]||String(key||'KỸ NĂNG').toUpperCase()}
function targetLabel(raw='',desc=''){
  const s=`${raw} ${desc}`.toLowerCase();
  if(/all enemies|enemy all|toàn bộ.*địch|aoe|area/.test(s))return'TOÀN BỘ ĐỊCH';
  if(/all allies|ally all|toàn bộ.*đồng minh/.test(s))return'TOÀN ĐỘI';
  if(/self|bản thân/.test(s))return'BẢN THÂN';
  if(/ally|đồng minh/.test(s))return'ĐỒNG MINH';
  if(/random/.test(s))return'MỤC TIÊU NGẪU NHIÊN';
  return'MỘT MỤC TIÊU';
}
function effectTags(a,desc=''){
  const text=`${desc} ${(a?.effects||[]).map?.(x=>typeof x==='string'?x:(x?.name||x?.type||x?.status||'')).join(' ')||''}`.toLowerCase();
  const tags=[];
  const push=(ok,label)=>{if(ok&&!tags.includes(label))tags.push(label)};
  push(Number(a?.hits)>1,`${Number(a.hits)} HIT`);
  push(/heal|hồi/.test(text),'HỒI MÁU');
  push(/shield|khiên|giáp ảo/.test(text),'KHIÊN');
  push(/stun|choáng/.test(text),'CHOÁNG');
  push(/freeze|đóng băng|băng giá/.test(text),'ĐÓNG BĂNG');
  push(/burn|thiêu đốt/.test(text),'THIÊU ĐỐT');
  push(/poison|độc/.test(text),'ĐỘC');
  push(/anti.?heal|giảm hồi/.test(text),'GIẢM HỒI MÁU');
  push(/lifesteal|hút máu/.test(text),'HÚT MÁU');
  push(/cleanse|thanh tẩy|giải hiệu ứng/.test(text),'THANH TẨY');
  push(/crit|bạo kích/.test(text),'BẠO KÍCH');
  push(/break|phá khiên/.test(text),'PHÁ KHIÊN');
  push(/speed|tốc độ|meter|lượt/.test(text),'NHỊP LƯỢT');
  return tags.slice(0,6)
}
function costLabel(key,info,u){
  if(key==='ultimate')return`${Math.round(Number(u?.rage)||0)}/100 Nộ`;
  if(key==='exclusive')return`${Math.round(Number(u?.rage)||0)}/90 Nộ`;
  return`${Math.round(Number(info?.cost)||0)} Mana`;
}
function render(key=state.selectedKey){
  const dock=document.querySelector('#battleView:not([hidden]) .cv7-command');if(!dock)return false;
  const c=core(),u=c?.state?.current;if(!c||!u||u.side!=='player')return false;
  const info=c.actionInfo?.(u,key);const a=info?.ability;if(!a)return false;
  state.selectedKey=key;state.lastPowId=String(u.powId||u.id||'');state.lastSkill=key;state.lastAt=Date.now();
  let panel=dock.querySelector(`#${PANEL_ID}`);if(!panel){panel=document.createElement('aside');panel.id=PANEL_ID;panel.className='cv2187-inspector';dock.appendChild(panel)}
  const desc=String(a.rulesText||a.description||'Không có mô tả chi tiết.').trim();
  const targetRaw=a.target||a.targetType||a.scope||info.targetSide||info.target||'';
  const tags=effectTags(a,desc);
  const base=Number(info?.plan?.base)||0,max=Number(info?.plan?.max)||base;
  const status=info?.available?'SẴN SÀNG':'CHƯA THỂ DÙNG';
  panel.dataset.available=info?.available?'1':'0';
  panel.innerHTML=`<header><div><small>${esc(keyLabel(key))}</small><b>${esc(a.name||keyLabel(key))}</b></div><span>${esc(status)}</span></header><div class="cv2187-meta"><span><small>CHI PHÍ</small><b>${esc(costLabel(key,info,u))}</b></span><span><small>MỤC TIÊU</small><b>${esc(targetLabel(targetRaw,desc))}</b></span><span><small>KÍCH HOẠT</small><b>${base}${max>base?`–${max}`:''} câu</b></span></div><p>${esc(desc)}</p>${tags.length?`<div class="cv2187-tags">${tags.map(x=>`<i>${esc(x)}</i>`).join('')}</div>`:''}`;
  state.renders++;return true
}
function pick(btn,kind='click'){
  const key=String(btn?.dataset?.cv7Skill||'');if(!key)return;
  if(kind==='hover')state.hovers++;else state.clicks++;
  requestAnimationFrame(()=>render(key))
}
document.addEventListener('pointerover',e=>{const b=e.target?.closest?.('[data-cv7-skill]');if(b)pick(b,'hover')},true);
document.addEventListener('focusin',e=>{const b=e.target?.closest?.('[data-cv7-skill]');if(b)pick(b,'hover')},true);
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-cv7-skill]');if(b)pick(b,'click')},true);
window.addEventListener('powder:view-changed',e=>{const v=String(e?.detail?.view||'');if(v==='battle')setTimeout(()=>render(state.selectedKey||'basic'),160)},{passive:true});
function snapshot(){return{version:VERSION,...state,active:Boolean(document.querySelector(`#${PANEL_ID}`)),policy:'event-driven Combat skill detail inspector; BattleCore actionInfo is read-only; no MutationObserver, no interval, no formula mutation'}}
window.POWDER_COMBAT_SKILL_INSPECTOR_V2187={version:VERSION,render,snapshot};
})();