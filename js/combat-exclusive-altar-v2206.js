(()=>{'use strict';
if(window.POWDER_COMBAT_EXCLUSIVE_ALTAR_V2206)return;
const VERSION='22.0.6';
const state={renders:0,shown:0,ready:0,locked:0,casts:0,lastPowId:'',lastSkill:'',lastAt:0};
let raf=0,observer=null;
const q=(s,r=document)=>r.querySelector(s);
function core(){try{return window.POWDER_BATTLE_PLAYER_V177?.getCore?.()||null}catch(_){return null}}
function mount(){return q('#battleView:not([hidden]) .combat-v7-mount')}
function current(){return core()?.state?.current||null}
function originalExclusive(m){return q('.cv7-command [data-cv7-skill="exclusive"]',m)}
function text(el,sel,fallback=''){return String(q(sel,el)?.textContent||fallback).trim()}
function iconMarkup(source){const icon=q('.cv7-skill-icon',source);return icon?.innerHTML||'◉'}
function removeAltar(m){m?.removeAttribute('data-exclusive-altar');q('.layout2206-exclusive-altar',m)?.remove()}
function ensure(){
  raf=0;const m=mount();if(!m)return false;const c=core(),u=current(),source=originalExclusive(m);
  if(!c||!u||u.side!=='player'||c.state?.phase!=='running'||u.rarity!=='ancient'||!source){removeAltar(m);return false}
  const center=q('.cv7-center-mark',m);if(!center){removeAltar(m);return false}
  m.dataset.exclusiveAltar='1';
  let altar=q('.layout2206-exclusive-altar',center);
  if(!altar){altar=document.createElement('aside');altar.className='layout2206-exclusive-altar';altar.innerHTML='<button type="button" data-layout2206-exclusive><span class="layout2206-exclusive-icon"></span><span class="layout2206-exclusive-copy"><small>ĐỘC QUYỀN CỔ THẦN</small><b></b><em></em></span><i class="layout2206-exclusive-ring" aria-hidden="true"></i></button>';center.appendChild(altar);state.shown++}
  const btn=q('[data-layout2206-exclusive]',altar),name=text(source,'.cv73-skill-copy b','Độc Quyền'),stateLabel=text(source,'.cv69-skill-state',''),ready=!source.disabled;
  const rage=Math.max(0,Math.round(Number(u.rage)||0));
  const icon=q('.layout2206-exclusive-icon',altar),copyName=q('.layout2206-exclusive-copy b',altar),copyState=q('.layout2206-exclusive-copy em',altar);
  const markup=iconMarkup(source);if(icon&&icon.innerHTML!==markup)icon.innerHTML=markup;if(copyName&&copyName.textContent!==name)copyName.textContent=name;
  const label=ready?'SẴN SÀNG · KÍCH HOẠT':stateLabel||`NỘ ${rage}/90`;
  if(copyState&&copyState.textContent!==label)copyState.textContent=label;
  btn.disabled=!ready;btn.classList.toggle('is-ready',ready);btn.classList.toggle('is-locked',!ready);btn.setAttribute('aria-label',`${name} · ${label}`);
  altar.classList.toggle('is-ready',ready);altar.classList.toggle('is-locked',!ready);
  if(ready)state.ready++;else state.locked++;
  state.renders++;state.lastPowId=String(u.powId||'');state.lastSkill=name;state.lastAt=Date.now();return true;
}
function schedule(){if(!raf)raf=requestAnimationFrame(ensure)}
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-layout2206-exclusive]');if(!b)return;const m=mount(),source=originalExclusive(m);e.preventDefault();e.stopPropagation();if(!source||source.disabled)return;b.classList.add('is-casting');state.casts++;state.lastAt=Date.now();source.click();setTimeout(()=>b.classList.remove('is-casting'),420)},true);
['powder:rendered','powder:combat-state','powder:view-changed','powder:combat-action','resize'].forEach(evt=>window.addEventListener(evt,schedule,{passive:true}));
function observe(){const root=q('#battleView');if(!root||observer)return;observer=new MutationObserver(schedule);observer.observe(root,{subtree:true,childList:true})}
window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);observer?.disconnect();observer=null},{once:true});
function snapshot(){return{version:VERSION,...state,policy:'Ancient exclusive is presented in the neutral center lane and proxies the canonical exclusive button; no Combat Core, cost, targeting or formula mutation.',gameplayMutation:false}}
window.POWDER_COMBAT_EXCLUSIVE_ALTAR_V2206={version:VERSION,refresh:schedule,snapshot};observe();schedule();
})();