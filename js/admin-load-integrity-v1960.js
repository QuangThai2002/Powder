(()=>{
'use strict';

const VERSION='19.6.0';
const BUILD_ID='powder-19.6.0-production-load-integrity-gate';
const URL='https://pxejydhqfzidnheudgnn.supabase.co';
const KEY='sb_publishable_EeppsefEV5sMaTcHrKWNCA_-dzAEA_H';
const SESSION='powder_admin_session_v151';
const STORE='powder_li1960_evidence';
const FIELD_KEY='powder_pr1910_field_checklist';

let state=null;
let busy=false;
let probe=null;
let cas=null;
let reports={};

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function session(){
  try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{return null}
}
function read(k,f={}){
  try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}
}
function write(k,v){
  try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}
}
async function api(action,payload={}){
  const s=session();
  if(!s?.access_token)throw new Error('Chưa đăng nhập Admin.');
  const t0=performance.now();
  const r=await fetch(URL+'/functions/v1/powder-admin-integrity',{
    method:'POST',
    headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},
    body:JSON.stringify({action,...payload})
  });
  const clientMs=performance.now()-t0;
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);
  return{...d,clientMs:Number(clientMs.toFixed(2))};
}
function ensure(){
  let host=$('#li1960Panel');
  if(host)return host;
  const page=$('#pageLaunch');
  if(!page)return null;
  const sec=document.createElement('section');
  sec.className='admin-card li1960-card';
  sec.innerHTML=`<div class="card-head"><div><small>PRODUCTION LOAD & INTEGRITY · ${VERSION}</small><h2>Bounded Load Lab & Integrity Gate</h2><p class="muted">Probe trong Admin bị giới hạn để không gây tải phá production. Load gate thật chỉ PASS bằng báo cáo external có nhiều session.</p></div><span id="li1960Badge" class="li1960-badge hold">Đang đọc…</span></div><div id="li1960Panel"><p class="muted">Đang đọc server integrity…</p></div>`;
  page.appendChild(sec);
  return $('#li1960Panel');
}
function percentile(arr,p){
  if(!arr.length)return 0;
  const a=[...arr].sort((x,y)=>x-y);
  const i=Math.min(a.length-1,Math.max(0,Math.ceil(p*a.length)-1));
  return a[i];
}
function validateReport(x){
  const okBase=x&&x.schema==='powder-load-gate-v1960'&&x.version===VERSION&&['pvp_state','cloud_load'].includes(x.mode);
  const m=x?.metrics||{};
  const ok=!!(okBase&&Number(x.requests)>=200&&Number(x.concurrency)>=10&&Number(x.tokenCount)>=5&&Number(m.errorRate)<=0.01&&Number(m.p95)<=1500&&Number(m.p99)<=2500);
  return{ok,mode:x?.mode||'',reason:ok?'PASS':'Cần ≥200 request, concurrency ≥10, ≥5 token, error ≤1%, P95 ≤1500ms, P99 ≤2500ms'};
}
function loadEvidence(){
  const saved=read(STORE,{})||{};
  probe=saved.probe||probe;
  cas=saved.cas||cas;
  reports=saved.reports||reports||{};
}
function saveEvidence(){
  write(STORE,{version:VERSION,buildId:BUILD_ID,probe,cas,reports,updatedAt:new Date().toISOString()});
}
function externalReady(){
  const pvp=validateReport(reports.pvp_state);
  const cloud=validateReport(reports.cloud_load);
  return{pass:pvp.ok&&cloud.ok,pvp,cloud};
}
function applyLoadField(){
  const ext=externalReady();
  const snap=state?.snapshot;
  if(!ext.pass||cas?.ok!==true||snap?.ready!==true){
    alert('Chưa đủ external load evidence + CAS + Integrity Snapshot.');
    return false;
  }
  const f=read(FIELD_KEY,{})||{};
  f.load={
    done:true,
    at:new Date().toISOString(),
    source:'load-integrity-v1960',
    details:{
      pvp:reports.pvp_state?.metrics,
      cloud:reports.cloud_load?.metrics,
      cas:{wins:cas.wins,conflicts:cas.conflicts},
      snapshotCheckedAt:snap.checkedAt
    }
  };
  write(FIELD_KEY,f);
  window.dispatchEvent(new CustomEvent('powder:readiness-field-updated',{detail:{id:'load',source:'load-integrity-v1960'}}));
  alert('Đã áp dụng Server load/concurrency PASS bằng evidence 19.6.0.');
  return true;
}
function render(){
  const el=ensure();
  if(!el)return;
  loadEvidence();
  if(!state){el.innerHTML='<p class="muted">Chưa có Integrity Snapshot.</p>';return}
  const s=state.snapshot||{};
  const iss=s.issues||{};
  const g=s.guards||{};
  const c=s.counts||{};
  const ext=externalReady();
  const roll=state.rollout||{};
  const badge=$('#li1960Badge');
  if(badge){
    badge.textContent=s.ready?'INTEGRITY PASS':'INTEGRITY HOLD';
    badge.className='li1960-badge '+(s.ready?'pass':'hold');
  }
  const checksHtml=Object.entries({...iss,...g}).map(([k,v])=>{
    const isIssue=Object.prototype.hasOwnProperty.call(iss,k);
    const ok=isIssue?Number(v)===0:v===true;
    return `<div><i class="${ok?'pass':'fail'}">${ok?'✓':'!'}</i><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`;
  }).join('');
  const probeHtml=probe?`<div class="li1960-metrics"><span><small>P50</small><b>${probe.p50}ms</b></span><span><small>P95</small><b>${probe.p95}ms</b></span><span><small>P99</small><b>${probe.p99}ms</b></span><span><small>Error</small><b>${(probe.errorRate*100).toFixed(2)}%</b></span><span><small>DB P95</small><b>${probe.dbP95}ms</b></span><span><small>Duration</small><b>${probe.durationMs}ms</b></span></div>`:'';
  const casHtml=cas?`<p class="${cas.ok?'pass':'li1960-error'}">CAS: ${cas.ok?'PASS':'FAIL'} · winner ${cas.wins??0} · conflict ${cas.conflicts??0}</p>`:'';

  el.innerHTML=`
  <div class="li1960-summary">
    <article><small>INTEGRITY</small><b>${s.ready?'PASS':'HOLD'}</b><span>${esc(s.checkedAt||'—')}</span></article>
    <article><small>ACTIVE PVP</small><b>${Number(c.activePvp||0)}</b><span>Server Combat ${Number(c.activeServerCombat||0)}</span></article>
    <article><small>SAFE PROBE</small><b>${probe?`${probe.requests} req`:'chưa chạy'}</b><span>${probe?`P95 ${probe.p95}ms · err ${(probe.errorRate*100).toFixed(1)}%`:'bounded ≤60 request'}</span></article>
    <article><small>REAL LOAD</small><b>${ext.pass?'PASS':'HOLD'}</b><span>${ext.pvp.ok?'PvP ✓':'PvP ○'} · ${ext.cloud.ok?'Cloud ✓':'Cloud ○'}</span></article>
  </div>
  <div class="li1960-grid">
    <section>
      <h3>Integrity Snapshot</h3>
      <div class="li1960-list">${checksHtml}</div>
      <p class="li1960-note">99 Pow ${Number(c.pvpPow||0)} · identity ${Number(c.identity||0)}/${Number(c.identitySignatures||0)} · Domain ${Number(c.domains||0)} + Simple ${Number(c.simpleDomains||0)}.</p>
      <button class="admin-btn ghost" id="li1960Refresh" type="button">Làm mới Snapshot</button>
    </section>
    <section>
      <h3>Safe Load Probe</h3>
      <div class="li1960-controls"><label>Concurrency<input id="li1960Conc" type="number" min="1" max="6" value="4"></label><label>Requests<input id="li1960Req" type="number" min="5" max="60" value="30"></label></div>
      <div class="li1960-actions"><button class="admin-btn primary" id="li1960Probe" type="button">Chạy bounded probe</button><button class="admin-btn ghost" id="li1960Cas" type="button">Chạy CAS conflict probe</button></div>
      ${probeHtml}${casHtml}
      <p class="li1960-note">Admin probe không tự PASS mục load thật. Production hiện rollout ${Number(roll.rollout_percent??100)}% / ${esc(roll.emergency_mode||'normal')}.</p>
    </section>
    <section>
      <h3>External Load Evidence</h3>
      <p class="muted">Import JSON do <code>tools/powder-load-gate-v1960.mjs</code> tạo. Cần cả PvP State và Cloud Load.</p>
      <textarea id="li1960Import" class="li1960-import" placeholder="Dán report JSON vào đây"></textarea>
      <div class="li1960-actions"><button class="admin-btn ghost" id="li1960ImportBtn" type="button">Import report</button><button class="admin-btn primary" id="li1960Apply" type="button" ${ext.pass&&cas?.ok&&s.ready?'':'disabled'}>Áp dụng Load PASS</button></div>
      <div class="li1960-list"><div><i class="${ext.pvp.ok?'pass':'hold'}">${ext.pvp.ok?'✓':'○'}</i><span>pvp_state</span><b>${ext.pvp.ok?'PASS':'HOLD'}</b></div><div><i class="${ext.cloud.ok?'pass':'hold'}">${ext.cloud.ok?'✓':'○'}</i><span>cloud_load</span><b>${ext.cloud.ok?'PASS':'HOLD'}</b></div></div>
    </section>
    <section>
      <h3>Evidence Export</h3>
      <p class="muted">Report không chứa access token. Dùng để lưu cùng Pilot/Recovery evidence trước Release Freeze.</p>
      <div class="li1960-actions"><button class="admin-btn ghost" id="li1960Export" type="button">Xuất Integrity Evidence</button></div>
      <p class="li1960-note">Edge ${esc(state.edgeVersion||'—')} · Build ${VERSION}. Safe probe là read-only; CAS dùng bảng sandbox và tự xóa row test.</p>
    </section>
  </div>`;
  bind();
}
async function refresh(){
  if(busy)return;
  busy=true;
  try{
    state=await api('state');
    render();
    window.POWDER_ADMIN_OFFICIAL_RELEASE_V1960?.render?.();
  }catch(e){
    const el=ensure();
    if(el)el.innerHTML=`<p class="li1960-error">${esc(e.message)}</p>`;
  }finally{busy=false}
}
async function runProbe(){
  if(busy)return;
  const req=Math.max(5,Math.min(60,Number($('#li1960Req')?.value)||30));
  const conc=Math.max(1,Math.min(6,Number($('#li1960Conc')?.value)||4));
  busy=true;
  const started=performance.now();
  const lat=[];
  const db=[];
  const errors=[];
  let next=0;
  async function worker(){
    while(true){
      const i=next++;
      if(i>=req)return;
      try{
        const r=await api('probe_one');
        lat.push(Number(r.clientMs||0));
        db.push(Number(r.dbMs||0));
      }catch(e){
        errors.push(String(e.message||e));
      }
    }
  }
  try{
    await Promise.all(Array.from({length:conc},()=>worker()));
    const durationMs=Math.round(performance.now()-started);
    probe={
      version:VERSION,
      at:new Date().toISOString(),
      requests:req,
      concurrency:conc,
      success:lat.length,
      errors:errors.length,
      errorRate:errors.length/req,
      p50:Number(percentile(lat,.5).toFixed(2)),
      p95:Number(percentile(lat,.95).toFixed(2)),
      p99:Number(percentile(lat,.99).toFixed(2)),
      dbP95:Number(percentile(db,.95).toFixed(2)),
      durationMs
    };
    saveEvidence();
  }finally{
    busy=false;
    render();
  }
}
async function runCas(){
  if(busy)return;
  busy=true;
  try{
    cas=await api('cas_probe');
    cas.at=new Date().toISOString();
    saveEvidence();
  }catch(e){
    cas={ok:false,error:String(e.message||e),at:new Date().toISOString()};
    saveEvidence();
  }finally{
    busy=false;
    render();
  }
}
function importReport(){
  const raw=$('#li1960Import')?.value||'';
  try{
    const x=JSON.parse(raw);
    const v=validateReport(x);
    if(!v.mode)throw new Error('Report mode không hợp lệ.');
    reports[v.mode]=x;
    saveEvidence();
    render();
    alert(`${v.mode}: ${v.ok?'đạt ngưỡng load':'đã import nhưng chưa đạt ngưỡng'}`);
  }catch(e){
    alert('Không import được report: '+e.message);
  }
}
function exportEvidence(){
  const payload={schema:'powder-load-integrity-evidence-v1960',version:VERSION,buildId:BUILD_ID,exportedAt:new Date().toISOString(),snapshot:state?.snapshot||null,rollout:state?.rollout||null,safeProbe:probe,cas,reports,externalReady:externalReady()};
  const b=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b);
  a.download='powder-19.6.0-load-integrity-evidence.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function bind(){
  $('#li1960Refresh')?.addEventListener('click',refresh);
  $('#li1960Probe')?.addEventListener('click',runProbe);
  $('#li1960Cas')?.addEventListener('click',runCas);
  $('#li1960ImportBtn')?.addEventListener('click',importReport);
  $('#li1960Apply')?.addEventListener('click',applyLoadField);
  $('#li1960Export')?.addEventListener('click',exportEvidence);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
window.POWDER_ADMIN_LOAD_INTEGRITY_V1960={version:VERSION,refresh,getState:()=>state,getEvidence:()=>({probe,cas,reports,external:externalReady()}),validateReport,render};
})();
