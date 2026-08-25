(()=>{'use strict';
if(window.POWDER_COMBAT_DOMAIN_CLASH_AUTHORITY_V2167)return;
const VERSION='21.6.7',st={registrations:0,begins:0,answers:0,lastError:'',lastAt:0,registered:false};
function server(){return window.POWDER_SERVER_COMBAT_V1862||null}function clash(){return window.POWDER_COMBAT_DOMAIN_CLASH_V2166||null}
const transport={
 async begin(payload={}){const s=server();if(!s?.domainClashBegin)throw new Error('Server Combat chưa hỗ trợ domain_clash_begin.');st.begins++;st.lastAt=Date.now();try{const r=await s.domainClashBegin({...payload,questionCount:10,questionMs:5000});return r?.clash||r}catch(e){st.lastError=String(e?.message||e);throw e}},
 async answer(payload={}){const s=server();if(!s?.domainClashAnswer)throw new Error('Server Combat chưa hỗ trợ domain_clash_answer.');st.answers++;st.lastAt=Date.now();try{const r=await s.domainClashAnswer(payload);return r?.clash||r}catch(e){st.lastError=String(e?.message||e);throw e}},
 async state(payload={}){const s=server();if(!s?.domainClashState)throw new Error('Server Combat chưa hỗ trợ domain_clash_state.');try{return await s.domainClashState(payload)}catch(e){st.lastError=String(e?.message||e);throw e}}
};
function register(){const c=clash();if(!c?.registerTransport)return false;const ok=c.registerTransport(transport);if(ok){st.registered=true;st.registrations++;st.lastAt=Date.now()}return ok}
['powder:combat-state','powder:view-changed','pageshow'].forEach(n=>window.addEventListener(n,register,{passive:true}));
function snapshot(){return{version:VERSION,...st,serverReady:!!server()?.domainClashBegin,clashReady:!!clash()?.registerTransport,rules:{questionCount:10,questionMs:5000,serverAuthoritative:true,clientSelfResolution:false},serverStatus:server()?.domainClashAuthorityStatus?.()||null}}
window.POWDER_COMBAT_DOMAIN_CLASH_AUTHORITY_V2167={version:VERSION,snapshot,register,transport};register();
})();