import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherLearningSettings} from '../js/teacherLearningResultsSettings.js';
const source={kind:'assignment',id:crypto.randomUUID()};
function fixture(){let active='teacher';const calls=[];let response={status:'ok',source:{sourceDigest:'digest'},scoredContent:{words:[{id:'cat',word:'CAT'},{id:'art',word:'ART'}]},settings:{revision:4},students:[]};const repository={async read(...args){calls.push(['read',...args]);return response;},async operation(...args){calls.push(args);return {revision:5,taskId:'task'};}};const model=new TeacherLearningSettings({repository,owner:()=>active,source,grade:7,activity:'quiz',newSeed:()=>1});return {model,calls,repository,owner:value=>active=value};}
test('publication uses the authorized source digest and revision, with shared timing in milliseconds',async()=>{const f=fixture();await f.model.load();await f.model.publish({targetSeconds:90,appearances:5});const [kind,payload,owner]=f.calls.at(-1);assert.equal(kind,'settings');assert.equal(owner,'teacher');assert.equal(payload.expectedRevision,4);assert.equal(payload.sourceDigest,'digest');assert.equal(payload.sharedTargetMilliseconds,90000);assert.deepEqual(payload.source,source);assert.equal(f.model.snapshot.settings.revision,5);});
test('individual targets validate whole percentages and preserve removal revisions',async()=>{const f=fixture();await assert.rejects(f.model.setTarget({studentId:'pupil',target:80.5}),{code:'INVALID_INTEGER'});await assert.rejects(f.model.setTarget({studentId:'pupil',target:0}),{code:'INVALID_INTEGER'});await f.model.setTarget({studentId:'pupil',target:null,expectedRevision:4});assert.equal(f.calls.at(-1)[1].target,null);assert.equal(f.calls.at(-1)[1].expectedRevision,4);});
test('account changes discard late teacher settings and target responses',async()=>{const f=fixture();f.repository.read=async()=>{f.owner('other');return {};};await assert.rejects(f.model.load(),{code:'OWNER_CHANGED'});f.owner('teacher');f.repository.operation=async()=>{f.owner('other');return {};};await assert.rejects(f.model.setTarget({studentId:'pupil',target:80}),{code:'OWNER_CHANGED'});});
test('puzzle publication sends a complete locally validated candidate and never drops words',async()=>{const f=fixture();f.model.activity='crossword';await f.model.load();await f.model.publish({targetSeconds:120});const candidate=f.calls.at(-1)[1].layoutCandidates[0];assert.equal(candidate.placements.length,2);assert.deepEqual(new Set(candidate.placements.map(p=>p.wordId)),new Set(['cat','art']));});

test('teacher values reject fractional shared seconds before sending any write',async()=>{const f=fixture();await f.model.load();await assert.rejects(f.model.publish({targetSeconds:2.5}),{code:'INVALID_INTEGER'});assert.equal(f.calls.filter(c=>c[0]==='settings').length,0);});

test('oversized publication preserves saved settings and sends no write',async()=>{
 const f=fixture();f.model.activity='matching';await f.model.load();
 f.model.snapshot.scoredContent.words=Array.from({length:50},(_,i)=>({id:`term-${i}`,word:`Term ${i}`}));
 await f.model.publish({targetSeconds:90,appearances:5});
 const saved=structuredClone(f.model.snapshot.settings),writes=f.calls.length;
 await assert.rejects(f.model.publish({targetSeconds:90,appearances:6}),{code:'TASK_CAPACITY_EXCEEDED'});
 assert.equal(f.calls.length,writes);assert.deepEqual(f.model.snapshot.settings,saved);
});
