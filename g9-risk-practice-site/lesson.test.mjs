import test from 'node:test';
import assert from 'node:assert/strict';
import { lesson } from './lesson.js';
import { validateLesson } from './validate.js';
import { checkActivity } from './activity-check.js';
import { previewLesson, sampleState } from './preview-samples.js';
test('lesson has usable page IDs, fields and checks',()=>validateLesson(lesson));
test('repeated page IDs cannot overwrite answers',()=>{const bad=structuredClone(lesson);bad.sections.push(bad.sections[0]);assert.throws(()=>validateLesson(bad),/repeated/);});
test('invalid correct answer cannot ship',()=>{const bad=structuredClone(lesson);bad.sections.find(p=>p.kind==='choice').items[0].answer=-1;assert.throws(()=>validateLesson(bad),/invalid/);});
test('starter PDF prompts, compact visuals, and response-source mappings validate',()=>{
 const sample=lesson.sections.find(page=>page.kind==='choice' && page.items.length>1);
 assert.ok(sample);assert.doesNotThrow(()=>validateLesson(lesson));
 const bad=structuredClone(lesson);bad.sections.find(page=>page.kind==='choice').items[0].answer=-1;
 assert.throws(()=>validateLesson(bad),/invalid/);
});
test('activity check gives actionable teaching-order, wording, and paper-version findings',()=>{
 const bad=structuredClone(lesson);
 bad.sections=[bad.sections[1],bad.sections[0],...bad.sections.slice(2)];
 const checks=checkActivity(bad,'<title>Old activity</title>');
 assert.equal(checks.find(check=>check.name==='Teaching order').status,'fail');
 assert.match(checks.find(check=>check.name==='Paper version').detail,/npm run build/);
});
test('author preview samples are fictional and cover empty, partial, and filled states',()=>{
 const config=previewLesson(lesson);
 const empty=sampleState(config,'empty');
 const partial=sampleState(config,'partial');
 const filled=sampleState(config,'filled');
 assert.deepEqual(empty.identity,{});
 assert.equal(Object.keys(empty.choiceDrafts).length,0);
 assert.equal(partial.identity.firstName,'Sample');
 assert.ok(Object.keys(partial.responses).length>0 || Object.keys(partial.choiceDrafts).length>0);
 assert.ok(Object.keys(filled.responses).length>0);
 assert.ok(Object.keys(filled.choiceDrafts).length>=Object.keys(partial.choiceDrafts).length);
});
