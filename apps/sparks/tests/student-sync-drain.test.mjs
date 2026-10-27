import assert from 'node:assert/strict';
import test from 'node:test';
import {fixture,imageDB} from './helpers/studentQueueFixture.mjs';

test('many distinct blocked lanes cannot exhaust an unbounded cycle or exclude new independent healthy heads next cycle',async()=>{
 const f=await fixture('many-heads-contract');try{
  f.queue.maxDrainAttempts=4;f.queue.maxDrainDurationMs=90;
  await f.seed(20,true);
  const draining=f.queue.flushLocalSyncQueue({silent:true});await f.first.promise;
  await f.addHealthy('owner-a');await draining;
  const firstCycleAttempts=f.requests.length;
  await f.queue.flushLocalSyncQueue({silent:true});
  assert.equal(f.requests.filter(r=>!r.eventId?.startsWith('stalled')).length,2,'new Spark/unit heads require next-cycle access even while many older stalled heads remain');
  assert.ok(firstCycleAttempts<=4,`one cycle attempted ${firstCycleAttempts} records`);
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).length,20);
 }finally{await f.close();}
});

test('a deferred activity head prevents a related unit write overtaking it while an unrelated Spark still syncs',async()=>{
 const f=await fixture('causal-head-contract');try{
  const head=await imageDB.enqueueSyncAction('student-activity-progress',{eventId:'causal-head',unitKey:'same-unit',activityType:'matching',score:20},{ownerUserId:'owner-a'});
  const db=await imageDB.open();await db.put(imageDB.syncStoreName,{...head,createdAt:'2000-01-01T00:00:00.000Z',nextAttemptAt:new Date(Date.now()+5000).toISOString()});
  await imageDB.enqueueSyncAction('student-unit-work',{eventId:'later-same-unit',unitKey:'same-unit',snapshotOrder:1,workPatch:{notes:'later'}},{ownerUserId:'owner-a'});
  await imageDB.enqueueSyncAction('student-spark-response',{eventId:'unrelated-spark',sparkId:'other',answers:{q:'fixture'}},{ownerUserId:'owner-a'});
  await f.queue.flushLocalSyncQueue({silent:true});
  assert.equal(f.requests.filter(r=>r.sparkId==='other').length,1);
  assert.equal(f.requests.filter(r=>r.eventId==='later-same-unit').length,0,'same-unit cross-type order must be preserved');
  assert.ok((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).some(r=>r.payload.eventId==='later-same-unit'));
 }finally{await f.close();}
});

test('same-owner generation follow-up runs after the old handled drain without overlap or losing its request',async()=>{
 const f=await fixture('generation-followup-contract');try{
  await f.seed();const old=f.queue.flushLocalSyncQueue({silent:true});await f.first.promise;
  f.cloud.cloudGeneration++;f.service.currentUser={uid:'owner-a'};f.service.authIdentityGeneration++;
  await imageDB.enqueueSyncAction('student-spark-response',{eventId:'new-generation',sparkId:'new',answers:{q:'fixture'}},{ownerUserId:'owner-a'});
  const next=f.queue.flushLocalSyncQueue({silent:true});await Promise.all([old,next]);
  assert.equal(f.requests.filter(r=>r.sparkId==='new').length,1,'joining an obsolete operation must not lose the newer-generation request');
  assert.equal(f.maxActive(),1,'same-owner drains must serialize across generation changes');
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).length,5);
 }finally{await f.close();}
});

test('finite independent arrivals do not starve older retry lanes or discard receipts',async()=>{
 const f=await fixture('finite-arrivals');try{
  f.queue.maxDrainAttempts=4;f.queue.maxDrainDurationMs=90;
  // Fairness is about bounded attempt opportunities, not host scheduling time.
  // Advance between cycles; separate tests exercise elapsed-time deadlines.
  let cycleNow=Date.now();f.queue.scheduler.now=()=>cycleNow;await f.seed(20,true);
  for(let cycle=0;cycle<19;cycle++){
   if(cycle>0&&cycle<4)await imageDB.enqueueSyncAction('student-spark-response',{eventId:`new-${cycle}`,sparkId:`new-${cycle}`,answers:{}},{ownerUserId:'owner-a'});
   cycleNow=Date.now()+cycle*1000;
   await f.queue.flushLocalSyncQueue({silent:true});
  }
  const rows=await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true});
  assert.equal(rows.length,20);assert.ok(rows.every(row=>row.attempts>=2));
  assert.ok(rows.every(row=>row.payload.eventId.startsWith('stalled-')));
  assert.equal(f.requests.filter(r=>r.sparkId).length,3);assert.equal(f.maxActive(),1);
 }finally{await f.close();}
});

