import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('js/combat-command-readability-v2188.js');
const css=read('css/combat-command-readability-v2188.css');
const loader=read('js/combat-arcane-polish-v2160.js');
const checks={
  version:js.includes("VERSION='21.8.8'")&&js.includes('POWDER_COMBAT_COMMAND_READABILITY_V2188'),
  wired:loader.includes('combat-command-readability-v2188.js?v=2188')&&loader.includes('POWDER_COMBAT_COMMAND_READABILITY_V2188')&&loader.includes('loadCommandReadability()'),
  cssWired:js.includes("STYLE_HREF='css/combat-command-readability-v2188.css?v=2188'")&&js.includes('style()'),
  hotkeys:js.includes("HOTKEYS={basic:'1',skill1:'2',skill2:'3',exclusive:'4',ultimate:'5'}")&&js.includes("document.addEventListener('keydown'"),
  selectedSkill:js.includes('cv2188-selected')&&js.includes('data-cv2188-key')&&css.includes('.cv2188-selected'),
  targetCue:js.includes('data-cv2188-target')&&css.includes('MỤC TIÊU')&&css.includes('[data-cv2188-target]'),
  coreReadOnly:js.includes('POWDER_BATTLE_PLAYER_V177?.getCore?.()')&&js.includes('c.actionInfo?.(u,key)'),
  noPolling:!js.includes('setInterval(')&&!js.includes('MutationObserver'),
  noFormulaMutation:!js.includes('performAction=')&&!js.includes('.damage=')&&!js.includes('.coefficient=')&&!js.includes('enemyDecision='),
  eventDriven:js.includes("'powder:rendered','powder:combat-state','powder:view-changed'")&&js.includes('requestAnimationFrame'),
  responsive:css.includes('@media(max-width:760px)')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({version:'21.8.8',contract:'combat-command-readability',checks,failed,pass:failed.length===0},null,2));
if(failed.length)process.exit(1);
