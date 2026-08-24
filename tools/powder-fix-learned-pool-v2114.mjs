import fs from'node:fs';
{
 const f='js/learning-mastery-adaptive-v2114.js';let s=fs.readFileSync(f,'utf8');
 const old="if(!id||seen.has(id)||String(q.lessonId||m.sourceLessonId||'')!==String(lesson.id))continue;";
 const next="const lessonId=String(lesson.id),questionLessonId=String(q.lessonId||''),sourceLessonId=String(m.sourceLessonId||'');if(!id||seen.has(id)||(questionLessonId&&questionLessonId!==lessonId)||(sourceLessonId&&sourceLessonId!==lessonId)||(!questionLessonId&&!sourceLessonId))continue;";
 if(s.includes(old))s=s.replace(old,next);else if(!s.includes(next))throw new Error('learned-pool source guard anchor missing');
 fs.writeFileSync(f,s);
}
{
 const f='tools/powder-academic-content-gate-v2113.mjs';let s=fs.readFileSync(f,'utf8');
 const old="const mm=boot.match(/const MANIFEST=(\\[[\\s\\S]*?\\]);\\nconst SCRIPT_ORDER=/),om=boot.match(/const SCRIPT_ORDER=(\\[[\\s\\S]*?\\]);\\nconst TOTAL_BYTES=/);const manifest=mm?JSON.parse(mm[1]):[],order=om?JSON.parse(om[1]):[],ri=order.indexOf('js/learning-academic-content-v2113.js'),ei=order.indexOf('js/learning-question-engine-v2112.js'),ai=order.indexOf('js/app.js');ok('bootBinding',manifest.length===1295&&order.length===133&&manifest.some(x=>x.u==='js/learning-academic-content-v2113.js'&&x.k==='script')&&ri===ei-1&&ei===ai-1,{manifest:manifest.length,order:order.length,ri,ei,ai});";
 const next="const mm=boot.match(/const MANIFEST=(\\[[\\s\\S]*?\\]);\\nconst SCRIPT_ORDER=/),om=boot.match(/const SCRIPT_ORDER=(\\[[\\s\\S]*?\\]);\\nconst TOTAL_BYTES=/);const manifest=mm?JSON.parse(mm[1]):[],order=om?JSON.parse(om[1]):[],ri=order.indexOf('js/learning-academic-content-v2113.js'),ei=order.indexOf('js/learning-question-engine-v2112.js'),mi=order.indexOf('js/learning-mastery-adaptive-v2114.js'),ai=order.indexOf('js/app.js');ok('bootBinding',manifest.length===1296&&order.length===134&&manifest.some(x=>x.u==='js/learning-academic-content-v2113.js'&&x.k==='script')&&ri===ei-1&&ei===mi-1&&mi===ai-1,{manifest:manifest.length,order:order.length,ri,ei,mi,ai});";
 if(s.includes(old))s=s.replace(old,next);else if(!s.includes(next))throw new Error('academic-content boot binding anchor missing');
 fs.writeFileSync(f,s);
}
console.log(JSON.stringify({version:'21.1.4',patched:true,guards:['learned-only source provenance','21.1.3 strict boot compatibility']},null,2));
