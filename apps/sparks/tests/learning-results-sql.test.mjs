import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningPostgres} from './helpers/learningPostgres.mjs';
import {calculateResult,fraction,normalizeSpelling,spellingCredit} from '../js/learningResults/scoring.js';
import {canonical,sha256,bytes,byteLength} from '../js/learningResults/contract.js';
let db,resultsTask,resultsPreparation;
const user='00000000-0000-4000-8000-000000000001',school='00000000-0000-4000-8000-000000000002',taskId='00000000-0000-4000-8000-000000000003',preparation='00000000-0000-4000-8000-000000000004',attemptId='00000000-0000-4000-8000-000000000005';
before(async()=>{
 ({db}=await createLearningPostgres());
 await db.exec(`alter table auth.users disable trigger user;
 insert into auth.users(id,email) values('${user}','learning@example.invalid');
 alter table auth.users enable trigger user;
 insert into public.schools(id,name) values('${school}','Isolated learning test');
 insert into public.profiles(user_id,email) values('${user}','learning@example.invalid');
 insert into public.teacher_subjects(id,owner_id,school_id,name) values('${school}','${user}','${school}','Technology');
 insert into public.vocabularies(id,school_id,teacher_subject_id) values('learning-vocabulary','${school}','${school}');
 insert into public.weekly_sparks(id,school_id,teacher_subject_id) values('learning-reading','${school}','${school}');
 insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id)
 values('${taskId}','${school}',7,'reading','reading-check',repeat('0',64),'{}','${user}');
 insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,spark_id,target,target_source,manifest_hash,start_context)
 values('${preparation}','${user}','${taskId}','spark:learning-reading','spark:learning-reading','learning-reading',80,'{}',repeat('0',64),'{}');
 begin;
 insert into private.learning_result_attempts(id,user_id,preparation_id,task_id,context_key,unit_key,spark_id,activity_type,compatibility_attempt_id,kind,target,schedule,seed,start_context,prefix_hash,state_hash)
 values('${attemptId}','${user}','${preparation}','${taskId}','spark:learning-reading','spark:learning-reading','learning-reading','reading-check','${attemptId}','ranked_full',80,'[]',1,'{}',repeat('0',64),repeat('0',64));
 insert into private.student_activity_attempts(id,user_id,spark_id,unit_key,activity_type,record_protocol,learning_attempt_id)
 values('${attemptId}','${user}','learning-reading','spark:learning-reading','reading-check','learning-results-v1','${attemptId}');
 commit;`);
});
after(async()=>{await db?.close();});
test('all application migrations compile and reading compatibility needs no fabricated assignment or vocabulary',async()=>{
 const {rows}=await db.query('select vocabulary_id,spark_id,assignment_id from private.student_activity_attempts where id=$1',[attemptId]);
 assert.deepEqual(rows,[{vocabulary_id:null,spark_id:'learning-reading',assignment_id:null}]);
});
test('SQL score and spelling are identical to device calculations at boundaries',async()=>{
 for(const [n,d,t,target,passing,finished] of [[4,5,10000,10000,80,true],[4,5,15000,10000,90,true],[1,1,10001,10000,100,true],[79,100,0,10000,1,true],[1,1,0,10000,100,false],[2,3,1234,10000,67,true]]) {
  const score=calculateResult({outcomes:[{opportunityId:'a',wordId:'a',credit:fraction(n,d),assisted:false}],scheduled:[{id:'a',wordId:'a'}],recordedMilliseconds:t,sharedTargetMilliseconds:target,passingTarget:passing,finished});
  const {rows:[{result}]}=await db.query('select private.learning_score_v1($1,$2,$3,$4,$5,$6) result',[n,d,t,target,passing,finished]);
  assert.equal(result.points,score.points);assert.equal(result.stars,score.stars);assert.equal(result.passed,score.passed);assert.deepEqual(result.speed,score.speed);
 }
 for(const [expected,answer,assisted] of [['CAT','',false],['CAT','CXT',false],['A‐b C‑D- ẞ É','abcdßé',true],['CAT','CATS',false]]) {
  const {rows:[row]}=await db.query('select private.learning_normalize_spelling_v1($1) normalized,private.learning_spelling_credit_v1($1,$2,$3) credit',[expected,answer,assisted]);
  assert.equal(row.normalized,normalizeSpelling(expected));const credit=spellingCredit(expected,answer,assisted);
  assert.deepEqual(row.credit,{numerator:String(credit.n),denominator:String(credit.d)});
 }
});
test('SQL canonical bytes and hash agree with the device including non-ASCII key ordering',async()=>{
 const value={'😀':'quote"slash\\\n','é':null,z:[0,true],a:{'𐀀':3,'\uE000':2}};
 const {rows:[row]}=await db.query('select private.learning_json_canonical_v1($1::json) canonical, private.learning_sha256_v1(convert_to(private.learning_json_canonical_v1($1::json),\'UTF8\')) hash',[JSON.stringify(value)]);
 assert.equal(row.canonical,canonical(value));assert.equal(row.hash,await sha256(bytes(value)));
});

test('large canonical strings preserve every control escape, quotes, slashes and Unicode',async()=>{
 const controls=Array.from({length:31},(_,i)=>String.fromCharCode(i+1)).join('');
 const value={payload:('é😀\\"'+controls).repeat(1500),empty:'',literalEscape:'\\u000a'};
 const result=(await db.query('select private.learning_json_canonical_v1($1::json) value',[JSON.stringify(value)])).rows[0].value;
 assert.equal(result,canonical(value));
});

