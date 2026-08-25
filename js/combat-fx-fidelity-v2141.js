(()=>{'use strict';
if(window.POWDER_COMBAT_FX_FIDELITY_V2141)return;
const VERSION='21.4.1',STYLE_ID='powderCombatFxFidelity2141',root=document.documentElement;
const state={patches:0,ultimateSeen:0,exclusiveSeen:0,impactsSeen:0,capOverrides:0,lastCap:'',lastReason:'boot',lastAt:0};
let raf=0,settleTimer=0;
const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
function style(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
/* 21.4.1 fidelity rule: critical feedback is never removed; low tier only simplifies it. */
html[data-native-fx-cap="low"] .combat-v7-mount .cv8-camera-director,
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx.impact,
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-fx.element-hit,
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-attack-hit-ring,
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-signature-impact{display:block!important}
html[data-native-fx-cap="low"] .combat-v7-mount .cv8-camera-vignette,
html[data-native-fx-cap="low"] .combat-v7-mount .cv8-camera-rails,
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx-ripple,
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx-frag,
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx-spark{display:none!important}
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-vfx.impact{filter:none!important;opacity:.88!important}
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-attack-hit-ring{opacity:.62!important;box-shadow:none!important}
html[data-native-fx-cap="low"] .combat-v7-mount .cv7-signature-impact{filter:none!important}

/* Element palette for cinematic V2. */
.combat-v7-mount .cv7-cinematic{--ult2141:#b9efff;--ult2141b:#648fff;--ult2141rgb:128,211,255}
.combat-v7-mount .cv7-cinematic.el-fire,.combat-v7-mount .cv7-attack-flow.el-fire{--ult2141:#ffcf75;--ult2141b:#ff5f35;--ult2141rgb:255,103,55}
.combat-v7-mount .cv7-cinematic.el-water,.combat-v7-mount .cv7-attack-flow.el-water{--ult2141:#a9efff;--ult2141b:#438cff;--ult2141rgb:74,159,255}
.combat-v7-mount .cv7-cinematic.el-leaf,.combat-v7-mount .cv7-attack-flow.el-leaf{--ult2141:#b8ffb3;--ult2141b:#42cd79;--ult2141rgb:79,210,126}
.combat-v7-mount .cv7-cinematic.el-earth,.combat-v7-mount .cv7-attack-flow.el-earth{--ult2141:#f0d49b;--ult2141b:#b87845;--ult2141rgb:196,139,77}
.combat-v7-mount .cv7-cinematic.el-lightning,.combat-v7-mount .cv7-attack-flow.el-lightning{--ult2141:#fff08c;--ult2141b:#8d7dff;--ult2141rgb:190,166,255}
.combat-v7-mount .cv7-cinematic.el-wind,.combat-v7-mount .cv7-attack-flow.el-wind{--ult2141:#d8fff3;--ult2141b:#60dac6;--ult2141rgb:95,222,199}
.combat-v7-mount .cv7-cinematic.el-ice,.combat-v7-mount .cv7-attack-flow.el-ice{--ult2141:#ecfbff;--ult2141b:#7dd8ff;--ult2141rgb:141,221,255}
.combat-v7-mount .cv7-cinematic.el-poison,.combat-v7-mount .cv7-attack-flow.el-poison{--ult2141:#d7ff8a;--ult2141b:#7cad45;--ult2141rgb:138,196,72}
.combat-v7-mount .cv7-cinematic.el-steel,.combat-v7-mount .cv7-attack-flow.el-steel{--ult2141:#f1f6ff;--ult2141b:#8aa3bd;--ult2141rgb:158,181,204}
.combat-v7-mount .cv7-cinematic.el-lava,.combat-v7-mount .cv7-attack-flow.el-lava{--ult2141:#ffd18b;--ult2141b:#ef4d24;--ult2141rgb:244,91,39}
.combat-v7-mount .cv7-cinematic.el-storm,.combat-v7-mount .cv7-attack-flow.el-storm{--ult2141:#d4f0ff;--ult2141b:#7a68ff;--ult2141rgb:130,112,255}
.combat-v7-mount .cv7-cinematic.el-light,.combat-v7-mount .cv7-attack-flow.el-light{--ult2141:#fffbd0;--ult2141b:#f1c35a;--ult2141rgb:255,217,110}
.combat-v7-mount .cv7-cinematic.el-dark,.combat-v7-mount .cv7-attack-flow.el-dark{--ult2141:#e1c9ff;--ult2141b:#6f4fc5;--ult2141rgb:123,84,210}

/* Ultimate V2: this is a real presentation change, not just a border/callout. */
.combat-v7-mount .cv7-cinematic.ultimate{overflow:hidden!important;background:linear-gradient(118deg,rgba(2,8,16,.96),rgba(5,10,22,.84) 42%,rgba(var(--ult2141rgb),.18) 100%)!important;isolation:isolate!important}
.combat-v7-mount .cv7-cinematic.ultimate::before{content:"";position:absolute;z-index:0;inset:-34%;background:conic-gradient(from 0deg,transparent 0 12%,rgba(var(--ult2141rgb),.12) 16%,transparent 23% 42%,rgba(var(--ult2141rgb),.23) 50%,transparent 58% 78%,rgba(255,255,255,.12) 84%,transparent 91%);filter:blur(2px);animation:ult2141Orbit 1.55s cubic-bezier(.18,.72,.18,1) both;pointer-events:none}
.combat-v7-mount .cv7-cinematic.ultimate::after{content:"";position:absolute;z-index:1;inset:0;background:radial-gradient(circle at 70% 50%,rgba(255,255,255,.24) 0 1%,rgba(var(--ult2141rgb),.22) 8%,transparent 31%),linear-gradient(90deg,transparent 0 43%,rgba(255,255,255,.08) 50%,transparent 58%);mix-blend-mode:screen;animation:ult2141Flash 1.45s ease both;pointer-events:none}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-letterbox{height:11%!important;background:linear-gradient(90deg,#02070c 0 30%,rgba(var(--ult2141rgb),.28) 50%,#02070c 70% 100%)!important;box-shadow:0 0 20px rgba(0,0,0,.65)!important}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-glow{position:absolute!important;z-index:2!important;inset:10% 0!important;background:radial-gradient(ellipse at 66% 52%,rgba(var(--ult2141rgb),.34),transparent 46%)!important;filter:blur(8px)!important;opacity:1!important;animation:ult2141Glow 1.25s ease both!important}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut{z-index:5!important;left:5%!important;right:5%!important;top:14%!important;bottom:14%!important;border:1px solid rgba(var(--ult2141rgb),.48)!important;border-radius:20px!important;background:linear-gradient(100deg,rgba(3,10,18,.96) 0 34%,rgba(var(--ult2141rgb),.14) 62%,rgba(2,7,13,.9) 100%)!important;box-shadow:inset 0 0 52px rgba(var(--ult2141rgb),.09),0 18px 46px rgba(0,0,0,.5)!important;clip-path:polygon(0 8%,88% 0,100% 15%,96% 91%,9% 100%,0 82%)!important;animation:ult2141Panel .72s cubic-bezier(.16,.8,.2,1) both!important}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut::before{content:"ULTIMATE";position:absolute;z-index:7;left:4%;top:7%;font-size:clamp(10px,1.2vw,15px);font-weight:1000;letter-spacing:.38em;color:var(--ult2141);text-shadow:0 0 16px rgba(var(--ult2141rgb),.55)}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut img{z-index:4!important;width:min(46vw,510px)!important;height:116%!important;max-height:none!important;object-fit:contain!important;filter:drop-shadow(0 18px 28px rgba(0,0,0,.66)) drop-shadow(0 0 18px rgba(var(--ult2141rgb),.24))!important;animation:ult2141Art 1.18s cubic-bezier(.18,.74,.18,1) both!important}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut>div{z-index:6!important;padding:18px 26px!important;background:linear-gradient(90deg,rgba(2,8,14,.9),rgba(2,8,14,.28))!important;border-left:3px solid var(--ult2141)!important;box-shadow:-14px 0 32px rgba(var(--ult2141rgb),.10)!important}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut small{color:var(--ult2141)!important;font-size:10px!important;letter-spacing:.28em!important}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut b{font-size:clamp(25px,3.4vw,50px)!important;line-height:.96!important;text-shadow:0 3px 18px rgba(0,0,0,.75),0 0 20px rgba(var(--ult2141rgb),.24)!important}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut span{font-size:clamp(14px,1.8vw,23px)!important;color:#fff!important}
.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-role{z-index:8!important;top:13%!important;right:7%!important;padding:7px 12px!important;border:1px solid rgba(var(--ult2141rgb),.45)!important;border-radius:999px!important;background:rgba(2,11,18,.8)!important;color:var(--ult2141)!important;box-shadow:0 0 20px rgba(var(--ult2141rgb),.12)!important}
.combat-v7-mount .cv7-cinematic.ultimate.signature .cv7-signature-crest{z-index:9!important;filter:drop-shadow(0 0 14px rgba(var(--ult2141rgb),.4))!important;animation:ult2141Crest 1.2s ease both!important}

/* Skill release and impact hierarchy. */
.combat-v7-mount .cv7-attack-flow.ultimate .cv7-attack-trace{height:7px!important;opacity:1!important;background:linear-gradient(90deg,transparent,var(--ult2141) 12%,#fff 58%,var(--ult2141b) 84%,transparent)!important;filter:drop-shadow(0 0 9px var(--ult2141))!important}
.combat-v7-mount .cv7-attack-flow.exclusive .cv7-attack-trace{height:6px!important;opacity:1!important;filter:drop-shadow(0 0 7px var(--ult2141))!important}
.combat-v7-mount .cv7-attack-flow.skill2 .cv7-attack-trace{height:5px!important}.combat-v7-mount .cv7-attack-flow.skill1 .cv7-attack-trace{height:4px!important}.combat-v7-mount .cv7-attack-flow.basic .cv7-attack-trace{height:3px!important}
.combat-v7-mount .cv7-attack-flow.ultimate .cv7-attack-hit{transform:scale(1.26)!important;filter:drop-shadow(0 0 12px var(--ult2141))!important}.combat-v7-mount .cv7-attack-flow.ultimate .cv7-attack-hit-ring{border-width:3px!important;box-shadow:0 0 20px rgba(var(--ult2141rgb),.42)!important}
.combat-v7-mount .cv7-fx.damage.key-ultimate,.combat-v7-mount .cv7-fx.crit.key-ultimate{font-size:clamp(28px,3.2vw,46px)!important;font-weight:1000!important;text-shadow:0 4px 16px rgba(0,0,0,.8),0 0 15px rgba(var(--ult2141rgb),.24)!important}
.combat-v7-mount .cv7-fx.crit{font-weight:1000!important}.combat-v7-mount .cv7-vfx.impact.key-ultimate .cv7-vfx-burst{transform:scale(1.34)!important}.combat-v7-mount .cv7-vfx.impact.key-exclusive .cv7-vfx-burst{transform:scale(1.18)!important}
.combat-v7-mount .cv7-unit.pulse-hit-ultimate .cv7-art{animation:ult2141Hit .58s cubic-bezier(.18,.72,.2,1) both!important}.combat-v7-mount .cv7-unit.pulse-hit-exclusive .cv7-art{animation:ult2141HitEx .48s ease both!important}

/* Reduced motion keeps the new hierarchy but removes sweeping motion. */
@media(prefers-reduced-motion:reduce){.combat-v7-mount .cv7-cinematic.ultimate::before,.combat-v7-mount .cv7-cinematic.ultimate::after,.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-glow,.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut,.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut img,.combat-v7-mount .cv7-cinematic.ultimate.signature .cv7-signature-crest,.combat-v7-mount .cv7-unit.pulse-hit-ultimate .cv7-art,.combat-v7-mount .cv7-unit.pulse-hit-exclusive .cv7-art{animation:none!important}}
@media(max-width:680px){.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut{left:2%!important;right:2%!important}.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut img{width:52vw!important}.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut>div{padding:12px!important}.combat-v7-mount .cv7-cinematic.ultimate .cv7-cine-cut::before{letter-spacing:.22em}}
@keyframes ult2141Orbit{0%{transform:rotate(-32deg) scale(.72);opacity:0}35%{opacity:1}100%{transform:rotate(24deg) scale(1.08);opacity:.65}}
@keyframes ult2141Flash{0%{opacity:0}18%{opacity:.95}36%{opacity:.18}64%{opacity:.5}100%{opacity:0}}
@keyframes ult2141Glow{0%{opacity:0;transform:scale(.72)}40%{opacity:1}100%{opacity:.58;transform:scale(1.08)}}
@keyframes ult2141Panel{0%{opacity:0;transform:translate3d(8%,0,0) scale(.97)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}
@keyframes ult2141Art{0%{opacity:0;transform:translate3d(-12%,7%,0) scale(.84)}44%{opacity:1;transform:translate3d(1%,-2%,0) scale(1.06)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}
@keyframes ult2141Crest{0%{opacity:0;transform:scale(.58) rotate(-8deg)}45%{opacity:1;transform:scale(1.1) rotate(2deg)}100%{opacity:1;transform:scale(1)}}
@keyframes ult2141Hit{0%{transform:translate3d(0,0,0) scale(1)}22%{transform:translate3d(-10px,5px,0) scale(.985)}44%{transform:translate3d(8px,-3px,0) scale(1.01)}100%{transform:translate3d(0,0,0) scale(1)}}
@keyframes ult2141HitEx{0%{transform:translate3d(0,0,0)}35%{transform:translate3d(-7px,3px,0)}65%{transform:translate3d(5px,-2px,0)}100%{transform:translate3d(0,0,0)}}
`;document.head.appendChild(s)}
function governor(){try{return window.POWDER_COMBAT_REFRESH_GOVERNOR_V21219?.snapshot?.()||{}}catch(_){return{}}}
function preserveAt60(reason='governor'){
  const g=governor(),fps=Math.max(0,Number(g.currentFps)||Number(root.dataset.nativeFps)||0),pressure=String(g.pressure||root.dataset.resourcePressure||'calm');
  const before=String(root.dataset.nativeFxCap||g.cap||'high');let next=before;
  if(pressure!=='critical'&&pressure!=='hot'&&fps>=58)next='high';
  else if(pressure!=='critical'&&fps>=52&&before==='low')next='medium';
  if(next!==before){root.dataset.nativeFxCap=next;state.capOverrides++}
  state.lastCap=String(root.dataset.nativeFxCap||next);state.lastReason=reason;state.lastAt=Date.now();return next;
}
function patch(reason='event'){raf=0;style();preserveAt60(reason);const m=qs('#battleView:not([hidden]) .combat-v7-mount');if(m){const ult=qsa('.cv7-cinematic.ultimate',m).length,ex=qsa('.cv7-cinematic.exclusive',m).length,imp=qsa('.cv7-vfx.impact,.cv7-fx.damage,.cv7-fx.crit',m).length;if(ult)state.ultimateSeen+=ult;if(ex)state.exclusiveSeen+=ex;if(imp)state.impactsSeen+=imp;m.dataset.fxFidelity2141='1'}state.patches++;state.lastAt=Date.now();return snapshot()}
function schedule(reason='event'){if(!raf)raf=requestAnimationFrame(()=>patch(reason))}
function settle(reason='settle',delay=180){clearTimeout(settleTimer);settleTimer=setTimeout(()=>{settleTimer=0;schedule(reason)},delay)}
function onView(e){const v=String(e?.detail?.view||document.body?.dataset?.activeView||'');if(/battle|boss|combat/i.test(v)){schedule('view');settle('view-settle',260)}}
function snapshot(){return{version:VERSION,...state,governor:governor(),visualContract:['critical impact FX never display:none','60 FPS stable keeps high fidelity','Ultimate V2 cinematic','tiered basic/skill1/skill2/exclusive/ultimate release weight','reduced-motion safe'],gameplayMutation:false,formulaMutation:false,scrollMutation:false,continuousPolling:false}}
function boot(){style();preserveAt60('boot');onView({detail:{view:document.body?.dataset?.activeView||''}})}
window.addEventListener('powder:combat-refresh-governor',()=>{preserveAt60('governor');schedule('governor-ui')},{passive:true});window.addEventListener('powder:view-changed',onView,{passive:true});window.addEventListener('powder:rendered',()=>schedule('rendered'),{passive:true});window.addEventListener('powder:combat-state',()=>schedule('combat-state'),{passive:true});document.addEventListener('animationstart',e=>{if(e.target?.closest?.('.combat-v7-mount'))schedule('animationstart')},{passive:true});window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(settleTimer)},{once:true});
window.POWDER_COMBAT_FX_FIDELITY_V2141={version:VERSION,snapshot,refresh:()=>patch('manual')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
