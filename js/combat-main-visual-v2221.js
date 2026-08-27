(()=>{'use strict';
if(window.POWDER_MAIN_COMBAT_VISUAL_V2221)return;
const VERSION='22.2.2';
const CSS_ID='powderCombatMainVisual2221Css';
const ELEMENT_CSS_ID='powderCombatMainElementVisual2222Css';
const CSS_HREF='css/combat-main-visual-v2221.css?v=2222';
const ELEMENT_CSS_HREF='css/combat-main-element-fx-v2222.css?v=2222';
const state={mounts:0,syncs:0,impactEvents:0,reactions:0,fieldKicks:0,flowPatches:0,attackerLunges:0,cssReady:false,elementCssReady:false,lastPressure:'calm',lastSeverity:'none',active:false};
let mount=null,observer=null,raf=0,lastLungeToken='';
const reactionTimers=new WeakMap();
const flowTokens=new WeakMap();
const root=document.documentElement;
const now=()=>performance?.now?.()||Date.now();
const active=n=>Boolean(n?.isConnected&&!n.closest?.('[hidden]'));
const pressure=()=>String(window.POWDER_ADAPTIVE_PRESSURE_V21011?.level?.()||root.dataset.resourcePressure||'calm');
function reducedMotion(){
  if(root.classList.contains('reduce-motion')||root.dataset.perfReason==='reduced-motion')return true;
  try{if(window.POWDER_APP?.getSave?.()?.settings?.reducedMotion)return true}catch(_){}
  try{if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return true}catch(_){}
  return false;
}
function ensureSheet(id,href,onReady){
  let link=document.getElementById(id);
  if(link){onReady();return link}
  link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;
  link.addEventListener('load',()=>{onReady();schedule()},{once:true});
  document.head.appendChild(link);return link;
}
function ensureCss(){
  ensureSheet(CSS_ID,CSS_HREF,()=>{state.cssReady=true});
  ensureSheet(ELEMENT_CSS_ID,ELEMENT_CSS_HREF,()=>{state.elementCssReady=true});
}
function pickMount(){return [...document.querySelectorAll('.combat-v7-mount')].find(active)||document.querySelector('.combat-v7-mount')||null}
function cleanupMount(node){
  if(!node)return;
  node.classList.remove('cmv221-ready','cmv221-pressure-reduced');
  delete node.dataset.cmv221Pressure;
  delete node.dataset.cmv221Version;
  for(const unit of node.querySelectorAll('.cv7-unit')){
    unit.classList.remove('cmv221-impact','cmv221-impact-light','cmv221-impact-medium','cmv221-impact-heavy','cmv221-impact-fatal','cmv221-shield-react','cmv221-heal-react','cmv221-control-react','cmv221-attacking');
  }
}
function attach(next){
  if(next===mount){schedule();return}
  if(observer){observer.disconnect();observer=null}
  if(mount)cleanupMount(mount);
  mount=next;lastLungeToken='';
  state.active=!!mount;
  if(!mount)return;
  state.mounts++;
  observer=new MutationObserver(()=>schedule());
  observer.observe(mount,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','data-csi218-key','data-csi218-phase']});
  schedule();
}
function inferFlowKey(flow){
  for(const key of ['ultimate','exclusive','skill2','skill1','basic'])if(flow.classList.contains(key))return key;
  return String(mount?.dataset?.csi218Key||'skill');
}
function flowDuration(key){return key==='ultimate'?820:key==='exclusive'?740:key==='skill2'?680:key==='skill1'?620:540}
function patchFlows(){
  if(!mount)return;
  for(const flow of mount.querySelectorAll('.cv7-attack-flow')){
    const key=inferFlowKey(flow),token=`${key}:${flow.style.getPropertyValue('--impact-delay')}:${flow.style.getPropertyValue('--len')}`;
    if(flowTokens.get(flow)===token)continue;
    flowTokens.set(flow,token);state.flowPatches++;
    flow.dataset.cmv221Key=key;
    flow.style.setProperty('--flow-duration',`${flowDuration(key)}ms`);
    const trace=flow.querySelector('.cv7-attack-trace');
    if(trace)trace.dataset.cmv221Flow='1';
  }
}
function sync(){
  raf=0;
  const next=pickMount();
  if(next!==mount){attach(next);return}
  if(!mount||!mount.isConnected){attach(next);return}
  state.syncs++;state.active=true;state.lastPressure=pressure();
  mount.classList.add('cmv221-ready');
  mount.classList.toggle('cmv221-pressure-reduced',state.lastPressure==='hot'||state.lastPressure==='critical');
  mount.dataset.cmv221Pressure=state.lastPressure;mount.dataset.cmv221Version=VERSION;
  patchFlows();
}
function schedule(){if(raf||document.hidden)return;raf=requestAnimationFrame(sync)}
function unitById(id){
  if(!mount||!id)return null;
  try{return mount.querySelector(`.cv7-unit[data-cv7-unit="${CSS.escape(String(id))}"]`)}catch(_){return null}
}
function unitByActorName(name){
  if(!mount||!name||name==='—')return null;
  const wanted=String(name).trim().toLocaleLowerCase('vi');
  const units=[...mount.querySelectorAll('.cv7-unit')];
  return units.find(unit=>String(unit.textContent||'').toLocaleLowerCase('vi').includes(wanted))||null;
}
function clearReaction(unit){
  if(!unit)return;
  const timer=reactionTimers.get(unit);if(timer)clearTimeout(timer);
  unit.classList.remove('cmv221-impact','cmv221-impact-light','cmv221-impact-medium','cmv221-impact-heavy','cmv221-impact-fatal','cmv221-shield-react','cmv221-heal-react','cmv221-control-react');
}
function animateArt(unit,severity,feedback){
  const art=unit?.querySelector('.cv7-art');if(!art?.animate||reducedMotion())return;
  const low=mount?.classList.contains('cv71-fx-low')||state.lastPressure==='critical';
  const side=unit.classList.contains('enemy')?'enemy':'player';
  const away=side==='enemy'?-1:1;
  if(feedback==='heal'){
    art.animate([{transform:'translate3d(0,0,0) scale(1)'},{transform:'translate3d(0,-6px,0) scale(1.035)',offset:.42},{transform:'translate3d(0,0,0) scale(1)'}],{duration:low?260:420,easing:'cubic-bezier(.18,.72,.2,1)'});return;
  }
  if(feedback==='shield'){
    art.animate([{transform:'translate3d(0,0,0) scale(1)'},{transform:'translate3d(0,0,0) scale(1.025)',offset:.4},{transform:'translate3d(0,0,0) scale(1)'}],{duration:low?240:390,easing:'ease-out'});return;
  }
  if(feedback==='control'){
    art.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d(-5px,0,0)'},{transform:'translate3d(5px,0,0)'},{transform:'translate3d(-3px,0,0)'},{transform:'translate3d(0,0,0)'}],{duration:low?260:440,easing:'ease-out'});return;
  }
  const px=severity==='fatal'?18:severity==='heavy'?14:severity==='medium'?10:6;
  const squash=severity==='fatal'?.94:severity==='heavy'?.965:.985;
  const duration=low?250:severity==='fatal'?620:severity==='heavy'?520:severity==='medium'?430:330;
  art.animate([
    {offset:0,transform:'translate3d(0,0,0) scale(1)'},
    {offset:.16,transform:`translate3d(${away*px*.22}px,${away*px}px,0) scale(${squash})`},
    {offset:.34,transform:`translate3d(${-away*px*.14}px,${-away*px*.24}px,0) scale(1.012)`},
    {offset:.56,transform:`translate3d(${away*px*.08}px,${away*px*.12}px,0) scale(.996)`},
    {offset:1,transform:'translate3d(0,0,0) scale(1)'}
  ],{duration,easing:'cubic-bezier(.16,.7,.18,1)'});
}
function animateAttacker(detail){
  if(!mount||reducedMotion()||String(detail.phase)!=='release')return;
  const token=`${detail.key}|${detail.actor}|${detail.ability}|${detail.target}|${detail.phase}`;
  if(token===lastLungeToken)return;lastLungeToken=token;
  const unit=unitByActorName(detail.actor);const art=unit?.querySelector('.cv7-art');if(!unit||!art?.animate)return;
  const low=mount.classList.contains('cv71-fx-low')||state.lastPressure==='critical';
  const key=String(detail.key||'skill1');
  const power=key==='ultimate'?28:key==='exclusive'?23:key==='skill2'?19:key==='skill1'?15:10;
  const side=unit.classList.contains('enemy')?'enemy':'player';
  const dir=side==='enemy'?1:-1;
  const duration=low?220:key==='ultimate'?520:key==='exclusive'?440:key==='skill2'?390:key==='skill1'?340:280;
  unit.classList.add('cmv221-attacking');
  art.animate([
    {offset:0,transform:'translate3d(0,0,0) scale(1)'},
    {offset:.16,transform:`translate3d(0,${-dir*power*.22}px,0) scale(.985)`},
    {offset:.42,transform:`translate3d(0,${dir*power}px,0) scale(${key==='ultimate'?1.065:1.035})`},
    {offset:.66,transform:`translate3d(0,${dir*power*.48}px,0) scale(1.012)`},
    {offset:1,transform:'translate3d(0,0,0) scale(1)'}
  ],{duration,easing:'cubic-bezier(.14,.7,.18,1)'}).finished.catch(()=>{}).finally(()=>unit.classList.remove('cmv221-attacking'));
  state.attackerLunges++;
}
function fieldKick(severity){
  if(!mount||reducedMotion()||state.lastPressure==='critical'||mount.classList.contains('cv71-fx-low'))return;
  if(severity!=='heavy'&&severity!=='fatal')return;
  const field=mount.querySelector('.cv7-field');if(!field?.animate)return;
  state.fieldKicks++;
  const px=severity==='fatal'?7:4;
  field.animate([
    {transform:'translate3d(0,0,0)'},
    {transform:`translate3d(${px}px,${-px*.35}px,0)`,offset:.22},
    {transform:`translate3d(${-px*.7}px,${px*.25}px,0)`,offset:.46},
    {transform:`translate3d(${px*.35}px,${-px*.12}px,0)`,offset:.68},
    {transform:'translate3d(0,0,0)'}
  ],{duration:severity==='fatal'?280:210,easing:'ease-out'});
}
function react(detail={}){
  state.impactEvents++;state.lastSeverity=String(detail.severity||'none');
  const unit=unitById(detail.unitId);if(!unit)return;
  clearReaction(unit);
  const severity=String(detail.severity||'none');
  const feedback=String(detail.feedback||'none');
  if(feedback==='impact'||feedback==='fatal'||severity!=='none'){
    unit.classList.add('cmv221-impact',`cmv221-impact-${severity==='none'?'light':severity}`);
    animateArt(unit,severity==='none'?'light':severity,'impact');
    fieldKick(severity);state.reactions++;
  }else if(feedback==='shield'){
    unit.classList.add('cmv221-shield-react');animateArt(unit,'none','shield');state.reactions++;
  }else if(feedback==='heal'){
    unit.classList.add('cmv221-heal-react');animateArt(unit,'none','heal');state.reactions++;
  }else if(feedback==='control'){
    unit.classList.add('cmv221-control-react');animateArt(unit,'none','control');state.reactions++;
  }
  const timer=setTimeout(()=>clearReaction(unit),severity==='fatal'?720:560);reactionTimers.set(unit,timer);
}
function skillIdentity(detail={}){
  schedule();
  if(!mount)return;
  const key=String(detail.key||'skill'),phase=String(detail.phase||'idle');
  mount.dataset.cmv221Skill=key;mount.dataset.cmv221Phase=phase;
  animateAttacker(detail);patchFlows();
}
function onPresentation(){schedule()}
function start(){
  ensureCss();attach(pickMount());
  window.addEventListener('powder:combat-presentation-sync',onPresentation,{passive:true});
  window.addEventListener('powder:combat-impact-feedback',e=>react(e.detail||{}),{passive:true});
  window.addEventListener('powder:combat-skill-identity',e=>skillIdentity(e.detail||{}),{passive:true});
  window.addEventListener('powder:resource-pressure',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()},{passive:true});
  const bodyObserver=new MutationObserver(()=>{const next=pickMount();if(next!==mount)attach(next);else schedule()});
  bodyObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
}
function snapshot(){return{version:VERSION,...state,active:!!mount?.isConnected,reducedMotion:reducedMotion(),flowNow:mount?.querySelectorAll('.cv7-attack-flow').length||0,fxNow:mount?.querySelectorAll('.cv7-vfx,.cv7-fx').length||0,at:Math.round(now())}}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
window.POWDER_MAIN_COMBAT_VISUAL_V2221={version:VERSION,snapshot,sync:schedule};
})();
