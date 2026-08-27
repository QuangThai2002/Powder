(()=>{'use strict';
if(window.POWDER_MAIN_COMBAT_CHOREOGRAPHY_V2223)return;
const VERSION='22.2.3';
const CSS_ID='powderCombatMainChoreography2223Css';
const state={syncs:0,charges:0,releases:0,impacts:0,heavyImpacts:0,fatalImpacts:0,chains:0,maxChain:0,overlayFlashes:0,lastKey:'',lastPhase:'idle',lastElement:'',lastImpactAt:0,active:false};
let mount=null,overlay=null,bodyObserver=null,raf=0,chain=0,chainTimer=0,impactClassTimer=0;
const root=document.documentElement;
const now=()=>performance?.now?.()||Date.now();
const active=n=>Boolean(n?.isConnected&&!n.closest?.('[hidden]'));
const pressure=()=>String(window.POWDER_ADAPTIVE_PRESSURE_V21011?.level?.()||root.dataset.resourcePressure||'calm');
function reducedMotion(){try{return root.classList.contains('reduce-motion')||root.dataset.perfReason==='reduced-motion'||Boolean(window.POWDER_APP?.getSave?.()?.settings?.reducedMotion)||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)}catch(_){return false}}
function ensureCss(){if(document.getElementById(CSS_ID))return;const link=document.createElement('link');link.id=CSS_ID;link.rel='stylesheet';link.href='css/combat-main-choreography-v2223.css?v=2223';document.head.appendChild(link)}
function pickMount(){const all=[...document.querySelectorAll('.combat-v7-mount')];return all.find(active)||all[0]||null}
function cleanup(node){if(!node)return;node.classList.remove('cmc223-ready','cmc223-pressure-reduced','cmc223-impact-heavy','cmc223-impact-fatal');delete node.dataset.cmc223Key;delete node.dataset.cmc223Phase;delete node.dataset.cmc223Chain;for(const u of node.querySelectorAll('.cv7-unit'))u.classList.remove('cmc223-charging','cmc223-releasing');node.querySelector(':scope .cv7-field > .cmc223-overlay')?.remove()}
function attach(next){if(next===mount)return;cleanup(mount);mount=next;overlay=null;chain=0;state.active=!!mount;if(mount){mount.classList.add('cmc223-ready');ensureOverlay();sync()}}
function ensureOverlay(){if(!mount)return null;const field=mount.querySelector('.cv7-field');if(!field)return null;overlay=field.querySelector(':scope > .cmc223-overlay');if(!overlay){overlay=document.createElement('i');overlay.className='cmc223-overlay';overlay.setAttribute('aria-hidden','true');field.appendChild(overlay)}return overlay}
function actorUnit(name){if(!mount||!name||name==='—')return null;const wanted=String(name).trim().toLocaleLowerCase('vi');return [...mount.querySelectorAll('.cv7-unit')].find(u=>String(u.textContent||'').toLocaleLowerCase('vi').includes(wanted))||null}
function inferElement(){if(!mount)return'';const flow=mount.querySelector('.cv7-attack-flow');const vfx=mount.querySelector('.cv7-vfx');for(const n of [flow,vfx])if(n)for(const c of n.classList)if(c.startsWith('el-'))return c;return''}
function clearUnitBeat(unit,cls,delay){if(!unit)return;unit.classList.remove(cls);requestAnimationFrame(()=>{unit.classList.add(cls);setTimeout(()=>unit.classList.remove(cls),delay)})}
function animateCharge(detail){const unit=actorUnit(detail.actor),art=unit?.querySelector('.cv7-art');if(!unit)return;state.charges++;clearUnitBeat(unit,'cmc223-charging',520);if(!art?.animate||reducedMotion())return;const key=String(detail.key||'skill1'),lift=key==='ultimate'?10:key==='exclusive'?8:key==='skill2'?6:4;art.animate([{transform:'translate3d(0,0,0) scale(1)'},{transform:`translate3d(0,-${lift}px,0) scale(${key==='ultimate'?1.045:1.02})`,offset:.64},{transform:'translate3d(0,0,0) scale(1)'}],{duration:key==='ultimate'?520:420,easing:'cubic-bezier(.2,.68,.2,1)'})}
function animateRelease(detail){const unit=actorUnit(detail.actor);if(!unit)return;state.releases++;clearUnitBeat(unit,'cmc223-releasing',460)}
function flashOverlay(element,key,severity='none'){
  const n=ensureOverlay();if(!n||reducedMotion()||pressure()==='critical'||mount?.classList.contains('cv71-fx-low'))return;
  n.className='cmc223-overlay';if(element)n.classList.add(element);const strong=key==='ultimate'||severity==='fatal',mid=key==='exclusive'||key==='skill2'||severity==='heavy';
  if(!n.animate)return;state.overlayFlashes++;
  n.getAnimations?.().forEach(a=>{try{a.cancel()}catch(_){}});
  n.animate([{opacity:0,transform:'scale(.97)'},{opacity:strong ? .72 : mid ? .48 : .28,transform:'scale(1)',offset:.34},{opacity:0,transform:'scale(1.025)'}],{duration:strong?430:mid?320:240,easing:'ease-out'});
}
function updateChain(){const t=now();if(t-state.lastImpactAt>620)chain=0;state.lastImpactAt=t;chain=Math.min(5,chain+1);state.maxChain=Math.max(state.maxChain,chain);if(chain>1)state.chains++;if(mount)mount.dataset.cmc223Chain=String(chain);clearTimeout(chainTimer);chainTimer=setTimeout(()=>{chain=0;if(mount)delete mount.dataset.cmc223Chain},720)}
function onImpact(detail={}){if(!mount)return;state.impacts++;const severity=String(detail.severity||'none');updateChain();const element=inferElement()||state.lastElement;flashOverlay(element,state.lastKey,severity);clearTimeout(impactClassTimer);mount.classList.remove('cmc223-impact-heavy','cmc223-impact-fatal');if(severity==='heavy'){state.heavyImpacts++;mount.classList.add('cmc223-impact-heavy')}else if(severity==='fatal'){state.fatalImpacts++;mount.classList.add('cmc223-impact-fatal')}impactClassTimer=setTimeout(()=>mount?.classList.remove('cmc223-impact-heavy','cmc223-impact-fatal'),420)}
function onIdentity(detail={}){if(!mount)attach(pickMount());if(!mount)return;state.lastKey=String(detail.key||'skill');state.lastPhase=String(detail.phase||'idle');mount.dataset.cmc223Key=state.lastKey;mount.dataset.cmc223Phase=state.lastPhase;const el=inferElement();if(el)state.lastElement=el;if(state.lastPhase==='charge')animateCharge(detail);else if(state.lastPhase==='release'){animateRelease(detail);flashOverlay(state.lastElement,state.lastKey)}else if(state.lastPhase==='impact')flashOverlay(state.lastElement,state.lastKey)}
function sync(){raf=0;const next=pickMount();if(next!==mount){attach(next);return}if(!mount)return;state.syncs++;state.active=true;mount.classList.add('cmc223-ready');mount.classList.toggle('cmc223-pressure-reduced',pressure()==='hot'||pressure()==='critical');const el=inferElement();if(el)state.lastElement=el}
function schedule(){if(raf||document.hidden)return;raf=requestAnimationFrame(sync)}
function start(){ensureCss();attach(pickMount());window.addEventListener('powder:combat-skill-identity',e=>onIdentity(e.detail||{}),{passive:true});window.addEventListener('powder:combat-impact-feedback',e=>onImpact(e.detail||{}),{passive:true});window.addEventListener('powder:combat-presentation-sync',schedule,{passive:true});window.addEventListener('powder:resource-pressure',schedule,{passive:true});bodyObserver=new MutationObserver(()=>schedule());bodyObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()},{passive:true})}
function snapshot(){return{version:VERSION,...state,active:!!mount?.isConnected,chain,pressure:pressure(),reducedMotion:reducedMotion(),element:state.lastElement}}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
window.POWDER_MAIN_COMBAT_CHOREOGRAPHY_V2223={version:VERSION,snapshot,sync:schedule};
})();