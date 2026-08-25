import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('js/combat-reserve-entry-v2189.js');
const css=read('css/combat-reserve-entry-v2189.css');
const loader=read('js/combat-arcane-polish-v2160.js');
const checks={
  version:js.includes("VERSION='21.8.9'")&&js.includes('POWDER_COMBAT_RESERVE_ENTRY_V2189'),
  wired:loader.includes('combat-reserve-entry-v2189.js?v=2189')&&loader.includes('POWDER_COMBAT_RESERVE_ENTRY_V2189')&&loader.includes('loadReserveEntry()'),
  cssWired:js.includes("STYLE_HREF='css/combat-reserve-entry-v2189.css?v=2189'")&&js.includes('style()'),
  stripMetadata:js.includes('cv2189Slot')&&js.includes('cv2189Ready')&&js.includes('HP ${Math.max'),
  replacementMetadata:js.includes('cv2189-reserve-meta')&&js.includes("setAttribute('aria-label'")&&css.includes('VÀO SÂN'),
  replacementHotkeys:js.includes("['1','2'].includes(e.key)")&&js.includes('data-cv2189-key'),
  noVoluntarySwap:!js.includes('.replace(')&&!js.includes('replaceReserve(')&&js.includes('btn.click()'),
  noPolling:!js.includes('setInterval(')&&!js.includes('MutationObserver'),
  noFormulaMutation:!js.includes('.damage=')&&!js.includes('.hp=')&&!js.includes('.meter=')&&!js.includes('performAction='),
  eventDriven:js.includes("'powder:rendered','powder:combat-state','powder:view-changed'")&&js.includes('requestAnimationFrame'),
  responsive:css.includes('@media(max-width:760px)')
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({version:'21.8.9',contract:'combat-reserve-entry-ux',checks,failed,pass:failed.length===0},null,2));
if(failed.length)process.exit(1);
