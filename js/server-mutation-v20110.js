(()=>{'use strict';
const VERSION='20.15.0';
const st={gateway:0,legacyFallback:0,blocked:0,lastMode:'prefer',lastError:'',lastAction:'',lastAt:0};
const online=()=>window.POWDER_ONLINE_V150;
const cfg=()=>window.POWDER_CONFIG?.serverMutationGatewayV20110||window.POWDER_CONFIG?.serverMutationGatewayV20100||{};
const mode=()=>String(cfg().mode||'prefer').toLowerCase();
function unwrap(d){if(d&&d.atomic===true&&Object.prototype.hasOwnProperty.call(d,'result')){const r=d.result&&typeof d.result==='object'?d.result:{ok:true};return{...r,txKey:d.txKey,__mutation20110:{routeKind:'sql_atomic',atomic:true,idempotent:!!d.idempotent,handler:d.handler||'',version:VERSION}}}if(d&&d.canonical===true&&Object.prototype.hasOwnProperty.call(d,'result')){const r=d.result&&typeof d.result==='object'?d.result:{ok:true};return{...r,txKey:d.txKey,__mutation20110:{routeKind:d.routeKind||'legacy_edge_bridge',atomic:false,idempotent:!!d.idempotent,adapterVerified:!!d.adapterVerified,version:VERSION}}}return d}
async function mutate({scope,action,payload={},txKey}={}){
 const m=mode();st.lastMode=m;st.lastAction=`${scope||''}/${action||''}`;st.lastAt=Date.now();
 const ux=window.POWDER_EXPLOIT_GUARD_V20130?.check?.({scope,action,payload});if(ux&&ux.ok!==true){st.blocked++;st.lastError=String(ux.reason||'ANTI_ABUSE_BLOCKED');throw new Error('Yêu cầu không hợp lệ hoặc có dấu hiệu gửi lặp/sửa payload.');}
 const o=online();if(!o?.hasSession?.())throw new Error('Canonical Mutation Gateway cần phiên Powder Online.');
 if(m==='legacy')throw new Error('20.14 tiếp tục khóa client legacy write bypass.');
 try{
  const d=await o.request('/functions/v1/powder-mutation-gateway',{method:'POST',body:JSON.stringify({scope,action,txKey,payload,clientVersion:VERSION}),timeoutMs:14000,retries:0,retrySafe:false});
  st.gateway++;st.lastError='';return unwrap(d);
 }catch(e){st.lastError=String(e?.message||e);st.blocked++;throw e;}
}
async function capability(){const o=online();if(!o?.hasSession?.())return null;try{return await o.request('/functions/v1/powder-mutation-gateway',{method:'POST',body:JSON.stringify({action:'capability',clientVersion:VERSION}),retrySafe:true,retries:1})}catch(e){st.lastError=String(e?.message||e);return null}}
function diagnostics(){return{version:VERSION,mode:mode(),gateway:st.gateway,legacyFallback:st.legacyFallback,blocked:st.blocked,lastError:st.lastError,lastAction:st.lastAction,lastAt:st.lastAt,antiAbuse:window.POWDER_EXPLOIT_GUARD_V20130?.diagnostics?.()||null}}
window.POWDER_SERVER_MUTATION_V20110=window.POWDER_SERVER_MUTATION_V20100=Object.freeze({version:VERSION,mutate,capability,diagnostics});
})();
