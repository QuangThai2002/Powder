(()=>{'use strict';
const VERSION='21.1.8',E=window.POWDER_ENGINE,D=window.POWDER_DATA||{},Q=window.POWDER_LEARNING_QUESTION_ENGINE_V2112||null;
if(!E||typeof E.selectQuestions!=='function')return;
if(window.POWDER_EXPLANATION_COVERAGE_V2118?.version===VERSION)return;
// Design references: Moodle quiz feedback, Open edX problem feedback, Kolibri exercise feedback.
// Powder preserves canonical answers, options, grading, rewards, mastery, curriculum, SRS and Combat.
const previousSelect=E.selectQuestions.bind(E),previousSessionSelect=Q&&typeof Q.selectSessionQuestions==='function'?Q.selectSessionQuestions.bind(Q):null;
const trim=(v,n=420)=>{const s=String(v??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trimEnd()+'…':s};
const clone=q=>q&&typeof q==='object'?{...q,options:Array.isArray(q.options)?[...q.options]:q.options,academicMeta:q.academicMeta?{...q.academicMeta}:q.academicMeta,learningMeta:q.learningMeta?{...q.learningMeta}:q.learningMeta}:q;
const lessonOf=q=>(D.lessons||[]).find(l=>String(l?.id||'')===String(q?.lessonId||q?.academicMeta?.sourceLessonId||q?.learningMeta?.LessonID||''))||null;
const answerText=q=>Array.isArray(q?.answer)?q.answer.join(' · '):q?.answer&&typeof q.answer==='object'?Object.entries(q.answer).map(([k,v])=>`${k} → ${v}`).join(' · '):String(q?.answer??'').trim();
const norm=s=>String(s??'').toLocaleLowerCase('vi-VN').normalize('NFC');
function vocabContext(lesson,q){
 const rows=Array.isArray(lesson?.vocabulary)?lesson.vocabulary:[],hay=norm(`${q?.prompt||''} ${answerText(q)}`);
 let best=null;for(const row of rows){const term=String(row?.[0]||'').trim(),pron=String(row?.[1]||'').trim(),meaning=String(row?.[2]||'').trim();if(!term||!meaning)continue;let score=0;if(hay.includes(norm(term)))score+=3;if(hay.includes(norm(meaning)))score+=2;if(pron&&hay.includes(norm(pron)))score+=1;if(!best||score>best.score)best={score,term,pron,meaning}}
 if(!best||best.score<=0)return'';return `${best.term}${best.pron?` (${best.pron})`:''} = ${best.meaning}.`;
}
function patternContext(lesson,q){
 const rows=Array.isArray(lesson?.sentencePatterns)?lesson.sentencePatterns:[],hay=norm(`${q?.prompt||''} ${answerText(q)}`);
 let best=null;for(const row of rows){const pattern=String(row?.[0]||'').trim(),use=String(row?.[1]||'').trim(),example=String(row?.[2]||'').trim();if(!pattern||!use)continue;let score=0;if(hay.includes(norm(pattern)))score+=4;if(example&&hay.includes(norm(example)))score+=3;for(const token of pattern.split(/\s+/).filter(x=>x.length>1))if(hay.includes(norm(token)))score+=.25;if(!best||score>best.score)best={score,pattern,use,example}}
 if(!best||best.score<=0)return'';return `${best.pattern}: ${best.use}${best.example?` Ví dụ: ${best.example}`:''}.`;
}
function usageContext(lesson,q){
 const rows=Array.isArray(lesson?.usageNotes)?lesson.usageNotes:[],hay=norm(`${q?.prompt||''} ${answerText(q)}`);
 let best=null;for(const row of rows){const title=String(row?.[0]||'').trim(),body=String(row?.[1]||'').trim();if(!body)continue;let score=0;if(title&&hay.includes(norm(title)))score+=3;for(const token of title.split(/\s+/).filter(x=>x.length>2))if(hay.includes(norm(token)))score+=.5;if(!best||score>best.score)best={score,title,body}}
 if(!best||best.score<=0)return'';return `${best.title?best.title+': ':''}${best.body}`;
}
function fallbackExplanation(q){
 const existing=trim(q?.explain||q?.explanation||'');if(existing)return existing;
 const lesson=lessonOf(q),family=String(q?.academicMeta?.family||''),dimension=String(q?.academicMeta?.dimension||q?.learningMeta?.SkillType||'').toLowerCase(),answer=answerText(q);
 const vocab=vocabContext(lesson,q),pattern=patternContext(lesson,q),usage=usageContext(lesson,q);
 let text='';
 if(pattern&&(family==='Grammar'||dimension==='grammar'))text=pattern;
 else if(vocab&&['meaning','term','pinyin','hanzi','vocabulary'].some(x=>dimension.includes(x)))text=vocab;
 else if(usage&&(family==='Context'||family==='Application'||dimension==='context'))text=usage;
 else text=pattern||vocab||usage;
 if(!text&&answer)text=`Đáp án đúng là “${answer}”. Đối chiếu lại phần lý thuyết của Learning Unit này để ghi nhớ cách dùng trong ngữ cảnh.`;
 if(!text)text='Câu này dựa trên kiến thức đã học trong Learning Unit hiện tại. Hãy xem lại phần lý thuyết liên quan trước khi thử lại.';
 return trim(text);
}
function enrichQuestion(q){if(!q||typeof q!=='object')return q;const out=clone(q);if(!trim(out.explain||out.explanation||''))out.explain=fallbackExplanation(out);return out}
function enrichList(list){return Array.isArray(list)?list.map(enrichQuestion):list}
function selectWithExplanation(save,questions,count,options={}){return enrichList(previousSelect(save,questions,count,options))}
E.selectQuestions=selectWithExplanation;
if(Q&&previousSessionSelect)Q.selectSessionQuestions=function(save,lesson,pool,range){return enrichList(previousSessionSelect(save,lesson,pool,range))};
window.POWDER_EXPLANATION_COVERAGE_V2118={version:VERSION,fallbackExplanation,enrichQuestion,enrichList,vocabContext,patternContext,usageContext,previousSelect,previousSessionSelect,designReferences:['Moodle quiz feedback','Open edX problem feedback','Kolibri exercise feedback'],rulesPreserved:'answers, options, grading, rewards, mastery, curriculum, SRS eligibility and Combat unchanged'};
})();