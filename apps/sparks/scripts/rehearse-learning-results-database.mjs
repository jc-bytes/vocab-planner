import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {deleteDB} from 'idb';
import {learningPlatformFixture} from '../tests/helpers/learningPostgres.mjs';
import {resolveLocalDatabaseSource} from './lib/localDatabaseRehearsal.mjs';
import {ImageDB} from '../js/db.js';
import {LearningStore} from '../js/learningResults/store.js';
import {LearningSession} from '../js/learningResults/session.js';
import {LearningSync,recoverableState} from '../js/learningResults/sync.js';
import {bytes,sha256,canonical,frame,extendHash,byteLength,LIMITS} from '../js/learningResults/contract.js';
const source=resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8'),process.env);
const database=`learning_results_rehearsal_${randomBytes(8).toString('hex')}`;
const run=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',maxBuffer:100*1024*1024,stdio:['pipe','pipe','pipe']});
const args=(db,user='supabase_admin')=>['exec','-i',source.container,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -d "$2"','rehearsal',user,db];
const sql=(db,input,user)=>run(args(db,user),input).trim();
const literal=value=>`'${String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")}'`;
const query=input=>sql(database,input,'postgres');
function parallelQuery(input){return new Promise((resolve,reject)=>{const child=spawn('docker',args(database),{stdio:['pipe','pipe','pipe']});let output='',error='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>error+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve(output.trim()):reject(new Error(error)));child.stdin.end(input);});}
let created=false;const localDatabase=new ImageDB();localDatabase.dbName=`learning-native-${crypto.randomUUID()}`;
try{
 sql('postgres',`create database ${database} owner postgres;`);created=true;
 // Real PostgreSQL sessions use the same explicit managed-service fixtures as the embedded suite.
 // No source data or source schema is changed or copied into this database.
 query(learningPlatformFixture.replace('create role anon;create role authenticated;create role service_role bypassrls;',''));
 for(const filename of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort()){
  sql(database,readFileSync(new URL(`../supabase/migrations/${filename}`,import.meta.url),'utf8').replace('create extension if not exists pg_cron;','-- cron is an explicit platform fixture in this disposable database.'),'postgres');console.log(`Applied ${filename} in disposable database.`);
 }
 sql(database,'create extension if not exists plpgsql_check schema extensions;');
 const diagnostics=JSON.parse(query(`select coalesce(jsonb_agg(to_jsonb(issue)||jsonb_build_object('functionHash',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang cross join lateral extensions.plpgsql_check_function_tb(p.oid) issue where n.nspname='private' and (p.proname like 'learning_%' or p.proname in ('apply_learning_progress_rewards_v1','apply_student_activity_reward_delta_v1')) and l.lanname='plpgsql' and p.prorettype<>'trigger'::regtype and (issue.level='error' or issue.level like 'warning%');`));
 if(diagnostics.length)writeFileSync('/tmp/sparks-learning-native-lint.json',JSON.stringify(diagnostics,null,2));
 assert.deepEqual(diagnostics,[],'Learning functions must pass native PostgreSQL static checks without warnings');
 console.log('Native PostgreSQL migration and learning function lint passed.');
 const owner=crypto.randomUUID(),school=crypto.randomUUID(),preparation=crypto.randomUUID(),task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'quiz',sharedTargetMilliseconds:10000,words:[{id:'cat',word:'CAT',options:[{id:'yes',text:'Cat'},{id:'no',text:'Dog'}],correctOptionId:'yes'}]};
 query(`alter table auth.users disable trigger user;insert into auth.users(id,email) values(${literal(owner)},'native-learning@example.invalid');alter table auth.users enable trigger user;
 insert into public.schools(id,name) values(${literal(school)},'Disposable learning rehearsal');insert into public.profiles(user_id,email) values(${literal(owner)},'native-learning@example.invalid');
 insert into public.school_memberships(school_id,user_id,grade) values(${literal(school)},${literal(owner)},'7');insert into public.school_member_roles(school_id,user_id,role) values(${literal(school)},${literal(owner)},'student');
 insert into public.teacher_subjects(id,owner_id,school_id,name) values(${literal(school)},${literal(owner)},${literal(school)},'Native rehearsal');insert into public.vocabularies(id,school_id,teacher_subject_id) values('native-learning',${literal(school)},${literal(school)});
 insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id) values(${literal(task.id)},${literal(school)},7,'native-learning','quiz',${literal(await sha256(bytes(task)))},${literal(task)},${literal(owner)});
 insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,vocabulary_id,target,target_source,manifest_hash,start_context) values(${literal(preparation)},${literal(owner)},${literal(task.id)},'native-learning','native-learning','native-learning',80,'{}',${literal(await sha256(bytes(task)))},'{}');`);
 const store=new LearningStore({database:localDatabase,activeOwner:()=>owner}),session=await LearningSession.create({task,preparationId:preparation,ownerUserId:owner,seed:7,startContext:{},store,owner:()=>owner,now:()=>0});
 await session.resume();await session.original(session.attempt.schedule[0].id,{optionId:'yes'});await session.submit();
 let concurrentRequests=0;
 const repository={async mutate(kind,request){const route={claim:'claim_student_learning_attempt_owned_v1',checkpoint:'save_student_learning_checkpoint_owned_v1',submit:'submit_student_learning_result_owned_v1'}[kind];const statement=`set track_functions=${process.argv.includes('--profile')?"'all'":"'none'"};set role authenticated;set request.jwt.claim.sub=${literal(owner)};set request.jwt.claims=${literal({sub:owner,role:'authenticated'})};select public.${route}(${literal(owner)},${literal(request.p_operation_id)},${literal(request.p_payload)});`;
  const responses=await Promise.all(Array.from({length:kind==='submit'?10:2},()=>parallelQuery(statement)));concurrentRequests+=responses.length;const result=JSON.parse(responses[0]);for(const response of responses)assert.equal(canonical(JSON.parse(response)),canonical(result),'Concurrent replay must return one accepted receipt');return result;}};
 await new LearningSync({store,repository,activeOwner:()=>owner}).drain(owner);
 const saved=await store.get('learningAttempts',owner,session.attempt.id);assert.equal(saved.confirmed,true);assert.equal(saved.result.points,1000);
 const counters=JSON.parse(query(`select jsonb_build_object('finished',p.finished_runs,'mastered',p.mastered_runs,'results',(select count(*) from private.learning_result_results where attempt_id=${literal(session.attempt.id)}),'xp',(select count(*) from public.student_xp_events where attempt_id=${literal(session.attempt.id)}),'coinKeys',(select count(distinct event_key) from public.student_coin_ledger where event_key like ${literal(`learning:${session.attempt.id}:%`)})) from public.student_activity_progress p where user_id=${literal(owner)} and unit_key='native-learning' and activity_type='quiz';`));
 assert.equal(counters.finished,1);assert.equal(counters.mastered,1);assert.equal(counters.results,1);assert.equal(counters.xp,1);assert.ok(counters.coinKeys<=2);
 console.log(JSON.stringify({nativePostgres:true,concurrentRequests,terminalReplayConnections:10,points:saved.result.points,counters,hostedAcceptance:false}));
 // Run ten independent maximum-set attempts through the real public wrappers.
 const maxTask={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'matching',sharedTargetMilliseconds:10000,appearances:20,words:Array.from({length:200},(_,i)=>({id:`term-${i}`,word:`Term ${i}`,definition:`Definition ${i}`}))};
 query(`insert into private.learning_result_tasks(id,school_id,grade,content_set_id,activity_type,canonical_digest,task,creator_id) values(${literal(maxTask.id)},${literal(school)},7,'native-capacity','matching',${literal(await sha256(bytes(maxTask)))},${literal(maxTask)},${literal(owner)});`);
 const finalizations=[],maximumAttempts=[];let largestRequest=0;
 const maximumStart=performance.now();
 const maximumConcurrency=process.argv.includes('--profile')?1:10;
 for(let index=0;index<maximumConcurrency;index++){
  const student=crypto.randomUUID(),prepared=crypto.randomUUID();
  query(`alter table auth.users disable trigger user;insert into auth.users(id,email) values(${literal(student)},${literal(`native-max-${index}@example.invalid`)});alter table auth.users enable trigger user;
  insert into public.profiles(user_id,email) values(${literal(student)},${literal(`native-max-${index}@example.invalid`)});insert into public.school_memberships(school_id,user_id,grade) values(${literal(school)},${literal(student)},'7');insert into public.school_member_roles(school_id,user_id,role) values(${literal(school)},${literal(student)},'student');
  insert into private.learning_result_preparations(id,user_id,task_id,context_key,unit_key,vocabulary_id,target,target_source,manifest_hash,start_context) values(${literal(prepared)},${literal(student)},${literal(maxTask.id)},'native-capacity','native-capacity','native-learning',80,'{}',${literal(await sha256(bytes(maxTask)))},'{}');`);
  const maxStore=new LearningStore({database:localDatabase,activeOwner:()=>student}),maxSession=await LearningSession.create({task:maxTask,preparationId:prepared,ownerUserId:student,seed:7,startContext:{},store:maxStore,owner:()=>student,now:()=>0}),attempt=structuredClone(maxSession.attempt);
  const append=async(type,payload={})=>{const event={attemptId:attempt.id,eventId:crypto.randomUUID(),sequence:attempt.events.length+1,type,recordedMilliseconds:0,...payload};attempt.events.push(event);attempt.evidenceBytes+=frame(event).length;attempt.prefixHash=await extendHash(attempt.prefixHash,[event]);attempt.eventHashes.push(attempt.prefixHash);};
  for(const opportunity of attempt.schedule){await append('resume');const response={selectedDefinitionId:opportunity.wordId};await append('original',{opportunityId:opportunity.id,response,assisted:false});attempt.state.originals[opportunity.id]={opportunityId:opportunity.id,wordId:opportunity.wordId,response,assisted:false,correct:true,credit:{n:'1',d:'1'}};}
  await append('submission',{writingRevisionId:null});attempt.localRevision=1;attempt.status='submitted';attempt.state.crosswordPhase='correction';attempt.state.phase='paused';
  const state=recoverableState(attempt,attempt.state,attempt.events.length);await maxStore.commit(attempt,[{id:crypto.randomUUID(),ownerUserId:student,attemptId:attempt.id,kind:'checkpoint',status:'pending',localRevision:1,throughSequence:attempt.events.length,state},{id:crypto.randomUUID(),ownerUserId:student,attemptId:attempt.id,kind:'submit',status:'pending',localRevision:2,throughSequence:attempt.events.length,state,finishDeclaration:{originalSetSubmitted:true,requiredReviewSubmitted:true}}],0);
  maximumAttempts.push({student,store:maxStore,attempt});
 }
 // Hold every terminal until all ten independent connections can finalize together.
 let readyCount=0,releaseTerminals;const terminalGate=new Promise(resolve=>{releaseTerminals=resolve;});
 await Promise.all(maximumAttempts.map(async({student,store:maxStore,attempt})=>{
  const maxRepository={async mutate(kind,request){largestRequest=Math.max(largestRequest,byteLength(request));assert.ok(byteLength(request)<=(kind==='submit'?LIMITS.terminal:LIMITS.request));
   if(kind==='submit'){readyCount++;if(readyCount===maximumConcurrency)releaseTerminals();await terminalGate;}
   const route={claim:'claim_student_learning_attempt_owned_v1',checkpoint:'save_student_learning_checkpoint_owned_v1',submit:'submit_student_learning_result_owned_v1'}[kind],start=performance.now();
   const result=JSON.parse(await parallelQuery(`set track_functions=${process.argv.includes('--profile')?"'all'":"'none'"};set role authenticated;set request.jwt.claim.sub=${literal(student)};set request.jwt.claims=${literal({sub:student,role:'authenticated'})};select public.${route}(${literal(student)},${literal(request.p_operation_id)},${literal(request.p_payload)});`));if(kind==='submit')finalizations.push(performance.now()-start);return result;}};
  await new LearningSync({store:maxStore,repository:maxRepository,activeOwner:()=>student}).drain(student);const completed=await maxStore.get('learningAttempts',student,attempt.id);assert.equal(completed.confirmed,true);assert.equal(completed.result.points,1000);
 }));
 const functionProfile=JSON.parse(query("select coalesce(jsonb_agg(to_jsonb(f) order by self_time desc),'[]') from pg_stat_user_functions f where funcname like '%learning%'"));console.log(JSON.stringify({functionProfile}));
 finalizations.sort((a,b)=>a-b);console.log(JSON.stringify({nativeMaximumAttempts:maximumConcurrency,opportunitiesPerAttempt:4000,eventsPerAttempt:8001,largestRequestBytes:largestRequest,terminalMilliseconds:finalizations.map(Math.round),tenConcurrentTerminalP95Milliseconds:Math.round(finalizations.at(-1)),totalMilliseconds:Math.round(performance.now()-maximumStart),p95BudgetMilliseconds:2000,withinBudget:finalizations.at(-1)<2000}));

 // Synthetic cloned rows measure the actual board query, including its ordering digest.
 const boardReader=query(`begin;create temporary table native_board_fixture as select n,gen_random_uuid() student,gen_random_uuid() preparation,gen_random_uuid() attempt,case when n<=3 then 1000-n when n<=1003 then 950 else 100 end points from generate_series(1,4999) n;
 alter table auth.users disable trigger user;insert into auth.users(id) select student from native_board_fixture;alter table auth.users enable trigger user;
 insert into public.profiles(user_id,email,first_name,last_name) select student,'native-board-'||n||'@example.invalid','Capacity',lpad(n::text,5,'0') from native_board_fixture;
 insert into public.school_memberships(school_id,user_id,grade) select ${literal(school)},student,'7' from native_board_fixture;
 insert into public.school_member_roles(school_id,user_id,role) select ${literal(school)},student,'student' from native_board_fixture;
 insert into private.learning_result_preparations select (jsonb_populate_record(null::private.learning_result_preparations,to_jsonb(p)||jsonb_build_object('id',f.preparation,'user_id',f.student))).* from private.learning_result_preparations p cross join native_board_fixture f where p.id=${literal(preparation)};
 insert into private.learning_result_attempts select (jsonb_populate_record(null::private.learning_result_attempts,to_jsonb(a)||jsonb_build_object('id',f.attempt,'user_id',f.student,'preparation_id',f.preparation,'compatibility_attempt_id',f.attempt,'predecessor_id',null))).* from private.learning_result_attempts a cross join native_board_fixture f where a.id=${literal(session.attempt.id)};
 insert into private.student_activity_attempts select (jsonb_populate_record(null::private.student_activity_attempts,to_jsonb(a)||jsonb_build_object('id',f.attempt,'user_id',f.student,'learning_attempt_id',f.attempt))).* from private.student_activity_attempts a cross join native_board_fixture f where a.id=${literal(session.attempt.id)};
 insert into private.learning_result_results select (jsonb_populate_record(null::private.learning_result_results,to_jsonb(r)||jsonb_build_object('attempt_id',f.attempt,'points',f.points))).* from private.learning_result_results r cross join native_board_fixture f where r.attempt_id=${literal(session.attempt.id)};
 insert into private.learning_result_board_entries(task_id,user_id,attempt_id,points,recorded_milliseconds) select ${literal(task.id)},student,attempt,points,1000 from native_board_fixture;
 select student from native_board_fixture where n=4999;commit;`);
 let boardCursor=null,boardRevision=null,orderingDigest=null,largestPage=0,boardPages=0;const boardTimes=[],top=new Map();
 do{
  const start=performance.now(),result=JSON.parse(await parallelQuery(`set role authenticated;set request.jwt.claim.sub=${literal(boardReader)};select public.get_learning_leaderboard_owned_v1(${literal(boardReader)},${literal(JSON.stringify({taskId:task.id,cursor:boardCursor,boardRevision,orderingDigest}))});`));
  boardTimes.push(performance.now()-start);assert.equal(result.status,'ok');largestPage=Math.max(largestPage,byteLength(result));assert.ok(byteLength(result)<200*1024);for(const entry of result.entries)if(entry.rank<=5)top.set(entry.userId,entry);assert.ok(result.entries.some(entry=>entry.userId===boardReader && entry.rank>5));boardCursor=result.nextCursor;boardRevision=result.boardRevision;orderingDigest=result.orderingDigest;boardPages++;
 }while(boardCursor);
 assert.equal(top.size,1004);assert.equal([...top.values()].filter(entry=>entry.rank===5).length,1000);boardTimes.sort((a,b)=>a-b);
 query('analyze private.learning_result_board_entries');assert.match(query(`explain (analyze,format json) select * from private.learning_result_board_entries where task_id=${literal(task.id)} order by points desc,recorded_milliseconds,user_id limit 100`),/learning_board_rank/);
 console.log(JSON.stringify({nativeBoardEntries:5000,rankFiveTies:1000,boardPages,largestPageBytes:largestPage,boardP95Milliseconds:Math.round(boardTimes.at(-1)),p95BudgetMilliseconds:500,withinBudget:boardTimes.at(-1)<500,syntheticBoardFixture:true}));

 if(process.env.SPARKS_LEARNING_ENFORCE_BUDGETS==='1'){
  assert.equal(maximumConcurrency,10,'Release measurement requires ten independent maximum-size attempts');
  assert.ok(finalizations.at(-1)<2000,'Ten concurrent maximum-size terminal p95 exceeds 2000ms');
  assert.ok(boardTimes.at(-1)<500,'5000-entry board p95 exceeds 500ms');
  console.log('Enforced local native performance budgets passed.');
 }

}finally{
 await localDatabase.close();await deleteDB(localDatabase.dbName);
 if(created){sql('postgres',`select pg_terminate_backend(pid) from pg_stat_activity where datname=${literal(database)} and pid<>pg_backend_pid();drop database ${database};`);console.log('Dropped disposable learning database.');}
}