test('a valid response slower than the cycle window keeps its full operation deadline',async()=>{
 const f=await fixture('slow-valid');try{
  f.queue.maxDrainDurationMs=30;const calls=[];
  f.service.client.rpc=(name,args)=>({abortSignal(signal){calls.push(name);return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>resolve({data:name==='submit_student_activity_progress_owned_v1'?{activity:{score:20}}:{spark_id:args.p_spark_id}}),name==='submit_student_activity_progress_owned_v1'?60:0);
   signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
  });}});
  const {supabaseService}=await import('../js/supabaseService.js');
  supabaseService.submitStudentActivityProgress=(payload,options)=>f.service.submitStudentActivityProgress(payload,{...options,timeoutMs:100});
  await imageDB.enqueueSyncAction('student-activity-progress',{eventId:'slow-valid',unitKey:'slow-unit',activityType:'matching',score:20},{ownerUserId:'owner-a'});
  await imageDB.enqueueSyncAction('student-spark-response',{eventId:'next',sparkId:'next',answers:{}},{ownerUserId:'owner-a'});
  await f.queue.flushLocalSyncQueue({silent:true});assert.equal(calls.length,1);assert.equal(f.applied.length,1);
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).length,1);
  await f.queue.flushLocalSyncQueue({silent:true});assert.equal(calls.length,2);
 }finally{await f.close();}
});

test('private owner cancellation leaves old receipts unchanged and allows an isolated new-owner drain',async()=>{
 const f=await fixture('owner-cancel');try{
  await f.seed();const old=f.queue.flushLocalSyncQueue({silent:true});await f.first.promise;
  f.cloud.cloudGeneration++;f.sm.currentUser={uid:'owner-b'};f.service.currentUser={uid:'owner-b'};f.service.authIdentityGeneration++;
  f.queue.resetUnitSnapshots();await f.addHealthy('owner-b');
  await Promise.all([old,f.queue.flushLocalSyncQueue({silent:true})]);
  const rows=await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true});
  assert.equal(rows.length,5);assert.ok(rows.every(row=>row.revision===1&&row.attempts===0));
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-b',includeDeferred:true})).length,0);
  assert.equal(f.queue.drainScheduler.active.size,0);assert.ok(!f.queue.drainScheduler.history.has('owner-a'));
 }finally{await f.close();}
});

test('obsolete IDB failure cannot reject managed joiners or discard the latest generation follow-up',async()=>{
 const f=await fixture('failed-idb-followup');
 const original=imageDB.markSyncActionFailed;let entered,release;
 const marking=new Promise(r=>entered=r),held=new Promise((_,reject)=>release=reject);
 try{
  await f.seed(1);imageDB.markSyncActionFailed=async()=>{entered();return held;};
  const first=f.queue.flushLocalSyncQueue({silent:true});await marking;
  f.cloud.cloudGeneration=3;
  await imageDB.enqueueSyncAction('student-spark-response',{eventId:'latest',sparkId:'latest',answers:{}},{ownerUserId:'owner-a'});
  const latest=f.queue.flushLocalSyncQueue({silent:true});
  const obsolete=f.queue.flushLocalSyncQueue({silent:true,generation:2});
  imageDB.markSyncActionFailed=original;release(new Error('IDB write failed'));
  const joined=await Promise.allSettled([first,latest,obsolete]);
  assert.ok(joined.every(result=>result.status==='fulfilled'));
  assert.equal(f.requests.filter(r=>r.sparkId==='latest').length,1);assert.equal(f.maxActive(),1);
  assert.equal(f.queue.drainScheduler.active.size,0);
 }finally{imageDB.markSyncActionFailed=original;await f.close();}
});

test('unexpected current IDB failure stays visible and retains its unacknowledged receipt',async()=>{
 const f=await fixture('visible-idb-failure'),original=imageDB.markSyncActionFailed;
 try{
  await f.seed(1);imageDB.markSyncActionFailed=async()=>{throw new Error('IDB write failed');};
  await assert.rejects(f.queue.flushLocalSyncQueue({silent:true}),/IDB write failed/);
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).length,1);
  assert.equal(f.queue.drainScheduler.active.size,0);
 }finally{imageDB.markSyncActionFailed=original;await f.close();}
});

