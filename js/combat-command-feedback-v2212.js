(()=>{'use strict';
if(window.POWDER_COMBAT_COMMAND_FEEDBACK_V2212)return;
const VERSION='22.1.2',STYLE_ID='powderCombatCommandFeedback2212Style';
const state={checks:0,blocked:0,toasts:0,deduped:0,lastAt:0,lastKey:'',lastReason:''};
let hideTimer=0,lastToken='',lastTokenAt=0;
const q=(s,r=document)=>r?.querySelector?.(s)||null;
const core=()=>{try{return window.POWDER_BATTLE_PLAYER_V177?.getCore?.()||null}catch(_){return null}};
function style(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.combat-v7-mount .ccf2212-toast{position:absolute;left:50%;bottom:146px;z-index:180;max-width:min(560px,calc(100% - 32px));padding:9px 14px;border:1px solid rgba(255,196,105,.42);border-radius:12px;background:rgba(22,18,15,.94);box-shadow:0 10px 26px rgba(0,0,0,.30);color:#fff3d7;font-size:11px;font-weight:800;line-height:1.3;text-align:center;pointer-events:none;opacity:0;transform:translate3d(-50%,6px,0);transition:opacity .14s ease,transform .14s ease;contain:layout paint style}
.combat-v7-mount .ccf2212-toast.is-live{opacity:1;transform:translate3d(-50%,0,0)}
html.reduce-motion .combat-v7-mount .ccf2212-toast,.combat-v7-mount.cv71-fx-low .ccf2212-toast{transition:none}
`;document.head.appendChild(s)}
function activeField(){return q('#battleView:not([hidden]) .combat-v7-mount .cv7-field')}
function abilityState(unit,key,info){
  if(!info?.ability)return{reason:'KỸ NĂNG KHÔNG TỒN TẠI',code:'missing'};
  if(info.available)return null;
  if(key==='exclusive'&&unit?.exclusiveUsed)return{reason:'ĐỘC QUYỀN ĐÃ DÙNG · 1 LẦN/TRẬN',code:'used'};
  if(Number(info.cooldownRemaining)>0)return{reason:`HỒI CHIÊU · CÒN ${Math.ceil(Number(info.cooldownRemaining))} LƯỢT`,code:'cooldown'};
  const cost=Math.max(0,Number(info.cost)||0),mana=Math.max(0,Math.round(Number(unit?.mana)||0));
  if(mana<cost)return{reason:`THIẾU MANA · ${mana}/${Math.round(cost)}`,code:'mana'};
  const rage=Math.max(0,Math.round(Number(unit?.rage)||0));
  if(key==='ultimate'&&rage<100)return{reason:`CHƯA ĐỦ NỘ · ${rage}/100`,code:'rage'};
  if(key==='exclusive'&&rage<90)return{reason:`CHƯA ĐỦ NỘ · ${rage}/90`,code:'rage'};
  if(info.specialRequired){const r=info.specialResource,need=Math.max(0,Number(info.specialRequired)||0),have=Math.max(0,Number(r?.value)||0);if(!r||have<need)return{reason:`THIẾU ${String(r?.name||'TÀI NGUYÊN').toUpperCase()} · ${have}/${need}`,code:'special'};if(info.specialReady===false)return{reason:`CHƯA ĐỦ ĐIỀU KIỆN · ${r.name} ${have}/${Number(r.max)||need}`,code:'special'};}
  if(key==='exclusive'&&unit?.powId==='venomarch'){
    const c=core(),foes=unit.side==='player'?(c?.living?.('enemy')||[]):(c?.living?.('player')||[]),poisoned=foes.filter(x=>Number(x?.statuses?.Poison?.stacks||0)>0).length,ticks=Math.max(0,Number(unit?.v18x?.poisonTicks)||0);
    return{reason:`BÁCH TÚC ĐỘC NGỤC · NHIỄM ĐỘC ${poisoned}/2 · NHỊP ĐỘC ${ticks}/6`,code:'exclusive-condition'};
  }
  return{reason:'KỸ NĂNG CHƯA ĐỦ ĐIỀU KIỆN KÍCH HOẠT',code:'locked'};
}
function inspect(button){
  const key=String(button?.dataset?.cv7Skill||'');if(!key)return null;
  const c=core(),unit=c?.state?.current;if(!c||!unit||unit.side!=='player'||c.state?.phase!=='running')return null;
  let info=null;try{info=c.actionInfo?.(unit,key)||null}catch(_){return null}
  state.checks++;return{key,unit,info,blocked:!info?.available,why:abilityState(unit,key,info)};
}
function toast(text,key=''){
  const field=activeField();if(!field||!text)return false;style();let n=q(':scope > .ccf2212-toast',field);if(!n){n=document.createElement('div');n.className='ccf2212-toast';n.setAttribute('role','status');n.setAttribute('aria-live','polite');field.appendChild(n)}
  n.textContent=text;n.classList.remove('is-live');void n.offsetWidth;n.classList.add('is-live');clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(n.isConnected)n.classList.remove('is-live')},1550);
  state.toasts++;state.lastAt=Date.now();state.lastKey=key;state.lastReason=text;return true;
}
function showBlocked(result){if(!result?.blocked||!result.why)return false;const t=performance?.now?.()||Date.now(),token=`${result.key}|${result.why.code}|${result.why.reason}`;if(token===lastToken&&t-lastTokenAt<650){state.deduped++;return true}lastToken=token;lastTokenAt=t;state.blocked++;toast(result.why.reason,result.key);return true}
function onPointer(e){const b=e.target?.closest?.('.combat-v7-mount [data-cv7-skill]');if(!b)return;showBlocked(inspect(b))}
function onClick(e){const b=e.target?.closest?.('.combat-v7-mount [data-cv7-skill]');if(!b)return;const r=inspect(b);if(!r?.blocked)return;if(showBlocked(r)){e.preventDefault();e.stopPropagation()}}
function snapshot(){return{version:VERSION,...state,active:Boolean(activeField()),policy:'Transient locked-skill explanation only; one finite toast; no polling, gameplay, timing, damage, resource, server or save mutation.'}}
document.addEventListener('pointerdown',onPointer,true);document.addEventListener('click',onClick,true);window.addEventListener('pagehide',()=>{clearTimeout(hideTimer);hideTimer=0},{once:true});
window.POWDER_COMBAT_COMMAND_FEEDBACK_V2212={version:VERSION,snapshot};style();
})();
