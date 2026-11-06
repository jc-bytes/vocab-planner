import { writeFile } from 'node:fs/promises';
import { lesson } from './lesson.js';
import { validateLesson } from './validate.js';
validateLesson(lesson);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const line = label => `<p>${escape(label)}</p><p class="answer">________________________________________________________________</p>`;
const pages = lesson.sections.filter(p=>p.kind!=='review').map(p=>{
  let body=p.html || p.intro || '';
  body=body.replace(/<t3-check[^>]*>([\s\S]*?)<\/t3-check>/g,(_,content)=>content
    .replace(/<select\b[^>]*>[\s\S]*?<\/select>/g,'<span class="answer">________________________</span>')
    .replace(/<input\b[^>]*>/g,'<span class="answer">________________________</span>'));
  if(p.kind==='form')body+=p.fields.map(f=>line(f.label)).join('');
  if(p.kind==='choice')body+=p.items.map(q=>`${q.visual || ''}${line(q.question)}<p>${q.options.map(escape).join(' / ')}</p>`).join('');
  return `<section data-step="${escape(p.id)}"><h2>${escape(p.title)}</h2>${body}</section>`;
}).join('');
await writeFile(new URL('printable-fallback.html',import.meta.url),`<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(lesson.title)}</title><style>body{font:18px Arial;line-height:1.6;max-width:800px;margin:auto;padding:24px}table{border-collapse:collapse}th,td{border:1px solid;padding:8px}section{break-inside:avoid;margin:2em 0}.answer{white-space:normal}@media print{body{padding:0}}</style><h1>${escape(lesson.title)}</h1><p>Paper version for a school technology failure. Give this paper to your teacher.</p><p>First name: __________ Last name: __________ Grade: 9</p>${pages}</html>`);