test('older activity acknowledgement preserves a newer RAM draft after both transport and enqueue fail',async()=>{
 const f=await fixture('newer-ram-draft'),originalEnqueue=imageDB.enqueueSyncAction;
 const {StudentActivityProgressPersistence}=await import('../js/student/studentActivityProgressPersistenceMethods.js');
 const {supabaseService}=await import('../js/supabaseService.js');
 const originalWrite=supabaseService.syncStudentUnitWork;
 try{
  f.sm.progressData={units:{same:{states:{flashcards:{currentIndex:0}},scores:{}}}};
  f.sm.progress={saveLocalProgress(){},applyCoinSnapshot(){},updateLevelDisplay(){}};
  f.sm.currentVocab={id:'same'};f.sm.activities={sm:f.sm,getUnitProgressKey:()=> 'same'};
  f.sm.activities.progressPersistence=new StudentActivityProgressPersistence(f.sm.activities);
  await imageDB.enqueueSyncAction('student-activity-progress',{eventId:'older-completion',unitKey:'same',activityType:'flashcards'},{ownerUserId:'owner-a'});
  const draft=f.queue.buildUnitWorkSyncPayload();
  supabaseService.syncStudentUnitWork=async()=>{throw new Error('Network unavailable');};
  await assert.rejects(f.queue.executeUnitWork(draft),/Network unavailable/);
  imageDB.enqueueSyncAction=async()=>{throw new Error('Quota exceeded');};
  await assert.rejects(f.queue.enqueueProgressSync({payload:draft}),/Quota exceeded/);
  imageDB.enqueueSyncAction=originalEnqueue;supabaseService.syncStudentUnitWork=originalWrite;
  supabaseService.submitStudentActivityProgress=async()=>({activity:{unitKey:'same',activityType:'flashcards',score:100,verified:true,bestAttempt:{state:{currentIndex:1},details:{summary:'Verified completion'}}}});
  await f.queue.flushLocalSyncQueue({silent:true});
  const unit=f.sm.progressData.units.same;
  assert.equal(unit.states.flashcards.currentIndex,0,'authoritative score must not replace unpersisted newer work');
  assert.equal(unit.scores.flashcards.score,100);assert.equal(unit.scores.flashcards.verified,true);
  assert.equal(unit.scores.flashcards.bestAttempt.state.currentIndex,1,'best-attempt evidence remains coherent');
  assert.equal(f.queue.getAuthStatus(),'Newer work is not synced. Keep this page open.');
  assert.equal(f.queue.buildUnitWorkSyncPayload().workPatch.states.flashcards.currentIndex,0);
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).length,0);
 }finally{imageDB.enqueueSyncAction=originalEnqueue;supabaseService.syncStudentUnitWork=originalWrite;await f.close();}
});

test('legacy full-snapshot activity acknowledgement preserves unsaved states through the real core fallback',async()=>{
 const f=await fixture('legacy-draft');
 const {StudentActivityProgressPersistence}=await import('../js/student/studentActivityProgressPersistenceMethods.js');
 const {StudentProgressCore}=await import('../js/student/studentProgressCoreMethods.js');
 const {supabaseService}=await import('../js/supabaseService.js');
 try{
  f.sm.progressData={units:{same:{states:{flashcards:{currentIndex:0}},scores:{}}}};
  f.sm.currentVocab={id:'same'};f.sm.activities={sm:f.sm,getUnitProgressKey:()=> 'same'};
  const core=Object.create(StudentProgressCore.prototype);
  Object.assign(core,{sm:f.sm,migrateCoinData:()=>({coinData:{balance:7},coinHistory:[]}),updateLevelDisplay(){},saveLocalProgress(){}});
  f.sm.updateCoinDisplay=()=>{};
  f.sm.progress=f.cloud.progress={applyProgressSnapshot:core.applyProgressSnapshot.bind(core)};
  const persistence=new StudentActivityProgressPersistence(f.sm.activities);f.sm.activities.progressPersistence=persistence;
  await imageDB.enqueueSyncAction('student-activity-progress',{eventId:'legacy-completion',unitKey:'same',activityType:'flashcards'},{ownerUserId:'owner-a'});
  f.queue.buildUnitWorkSyncPayload();
  supabaseService.submitStudentActivityProgress=async()=>({units:{same:{states:{flashcards:{currentIndex:1}},scores:{flashcards:{score:100}}}},totalXp:25});
  await f.queue.flushLocalSyncQueue({silent:true});
  assert.equal(f.sm.progressData.units.same.states.flashcards.currentIndex,0);
  assert.equal(f.sm.progressData.units.same.scores.flashcards.score,100);assert.equal(f.sm.progressData.totalXp,25);assert.equal(f.sm.coins,7);
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).length,0);
  // Startup without the activity persistence object uses the same core option.
  delete f.sm.activities.progressPersistence;
  await imageDB.enqueueSyncAction('student-activity-progress',{eventId:'legacy-no-active-module',unitKey:'same',activityType:'flashcards'},{ownerUserId:'owner-a'});
  await f.queue.flushLocalSyncQueue({silent:true});
  assert.equal(f.sm.progressData.units.same.states.flashcards.currentIndex,0);
 }finally{await f.close();}
});