test('typed learning protocol and frozen attempt sources cannot be changed',async()=>{
 await assert.rejects(db.query("update private.student_activity_attempts set record_protocol='legacy',learning_attempt_id=null where id=$1",[attemptId]),/IMMUTABLE_ATTEMPT_PROTOCOL/);
 await assert.rejects(db.query("update private.learning_result_attempts set target=1 where id=$1",[attemptId]),/IMMUTABLE_ATTEMPT_IDENTITY/);
 await assert.rejects(db.query("update private.learning_result_preparations set target=1 where id=$1",[preparation]),/IMMUTABLE_LEARNING_RECORD/);
});
test('actual legacy mutation definitions reject learning attempts before touching rewards',async()=>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await assert.rejects(db.query('select private.assert_legacy_activity_attempt_v1($1)',[attemptId]),/LEARNING_RESULT_WRITE_REQUIRED/);
 const {rows}=await db.query(`select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname in ('submit_student_activity_progress_v2','submit_student_activity_progress_v3','submit_student_activity_progress_v3_strict_legacy','report_student_activity_time_v1')`);
 assert.equal(rows.length,4);
 for(const row of rows) assert.match(row.definition,/perform private.assert_legacy_activity_attempt_v1\(p_attempt_id::text\)/);
 const {rows:[{definition}]}=await db.query("select pg_get_functiondef('private.award_uncapped_student_activity_xp()'::regprocedure) definition");
 assert.match(definition,/if new.record_protocol = 'learning-results-v1' then return new; end if/);
});
test('authenticated role has no direct write or trusted-helper execution rights',async()=>{
 const {rows}=await db.query(`select tablename,has_table_privilege('authenticated',format('%I.%I',schemaname,tablename),'INSERT,UPDATE,DELETE') can_write from pg_tables
 where schemaname='private' and (tablename like 'learning_result%' or tablename='learning_unicode_lowercase_v1')`);
 assert.ok(rows.length>=13);assert.ok(rows.every(row=>!row.can_write));
 const {rows:[row]}=await db.query("select has_function_privilege('authenticated','private.learning_score_v1(numeric,numeric,bigint,integer,integer,boolean)','EXECUTE') can_execute");
 assert.equal(row.can_execute,false);
});
import {deriveOutcome,ADAPTER_ACTIVITIES} from '../js/learningResults/adapters.js';
import {makeSchedule,generateLayout} from '../js/learningResults/task.js';
test('server response derivation agrees with each activity adapter',async()=>{
 const word={id:'cat',word:'CAT',options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'},other={id:'bat',word:'BAT'},opportunity={id:'cat:0',wordId:'cat'};
 for(const activity of ADAPTER_ACTIVITIES) {
  const variants=activity==='word-search'?[generateLayout({words:[word],activity,seed:4,variantId:'00000000-0000-4000-8000-000000000099'})]:[];
  const path=variants.length?variants[0].placements[0]:null;
  const directions={N:[-1,0],NE:[-1,1],E:[0,1],SE:[1,1],S:[1,0],SW:[1,-1],W:[0,-1],NW:[-1,-1]};
  const response=activity==='wordle'?{guesses:['dog','cat']}:activity==='hangman'?{letters:['c','a','t']}:activity==='matching'?{selectedDefinitionId:'bat'}:activity==='speed-match'?{selectedWordId:'cat',missed:false}:activity==='word-search'?{variantId:variants[0].variantId,path:[0,1,2].map(i=>[path.startRow+i*directions[path.direction][0],path.startColumn+i*directions[path.direction][1]])}:['flashcards','quiz','synonym-antonym','reading-check'].includes(activity)?{optionId:'yes'}:{answer:'CXT'};
  const task={activity,words:[word,other],variants};
  for(const assisted of [false,true]) {
   const local=deriveOutcome(task,opportunity,response,assisted);
   const {rows:[{outcome}]}=await db.query('select private.learning_response_credit_v1($1,$2,$3,$4) outcome',[task,opportunity,response,assisted]);
   assert.equal(outcome.correct,local.correct,activity);
   assert.deepEqual(outcome.credit,{numerator:String(local.credit.n),denominator:String(local.credit.d)},activity);
  }
 }
});
test('server schedule matches device shuffle across seeds, rounds and Unicode IDs',async()=>{
 for(const seed of [1,7,2147483648,4294967295]) {
  const task={activity:'matching',appearances:5,words:[{id:'😀'},{id:'\uE000'},{id:'cat'},{id:'bat'}]};
  const {rows:[{schedule}]}=await db.query('select private.learning_schedule_v1($1,$2) schedule',[task,seed]);
  assert.deepEqual(schedule,makeSchedule(task,seed));
 }
});
import 'fake-indexeddb/auto';
import {ImageDB} from '../js/db.js';
import {LearningStore} from '../js/learningResults/store.js';
import {LearningSession} from '../js/learningResults/session.js';
import {LearningSync} from '../js/learningResults/sync.js';
import {deleteDB} from 'idb';
test('device session claims and appends evidence through the actual SQL functions with receipt replay',async()=>{
 const task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'quiz',sharedTargetMilliseconds:10000,words:[{id:'cat',word:'CAT',options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'}]},preparationId=crypto.randomUUID();
 resultsTask=task;resultsPreparation=preparationId;
 await db.query("insert into public.school_memberships(school_id,user_id,grade) values($1,$2,'7')",[school,user]);
 await db.query("insert into public.school_member_roles(school_id,user_id,role) values($1,$2,'student')",[school,user]);
 await db.query("insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id) values($1,$2,7,'vocabulary','quiz',$3,$4,$5)",[task.id,school,await sha256(bytes(task)),task,user]);
 await db.query("insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,vocabulary_id,target,target_source,manifest_hash,start_context) values($1,$2,$3,'vocabulary:learning-vocabulary','vocabulary:learning-vocabulary','learning-vocabulary',80,'{}',$4,'{}')",[preparationId,user,task.id,await sha256(bytes(task))]);
 const database=new ImageDB();database.dbName=`sql-evidence-${crypto.randomUUID()}`;
 const store=new LearningStore({database,activeOwner:()=>user});let lose=true;
 const repository={async mutate(kind,args,owner){
  const name=kind==='claim'?'learning_claim_v1':kind==='submit'?'learning_submit_v1':'learning_checkpoint_v1';
  const {rows:[{result}]}=await db.query(`select private.${name}($1,$2,$3) result`,[owner,args.p_operation_id,args.p_payload]);
  if(kind==='checkpoint' && lose){lose=false;throw new Error('lost acknowledgement');}return result;
 }};
 try {
  const session=await LearningSession.create({task,preparationId,ownerUserId:user,seed:1,startContext:{},store,owner:()=>user});
  await session.resume();await session.original('cat:0',{optionId:'yes'});
  const sync=new LearningSync({store,repository,activeOwner:()=>user});
  await assert.rejects(sync.drain(user),/lost acknowledgement/);await sync.drain(user);
  await session.submit();await sync.drain(user);
  const saved=await store.get('learningAttempts',user,session.attempt.id);
  assert.equal(saved.confirmed,true);assert.equal(saved.result.points,1000);assert.equal(saved.result.rewards.coins,50);assert.equal(saved.serverHead.sequence,3);assert.equal(saved.serverHead.hash,session.attempt.prefixHash);
  assert.equal((await store.list('learningOutbox',user)).filter(op=>op.kind==='checkpoint').reduce((sum,op)=>sum+(op.response?.rewards?.coins || 0),0),10);
  const compatibility=(await db.query('select finished_at,completed_at,mastered from private.student_activity_attempts where id=$1',[session.attempt.id])).rows[0];assert.ok(compatibility.finished_at);assert.ok(compatibility.completed_at);assert.equal(compatibility.mastered,true);
  const {rows:[{count}]}=await db.query('select count(*)::integer count from private.learning_result_evidence where attempt_id=$1',[session.attempt.id]);assert.equal(count,3);
  const {rows:[{count:receipts}]}=await db.query('select count(*)::integer count from private.learning_result_receipts where user_id=$1',[user]);assert.equal(receipts,4);
  const terminal=(await store.list('learningOutbox',user)).find(op=>op.kind==='submit');
  const beforeReplay=(await db.query('select coins,total_xp from public.student_progress_summary where user_id=$1',[user])).rows[0];
  const counters=async()=>(await db.query('select finished_runs,mastered_runs,lifetime_correct,lifetime_attempted,latest_attempt_id,best_attempt_id from public.student_activity_progress where user_id=$1 and unit_key=$2 and activity_type=$3',[user,session.attempt.startContext?.contextKey || 'vocabulary:learning-vocabulary','quiz'])).rows[0];
  const beforeCounters=await counters();assert.equal(beforeCounters.finished_runs,1);assert.equal(beforeCounters.mastered_runs,1);assert.equal(beforeCounters.lifetime_correct,1);assert.equal(beforeCounters.lifetime_attempted,1);assert.equal(beforeCounters.latest_attempt_id,session.attempt.id);assert.equal(beforeCounters.best_attempt_id,session.attempt.id);
  await repository.mutate('submit',terminal.request,user);assert.deepEqual(await counters(),beforeCounters);
  assert.deepEqual((await db.query('select coins,total_xp from public.student_progress_summary where user_id=$1',[user])).rows[0],beforeReplay);
 }finally{await database.close();await deleteDB(database.dbName);}
});
test('full replay preserves first-answer partial credit and rejects help or timer rewrites',async()=>{
 const task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'fill-in-blank',sharedTargetMilliseconds:10000,words:[{id:'cat',word:'CAT'}]};
 let clock=0;const store={async commit(){}};
 const session=await LearningSession.create({task,preparationId:crypto.randomUUID(),ownerUserId:user,seed:1,store,owner:()=>user,now:()=>clock});
 await session.resume();clock=1000;await session.original('cat:0',{answer:'CXT'});clock=50000;await session.correct('cat:0','CAT');await session.submit();
 const evaluate=async events=>(await db.query('select private.learning_evaluate_v1($1,$2,$3,80) result',[task,session.attempt.schedule,events])).rows[0].result;
 const actual=await evaluate(session.attempt.events),preview=session.preview();
 assert.equal(actual.points,preview.points);assert.deepEqual(actual.weighted,preview.weighted);assert.equal(actual.recordedMilliseconds,1000);assert.equal(actual.finished,true);
 const forged=structuredClone(session.attempt.events);forged.find(e=>e.type==='original').assisted=true;
 await assert.rejects(evaluate(forged),/ASSISTANCE_MISMATCH/);
 const chargedReview=structuredClone(session.attempt.events);chargedReview.find(e=>e.type==='correction').recordedMilliseconds=2000;
 await assert.rejects(evaluate(chargedReview),/INVALID_TIME/);
});
test('reading replay scores locked choices in question order and excludes writing time',async()=>{
 const task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'reading-check',sharedTargetMilliseconds:10000,words:[{id:'q1',word:'Question one',options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'},{id:'q2',word:'Question two',options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'}]};
 let clock=0;const session=await LearningSession.create({task,preparationId:crypto.randomUUID(),ownerUserId:user,seed:1,store:{async commit(){}},owner:()=>user,now:()=>clock});
 await session.resume();clock=1000;await session.setPhase('writing');clock=100000;
 await session.submitReading({responses:{'q1:0':{optionId:'no'},'q2:0':{optionId:'yes'}}});
 const {rows:[{result}]}=await db.query('select private.learning_evaluate_v1($1,$2,$3,80) result',[task,session.attempt.schedule,session.attempt.events]);
 assert.equal(result.points,475);assert.equal(result.recordedMilliseconds,1000);assert.equal(result.finished,true);assert.equal(result.passed,false);
});
test('calling every retained legacy leaf rejects learning writes and leaves wallet and XP unchanged',async()=>{
 const snapshot=async()=>(await db.query(`select (select coalesce(sum(coins),0)::integer from public.student_progress_summary where user_id=$1) coins,
  (select count(*)::integer from public.student_coin_ledger where user_id=$1) ledger,(select count(*)::integer from public.student_xp_events where user_id=$1) xp`,[user])).rows[0];
 const before=await snapshot();
 for(const name of ['submit_student_activity_progress_v2','submit_student_activity_progress_v3','submit_student_activity_progress_v3_strict_legacy']) {
  await assert.rejects(db.query(`select private.${name}(p_event_id=>'forged-learning-write',p_unit_key=>'spark:learning-reading',p_unit_context=>'{}',p_activity_type=>'reading-check',p_score=>100,p_attempt_id=>$1)`,[attemptId]),/LEARNING_RESULT_WRITE_REQUIRED/);
 }
 await assert.rejects(db.query('select private.report_student_activity_time_v1($1,100)',[attemptId]),/LEARNING_RESULT_WRITE_REQUIRED/);
 await db.query('update private.student_activity_attempts set completed_at=now() where id=$1',[attemptId]);
 assert.deepEqual(await snapshot(),before);
});
async function completeQuiz(milliseconds=20000,{option='yes',predecessorAttemptId=null,preparationId=resultsPreparation,startContext={},assisted=false,passingTarget=80,kind='ranked_full'}={}) {
 const database=new ImageDB();database.dbName=`quiz-rewards-${crypto.randomUUID()}`;const store=new LearningStore({database,activeOwner:()=>user});let clock=0;
 const repository={async mutate(kind,args,owner){const name={claim:'learning_claim_v1',checkpoint:'learning_checkpoint_v1',submit:'learning_submit_v1'}[kind];return (await db.query(`select private.${name}($1,$2,$3) result`,[owner,args.p_operation_id,args.p_payload])).rows[0].result;}};
 try {
  const session=await LearningSession.create({task:resultsTask,preparationId,ownerUserId:user,seed:1,startContext,predecessorAttemptId,passingTarget,kind,store,owner:()=>user,now:()=>clock});
  if(assisted)await session.assist(['cat:0']);
  await session.resume();clock=milliseconds;await session.original('cat:0',{optionId:option});if(option==='no')await session.correct('cat:0','CAT');await session.submit();
  await new LearningSync({store,repository,activeOwner:()=>user}).drain(user);
  return (await store.get('learningAttempts',user,session.attempt.id)).result;
 }finally{await database.close();await deleteDB(database.dbName);}
}
test('optional retries preserve best score, give no repeated coins and retain repeatable XP',async()=>{
 const result=await completeQuiz();assert.equal(result.points,950);assert.equal(result.rewards.coins,0);
 const {rows:[{xp}]}=await db.query("select private.student_activity_xp_amount('quiz') xp");assert.equal(result.rewards.xp,xp);
 const {rows:[best]}=await db.query('select points,recorded_milliseconds from private.learning_result_board_entries where task_id=$1',[resultsTask.id]);
 assert.equal(best.points,1000);assert.ok(best.recorded_milliseconds<20000);
 const {rows:[progress]}=await db.query("select score,is_complete,completion_semantics from public.student_activity_progress where user_id=$1 and unit_key='vocabulary:learning-vocabulary' and activity_type='quiz'",[user]);
 assert.deepEqual(progress,{score:'100',is_complete:true,completion_semantics:'explicit'});
});
test('required first-completion uniqueness suppresses repeat XP without changing the coin schedule',async()=>{
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 await db.query(`update public.vocabularies set activity_settings='{"requiredActivities":["flashcards","quiz"]}' where id='learning-vocabulary'`);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 const first=await completeQuiz(),second=await completeQuiz();
 assert.equal(first.rewards.coins,0);assert.ok(first.rewards.xp>0);assert.deepEqual(second.rewards,{coins:0,xp:0});
});
test('board query returns rank and requires refresh after a name changes',async()=>{
 const read=async payload=>(await db.query('select private.learning_board_v1($1,$2) board',[user,JSON.stringify(payload)])).rows[0].board;
 const original=await read({taskId:resultsTask.id});assert.equal(original.status,'ok');assert.equal(original.entries[0].rank,1);
 const entry=original.entries[0],cursor={points:entry.points,recordedMilliseconds:entry.recordedMilliseconds,sortName:entry.name.toLowerCase(),userId:entry.userId};
 await db.query("update public.profiles set first_name='Renamed' where user_id=$1",[user]);
 const stale=await read({taskId:resultsTask.id,cursor,boardRevision:original.boardRevision,orderingDigest:original.orderingDigest});
 assert.equal(stale.status,'refresh_required');
 const refreshed=await read({taskId:resultsTask.id});assert.equal(refreshed.boardRevision,original.boardRevision);assert.notEqual(refreshed.orderingDigest,original.orderingDigest);
 await db.query('update public.profiles set first_name=$2,last_name=$3 where user_id=$1',[user,'A\"\\\nE\u0301','Z']);
 const escaped=await read({taskId:resultsTask.id});
 const projection=escaped.entries.map(row=>({attemptId:row.attemptId,name:row.name,points:row.points,recordedMilliseconds:row.recordedMilliseconds,sortName:row.name.normalize('NFC').replace(/[A-Z]/g,c=>c.toLowerCase()),userId:row.userId})).sort((a,b)=>a.userId.localeCompare(b.userId));
 assert.equal(escaped.orderingDigest,await sha256(bytes(projection)),'SQL board digest must use exact canonical bytes including escaped names and NFC/ASCII sorting');
 const emptyBoard=await read({taskId:taskId});assert.equal(emptyBoard.status,'ok');assert.deepEqual(emptyBoard.entries,[]);
});
async function copyPreparation({context='vocabulary:learning-vocabulary',startContext={}}={}) {
 const id=crypto.randomUUID();await db.query(`insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,vocabulary_id,target,target_source,manifest_hash,start_context)
 select $1,user_id,task_id,$2,$2,vocabulary_id,target,target_source,manifest_hash,$3 from private.learning_result_preparations where id=$4`,[id,context,startContext,resultsPreparation]);return id;
}
async function supportState(){return (await db.query("select help,failures,pass_event_id from private.learning_result_support where user_id=$1 and context_key='vocabulary:learning-vocabulary' and activity_type='quiz'",[user])).rows[0];}
test('uncertain failures keep help clear; two clearly post-pass failures reactivate it and a pass resets it',async()=>{
 await completeQuiz(1000,{option:'no'});await completeQuiz(1000,{option:'no'});
 let support=await supportState();assert.equal(support.help,false);assert.deepEqual(support.failures,[]);
 const startContext={passEventId:support.pass_event_id},preparationId=await copyPreparation({startContext});
 await completeQuiz(1000,{option:'no',preparationId,startContext});support=await supportState();assert.equal(support.help,false);assert.equal(support.failures.length,1);
 await completeQuiz(1000,{option:'no',preparationId,startContext});support=await supportState();assert.equal(support.help,true);assert.equal(support.failures.length,2);
 await completeQuiz();support=await supportState();assert.equal(support.help,false);assert.deepEqual(support.failures,[]);
 await completeQuiz(1000,{option:'no',preparationId,startContext});assert.equal((await supportState()).help,false);
});
test('a pass arriving after its two proven successor failures produces the same help state',async()=>{
 const database=new ImageDB();database.dbName=`causal-pass-${crypto.randomUUID()}`;const store=new LearningStore({database,activeOwner:()=>user});
 const repository={async mutate(kind,args,owner){const name={claim:'learning_claim_v1',checkpoint:'learning_checkpoint_v1',submit:'learning_submit_v1'}[kind];return (await db.query(`select private.${name}($1,$2,$3) result`,[owner,args.p_operation_id,args.p_payload])).rows[0].result;}};
 try {
  const session=await LearningSession.create({task:resultsTask,preparationId:resultsPreparation,ownerUserId:user,seed:1,startContext:{},store,owner:()=>user});
  const sync=new LearningSync({store,repository,activeOwner:()=>user});await session.resume();await sync.drain(user);
  const first=await completeQuiz(1000,{option:'no',predecessorAttemptId:session.attempt.id});
  await completeQuiz(1000,{option:'no',predecessorAttemptId:first.attemptId});assert.equal((await supportState()).help,false);
  await session.original('cat:0',{optionId:'yes'});await session.submit();await sync.drain(user);
  const support=await supportState();assert.equal(support.help,true);assert.equal(support.failures.length,2);
 }finally{await database.close();await deleteDB(database.dbName);}
});
test('failure after reward insertion rolls finalization back and the frozen request can retry safely',async()=>{
 const preparationId=await copyPreparation({context:'vocabulary:learning-rollback'}),database=new ImageDB();database.dbName=`rollback-${crypto.randomUUID()}`;
 const store=new LearningStore({database,activeOwner:()=>user}),repository={async mutate(kind,args,owner){const name={claim:'learning_claim_v1',checkpoint:'learning_checkpoint_v1',submit:'learning_submit_v1'}[kind];return (await db.query(`select private.${name}($1,$2,$3) result`,[owner,args.p_operation_id,args.p_payload])).rows[0].result;}};
 try {
  const session=await LearningSession.create({task:resultsTask,preparationId,ownerUserId:user,seed:1,startContext:{},store,owner:()=>user});
  await session.resume();await session.original('cat:0',{optionId:'yes'});
  const sync=new LearningSync({store,repository,activeOwner:()=>user});await sync.drain(user);
  await session.submit();
  const before=(await db.query('select coins,total_xp from public.student_progress_summary where user_id=$1',[user])).rows[0];
  await db.exec(`create function private.learning_test_fail_after_awards() returns trigger language plpgsql as $$begin raise exception 'injected after awards';end$$;
   create trigger learning_test_fail_after_awards before update on public.student_progress_summary for each row execute function private.learning_test_fail_after_awards();`);
  await assert.rejects(sync.drain(user),/injected after awards/);
  assert.deepEqual((await db.query('select coins,total_xp from public.student_progress_summary where user_id=$1',[user])).rows[0],before);
  const {rows:[row]}=await db.query(`select a.completed_at,l.bridge_revision,l.completion_applied_at,(select count(*)::integer from private.learning_result_results where attempt_id=a.id and validation_status='validated') results,
   (select count(*)::integer from public.student_coin_ledger where event_key like 'learning:'||a.id::text||':%') ledger,
   (select count(*)::integer from public.student_xp_events where attempt_id=a.id::text) xp from private.student_activity_attempts a join private.learning_result_attempts l on l.id=a.id where a.id=$1`,[session.attempt.id]);
  assert.equal(row.completed_at,null);assert.equal(row.completion_applied_at,null);assert.ok(row.bridge_revision>0);assert.equal(row.results,0);assert.equal(row.ledger,1);assert.equal(row.xp,0);
  await db.exec('drop trigger learning_test_fail_after_awards on public.student_progress_summary;drop function private.learning_test_fail_after_awards();');
  await sync.drain(user);const saved=await store.get('learningAttempts',user,session.attempt.id);assert.equal(saved.confirmed,true);assert.equal(saved.result.rewards.coins,50);
 }finally{
  await db.exec('drop trigger if exists learning_test_fail_after_awards on public.student_progress_summary;drop function if exists private.learning_test_fail_after_awards();');
  await database.close();await deleteDB(database.dbName);
 }
});
test('coverage 100 below target does not earn completion, and a later pass earns the first bonus once',async()=>{
 const context='vocabulary:learning-explicit-completion',preparationId=await copyPreparation({context});
 const failed=await completeQuiz(1000,{preparationId,assisted:true,passingTarget:1});
 assert.equal(failed.passed,false);assert.equal(failed.eligible,true);assert.equal(failed.points,475);assert.deepEqual(failed.rewards,{coins:0,xp:0});
 const progress=async()=>(await db.query("select score,is_complete,completion_semantics,plays,total_earned from public.student_activity_progress where user_id=$1 and unit_key=$2 and activity_type='quiz'",[user,context])).rows[0];
 assert.deepEqual(await progress(),{score:'100',is_complete:false,completion_semantics:'explicit',plays:0,total_earned:10});
 const passed=await completeQuiz(1000,{preparationId});assert.equal(passed.rewards.coins,50);assert.ok(passed.rewards.xp>0);
 await completeQuiz(1000,{preparationId,option:'no'});const retained=await progress();assert.equal(retained.is_complete,true);assert.equal(retained.total_earned,60);assert.equal(retained.plays,1);
});
test('two initial failures trigger help, and a passing full attempt clears and resets the counter',async()=>{
 const context='vocabulary:learning-first-failures',preparationId=await copyPreparation({context});
 await completeQuiz(1000,{preparationId,option:'no'});await completeQuiz(1000,{preparationId,option:'no'});
 const read=async()=>(await db.query('select help,failures,earned_completion from private.learning_result_support where user_id=$1 and context_key=$2 and activity_type=\'quiz\'',[user,context])).rows[0];
 assert.equal((await read()).help,true);assert.equal((await read()).failures.length,2);
 await completeQuiz(1000,{preparationId});assert.deepEqual(await read(),{help:false,failures:[],earned_completion:true});
});
test('practice cannot earn full-attempt completion, rewards, support changes or a leaderboard entry',async()=>{
 const context='vocabulary:learning-practice',preparationId=await copyPreparation({context});
 const before=(await db.query('select coins,total_xp from public.student_progress_summary where user_id=$1',[user])).rows[0];
 const result=await completeQuiz(1000,{preparationId,kind:'practice'});assert.equal(result.eligible,false);assert.deepEqual(result.rewards,{coins:0,xp:0});
 assert.deepEqual((await db.query('select coins,total_xp from public.student_progress_summary where user_id=$1',[user])).rows[0],before);
 const {rows:[row]}=await db.query(`select (select count(*)::integer from public.student_activity_progress where user_id=$1 and unit_key=$2) progress,
  (select count(*)::integer from private.learning_result_support where user_id=$1 and context_key=$2) support,
  (select count(*)::integer from private.learning_result_board_entries where attempt_id=$3) board`,[user,context,result.attemptId]);
 assert.deepEqual(row,{progress:0,support:0,board:0});
});

test('independent SQL puzzle validation accepts generated complete grids and rejects altered geometry',async()=>{
 const {generateLayout,validateLayout}=await import('../js/learningResults/task.js');
 const words=[{id:'cat',word:'cat'},{id:'bat',word:'bat'},{id:'tab',word:'tab'}];
 const check=(activity,layout,w=words)=>db.query('select private.learning_layout_v1($1,$2,$3)',[JSON.stringify(w),activity,JSON.stringify(layout)]);
 for(const activity of ['crossword','word-search']){
  const layout=generateLayout({words,activity,seed:713});validateLayout(words,activity,layout);await check(activity,layout);
  const bad=structuredClone(layout);bad.placements.pop();await assert.rejects(check(activity,bad),/LAYOUT_INVALID/);
  const duplicate=structuredClone(layout);duplicate.placements[1]=duplicate.placements[0];await assert.rejects(check(activity,duplicate),/LAYOUT_INVALID/);
  const letter=structuredClone(layout),p=letter.placements[0];const row=letter.gridRows[p.startRow].split('');row[p.startColumn]=row[p.startColumn]==='Z'?'A':'Z';letter.gridRows[p.startRow]=row.join('');await assert.rejects(check(activity,letter),/LAYOUT_INVALID/);
  const outside=structuredClone(layout);outside.placements[0].startColumn=40;await assert.rejects(check(activity,outside),/LAYOUT_INVALID/);
  const seed=structuredClone(layout);seed.seed='00000000';await assert.rejects(check(activity,seed),/LAYOUT_INVALID/);
 }
 const shape={variantId:crypto.randomUUID(),generatorVersion:'grid-v1',seed:'00000001',rows:3,columns:3,gridRows:['CAT','###','BAT'],placements:[{wordId:'cat',startRow:0,startColumn:0,direction:'across'},{wordId:'bat',startRow:2,startColumn:0,direction:'across'}]};
 await assert.rejects(check('crossword',shape,words.slice(0,2)),/LAYOUT_INVALID/);
 shape.rows=1;shape.gridRows=['CAT'];shape.placements=[shape.placements[0],{...shape.placements[0],wordId:'other'}];
 await assert.rejects(check('crossword',shape,[words[0],{id:'other',word:'cat'}]),/LAYOUT_INVALID/);
});

test('teacher publication binds current source, grade authority, revisions and complete puzzle candidates; student preparation never publishes',async()=>{
 const teacher='00000000-0000-4000-8000-000000000071',classId='00000000-0000-4000-8000-000000000072',subject='00000000-0000-4000-8000-000000000073';
 await db.exec(`alter table auth.users disable trigger user;insert into auth.users(id,email) values('${teacher}','publisher@example.invalid');alter table auth.users enable trigger user;
 insert into public.profiles(user_id,email) values('${teacher}','publisher@example.invalid');
 insert into public.school_memberships(school_id,user_id) values('${school}','${teacher}');
 insert into public.school_member_roles(school_id,user_id,role) values('${school}','${teacher}','teacher');
 select set_config('request.jwt.claim.sub','${teacher}',false);
 insert into public.teacher_subjects(id,owner_id,school_id,name) values('${subject}','${teacher}','${school}','Publication test');
 insert into public.school_academic_years(school_id,year,label) values('${school}',2026,'2026') on conflict do nothing;
 insert into public.teaching_classes(id,owner_id,subject_id,name,school_year,school_id) values('${classId}','${teacher}','${subject}','Publication class',2026,'${school}');
 insert into public.class_teachers(class_id,school_id,teacher_id) values('${classId}','${school}','${teacher}') on conflict do nothing;
 insert into public.class_memberships(class_id,student_id) values('${classId}','${user}');
 insert into public.vocabularies(id,school_id,teacher_subject_id,grades,words) values('publication-vocabulary','${school}','${subject}',array['7'],'[{"id":"cat","word":"cat","definition":"A small feline"},{"id":"bat","word":"bat","definition":"A flying mammal"},{"id":"tab","word":"tab","definition":"A small label"}]');`);
 const version='00000000-0000-4000-8000-000000000074',assignment='00000000-0000-4000-8000-000000000075';
 await db.query("insert into private.class_material_versions(id,school_id,owner_id,vocabulary_id,student_content) select $1,school_id,$2,id,jsonb_build_object('kind','vocabulary','words',words,'activitySettings',jsonb_build_object('requiredActivities',jsonb_build_array('flashcards','crossword'))) from public.vocabularies where id='publication-vocabulary'",[version,teacher]);
 await db.query("insert into public.class_assignments(id,school_id,owner_id,class_id,version_id,title,kind,release_at,publication_key) values($1,$2,$3,$4,$5,'Published vocabulary','vocabulary','2020-01-01',$6)",[assignment,school,teacher,classId,version,crypto.randomUUID()]);
 const source={kind:'assignment',id:assignment};
 const call=async(name,owner,payload,id=crypto.randomUUID())=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  return (await db.query(`select private.${name}($1,$2,$3) result`,[owner,id,canonical({contractVersion:'learning-results-v1',...payload})])).rows[0].result;
 };
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[teacher]);
 const snapshot=(await db.query('select private.learning_source_v1($1,7,true) value',[JSON.stringify(source)])).rows[0].value;
 const {generateLayout,packageReady}=await import('../js/learningResults/task.js');
 const words=snapshot.content.words;
 const layout=generateLayout({words,activity:'crossword',seed:713});
 const payload={source,grade:7,activity:'crossword',expectedRevision:0,sourceDigest:snapshot.sourceDigest,sharedTargetMilliseconds:10000,appearances:5,layoutCandidates:[layout],enabled:true};
 await assert.rejects(call('learning_publish_v1',user,payload),/TEACHING_GRADE_REQUIRED|ACTIVITY_UNAVAILABLE/);
 await assert.rejects(call('learning_publish_v1',teacher,{...payload,sourceDigest:'0'.repeat(64)}),/SOURCE_CHANGED/);
 const bad=structuredClone(payload);bad.layoutCandidates[0].placements.pop();await assert.rejects(call('learning_publish_v1',teacher,bad),/LAYOUT_INVALID/);
 assert.equal((await db.query("select count(*)::int n from private.learning_result_tasks where content_set_id='version:00000000-0000-4000-8000-000000000074'")).rows[0].n,0);
 const operation=crypto.randomUUID(),published=await call('learning_publish_v1',teacher,payload,operation);
 assert.equal(published.revision,1);assert.deepEqual(await call('learning_publish_v1',teacher,payload,operation),published);
 await assert.rejects(call('learning_publish_v1',teacher,payload),/SETTINGS_CONFLICT/);
 const prepare={source,grade:7,activity:'crossword',expectedTaskId:published.taskId};
 await assert.rejects(call('learning_prepare_v1',user,prepare),/Complete the required activity flashcards first/);
 await db.query("insert into public.student_unit_progress(user_id,unit_key,assignment_id) values($1,$2,$3)",[user,'assignment:'+assignment,assignment]);
 await db.query("insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified) values($1,$2,$3,'flashcards',100,true,true)",[user,'assignment:'+assignment,assignment]);
 const preparationsBefore=(await db.query('select count(*)::int n from private.learning_result_preparations')).rows[0].n;
 assert.deepEqual(await call('learning_prepare_v1',user,{...prepare,activity:'flashcards',expectedTaskId:null}),{status:'unavailable',code:'TASK_NOT_PUBLISHED'});
 assert.equal((await db.query('select count(*)::int n from private.learning_result_preparations')).rows[0].n,preparationsBefore);
 const prepared=await call('learning_prepare_v1',user,prepare);
 assert.equal(prepared.passingTarget,80);
 (await import('../js/learningResults/task.js')).validateTask(prepared.task);
 const sqlContent=(await db.query('select private.learning_json_canonical_v1($1::json) text',[JSON.stringify(prepared.content)])).rows[0].text;
 assert.equal(sqlContent,canonical(prepared.content));
 assert.equal(await sha256(bytes(prepared.content)),prepared.manifestHash);
 assert.equal(await packageReady({...prepared,ready:true}),true);
 assert.equal(prepared.task.words.length,3);
 const targetPayload={source,grade:7,studentId:user,activity:'crossword',expectedRevision:0,target:90};
 await assert.rejects(call('learning_target_v1',user,targetPayload),/TEACHING_GRADE_REQUIRED|ACTIVITY_UNAVAILABLE/);
 assert.equal((await call('learning_target_v1',teacher,targetPayload)).target,90);
 assert.equal((await call('learning_prepare_v1',user,prepare)).passingTarget,90);
 await assert.rejects(call('learning_target_v1',teacher,{...targetPayload,expectedRevision:1,target:101}),/INVALID_TARGET/);
 assert.equal((await call('learning_target_v1',teacher,{...targetPayload,expectedRevision:1,target:null})).target,80);
 await assert.rejects(call('learning_target_v1',teacher,targetPayload),/TARGET_CONFLICT/);
 assert.equal((await call('learning_prepare_v1',user,prepare)).passingTarget,80);

 const republished=await call('learning_publish_v1',teacher,{...payload,expectedRevision:1,sharedTargetMilliseconds:20000});
 assert.notEqual(republished.taskId,published.taskId);
 await assert.rejects(call('learning_prepare_v1',user,prepare),/TASK_CHANGED/);
 assert.equal((await db.query('select package->\'task\'->>\'id\' id from private.learning_result_preparations where id=$1',[prepared.preparationId])).rows[0].id,published.taskId);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[teacher]);
 await db.query("update public.vocabularies set words=words||'[{\"id\":\"cab\",\"word\":\"cab\",\"definition\":\"A taxi\"}]'::jsonb where id='publication-vocabulary'");
 assert.equal((await call('learning_prepare_v1',user,{...prepare,expectedTaskId:republished.taskId})).task.words.length,3);
 await assert.rejects(db.query('select private.learning_source_v1($1,7,false)',[JSON.stringify({kind:'vocabulary',id:'publication-vocabulary'})]),/ACTIVITY_UNAVAILABLE/);
 await assert.rejects(db.query('select private.learning_source_v1($1,6,false)',[JSON.stringify(source)]),/ACTIVITY_UNAVAILABLE/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
});

