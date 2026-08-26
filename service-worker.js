const V='22.1.1-combat-identity-hotfix';
const BUILD='2211';
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
  `./css/combat-identity-breakthrough-v2210.css?v=${BUILD}`,
  './assets/backgrounds/bg-loading-splash-1777.webp','./assets/ui/powder-logo-project.webp'
];
const BUILD_SENSITIVE=/\.(?:html?|js|mjs|css|json|webmanifest)$/i;
const CACHEABLE=/\.(?:js|mjs|css|json|webmanifest|webp|png|jpg|jpeg|svg|mp3|m4a|ogg|wav|woff2?)$/i;
const TRANSIENT_STATUS=new Set([408,425,429,500,502,503,504]);
const DOMAIN_LOCK_BAD='.filter(id=>EXP[id]?.special)';
const DOMAIN_LOCK_FIXED=".filter(id=>EXP[id]?.kind==='special')";
const AUTH_REFRESH_BAD='if(/JWT|token|expired/i.test(e.message)&&await refresh())';
const AUTH_REFRESH_FIXED="if((Number(e?.status)===401||/JWT|token|expired|unauthorized/i.test(String(e?.message||'')))&&await refresh())";
const AUTH_SESSION_BAD='hasSession:()=>!!st.session';
const AUTH_SESSION_FIXED='hasSession:()=>!!st.session&&!st.refreshPromise&&(!st.session.expires_at||Date.now()/1000<Number(st.session.expires_at)-5)';
const RELIABILITY_BOOT_BAD="function boot(){apply(remote,'boot');refresh();timer=setInterval(()=>{if(!document.hidden&&navigator.onLine!==false)refresh()},POLL);window.addEventListener('online',()=>setTimeout(refresh,600),{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastFetchAt>POLL)refresh()},{passive:true})}";
const RELIABILITY_BOOT_FIXED="function boot(){apply(remote,'boot');lastFetchAt=Date.now();window.addEventListener('online',()=>apply(remote,'online'),{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply(remote,'visible')},{passive:true})}";
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function timeoutFetch(request,ms,forceReload=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms),init={signal:controller.signal};if(forceReload)init.cache='reload';return fetch(request,init).finally(()=>clearTimeout(timer))}
async function fetchWithRetry(request,{timeout=ASSET_TIMEOUT,retries=1,forceReload=false}={}){let lastError=null;for(let attempt=0;attempt<=retries;attempt++){try{const response=await timeoutFetch(request,timeout,forceReload);if(!TRANSIENT_STATUS.has(response.status)||attempt>=retries)return response;lastError=new Error(`HTTP ${response.status}`)}catch(error){lastError=error;if(attempt>=retries)throw error}await sleep(180+attempt*260)}throw lastError||new Error('Network unavailable')}
async function trim(cacheName,max){const cache=await caches.open(cacheName),keys=await cache.keys();if(keys.length>max)await Promise.all(keys.slice(0,keys.length-max).map(key=>cache.delete(key)))}
async function exactMatch(cacheName,request){try{return await(await caches.open(cacheName)).match(request)}catch{return null}}
async function preloadMatch(request){try{const url=new URL(request.url);if(BUILD_SENSITIVE.test(url.pathname))return null;const cache=await caches.open(PRELOAD);let hit=await cache.match(request);if(hit)return hit;url.search='';return cache.match(new Request(url.href,{credentials:'same-origin'}))}catch{return null}}
async function runtimePut(request,response){if(!response||response.status!==200||response.type==='opaque')return;try{const cache=await caches.open(RUNTIME);await cache.put(request,response.clone());await trim(RUNTIME,MAX_RUNTIME)}catch{}}
async function cachedFallback(request){return await exactMatch(RUNTIME,request)||await exactMatch(SHELL,request)||await preloadMatch(request)}
async function repairBuildResponse(url,response){if(!response?.ok)return response;const domain=url.pathname.endsWith('/js/domain-system-v15.js'),auth=url.pathname.endsWith('/js/online-foundation-v150.js'),reliability=url.pathname.endsWith('/js/reliability-runtime-v2080.js');if(!domain&&!auth&&!reliability)return response;try{const text=await response.text();let fixed=text,kind='none';if(domain){fixed=fixed.replace(DOMAIN_LOCK_BAD,DOMAIN_LOCK_FIXED);kind='domain-lock-2136'}if(auth){fixed=fixed.replace(AUTH_REFRESH_BAD,AUTH_REFRESH_FIXED).replace(AUTH_SESSION_BAD,AUTH_SESSION_FIXED);kind='auth-refresh-2136'}if(reliability){fixed=fixed.replace(RELIABILITY_BOOT_BAD,RELIABILITY_BOOT_FIXED);kind='reliability-local-safe-2136'}const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');headers.set('x-powder-runtime-repair',kind);return new Response(fixed,{status:response.status,statusText:response.statusText,headers})}catch{return response}}
async function assetResponse(request){const url=new URL(request.url),sensitive=BUILD_SENSITIVE.test(url.pathname);
  if(sensitive){try{let response=await fetchWithRetry(request,{timeout:ASSET_TIMEOUT,retries:0,forceReload:true});response=await repairBuildResponse(url,response);if(response.ok)runtimePut(request,response);return response}catch(error){const hit=await cachedFallback(request);if(hit)return hit;throw error}}
  const preload=await preloadMatch(request);if(preload)return preload;let hit=await exactMatch(SHELL,request);if(hit)return hit;hit=await exactMatch(RUNTIME,request);if(hit)return hit;try{const response=await fetchWithRetry(request,{timeout:ASSET_TIMEOUT,retries:1});if(response.ok)runtimePut(request,response);return response}catch(error){hit=await cachedFallback(request);if(hit)return hit;throw error}}
async function navigationResponse(request){try{const response=await fetchWithRetry(request,{timeout:NAV_TIMEOUT,retries:0,forceReload:true});if(response.ok)runtimePut(request,response);return response}catch{const url=new URL(request.url),cached=await exactMatch(RUNTIME,request);if(cached)return cached;if(/\/admin(?:\.html)?$/.test(url.pathname))return await exactMatch(SHELL,new Request(new URL('./offline.html',self.registration.scope).href));return await exactMatch(SHELL,new Request(new URL('./index.html',self.registration.scope).href))||await exactMatch(SHELL,new Request(new URL('./offline.html',self.registration.scope).href))}}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(SHELL);await Promise.allSettled(SHELL_FILES.map(file=>cache.add(file)))})());self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keep=new Set([SHELL,RUNTIME]);for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&!keep.has(key))await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('message',event=>{const data=event.data;if(data==='SKIP_WAITING'||data?.type==='SKIP_WAITING')self.skipWaiting();if(data==='CLEAR_RUNTIME'||data?.type==='CLEAR_RUNTIME')event.waitUntil(caches.delete(RUNTIME));if(data?.type==='GET_BUILD'&&event.source?.postMessage)event.source.postMessage({type:'POWDER_SW_BUILD',version:V,build:BUILD})});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(navigationResponse(request));return}if(CACHEABLE.test(url.pathname))event.respondWith(assetResponse(request))});