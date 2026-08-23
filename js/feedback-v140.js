(()=>{
  'use strict';
  const EMAIL='ngophamquangthai202@gmail.com';
  const ZALO='0815126662';
  const DRAFT_KEY='powder_feedback_draft_v140';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const typeNames={balance:'Cân bằng sức mạnh',bug:'Bug / lỗi chức năng',performance:'Hiệu năng / lag',learning:'Học tập / HSK',ui:'Giao diện / UX'};
  const templates={
    balance:{subject:'VD: Frostmaw 6★ quá mạnh khi đi cùng team Băng',target:'VD: Frostmaw · Ultimate · Combat PvP',messageLabel:'Nhận xét về sức mạnh',message:'Mô tả Pow/skill đang mạnh hoặc yếu ở đâu, trong đội hình nào, cấp sao nào...',stepsLabel:'Đề xuất điều chỉnh',steps:'VD: giảm hệ số Ultimate 15%, giữ nguyên hiệu ứng đóng băng...'},
    bug:{subject:'VD: Nút Xác nhận không hoạt động sau câu thứ 8',target:'VD: Học → HSK2 → Bài 4',messageLabel:'Mô tả lỗi',message:'Bạn thấy lỗi gì? Trước khi lỗi xảy ra bạn đang làm gì?',stepsLabel:'Các bước tái hiện',steps:'1. Mở...  2. Bấm...  3. Lỗi xuất hiện...'},
    performance:{subject:'VD: Modal bài học giật khi cuộn',target:'VD: Học → HSK1 / máy tính',messageLabel:'Biểu hiện lag',message:'Mô tả lúc nào bị giật, chậm, đứng hình hoặc tụt FPS...',stepsLabel:'Điều kiện tái hiện',steps:'VD: mở bài học dài, cuộn nhanh, Ưu tiên mượt đang bật...'},
    learning:{subject:'VD: Câu HSK3 có đáp án chưa hợp lý',target:'VD: HSK3 · Bài ... · câu ...',messageLabel:'Nội dung cần góp ý',message:'Ghi câu hỏi, đáp án hoặc phần ngữ pháp bạn thấy chưa đúng/chưa đủ...',stepsLabel:'Đề xuất nội dung',steps:'Ghi đáp án/cách giải thích/mẫu câu bạn muốn sửa hoặc bổ sung...'},
    ui:{subject:'VD: Trang Cường Hóa bị lệch trên màn hình 1366×768',target:'VD: Cường Hóa → Trang bị',messageLabel:'Vấn đề hiển thị / thao tác',message:'Mô tả phần khó nhìn, lệch, tràn hoặc thao tác chưa thuận tiện...',stepsLabel:'Cách bạn muốn hiển thị',steps:'Mô tả bố cục, kích thước hoặc thao tác mong muốn...'}
  };
  function status(msg,error=false){const el=$('#feedbackStatus');if(!el)return;el.textContent=msg||'';el.classList.toggle('is-error',!!error)}
  function setType(type){if(!templates[type])type='balance';const hidden=$('#feedbackType');if(hidden)hidden.value=type;$$('[data-feedback-type]').forEach(b=>b.classList.toggle('is-active',b.dataset.feedbackType===type));const t=templates[type], subject=$('#feedbackSubject'), target=$('#feedbackTarget'), message=$('#feedbackMessage'), steps=$('#feedbackSteps');if(subject)subject.placeholder=t.subject;if(target)target.placeholder=t.target;if(message)message.placeholder=t.message;if(steps)steps.placeholder=t.steps;if($('#feedbackMessageLabel'))$('#feedbackMessageLabel').textContent=t.messageLabel;if($('#feedbackStepsLabel'))$('#feedbackStepsLabel').textContent=t.stepsLabel;saveDraftSoon()}
  function techInfo(){
    const perf=$('#performanceLiteToggle')?.checked?'Bật':'Tắt';
    const motion=$('#motionToggle')?.checked?'Bật':'Tắt';
    const version=window.POWDER_CONFIG?.appVersion||window.POWDER_APP?.version||'Beta 14.0';
    const viewport=`${window.innerWidth||0}×${window.innerHeight||0}`;
    const screenSize=window.screen?`${window.screen.width}×${window.screen.height}`:'Không rõ';
    const dpr=Number(window.devicePixelRatio||1).toFixed(2);
    return [
      `Phiên bản: ${version}`,
      `Thời gian: ${new Date().toLocaleString('vi-VN')}`,
      `Viewport: ${viewport} · Màn hình: ${screenSize} · DPR: ${dpr}`,
      `Ưu tiên mượt: ${perf} · Giảm chuyển động: ${motion}`,
      `Trình duyệt: ${navigator.userAgent||'Không rõ'}`
    ].join('\n');
  }
  function report(){
    const type=$('#feedbackType')?.value||'balance';
    const subject=($('#feedbackSubject')?.value||'').trim();
    const target=($('#feedbackTarget')?.value||'').trim();
    const severity=$('#feedbackSeverity')?.value||'Gợi ý';
    const message=($('#feedbackMessage')?.value||'').trim();
    const steps=($('#feedbackSteps')?.value||'').trim();
    const includeTech=$('#feedbackIncludeTech')?.checked!==false;
    const lines=[
      'POWDER — GÓP Ý / BÁO LỖI',
      '────────────────────────',
      `Loại: ${typeNames[type]||type}`,
      `Mức độ: ${severity}`,
      `Tiêu đề: ${subject||'(chưa nhập)'}`,
      `Liên quan: ${target||'(chưa nhập)'}`,
      '',
      `${templates[type]?.messageLabel||'Mô tả'}:`,
      message||'(chưa nhập)',
      '',
      `${templates[type]?.stepsLabel||'Chi tiết thêm'}:`,
      steps||'(chưa nhập)'
    ];
    if(includeTech)lines.push('','THÔNG TIN KỸ THUẬT (không kèm save)',techInfo());
    return {type,subject,target,severity,message,steps,text:lines.join('\n')};
  }
  function validate(r){
    if(!r.subject){status('Hãy nhập tiêu đề để phản hồi dễ phân loại.',true);$('#feedbackSubject')?.focus();return false}
    if(!r.message){status('Hãy mô tả nội dung góp ý hoặc lỗi bạn gặp.',true);$('#feedbackMessage')?.focus();return false}
    return true;
  }
  async function copyText(text){
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true}}catch(_){ }
    try{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return !!ok}catch(_){return false}
  }
  function sendGmail(){
    const r=report();if(!validate(r))return;
    const mailSubject=`[Powder ${typeNames[r.type]}] ${r.subject}`;
    const url=`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(EMAIL)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(r.text)}`;
    status('Đang mở Gmail với nội dung đã điền sẵn…');
    const w=window.open(url,'_blank');
    if(w){try{w.opener=null}catch(_){}}else{window.location.href=`mailto:${EMAIL}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(r.text)}`}
  }
  async function sendZalo(){
    const r=report();if(!validate(r))return;
    const copied=await copyText(r.text);
    status(copied?'Đã sao chép báo cáo. Đang mở Zalo — hãy dán nội dung và gửi.':'Đang mở Zalo. Nếu chưa sao chép được, dùng nút “Sao chép nội dung”.',!copied);
    const w=window.open(`https://zalo.me/${ZALO}`,'_blank');if(w){try{w.opener=null}catch(_){}}
  }
  async function copyReport(){
    const r=report();if(!validate(r))return;
    const ok=await copyText(r.text);status(ok?'Đã sao chép toàn bộ nội dung phản hồi.':'Không thể sao chép tự động trên trình duyệt này.',!ok)
  }
  let draftTimer=0,draftIdle=0;
  function saveDraftSoon(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{const run=()=>{draftIdle=0;saveDraft()};if(window.requestIdleCallback)draftIdle=requestIdleCallback(run,{timeout:1400});else draftIdle=setTimeout(run,0)},950)}
  function saveDraft(){
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify({type:$('#feedbackType')?.value||'balance',subject:$('#feedbackSubject')?.value||'',target:$('#feedbackTarget')?.value||'',severity:$('#feedbackSeverity')?.value||'Gợi ý',message:$('#feedbackMessage')?.value||'',steps:$('#feedbackSteps')?.value||'',tech:$('#feedbackIncludeTech')?.checked!==false}))}catch(_){ }
  }
  function restoreDraft(){
    try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(!d)return;setType(d.type||'balance');if($('#feedbackSubject'))$('#feedbackSubject').value=d.subject||'';if($('#feedbackTarget'))$('#feedbackTarget').value=d.target||'';if($('#feedbackSeverity'))$('#feedbackSeverity').value=d.severity||'Gợi ý';if($('#feedbackMessage'))$('#feedbackMessage').value=d.message||'';if($('#feedbackSteps'))$('#feedbackSteps').value=d.steps||'';if($('#feedbackIncludeTech'))$('#feedbackIncludeTech').checked=d.tech!==false}catch(_){ }
  }
  function bind(){
    if(!$('#feedbackCard'))return;
    $$('[data-feedback-type]').forEach(b=>b.addEventListener('click',()=>setType(b.dataset.feedbackType)));
    ['#feedbackSubject','#feedbackTarget','#feedbackSeverity','#feedbackMessage','#feedbackSteps','#feedbackIncludeTech'].forEach(sel=>$(sel)?.addEventListener('input',saveDraftSoon));
    $('#feedbackSeverity')?.addEventListener('change',saveDraftSoon);
    $('#feedbackIncludeTech')?.addEventListener('change',saveDraftSoon);
    $('#feedbackGmailBtn')?.addEventListener('click',sendGmail);
    $('#feedbackZaloBtn')?.addEventListener('click',sendZalo);
    $('#feedbackCopyBtn')?.addEventListener('click',copyReport);
    restoreDraft();setType($('#feedbackType')?.value||'balance');window.addEventListener('pagehide',saveDraft,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.POWDER_FEEDBACK_V140={buildReport:()=>report().text,email:EMAIL,zalo:ZALO};
})();