test('append rejects invalid semantic transitions immediately and freezes original results before required review',async()=>{
 const {rpcArguments,extendHash}=await import('../js/learningResults/contract.js');
 const {recoveryAt}=await import('../js/learningResults/sync.js');
 const task={...resultsTask,id:crypto.randomUUID(),activity:'fill-in-blank',words:[{id:'cat',word:'CAT'}]},preparationId=crypto.randomUUID();
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.query("insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id) values($1,$2,7,'original-lock','fill-in-blank',$3,$4,$5)",[task.id,school,await sha256(bytes(task)),task,user]);
 await db.query("insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,vocabulary_id,target,target_source,manifest_hash,start_context) values($1,$2,$3,'original-lock','original-lock','learning-vocabulary',80,'{}',$4,'{}')",[preparationId,user,task.id,await sha256(bytes(task))]);
 const database=new ImageDB();database.dbName=`original-lock-${crypto.randomUUID()}`;const store=new LearningStore({database,activeOwner:()=>user});
 const repository={async mutate(kind,args,owner){const name={claim:'learning_claim_v1',checkpoint:'learning_checkpoint_v1',submit:'learning_submit_v1'}[kind];return (await db.query(`select private.${name}($1,$2,$3) result`,[owner,args.p_operation_id,args.p_payload])).rows[0].result;}};
 try {
  const session=await LearningSession.create({task,preparationId,ownerUserId:user,seed:1,startContext:{},store,owner:()=>user});
  const sync=new LearningSync({store,repository,activeOwner:()=>user});await sync.drain(user);
  const claimed=await store.get('learningAttempts',user,session.attempt.id),head=claimed.serverHead;
  const event={attemptId:claimed.id,eventId:crypto.randomUUID(),sequence:1,type:'original',opportunityId:'cat:0',response:{answer:'CAT'},assisted:false,recordedMilliseconds:0};
  const p={contractVersion:'learning-results-v1',attemptId:claimed.id,expectedRevision:head.revision,localCheckpointRevision:1,baseSequence:0,baseHash:head.hash,throughSequence:1,throughHash:await extendHash(head.hash,[event]),events:[event],recoverableState:recoveryAt({...claimed,events:[event]},1)};
  const op=crypto.randomUUID();p.chunkHash=await sha256(bytes({operationId:op,payload:p}));
  await assert.rejects(repository.mutate('checkpoint',rpcArguments(op,p,262144,user),user),/ANSWER_NOT_USABLE/);
  assert.equal((await db.query('select count(*)::int n from private.learning_result_evidence where attempt_id=$1',[claimed.id])).rows[0].n,0);
  await session.resume();await session.original('cat:0',{answer:'CXT'});await sync.drain(user);
  const locked=(await db.query('select points,recorded_milliseconds,validation_status,full_task_finished_at from private.learning_result_results where attempt_id=$1',[claimed.id])).rows[0];
  assert.equal(locked.points,633);assert.equal(locked.validation_status,'original_locked');assert.equal(locked.full_task_finished_at,null);
  assert.equal((await db.query('select count(*)::int n from private.learning_result_board_entries where attempt_id=$1',[claimed.id])).rows[0].n,0);
  const pending=(await store.get('learningAttempts',user,session.attempt.id)).serverHead;
  const premature={contractVersion:'learning-results-v1',attemptId:session.attempt.id,expectedRevision:pending.revision,terminalSequence:pending.sequence,terminalHash:pending.hash,stateHash:pending.stateHash,writingRevisionId:null,finishDeclaration:{originalSetSubmitted:true,requiredReviewSubmitted:true}};
  await assert.rejects(repository.mutate('submit',rpcArguments(crypto.randomUUID(),premature,262144,user),user),/REVIEW_REQUIRED/);
  const cached=(await db.query('select accepted_validation value from private.learning_result_attempts where id=$1',[session.attempt.id])).rows[0].value;
  for(const corrupted of [null,{...cached,revision:cached.revision+1},{...cached,throughSequence:0},{...cached,throughHash:'0'.repeat(64)},{...cached,stateHash:'0'.repeat(64)}]){
   await db.query('update private.learning_result_attempts set accepted_validation=$2 where id=$1',[session.attempt.id,corrupted]);
   await assert.rejects(repository.mutate('submit',rpcArguments(crypto.randomUUID(),premature,262144,user),user),/VALIDATED_PREFIX_REQUIRED/);
  }
  await db.query('update private.learning_result_attempts set accepted_validation=$2 where id=$1',[session.attempt.id,cached]);
  await session.correct('cat:0','CAT');await session.submit();
  for(const corrupted of [null,{...cached,revision:cached.revision+1},{...cached,throughSequence:0},{...cached,throughHash:'0'.repeat(64)},{...cached,stateHash:'0'.repeat(64)},{...cached,replayState:null}]){
   await db.query('update private.learning_result_attempts set accepted_validation=$2 where id=$1',[session.attempt.id,corrupted]);
   await assert.rejects(sync.drain(user),/VALIDATED_PREFIX_REQUIRED/);
   assert.equal((await db.query('select count(*)::int n from private.learning_result_evidence where attempt_id=$1',[session.attempt.id])).rows[0].n,pending.sequence,'rejected appends roll back their new evidence');
  }
  await db.query('update private.learning_result_attempts set accepted_validation=$2 where id=$1',[session.attempt.id,cached]);
  await sync.drain(user);
  const refreshed=(await db.query('select accepted_validation value from private.learning_result_attempts where id=$1',[session.attempt.id])).rows[0].value;
  assert.ok(refreshed.revision>cached.revision);assert.equal(refreshed.evaluation.finished,true);

  const finalized=(await db.query('select points,recorded_milliseconds,validation_status from private.learning_result_results where attempt_id=$1',[claimed.id])).rows[0];
  assert.equal(finalized.points,locked.points);assert.equal(finalized.recorded_milliseconds,locked.recorded_milliseconds);assert.equal(finalized.validation_status,'validated');
  const submitted=(await store.list('learningOutbox',user)).find(row=>row.kind==='submit');
  const noOp=await repository.mutate('submit',rpcArguments(crypto.randomUUID(),JSON.parse(submitted.request.p_payload),262144,user),user);
  assert.equal(Object.hasOwn(noOp.result,'progressEvidence'),false);assert.equal(noOp.alreadyConfirmed,true);assert.equal(noOp.result.points,locked.points);assert.deepEqual(noOp.result.rewards,{coins:0,xp:0});
  const tampered={...JSON.parse(submitted.request.p_payload),terminalHash:'0'.repeat(64)};
  await assert.rejects(repository.mutate('submit',rpcArguments(crypto.randomUUID(),tampered,262144,user),user),/ATTEMPT_CONFLICT/);

 }finally{await database.close();await deleteDB(database.dbName);}
});

