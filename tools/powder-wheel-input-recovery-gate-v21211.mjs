import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const runtime=fs.readFileSync(path.join(root,'js/learning-runtime-recovery-v21210.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const checks=[];
const ok=(name,value)=>{if(!value)throw new Error(`[21.2.11] ${name}`);checks.push(name)};

ok('runtime upgraded',runtime.includes("VERSION='21.2.11'"));
ok('wheel capture installed',runtime.includes("window.addEventListener('wheel',onWheelCapture,{capture:true,passive:false})"));
ok('wheel is normalized',runtime.includes('function wheelDelta(e)')&&runtime.includes('e.deltaMode===1')&&runtime.includes('e.deltaMode===2'));
ok('document fallback exists',runtime.includes('DOC.scrollingElement||DOC.documentElement')&&runtime.includes('pageScroller'));
ok('nested scroll target supported',runtime.includes('nearestScrollable')&&runtime.includes("oy==='auto'")&&runtime.includes("oy==='scroll'"));
ok('scroll boundaries respected',runtime.includes('function canMove(el,dy)')&&runtime.includes('scrollHeight-el.clientHeight'));
ok('native zoom preserved',runtime.includes('e.ctrlKey||e.metaKey'));
ok('form controls preserved',runtime.includes('input[type="range"],select,textarea,[contenteditable="true"]'));
ok('combat and canvas excluded',runtime.includes("canvas,.battle-arena,.cv7-battle-shell,[data-combat-root]")&&runtime.includes("view==='combat'||view==='pvp'"));
ok('powball interaction excluded',runtime.includes('.powball-stage,.summon-stage,.summon-reveal'));
ok('visible modal boundary respected',runtime.includes('openModals.length')&&runtime.includes('if(!scroller&&modal)return'));
ok('blocked wheel is replaced once',runtime.includes('e.preventDefault()')&&runtime.includes('e.stopImmediatePropagation()')&&runtime.includes('scroller.scrollTop=next'));
ok('no wheel polling',!runtime.includes('setInterval(')&&!runtime.includes('MutationObserver'));
ok('learning secure authority kept',runtime.includes('secureLessonStart')&&runtime.includes('installSecureLearningBridge'));
ok('no combat engine mutation',!runtime.includes('POWDER_COMBAT_ENTRY')&&!runtime.includes('combat-core')&&!runtime.includes('combat-mechanics'));
ok('no economy formula mutation',!runtime.includes('powCandies')&&!runtime.includes('knowledge+=')&&!runtime.includes('coins+='));
ok('service worker cache rotated',sw.includes("V='21.2.11-wheel-hotfix'")&&sw.includes("BUILD='21211'"));
ok('old powder caches purge on activate',sw.includes("key.startsWith(CACHE_PREFIX)&&!keep.has(key)"));
ok('build-sensitive network reload remains',sw.includes("forceReload:sensitive")&&sw.includes("init.cache='reload'"));

console.log(`Powder 21.2.11 Wheel Input Recovery: ${checks.length}/${checks.length} checks passed`);
