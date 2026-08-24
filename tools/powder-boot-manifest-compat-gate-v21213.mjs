import fs from 'node:fs';
import crypto from 'node:crypto';

const BOOT='js/boot-loader-v21004.js';
const SW='service-worker.js';
const read=p=>fs.readFileSync(p);
const text=p=>read(p).toString('utf8');
const sha12=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,12);
const sha16=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);

const boot=text(BOOT);
const manifestMatch=boot.match(/const MANIFEST=(\[[\s\S]*?\]);\nconst SCRIPT_ORDER=/);
if(!manifestMatch){console.error('FAIL: cannot parse Boot Loader manifest');process.exit(1)}
const manifest=JSON.parse(manifestMatch[1]);
const declaredHash=boot.match(/MANIFEST_HASH=["']([0-9a-f]+)["']/)?.[1]||'';
const calculatedHash=sha16(JSON.stringify(manifest));
const bootVersion=boot.match(/const VERSION=["']([^"']+)["']/)?.[1]||'';

const missing=[];
const mismatched=[];
for(const entry of manifest){
  const path=String(entry.u||'');
  if(!path||!fs.existsSync(path)){missing.push(path||'(empty path)');continue}
  const bytes=read(path),size=bytes.length,hash=sha12(bytes);
  if(size!==Number(entry.s)||hash!==String(entry.r))mismatched.push({path,expectedSize:Number(entry.s),actualSize:size,expectedHash:String(entry.r),actualHash:hash,kind:entry.k});
}

const sw=text(SW);
const swVersion=sw.match(/const V=["']([^"']+)["']/)?.[1]||'';
const swBuild=sw.match(/const BUILD=["']([^"']+)["']/)?.[1]||'';
const protectedAudio=[
  'assets/audio/combat/user-combat-bgm.mp3',
  'assets/audio/domain/domain-voice-usercut-1.m4a',
  'assets/audio/domain/domain-voice-usercut-2.m4a',
  'assets/audio/domain/domain-voice-usercut-3.m4a',
  'assets/audio/domain/domain-voice-usercut-4.m4a'
];
const protectedPresent=protectedAudio.every(p=>fs.existsSync(p)&&manifest.some(x=>x.u===p));
const recoveryFilesAbsent=[
  'css/stability-recovery-v21212.css',
  'tools/powder-stability-recovery-gate-v21212.mjs',
  '.github/workflows/powder-stability-recovery-v21212.yml'
].every(p=>!fs.existsSync(p));

const checks={
  bootVersionFrozen:bootVersion==='21.0.4',
  manifestHashStable:declaredHash==='9a3d2db0b19ce1a1'&&declaredHash===calculatedHash,
  manifestParsed:manifest.length>1000,
  allManifestFilesPresent:missing.length===0,
  allManifestBytesMatch:mismatched.length===0,
  serviceWorkerHotfix:swVersion==='21.2.13-boot-manifest-compat'&&swBuild==='21213',
  serviceWorkerPurgesOldCaches:sw.includes('const keep=new Set([SHELL,RUNTIME])')&&sw.includes("key.startsWith(CACHE_PREFIX)&&!keep.has(key)"),
  protectedAudioPresent:protectedPresent,
  staleRecoveryArtifactsRemoved:recoveryFilesAbsent
};

for(const [name,ok] of Object.entries(checks))console.log(`${ok?'PASS':'FAIL'} ${name}`);
console.log(`Manifest entries: ${manifest.length}`);
console.log(`Manifest hash: ${declaredHash} / calculated ${calculatedHash}`);
if(missing.length)console.error('Missing:',missing.slice(0,20));
if(mismatched.length)console.error('Mismatched:',JSON.stringify(mismatched.slice(0,20),null,2));

const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length){console.error(`Powder 21.2.13 Boot Manifest Gate FAILED: ${failed.join(', ')}`);process.exit(1)}
console.log('Powder 21.2.13 Boot Manifest Gate PASSED.');
