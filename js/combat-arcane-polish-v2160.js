(()=>{'use strict';
if(window.POWDER_COMBAT_ARCANE_POLISH_V2160)return;
const VERSION='21.6.0',CSS_ID='powderCombatArcanePolish2160Css',CSS_HREF='css/combat-arcane-polish-v2160.css?v=2160',state={patches:0,pruned:0,afterglows:0,lastTier:'full',lastAt:0};let raf=0;
const DECOR='.cfx2157-cast-pose,.cfx2157-release-mark,.cfx2158-elemental-field,.cfx2159-spell-camera,.cfx2151-echo,.cfx2151-spell-trail,.cfx2153-spell-projectile,.cfx2154-clash-ring,.cfx2155-barrier-magic';
function css(){if(document.getElementById(CSS_ID))return;const l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';l.href=CSS_HREF;document.head.appendChild(l)}function q(s,r=document)=>r.querySelector(s)