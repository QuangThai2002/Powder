import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const skipDirs = new Set(['.git','node_modules']);
const binaryExt = new Set(['.webp','.png','.jpg','.jpeg','.gif','.mp3','.m4a','.ogg','.wav','.woff','.woff2','.zip','.ico','.pdf']);
const files = [];
function walk(dir){
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (e.name === '.git') continue;
    const p = path.join(dir,e.name);
    if (e.isDirectory()) { if(!skipDirs.has(e.name)) walk(p); }
    else files.push(p);
  }
}
walk(root);
const rel = p => path.relative(root,p).replaceAll('\\','/');
const issues = [];
const sensitiveName = /(^|\/)(\.env(?:\..+)?|id_rsa|credentials\.json|service-account\.json|[^/]+\.(?:pem|p12|pfx|key))$/i;
for (const f of files) {
  const r = rel(f);
  if (sensitiveName.test(r) && !/\.env\.example$/i.test(r)) issues.push(`sensitive-file:${r}`);
  if (binaryExt.has(path.extname(f).toLowerCase())) continue;
  let txt=''; try { txt=fs.readFileSync(f,'utf8'); } catch { continue; }
  const pats = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'private-key'],
    [/\bAKIA[0-9A-Z]{16}\b/,'aws-access-key'],
    [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,'github-token'],
    [/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?[A-Za-z0-9._-]{24,}/i,'supabase-service-role'],
    [/AWS_SECRET_ACCESS_KEY\s*[:=]\s*["']?[A-Za-z0-9/+=]{24,}/i,'aws-secret']
  ];
  for (const [re,name] of pats) if(re.test(txt)) issues.push(`${name}:${r}`);
}
const workflowsDir = path.join(root,'.github','workflows');
const workflows = fs.existsSync(workflowsDir) ? fs.readdirSync(workflowsDir).filter(x=>/\.ya?ml$/i.test(x)) : [];
let permissionsOk = true, actionsOk = true, noSecretRefs = true;
for (const wf of workflows) {
  const txt=fs.readFileSync(path.join(workflowsDir,wf),'utf8');
  if (!/^permissions:\s*$/m.test(txt) || /permissions:\s*write-all/i.test(txt)) { permissionsOk=false; issues.push(`workflow-permissions:${wf}`); }
  if (/secrets\.(?!GITHUB_TOKEN\b)[A-Z0-9_]+/i.test(txt)) { noSecretRefs=false; issues.push(`workflow-secret-ref:${wf}`); }
  for (const m of txt.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gm)) {
    const ref=m[1];
    const ok=/^(actions\/(checkout|setup-node|upload-artifact|download-artifact)|github\/codeql-action\/[A-Za-z0-9_-]+)@(?:v\d+|[0-9a-f]{40})$/i.test(ref);
    if(!ok){ actionsOk=false; issues.push(`unapproved-action:${wf}:${ref}`); }
  }
  if (/contents:\s*write/i.test(txt) && wf !== 'powder-release.yml') { permissionsOk=false; issues.push(`unexpected-contents-write:${wf}`); }
}
const checks = {
  metadata: fs.existsSync(path.join(root,'SUPPLY-CHAIN-SECURITY-21.0.6.json')),
  noSensitiveFiles: !issues.some(x=>x.startsWith('sensitive-file:')),
  noEmbeddedSecrets: !issues.some(x=>/^(private-key|aws-access-key|github-token|supabase-service-role|aws-secret):/.test(x)),
  workflowPermissions: permissionsOk,
  approvedActionSources: actionsOk,
  noProductionSecretRefs: noSecretRefs,
  dependabot: fs.existsSync(path.join(root,'.github','dependabot.yml')),
  lineEndingPolicy: fs.existsSync(path.join(root,'.gitattributes')) && /eol=lf/.test(fs.readFileSync(path.join(root,'.gitattributes'),'utf8')),
  zipIgnored: fs.existsSync(path.join(root,'.gitignore')) && /^\*\.zip\s*$/m.test(fs.readFileSync(path.join(root,'.gitignore'),'utf8')),
  runtimeBaselineUnchanged: JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8')).version === '21.0.4'
};
const report={version:'21.0.6',checks,issues:[...new Set(issues)],pass:Object.values(checks).every(Boolean)&&issues.length===0};
console.log(JSON.stringify(report,null,2));
if(!report.pass) process.exit(1);
