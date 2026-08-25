(()=>{'use strict';
if(window.POWDER_AUTH_UX_V2195)return;
const VERSION='21.9.5',STYLE_ID='powderAuthUx2195Css',STYLE_HREF='css/auth-ux-v2195.css?v=2195';
const state={enhances:0,enterSubmits:0,passwordToggles:0,blockedMismatch:0,lastAt:0};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function style(){if(document.getElementById(STYLE_ID))return;const l=document.createElement('link');l.id=STYLE_ID;l.rel='stylesheet';l.href=STYLE_HREF;document.head.appendChild(l)}
function authModal(){return $('#onlineAuthModal')}
function activeMode(){return $('#onlineAuthTabs .is-active')?.dataset.mode||'login'}
function status(text,error=true){const e=$('#onlineAuthStatus');if(!e)return;e.textContent=text;e.className='online-auth-status-v150'+(error?' is-error':'')}
function visible(el){return !!el&&!el.hidden&&getComputedStyle(el).display!=='none'}
function eyeIcon(show){return show?'🙈':'👁'}
function addEye(input){
  if(!input||input.dataset.auth2195Eye==='1')return;
  input.dataset.auth2195Eye='1';
  let wrap=input.parentElement;
  if(!wrap)return;
  if(!wrap.classList.contains('auth2195-password-wrap')){
    const shell=document.createElement('span');shell.className='auth2195-password-wrap';
    input.before(shell);shell.appendChild(input);wrap=shell;
  }
  const b=document.createElement('button');b.type='button';b.className='auth2195-eye';b.setAttribute('aria-label','Hiện mật khẩu');b.setAttribute('title','Hiện mật khẩu');b.textContent=eyeIcon(false);
  b.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';b.textContent=eyeIcon(show);b.setAttribute('aria-label',show?'Ẩn mật khẩu':'Hiện mật khẩu');b.setAttribute('title',show?'Ẩn mật khẩu':'Hiện mật khẩu');b.setAttribute('aria-pressed',show?'true':'false');state.passwordToggles++;input.focus({preventScroll:true})});
  wrap.appendChild(b)
}
function passwordRow(input){return input?.closest?.('label,.online-auth-row-v150,.account-field-v160')||input?.parentElement||null}
function ensureConfirm(){
  const form=$('.online-auth-form-v150'),pass=$('#onlinePassword');if(!form||!pass)return null;
  let row=$('#onlineConfirmRowV2195');
  if(!row){
    row=document.createElement('label');row.id='onlineConfirmRowV2195';row.className='auth2195-confirm-row';row.innerHTML='<span>Xác nhận mật khẩu</span><input id="onlinePasswordConfirmV2195" type="password" minlength="8" autocomplete="new-password" placeholder="Nhập lại mật khẩu" aria-describedby="onlinePasswordMatchV2195"><small id="onlinePasswordMatchV2195" class="auth2195-match" aria-live="polite"></small>';
    const anchor=passwordRow(pass);if(anchor?.parentElement)anchor.after(row);else form.insertBefore(row,$('#onlineAuthSubmit')||null);
  }
  addEye($('#onlinePasswordConfirmV2195'));return row
}
function ensureStrength(){
  const pass=$('#onlinePassword');if(!pass)return;
  let e=$('#onlinePasswordStrengthV2195');if(e)return;
  e=document.createElement('div');e.id='onlinePasswordStrengthV2195';e.className='auth2195-strength';e.innerHTML='<i></i><span></span>';
  const row=passwordRow(pass);row?.appendChild(e)
}
function strength(v){let n=0;if(v.length>=8)n++;if(v.length>=12)n++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))n++;if(/\d/.test(v))n++;if(/[^A-Za-z0-9]/.test(v))n++;return Math.min(4,n)}
function updatePasswordHints(){
  const pass=$('#onlinePassword'),confirm=$('#onlinePasswordConfirmV2195'),meter=$('#onlinePasswordStrengthV2195');if(!pass)return;
  if(meter){const n=strength(pass.value),labels=['Quá ngắn','Yếu','Trung bình','Tốt','Mạnh'];meter.dataset.level=String(n);const bar=$('i',meter),txt=$('span',meter);if(bar)bar.style.setProperty('--auth-strength',`${n*25}%`);if(txt)txt.textContent=pass.value?labels[n]:''}
  const match=$('#onlinePasswordMatchV2195');if(confirm&&match){if(!confirm.value)match.textContent='';else if(confirm.value===pass.value){match.textContent='✓ Mật khẩu trùng khớp';match.dataset.ok='1'}else{match.textContent='Mật khẩu nhập lại chưa khớp';match.dataset.ok='0'}}
}
function syncMode(){
  const mode=activeMode(),reg=mode==='register',pass=$('#onlinePassword'),confirmRow=ensureConfirm();
  if(confirmRow)confirmRow.hidden=!reg;
  if(pass){pass.autocomplete=reg?'new-password':'current-password';pass.setAttribute('aria-label',reg?'Mật khẩu mới':'Mật khẩu');pass.placeholder=reg?'Tối thiểu 8 ký tự':'Mật khẩu'}
  const email=$('#onlineEmail');if(email){email.autocomplete='username';email.inputMode='email';email.spellcheck=false;email.autocapitalize='none'}
  const name=$('#onlineName');if(name){name.autocomplete='nickname';name.autocapitalize='words'}
  const meter=$('#onlinePasswordStrengthV2195');if(meter)meter.hidden=!reg;
  updatePasswordHints()
}
function validateRegister(){
  if(activeMode()!=='register')return true;
  const pass=$('#onlinePassword')?.value||'',confirm=$('#onlinePasswordConfirmV2195')?.value||'';
  if(pass.length<8){status('Mật khẩu cần ít nhất 8 ký tự.');$('#onlinePassword')?.focus();return false}
  if(!confirm){status('Hãy nhập lại mật khẩu để xác nhận.');$('#onlinePasswordConfirmV2195')?.focus();return false}
  if(pass!==confirm){state.blockedMismatch++;status('Hai mật khẩu chưa trùng khớp.');$('#onlinePasswordConfirmV2195')?.focus();return false}
  return true
}
function submitFromEnter(e){
  const modal=authModal();if(!modal||modal.hidden||e.key!=='Enter'||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
  const target=e.target;if(!target?.closest?.('#onlineAuthModal'))return;
  if(target.matches?.('button,a,textarea'))return;
  const btn=$('#onlineAuthSubmit');if(!btn||btn.disabled||!visible(btn))return;
  e.preventDefault();e.stopPropagation();if(!validateRegister())return;state.enterSubmits++;btn.click()
}
function enhanceAuth(){
  const modal=authModal(),pass=$('#onlinePassword');if(!modal||!pass)return false;
  style();ensureConfirm();ensureStrength();addEye(pass);syncMode();
  if(modal.dataset.auth2195!=='1'){
    modal.dataset.auth2195='1';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    $('#onlineEmail')?.addEventListener('input',()=>status('',false));
    pass.addEventListener('input',updatePasswordHints);
    $('#onlinePasswordConfirmV2195')?.addEventListener('input',updatePasswordHints);
    $$('#onlineAuthTabs button').forEach(b=>b.addEventListener('click',()=>queueMicrotask(syncMode)));
    state.enhances++
  }
  state.lastAt=Date.now();return true
}
function enhanceCenter(){
  const center=$('#accountCenterV160');if(!center)return;
  for(const input of $$('input[type="password"]',center))addEye(input)
}
document.addEventListener('keydown',submitFromEnter,true);
document.addEventListener('keydown',e=>{if(e.key!=='CapsLock'&&!e.getModifierState?.('CapsLock'))return;const input=e.target;if(input?.type!=='password')return;const wrap=input.closest('.auth2195-password-wrap');if(!wrap)return;wrap.dataset.caps=e.getModifierState('CapsLock')?'1':'0'},true);
document.addEventListener('keyup',e=>{const input=e.target;if(input?.type!=='password')return;const wrap=input.closest('.auth2195-password-wrap');if(wrap)wrap.dataset.caps=e.getModifierState?.('CapsLock')?'1':'0'},true);
document.addEventListener('click',e=>{
  const submit=e.target?.closest?.('#onlineAuthSubmit');if(submit&&!validateRegister()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return}
  if(e.target?.closest?.('#onlineAuthTabs button'))setTimeout(syncMode,0)
},true);
const mo=new MutationObserver(()=>{enhanceAuth();enhanceCenter()});
function observe(){const root=$('#app')||document.body;mo.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});enhanceAuth();enhanceCenter()}
window.addEventListener('pagehide',()=>mo.disconnect(),{once:true});
function snapshot(){return{version:VERSION,...state,confirmPresent:!!$('#onlinePasswordConfirmV2195'),enterEnabled:true,eyeButtons:$$('.auth2195-eye').length,policy:'UX-only authentication enhancement; no token storage, Supabase authority, Cloud Save or account permission changes'}}
window.POWDER_AUTH_UX_V2195={version:VERSION,refresh:()=>{enhanceAuth();enhanceCenter()},snapshot};style();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();