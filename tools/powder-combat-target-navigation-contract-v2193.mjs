import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('js/combat-target-navigation-v2193.js');
const css=read('css/combat-target-navigation-v2193.css');
const loader=read('js/combat-arcane-polish-v2160.js');
const checks={
  version:js.includes("VERSION='21.9.3'")&&js.includes('POWDER_COMBAT_TARGET_NAVIGATION_V2193'),
  wired:loader.includes('combat-target-navigation-v2193.js?v=2193')&&loader.includes('POWDER_COMBAT_TARGET_NAVIGATION_V2193')&&loader.includes('loadTargetNavigation()'),
  targetModeOnly:js.includes(".cv7-command.is-targeting")&&js.includes('.cv7-unit.targetable:not([disabled])'),
  arrows:js.includes("['ArrowLeft','ArrowUp']")&&js.includes("['ArrowRight','ArrowDown']")&&js.includes('move(-1)')&&js.includes('move(1)'),
  enterConfirm:js.includes("e.key==='Enter'")&&js.includes('el.click()'),
  escapeCancel:js.includes("e.key==='Escape'")&&js.includes("[data-cv7-cancel]")&&js.includes('b.click()'),
  pointerSync:js.includes("'pointerover'")&&js.includes('state.pointerSyncs++'),
  existingFlowOnly:!js.includes('performAction')&&!js.includes('chooseTarget')&&!js.includes('actionInfo=function')&&!js.includes('.hp=')&&!js.includes('.damage='),
  noPolling:!js.includes('setInterval(')&&!js.includes('MutationObserver'),
  eventDriven:js.includes('requestAnimationFrame')&&js.includes("'powder:rendered','powder:combat-state','powder:view-changed'"),
  visibleCue:css.includes('[data-cv2193-cursor]')&&css.includes('ENTER XÁC NHẬN')&&css.includes('ESC HỦY'),
  responsive:css.includes('@media(max-width:760px)')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({version:'21.9.3',contract:'combat-target-selection-navigation',checks,failed,pass:failed.length===0},null,2));
if(failed.length)process.exit(1);