test('reading publication derives automatic questions only and immutable writing revisions preserve responses for retries',async()=>{
 const teacher='00000000-0000-4000-8000-000000000071',subject='00000000-0000-4000-8000-000000000073';
 const questions=[{id:'mc',type:'multiple_choice',prompt:'Which animal flies?',options:['Bat','Cat'],correctOption:0},{id:'written',type:'short_text',prompt:'Explain your choice.'}];
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[teacher]);
 await db.query("insert into public.weekly_sparks(id,school_id,teacher_subject_id,target_grades,status,scheduled_date,check_mode,questions) values('writing-reading',$1,$2,array['7'],'scheduled','2020-01-01','required',$3)",[school,subject,JSON.stringify(questions)]);
 const source={kind:'spark',id:'writing-reading'};
 const snapshot=(await db.query('select private.learning_source_v1($1,7,true) value',[JSON.stringify(source)])).rows[0].value;
 const call=async(name,owner,payload,id=crypto.randomUUID())=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  return (await db.query(`select private.${name}($1,$2,$3) result`,[owner,id,canonical({contractVersion:'learning-results-v1',...payload})])).rows[0].result;
 };
 const published=await call('learning_publish_v1',teacher,{source,grade:7,activity:'reading-check',expectedRevision:0,sourceDigest:snapshot.sourceDigest,sharedTargetMilliseconds:10000,enabled:true});
 assert.deepEqual(published.task.words.map(w=>w.id),['mc']);assert.deepEqual(published.task.writingQuestions.map(w=>w.id),['written']);
 const prepared=await call('learning_prepare_v1',user,{source,grade:7,activity:'reading-check',expectedTaskId:published.taskId});
 const responses={written:'Bats are mammals that can fly.'},id=crypto.randomUUID(),op=crypto.randomUUID();
 const payload={preparationId:prepared.preparationId,writingRevisionId:id,expectedWritingRevisionId:null,expectedLegacyRevision:0,responses};
 const saved=await call('learning_writing_v1',user,payload,op);assert.equal(saved.writingRevisionId,id);assert.deepEqual(saved.responses,responses);
 assert.deepEqual(await call('learning_writing_v1',user,payload,op),saved);
 await assert.rejects(call('learning_writing_v1',user,{...payload,writingRevisionId:crypto.randomUUID()}),/WRITING_CONFLICT/);
 await assert.rejects(call('learning_writing_v1',user,{...payload,writingRevisionId:crypto.randomUUID(),expectedWritingRevisionId:id,responses:{written:'Too short'}}),/WRITING_INCOMPLETE/);
 const retry=await call('learning_prepare_v1',user,{source,grade:7,activity:'reading-check',expectedTaskId:published.taskId});
 assert.equal(retry.task.id,prepared.task.id);assert.deepEqual(retry.writing.responses,responses);assert.equal(retry.writing.writingRevisionId,id);
 assert.deepEqual((await db.query('select responses from private.learning_result_writing_revisions where id=$1',[id])).rows[0].responses,responses);
 assert.deepEqual((await db.query("select answers,is_complete,evaluation from public.student_spark_responses where user_id=$1 and spark_id='writing-reading'",[user])).rows[0],{answers:responses,is_complete:false,evaluation:{}});
 const database=new ImageDB();database.dbName=`reading-submit-${crypto.randomUUID()}`;const store=new LearningStore({database,activeOwner:()=>user});
 let loseWriting=true;const edited={written:'Bats use their wings to fly through the air.'};
 const repository={async mutate(kind,args,owner){const name={claim:'learning_claim_v1',checkpoint:'learning_checkpoint_v1',submit:'learning_submit_v1',writing:'learning_writing_v1'}[kind];const result=(await db.query(`select private.${name}($1,$2,$3) result`,[owner,args.p_operation_id,args.p_payload])).rows[0].result;if(kind==='writing' && loseWriting){loseWriting=false;throw new Error('lost writing response');}return result;}};
 try {
  const session=await LearningSession.create({task:prepared.task,preparationId:prepared.preparationId,ownerUserId:user,seed:1,startContext:prepared.startContext,writingSnapshot:retry.writing,store,owner:()=>user});
  const editedId=await session.stageWriting(edited);assert.notEqual(editedId,id);
  await session.resume();await session.submitReading({responses:{'mc:0':{optionId:'option:0'}},writingRevisionId:editedId});
  const sync=new LearningSync({store,repository,activeOwner:()=>user});
  await assert.rejects(sync.drain(user),/lost writing response/);
  assert.equal((await db.query('select count(*)::int n from private.learning_result_results where attempt_id=$1',[session.attempt.id])).rows[0].n,0);
  await sync.drain(user);
  const projection=(await db.query("select answers,is_complete,evaluation from public.student_spark_responses where user_id=$1 and spark_id='writing-reading'",[user])).rows[0];
  assert.deepEqual(projection.answers,{...edited,mc:0});assert.equal(projection.is_complete,true);assert.equal(projection.evaluation.automaticTotal,1);
  const savedAttempt=await store.get('learningAttempts',user,session.attempt.id);assert.equal(savedAttempt.confirmed,true);assert.equal(savedAttempt.result.rewards.coins,0);assert.equal(savedAttempt.result.rewards.xp,0);
 }finally{await database.close();await deleteDB(database.dbName);}

});