test('actual startup and online background drains contain IDB failure and suppress stale-owner attention',async()=>{
 const f=await fixture('background-boundary');
 const {StudentProgressCloud}=await import('../js/student/studentProgressCloudMethods.js');
 const {studentProgressRepository}=await import('../js/services/studentProgressRepository.js');
 const originalSubscribe=studentProgressRepository.subscribe,originalMark=imageDB.markSyncActionFailed;
 const unhandled=[];const listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);
 let cloud;
 try{
  await f.seed(1);studentProgressRepository.subscribe=()=>()=>{};
  const progress={sm:f.sm,queryService:{observe:()=>({unsubscribe(){}})}};
  cloud=new StudentProgressCloud(progress);cloud.syncQueue.scheduler=f.queue.scheduler;
  let failed;const failedOnce=()=>new Promise(resolve=>failed=resolve);
  let observed=failedOnce();
  imageDB.markSyncActionFailed=async()=>{failed();throw new Error('IDB unavailable');};
  cloud.startCoinSync();await observed;await new Promise(r=>setImmediate(r));
  assert.equal(cloud.syncQueue.getAuthStatus(),'Local sync needs attention');
  observed=failedOnce();cloud.onlineSyncHandler();await observed;await new Promise(r=>setImmediate(r));
  assert.equal(cloud.syncQueue.getAuthStatus(),'Local sync needs attention');
  let release;const held=new Promise((_,reject)=>release=reject);observed=failedOnce();
  imageDB.markSyncActionFailed=async()=>{failed();return held;};
  cloud.onlineSyncHandler();await observed;
  f.sm.currentUser={uid:'owner-b'};cloud.cloudGeneration++;cloud.syncQueue.resetUnitSnapshots();
  f.statuses.length=0;release(new Error('IDB unavailable'));await new Promise(r=>setImmediate(r));
  assert.deepEqual(f.statuses,[]);assert.deepEqual(unhandled,[]);
  const rows=await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true});
  assert.equal(rows.length,1);assert.equal(rows[0].revision,1);assert.equal(rows[0].attempts,0);
 }finally{cloud?.stopCoinSync();imageDB.markSyncActionFailed=originalMark;studentProgressRepository.subscribe=originalSubscribe;process.off('unhandledRejection',listener);await f.close();}
});

test('late pending read cannot update a replacement account status',async()=>{
 const f=await fixture('late-read-status'),original=imageDB.getPendingSyncActions;
 try{
  await f.seed(1);let entered,release;const waiting=new Promise(r=>entered=r),held=new Promise(r=>release=r);
  imageDB.getPendingSyncActions=async options=>{const rows=await original.call(imageDB,options);entered();await held;return rows;};
  const old=f.queue.flushLocalSyncQueue({silent:true});await waiting;
  f.sm.currentUser={uid:'owner-b'};f.cloud.cloudGeneration++;f.queue.resetUnitSnapshots();f.statuses.length=0;
  release();await old;assert.deepEqual(f.statuses,[]);assert.equal(f.requests.length,0);
 }finally{imageDB.getPendingSyncActions=original;await f.close();}
});

