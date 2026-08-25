import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('js/combat-target-preview-v2192.js');
const css=read('css/combat-target-preview-v2192.css');
const loader=read('js/combat-arcane-polish-v2160.js');
const checks={
  version:js.includes("VERSION='21.9.2'")&&js.includes('POWDER_COMBAT_TARGET_PREVIEW_V2192'),
  wired:loader.includes('combat-target-preview-v2192.js?v=2192')&&loader.includes('POWDER_COMBAT_TARGET_PREVIEW_V2192')&&loader.includes('loadTargetPreview()'),
  cssWired:js.includes("STYLE_HREF='css/combat-target-preview-v2192.css?v=2192'")&&js.includes('style()'),
  targetModeOnly:js.includes("dock.classList.contains('is-targeting')")&&js.includes(".cv7-unit.targetable"),
  targetVitals:js.includes('maxHp')&&js.includes('target.shield')&&js.includes('hpPct(target)'),
  statusContext:js.includes('statusNames(target)')&&js.includes('TRẠNG THÁI'),
  skillContext:js.includes('c.actionInfo?.(actor,key)')&&js.includes('effectTags(ability,desc)')&&js.includes('HIỆU ỨNG SKILL'),
  explicitNoDamagePrediction:js.includes('không dự đoán')||js.includes('no damage prediction'),
  noRngExposure:!js.includes('Math.random')&&!js.includes('critChance')&&!js.includes('rollCrit'),
  noFormulaMutation:!js.includes('performAction=')&&!js.includes('.damage=')&&!js.includes('.hp=')&&!js.includes('.statuses=')&&!js.includes('actionInfo=function'),
  noPolling:!js.includes('setInterval(')&&!js.includes('MutationObserver'),
  eventDriven:js.includes("'powder:rendered','powder:combat-state','powder:view-changed'")&&js.includes('requestAnimationFrame'),
  responsive:css.includes('@media(max-width:760px)')&&css.includes('[data-cv2192-preview]'),
  inspectorCoordination:css.includes('.cv7-command.is-targeting #cv2187SkillInspector{display:none}')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({version:'21.9.2',contract:'combat-target-context-preview',checks,failed,pass:failed.length===0},null,2));
if(failed.length)process.exit(1);
