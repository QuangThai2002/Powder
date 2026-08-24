import fs from'node:fs';
const f='js/learning-mastery-adaptive-v2114.js';
let s=fs.readFileSync(f,'utf8');
const old="if(!id||seen.has(id)||String(q.lessonId||m.sourceLessonId||'')!==String(lesson.id))continue;";
const next="const lessonId=String(lesson.id),questionLessonId=String(q.lessonId||''),sourceLessonId=String(m.sourceLessonId||'');if(!id||seen.has(id)||(questionLessonId&&questionLessonId!==lessonId)||(sourceLessonId&&sourceLessonId!==lessonId)||(!questionLessonId&&!sourceLessonId))continue;";
if(s.includes(old))s=s.replace(old,next);else if(!s.includes(next))throw new Error('learned-pool source guard anchor missing');
fs.writeFileSync(f,s);
console.log(JSON.stringify({version:'21.1.4',patched:true,guard:'question+source lesson must match learned lesson'},null,2));
