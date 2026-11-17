import 'fake-indexeddb/auto';import test from 'node:test';import assert from 'node:assert/strict';import {openDB,deleteDB} from 'idb';import {ImageDB} from '../js/db.js';import {LearningStore} from '../js/learningResults/store.js';
test('v6 upgrade preserves work; atomic learning writes and owner isolation',async()=>{const name=`learning-${crypto.randomUUID()}`,legacy=await openDB(name,6,{upgrade(db){db.createObjectStore('drawings',{keyPath:'id'});db.createObjectStore('syncQueue',{keyPath:'id'});}});await legacy.put('drawings',{id:'drawing',ownerUserId:'a'});await legacy.put('syncQueue',{id:'queued',ownerUserId:'a'});legacy.close();const database=new ImageDB();database.dbName=name;let active='a';const store=new LearningStore({database,activeOwner:()=>active});try{const a={id:'attempt',ownerUserId:'a',localRevision:0,status:'pending'},op={id:'op',ownerUserId:'a',attemptId:'attempt',status:'pending'};await store.commit(a,[op]);const db=await database.open();assert.equal(db.version,7);assert.ok(await db.get('drawings','drawing'));assert.ok(await db.get('syncQueue','queued'));await assert.rejects(store.commit({...a,localRevision:1},[{...op,id:'foreign',ownerUserId:'b'}],0),{code:'OWNER_CHANGED'});assert.equal((await store.get('learningAttempts','a','attempt')).localRevision,0);assert.equal((await store.list('learningOutbox','a')).length,1);active='b';await assert.rejects(store.get('learningAttempts','a','attempt'),{code:'OWNER_CHANGED'});assert.deepEqual(await store.list('learningAttempts','b'),[]);}finally{await database.close();await deleteDB(name);}});
import {LearningSession} from '../js/learningResults/session.js';import {LearningSync} from '../js/learningResults/sync.js';import {initialHash,extendHash,canonical,byteLength,LIMITS,sha256,bytes} from '../js/learningResults/contract.js';
test('lost server acknowledgement replays frozen request and preserves newer offline answers',async()=>{
 const database=new ImageDB();database.dbName=`delivery-${crypto.randomUUID()}`;const owner='student',store=new LearningStore({database,activeOwner:()=>owner});
 const task={id:'00000000-0000-4000-8000-000000000001',contractVersion:'learning-results-v1',activity:'quiz',sharedTargetMilliseconds:10000,words:[{id:'cat',word:'CAT',options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'}]};
 let head,receipts=new Map(),lose=true,accepted=0;
 const repository={async mutate(kind,args){assert.ok(byteLength(args)<=LIMITS.request);const p=JSON.parse(args.p_payload),existing=receipts.get(args.p_operation_id);if(existing){assert.equal(existing.request,canonical(args));return existing.response;}
  if(kind==='claim')head={revision:0,acceptedThroughSequence:0,acceptedPrefixHash:await initialHash(p.attemptId,task.id),acceptedStateHash:await sha256(bytes(null)),acceptedEvidenceBytes:0};
  else {assert.equal(p.expectedRevision,head.revision);if(kind==='checkpoint'){assert.equal(p.baseSequence,head.acceptedThroughSequence);head={...head,revision:head.revision+1,acceptedThroughSequence:p.throughSequence,acceptedPrefixHash:await extendHash(head.acceptedPrefixHash,p.events),acceptedStateHash:await sha256(bytes(p.recoverableState))};accepted+=p.events.length;}else{assert.equal(p.terminalHash,head.acceptedPrefixHash);assert.ok(!Object.hasOwn(p,'events'));head={...head,revision:head.revision+1};}}
  const response={...head,status:kind==='submit'?'confirmed':'accepted',result:kind==='submit'?{points:1000}:null};receipts.set(args.p_operation_id,{request:canonical(args),response});if(kind==='checkpoint'&&lose){lose=false;throw new Error('lost response');}return response;
 }};
 try{const session=await LearningSession.create({task,ownerUserId:owner,preparationId:'prepared',seed:1,store,owner:()=>owner});await session.resume();const sync=new LearningSync({store,repository,activeOwner:()=>owner});await assert.rejects(sync.drain(owner),/lost response/);await session.original('cat:0',{optionId:'yes'});await session.submit();await sync.drain(owner);const saved=await store.get('learningAttempts',owner,session.attempt.id);assert.equal(saved.confirmed,true);assert.equal(accepted,saved.events.length);assert.equal(saved.state.originals['cat:0'].correct,true);}finally{await database.close();await deleteDB(database.dbName);}
});
import {buildCheckpoint,recoveryAt} from '../js/learningResults/sync.js';
test('large checkpoint is split at a byte-bounded prefix with the matching recovery state',async()=>{
 const attempt={id:crypto.randomUUID(),schedule:[{id:'cat:0'}],events:[]};
 for(let i=0;i<30;i++)attempt.events.push({attemptId:attempt.id,eventId:crypto.randomUUID(),sequence:i+1,type:'draft',recordedMilliseconds:i*10,draft:{value:'x'.repeat(1000),number:i}});
 const head={revision:0,sequence:0,hash:await initialHash(attempt.id,crypto.randomUUID())};
 const intent={throughSequence:30,localRevision:30,state:recoveryAt(attempt,30)};
 const first=await buildCheckpoint({attempt,head,intent,operationId:crypto.randomUUID(),requestLimit:6000});
 assert.ok(byteLength(first)<=6000);const p=JSON.parse(first.p_payload);
 assert.ok(p.throughSequence>0 && p.throughSequence<30);
 assert.equal(p.recoverableState.draft.number,p.throughSequence-1);
 assert.equal(p.recoverableState.recordedMilliseconds,(p.throughSequence-1)*10);
 assert.equal(p.throughHash,await extendHash(head.hash,attempt.events.slice(0,p.throughSequence)));
});
test('atomic acknowledgement retains the next checkpoint chunk across a reload',async()=>{
 const database=new ImageDB();database.dbName=`chunks-${crypto.randomUUID()}`;const owner='student',store=new LearningStore({database,activeOwner:()=>owner});
 const id=crypto.randomUUID(),attempt={id,ownerUserId:owner,localRevision:1},operation={id:crypto.randomUUID(),ownerUserId:owner,attemptId:id,kind:'checkpoint',status:'pending',localRevision:1,throughSequence:100};
 try {
  await store.commit(attempt,[operation]);
  const continuation={...operation,id:crypto.randomUUID()};
  await store.acknowledge(owner,operation.id,{acceptedThroughSequence:10},{serverHead:{sequence:10}},continuation);
  const pending=(await store.list('learningOutbox',owner)).filter(op=>op.status==='pending');
  assert.equal(pending.length,1);assert.equal(pending[0].throughSequence,100);assert.equal(pending[0].id,continuation.id);
 }finally{await database.close();await deleteDB(database.dbName);}
});
test('coalescing retains frozen requests and safely replaces only unsent checkpoints',async()=>{
 const database=new ImageDB();database.dbName=`coalesce-${crypto.randomUUID()}`;const owner='student',store=new LearningStore({database,activeOwner:()=>owner});
 const id=crypto.randomUUID(),attempt={id,ownerUserId:owner,localRevision:0},operation=(revision,request)=>({id:crypto.randomUUID(),ownerUserId:owner,attemptId:id,kind:'checkpoint',status:'pending',localRevision:revision,throughSequence:revision,...(request?{request}: {})});
 const operations=[operation(1),operation(2,{frozen:true}),operation(3),operation(4)];
 try {
  await store.commit(attempt,operations);await store.coalesceCheckpoints(owner);
  const rows=await store.list('learningOutbox',owner),pending=rows.filter(op=>op.status==='pending');
  assert.deepEqual(pending.map(op=>op.localRevision).sort(),[1,2,4]);
  assert.deepEqual(rows.find(op=>op.id===operations[1].id).request,{frozen:true});
  assert.equal(rows.find(op=>op.id===operations[2].id).supersededBy,operations[3].id);
  await assert.rejects(store.saveRequest(owner,operations[2].id,{}),{code:'OPERATION_SUPERSEDED'});
 }finally{await database.close();await deleteDB(database.dbName);}
});
test('replayed acknowledgements cannot create duplicate continuation chunks',async()=>{
 const database=new ImageDB();database.dbName=`replayed-chunk-${crypto.randomUUID()}`;const owner='student',store=new LearningStore({database,activeOwner:()=>owner});
 const id=crypto.randomUUID(),attempt={id,ownerUserId:owner,localRevision:0},op={id:crypto.randomUUID(),ownerUserId:owner,attemptId:id,kind:'checkpoint',status:'pending',localRevision:1,throughSequence:100};
 try {
  await store.commit(attempt,[op]);const response={acceptedThroughSequence:10},patch={serverHead:{sequence:10,revision:1}};
  await store.acknowledge(owner,op.id,response,patch,{...op,id:crypto.randomUUID()});
  await store.acknowledge(owner,op.id,response,patch,{...op,id:crypto.randomUUID()});
  assert.equal((await store.list('learningOutbox',owner)).filter(row=>row.status==='pending').length,1);
 }finally{await database.close();await deleteDB(database.dbName);}
});

test('a matching accepted prefix reconciles into a new suffix operation without rewriting the frozen request',async()=>{
 const database=new ImageDB();database.dbName=`reconcile-${crypto.randomUUID()}`;const owner='student',store=new LearningStore({database,activeOwner:()=>owner});
 const task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity:'quiz',sharedTargetMilliseconds:10000,words:[{id:'cat',word:'CAT',options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'}]};
 let head,conflict=true,session;const sent=[];
 const repository={async read(){return {...head,status:'ok',state:recoveryAt(session.attempt,head.acceptedThroughSequence),result:null};},async mutate(kind,args){
  const p=JSON.parse(args.p_payload);
  if(kind==='claim')head={revision:0,acceptedThroughSequence:0,acceptedPrefixHash:await initialHash(p.attemptId,task.id),acceptedStateHash:await sha256(bytes(null)),acceptedEvidenceBytes:0};
  else if(kind==='checkpoint') {
   sent.push(structuredClone(args));
   if(conflict){conflict=false;const first=session.attempt.events[0];head={revision:1,acceptedThroughSequence:1,acceptedPrefixHash:await extendHash(head.acceptedPrefixHash,[first]),acceptedStateHash:await sha256(bytes(recoveryAt(session.attempt,1))),acceptedEvidenceBytes:frame(first).length};throw new Error('ATTEMPT_CONFLICT');}
   assert.equal(p.baseSequence,1);head={revision:head.revision+1,acceptedThroughSequence:p.throughSequence,acceptedPrefixHash:p.throughHash,acceptedStateHash:await sha256(bytes(p.recoverableState)),acceptedEvidenceBytes:head.acceptedEvidenceBytes+p.events.reduce((n,e)=>n+frame(e).length,0)};
  }else head={...head,revision:head.revision+1};
  return {...head,status:kind==='submit'?'confirmed':'accepted',result:kind==='submit'?{points:1000}:null};
 }};
 try {
  session=await LearningSession.create({task,ownerUserId:owner,preparationId:'p',seed:1,store,owner:()=>owner});await session.resume();await session.original('cat:0',{optionId:'yes'});await session.submit();
  await new LearningSync({store,repository,activeOwner:()=>owner}).drain(owner);
  assert.equal(sent.length,2);assert.notEqual(sent[0].p_operation_id,sent[1].p_operation_id);
  const frozen=(await store.list('learningOutbox',owner)).find(row=>row.id===sent[0].p_operation_id);
  assert.equal(frozen.status,'superseded');assert.equal(canonical(frozen.request),canonical(sent[0]));
  assert.equal((await store.get('learningAttempts',owner,session.attempt.id)).confirmed,true);
 }finally{await database.close();await deleteDB(database.dbName);}
});

import {frame} from '../js/learningResults/contract.js';
import {LearningDelivery} from '../js/learningResults/delivery.js';
test('delivery backs off network failures with the same immutable request and holds only a conflicting attempt',async()=>{
 const database=new ImageDB();database.dbName=`retry-policy-${crypto.randomUUID()}`;const owner='student',store=new LearningStore({database,activeOwner:()=>owner});let now=0;
 const a={id:crypto.randomUUID(),ownerUserId:owner,localRevision:0},b={id:crypto.randomUUID(),ownerUserId:owner,localRevision:0};
 const op={id:crypto.randomUUID(),ownerUserId:owner,attemptId:a.id,kind:'claim',status:'pending',localRevision:0,request:{frozen:'request'}};
 const other={...op,id:crypto.randomUUID(),attemptId:b.id};
 try {
  await store.commit(a,[op]);await store.commit(b,[other]);let calls=0;
  const sync={async drain(){calls++;const pending=(await store.list('learningOutbox',owner)).filter(row=>row.status==='pending' && (row.retryAt||0)<=now);if(!pending.length)return;
   const selected=pending.find(row=>row.id===op.id)||pending[0];
   if(selected.id===op.id){const error=new Error(calls===1?'network disconnected':'ATTEMPT_CONFLICT');error.learningOperationId=op.id;throw error;}
   await store.acknowledge(owner,selected.id,{status:'accepted'},{});
  }};
  const delivery=new LearningDelivery({sync,store,activeOwner:()=>owner,now:()=>now,random:()=>0.5});
  const first=await delivery.run(owner);assert.equal(first.retryAt,1000);assert.equal(first.pending,1);assert.equal(first.held,0);
  assert.deepEqual((await store.get('learningOutbox',owner,op.id)).request,op.request);
  now=1000;const second=await delivery.run(owner);assert.equal(second.pending,0);assert.equal(second.held,1);
  assert.equal((await store.get('learningAttempts',owner,a.id)).syncStatus,'held');
  assert.equal((await store.get('learningOutbox',owner,other.id)).status,'accepted');
  await store.commit({...a,localRevision:1},[{...op,id:crypto.randomUUID(),localRevision:1}],0);
  assert.equal((await store.list('learningOutbox',owner)).filter(row=>row.attemptId===a.id && row.status==='pending').length,0);
 }finally{await database.close();await deleteDB(database.dbName);}
});

test('unpublished scoring is a normal server response and never becomes a downloaded package',async()=>{
 const {LearningCoordinator}=await import('../js/learningResults/coordinator.js');let saved=false,assetsLoaded=false;
 const coordinator=new LearningCoordinator({owner:()=> 'student',repository:{operation:async()=>({status:'unavailable',code:'TASK_NOT_PUBLISHED'})},store:{savePackage:async()=>{saved=true;}},prepareAssets:async()=>{assetsLoaded=true;}});
 await assert.rejects(coordinator.download({source:{kind:'assignment',id:crypto.randomUUID()},grade:7,activity:'flashcards'}),{code:'TASK_NOT_PUBLISHED'});
 assert.equal(saved,false);assert.equal(assetsLoaded,false);
});
