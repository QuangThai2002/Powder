(()=>{'use strict';
if(window.POWDER_COMBAT_ACTION_FEEDBACK_V2191)return;
const VERSION='21.9.1',STYLE_ID='powderCombatActionFeedback2191Css',STYLE_HREF='css/combat-action-feedback-v2191.css?v=2191',HUD_ID='cv2191ActionFeedback';
const state={patches:0,captured:0,lastType:'',lastText:'',lastAt:0,entries:[]};let raf=0,serial=0;
const seen=new WeakSet();
function style(){if(document.getElementById(STYLE_ID))return;const l=document.createElement('link');l.id=STYLE_ID;l.rel='stylesheet';l.href=STYLE_HREF;document.head.appendChild(l)}
function typeOf(n){for(const t of ['crit','damage','heal','shield-gain','shield','guard','break','kill','replace','cleanse','status-control','blocked','evade'])if(n.classList.contains(t))return t;return'info'}
function label(type){return({crit:'BẠO KÍCH',damage:'SÁT THƯƠNG',heal:'HỒI MÁU','shield-gain':'NHẬN KHIÊN',shield:'KHIÊN',guard:'BẢO HỘ',break:'PHÁ KHIÊN',kill:'HẠ GỤC',replace:'VÀO SÂN',cleanse:'THANH TẨY','status-control':'KHỐNG CHẾ',blocked:'CHẶN ĐÒN',evade:'NÉ ĐÒN'})[type]||'CHIẾN ĐẤU'}
function sideOf(n){return n.classList.contains('enemy')?'MÁY':n.classList.contains('player')?'BẠN':''}
function capture(){const root=document.querySelector('#battleView:not([hidden]) .combat-v7-mount');if(!root)return false;const nodes=[...root.querySelectorAll('.cv7-fx,.cv7-vfx-label')];let changed=false;for(const n of nodes){if(seen.has(n))continue;seen.add(n);const text=String(n.textContent||'').trim();if(!text)continue;const host=n.classList.contains('cv7-fx')?n:n.closest('.cv7-vfx')||n;const type=typeOf(host),entry={id:++serial,type,label:label(type),side:sideOf(host),text,at:Date.now()};state.entries.unshift(entry);if(state.entries.length>3)state.entries.length=3;state.captured++;state.lastType=type;state.lastText=text;state.lastAt=entry.at;changed=true}if(changed)render();return changed}
function render(){const field=document.querySelector('#battleView:not([hidden]) .cv7-field');if(!field)return false;let hud=document.getElementById(HUD_ID);if(!hud){hud=document.createElement('aside');hud.id=HUD_ID;hud.className='cv2191-action-feedback';field.appendChild(hud)}hud.innerHTML=`<header><small>DIỄN BIẾN VỪA XẢY RA</small><b>Phản hồi Combat</b></header><div>${state.entries.length?state.entries.map(x=>`<span class="type-${x.type}"><i>${x.label}</i><b>${x.side?`${x.side} · `:''}${x.text}</b></span>`).join(''):'<em>Đang chờ hành động đầu tiên…</em>'}</div>`;return true}
function patch(){raf=0;style();capture();render();state.patches++;return true}
function schedule(){if(raf)return;raf=requestAnimationFrame(patch)}
['powder:rendered','powder:combat-state','powder:view-changed'].forEach(evt=>window.addEventListener(evt,schedule,{passive:true}));window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);raf=0;state.entries.length=0},{once:true});
function snapshot(){return{version:VERSION,...state,visible:Boolean(document.getElementById(HUD_ID)),policy:'read-only summary of renderer feedback nodes; last 3 visible action outcomes; no Combat Core, damage, status, AI, Save, Learning or PvP mutation'}}
window.POWDER_COMBAT_ACTION_FEEDBACK_V2191={version:VERSION,refresh:schedule,snapshot};style();schedule();
})();