test('gradebook and roster readers preserve legacy coverage but require explicit passing completion',async()=>{
 const assignment='00000000-0000-4000-8000-000000000075',teacher='00000000-0000-4000-8000-000000000071';
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[teacher]);
 await db.query("insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified,completion_semantics) values($1,$2,$3,'crossword',100,false,true,'explicit')",[user,'assignment:'+assignment,assignment]);
 const grade=async()=> (await db.query("select private.vocabulary_assignment_grade_v1($1,$2,'{\"enabled\":true,\"maxPoints\":100}') value",[assignment,user])).rows[0].value;
 let result=await grade();assert.equal(result.requiredCompleted,1);assert.equal(result.basePoints,50);
 const hasRoster=(await db.query("select to_regprocedure('private.teacher_roster_progress_summary_v1(uuid,uuid[],integer)') is not null present")).rows[0].present;
 let roster;
 if(hasRoster){roster=(await db.query('select private.teacher_roster_progress_summary_v1($1,$2,2026) value',[school,[user]])).rows[0].value;assert.equal(roster[0].completed,1);assert.equal(roster[0].pending,1);}
 const readers=(await db.query("select pg_get_functiondef(p.oid) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('teacher_class_progress_v2','assignment_replacement_credits','vocabulary_assignment_grade_v1')")).rows;
 assert.equal(readers.length,3);for(const reader of readers)assert.match(reader.body,/completion_semantics='legacy'/);
 await db.query("update public.student_activity_progress set completion_semantics='legacy' where user_id=$1 and assignment_id=$2 and activity_type='crossword'",[user,assignment]);
 result=await grade();assert.equal(result.requiredCompleted,2);assert.equal(result.basePoints,100);
 if(hasRoster){roster=(await db.query('select private.teacher_roster_progress_summary_v1($1,$2,2026) value',[school,[user]])).rows[0].value;assert.equal(roster[0].completed,2);}
 await db.query("update public.student_activity_progress set completion_semantics='explicit',is_complete=true where user_id=$1 and assignment_id=$2 and activity_type='crossword'",[user,assignment]);
 assert.equal((await grade()).requiredCompleted,2);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
});

