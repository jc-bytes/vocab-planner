import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lesson } from './lesson.js';
import { validateLesson } from './validate.js';
import { checkActivity } from './activity-check.js';
import { previewLesson, sampleState } from './preview-samples.js';
test('lesson has usable page IDs, fields and checks',()=>validateLesson(lesson));
test('repeated page IDs cannot overwrite answers',()=>{const bad=structuredClone(lesson);bad.sections.push(bad.sections[0]);assert.throws(()=>validateLesson(bad),/repeated/);});
test('assessment pages have case facts and response fields',()=>{
 const pages=lesson.sections.filter(page=>page.assessment);
 assert.equal(pages.length,3);
 for(const page of pages){
   assert.equal(page.kind,'form');
   assert.match(page.intro,/What happened/);
   assert.ok(page.fields.length>=3);
 }
 assert.doesNotThrow(()=>validateLesson(lesson));
});
test('activity check confirms the assessment paper version',()=>{
 const printable=readFileSync(new URL('./printable-fallback.html',import.meta.url),'utf8');
 const checks=checkActivity(lesson,printable);
 assert.equal(checks.find(check=>check.name==='Activity setup').status,'pass');
 assert.equal(checks.find(check=>check.name==='Paper version').status,'pass');
});
test('author preview samples are fictional and cover empty, partial, and filled states',()=>{
 const config=previewLesson(lesson);
 const empty=sampleState(config,'empty');
 const partial=sampleState(config,'partial');
 const filled=sampleState(config,'filled');
 assert.deepEqual(empty.identity,{});
 assert.equal(Object.keys(empty.choiceDrafts).length,0);
 assert.equal(partial.identity.firstName,'Sample');
 assert.ok(Object.keys(partial.responses).length>0);
  assert.ok(Object.keys(filled.responses).length>0);
 assert.ok(Object.keys(filled.responses).length>=Object.keys(partial.responses).length);
});
