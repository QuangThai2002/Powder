(()=>{'use strict';
const VERSION='21.2.5',DOC=typeof document==='object'?document:null;
if(!DOC||window.POWDER_LEARNING_PERFORMANCE_V2125?.version===VERSION)return;
// Design references: Kolibri learner UI, Moodle course dashboard, Open edX learner dashboard.
// No academic/economy/Combat behavior is changed; this layer only audits and coalesces Learning UI refreshes.
let queued=false,requests=0,renders=0;
function commandActive(){return DOC.body?.classList.contains('powder-learning-command-2120')}
function memoryOpen(){return DOC.body?.classList.contains('powder-learning-memory-open-2120')}
function refresh(){requests++;if(queued)return false;queued=true;Promise.resolve().then(()=>{queued=false;const command=window.POWDER_LEARNING_COMMAND_CENTER_V2120;if(command?.render){command.render();renders++}if(memoryOpen()){const hub=window.POWDER_LEARNING_HUB_V149;if(hub?.render){hub.render();renders++}}});return true}
function audit(){const hub=window.POWDER_LEARNING_HUB_V149;return{version:VERSION,commandCenter:!!window.POWDER_LEARNING_COMMAND_CENTER_V2120,commandActive:commandActive(),memoryOpen:memoryOpen(),hubMode:String(hub?.mode||''),requests,renders,legacyHubEventDriven:String(hub?.mode||'').includes('event-driven'),continuousPolling:false,mutationObserver:false,animationLoop:false}}
function activateSessionContinuity2126(){if(window.POWDER_LEARNING_SESSION_CONTINUITY_V2126||DOC.getElementById('powderLearningSessionRuntime2126'))return false;const s=DOC.createElement('script');s.id='powderLearningSessionRuntime2126';s.src='js/learning-session-continuity-v2126.js?v=2126';s.async=true;DOC.head.appendChild(s);return true}
function activateCleanPresentation2129(){if(window.POWDER_RUNTIME_CLEAN_PRESENTATION_V2129||DOC.getElementById('powderRuntimeCleanPresentation2129Script'))return false;const s=DOC.createElement('script');s.id='powderRuntimeCleanPresentation2129Script';s.src='js/runtime-clean-presentation-v2129.js?v=2129';s.async=true;DOC.head.appendChild(s);return true}
DOC.body?.setAttribute('data-learning-performance','21.2.5');
DOC.addEventListener('powder:learning-refresh',refresh);
window.POWDER_LEARNING_PERFORMANCE_V2125={version:VERSION,refresh,audit,commandActive,memoryOpen,activateSessionContinuity2126,activateCleanPresentation2129,designReferences:['Kolibri learner UI','Moodle course dashboard','Open edX learner dashboard'],rulesPreserved:'Question pools, Mastery, SRS, rewards, Daily Boss, Rank, Dungeon and Combat unchanged'};
activateSessionContinuity2126();
activateCleanPresentation2129();
})();