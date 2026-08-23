import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
const root=path.resolve(process.argv[2]||process.cwd());
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const sha=r=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r))).digest('hex');
const out={version:'19.9.0',root,checks:{},details:{}};
function ok(k,v,d){out.checks[k]=!!v;if(d!==undefined)out.details[k]=d}
const release=JSON.parse(read('release.json'));ok('releaseMetadata',release.version==='19.9.0'&&release.buildId==='powder-19.9.0-release-freeze'&&release.official===false&&release.releaseState==='release-freeze-gate',release);
const base=JSON.parse(read('RELEASE-FREEZE-BASELINE-19.9.0.json'));const changed=[];for(const x of base.critical){const p=path.join(root,x.path);if(!fs.existsSync(p)||sha(x.path)!==x.sha256||fs.statSync(p).size!==x.size)changed.push(x.path)}ok('gameplayFreeze',base.criticalCount===22&&changed.length===0,{critical:base.criticalCount,changed});
const ctx={window:{},console:{log(){},info(){},warn(){},error(){}},setTimeout(){},clearTimeout(){}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('js/data.js'),ctx);vm.runInContext(read('js/skill-v81-data.js'),ctx);const pows=ctx.POWDER_DATA?.pows||[],kits=ctx.POWDER_SKILL_V81?.pows||{},ids=[];for(const k of Object.values(kits))for(const n of ['basic','skill1','skill2','ultimate'])if(k?.skills?.[n]?.id)ids.push(String(k.skills[n].id));ok('canonical99x396',pows.length===99&&Object.keys(kits).length===99&&ids.length===396&&new Set(ids).size===396,{pows:pows.length,kits:Object.keys(kits).length,skills:ids.length,unique:new Set(ids).size});
// Static contracts for heavyweight modules.
const adv=read('js/adventure-data.js'),boss=read('js/boss-encounter-designer-v1860.js'),content=read('js/combat-content-v1890.js'),domain=read('js/domain-system-v15.js'),app=read('js/app.js'),cloud=read('js/online-foundation-v150.js'),serverCombat=read('js/server-combat-v1862.js');
ok('adventureContract',/function stageCount\(island\)\{return island\.id===1\?10:20;\}/.test(adv)&&/for\(const island of islands\)island\.stages=buildStages/.test(adv));
ok('bossProfiles',['daily','promotion','weekly','story'].every(x=>boss.includes(`${x}:Object.freeze`))&&/count:Object\.keys\(ENCOUNTERS\)\.length/.test(boss));
ok('challengeGauntlet',/CHALLENGES\.length===3&&GAUNTLETS\.length===3/.test(content)&&/practiceNoReward:true/.test(content));
ok('domains',/lockedExpansionCount:9/.test(domain)&&/normalExpansionCount:6/.test(domain)&&/specialExpansionCount:3/.test(domain)&&/const __domainIds=Object\.keys\(EXP\)/.test(domain));
ok('rewardAuthority',/serverProtected:true,rewardLocked:true/.test(app)&&/onlineRewardLocked:true/.test(app));
ok('saveUpgradeRecovery',/migrateStarSave/.test(app)&&/createFullBackup/.test(app)&&/restoreBackup/.test(app)&&/full-backup-restore-main/.test(app));
ok('cloudConflictContract',/revision/.test(cloud)&&/conflict/.test(cloud));
ok('eventBossServerCombat',/async function startEvent\(eventId\)/.test(serverCombat)&&/async function startBoss\([^)]*\)/.test(serverCombat)&&/function rewardOf\(/.test(serverCombat)&&/window\.POWDER_SERVER_COMBAT_V1862/.test(serverCombat));
const sw=read('service-worker.js');ok('serviceWorker1990',/const V='19\.9\.0'/.test(sw)&&/const BUILD='19900'/.test(sw)&&/powder-assets-v1990/.test(sw));
const idx=read('index.html'),adm=read('admin.html');ok('runtimeRefs',idx.includes('boot-loader-v1990')&&adm.includes('admin-release-freeze-v1990.js')&&adm.includes('admin-official-release-v1990.js'));
out.pass=Object.values(out.checks).every(Boolean);console.log(JSON.stringify(out,null,2));if(!out.pass)process.exit(1);