for (const mode of ['live','reload','newer-ram']) test(`later durable state survives bounded C acknowledgement (${mode})`,async()=>{
 const reload=mode==='reload',expectedIndex=mode==='newer-ram'?2:0;
 const f=await fixture(`durable-successor-${reload}`);
 const {StudentActivityProgressPersistence}=await import('../js/student/studentActivityProgressPersistenceMethods.js');
 const {StudentProgressCloud}=await import('../js/student/studentProgressCloudMethods.js');
 const {supabaseService}=await import('../js/supabaseService.js');
 try{
  f.sm.progressData={units:{same:{states:{flashcards:{currentIndex:0}},scores:{}}}};
  f.sm.currentVocab={id:'same'};f.sm.coinData={balance:7};f.sm.mergeStudentProfile=(_,profile)=>profile;f.sm.updateCoinDisplay=()=>{};
  f.sm.progress=f.cloud.progress={saveLocalProgress(){},applyCoinSnapshot(){},updateLevelDisplay(){},migrateCoinData:data=>({coinData:data.coinData,coinHistory:[]})};
  f.sm.activities={sm:f.sm,getUnitProgressKey:()=> 'same'};f.sm.activities.progressPersistence=new StudentActivityProgressPersistence(f.sm.activities);
  for(let n=0;n<3;n++)await imageDB.enqueueSyncAction('student-spark-response',{eventId:`before-${n}`,sparkId:`before-${n}`,answers:{}},{ownerUserId:'owner-a'});
  await imageDB.enqueueSyncAction('student-activity-progress',{eventId:'C',unitKey:'same',activityType:'flashcards'},{ownerUserId:'owner-a'});
  const b=f.queue.buildUnitWorkSyncPayload();await f.queue.enqueueProgressSync({payload:b});
  if(reload){
   f.queue.resetUnitSnapshots();f.cloud.syncQueue=f.queue;f.cloud.restoreImagesFromProgress=async()=>{};
   supabaseService.ensureOwnStudentProgress=async()=>({units:{same:{states:{flashcards:{currentIndex:1}},scores:{}}},coinData:{balance:7},coinHistory:[]});
   await StudentProgressCloud.prototype.loadCloudProgress.call(f.cloud);
   assert.equal(f.sm.progressData.units.same.states.flashcards.currentIndex,0,'real startup restores durable educational work before publishing cloud state');
  }
  if(mode==='newer-ram'){f.sm.progressData.units.same.states.flashcards.currentIndex=2;f.queue.buildUnitWorkSyncPayload();}
  supabaseService.submitStudentActivityProgress=async()=>({activity:{unitKey:'same',activityType:'flashcards',score:100,verified:true,bestAttempt:{state:{currentIndex:1}}}});
  await f.queue.flushLocalSyncQueue({silent:true});
  const pending=await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true});
  assert.equal(pending.length,1);assert.equal(pending[0].payload.eventId,b.eventId);
  assert.equal(f.sm.progressData.units.same.states.flashcards.currentIndex,expectedIndex);
  const next=f.queue.buildUnitWorkSyncPayload();await f.queue.enqueueProgressSync({payload:next});
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true}))[0].payload.workPatch.states.flashcards.currentIndex,expectedIndex);
  assert.equal(f.sm.progressData.units.same.scores.flashcards.score,100);
 }finally{await f.close();}
});

test('pending hydration mirrors educational unit-work fields and object state-map semantics without marking RAM durable',async()=>{
 const f=await fixture('hydration-contract');try{
  for(const [unitKey,states] of [['empty',{}],['absent',undefined],['null',null]]){
   await imageDB.enqueueSyncAction('student-unit-work',{eventId:unitKey,unitKey,snapshotOrder:1,unitContext:{unitName:'',grade:'6'},
    workPatch:{notes:'pending',...(states===undefined?{}:{states}),scores:{bad:true},coins:999,coinData:{balance:999},coinHistory:[1]}},{ownerUserId:'owner-a'});
  }
  await imageDB.enqueueSyncAction('student-unit-work',{eventId:'foreign',unitKey:'foreign',workPatch:{notes:'private'}},{ownerUserId:'owner-b'});
  const remote=Object.fromEntries(['empty','absent','null'].map(key=>[key,{states:{flashcards:{currentIndex:1}},notes:'remote',scores:{flashcards:{score:100}},unitName:'Published name'}]));
  const restored=await f.queue.restorePendingUnitWork(remote,{ownerUserId:'owner-a',generation:1});
  assert.deepEqual(restored.empty.states,{});assert.deepEqual(restored.absent.states,remote.absent.states);assert.deepEqual(restored.null.states,remote.null.states);
  for(const unit of Object.values(restored)){assert.equal(unit.notes,'pending');assert.equal(unit.scores.flashcards.score,100);assert.equal(unit.coins,undefined);assert.equal(unit.coinData,undefined);assert.equal(unit.coinHistory,undefined);assert.equal(unit.unitName,'Published name');assert.equal(unit.grade,'6');}
  assert.equal(restored.foreign,undefined);assert.equal(f.queue.durableUnitSnapshots.size,0);
 }finally{await f.close();}
});

