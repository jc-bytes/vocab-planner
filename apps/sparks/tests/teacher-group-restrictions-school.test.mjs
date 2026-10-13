import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeacherGroupRestrictionsRepository } from '../js/services/teacherGroupRestrictionsRepository.js';

function fakeClient(result = { data: [], error: null }) {
 const calls=[];
 const builder={ then(resolve,reject){return Promise.resolve(result).then(resolve,reject);} };
 for (const method of ['from','select','eq','order','insert','single','delete']) builder[method]=(...args)=>{calls.push([method,...args]);return builder;};
 return {client:{from:(...args)=>{calls.push(['from',...args]);return builder;}},calls};
}

test('pairing preference reads retain the initiating school across asynchronous client initialization', async () => {
 let school='school-a', release;
 const {client,calls}=fakeClient();
 const repository=createTeacherGroupRestrictionsRepository(()=>new Promise(resolve=>{release=resolve;}),()=>school);
 const pending=repository.list();school='school-b';release(client);await pending;
 assert.ok(calls.some(([method,key,value])=>method==='eq'&&key==='school_id'&&value==='school-a'));
 assert.ok(!calls.some(call=>call.includes('school-b')));
});

test('create and delete carry school scope and never accept a caller-supplied teacher', async () => {
 const row={id:'restriction',school_id:'school-a',teacher_id:'teacher',student_a_id:'a',student_b_id:'z'};
 const created=fakeClient({data:row,error:null});
 const repository=createTeacherGroupRestrictionsRepository(async()=>created.client,()=> 'school-a');
 const value=await repository.create('z','a');
 assert.deepEqual(created.calls.find(([method])=>method==='insert')[1],{school_id:'school-a',student_a_id:'a',student_b_id:'z'});
 assert.equal(value.schoolId,'school-a');
 const removed=fakeClient();
 await createTeacherGroupRestrictionsRepository(async()=>removed.client,()=> 'school-b').remove('restriction');
 assert.ok(removed.calls.some(([method,key,value])=>method==='eq'&&key==='school_id'&&value==='school-b'));
 assert.ok(removed.calls.some(([method,key,value])=>method==='eq'&&key==='id'&&value==='restriction'));
});

test('missing school scope stops preference operations before client access', async () => {
 let accessed=false;
 const repository=createTeacherGroupRestrictionsRepository(async()=>{accessed=true;},()=>{throw Error('Choose a school');});
 await assert.rejects(repository.list(),/Choose a school/);
 await assert.rejects(repository.create('a','b'),/Choose a school/);
 await assert.rejects(repository.remove('id'),/Choose a school/);
 assert.equal(accessed,false);
});