test('owned recovery reads preserve one head, bound evidence, and enforce student and teacher scope',async()=>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 const own=(await db.query("select a.id from private.learning_result_attempts a join private.learning_result_results r on r.attempt_id=a.id where a.user_id=$1 and r.full_task_finished_at is not null order by a.created_at limit 1",[user])).rows[0].id;
 const read=async(owner,payload)=> (await db.query('select private.learning_read_v1($1,$2) value',[owner,JSON.stringify(payload)])).rows[0].value;
 const result=await read(user,{attemptId:own,afterSequence:0});assert.equal(result.status,'ok');assert.ok(byteLength(result)<=196608);assert.ok(result.events.length>0);
 assert.equal(result.events[0].sequence,1);assert.equal(result.events.at(-1).sequence,result.acceptedThroughSequence);assert.equal(result.hasMore,false);
 assert.equal((await read(user,{attemptId:own,expectedRevision:result.revision-1})).status,'refresh_required');
 await assert.rejects(read('00000000-0000-4000-8000-000000000071',{attemptId:own}),/OWNER_CHANGED/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",['00000000-0000-4000-8000-000000000071']);
 await assert.rejects(read('00000000-0000-4000-8000-000000000071',{attemptId:own}),/ATTEMPT_UNAVAILABLE/);
 const teacherRead=(await db.query('select private.learning_teacher_read_v1($1,$2) value',['00000000-0000-4000-8000-000000000071',JSON.stringify({mode:'evidence',classId:'00000000-0000-4000-8000-000000000072',attemptId:own,afterSequence:0})])).rows[0].value;
 assert.equal(teacherRead.status,'ok');assert.equal(teacherRead.acceptedPrefixHash,result.acceptedPrefixHash);
 const teacherResults=(await db.query('select private.learning_teacher_read_v1($1,$2) value',['00000000-0000-4000-8000-000000000071',JSON.stringify({mode:'results',classId:'00000000-0000-4000-8000-000000000072',limit:2})])).rows[0].value;
 assert.ok(teacherResults.results.length<=2);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await assert.rejects(db.query('select private.learning_teacher_read_v1($1,$2)',[user,JSON.stringify({mode:'results',classId:'00000000-0000-4000-8000-000000000072'})]),/CLASS_UNAVAILABLE/);
});