for(const scenario of ['newer-ram','retired-pending','owner-change','generation-change','read-failure'])test(`actual cloud hydration handles ${scenario} during durable read before publishing`,async()=>{
 const f=await fixture(`hydration-${scenario}`),originalRead=imageDB.getPendingSyncActions;
 const {StudentProgressCloud}=await import('../js/student/studentProgressCloudMethods.js');
 const {supabaseService}=await import('../js/supabaseService.js');
 const {notifications}=await import('../js/notifications.js');const originalWarning=notifications.warning;
 try{
  notifications.warning=()=>{};
  f.sm.progressData={units:{same:{states:{flashcards:{currentIndex:0}},scores:{}}}};f.sm.currentVocab={id:'same'};
  f.sm.activities={getUnitProgressKey:()=> 'same'};f.sm.coinData={balance:7};f.sm.mergeStudentProfile=(_,profile)=>profile;f.sm.updateCoinDisplay=()=>{};
  const saved=[];f.sm.progress=f.cloud.progress={saveLocalProgress:()=>saved.push(structuredClone(f.sm.progressData)),migrateCoinData:data=>({coinData:data.coinData,coinHistory:[]})};
  f.cloud.syncQueue=f.queue;f.cloud.restoreImagesFromProgress=async()=>{};
  const b=f.queue.buildUnitWorkSyncPayload();await f.queue.enqueueProgressSync({payload:b});
  supabaseService.ensureOwnStudentProgress=async()=>({units:{same:{states:{flashcards:{currentIndex:1}},scores:{flashcards:{score:100}}}},coinData:{balance:7},coinHistory:[]});
  let entered,release;const enteredRead=new Promise(r=>entered=r),hold=new Promise((resolve,reject)=>release={resolve,reject});
  imageDB.getPendingSyncActions=async options=>{const rows=await originalRead.call(imageDB,options);entered();await hold;return scenario==='retired-pending'?originalRead.call(imageDB,options):rows;};
  const loading=StudentProgressCloud.prototype.loadCloudProgress.call(f.cloud);await enteredRead;
  if(scenario==='retired-pending')await imageDB.retireUnitSyncActions(b,{ownerUserId:'owner-a'});
  if(['newer-ram','retired-pending'].includes(scenario)){f.sm.progressData.units.same.states.flashcards.currentIndex=2;f.queue.buildUnitWorkSyncPayload();}
  if(scenario==='owner-change'){f.sm.currentUser={uid:'owner-b'};f.cloud.cloudGeneration++;}
  if(scenario==='generation-change')f.cloud.cloudGeneration++;
  f.statuses.length=0;
  if(scenario==='read-failure'){release.reject(new Error('IDB read unavailable'));await assert.rejects(loading,/IDB read unavailable/);}
  else{release.resolve();await loading;}
  if(['newer-ram','retired-pending'].includes(scenario)){assert.equal(f.sm.progressData.units.same.states.flashcards.currentIndex,2);assert.equal(saved[0].units.same.states.flashcards.currentIndex,2);assert.equal(f.sm.progressData.units.same.scores.flashcards.score,100);assert.equal(f.queue.hasUnpersistedUnitDraft('owner-a','same'),true);}
  else{assert.equal(f.sm.progressData.units.same.states.flashcards.currentIndex,0);assert.equal(saved.length,0);if(scenario!=='read-failure')assert.deepEqual(f.statuses,[]);}
  imageDB.getPendingSyncActions=originalRead;
  if(scenario==='retired-pending'){
   assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).length,0);
   const next=f.queue.buildUnitWorkSyncPayload();assert.equal(next.workPatch.states.flashcards.currentIndex,2);
  }else assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true}))[0].payload.eventId,b.eventId);
 }finally{imageDB.getPendingSyncActions=originalRead;notifications.warning=originalWarning;await f.close();}
});

