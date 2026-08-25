import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('js/combat-skill-inspector-v2187.js');
const css=read('css/combat-skill-inspector-v2187.css');
const loader=read('js/combat-arcane-polish-v2160.js');
const checks={
  version:js.includes("VERSION='21.8.7'")&&js.includes('POWDER_COMBAT_SKILL_INSPECTOR_V2187'),
  wired:loader.includes('combat-skill-inspector-v2187.js?v=2187')&&loader.includes('POWDER_COMBAT_SKILL_INSPECTOR_V2187')&&loader.includes('loadSkillInspector()'),
  styleWired:js.includes("STYLE_HREF='css/combat-skill-inspector-v2187.css?v=2187'")&&js.includes('ensureStyle()'),
  readOnlyCore:js.includes('POWDER_BATTLE_PLAYER_V177?.getCore?.()')&&js.includes('c.actionInfo?.(u,key)'),
  detailFields:['CHI PHÍ','MỤC TIÊU','KÍCH HOẠT'].every(x=>js.includes(x))&&js.includes('rulesText||a.description'),
  statusTags:['HỒI MÁU','KHIÊN','CHOÁNG','ĐÓNG BĂNG','THIÊU ĐỐT','ĐỘC','GIẢM HỒI MÁU','HÚT MÁU','THANH TẨY','BẠO KÍCH','PHÁ KHIÊN'].every(x=>js.includes(x)),
  eventDriven:js.includes("'powder:rendered','powder:combat-state','powder:view-changed'")&&js.includes('requestAnimationFrame'),
  noPolling:!js.includes('setInterval(')&&!js.includes('MutationObserver'),
  noFormulaMutation:!js.includes('performAction=')&&!js.includes('.damage=')&&!js.includes('.coefficient=')&&!js.includes('skills['),
  compactPanel:css.includes('.cv2187-inspector')&&css.includes('.cv2187-meta')&&css.includes('.cv2187-tags')&&css.includes('@media(max-width:760px)')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({version:'21.8.7',contract:'combat-skill-inspector-readability',checks,failed,pass:failed.length===0},null,2));
if(failed.length)process.exit(1);
