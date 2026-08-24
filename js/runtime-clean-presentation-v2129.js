(()=>{'use strict';
const VERSION='21.2.9',DOC=typeof document==='object'?document:null;
if(!DOC||window.POWDER_RUNTIME_CLEAN_PRESENTATION_V2129?.version===VERSION)return;
function injectStyle(){if(DOC.getElementById('powderRuntimeCleanPresentation2129'))return;const s=DOC.createElement('style');s.id='powderRuntimeCleanPresentation2129';s.textContent=`
.boot1776-version{display:none!important}
#learningCommandCenter2120 .lcc-head>div>small:first-child,
#learningContinuity2126 .lsc-copy>small:first-child,
#learningDailyPlan2115 .ldp-head>div>small:first-child,
#learningMasteryRecovery2116 .mr-head>div>small:first-child,
#learningRotation2119 .rt-head>div>small:first-child,
#powderRotationModal2119 .rt-top>div>small:first-child,
#powderPromotionExam2123 .px-head>div>small:first-child{display:none!important}
#event167Combat small{font-size:0!important}
#event167Combat small::after{content:'Kết quả chiến đấu được máy chủ xác minh.';font-size:12px;opacity:.82}
`;DOC.head.appendChild(s)}
function clean(){injectStyle();if(DOC.title!=='Powder')DOC.title='Powder';return true}
function activateLearningRuntimeRecovery21210(){if(window.POWDER_LEARNING_RUNTIME_RECOVERY_V21210||DOC.getElementById('powderLearningRuntimeRecovery21210'))return false;const s=DOC.createElement('script');s.id='powderLearningRuntimeRecovery21210';s.src='js/learning-runtime-recovery-v21210.js?v=21210';s.async=true;DOC.head.appendChild(s);return true}
function boot(){clean();DOC.addEventListener('powder:local-save',clean);window.addEventListener('powder:view-changed',clean,{passive:true});activateLearningRuntimeRecovery21210()}
window.POWDER_RUNTIME_CLEAN_PRESENTATION_V2129={version:VERSION,clean,injectStyle,activateLearningRuntimeRecovery21210,rulesPreserved:'Presentation only; gameplay, save, economy, learning, server authority and Combat unchanged'};
if(DOC.readyState==='loading')DOC.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
