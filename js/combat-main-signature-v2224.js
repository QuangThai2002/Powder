(()=>{'use strict';
if(window.POWDER_MAIN_COMBAT_SIGNATURE_V2224)return;
const VERSION='22.2.4';
const CSS_ID='powderCombatMainSignature2224Css';
const SIGNATURE=Object.freeze({
  pyrion:{icon:'♛',motif:'flame-crown'},aquarion:{icon:'◉',motif:'tide-wheel'},verdantis:{icon:'♧',motif:'world-tree'},terrakor:{icon:'⬢',motif:'mountain-seal'},zephyrion:{icon:'✧',motif:'sky-feather'},thunderos:{icon:'ϟ',motif:'thunder-seal'},glacior:{icon:'❄',motif:'ice-crown'},vilexis:{icon:'☣',motif:'venom-mandala'},solarion:{icon:'☀',motif:'solar-halo'},umbrael:{icon:'◑',motif:'eclipse'},calderion:{icon:'◆',motif:'magma-core'},venomarch:{icon:'〰',motif:'venom-mandala'},magmorax:{icon:'♨',motif:'phoenix'},tempestrix:{icon:'龍',motif:'dragon'},frostmaw:{icon:'鯤',motif:'kunpeng'},luxarion:{icon:'♚',motif:'royal-lion'},noxabyss:{icon:'☠',motif:'lich-crown'}
});
const ELEMENT_COLOR=Object.freeze({fire:['#ffbf78','rgba(255,116,52,.36)'],lava:['#ff9b66','rgba(255,84,42,.38)'],water:['#8de7ff','rgba(73,184,255,.34)'],ice:['#c9f7ff','rgba(102,214,255,.34)'],lightning:['#ffe67c','rgba(255,220,70,.35)'],storm:['#fff19a','rgba(164,208,255,.33)'],leaf:['#b8f99e','rgba(92,211,109,.34)'],poison:['#b7f36f','rgba(124,209,67,.36)'],light:['#fff0aa','rgba(255,226,111,.36)'],dark:['#c9a8ff','rgba(139,91,210,.38)'],earth:['#e3ca9d','rgba(177,142,91,.34)'],steel:['#d8e4ea','rgba(159,181,194,.34)'],wind:['#b3f7e8','rgba(94,214,188,.34)']});
const state={shows:0,chargeShows:0,releaseShows:0,impactShows:0,ultimates:0,unknownPow:0,lastPowId:'',lastMotif:'',lastKey:'',active:false};
let mount=null,sigil=null,observer=null,raf=0;
const root=document.documentElement;
const active=n=>Boolean(n?.isConnected&&!n.closest?.('[hidden]'));
const pressure=()=>String(window.POWDER_ADAPTIVE_PRESSURE_V21011?.level?.()||root.dataset.resourcePressure||'calm');
function reducedMotion(){try{return root.classList.contains('reduce-motion')||root.dataset.perfReason==='reduced-motion'||Boolean(window.POWDER_APP?.getSave?.()?.settings?.reducedMotion)||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)}catch(_){return false}}
function ensureCss(){if(document.getElementById(CSS_ID))return;const link=document.createElement('link');link.id=CSS_ID;link.rel='stylesheet';link.href='css/combat-main-signature-v2224.css?v=2224';document.head.appendChild(link)}
function pickMount(){const all=[...document.querySelectorAll('.combat-v7-mount')];return all.find(active)||all[0]||null}
function cleanup(node){if(!node)return;node.classList.remove('cms224-ready','cms224-pressure-reduced');node.querySelector(':scope .cv7-field > .cms224-sigil')?.remove()}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;sync()})}
function attach(next){if(next===mount)return;cleanup(mount);observer?.disconnect();mount=next;sigil=null;state.active=!!mount;if(!mount)return;mount.classList.add('cms224-ready');observer=new MutationObserver(schedule);observer.observe(mount,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});sync()}
function field(){return mount?.querySelector('.cv7-field')||null}
function ensureSigil(){const f=field();if(!f)return null;sigil=f.querySelector(':scope > .cms224-sigil');if(!sigil){sigil=document.createElement('span');sigil.className='cms224-sigil';sigil.setAttribute('aria-hidden','true');sigil.innerHTML='<i>✦</i>';f.appendChild(sigil)}return sigil}
function roster(){const core=window.POWDER_COMBAT_RUNTIME_V21?.activeCore;return core?.allRosterUnits||core?.allUnits||[]}
function normalize(s){return String(s||'').trim().toLocaleLowerCase('vi')}
function unitForActor(name){const wanted=normalize(name);if(!wanted||wanted==='—')return window.POWDER_COMBAT_RUNTIME_V21?.activeCore?.state?.current||null;return roster().find(u=>normalize(u?.name)===wanted)||roster().find(u=>wanted.includes(normalize(u?.name))||normalize(u?.name).includes(wanted))||window.POWDER_COMBAT_RUNTIME_V21?.activeCore?.state?.current||null}
function domForUnit(unit){if(!mount||!unit)return null;try{return mount.querySelector(`.cv7-unit[data-cv7-unit="${CSS.escape(String(unit.id||''))}"]`)}catch(_){return null}}
function domForName(name){const wanted=normalize(name);if(!mount||!wanted||wanted==='—')return null;return [...mount.querySelectorAll('.cv7-unit')].find(n=>normalize(n.textContent).includes(wanted))||null}
function elementOf(unit){return String(unit?.element||unit?.elementId||unit?.pow?.element||'').toLowerCase()}
function place(node,anchor){const f=field();if(!node||!f||!anchor)return;const fr=f.getBoundingClientRect(),r=anchor.getBoundingClientRect();node.style.left=`${r.left-fr.left+r.width/2}px`;node.style.top=`${r.top-fr.top+r.height*.48}px`}
function play(detail={}){
  if(!mount||reducedMotion())return;
  const key=String(detail.key||'skill'),phase=String(detail.phase||'idle');
  if(key==='basic'||phase==='idle')return;
  const unit=unitForActor(detail.actor),powId=String(unit?.powId||unit?.id||'').toLowerCase(),spec=SIGNATURE[powId];
  if(!spec){state.unknownPow++;return}
  const n=ensureSigil();if(!n?.animate)return;
  const targetDom=domForName(detail.target),actorDom=domForUnit(unit)||domForName(detail.actor),anchor=phase==='charge'?actorDom:(targetDom||actorDom);if(!anchor)return;
  place(n,anchor);state.lastPowId=powId;state.lastMotif=spec.motif;state.lastKey=key;n.dataset.motif=spec.motif;n.querySelector('i').textContent=spec.icon;
  const colors=ELEMENT_COLOR[elementOf(unit)]||['#d9f4ff','rgba(125,220,255,.32)'];n.style.setProperty('--cms-color',colors[0]);n.style.setProperty('--cms-glow',colors[1]);
  const rank=key==='ultimate'?5:key==='exclusive'?4:key==='skill2'?3:2,low=pressure()==='hot'||pressure()==='critical'||mount.classList.contains('cv71-fx-low');
  const duration=low ? 260 : rank===5 ? 620 : rank===4 ? 500 : rank===3 ? 420 : 340;
  const peak=low ? .62 : rank===5 ? 1 : rank===4 ? .9 : .78;
  n.getAnimations?.().forEach(a=>{try{a.cancel()}catch(_){}});
  n.animate([{opacity:0,scale:.56},{opacity:peak,scale:rank>=4?1.08:1,offset:.42},{opacity:0,scale:rank>=4?1.24:1.14}],{duration,easing:'cubic-bezier(.15,.7,.18,1)'});
  state.shows++;if(phase==='charge')state.chargeShows++;else if(phase==='release')state.releaseShows++;else if(phase==='impact')state.impactShows++;if(key==='ultimate')state.ultimates++;
}
function sync(){const next=pickMount();if(next!==mount){attach(next);return}if(!mount)return;state.active=true;if(!mount.classList.contains('cms224-ready'))mount.classList.add('cms224-ready');const reduced=pressure()==='hot'||pressure()==='critical';if(mount.classList.contains('cms224-pressure-reduced')!==reduced)mount.classList.toggle('cms224-pressure-reduced',reduced)}
function start(){ensureCss();attach(pickMount());window.addEventListener('powder:combat-skill-identity',e=>play(e.detail||{}),{passive:true});window.addEventListener('powder:combat-presentation-sync',sync,{passive:true});window.addEventListener('powder:resource-pressure',sync,{passive:true});const bodyObserver=new MutationObserver(schedule);bodyObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']})}
function snapshot(){return{version:VERSION,...state,active:!!mount?.isConnected,knownSignatures:Object.keys(SIGNATURE).length,pressure:pressure(),reducedMotion:reducedMotion()}}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
window.POWDER_MAIN_COMBAT_SIGNATURE_V2224={version:VERSION,snapshot,sync,signatures:SIGNATURE};
})();