test('public learning routes require the authenticated owner and grant no private helper access',async()=>{
 const routes=['prepare_student_learning_task_owned_v1','claim_student_learning_attempt_owned_v1','save_student_learning_checkpoint_owned_v1','submit_student_learning_result_owned_v1','save_student_learning_writing_owned_v1','save_teacher_learning_settings_owned_v1','save_teacher_learning_target_owned_v1','get_student_learning_result_owned_v1','get_teacher_learning_results_owned_v1','get_learning_leaderboard_owned_v1'];
 for(const name of routes){
  const signature=`public.${name}(${name.startsWith('get_')?'uuid,text':'uuid,uuid,text'})`;
  const {rows:[grants]}=await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') member,has_function_privilege('anon',$1,'EXECUTE') anonymous",[signature]);assert.equal(grants.member,true,name);assert.equal(grants.anonymous,false,name);
  const args=name.startsWith('get_')?[crypto.randomUUID(),'{}']:[crypto.randomUUID(),crypto.randomUUID(),'{}'];
  await assert.rejects(db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')})`,args),/OWNER_CHANGED/,name);
 }
 const {rows}=await db.query("select p.oid::regprocedure::text name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'learning_%' or p.proname in ('apply_learning_progress_rewards_v1','apply_student_activity_reward_delta_v1')) and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE'))");assert.deepEqual(rows,[]);
});
test('replacement-device history stays scoped to the owner and a current accessible context',async()=>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 const payload={mode:'history',contextKey:'vocabulary:learning-vocabulary',activity:'quiz',limit:1};
 const read=async p=>(await db.query('select public.get_student_learning_result_owned_v1($1,$2) result',[user,JSON.stringify(p)])).rows[0].result;
 const first=await read(payload);assert.equal(first.status,'ok');assert.equal(first.attempts.length,1);assert.ok(first.attempts[0].attemptId);
 if(first.nextAfterId){const next=await read({...payload,afterId:first.nextAfterId});assert.ok(next.attempts.every(a=>a.attemptId!==first.attempts[0].attemptId));}
 assert.deepEqual((await read({...payload,contextKey:'assignment:'+crypto.randomUUID()})).attempts,[]);
 await assert.rejects(read({...payload,limit:101}),/INVALID_LIMIT/);
});

import {LearningCoordinator} from '../js/learningResults/coordinator.js';
test('replacement computer recovers the validated event prefix, original score, combo and saved timer',async()=>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 const task={...resultsTask,id:crypto.randomUUID(),words:[...resultsTask.words,{...resultsTask.words[0],id:'bat',word:'BAT'}]};
 const content={task,source:{words:task.words},contextKey:'recovery-test',target:80,targetSource:{},startContext:{},writing:null},preparationId=crypto.randomUUID(),manifest=await sha256(bytes(content));
 await db.query("insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id) values($1,$2,7,'recovery-test','quiz',$3,$4,$5)",[task.id,school,await sha256(bytes(task)),task,user]);
 await db.query("insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,vocabulary_id,target,target_source,manifest_hash,start_context,package) values($1,$2,$3,'recovery-test','recovery-test','learning-vocabulary',80,'{}',$4,'{}',$5)",[preparationId,user,task.id,manifest,content]);
 const first=new ImageDB(),second=new ImageDB();first.dbName=`first-${crypto.randomUUID()}`;second.dbName=`replacement-${crypto.randomUUID()}`;let clock=0;
 const repository={async mutate(kind,args,owner){const name={claim:'claim_student_learning_attempt_owned_v1',checkpoint:'save_student_learning_checkpoint_owned_v1',submit:'submit_student_learning_result_owned_v1'}[kind];return (await db.query(`select public.${name}($1,$2,$3) result`,[owner,args.p_operation_id,args.p_payload])).rows[0].result;},async read(payload,owner){return (await db.query('select public.get_student_learning_result_owned_v1($1,$2) result',[owner,JSON.stringify(payload)])).rows[0].result;}};
 try{
  const store=new LearningStore({database:first,activeOwner:()=>user});
  const session=await LearningSession.create({task,preparationId,ownerUserId:user,seed:7,store,owner:()=>user,now:()=>clock,startContext:{}});
  await session.resume();clock=1200;await session.original(session.attempt.schedule[0].id,{optionId:'no'});await session.draft({answer:'remember this draft'});
  await new LearningSync({store,repository,activeOwner:()=>user}).drain(user);
  const replacementStore=new LearningStore({database:second,activeOwner:()=>user});let loadedAssets=0;
  const coordinator=new LearningCoordinator({owner:()=>user,store:replacementStore,repository,prepareAssets:async()=>{loadedAssets++;},now:()=>100000});
  const recovered=await coordinator.recover(session.attempt.id);assert.equal(loadedAssets,1);assert.deepEqual(recovered.attempt.state.originals,session.attempt.state.originals);assert.deepEqual(recovered.attempt.state.draft,session.attempt.state.draft);assert.equal(recovered.timer.snapshot(),1200);assert.deepEqual(recovered.combo(),session.combo());
  await recovered.resume();await recovered.original(recovered.attempt.schedule[1].id,{optionId:'yes'});await recovered.correct(recovered.attempt.schedule[0].id,task.words.find(w=>w.id===recovered.attempt.schedule[0].wordId).word);await recovered.submit();await coordinator.sync.drain(user);
  const saved=await replacementStore.get('learningAttempts',user,recovered.attempt.id);assert.equal(saved.confirmed,true);assert.equal(saved.result.recordedMilliseconds,1200);assert.equal(saved.result.points,475);
 }finally{await first.close();await second.close();await deleteDB(first.dbName);await deleteDB(second.dbName);}
});

test('all synonym and antonym questions are retained with separate stable IDs',async()=>{
 const content={words:[{id:'hot',word:'Hot',definition:'High temperature',synonyms:['warm'],antonyms:['cold']},{id:'fast',word:'Fast',definition:'Moving quickly',synonyms:['quick'],antonyms:[]},{id:'big',word:'Big',definition:'Large size',synonyms:['large'],antonyms:[]}]};
 const {rows:[{result}]}=await db.query("select private.learning_words_v1($1,'synonym-antonym') result",[{content}]);
 assert.deepEqual(result.words.map(w=>w.id),['hot:synonym','hot:antonym','fast:synonym','big:synonym']);
 const task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'synonym-antonym',sharedTargetMilliseconds:10000,...result};
 const {validateTask}=await import('../js/learningResults/task.js');assert.doesNotThrow(()=>validateTask(task));await db.query('select private.learning_task_valid_v1($1)',[task]);
});

test('leaderboard pages retain more than 100 tied students across the top-five boundary and filter inactive membership',async()=>{
 const {rows:[{attempt_id:templateId}]}=await db.query('select attempt_id from private.learning_result_board_entries where task_id=$1 limit 1',[resultsTask.id]);
 const ids=Array.from({length:107},()=>crypto.randomUUID());
 await db.exec('alter table auth.users disable trigger user');
 try{for(let i=0;i<ids.length;i++)await db.query("insert into auth.users(id) values($1)",[ids[i]]);}finally{await db.exec('alter table auth.users enable trigger user');}
 for(let i=0;i<ids.length;i++){
  const student=ids[i],prepared=crypto.randomUUID(),attempt=crypto.randomUUID(),points=i===106?100:i===105?950:900;
  await db.query("insert into public.profiles(user_id,email,first_name,last_name) values($1,$2,'Tie',$3)",[student,`tie${i}@example.invalid`,String(i).padStart(3,'0')]);
  await db.query("insert into public.school_memberships(school_id,user_id,grade) values($1,$2,'7')",[school,student]);
  await db.query("insert into public.school_member_roles(school_id,user_id,role) values($1,$2,'student')",[school,student]);
  await db.transaction(async tx=>{
   await tx.query("insert into private.learning_result_preparations select (jsonb_populate_record(null::private.learning_result_preparations,to_jsonb(p)||jsonb_build_object('id',$1::text,'user_id',$2::text))).* from private.learning_result_preparations p join private.learning_result_attempts a on a.preparation_id=p.id where a.id=$3",[prepared,student,templateId]);
   await tx.query("insert into private.learning_result_attempts select (jsonb_populate_record(null::private.learning_result_attempts,to_jsonb(a)||jsonb_build_object('id',$1::text,'user_id',$2::text,'preparation_id',$3::text,'compatibility_attempt_id',$1::text,'predecessor_id',null))).* from private.learning_result_attempts a where a.id=$4",[attempt,student,prepared,templateId]);
   await tx.query("insert into private.student_activity_attempts select (jsonb_populate_record(null::private.student_activity_attempts,to_jsonb(a)||jsonb_build_object('id',$1::text,'user_id',$2::text,'learning_attempt_id',$1::text))).* from private.student_activity_attempts a where a.id=$3",[attempt,student,templateId]);
   await tx.query("insert into private.learning_result_results select (jsonb_populate_record(null::private.learning_result_results,to_jsonb(r)||jsonb_build_object('attempt_id',$1::text,'points',$2::integer))).* from private.learning_result_results r where r.attempt_id=$3",[attempt,points,templateId]);
   await tx.query('insert into private.learning_result_board_entries(task_id,user_id,attempt_id,points,recorded_milliseconds) values($1,$2,$3,$4,1000)',[resultsTask.id,student,attempt,points]);
  });
 }
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[106]]);
 const read=async payload=>(await db.query('select public.get_learning_leaderboard_owned_v1($1,$2) result',[ids[106],JSON.stringify({taskId:resultsTask.id,...payload})])).rows[0].result;
 const first=await read({});assert.equal(first.status,'ok');assert.ok(first.nextCursor);assert.equal(first.entries.filter(e=>e.rank<=5).length,100);assert.ok(first.entries.some(e=>e.userId===ids[106] && e.rank>5));
 const second=await read({cursor:first.nextCursor,boardRevision:first.boardRevision,orderingDigest:first.orderingDigest});
 const top=[...first.entries,...second.entries].filter(e=>e.rank<=5);assert.equal(top.length,107);assert.equal(new Set(top.map(e=>e.userId)).size,107);assert.equal(second.nextCursor,null);assert.equal(new Set(top.filter(e=>e.points===900).map(e=>e.rank)).size,1);
 await db.query('update public.school_memberships set active=false,removed_at=now() where school_id=$1 and user_id=$2',[school,ids[0]]);
 assert.equal((await read({cursor:first.nextCursor,boardRevision:first.boardRevision,orderingDigest:first.orderingDigest})).status,'refresh_required');
 const current=await read({});assert.ok(current.entries.every(e=>e.userId!==ids[0]));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
});

