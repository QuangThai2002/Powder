(()=>{'use strict';
if(window.POWDER_COMBAT_LAYOUT_V2200)return;
const VERSION='22.0.2',CSS_ID='powderCombatLayout2200Css',CSS_HREF='css/combat-layout-v2200.css?v=2202';
const state={patches:0,artRestores:0,assetMapInstalls:0,panelToggles:0,lastAt:0,logOpen:false,tamerOpen:false};
let raf=0,observer=null,ownedFullscreen=false;
const q=(s,r=document)=>r.querySelector(s);
const data=()=>window.POWDER_DATA||{};
const core=()=>{try{return window.POWDER_BATTLE_PLAYER_V177?.getCore?.()||null}catch(_){return null}};
function css(){let l=document.getElementById(CSS_ID);if(!l){l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';document.head.appendChild(l)}if(!String(l.href).includes('v=2202'))l.href=CSS_HREF}
function battleVisible(){return Boolean(q('#battleView:not([hidden]) .combat-v7-mount .cv7-scene'))}
function adminDirect(){try{const p=new URLSearchParams(location.search);return p.get('adminCombat')==='1'||p.get('combatTest')==='1'}catch(_){return false}}
function focus(on){const r=document.documentElement;if(on){if(!r.classList.contains('powder-combat-fullscreen')){r.classList.add('powder-combat-fullscreen');ownedFullscreen=true}r.classList.add('powder-combat-layout2200');r.classList.toggle('powder-combat-admin2200',adminDirect())}else{r.classList.remove('powder-combat-layout2200','powder-combat-admin2200');if(ownedFullscreen){r.classList.remove('powder-combat-fullscreen');ownedFullscreen=false}}}
function installCanonicalMap(){const pows=data().pows||[];if(!pows.length)return;const prior=window.POWDER_COMBAT_ASSETS&&typeof window.POWDER_COMBAT_ASSETS==='object'?window.POWDER_COMBAT_ASSETS:{};let changed=false;for(const p of pows){const a=String(p?.asset||'');if(a&&prior[a]!==a){prior[a]=a;changed=true}}window.POWDER_COMBAT_ASSETS=prior;if(changed)state.assetMapInstalls++}
function allUnits(){const s=core()?.state;if(!s)return[];return [...(s.team||[]),...(s.reserves||[]),...(s.enemies||[]),...(s.enemyReserves||[])]}
function canonicalAsset(u){if(!u)return'';const current=String(u.asset||''),p=(data().pows||[]).find(x=>String(x.id)===String(u.powId)),base=String(p?.asset||'');if(current&&!current.includes('pow-combat-512'))return current;return base||current}
function restoreArt(mount){const units=new Map(allUnits().map(u=>[String(u.id),u]));for(const el of mount.querySelectorAll('.cv7-unit[data-cv7-unit]')){const u=units.get(String(el.dataset.cv7Unit||''));if(!u)continue;const img=q('.cv7-art',el),asset=canonicalAsset(u);if(!img||!asset)continue;const raw=String(img.getAttribute('src')||'');if(raw===asset||raw.endsWith('/'+asset))continue;if(raw.includes('pow-combat-512')||!raw){img.src=asset;img.alt=u.name||u.powId||'';img.dataset.layout2200Restored='1';state.artRestores++}}}
function ensureUtility(scene){let bar=q(':scope>.layout2200-utility',scene);if(!bar){bar=document.createElement('div');bar.className='layout2200-utility';bar.innerHTML='<button type="button" data-layout2200-panel="tamer"><span>Tamer</span> ◉</button><button type="button" data-layout2200-panel="log"><span>Nhật ký</span> ≡</button>';scene.appendChild(bar)}for(const b of bar.querySelectorAll('[data-layout2200-panel]')){const k=b.dataset.layout2200Panel,open=k==='log'?state.logOpen:state.tamerOpen;b.classList.toggle('is-open',open);b.setAttribute('aria-pressed',open?'true':'false')}return bar}
function panels(mount){const log=q('.cv7-log',mount),tamer=q('.cv7-tamer-command',mount);if(log)log.dataset.layout2200Open=state.logOpen?'1':'0';if(tamer)tamer.dataset.layout2200Open=state.tamerOpen?'1':'0'}
function patch(){raf=0;css();installCanonicalMap();if(!battleVisible()){focus(false);return false}focus(true);const mount=q('#battleView:not([hidden]) .combat-v7-mount'),scene=q('.cv7-scene',mount);if(!mount||!scene)return false;mount.dataset.layout2200='1';ensureUtility(scene);panels(mount);restoreArt(mount);state.patches++;state.lastAt=Date.now();return true}
function schedule(){if(!raf)raf=requestAnimationFrame(patch)}
function toggle(k){if(k==='log')state.logOpen=!state.logOpen;if(k==='tamer')state.tamerOpen=!state.tamerOpen;if(state.logOpen)state.tamerOpen=false;if(state.tamerOpen)state.logOpen=false;state.panelToggles++;schedule()}
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-layout2200-panel]');if(!b)return;e.preventDefault();e.stopPropagation();toggle(String(b.dataset.layout2200Panel||''))},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(state.logOpen||state.tamerOpen)){state.logOpen=false;state.tamerOpen=false;schedule()}},true);
['powder:rendered','powder:combat-state','powder:view-changed','powder:combat-action','resize'].forEach(evt=>window.addEventListener(evt,schedule,{passive:true}));
function observe(){const root=q('#battleView');if(!root||observer)return;observer=new MutationObserver(schedule);observer.observe(root,{subtree:true,childList:true})}
window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);observer?.disconnect();observer=null;focus(false)},{once:true});
function snapshot(){return{version:VERSION,...state,css:CSS_HREF,layout:'symmetric enemy/player rows + 110px neutral center lane + docked command/inspector',observerPolicy:'childList-only',artPolicy:'canonical POWDER_DATA art wins over legacy pow-combat-512',gameplayMutation:false,damageFormulaMutation:false,skillDataMutation:false,serverMutation:false,saveMutation:false}}
window.POWDER_COMBAT_LAYOUT_V2200={version:VERSION,refresh:schedule,snapshot};css();installCanonicalMap();observe();schedule();
})();