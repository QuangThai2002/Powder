import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args=process.argv.slice(2);
const mode=args.shift()||'verify';
const root=path.resolve(args.shift()||'.');
const artifactArg=args.shift();
const gateArg=args.shift();
const prefixArg=args.shift();
const requireTag=args.includes('--require-tag');
if(!artifactArg||!gateArg)throw new Error('Usage: generate|verify <root> <artifact> <finalGate> [prefix] [--require-tag]');
const resolve=p=>path.isAbsolute(p)?p:path.join(root,p);
const artifact=resolve(artifactArg),gateFile=resolve(gateArg);
const releaseFile=path.join(root,'release.json');
const release=JSON.parse(fs.readFileSync(releaseFile,'utf8'));
const prefix=prefixArg||`Powder-${release.version}`;
const out=name=>resolve(`${prefix}-${name}`);
const shaFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const stat=p=>fs.statSync(p);
function git(...a){const r=spawnSync('git',a,{cwd:root,encoding:'utf8'});return r.status===0?r.stdout.trim():''}
function json(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function write(p,v){fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')}
function source(){
  return{
    repository:process.env.GITHUB_REPOSITORY||'QuangThai2002/Powder',
    commit:git('rev-parse','HEAD')||process.env.GITHUB_SHA||'',
    tree:git('rev-parse','HEAD^{tree}'),
    parentCommit:git('rev-parse','HEAD^'),
    ref:process.env.GITHUB_REF||'',
    refName:process.env.GITHUB_REF_NAME||'',
    workflow:process.env.GITHUB_WORKFLOW||'',
    workflowRef:process.env.GITHUB_WORKFLOW_REF||'',
    runId:process.env.GITHUB_RUN_ID||'',
    runAttempt:process.env.GITHUB_RUN_ATTEMPT||''
  };
}
function verify(prefixName=prefix){
  const provenanceFile=resolve(`${prefixName}-PROVENANCE.json`),recoveryFile=resolve(`${prefixName}-RECOVERY.json`);
  const p=json(provenanceFile),r=json(recoveryFile),g=json(gateFile),s=source();
  const checks={
    schema:p.schema==='powder.release.provenance/v1',
    automationVersion:p.automationVersion==='21.0.9',
    runtimeVersion:p.runtime?.version===release.version,
    runtimeBuild:p.runtime?.buildId===release.buildId,
    officialLocked:p.runtime?.official===false&&release.official===false,
    artifactExists:fs.existsSync(artifact),
    artifactName:p.artifact?.name===path.basename(artifact),
    artifactSize:p.artifact?.size===stat(artifact).size,
    artifactSha256:p.artifact?.sha256===shaFile(artifact),
    finalGatePass:g.pass===true&&p.evidence?.finalGate?.pass===true,
    finalGateSha256:p.evidence?.finalGate?.sha256===shaFile(gateFile),
    releaseMetadataSha256:p.evidence?.releaseMetadata?.sha256===shaFile(releaseFile),
    sourceCommit:!!s.commit&&p.source?.commit===s.commit,
    sourceTree:!!s.tree&&p.source?.tree===s.tree,
    recoveryArtifact:r.artifact?.sha256===p.artifact?.sha256,
    recoveryProvenance:r.provenance?.sha256===shaFile(provenanceFile),
    recoveryRuntime:r.runtime?.currentBuildId===release.buildId&&r.runtime?.previousBuildId===release.promotedFrom,
    recoveryManualOnly:r.policy?.automaticRollback===false
  };
  if(requireTag)checks.releaseTag=s.refName===`v${release.version}`&&p.source?.refName===s.refName;
  const report={version:'21.0.9',mode:'verify',checks,details:{artifact:path.basename(artifact),runtime:release.version,buildId:release.buildId,source:s,provenanceSha256:shaFile(provenanceFile)},pass:Object.values(checks).every(Boolean)};
  write(resolve(`${prefixName}-PROVENANCE-VERIFY.json`),report);
  return report;
}
if(mode==='generate'){
  if(!fs.existsSync(artifact)||!fs.existsSync(gateFile))throw new Error('Artifact or Final Gate evidence is missing');
  const g=json(gateFile);if(g.pass!==true)throw new Error('Final Gate is not PASS');
  const s=source();if(!s.commit||!s.tree)throw new Error('Git source identity unavailable');
  const provenance={
    schema:'powder.release.provenance/v1',automationVersion:'21.0.9',createdAt:new Date().toISOString(),
    runtime:{version:release.version,buildId:release.buildId,channel:release.channel,official:release.official,promotedFrom:release.promotedFrom},
    source:s,
    artifact:{name:path.basename(artifact),size:stat(artifact).size,sha256:shaFile(artifact)},
    evidence:{
      finalGate:{name:path.basename(gateFile),sha256:shaFile(gateFile),pass:g.pass===true},
      releaseMetadata:{name:'release.json',sha256:shaFile(releaseFile)}
    },
    build:{generator:'GitHub Actions',repositoryTooling:'Powder 21.0.9',attestationCapability:'plan-dependent-optional'},
    policy:{automaticOfficialPromotion:false,automaticRollback:false}
  };
  const provenanceFile=out('PROVENANCE.json');write(provenanceFile,provenance);
  fs.writeFileSync(out('PROVENANCE.json.sha256'),`${shaFile(provenanceFile)}  ${path.basename(provenanceFile)}\n`);
  const recovery={
    schema:'powder.release.recovery/v1',automationVersion:'21.0.9',createdAt:new Date().toISOString(),
    artifact:{name:path.basename(artifact),sha256:provenance.artifact.sha256},
    provenance:{name:path.basename(provenanceFile),sha256:shaFile(provenanceFile)},
    runtime:{currentVersion:release.version,currentBuildId:release.buildId,previousBuildId:release.promotedFrom},
    source:{currentCommit:s.commit,currentTree:s.tree,previousCommit:s.parentCommit},
    procedure:[
      'Verify artifact SHA-256 and provenance before any recovery action.',
      'Prefer the last known-good GitHub Release/buildId recorded by operations evidence.',
      'Use source.previousCommit only as an emergency source rollback candidate; validate all gates before deployment.',
      'Never flip official=true or perform production rollback automatically.'
    ],
    policy:{automaticRollback:false,requiresHumanApproval:true,requiresRegressionGate:true}
  };
  write(out('RECOVERY.json'),recovery);
  const report=verify(prefix);console.log(JSON.stringify({generated:true,provenance:path.basename(provenanceFile),recovery:path.basename(out('RECOVERY.json')),verification:report},null,2));
  if(!report.pass)process.exit(1);
}else if(mode==='verify'){
  const report=verify(prefix);console.log(JSON.stringify(report,null,2));if(!report.pass)process.exit(1);
}else throw new Error(`Unknown mode ${mode}`);