for(const states of [undefined,null])test(`notes-only successor ${states===null?'null':'absent'} state does not suppress normal activity state projection`,async()=>{
 const f=await fixture(`notes-only-${states}`);
 const {StudentActivityProgressPersistence}=await import('../js/student/studentActivityProgressPersistenceMethods.js');
 const {supabaseService}=await import('../js/supabaseService.js');
 try{
  f.sm.progressData={units:{same:{states:{flashcards:{currentIndex:0}},scores:{}}}};f.sm.progress={saveLocalProgress(){},applyCoinSnapshot(){},updateLevelDisplay(){}};
  f.sm.activities={sm:f.sm,getUnitProgressKey:()=> 'same'};f.sm.activities.progressPersistence=new StudentActivityProgressPersistence(f.sm.activities);
  await imageDB.enqueueSyncAction('student-activity-progress',{eventId:'C',unitKey:'same',activityType:'flashcards'},{ownerUserId:'owner-a'});
  await imageDB.enqueueSyncAction('student-unit-work',{eventId:'notes',unitKey:'same',snapshotOrder:1,workPatch:{notes:'later',...(states===null?{states:null}:{})}},{ownerUserId:'owner-a'});
  f.queue.maxDrainAttempts=1;
  supabaseService.submitStudentActivityProgress=async()=>({activity:{unitKey:'same',activityType:'flashcards',score:100,bestAttempt:{state:{currentIndex:1}}}});
  await f.queue.flushLocalSyncQueue({silent:true});
  assert.equal(f.sm.progressData.units.same.states.flashcards.currentIndex,1);
 }finally{await f.close();}
});

test('scheduled retry contains a failed status observer after IDB rejection without losing its receipt',async()=>{
 const f=await fixture('retry-observer'),original=imageDB.markSyncActionFailed;
 const unhandled=[];const listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);
 try{
  await f.seed(1);let entered;const failed=new Promise(r=>entered=r);
  imageDB.markSyncActionFailed=async()=>{entered();throw new Error('IDB unavailable');};
  f.sm.setAuthStatus=message=>{if(message==='Local sync needs attention')throw new Error('Disposed status observer');};
  f.queue.scheduleRetry({ownerUserId:'owner-a',generation:1});f.timers.at(-1).callback();
  await failed;await new Promise(r=>setImmediate(r));
  assert.deepEqual(unhandled,[]);
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a',includeDeferred:true})).length,1);
 }finally{imageDB.markSyncActionFailed=original;process.off('unhandledRejection',listener);await f.close();}
});

for(const delta of [-1,0,1])test(`hydration respects durable snapshot precedence against RAM (durable order delta ${delta})`,async()=>{
 const f=await fixture(`durable-precedence-${delta}`);
 try{
  f.sm.progressData={units:{same:{states:{flashcards:{currentIndex:1}},scores:{}}}};
  f.sm.currentVocab={id:'same'};f.sm.activities={getUnitProgressKey:()=> 'same'};
  const ram=f.queue.buildUnitWorkSyncPayload();
  const committed={eventId:'other-tab-E',unitKey:'same',snapshotOrder:ram.snapshotOrder+delta,workPatch:{states:{flashcards:{currentIndex:2}}}};
  await imageDB.enqueueSyncAction('student-unit-work',committed,{ownerUserId:'owner-a'});
  const restored=await f.queue.restorePendingUnitWork({same:{states:{flashcards:{currentIndex:0}},scores:{flashcards:{score:100}}}},{ownerUserId:'owner-a',generation:1});
  assert.equal(restored.same.states.flashcards.currentIndex,delta<0?1:2);
  assert.equal(restored.same.scores.flashcards.score,100);
  assert.equal(f.queue.latestUnitSnapshots.get('same'),ram.snapshotOrder);
  assert.equal(f.queue.durableUnitSnapshots.size,0,'projection cannot acknowledge the RAM draft');
  assert.equal((await imageDB.getPendingSyncActions({ownerUserId:'owner-a'}))[0].payload.eventId,committed.eventId);
 }finally{await f.close();}
});
