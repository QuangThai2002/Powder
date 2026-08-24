(()=>{'use strict';
const VERSION='21.1.3';
const FAMILIES=['Recognition','Recall','Grammar','Context','Reading','Production','Application'];
const PROFILES={
 ZH:[
  ['HSK1 · Nền tảng',[24,20,24,12,15,5,0]],
  ['HSK2 · Mở rộng',[20,18,22,15,15,10,0]],
  ['HSK3 · Giai đoạn đầu',[16,15,20,15,18,12,4]],
  ['HSK3 · Hoàn thành',[14,14,18,15,20,14,5]],
  ['HSK4 · Giai đoạn đầu',[12,12,16,15,22,16,7]],
  ['HSK4 · Hoàn thành',[10,10,15,15,23,18,9]],
  ['HSK5 · Ứng dụng',[8,9,14,14,24,20,11]]
 ],
 EN:[
  ['B1+ → B2 · Bridge',[18,15,20,18,18,9,2]],
  ['B2 · Bridge',[15,14,19,18,19,11,4]],
  ['B2 · Core I',[13,13,18,18,20,13,5]],
  ['B2 · Core II',[12,12,17,17,21,15,6]],
  ['B2 · Nâng cao',[10,11,16,16,22,17,8]],
  ['B2 · Thực hành',[9,10,15,16,22,18,10]],
  ['B2 · Hoàn thành',[8,9,14,15,23,19,12]]
 ]
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const uniq=a=>[...new Set((a||[]).map(x=>String(x??'').trim()).filter(Boolean))];
const shuffle=a=>{a=[...(a||[])];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function profile(save,lesson){const lang=lesson?.language==='EN'?'EN':'ZH',rank=clamp(save?.rank,0,6),row=PROFILES[lang][rank]||PROFILES[lang][0],weights=Object.fromEntries(FAMILIES.map((f,i)=>[f,row[1][i]]));return{version:VERSION,language:lang,rank,label:row[0],weights,principles:lang==='ZH'?['Từ vựng/Hán tự theo bài đã học','Ngữ pháp và mẫu câu phải có giải thích','Đọc hiểu tăng dần theo Rank','Production chỉ dùng dữ liệu có đáp án kiểm chứng']:['Không dạy lại A1/A2/B1','B1+ là điểm xuất phát','B2 ưu tiên collocation, grammar, reading, writing và workplace','Production tăng dần theo Rank']}}
function vocabRows(lesson){return(Array.isArray(lesson?.vocabulary)?lesson.vocabulary:[]).map((v,i)=>({i,term:String(v?.[0]||'').trim(),pron:String(v?.[1]||'').trim(),meaning:String(v?.[2]||'').trim()})).filter(x=>x.term&&x.meaning)}
function examples(lesson){const direct=(lesson?.examples||[]).map(String).filter(Boolean),patterns=(lesson?.sentencePatterns||[]).map(x=>String(x?.[2]||'')).filter(Boolean);return uniq([...direct,...patterns])}
function meta(lesson,{family,archetype,dimension,sourceUnitId}){return{family,archetype,interaction:'choice',dimension,sourceLessonId:String(lesson?.id||''),sourceUnitId:String(sourceUnitId||''),generated:true,serverSafe:false,curriculumVersion:VERSION}}
function distract(rows,answer,key='term'){const values=uniq(rows.map(x=>x[key])).filter(x=>x!==String(answer));return shuffle(uniq([String(answer),...values.slice(0,6)])).slice(0,4)}
function derived(lesson,id,prompt,answer,options,m,explain){return{id:`aq2113:${lesson.id}:${id}`,lessonId:lesson.id,language:lesson.language,type:m.family==='Reading'?'reading':m.family==='Context'?'situation':'choice',prompt,answer,options,explain,academicMeta:meta(lesson,m)}}
function reclassify(q){const x={...q,academicMeta:{...(q.academicMeta||{})}},a=x.academicMeta;if(a.generated)return x;const t=String(x.type||'');if(t==='reading'){a.family='Reading';a.archetype='reading_detail';a.dimension='reading'}else if(t==='situation'){a.family='Context';a.archetype='situation_response';a.dimension='context'}else if(t==='sentence_transformation'){a.family='Grammar';a.archetype='choose_correct_sentence';a.dimension='grammar'}else if((t==='writing'||t==='written_production')&&Array.isArray(x.options)&&x.options.length){a.family='Production';a.archetype='controlled_sentence';a.dimension='production'}return x}
function augmentPool(lesson,pool){if(!lesson)return pool||[];const out=(pool||[]).map(reclassify),rows=vocabRows(lesson),exs=examples(lesson),terms=rows.map(x=>x.term),means=rows.map(x=>x.meaning);let added=0;
 for(let ei=0;ei<exs.length&&added<6;ei++){const sentence=exs[ei],hit=rows.find(v=>sentence.includes(v.term));if(!hit)continue;const termOptions=distract(rows,hit.term,'term');if(termOptions.length>=3){out.push(derived(lesson,`ctx${ei}:cloze`,`Điền từ/cụm phù hợp vào câu đã học: “${sentence.replace(hit.term,'＿＿＿')}”`,hit.term,termOptions,{family:'Context',archetype:'context_cloze',dimension:'context',sourceUnitId:`example:${ei}:${hit.term}`},`${hit.term}${hit.pron?` (${hit.pron})`:''} = ${hit.meaning}. Câu nguồn: ${sentence}`));added++}
  const meaningOptions=distract(rows,hit.meaning,'meaning');if(meaningOptions.length>=3&&added<6){out.push(derived(lesson,`ctx${ei}:meaning`,`Trong câu “${sentence}”, “${hit.term}” gần nghĩa nhất với đáp án nào?`,hit.meaning,meaningOptions,{family:'Context',archetype:'word_in_context',dimension:'context',sourceUnitId:`example:${ei}:${hit.term}:meaning`},`Trong đúng ngữ cảnh đã học: ${hit.term} = ${hit.meaning}.`));added++}}
 const seen=new Set;return out.filter(q=>{const id=String(q?.id||'');if(!id||seen.has(id))return false;seen.add(id);return q?.academicMeta?.sourceLessonId===String(lesson.id)})}
function dimScore(save,lang,dim){const n=Number(save?.learning?.academicDimensionMastery?.[lang]?.[dim]);return Number.isFinite(n)?clamp(n,0,100):50}
function planSession(save,lesson,pool,{min=30,max=40}={}){const p=profile(save,lesson),allowed=(pool||[]).filter(q=>(p.weights[q?.academicMeta?.family||'Recognition']||0)>0),lo=Math.max(1,Number(min)||1),hi=Math.max(lo,Number(max)||lo),target=Math.min(allowed.length,lo+Math.floor(Math.random()*(hi-lo+1))),groups=Object.fromEntries(FAMILIES.map(f=>[f,[]]));
 for(const q of shuffle(allowed)){const m=q.academicMeta||{},family=m.family||'Recognition',weak=100-dimScore(save,p.language,m.dimension||family.toLowerCase()),canonical=m.generated?0:10;q.__academicScore=weak+canonical+Math.random()*4;(groups[family]||(groups[family]=[])).push(q)}
 for(const f of FAMILIES)groups[f].sort((a,b)=>b.__academicScore-a.__academicScore);
 const totalWeight=FAMILIES.reduce((s,f)=>s+(groups[f]?.length?p.weights[f]:0),0)||1,out=[],used=new Set,sourceUse=new Map;
 const take=q=>{if(!q)return false;const m=q.academicMeta||{},key=`${m.sourceUnitId||q.id}|${m.archetype||q.type}`,source=String(m.sourceUnitId||q.id);if(used.has(key)||(sourceUse.get(source)||0)>=2)return false;used.add(key);sourceUse.set(source,(sourceUse.get(source)||0)+1);out.push(q);return true};
 for(const f of FAMILIES){const g=groups[f]||[];if(!g.length||!p.weights[f])continue;const quota=Math.max(1,Math.round(target*p.weights[f]/totalWeight));let n=0;for(const q of g){if(out.length>=target||n>=quota)break;if(take(q))n++}}
 const rest=FAMILIES.flatMap(f=>groups[f]||[]).sort((a,b)=>b.__academicScore-a.__academicScore);for(const q of rest){if(out.length>=target)break;take(q)}for(const q of allowed){try{delete q.__academicScore}catch(_){}}return out.slice(0,target)}
function auditLesson(save,lesson,pool=[]){const p=profile(save,lesson),aug=augmentPool(lesson,pool),counts=Object.fromEntries(FAMILIES.map(f=>[f,aug.filter(q=>q.academicMeta?.family===f).length])),archetypes=uniq(aug.map(q=>q.academicMeta?.archetype)),unseen=aug.filter(q=>q.academicMeta?.sourceLessonId!==String(lesson?.id||'')).length;return{version:VERSION,lessonId:String(lesson?.id||''),profile:p.label,total:aug.length,counts,archetypes,unseenSources:unseen,contextDerived:aug.filter(q=>String(q.id||'').startsWith('aq2113:')).length}}
window.POWDER_ACADEMIC_CONTENT_V2113={version:VERSION,families:()=>[...FAMILIES],profile,augmentPool,planSession,auditLesson};
})();
