(()=>{'use strict';
const D=window.POWDER_DATA,V=window.POWDER_SKILL_V81;if(!D||!V)return;
const SLOT_KEYS=['basic','skill1','skill2','ultimate'];
function kitOf(powOrId){const id=typeof powOrId==='string'?powOrId:powOrId?.id;return id?V.pows?.[id]||null:null}
function canonicalIds(powOrId){const k=kitOf(powOrId);return k?Object.fromEntries(SLOT_KEYS.map(s=>[s,k.skills?.[s]?.id||null])):{};}
function progression(powOrId,star){const k=kitOf(powOrId);if(!k)return null;const s=Number(star)||0;if(s<Number(k.nativeStar||0))return null;return k.starProgression?.find(x=>Number(x.star)===s)||k.starProgression?.at(-1)||null;}
D.skillSystem={version:'8.1-fixed-kit',fixedSlots:4,learn:false,copy:false,replace:false,gearGrantsSkills:false};
window.POWDER_SKILLS={version:'8.1-fixed-kit',fixed:true,slotKeys:SLOT_KEYS,kitOf,canonicalIds,progression,audit:V.audit};
})();