test('offline classroom reading retries deliver writing and results in causal order while preserving edited responses',async()=>{
 const teacher='00000000-0000-4000-8000-000000000071',classId='00000000-0000-4000-8000-000000000072',version=crypto.randomUUID(),assignment=crypto.randomUUID();
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[teacher]);
 const questions=[{id:'mc',type:'multiple_choice',prompt:'Choose CAT',options:['CAT','DOG'],correctOption:0},{id:'written',type:'short_text',prompt:'Explain your answer'}];
 await db.query("insert into private.class_material_versions(id,school_id,owner_id,spark_id,student_content,assessment_key) values($1,$2,$3,'writing-reading',$4,$5)",[version,school,teacher,{kind:'spark',title:'Offline classroom check',sparkText:'Read this passage.',checkMode:'required',questions}, {questions}]);
 await db.query("insert into public.class_assignments(id,school_id,owner_id,class_id,version_id,title,kind,release_at,publication_key) values($1,$2,$3,$4,$5,'Offline reading','spark','2020-01-01',$6)",[assignment,school,teacher,classId,version,crypto.randomUUID()]);
 const source={kind:'assignment',id:assignment},snapshot=(await db.query('select private.learning_source_v1($1,7,true) value',[source])).rows[0].value;
 const call=async(name,owner,payload)=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);return (await db.query(`select private.${name}($1,$2,$3) value`,[owner,crypto.randomUUID(),canonical({contractVersion:'learning-results-v1',...payload})])).rows[0].value;};
 const published=await call('learning_publish_v1',teacher,{source,grade:7,activity:'reading-check',expectedRevision:0,sourceDigest:snapshot.sourceDigest,sharedTargetMilliseconds:10000,enabled:true});
 const prepared=await call('learning_prepare_v1',user,{source,grade:7,activity:'reading-check',expectedTaskId:published.taskId});
 const database=new ImageDB();database.dbName=`reading-chain-${crypto.randomUUID()}`;const store=new LearningStore({database,activeOwner:()=>user});
 try{
  const first=await LearningSession.create({task:prepared.task,preparationId:prepared.preparationId,ownerUserId:user,seed:1,startContext:prepared.startContext,writingSnapshot:prepared.writing,store,owner:()=>user});
  const writing=await first.stageWriting({written:'My first written explanation.'});await first.resume();await first.submitReading({responses:{'mc:0':{optionId:'option:1'}},writingRevisionId:writing});
  const second=await LearningSession.create({task:prepared.task,preparationId:prepared.preparationId,ownerUserId:user,seed:2,startContext:prepared.startContext,writingSnapshot:first.attempt.writingSnapshot,predecessorAttemptId:first.attempt.id,store,owner:()=>user});
  const edited=await second.stageWriting({written:'My edited explanation is preserved.'});await second.resume();await second.submitReading({responses:{'mc:0':{optionId:'option:0'}},writingRevisionId:edited});
  const repository={async mutate(kind,args,owner){const name={claim:'learning_claim_v1',checkpoint:'learning_checkpoint_v1',submit:'learning_submit_v1',writing:'learning_writing_v1'}[kind];return (await db.query(`select private.${name}($1,$2,$3) value`,[owner,args.p_operation_id,args.p_payload])).rows[0].value;}};
  await new LearningSync({store,repository,activeOwner:()=>user}).drain(user);
  assert.equal((await store.get('learningAttempts',user,first.attempt.id)).confirmed,true);assert.equal((await store.get('learningAttempts',user,second.attempt.id)).confirmed,true);
  const response=(await db.query('select answers,evaluation,revision from public.class_assignment_responses where assignment_id=$1 and student_id=$2',[assignment,user])).rows[0];assert.equal(response.answers.written,'My edited explanation is preserved.');assert.equal(response.answers.mc,0);assert.equal(response.evaluation.points,1000);assert.equal(response.revision,4);
 }finally{await database.close();await deleteDB(database.dbName);}
});


test('incremental validation equals full replay across clue, out-of-order originals, correction and combo boundaries',async()=>{
 const task={activity:'matching',appearances:2,sharedTargetMilliseconds:10000,words:[{id:'cat',word:'CAT'},{id:'bat',word:'BAT'}]};
 const schedule=makeSchedule(task,7),events=[],add=(type,payload={})=>events.push({type,recordedMilliseconds:0,...payload});
 const [a,b,c,d]=schedule;
 add('assist',{opportunityIds:[d.id]});add('resume');add('original',{opportunityId:d.id,assisted:true,response:{selectedDefinitionId:d.wordId}});
 add('resume');add('original',{opportunityId:a.id,assisted:false,response:{selectedDefinitionId:a.wordId==='cat'?'bat':'cat'}});
 add('correction',{opportunityId:a.id,answer:task.words.find(w=>w.id===a.wordId).word});
 for(const o of [c,b]){add('resume');add('original',{opportunityId:o.id,assisted:false,response:{selectedDefinitionId:o.wordId}});}add('submission');
 for(const size of [1,2,3,4,7,events.length]){
  let previous=null;
  for(let offset=0;offset<events.length;offset+=size){
   const chunk=events.slice(offset,offset+size),through=offset+chunk.length;
   const incremental=(await db.query('select private.learning_evaluate_incremental_v1($1,$2,$3,80,null,false,$4) result',[task,schedule,chunk,previous])).rows[0].result;
   previous=incremental.replayState;delete incremental.replayState;
   const full=(await db.query('select private.learning_evaluate_v1($1,$2,$3,80,null,false) result',[task,schedule,events.slice(0,through)])).rows[0].result;
   assert.deepEqual(incremental,full,`chunk size ${size}, prefix ${through}`);
  }
 }
 const rights=(await db.query("select has_function_privilege('authenticated','private.learning_evaluate_incremental_v1(jsonb,jsonb,jsonb,integer,uuid,boolean,jsonb)','EXECUTE') allowed")).rows[0];
 assert.equal(rights.allowed,false);
});


test('every immutable attempt column remains protected when validation state grows',async()=>{
 const mutable=['accepted_revision','accepted_sequence','prefix_hash','evidence_bytes','state','state_hash','recorded_milliseconds','bridge_revision','completion_applied_at','originals_applied_at','accepted_validation'];
 const columns=(await db.query("select attname name,format_type(atttypid,atttypmod) type from pg_attribute where attrelid='private.learning_result_attempts'::regclass and attnum>0 and not attisdropped")).rows;
 const original=(await db.query('select to_jsonb(a) value from private.learning_result_attempts a where id=$1',[attemptId])).rows[0].value;
 for(const column of columns.filter(c=>!mutable.includes(c.name))){
  const name='"'+column.name.replaceAll('"','""')+'"',value=original[column.name]===null?(column.type==='uuid'?'00000000-0000-4000-8000-000000000099':'changed'):null;
  await assert.rejects(db.query(`update private.learning_result_attempts set ${name}=(jsonb_populate_record(null::private.learning_result_attempts,jsonb_build_object($1::text,$2::jsonb))).${name} where id=$3`,[column.name,value===null?null:JSON.stringify(value),attemptId]),/IMMUTABLE_ATTEMPT_IDENTITY/,column.name);
 }
});

test('SQL rejects oversized schedules independently of client publication checks',async()=>{
 const words=Array.from({length:50},(_,i)=>({id:`term-${i}`,word:`Term ${i}`,definition:`Definition ${i}`}));
 for(const activity of ['matching','speed-match']){
  const task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity,sharedTargetMilliseconds:10000,words,appearances:5};
  await db.query('select private.learning_task_valid_v1($1)',[task]);
  await assert.rejects(db.query('select private.learning_task_valid_v1($1)',[{...task,words:[...words,{id:'extra',word:'Extra',definition:'Extra definition'}]}]),/TASK_CAPACITY_EXCEEDED/);
 }
});

test('pair insertion rejects mismatched sources and mutable updates retain frozen compatibility identity',async()=>{
 const pair=crypto.randomUUID();
 await assert.rejects(db.transaction(async tx=>{
  await tx.query("insert into private.learning_result_attempts select (jsonb_populate_record(null::private.learning_result_attempts,to_jsonb(a)||jsonb_build_object('id',$1::text,'compatibility_attempt_id',$1::text))).* from private.learning_result_attempts a where id=$2",[pair,attemptId]);
  await tx.query("insert into private.student_activity_attempts select (jsonb_populate_record(null::private.student_activity_attempts,to_jsonb(a)||jsonb_build_object('id',$1::text,'learning_attempt_id',$1::text,'unit_key','mismatched-source'))).* from private.student_activity_attempts a where id=$2",[pair,attemptId]);
 }),/LEARNING_PAIR_MISMATCH/);
 assert.equal((await db.query('select count(*)::integer n from private.learning_result_attempts where id=$1',[pair])).rows[0].n,0);
 const columns=['id','user_id','unit_key','activity_type','assignment_id','vocabulary_id','spark_id','record_protocol','learning_attempt_id'];
 const original=(await db.query('select to_jsonb(a) value from private.student_activity_attempts a where id=$1',[attemptId])).rows[0].value;
 for(const name of columns){
  const value=original[name]===null?(name==='assignment_id'?crypto.randomUUID():'changed'):null;
  await assert.rejects(db.query(`update private.student_activity_attempts set ${name}=(jsonb_populate_record(null::private.student_activity_attempts,jsonb_build_object($1::text,$2::jsonb))).${name} where id=$3`,[name,value===null?null:JSON.stringify(value),attemptId]),name==='assignment_id'?/IMMUTABLE_ATTEMPT_PROTOCOL|Assignment context does not match the unit key/:/IMMUTABLE_ATTEMPT_PROTOCOL/,name);
 }
});
