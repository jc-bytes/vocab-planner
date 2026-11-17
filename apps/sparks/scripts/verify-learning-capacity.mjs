import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {deleteDB} from 'idb';
import {createLearningPostgres} from '../tests/helpers/learningPostgres.mjs';
import {ImageDB} from '../js/db.js';
import {LearningStore} from '../js/learningResults/store.js';
import {LearningSession} from '../js/learningResults/session.js';
import {LearningSync,recoverableState} from '../js/learningResults/sync.js';
import {bytes,sha256,extendHash,frame,LIMITS,byteLength} from '../js/learningResults/contract.js';
const {db}=await createLearningPostgres();const owner=crypto.randomUUID(),school=crypto.randomUUID(),database=new ImageDB();database.dbName=`learning-capacity-${crypto.randomUUID()}`;const started=performance.now();let requests=0,maxRequest=0;
try{
 await db.exec('alter table auth.users disable trigger user');await db.query('insert into auth.users(id) values($1)',[owner]);await db.exec('alter table auth.users enable trigger user');
await db.query("insert into public.schools(id,name) values($1,'Capacity fixture')",[school]);await db.query("insert into public.profiles(user_id,email) values($1,'capacity@example.invalid')",[owner]);
 await db.query("insert into public.school_memberships(school_id,user_id,grade) values($1,$2,'7')",[school,owner]);await db.query("insert into public.school_member_roles(school_id,user_id,role) values($1,$2,'student')",[school,owner]);
 await db.query("insert into public.teacher_subjects(id,owner_id,school_id,name) values($1,$2,$1,'Capacity fixture')",[school,owner]);await db.query("insert into public.vocabularies(id,school_id,teacher_subject_id) values('capacity',$1,$1)",[school]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const words=Array.from({length:50},(_,i)=>({id:crypto.randomUUID(),word:`Term ${i}`,definition:`Definition ${i}`})),task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'matching',words,appearances:5,sharedTargetMilliseconds:10000},preparationId=crypto.randomUUID();
 await db.query("insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id) values($1,$2,7,'capacity','matching',$3,$4,$5)",[task.id,school,await sha256(bytes(task)),task,owner]);
 await db.query("insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,vocabulary_id,target,target_source,manifest_hash,start_context) values($1,$2,$3,'capacity','capacity','capacity',80,'{}',$4,'{}')",[preparationId,owner,task.id,await sha256(bytes(task))]);
 const store=new LearningStore({database,activeOwner:()=>owner}),session=await LearningSession.create({task,preparationId,ownerUserId:owner,seed:7,startContext:{},store,owner:()=>owner}),attempt=structuredClone(session.attempt);
 const append=async(type,payload={})=>{const event={attemptId:attempt.id,eventId:crypto.randomUUID(),sequence:attempt.events.length+1,type,recordedMilliseconds:0,...payload};attempt.events.push(event);attempt.evidenceBytes+=frame(event).length;attempt.prefixHash=await extendHash(attempt.prefixHash,[event]);attempt.eventHashes.push(attempt.prefixHash);};
 for(const opportunity of attempt.schedule){await append('resume');const response={selectedDefinitionId:opportunity.wordId};await append('original',{opportunityId:opportunity.id,response,assisted:false});attempt.state.originals[opportunity.id]={opportunityId:opportunity.id,wordId:opportunity.wordId,response,assisted:false,correct:true,credit:{n:'1',d:'1'}};}
 await append('submission',{writingRevisionId:null});attempt.localRevision=1;attempt.status='submitted';attempt.state.crosswordPhase='correction';attempt.state.phase='paused';
 const state=recoverableState(attempt,attempt.state,attempt.events.length);await store.commit(attempt,[{id:crypto.randomUUID(),ownerUserId:owner,attemptId:attempt.id,kind:'checkpoint',status:'pending',localRevision:1,throughSequence:attempt.events.length,state},{id:crypto.randomUUID(),ownerUserId:owner,attemptId:attempt.id,kind:'submit',status:'pending',localRevision:2,throughSequence:attempt.events.length,state,finishDeclaration:{originalSetSubmitted:true,requiredReviewSubmitted:true}}],0);
 const repository={async mutate(kind,args,user){const size=byteLength(args);maxRequest=Math.max(maxRequest,size);assert.ok(size<=(kind==='submit'?LIMITS.terminal:LIMITS.request));const name={claim:'learning_claim_v1',checkpoint:'learning_checkpoint_v1',submit:'learning_submit_v1'}[kind];const before=performance.now();const result=(await db.query(`select private.${name}($1,$2,$3) result`,[user,args.p_operation_id,args.p_payload])).rows[0].result;requests++;console.log(`${kind} ${requests}: ${size} bytes, ${Math.round(performance.now()-before)} ms`);return result;}};
 await new LearningSync({store,repository,activeOwner:()=>owner}).drain(owner);
 const saved=await store.get('learningAttempts',owner,attempt.id);assert.equal(saved.confirmed,true);assert.equal(saved.result.points,1000);assert.equal(attempt.schedule.length,LIMITS.opportunities);assert.ok(requests>3);assert.ok(attempt.evidenceBytes<LIMITS.evidence);
 // The event-count ceiling also fits below the byte ceiling for minimal valid timer evidence.
 let minimumBytes=0;for(let i=1;i<=LIMITS.events;i++)minimumBytes+=frame({attemptId:attempt.id,eventId:crypto.randomUUID(),sequence:i,type:i===1?'resume':'timer',recordedMilliseconds:0}).length;
 assert.ok(minimumBytes<=LIMITS.evidence);
 const maximumEvents=Array.from({length:LIMITS.events},(_,i)=>({attemptId:attempt.id,eventId:crypto.randomUUID(),sequence:i+1,type:i===0?'resume':'timer',recordedMilliseconds:0}));
 const maximumReplay=(await db.query('select private.learning_evaluate_v1($1,$2,$3,80,null,false) result',[task,attempt.schedule,maximumEvents])).rows[0].result;assert.equal(maximumReplay.status,'prefix_valid');
 await assert.rejects(db.query('select private.learning_evaluate_v1($1,$2,$3,80,null,false)',[task,attempt.schedule,[...maximumEvents,{...maximumEvents[0],sequence:LIMITS.events+1}]]),/EVIDENCE_LIMIT/);
 console.log(JSON.stringify({opportunities:LIMITS.opportunities,events:attempt.events.length,evidenceBytes:attempt.evidenceBytes,requests,maxRequest,maximumEventCount:LIMITS.events,minimumBytesAtEventLimit:minimumBytes,elapsedMilliseconds:Math.round(performance.now()-started)}));
 // Populate a separate small-task board. Cloned validated rows are synthetic paging fixtures.
 const boardTask={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'quiz',sharedTargetMilliseconds:10000,words:[{id:'cat',word:'CAT',options:[{id:'yes',text:'Cat'},{id:'no',text:'Dog'}],correctOptionId:'yes'}]},boardPreparation=crypto.randomUUID();
 await db.query("insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id) values($1,$2,7,'board-capacity','quiz',$3,$4,$5)",[boardTask.id,school,await sha256(bytes(boardTask)),boardTask,owner]);
 await db.query("insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,vocabulary_id,target,target_source,manifest_hash,start_context) values($1,$2,$3,'board-capacity','board-capacity','capacity',80,'{}',$4,'{}')",[boardPreparation,owner,boardTask.id,await sha256(bytes(boardTask))]);
 const boardSession=await LearningSession.create({task:boardTask,preparationId:boardPreparation,ownerUserId:owner,seed:7,startContext:{},store,owner:()=>owner,now:()=>0});await boardSession.resume();await boardSession.original(boardSession.attempt.schedule[0].id,{optionId:'yes'});await boardSession.submit();await new LearningSync({store,repository,activeOwner:()=>owner}).drain(owner);
 const template=boardSession.attempt.id;
 await db.transaction(async tx=>{
  await tx.exec("create temporary table capacity_board_fixture as select n,gen_random_uuid() student,gen_random_uuid() preparation,gen_random_uuid() attempt,case when n<=3 then 1000-n when n<=1003 then 950 else 100 end points from generate_series(1,4999) n;alter table auth.users disable trigger user;insert into auth.users(id) select student from capacity_board_fixture;alter table auth.users enable trigger user;");
  await tx.query("insert into public.profiles(user_id,email,first_name,last_name) select student,'capacity-'||n||'@example.invalid','Capacity',lpad(n::text,5,'0') from capacity_board_fixture");
  await tx.query("insert into public.school_memberships(school_id,user_id,grade) select $1,student,'7' from capacity_board_fixture",[school]);
  await tx.query("insert into public.school_member_roles(school_id,user_id,role) select $1,student,'student' from capacity_board_fixture",[school]);
  await tx.query("insert into private.learning_result_preparations select (jsonb_populate_record(null::private.learning_result_preparations,to_jsonb(p)||jsonb_build_object('id',f.preparation,'user_id',f.student))).* from private.learning_result_preparations p cross join capacity_board_fixture f where p.id=$1",[boardPreparation]);
  await tx.query("insert into private.learning_result_attempts select (jsonb_populate_record(null::private.learning_result_attempts,to_jsonb(a)||jsonb_build_object('id',f.attempt,'user_id',f.student,'preparation_id',f.preparation,'compatibility_attempt_id',f.attempt,'predecessor_id',null))).* from private.learning_result_attempts a cross join capacity_board_fixture f where a.id=$1",[template]);
  await tx.query("insert into private.student_activity_attempts select (jsonb_populate_record(null::private.student_activity_attempts,to_jsonb(a)||jsonb_build_object('id',f.attempt,'user_id',f.student,'learning_attempt_id',f.attempt))).* from private.student_activity_attempts a cross join capacity_board_fixture f where a.id=$1",[template]);
  await tx.query("insert into private.learning_result_results select (jsonb_populate_record(null::private.learning_result_results,to_jsonb(r)||jsonb_build_object('attempt_id',f.attempt,'points',f.points))).* from private.learning_result_results r cross join capacity_board_fixture f where r.attempt_id=$1",[template]);
  await tx.query("insert into private.learning_result_board_entries(task_id,user_id,attempt_id,points,recorded_milliseconds) select $1,student,attempt,points,1000 from capacity_board_fixture",[boardTask.id]);
 });
 const reader=(await db.query('select student from capacity_board_fixture where n=4999')).rows[0].student;
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[reader]);
 let cursor=null,revision=null,digest=null,boardPages=0,largestPage=0;const pageTimes=[],top=new Map();
 do {
  const start=performance.now(),result=(await db.query('select public.get_learning_leaderboard_owned_v1($1,$2) result',[reader,JSON.stringify({taskId:boardTask.id,cursor,boardRevision:revision,orderingDigest:digest})])).rows[0].result;
  pageTimes.push(performance.now()-start);assert.equal(result.status,'ok');largestPage=Math.max(largestPage,byteLength(result));assert.ok(byteLength(result)<200*1024);
  for(const entry of result.entries)if(entry.rank<=5)top.set(entry.userId,entry);
  assert.ok(result.entries.some(entry=>entry.userId===reader && entry.rank>5));cursor=result.nextCursor;revision=result.boardRevision;digest=result.orderingDigest;boardPages++;
 }while(cursor);
 assert.equal(top.size,1004);assert.equal([...top.values()].filter(entry=>entry.rank===5).length,1000);
 await db.exec('analyze private.learning_result_board_entries');
 const plan=await db.query('explain (analyze,format json) select * from private.learning_result_board_entries where task_id=$1 order by points desc,recorded_milliseconds,user_id limit 100',[boardTask.id]);
 assert.match(JSON.stringify(plan.rows),/learning_board_rank/);
 pageTimes.sort((a,b)=>a-b);console.log(JSON.stringify({boardEntries:5000,rankFiveTies:1000,boardPages,largestPageBytes:largestPage,embeddedBoardP95Milliseconds:Math.round(pageTimes[Math.ceil(pageTimes.length*.95)-1]),rankIndex:'learning_board_rank',syntheticBoardFixture:true}));

}finally{await database.close();await deleteDB(database.dbName);await db.close();}
