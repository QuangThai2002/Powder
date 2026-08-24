import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const jsPath=path.join(root,'js','admin-combat-lab-v1882.js');
const cssPath=path.join(root,'css','admin-combat-lab-v1882.css');
const js=fs.readFileSync(jsPath,'utf8');
const css=fs.readFileSync(cssPath,'utf8');

const simpleIds=['crimson','tide','verdant'];
const domainIds=['nine_suns','infinite_strike','frozen_silence','diamond_guard','myriad_poison','rebirth_wood','limitless_void','jackpot_bagua','draw_swords'];
const voiceFiles=[1,2,3,4].map(n=>`assets/audio/domain/domain-voice-usercut-${n}.m4a`);
const requiredUi=['cl2139RunSweep','cl2139QaGrid','cl2139Arena','cl2139Skills','cl2139FxButtons','cl2139Domain','cl2139AudioLoad','cl2139Coverage','cl2139Log'];
const oldTokens=['cl177','META_KEY','POWDER_ADMIN_COMBAT_LAB_V1882','Packet / AI / Boss Diagnostics','cl1882-legacy'];

const checks={
  version2139:js.includes("const VERSION='21.3.9'"),
  newGlobal:js.includes('POWDER_ADMIN_COMBAT_TEST_CENTER_V2139'),
  catalog99:js.includes('P.length===99'),
  roles9:js.includes('roles.size>=9'),
  fixedSkills396:js.includes('skills>=396'),
  exactly3Simple:simpleIds.every(id=>js.includes(`'${id}'`))&&simpleIds.length===3,
  exactly9Expansion:domainIds.every(id=>js.includes(`'${id}'`))&&domainIds.length===9,
  threeSpecial:['limitless_void','jackpot_bagua','draw_swords'].every(id=>js.includes(id)),
  canonicalBgm:js.includes('assets/audio/combat/user-combat-bgm.mp3'),
  fourUserVoices:voiceFiles.every(file=>js.includes(file)),
  unifiedUi:requiredUi.every(id=>js.includes(id)),
  fullSweep:js.includes('async function fullSweep()'),
  fpsOnDemand:js.includes('async function fpsTest()')&&!js.includes('setInterval('),
  ramOnlyGuards:js.includes('cloudSave:false')&&js.includes('reward:false')&&js.includes('pvpPacket:false')&&js.includes('combatCoreMutation:false')&&js.includes('learningMutation:false'),
  oldPacketToolsRemoved:oldTokens.every(token=>!js.includes(token)),
  css2139:css.includes('.combat2139')&&css.includes('.cl2139-qa-grid')&&css.includes('.cl2139-arena'),
  oldCssRemoved:!css.includes('.cl1882-'),
  reducedMotion:css.includes('@media(prefers-reduced-motion:reduce)'),
};

const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={version:'21.3.9',contract:'admin-combat-test-center',checks,failed,pass:failed.length===0};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
