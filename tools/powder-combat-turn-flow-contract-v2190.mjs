import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('js/combat-turn-flow-v2190.js');
const css=read('css/combat-turn-flow-v2190.css');
const loader=read('js/combat-arcane-polish-v2160.js');
const checks={
  version:js.includes("VERSION='21.9.0'")&&js.includes('POWDER_COMBAT_TURN_FLOW_V2190'),
  wired:loader.includes('combat-turn-flow-v2190.js?v=2190')&&loader.includes('POWDER_COMBAT_TURN_FLOW_V2190')&&loader.includes('loadTurnFlow()'),
  cssWired:js.includes("STYLE_HREF='css/combat-turn-flow-v2190.css?v=2190'")&&js.includes('style()'),
  observesCurrentMeter:js.includes('s.current||null')&&js.includes('Number(u.meter)')&&js.includes('cv2190Meter'),
  nearTurnNotCanonical:js.includes('GẦN TỚI LƯỢT')&&js.includes('không thay đổi thứ tự lượt'),
  hardCc:js.includes('ĐÓNG BĂNG')&&js.includes('CHOÁNG')&&js.includes('KHÓA LƯỢT')&&js.includes('statusKeys(u)'),
  currentCue:js.includes('data-cv2190-current')&&css.includes('ĐANG HÀNH ĐỘNG'),
  noTurnMutation:!js.includes('.meter=')&&!js.includes('.current=')&&!js.includes('.speed=')&&!js.includes('.phase=')&&!js.includes('beginTurn='),
  noStatusMutation:!js.includes('.statuses=')&&!js.includes('status.push')&&!js.includes('status.delete'),
  noPolling:!js.includes('setInterval(')&&!js.includes('MutationObserver'),
  eventDriven:js.includes("'powder:rendered','powder:combat-state','powder:view-changed'")&&js.includes('requestAnimationFrame'),
  responsive:css.includes('@media(max-width:760px)')&&css.includes('.cv2190-turn-flow')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({version:'21.9.0',contract:'combat-turn-flow-clarity',checks,failed,pass:failed.length===0},null,2));
if(failed.length)process.exit(1);
