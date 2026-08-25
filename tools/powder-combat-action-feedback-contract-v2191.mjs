import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('js/combat-action-feedback-v2191.js');
const css=read('css/combat-action-feedback-v2191.css');
const loader=read('js/combat-arcane-polish-v2160.js');
const checks={
  version:js.includes("VERSION='21.9.1'")&&js.includes('POWDER_COMBAT_ACTION_FEEDBACK_V2191'),
  wired:loader.includes('combat-action-feedback-v2191.js?v=2191')&&loader.includes('POWDER_COMBAT_ACTION_FEEDBACK_V2191')&&loader.includes('loadActionFeedback()'),
  cssWired:js.includes("STYLE_HREF='css/combat-action-feedback-v2191.css?v=2191'")&&js.includes('style()'),
  rendererFeedbackOnly:js.includes("querySelectorAll('.cv7-fx,.cv7-vfx-label')")&&js.includes('WeakSet'),
  importantTypes:['BẠO KÍCH','SÁT THƯƠNG','HỒI MÁU','NHẬN KHIÊN','BẢO HỘ','PHÁ KHIÊN','HẠ GỤC','VÀO SÂN','THANH TẨY','KHỐNG CHẾ'].every(x=>js.includes(x)),
  boundedHistory:js.includes('state.entries.length>3')&&js.includes('state.entries.length=3'),
  noCoreMutation:!js.includes('getCore')&&!js.includes('performAction')&&!js.includes('.damage=')&&!js.includes('.hp=')&&!js.includes('.statuses='),
  noPolling:!js.includes('setInterval(')&&!js.includes('MutationObserver'),
  eventDriven:js.includes("'powder:rendered','powder:combat-state','powder:view-changed'")&&js.includes('requestAnimationFrame'),
  responsive:css.includes('@media(max-width:760px)')&&css.includes('.cv2191-action-feedback')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({version:'21.9.1',contract:'combat-action-feedback-hud',checks,failed,pass:failed.length===0},null,2));
if(failed.length)process.exit(1);
