import test from 'node:test';import assert from 'node:assert/strict';import {LearningSession} from '../js/learningResults/session.js';import {ScoredTimer} from '../js/learningResults/scoredTimer.js';
const task={id:'00000000-0000-4000-8000-000000000001',contractVersion:'learning-results-v1',activity:'quiz',sharedTargetMilliseconds:20000,words:[{id:'cat',word:'CAT',options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'}]};
async function fixture(){let saved=null,clock=0,active='owner',reject=false;const store={async commit(next,intents,rev=null){if(reject)throw new Error('disk full');assert.equal(saved?.localRevision??null,rev);saved=structuredClone(next);}};const session=await LearningSession.create({task,preparationId:'p',ownerUserId:'owner',seed:7,store,owner:()=>active,now:()=>clock});return {session,store,tick:n=>clock+=n,saved:()=>saved,owner:v=>active=v,reject:v=>reject=v};}
test('study and closed time excluded; resume preserves 12000+8000 milliseconds',async()=>{const f=await fixture();f.tick(5000);await f.session.resume();f.tick(12000);await f.session.pause();f.tick(18000000);const resumed=new LearningSession({attempt:f.saved(),store:f.store,owner:()=> 'owner',now:()=>0});assert.equal(resumed.timer.snapshot(),12000);await f.session.resume();f.tick(8000);await f.session.original('cat:0',{optionId:'yes'});assert.equal(f.saved().state.recordedMilliseconds,20000);assert.equal(f.session.preview().points,1000);});
test('failed persistence exposes no original; original cannot be rewritten',async()=>{const f=await fixture();await f.session.resume();f.reject(true);await assert.rejects(f.session.original('cat:0',{optionId:'yes'}),/disk full/);assert.deepEqual(f.session.attempt.state.originals,{});f.reject(false);await f.session.resume();await f.session.original('cat:0',{optionId:'no'});await assert.rejects(f.session.resume(),{code:'ORIGINAL_SET_LOCKED'});await assert.rejects(f.session.original('cat:0',{optionId:'yes'}),{code:'ORIGINAL_LOCKED'});assert.equal(f.session.preview().points,0);});
test('submission keeps attempt identity; owner change stops mutation',async()=>{const f=await fixture();await f.session.resume();await f.session.original('cat:0',{optionId:'yes'});const id=f.session.attempt.id;await f.session.submit();assert.equal(f.session.attempt.id,id);f.owner('other');await assert.rejects(f.session.pause(),{code:'OWNER_CHANGED'});});
test('repeated resume does not double count',()=>{let n=0;const t=new ScoredTimer({now:()=>n});t.resume();n=10;t.resume();n=20;assert.equal(t.pause(),20);n=100;assert.equal(t.snapshot(),20);t.resume();n=99;assert.throws(()=>t.snapshot(),{code:'INVALID_TIME'});});
test('invalid input keeps elapsed time and resumes the active clock',async()=>{
 const f=await fixture();await f.session.resume();f.tick(40);
 await assert.rejects(f.session.original('cat:0',{optionId:'missing'}),{code:'INVALID_OPTION'});
 f.tick(60);await f.session.original('cat:0',{optionId:'yes'});
 assert.equal(f.saved().state.recordedMilliseconds,100);
});
test('submission and its durable terminal intent commit together and prevent later edits',async()=>{
 const f=await fixture();await f.session.resume();await f.session.original('cat:0',{optionId:'yes'});
 let terminal;const originalCommit=f.store.commit;f.store.commit=async(next,intents,revision)=>{terminal=intents;await originalCommit(next,intents,revision);};
 await f.session.submit();assert.deepEqual(terminal.map(i=>i.kind),['checkpoint','submit']);
 assert.equal(f.saved().status,'submitted');await assert.rejects(f.session.resume(),{code:'ATTEMPT_FINISHED'});
});
test('reading answers stay editable until the whole check locks them in schedule order',async()=>{
 const f=await fixture();f.session.attempt.task.activity='reading-check';
 await f.session.resume();await f.session.draft({'cat:0':{optionId:'no'}});
 assert.deepEqual(f.session.outcomes(),[]);await assert.rejects(f.session.original('cat:0',{optionId:'yes'}),{code:'READING_SUBMISSION_REQUIRED'});
 await assert.rejects(f.session.submitReading({responses:{}}),{code:'INCOMPLETE_READING_CHECK'});
 assert.deepEqual(f.session.outcomes(),[]);
 const result=await f.session.submitReading({responses:{'cat:0':{optionId:'yes'}}});
 assert.equal(result.preview.points,1000);assert.equal(f.saved().status,'submitted');
 await assert.rejects(f.session.draft({}),{code:'ATTEMPT_FINISHED'});
});
test('Speed Match cannot advance past a wrong appearance until it is corrected',async()=>{
 const f=await fixture();f.session.attempt.task.activity='speed-match';
 await f.session.resume();await f.session.original('cat:0',{selectedWordId:null,missed:true});
 await assert.rejects(f.session.resume(),{code:'CORRECTION_REQUIRED'});
 await assert.rejects(f.session.submit(),{code:'REVIEW_REQUIRED'});
 await f.session.correct('cat:0','CAT');await f.session.submit();
 assert.equal(f.session.preview().points,0);
});
test('required corrections cannot raise the original speed bonus or points',async()=>{
 const words=Array.from({length:5},(_,i)=>({id:`word${i}`,word:`CAT${i}`,options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'}));
 const session=await LearningSession.create({task:{...task,words},preparationId:'p',ownerUserId:'owner',seed:1,store:{async commit(){}},owner:()=> 'owner',now:()=>0});
 for(const [index,opportunity] of session.attempt.schedule.entries()){await session.resume();await session.original(opportunity.id,{optionId:index===0?'no':'yes'});}
 const before=session.preview();assert.equal(before.finished,false);assert.equal(before.points,810);
 await session.correct(session.attempt.schedule[0].id,words.find(w=>w.id===session.attempt.schedule[0].wordId).word);const after=session.preview();assert.equal(after.finished,true);assert.equal(after.points,before.points);assert.deepEqual(after.speed,before.speed);
});

test('crossword submits all original answers in one durable commit with one shared timer value',async()=>{
 const {generateLayout}=await import('../js/learningResults/task.js');const words=[{id:'cat',word:'CAT'},{id:'art',word:'ART'}];const puzzle={...task,id:crypto.randomUUID(),activity:'crossword',words,variants:[generateLayout({words,activity:'crossword',seed:1})]};
 let stored=null,commits=0,clock=0,failCommit=false;const store={async commit(next,ops,revision=null){assert.equal(stored?.localRevision ?? null,revision);if(failCommit)throw new Error('disk full');commits++;stored=structuredClone(next);}};
 const session=await LearningSession.create({task:puzzle,preparationId:'p',ownerUserId:'owner',seed:7,store,owner:()=> 'owner',now:()=>clock});await session.resume();clock=1200;const before=commits;
 const responses=Object.fromEntries(session.attempt.schedule.map(o=>[o.id,{answer:words.find(w=>w.id===o.wordId).word}]));
 failCommit=true;await assert.rejects(session.submitPuzzle(responses),/disk full/);assert.equal(Object.keys(session.attempt.state.originals).length,0);failCommit=false;await session.submitPuzzle(responses);
 assert.equal(commits,before+1);const originals=session.attempt.events.filter(e=>e.type==='original');assert.equal(originals.length,2);assert.ok(originals.every(e=>e.recordedMilliseconds===1200));assert.equal(session.attempt.state.crosswordPhase,'correction');assert.equal(session.preview().points,1000);await assert.rejects(session.submitPuzzle(responses),{code:'ANSWER_NOT_USABLE'});
});
