const V='22.3.1-critical-home-path';
const BUILD='2231';
const SHELL=`powder-shell-${V}`;
const RUNTIME=`powder-runtime-${V}`;
const PRELOAD=`powder-assets-v21004`;
const CACHE_PREFIX='powder-';
const MAX_RUNTIME=140;
const NAV_TIMEOUT=8000;
const ASSET_TIMEOUT=12000;
const SHELL_FILES=[
  './','./index.html','./offline.html','./manifest.webmanifest',
  `./css/boot-loader-v21004.css?v=${BUILD}`,
  `./js/boot-loader-v21004.js?v=${BUILD}`,
  `./css/pvp-online-v1881.css?v=${BUILD}`,
  `./css/combat-identity-v1881.css?v=${BUILD}`,
  `./css/production-readiness-v1910.css?v=${BUILD}`,
  `./css/pilot-toolkit-v1930.css?v=${BUILD}`,
  `./css/recovery-runtime-v2040.css?v=${BUILD}`,
  `./css/reliability-runtime-v2080.css?v=${BUILD}`,
  `./css/live-rollout-v1950.css?v=${BUILD}`,
  `./css/pilot-live-v2000.css?v=${BUILD}`,
  `./css/launch-polish-v2000.css?v=${BUILD}`,
  `./css/release-freeze-v2000.css?v=${BUILD}`,
  `./css/official-launch-v2000.css?v=${BUILD}`,
  `./css/live-ops-diagnostics-v2020.css?v=${BUILD}`,
  `./js/live-ops-diagnostics-v2020.js?v=${BUILD}`,
  `./js/observability-v2020.js?v=${BUILD}`,
  `./js/combat-turn-safety-v2207.js?v=${BUILD}`,
  `./js/combat-identity-breakthrough-v2210.js?v=${BUILD}`,
  `./js/combat-command-feedback-v2212.js?v=${BUILD}`,
  `./css/combat-identity-breakthrough-v2210.css?v=${BUILD}`,
  './assets/backgrounds/bg-loading-splash-1777.webp','./assets/ui/powder-logo-project.webp'
];
const BUILD_SENSITIVE=/\.(?:html?|js|mjs|css|json|webmanifest)$/i;
const CACHEABLE=/\.(?:js|mjs|css|json|webmanifest|webp|png|jpg|jpeg|svg|mp3|m4a|ogg|wav|woff2?)$/i;
const TRANSIENT_STATUS=new Set([408,425,429,500,502,503,504]);
const CRITICAL_HOME_SCRIPTS=[
 'js/environment-v162.js','js/config.js','js/production-release-v162.js','js/data.js',
 'js/learning-depth-v136.js','js/learning-depth-v137.js','js/learning-master-v2.js',
 'js/learning-scale-v166.js','js/learning-content-expansion-v167.js','js/learning-content-expansion-v171.js','js/learning-events-v167.js','js/player-experience-v168.js',
 'js/pow-growth-v143.js','js/power-curve-v8.js','js/pow-balance-v174.js','js/starter-evolution-runtime.js','js/game-engine.js','js/app.js'
];
const DOMAIN_LOCK_BAD='.filter(id=>EXP[id]?.special)';
const DOMAIN_LOCK_FIXED=".filter(id=>EXP[id]?.kind==='special')";
const AUTH_REFRESH_BAD='if(/JWT|token|expired/i.test(e.message)&&await refresh())';
const AUTH_REFRESH_FIXED="if((Number(e?.status)===401||/JWT|token|expired|unauthorized/i.test(String(e?.message||'')))&&await refresh())";
const AUTH_SESSION_BAD='hasSession:()=>!!st.session';
const AUTH_SESSION_FIXED='hasSession:()=>!!st.session&&!st.refreshPromise&&(!st.session.expires_at||Date.now()/1000<Number(st.session.expires_at)-5)';
const RELIABILITY_BOOT_BAD="function boot(){apply(remote,'boot');refresh();timer=setInterval(()=>{if(!document.hidden&&navigator.onLine!==false)refresh()},POLL);window.addEventListener('online',()=>setTimeout(refresh,600),{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastFetchAt>POLL)refresh()},{passive:true})}";
const RELIABILITY_BOOT_FIXED="function boot(){apply(remote,'boot');lastFetchAt=Date.now();window.addEventListener('online',()=>apply(remote,'online'),{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply(remote,'visible')},{passive:true})}";
const BOOT_MANIFEST_HASH_BAD='MANIFEST_HASH="9a3d2db0b19ce1a1"';
const BOOT_MANIFEST_HASH_FIXED='MANIFEST_HASH="2f2231c7e6a91b4d"';
const BOOT_IDENTITY_BAD='{"u":"js/combat-skill-identity-v21018.js","s":9245,"r":"edebae51f9bb","k":"script"}';
const BOOT_IDENTITY_FIXED='{"u":"js/combat-skill-identity-v21018.js","s":9245,"r":"7e3ed9811655","k":"script"}';
const BOOT_WARM_BAD='return MANIFEST.every(a=>have.has(a.u))';
const BOOT_WARM_FIXED=`{const critical=new Set(${JSON.stringify(CRITICAL_HOME_SCRIPTS)});return MANIFEST.filter(a=>a.k==='style'||ENTRY_VISUALS.includes(a.u)||(a.k==='script'&&critical.has(a.u))).every(a=>have.has(a.u))}`;
const BOOT_QUEUE_BAD='const q=[...MANIFEST],concurrency=';
const BOOT_QUEUE_FIXED=`const critical=new Set(${JSON.stringify(CRITICAL_HOME_SCRIPTS)}),q=MANIFEST.filter(a=>a.k==='style'||ENTRY_VISUALS.includes(a.u)||(a.k==='script'&&critical.has(a.u)));state.totalFiles=q.length;const concurrency=`;
const BOOT_CORE_BAD='for(let i=0;i<SCRIPT_ORDER.length;i++)await runScript(SCRIPT_ORDER[i],cache,i);scriptsDone=true;if(window.__POWDER_APP_BOOTED__||window.POWDER_APP)appReadyFlag=true;';
const BOOT_CORE_FIXED=`const critical=new Set(${JSON.stringify(CRITICAL_HOME_SCRIPTS)}),loadedCritical=new Set();for(let i=0;i<SCRIPT_ORDER.length;i++){const url=SCRIPT_ORDER[i];if(!critical.has(url))continue;await runScript(url,cache,i);loadedCritical.add(url)}scriptsDone=true;if(window.__POWDER_APP_BOOTED__||window.POWDER_APP)appReadyFlag=true;const deferred=SCRIPT_ORDER.filter(url=>!loadedCritical.has(url));setTimeout(async()=>{while(!entered)await sleep(20);await sleep(180);for(const url of deferred){const i=SCRIPT_ORDER.indexOf(url);try{await runScript(url,cache,i)}catch(e){console.error('[Powder post-boot module]',url,e)}if(globalThis.scheduler?.yield)await globalThis.scheduler.yield()}try{window.POWDER_APP?.renderAll?.()}catch(_){}try{window.dispatchEvent(new CustomEvent('powder:post-boot-complete',{detail:{deferred:deferred.length,total:SCRIPT_ORDER.length}}))}catch(_){}},0);`;
const APP_RECOVERY_BAD='function loadJsonWithRecovery(key){const priority=';
const APP_RECOVERY_FIXED="function loadJsonWithRecovery(key){const primaryRaw=storageGet(key),pendingRaw=storageGet(`${key}_pending`);if(primaryRaw&&!pendingRaw){try{const parsed=JSON.parse(primaryRaw);if(parsed&&typeof parsed==='object'){storageRecoverySource='';return parsed}}catch(_){}}const priority=";
const APP_MIGRATE_BAD='const next=sanitizeSave(migratePowIds(old));atomicStorageJson(C.storageKey,next);return next';
const APP_MIGRATE_FIXED="if(Number(old.saveVersion||0)>=15&&Number(old.starSystemVersion||0)>=3&&Number(old.progressionVersion||0)>=2)return sanitizeSave(old);const next=sanitizeSave(migratePowIds(old));atomicStorageJson(C.storageKey,next);return next";
const APP_STARTER_BAD='installImageSafety();applySettings();bind();bindBoss();initInventoryControls();initStarter();window.POWDER_APP=';
const APP_STARTER_FIXED="installImageSafety();applySettings();bind();bindBoss();initInventoryControls();const needsStarter=!P.starterId||!pow(P.starterId)||!owned(P.starterId);if(needsStarter)initStarter();window.POWDER_APP=";
const APP_DOUBLE_HOME_BAD="else{$('#setupScreen').hidden=true;$('#app').hidden=false;renderAll();showView('home')}window.__POWDER_APP_BOOTED__=true";
const APP_DOUBLE_HOME_FIXED="else{$('#setupScreen').hidden=true;$('#app').hidden=false;view='home';document.body.dataset.activeView='home';renderAll();try{window.dispatchEvent(new CustomEvent('powder:view-changed',{detail:{view:'home'}}))}catch(_){}}window.__POWDER_APP_BOOTED__=true";
const APP_MASTERY_BAD="mastery=Math.round(window.POWDER_ONLINE_V150?.hasSession?.()?Number(P.mastery||0):(LM?.averageMastery?.(P)||P.mastery||0))";
const APP_MASTERY_FIXED='mastery=Math.round(Number(P.mastery||0))';
const APP_NORMALIZE_BAD='normalizePromotionState(P);const E=window.POWDER_ENGINE;LM?.normalizeSave?.(P);const V=';
const APP_NORMALIZE_FIXED='normalizePromotionState(P);const E=window.POWDER_ENGINE;const V=';
const LEARNING_BANK_BAD='ensureExtendedQuestionBankV178();';
const LEARNING_BANK_FIXED="let __learningHeavyReadyV2231=false;function ensureLearningHeavyV2231(){if(__learningHeavyReadyV2231)return;__learningHeavyReadyV2231=true;ensureExtendedQuestionBankV178();for(const q of D.questions||[])q.learningMeta=questionMeta(q)}function scheduleLearningHeavyV2231(){if(__learningHeavyReadyV2231)return;if('requestIdleCallback'in window)requestIdleCallback(()=>ensureLearningHeavyV2231(),{timeout:1800});else setTimeout(()=>ensureLearningHeavyV2231(),700)}window.addEventListener('powder:app-booted',()=>setTimeout(scheduleLearningHeavyV2231,300),{once:true});";
const LEARNING_QUESTION_META_BAD='for(const q of D.questions||[])q.learningMeta=questionMeta(q);';
const LEARNING_QUESTION_META_FIXED='';
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function timeoutFetch(request,ms,forceReload=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms),init={signal:controller.signal};if(forceReload)init.cache='reload';return fetch(request,init).finally(()=>clearTimeout(timer))}
async function fetchWithRetry(request,{timeout=ASSET_TIMEOUT,retries=1,forceReload=false}={}){let lastError=null;for(let attempt=0;attempt<=retries;attempt++){try{const response=await timeoutFetch(request,timeout,forceReload);if(!TRANSIENT_STATUS.has(response.status)||attempt>=retries)return response;lastError=new Error(`HTTP ${response.status}`)}catch(error){lastError=error;if(attempt>=retries)throw error}await sleep(180+attempt*260)}throw lastError||new Error('Network unavailable')}
async function trim(cacheName,max){const cache=await caches.open(cacheName),keys=await cache.keys();if(keys.length>max)await Promise.all(keys.slice(0,keys.length-max).map(key=>cache.delete(key)))}
async function exactMatch(cacheName,request){try{return await(await caches.open(cacheName)).match(request)}catch{return null}}
async function preloadMatch(request){try{const url=new URL(request.url);if(BUILD_SENSITIVE.test(url.pathname))return null;const cache=await caches.open(PRELOAD);let hit=await cache.match(request);if(hit)return hit;url.search='';return cache.match(new Request(url.href,{credentials:'same-origin'}))}catch{return null}}
async function runtimePut(request,response){if(!response||response.status!==200||response.type==='opaque')return;try{const cache=await caches.open(RUNTIME);await cache.put(request,response.clone());await trim(RUNTIME,MAX_RUNTIME)}catch{}}
async function cachedFallback(request){return await exactMatch(RUNTIME,request)||await exactMatch(SHELL,request)||await preloadMatch(request)}
async function repairBuildResponse(url,response){if(!response?.ok)return response;const domain=url.pathname.endsWith('/js/domain-system-v15.js'),auth=url.pathname.endsWith('/js/online-foundation-v150.js'),reliability=url.pathname.endsWith('/js/reliability-runtime-v2080.js'),boot=url.pathname.endsWith('/js/boot-loader-v21004.js'),app=url.pathname.endsWith('/js/app.js'),learningMaster=url.pathname.endsWith('/js/learning-master-v2.js');if(!domain&&!auth&&!reliability&&!boot&&!app&&!learningMaster)return response;try{const text=await response.text();let fixed=text,kind='none';if(domain){fixed=fixed.replace(DOMAIN_LOCK_BAD,DOMAIN_LOCK_FIXED);kind='domain-lock-2136'}if(auth){fixed=fixed.replace(AUTH_REFRESH_BAD,AUTH_REFRESH_FIXED).replace(AUTH_SESSION_BAD,AUTH_SESSION_FIXED);kind='auth-refresh-2136'}if(reliability){fixed=fixed.replace(RELIABILITY_BOOT_BAD,RELIABILITY_BOOT_FIXED);kind='reliability-local-safe-2136'}if(boot){fixed=fixed.replace(BOOT_MANIFEST_HASH_BAD,BOOT_MANIFEST_HASH_FIXED).replace(BOOT_IDENTITY_BAD,BOOT_IDENTITY_FIXED).replace(BOOT_WARM_BAD,BOOT_WARM_FIXED).replace(BOOT_QUEUE_BAD,BOOT_QUEUE_FIXED).replace(BOOT_CORE_BAD,BOOT_CORE_FIXED);kind='boot-critical-home-2231'}if(app){fixed=fixed.replace(APP_RECOVERY_BAD,APP_RECOVERY_FIXED).replace(APP_MIGRATE_BAD,APP_MIGRATE_FIXED).replace(APP_STARTER_BAD,APP_STARTER_FIXED).replace(APP_DOUBLE_HOME_BAD,APP_DOUBLE_HOME_FIXED).replace(APP_MASTERY_BAD,APP_MASTERY_FIXED).replace(APP_NORMALIZE_BAD,APP_NORMALIZE_FIXED);kind='app-fast-boot-2230'}if(learningMaster){fixed=fixed.replace(LEARNING_BANK_BAD,LEARNING_BANK_FIXED).replace(LEARNING_QUESTION_META_BAD,LEARNING_QUESTION_META_FIXED);kind='learning-idle-enrichment-2231'}const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.set('x-powder-runtime-repair',kind);return new Response(fixed,{status:response.status,statusText:response.statusText,headers})}catch{return response}}
async function assetResponse(request){const url=new URL(request.url),sensitive=BUILD_SENSITIVE.test(url.pathname);if(sensitive){try{let response=await fetchWithRetry(request,{timeout:ASSET_TIMEOUT,retries:0,forceReload:true});response=await repairBuildResponse(url,response);if(response.ok)runtimePut(request,response);return response}catch(error){const hit=await cachedFallback(request);if(hit)return hit;throw error}}const preload=await preloadMatch(request);if(preload)return preload;let hit=await exactMatch(SHELL,request);if(hit)return hit;hit=await exactMatch(RUNTIME,request);if(hit)return hit;try{const response=await fetchWithRetry(request,{timeout:ASSET_TIMEOUT,retries:1});if(response.ok)runtimePut(request,response);return response}catch(error){hit=await cachedFallback(request);if(hit)return hit;throw error}}
async function navigationResponse(request){try{const response=await fetchWithRetry(request,{timeout:NAV_TIMEOUT,retries:0,forceReload:true});if(response.ok)runtimePut(request,response);return response}catch{const url=new URL(request.url),cached=await exactMatch(RUNTIME,request);if(cached)return cached;if(/\/admin(?:\.html)?$/.test(url.pathname))return await exactMatch(SHELL,new Request(new URL('./offline.html',self.registration.scope).href));return await exactMatch(SHELL,new Request(new URL('./index.html',self.registration.scope).href))||await exactMatch(SHELL,new Request(new URL('./offline.html',self.registration.scope).href))}}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(SHELL);await Promise.allSettled(SHELL_FILES.map(file=>cache.add(file)))})());self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keep=new Set([SHELL,RUNTIME,PRELOAD]);for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&!keep.has(key))await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('message',event=>{const data=event.data;if(data==='SKIP_WAITING'||data?.type==='SKIP_WAITING')self.skipWaiting();if(data==='CLEAR_RUNTIME'||data?.type==='CLEAR_RUNTIME')event.waitUntil(caches.delete(RUNTIME));if(data?.type==='GET_BUILD'&&event.source?.postMessage)event.source.postMessage({type:'POWDER_SW_BUILD',version:V,build:BUILD})});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(navigationResponse(request));return}if(CACHEABLE.test(url.pathname))event.respondWith(assetResponse(request))});
